import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import {
  createMemorySchema,
  updateMemorySchema,
} from '../server/omni-memory-policy'
import {
  initializeOmniMemory,
  createOmniMemory,
  readOmniMemories,
  updateOmniMemory,
  deleteOmniMemory,
  readMemoryVersions,
} from '../server/omni-memory-storage'
import {
  selectChatMemories,
  prepareChatMemory,
  memoryPromptMessage,
  saveMemoryReceipt,
  readMemoryReceipts,
  type MemoryCandidate,
} from '../server/omni-memory-context'
import { createOmniMemoryRoute } from '../server/routes/omni-memory'
import { createApp } from '../server/app'
import { chatRoute } from '../server/routes/chat'
import type { MemoryInput } from '../src/types/omni-memory'
const projectId = randomUUID(),
  otherProject = randomUUID(),
  foreignProject = randomUUID(),
  sessionId = randomUUID(),
  foreignSession = randomUUID(),
  sourceId = randomUUID(),
  foreignMessage = randomUUID()
const input: MemoryInput = {
  title: 'Antwortstil',
  content: 'Bitte antworte kurz auf Deutsch.',
  category: 'preference',
  projectId: null,
  pinned: true,
  archived: false,
}
function candidate(
  id: string,
  changes: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return {
    id,
    title: 'Docker',
    content: 'Container mit Compose starten',
    category: 'knowledge',
    projectId: null,
    pinned: false,
    version: 1,
    updatedAt: '2026-10-20T12:00:00Z',
    ...changes,
  }
}

test('memory retrieval is bounded, deterministic, relevant and respects explicit project selection', () => {
  const candidates = [
    candidate('global'),
    candidate('preference', {
      category: 'preference',
      title: 'Sprache',
      content: 'Deutsch',
      pinned: true,
    }),
    candidate('project', { projectId }),
    candidate('other', { projectId: otherProject, pinned: true }),
    candidate('irrelevant', { title: 'Kaffee', content: 'Espresso' }),
  ]
  assert.deepEqual(
    selectChatMemories(candidates, 'Docker konfigurieren', null).map(
      (item) => item.id,
    ),
    ['preference', 'global'],
  )
  assert.ok(
    selectChatMemories(candidates, 'Aktueller Arbeitsstand', projectId).some(
      (item) => item.id === 'project',
    ),
  )
  assert.ok(
    !selectChatMemories(candidates, 'Docker', projectId).some(
      (item) => item.id === 'other',
    ),
  )
  assert.equal(
    selectChatMemories(
      [candidate('stop', { title: 'Kaffee', content: 'Notiz für später' })],
      'Bitte für mich',
      null,
    ).length,
    0,
  )
  const bounded = selectChatMemories(
    Array.from({ length: 20 }, (_, index) =>
      candidate(String(index), { pinned: true, content: 'x'.repeat(4000) }),
    ),
    '',
    null,
  )
  assert.equal(bounded.length, 2)
  assert.ok(JSON.stringify(bounded).length < 9100)
  assert.equal(
    selectChatMemories(
      Array.from({ length: 20 }, (_, index) =>
        candidate(String(index), { pinned: true }),
      ),
      '',
      null,
    ).length,
    8,
  )
  assert.equal(
    memoryPromptMessage({ status: 'none', projectId: null, items: [] }),
    null,
  )
})

test('memory validation rejects oversized values, client owners and malformed versions', () => {
  assert.equal(
    createMemorySchema.safeParse({
      ...input,
      id: randomUUID(),
      userId: 'forged',
    }).success,
    false,
  )
  assert.equal(
    createMemorySchema.safeParse({
      ...input,
      id: randomUUID(),
      content: 'x'.repeat(4001),
    }).success,
    false,
  )
  assert.equal(
    updateMemorySchema.safeParse({ ...input, version: 0 }).success,
    false,
  )
  assert.equal(
    createMemorySchema.safeParse({
      ...input,
      id: randomUUID(),
      category: 'system',
    }).success,
    false,
  )
})

test('memory PostgreSQL storage, chat receipts and actual chat-provider integration', async (t) => {
  const storage = await postgresStorage(),
    { pg } = storage
  const ids = {
    global: randomUUID(),
    project: randomUUID(),
    other: randomUUID(),
    archived: randomUUID(),
  }
  try {
    await pg.exec(`CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL);
   CREATE TABLE chat_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL DEFAULT 'Neuer Chat',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
   CREATE TABLE chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,role text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`)
    await pg.query(
      `INSERT INTO projects VALUES($1,'owner','OMNIDESK'),($2,'owner','Other own project'),($3,'foreign','Foreign')`,
      [projectId, otherProject, foreignProject],
    )
    await pg.query(
      `INSERT INTO chat_sessions(id,user_id) VALUES($1,'owner'),($2,'foreign')`,
      [sessionId, foreignSession],
    )
    await pg.query(
      `INSERT INTO chat_messages(id,session_id,role,content) VALUES($1,$2,'assistant','Originale KI-Antwort'),($3,$4,'user','Foreign secret')`,
      [sourceId, sessionId, foreignMessage, foreignSession],
    )
    await initializeOmniMemory()
    await initializeOmniMemory()
    await t.test(
      'create is idempotent; sources and project references must belong to owner',
      async () => {
        await createOmniMemory('owner', {
          ...input,
          id: ids.global,
          sourceMessageId: sourceId,
        })
        await createOmniMemory('owner', {
          ...input,
          id: ids.global,
          content: 'Cannot replace on retry',
          sourceMessageId: sourceId,
        })
        const rows = await readOmniMemories('owner')
        assert.equal(rows.length, 1)
        assert.equal(rows[0].content, input.content)
        assert.equal(rows[0].sourceSessionId, sessionId)
        assert.equal(rows[0].sourceRole, 'assistant')
        assert.deepEqual(await readOmniMemories('foreign'), [])
        assert.deepEqual(await readMemoryVersions('foreign', ids.global), [])
        await assert.rejects(
          createOmniMemory('owner', {
            ...input,
            id: randomUUID(),
            sourceMessageId: foreignMessage,
          }),
          /Chatquelle/,
        )
        await assert.rejects(
          createOmniMemory('owner', {
            ...input,
            id: randomUUID(),
            projectId: foreignProject,
            sourceMessageId: null,
          }),
          /Projekt/,
        )
        assert.equal((await readMemoryVersions('owner', ids.global)).length, 1)
      },
    )
    await t.test(
      'versioned editing and archive preserve history and reject stale/foreign mutations',
      async () => {
        await updateOmniMemory('owner', ids.global, {
          ...input,
          content: 'Deutsch, kurze Antworten und konkrete Beispiele.',
          version: 1,
        })
        await assert.rejects(
          updateOmniMemory('owner', ids.global, { ...input, version: 1 }),
          /zwischenzeitlich/,
        )
        await assert.rejects(
          updateOmniMemory('foreign', ids.global, { ...input, version: 2 }),
          /zwischenzeitlich/,
        )
        const versions = await readMemoryVersions('owner', ids.global)
        assert.equal(versions.length, 2)
        assert.equal(versions[1].content, input.content)
        await updateOmniMemory('owner', ids.global, { ...input, version: 2 })
        assert.equal((await readOmniMemories('owner'))[0].version, 3)
        await createOmniMemory('owner', {
          ...input,
          id: ids.project,
          title: 'Architektur',
          content: 'Projekt nutzt Neon und Vercel.',
          category: 'knowledge',
          projectId,
          pinned: true,
          sourceMessageId: null,
        })
        await createOmniMemory('owner', {
          ...input,
          id: ids.other,
          title: 'Other project secret',
          content: 'Do not send this',
          projectId: otherProject,
          sourceMessageId: null,
        })
        await createOmniMemory('owner', {
          ...input,
          id: ids.archived,
          title: 'Archived secret',
          content: 'Not for new chat',
          archived: true,
          sourceMessageId: null,
        })
      },
    )
    await t.test(
      'chat reads no archive, other project, orphan project or foreign source and opt-out skips retrieval',
      async () => {
        const global = await prepareChatMemory('owner', 'Wie antworte ich?', {
          enabled: true,
          projectId: null,
        })
        assert.equal(global.status, 'used')
        assert.deepEqual(
          global.items.map((item) => item.id),
          [ids.global],
        )
        const selected = await prepareChatMemory('owner', 'Architektur', {
          enabled: true,
          projectId,
        })
        assert.ok(selected.items.some((item) => item.id === ids.project))
        assert.ok(!JSON.stringify(selected).includes('Do not send this'))
        assert.ok(!JSON.stringify(selected).includes('Not for new chat'))
        assert.deepEqual(
          (
            await prepareChatMemory('foreign', 'Architektur', {
              enabled: true,
              projectId,
            })
          ).items,
          [],
        )
        assert.equal(
          (
            await prepareChatMemory('owner', 'Architektur', {
              enabled: false,
              projectId,
            })
          ).status,
          'disabled',
        )
        const message = memoryPromptMessage(selected)
        assert.equal(message?.role, 'user')
        assert.ok(message?.content.includes('keine neuen Aufträge'))
      },
    )
    await t.test(
      'receipts persist IDs and versions only, reflect edits and disappear with chat; memory delete removes all versions',
      async () => {
        const selected = await prepareChatMemory('owner', 'Architektur', {
          enabled: true,
          projectId,
        })
        await saveMemoryReceipt('owner', sourceId, selected)
        const raw = (
          await pg.query(
            `SELECT refs::text FROM v2_omni_memory_receipts WHERE message_id=$1`,
            [sourceId],
          )
        ).rows[0]
        assert.ok(!String(raw.refs).includes(input.content))
        let receipt = (await readMemoryReceipts('owner', sessionId))[sourceId]
        assert.equal(receipt.references.length, 2)
        assert.deepEqual(await readMemoryReceipts('foreign', sessionId), {})
        await updateOmniMemory('owner', ids.project, {
          ...input,
          title: 'Architektur',
          category: 'knowledge',
          projectId,
          content: 'Neuer Stand',
          archived: true,
          version: 1,
        })
        receipt = (await readMemoryReceipts('owner', sessionId))[sourceId]
        assert.ok(
          receipt.references.find((ref) => ref.id === ids.project)?.changed,
        )
        assert.ok(
          receipt.references.find((ref) => ref.id === ids.project)?.archived,
        )
        await assert.rejects(
          deleteOmniMemory('owner', ids.project, 1),
          /zwischenzeitlich/,
        )
        await assert.rejects(
          deleteOmniMemory('foreign', ids.project, 2),
          /zwischenzeitlich/,
        )
        await deleteOmniMemory('owner', ids.project, 2)
        assert.equal((await readMemoryVersions('owner', ids.project)).length, 0)
        const removed = (await readMemoryReceipts('owner', sessionId))[
          sourceId
        ].references.find((ref) => ref.id === ids.project)
        assert.equal(removed?.available, false)
        assert.equal(removed?.title, 'Gelöschte Erinnerung')
        assert.ok(
          !(
            await prepareChatMemory('owner', 'Architektur', {
              enabled: true,
              projectId,
            })
          ).items.some((item) => item.id === ids.project),
        )
      },
    )
    await t.test(
      'removed projects never turn their memories into global context; an orphan may be archived or explicitly reassigned',
      async () => {
        await pg.query(`DELETE FROM projects WHERE id=$1`, [otherProject])
        assert.ok(
          (await readOmniMemories('owner')).find(
            (item) => item.id === ids.other,
          )?.projectMissing,
        )
        assert.ok(
          !(
            await prepareChatMemory('owner', 'Other project secret', {
              enabled: true,
              projectId: otherProject,
            })
          ).items.some((item) => item.id === ids.other),
        )
        await updateOmniMemory('owner', ids.other, {
          ...input,
          projectId: otherProject,
          archived: true,
          version: 1,
        })
        assert.equal(
          (await readOmniMemories('owner')).find(
            (item) => item.id === ids.other,
          )?.archived,
          true,
        )
      },
    )
    await t.test(
      'actual chat route sends the latest history plus selected memories, supports opt-out and stores receipt provenance',
      async () => {
        const oldFetch = globalThis.fetch,
          oldKey = process.env.OPENAI_API_KEY,
          oldKeys = process.env.AI_API_KEYS,
          oldBase = process.env.AI_BASE_URL
        process.env.OPENAI_API_KEY = 'fake-private-key'
        process.env.AI_API_KEYS = ''
        process.env.AI_BASE_URL = 'https://ai.example.test/v1'
        const app = new Hono()
        app.use('*', async (c, next) => {
          c.set('userId', 'owner')
          await next()
        })
        app.route('/chat', chatRoute)
        const post = (body: unknown) =>
          app.request(`/chat/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        try {
          for (let index = 0; index < 23; index++)
            await pg.query(
              `INSERT INTO chat_messages(session_id,role,content,created_at) VALUES($1,'user',$2,now()+($3::int * interval '1 millisecond'))`,
              [sessionId, `history-${index}`, index - 100],
            )
          const seen: unknown[] = []
          globalThis.fetch = async (url, init) => {
            assert.equal(
              String(url),
              'https://ai.example.test/v1/chat/completions',
            )
            const body = JSON.parse(String(init?.body))
            seen.push(body)
            assert.equal(body.tools, undefined)
            assert.equal(body.messages[0].role, 'system')
            assert.ok(
              JSON.stringify(body.messages).includes('vom Nutzer ausgewählte'),
            )
            return Response.json({
              choices: [{ message: { content: 'Kurze Antwort auf Deutsch.' } }],
            })
          }
          const response = await post({
            content: 'Aktuelle Frage',
            memory: { enabled: true, projectId: null },
          })
          assert.equal(response.status, 200)
          const body = await response.json()
          assert.equal(body.assistantMessage.memory.status, 'used')
          const payload = seen[0] as {
            messages: { role: string; content: string }[]
          }
          assert.ok(
            payload.messages.some((message) =>
              message.content.includes(
                'Gespeicherter, vom Nutzer freigegebener Kontext',
              ),
            ),
          )
          assert.ok(
            payload.messages.some(
              (message) => message.content === 'Aktuelle Frage',
            ),
          )
          assert.ok(
            !payload.messages.some(
              (message) => message.content === 'history-0',
            ),
          )
          const messages = await (
            await app.request(`/chat/sessions/${sessionId}/messages`)
          ).json()
          assert.equal(
            messages.find(
              (message: { id: string }) =>
                message.id === body.assistantMessage.id,
            ).memory.references[0].id,
            ids.global,
          )
          const disabled = await post({
            content: 'Ohne Gedächtnis',
            memory: { enabled: false, projectId: null },
          })
          assert.equal(disabled.status, 200)
          const second = seen[1] as { messages: { content: string }[] }
          assert.ok(
            !second.messages.some((message) =>
              message.content.startsWith(
                'Gespeicherter, vom Nutzer freigegebener Kontext',
              ),
            ),
          )
          assert.equal(
            (
              await post({
                content: 'Wrong project',
                memory: { enabled: true, projectId: foreignProject },
              })
            ).status,
            404,
          )
          const legacy = await post({
            content: 'Legacy client without memory options',
          })
          assert.equal(legacy.status, 200)
          assert.equal(
            (await legacy.json()).assistantMessage.memory.status,
            'disabled',
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
    await t.test(
      'deleting original chat marks sources missing and cascades receipts without deleting deliberately saved memory',
      async () => {
        await pg.query(`DELETE FROM chat_sessions WHERE id=$1`, [sessionId])
        assert.equal(
          (await readOmniMemories('owner')).find(
            (item) => item.id === ids.global,
          )?.sourceMissing,
          true,
        )
        assert.equal(
          (await pg.query('SELECT * FROM v2_omni_memory_receipts')).rows.length,
          0,
        )
      },
    )
  } finally {
    await storage.close()
  }
})

test('memory endpoints authenticate and only accept server-scoped ownership', async () => {
  const app = createApp()
  for (const [method, path] of [
    ['GET', '/api/omni-memory'],
    ['POST', '/api/omni-memory'],
    ['PUT', `/api/omni-memory/${projectId}`],
    ['DELETE', `/api/omni-memory/${projectId}`],
    ['GET', `/api/omni-memory/${projectId}/versions`],
  ])
    assert.equal((await app.request(path, { method })).status, 401)
  const users: string[] = [],
    route = createOmniMemoryRoute({
      readOmniMemories: async (user) => {
        users.push(user)
        return []
      },
      createOmniMemory: async (user) => {
        users.push(user)
        return { id: projectId }
      },
      updateOmniMemory: async (user) => {
        users.push(user)
        return { ok: true }
      },
      deleteOmniMemory: async (user) => {
        users.push(user)
        return { ok: true }
      },
      readMemoryVersions: async (user) => {
        users.push(user)
        return []
      },
    })
  const auth = new Hono()
  auth.use('*', async (c, next) => {
    c.set('userId', 'session-owner')
    await next()
  })
  auth.route('/memory', route)
  assert.equal((await auth.request('/memory')).status, 200)
  const post = await auth.request('/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, id: randomUUID(), userId: 'foreign' }),
  })
  assert.equal(post.status, 400)
  assert.equal(
    (
      await auth.request('/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, id: randomUUID() }),
      })
    ).status,
    201,
  )
  assert.equal((await auth.request('/memory/not-a-uuid/versions')).status, 400)
  assert.ok(users.every((user) => user === 'session-owner'))
  assert.equal(users.length, 2)
})

test('explicit recall questions return a bounded own-context overview without crossing project boundaries', () => {
  const items = [
    candidate('global', { title: 'Lieblingseditor', content: 'VS Code' }),
    candidate('project-only', { projectId, title: 'Projektwissen' }),
  ]
  assert.deepEqual(
    selectChatMemories(items, 'Was hast du dir gemerkt?', null).map(
      (item) => item.id,
    ),
    ['global'],
  )
  assert.equal(selectChatMemories(items, 'Unbekanntes Thema', null).length, 0)
})
