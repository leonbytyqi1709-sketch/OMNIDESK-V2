import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import {
  autoExtractionSchema,
  needsMemoryQuestion,
  sensitiveMemoryText,
} from '../server/omni-memory-auto-policy'
import { createAutoMemoryCapture } from '../server/omni-memory-auto'
import {
  initializeAutoMemory,
  claimAutoCapture,
  finishAutoCapture,
  createAutoEvent,
  applyAutoMemoryEvent,
  dismissAutoMemoryEvent,
  readAutoMemoryStates,
} from '../server/omni-memory-auto-storage'
import {
  readOmniMemories,
  updateOmniMemory,
  deleteOmniMemory,
  readMemoryVersions,
} from '../server/omni-memory-storage'
import { createAutoMemoryRoute } from '../server/routes/omni-memory-auto'
import { createApp } from '../server/app'
import { chatRoute } from '../server/routes/chat'
import type { AutoExtraction } from '../server/omni-memory-auto-policy'
const project = randomUUID(),
  foreignProject = randomUUID(),
  session = randomUUID(),
  foreignSession = randomUUID()
const quote = 'Ich bevorzuge kurze Antworten mit konkreten Beispielen.'
function item(
  evidence = quote,
  targetId: string | null = null,
  correction = false,
  certainty: 'explicit' | 'uncertain' = 'explicit',
): AutoExtraction {
  return {
    items: [
      {
        title: 'Antwortstil',
        evidence,
        category: 'preference',
        targetId,
        correction,
        certainty,
      },
    ],
  }
}

test('automatic memory uses a strict extractive schema and routes uncertainty/corrections to review', () => {
  assert.equal(
    autoExtractionSchema.safeParse({
      items: [{ ...item().items[0], userId: 'forged' }],
    }).success,
    false,
  )
  assert.equal(
    autoExtractionSchema.safeParse({ items: Array(4).fill(item().items[0]) })
      .success,
    false,
  )
  assert.equal(
    needsMemoryQuestion('Vielleicht nutze ich Neon.', 'explicit', false, false),
    true,
  )
  assert.equal(
    needsMemoryQuestion(
      'Ich bevorzuge lange Antworten.',
      'explicit',
      true,
      false,
    ),
    true,
  )
  assert.equal(
    needsMemoryQuestion(
      'Ich bevorzuge ab jetzt lange Antworten.',
      'explicit',
      true,
      true,
    ),
    false,
  )
  assert.equal(sensitiveMemoryText('Mein Passwort ist hunter12345'), true)
  assert.equal(
    sensitiveMemoryText('Authorization: Bearer fakeTokenLongEnough123'),
    true,
  )
  assert.equal(sensitiveMemoryText(quote), false)
})

test('automatic memory PostgreSQL: own statements, versions, deduplication, review and actual chat integration', async (t) => {
  const storage = await postgresStorage(),
    { pg } = storage
  try {
    await pg.exec(`CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL);
   CREATE TABLE chat_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL DEFAULT 'Neuer Chat',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,role text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`)
    await pg.query(
      `INSERT INTO projects VALUES($1,'owner','OMNI'),($2,'foreign','Private')`,
      [project, foreignProject],
    )
    await pg.query(
      `INSERT INTO chat_sessions(id,user_id) VALUES($1,'owner'),($2,'foreign')`,
      [session, foreignSession],
    )
    await initializeAutoMemory()
    await initializeAutoMemory()
    let extracted = item(),
      calls = 0,
      fail = false
    const capture = createAutoMemoryCapture({
      initializeAutoMemory,
      claimAutoCapture,
      finishAutoCapture,
      readOmniMemories,
      createAutoEvent,
      applyAutoMemoryEvent,
      extractAutoMemory: async () => {
        calls++
        if (fail) throw Error('private-provider-error')
        return extracted
      },
    })
    const pair = async (content = quote) => {
      const source = randomUUID(),
        assistant = randomUUID()
      await pg.query(
        `INSERT INTO chat_messages(id,session_id,role,content) VALUES($1,$2,'user',$3),($4,$2,'assistant','Saved answer')`,
        [source, session, content, assistant],
      )
      return { source, assistant, content }
    }
    let memoryId = '',
      firstAssistant = ''
    await t.test(
      'explicit own statement is saved once, with provenance and no duplicate extraction for same source',
      async () => {
        const p = await pair()
        await capture('owner', p.source, p.assistant, p.content, null)
        firstAssistant = p.assistant
        const memories = await readOmniMemories('owner')
        assert.equal(memories.length, 1)
        memoryId = memories[0].id
        assert.equal(memories[0].content, quote)
        assert.equal(memories[0].sourceMessageId, p.source)
        const state = (await readAutoMemoryStates('owner', session))[
          p.assistant
        ]
        assert.equal(state.events[0].status, 'saved')
        assert.equal(state.events[0].content, quote)
        const raw = (
          await pg.query('SELECT proposal FROM v2_omni_memory_auto_events')
        ).rows[0]
        assert.equal(raw.proposal, null)
        await capture('owner', p.source, p.assistant, p.content, null)
        assert.equal(calls, 1)
        await applyAutoMemoryEvent('owner', state.events[0].id)
        assert.equal((await readMemoryVersions('owner', memoryId)).length, 1)
        const duplicate = await pair()
        await capture(
          'owner',
          duplicate.source,
          duplicate.assistant,
          duplicate.content,
          null,
        )
        assert.equal((await readOmniMemories('owner')).length, 1)
      },
    )
    await t.test(
      'explicit correction updates current memory and creates a version instead of another entry',
      async () => {
        const p = await pair('Ich bevorzuge ab jetzt ausführliche Antworten.')
        extracted = item(p.content, memoryId, true)
        await capture('owner', p.source, p.assistant, p.content, null)
        const memory = (await readOmniMemories('owner'))[0]
        assert.equal(memory.version, 2)
        assert.equal(memory.content, p.content)
        assert.equal(memory.sourceMessageId, p.source)
        assert.equal(
          (await readMemoryVersions('owner', memoryId))[1].content,
          quote,
        )
      },
    )
    await t.test(
      'uncertainty is only a question until accepted; foreign approval cannot write',
      async () => {
        const p = await pair('Vielleicht bevorzuge ich künftig Codebeispiele.')
        extracted = item(p.content, memoryId, false, 'uncertain')
        await capture('owner', p.source, p.assistant, p.content, null)
        const event = (await readAutoMemoryStates('owner', session))[
          p.assistant
        ].events[0]
        assert.equal(event.status, 'pending')
        assert.equal((await readOmniMemories('owner'))[0].version, 2)
        await assert.rejects(
          applyAutoMemoryEvent('foreign', event.id),
          /nicht gefunden/,
        )
        await applyAutoMemoryEvent('owner', event.id)
        assert.equal((await readOmniMemories('owner'))[0].version, 3)
        assert.deepEqual(await readAutoMemoryStates('foreign', session), {})
      },
    )
    await t.test(
      'dismissal scrubs pending text, while stale edits and archived targets cannot be overwritten',
      async () => {
        let p = await pair('Ich bevorzuge lieber Diagramme.')
        extracted = item(p.content, memoryId)
        await capture('owner', p.source, p.assistant, p.content, null)
        let event = (await readAutoMemoryStates('owner', session))[p.assistant]
          .events[0]
        await dismissAutoMemoryEvent('owner', event.id)
        assert.equal(
          (
            await pg.query(
              'SELECT proposal FROM v2_omni_memory_auto_events WHERE id=$1',
              [event.id],
            )
          ).rows[0].proposal,
          null,
        )
        await assert.rejects(
          applyAutoMemoryEvent('owner', event.id),
          /inzwischen/,
        )
        p = await pair('Ich bevorzuge Tabellen.')
        extracted = item(p.content, memoryId)
        await capture('owner', p.source, p.assistant, p.content, null)
        event = (await readAutoMemoryStates('owner', session))[p.assistant]
          .events[0]
        const current = (await readOmniMemories('owner'))[0]
        await updateOmniMemory('owner', memoryId, {
          title: current.title,
          content: 'Manuell geprüft',
          category: current.category,
          projectId: null,
          pinned: false,
          archived: true,
          version: current.version,
        })
        await assert.rejects(
          applyAutoMemoryEvent('owner', event.id),
          /inzwischen/,
        )
        assert.equal(
          (await readOmniMemories('owner'))[0].content,
          'Manuell geprüft',
        )
      },
    )
    await t.test(
      'project context never updates personal or foreign memory, and deleted projects block pending writes',
      async () => {
        const p = await pair('Wir verwenden für OMNI Neon.')
        extracted = {
          items: [
            {
              ...item(p.content).items[0],
              title: 'Datenbank',
              category: 'decision',
            },
          ],
        }
        await capture('owner', p.source, p.assistant, p.content, project)
        const memory = (await readOmniMemories('owner')).find(
          (m) => m.projectId === project,
        )
        assert.ok(memory)
        assert.equal(memory.content, p.content)
        const cross = await pair('Wir verwenden jetzt PostgreSQL.')
        extracted = item(cross.content, memoryId, true)
        await capture(
          'owner',
          cross.source,
          cross.assistant,
          cross.content,
          project,
        )
        assert.equal(
          (await readAutoMemoryStates('owner', session))[cross.assistant].events
            .length,
          0,
        )
        const pending = await pair('Wir nutzen vielleicht Redis.')
        extracted = {
          items: [
            {
              ...item(pending.content, null, false, 'uncertain').items[0],
              title: 'Cache',
              category: 'knowledge',
            },
          ],
        }
        await capture(
          'owner',
          pending.source,
          pending.assistant,
          pending.content,
          project,
        )
        const event = (await readAutoMemoryStates('owner', session))[
          pending.assistant
        ].events[0]
        await pg.query('DELETE FROM projects WHERE id=$1', [project])
        await assert.rejects(
          applyAutoMemoryEvent('owner', event.id),
          /inzwischen/,
        )
      },
    )
    await t.test(
      'invented evidence is rejected; sensitive inputs and short replies avoid extraction; failure preserves chat',
      async () => {
        let p = await pair('Ich nutze VS Code.')
        extracted = item('Ich nutze ein erfundenes Tool.')
        await capture('owner', p.source, p.assistant, p.content, null)
        assert.equal(
          (await readAutoMemoryStates('owner', session))[p.assistant].events
            .length,
          0,
        )
        const before = calls
        for (const content of [
          'Danke!',
          'Erkläre DNS',
          'Mein Passwort ist hunter12345',
        ]) {
          p = await pair(content)
          await capture('owner', p.source, p.assistant, p.content, null)
        }
        assert.equal(calls, before)
        fail = true
        p = await pair('Ich nutze Docker.')
        await capture('owner', p.source, p.assistant, p.content, null)
        fail = false
        assert.equal(
          (await readAutoMemoryStates('owner', session))[p.assistant].status,
          'unavailable',
        )
        assert.equal(
          (
            await pg.query('SELECT content FROM chat_messages WHERE id=$1', [
              p.assistant,
            ])
          ).rows[0].content,
          'Saved answer',
        )
      },
    )
    await t.test(
      'forgetting removes current memory, versions and associated saved/pending notifications',
      async () => {
        const memory = (await readOmniMemories('owner')).find(
          (m) => m.id === memoryId,
        )!
        await deleteOmniMemory('owner', memoryId, memory.version)
        assert.equal((await readMemoryVersions('owner', memoryId)).length, 0)
        assert.equal(
          (await readAutoMemoryStates('owner', session))[firstAssistant].events
            .length,
          0,
        )
      },
    )
    await t.test(
      'actual chat endpoint obeys auto opt-out and emits persisted notice only after a real save',
      async () => {
        const oldFetch = globalThis.fetch,
          oldKey = process.env.OPENAI_API_KEY,
          oldKeys = process.env.AI_API_KEYS,
          oldBase = process.env.AI_BASE_URL
        process.env.OPENAI_API_KEY = 'test-key'
        process.env.AI_API_KEYS = ''
        process.env.AI_BASE_URL = 'https://ai.example.test/v1'
        let extractionCalls = 0
        globalThis.fetch = async (_url, init) => {
          const body = JSON.parse(String(init?.body))
          if (body.messages[0].content.startsWith('Extrahiere')) {
            extractionCalls++
            assert.equal(init?.redirect, 'error')
            assert.equal(body.tools, undefined)
            const content = JSON.parse(body.messages[1].content).message
            return Response.json({
              choices: [
                { message: { content: JSON.stringify(item(content)) } },
              ],
            })
          }
          return Response.json({
            choices: [{ message: { content: 'Alles klar.' } }],
          })
        }
        const app = new Hono()
        app.use('*', async (c, next) => {
          c.set('userId', 'owner')
          await next()
        })
        app.route('/chat', chatRoute)
        const post = (content: string, autoCapture: boolean) =>
          app.request(`/chat/sessions/${session}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              memory: { enabled: true, projectId: null, autoCapture },
            }),
          })
        try {
          let response = await post('Ich nutze Linux.', false)
          assert.equal(response.status, 200)
          assert.equal(extractionCalls, 0)
          response = await post(
            'Ich bevorzuge präzise Beispiele mit Linux.',
            true,
          )
          assert.equal(response.status, 200)
          const data = await response.json()
          assert.equal(extractionCalls, 1)
          assert.equal(
            data.assistantMessage.autoMemory.events[0].status,
            'saved',
          )
          const messages = await (
            await app.request(`/chat/sessions/${session}/messages`)
          ).json()
          assert.equal(
            messages.find(
              (m: { id: string }) => m.id === data.assistantMessage.id,
            ).autoMemory.events[0].status,
            'saved',
          )
        } finally {
          globalThis.fetch = oldFetch
          for (const [key, value] of Object.entries({
            OPENAI_API_KEY: oldKey,
            AI_API_KEYS: oldKeys,
            AI_BASE_URL: oldBase,
          }))
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
      },
    )
  } finally {
    await storage.close()
  }
})

test('auto-memory review routes derive ownership from auth and reject client proposals', async () => {
  const app = createApp()
  assert.equal(
    (
      await app.request(`/api/omni-memory-auto/${randomUUID()}/accept`, {
        method: 'POST',
      })
    ).status,
    401,
  )
  const seen: string[] = [],
    route = createAutoMemoryRoute({
      applyAutoMemoryEvent: async (user) => {
        seen.push(user)
        return { ok: true }
      },
      dismissAutoMemoryEvent: async (user) => {
        seen.push(user)
        return { ok: true }
      },
    })
  const auth = new Hono()
  auth.use('*', async (c, next) => {
    c.set('userId', 'owner')
    await next()
  })
  auth.route('/auto', route)
  for (const [action, body, status] of [
    ['accept', {}, 200],
    ['dismiss', {}, 200],
    ['accept', { userId: 'foreign', content: 'forged' }, 400],
  ] as const) {
    const response = await auth.request(`/auto/${randomUUID()}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    assert.equal(response.status, status)
  }
  assert.deepEqual(seen, ['owner', 'owner'])
})
