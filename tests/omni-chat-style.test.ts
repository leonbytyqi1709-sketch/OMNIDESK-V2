import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import { chatRoute } from '../server/routes/chat'
import { isSimpleSmallTalk } from '../server/omni-chat-style'
import {
  selectChatMemories,
  type MemoryCandidate,
} from '../server/omni-memory-context'
import {
  initializeOmniMemory,
  createOmniMemory,
} from '../server/omni-memory-storage'

test('standalone smalltalk is distinguished from greetings followed by real tasks or follow-up questions', () => {
  for (const text of [
    'Hey Chat wie geht es dir so?',
    'Hallo Omni, wie geht’s dir?',
    'Moin!',
    'Wie geht es dir?',
    'Danke, das hat geholfen!',
    'Bis später 👋',
  ])
    assert.equal(isSimpleSmallTalk(text), true, text)
  for (const text of [
    'Hey Omni, erkläre mir DNS.',
    'Danke, aber warum funktioniert mein DNS nicht?',
    'Wie geht es dir und was ist mit meinem Projekt?',
    'Wie geht es mit dem Deployment weiter?',
    'Was hast du dir gemerkt?',
    'Erkläre mir das ausführlich.',
  ])
    assert.equal(isSimpleSmallTalk(text), false, text)
})
test('pinning and selecting a project no longer force unrelated memories into every answer', () => {
  const projectId = randomUUID()
  const candidate = (
    id: string,
    changes: Partial<MemoryCandidate> = {},
  ): MemoryCandidate => ({
    id,
    title: 'Urlaub',
    content: 'Portugal im Sommer',
    category: 'knowledge',
    projectId: null,
    pinned: true,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...changes,
  })
  const memories = [
    candidate('unrelated'),
    candidate('project', { projectId }),
    candidate('food', {
      category: 'preference',
      title: 'Lieblingsessen',
      content: 'Pizza',
    }),
    candidate('style', {
      category: 'preference',
      title: 'Antwortstil',
      content: 'Kurz auf Deutsch',
    }),
    candidate('dns', {
      title: 'DNS',
      content: 'Interner Resolver',
      pinned: false,
    }),
  ]
  assert.deepEqual(
    selectChatMemories(memories, 'Hey Chat wie geht es dir so?', projectId),
    [],
  )
  assert.deepEqual(
    selectChatMemories(memories, 'Was ist DNS?', projectId).map((m) => m.id),
    ['style', 'dns'],
  )
  assert.deepEqual(
    selectChatMemories(memories, 'Unbekanntes Thema', null).map((m) => m.id),
    ['style'],
  )
  assert.ok(
    selectChatMemories(memories, 'Was hast du dir gemerkt?', projectId).some(
      (m) => m.id === 'project',
    ),
  )
  assert.ok(
    !selectChatMemories(memories, 'Was hast du dir gemerkt?', null).some(
      (m) => m.id === 'project',
    ),
  )
})
test('real chat API isolates smalltalk, preserves actual conversations and requested code, and keeps errors short', async () => {
  const { pg, close } = await postgresStorage(),
    originalFetch = globalThis.fetch
  const names = ['OPENAI_API_KEY', 'AI_API_KEYS', 'AI_BASE_URL'] as const
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  )
  try {
    await pg.exec(`CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL);
      CREATE TABLE chat_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL DEFAULT 'Neuer Chat',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,role text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`)
    const projectId = randomUUID(),
      sessionId = randomUUID()
    await pg.query("INSERT INTO projects VALUES($1,'owner','Projekt')", [
      projectId,
    ])
    await pg.query("INSERT INTO chat_sessions(id,user_id) VALUES($1,'owner')", [
      sessionId,
    ])
    await pg.query(
      "INSERT INTO chat_messages(session_id,role,content) VALUES($1,'assistant','Ein früherer langer Projektbericht mit sehr viel Kontext.')",
      [sessionId],
    )
    await initializeOmniMemory()
    await createOmniMemory('owner', {
      id: randomUUID(),
      title: 'Projektmigration',
      content: 'Unpassender Kontext zum Serverumzug.',
      category: 'decision',
      projectId,
      pinned: true,
      archived: false,
      sourceMessageId: null,
    })
    await createOmniMemory('owner', {
      id: randomUUID(),
      title: 'Antwortstil',
      content: 'Antworte auf Deutsch.',
      category: 'preference',
      projectId: null,
      pinned: true,
      archived: false,
      sourceMessageId: null,
    })
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('userId', 'owner')
      await next()
    })
    app.route('/chat', chatRoute)
    process.env.OPENAI_API_KEY = 'fixture-key'
    process.env.AI_API_KEYS = ''
    process.env.AI_BASE_URL = 'https://ai.example.test/v1'
    const seen: {
      messages: { role: string; content: string }[]
      max_tokens?: number
    }[] = []
    let reply = 'Hey! Alles klar hier – und bei dir?'
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://ai.example.test/v1/chat/completions')
      seen.push(JSON.parse(String(init?.body)))
      return Response.json({ choices: [{ message: { content: reply } }] })
    }
    const post = (content: string) =>
      app.request('/chat/sessions/' + sessionId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          memory: { enabled: true, projectId, autoCapture: true },
        }),
      })
    const greeting = 'Hey Chat wie geht es dir so?'
    const social = await post(greeting)
    assert.equal(social.status, 200)
    const response = await social.json()
    assert.equal(response.assistantMessage.content, reply)
    assert.equal(response.assistantMessage.memory.status, 'none')
    assert.equal(response.assistantMessage.memory.references.length, 0)
    assert.equal(
      seen.length,
      1,
      'No extra memory-extraction model call for smalltalk',
    )
    assert.equal(seen[0].messages.length, 2)
    assert.equal(seen[0].messages[1].content, greeting)
    assert.ok(seen[0].max_tokens! <= 160)
    assert.ok(seen[0].messages[0].content.includes('1–3 kurze Sätze'))
    assert.ok(
      seen[0].messages[0].content.includes(
        'Im normalen Chat führst du keine Aktionen aus',
      ),
    )
    assert.equal(
      (
        await pg.query('SELECT id FROM chat_messages WHERE session_id=$1', [
          sessionId,
        ])
      ).rows.length,
      3,
      'Old conversation is retained in storage',
    )
    reply = 'DNS übersetzt Domainnamen in IP-Adressen.'
    const factual = await post('Was ist DNS?')
    assert.equal(factual.status, 200)
    const memoryContext = seen[1].messages.filter((m) =>
      m.content.startsWith('Gespeicherter, vom Nutzer freigegebener Kontext'),
    )
    assert.equal(memoryContext.length, 1)
    assert.ok(!memoryContext[0].content.includes('Unpassender Kontext'))
    assert.ok(
      seen[1].messages.some((m) => m.content === greeting),
      'Normal questions retain conversation history',
    )
    reply =
      'Hier ist das vollständige Beispiel:\n```python\nprint("Hallo")\n```'
    const detailed = await post(
      'Erkläre DNS ausführlich und zeig mir ein vollständiges Python-Beispiel.',
    )
    assert.equal(detailed.status, 200)
    assert.equal((await detailed.json()).assistantMessage.content, reply)
    assert.equal(
      seen[2].max_tokens,
      undefined,
      'Requested detail/code is not cut off by the smalltalk budget',
    )
    globalThis.fetch = async () =>
      new Response('Sehr lange technische Providerdiagnose '.repeat(200), {
        status: 503,
      })
    const unavailable = await post('Was ist ein Router?')
    const errorText = (await unavailable.json()).assistantMessage.content
    assert.ok(errorText.length < 200)
    assert.ok(!errorText.includes('Providerdiagnose'))
    delete process.env.OPENAI_API_KEY
    const unconfigured = await post('Hallo Omni')
    const unconfiguredText = (await unconfigured.json()).assistantMessage
      .content
    assert.ok(unconfiguredText.length < 200)
    assert.ok(!unconfiguredText.includes('OPENAI_API_KEY'))
  } finally {
    globalThis.fetch = originalFetch
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    await close()
  }
})
