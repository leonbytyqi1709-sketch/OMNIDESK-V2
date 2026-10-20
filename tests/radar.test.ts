import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import {
  publicRadarAddress,
  radarUrl,
  canonicalRadarLink,
  radarMatches,
  radarTopicInput,
} from '../server/radar-policy'
import {
  parseRadarFeed,
  feedText,
  requestRadarFeed,
} from '../server/radar-feed'
import {
  initializeRadar,
  readRadar,
  saveRadarTopic,
  createRadarSource,
  changeRadarSource,
  markRadarGroup,
  deleteRadarRecord,
} from '../server/radar-storage'
import { refreshRadarSource } from '../server/radar-runner'
import { saveRadarMemory, explainRadarItem } from '../server/radar-actions'
import { createRadarRoute } from '../server/routes/radar'
import { createApp } from '../server/app'
const project = randomUUID(),
  foreignProject = randomUUID()
const rss = (
  title = 'React Release',
  link = 'https://example.com/article?utm_source=test',
) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Updates</title><item><title>${title}</title><link>${link.replace(/&/g, '&amp;')}</link><description><![CDATA[<p>React 20 adds improvements.</p><script>runBadCode()</script>]]></description><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`
const response = (body = rss()) => ({
  status: 200,
  body,
  etag: '"feed-1"',
  modified: 'Tue, 20 Oct 2026 10:00:00 GMT',
})

test('radar rejects private networks, embedded credentials and unsafe protocols including mapped IPv6', async () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.2',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])
    assert.equal(publicRadarAddress(ip), false, ip)
  assert.equal(publicRadarAddress('8.8.8.8'), true)
  assert.equal(publicRadarAddress('2606:4700:4700::1111'), true)
  for (const url of [
    'http://example.com',
    'https://localhost/feed',
    'https://x.internal/feed',
    'https://127.0.0.1',
    'https://[::ffff:127.0.0.1]',
    'https://user:pass@example.com',
    'https://example.com:8443/',
    'javascript:alert(1)',
  ])
    assert.throws(() => radarUrl(url), undefined, url)
  await assert.rejects(
    requestRadarFeed('https://169.254.169.254/'),
    /öffentliche/,
  )
  assert.equal(
    canonicalRadarLink(
      'https://example.com/post?version=2&utm_source=x&lang=de#part',
    ),
    'https://example.com/post?lang=de&version=2',
  )
})

test('radar parses RSS and Atom into plain bounded source facts, rejects DTD and invalid XML', () => {
  const entries = parseRadarFeed(rss(), 'https://example.com/feed')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].url, 'https://example.com/article')
  assert.equal(entries[0].excerpt, 'React 20 adds improvements.')
  assert.equal(entries[0].publishedAt, '2026-10-20T10:00:00.000Z')
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>v20 &amp; fixes</title><link rel="self" href="https://example.com/raw"/><link rel="alternate" href="/release"/><summary>New release</summary><updated>invalid date</updated></entry><entry><title>Bad</title><link href="javascript:alert(1)"/></entry></feed>`
  const parsed = parseRadarFeed(atom, 'https://example.com/feed')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].url, 'https://example.com/release')
  assert.equal(parsed[0].title, 'v20 & fixes')
  assert.equal(parsed[0].publishedAt, null)
  assert.throws(
    () =>
      parseRadarFeed(
        '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
        'https://example.com',
      ),
    /Deklarationen/,
  )
  assert.throws(
    () => parseRadarFeed('<rss><channel>', 'https://example.com'),
    /Ungültiges XML/,
  )
  assert.equal(
    feedText('<img src=x onerror=alert(1)>Hello &#128512; &amp; world'),
    'Hello 😀 & world',
  )
  assert.deepEqual(
    radarMatches('Next.js release', 'Vercel shipped this', [
      'next.js',
      'vercel',
      'neon',
    ]),
    ['next.js', 'vercel'],
  )
  assert.equal(
    radarTopicInput.safeParse({
      name: 'Topic',
      keywords: [],
      projectId: null,
      enabled: true,
    }).success,
    false,
  )
})

test('radar PostgreSQL: owned configuration, leased refresh, deduplication, saved state and source-grounded memory', async (t) => {
  const storage = await postgresStorage(),
    { pg } = storage
  try {
    await pg.exec(
      `CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL);CREATE TABLE chat_sessions(id uuid PRIMARY KEY,user_id text NOT NULL);CREATE TABLE chat_messages(id uuid PRIMARY KEY,session_id uuid,role text);`,
    )
    await pg.query(
      `INSERT INTO projects VALUES($1,'owner','OMNI'),($2,'foreign','Foreign')`,
      [project, foreignProject],
    )
    await initializeRadar()
    await initializeRadar()
    const topic = await saveRadarTopic('owner', {
      name: 'Meine Tools',
      keywords: ['react', 'next.js'],
      projectId: project,
      enabled: true,
    })
    let sourceId = '',
      itemId = ''
    await t.test(
      'foreign projects and topics cannot be attached; topic edits are versioned',
      async () => {
        await assert.rejects(
          saveRadarTopic('owner', {
            name: 'Foreign',
            keywords: ['test'],
            projectId: foreignProject,
            enabled: true,
          }),
          /gehören/,
        )
        await assert.rejects(
          createRadarSource('foreign', {
            topicId: topic.id,
            name: 'Forged',
            url: 'https://example.com/feed',
            category: 'news',
          }),
          /eigenes Thema/,
        )
        await saveRadarTopic(
          'owner',
          {
            name: 'Meine Tools',
            keywords: ['react', 'next.js'],
            projectId: project,
            enabled: true,
          },
          topic.id,
          1,
        )
        await assert.rejects(
          saveRadarTopic(
            'owner',
            { name: 'Old', keywords: ['test'], projectId: null, enabled: true },
            topic.id,
            1,
          ),
          /geändert/,
        )
        const source = await createRadarSource('owner', {
          topicId: topic.id,
          name: 'React feed',
          url: 'https://example.com/feed',
          category: 'release',
        })
        sourceId = source.id
        await assert.rejects(
          createRadarSource('owner', {
            topicId: topic.id,
            name: 'Duplicate',
            url: 'https://example.com/feed',
            category: 'release',
          }),
          /bereits vorhanden/,
        )
        assert.equal((await readRadar('foreign')).sources.length, 0)
      },
    )
    await t.test(
      'refresh owns the source, throttles repeats and saves only sanitized feed facts',
      async () => {
        let calls = 0
        const fetch = async () => {
          calls++
          return response()
        }
        assert.equal(
          (await refreshRadarSource('foreign', sourceId, fetch)).checked,
          false,
        )
        assert.equal(calls, 0)
        const result = await refreshRadarSource('owner', sourceId, fetch)
        assert.equal(result.checked, true)
        assert.equal(calls, 1)
        let overview = await readRadar('owner')
        assert.equal(overview.items.length, 1)
        itemId = overview.items[0].id
        assert.deepEqual(overview.items[0].matches, ['react'])
        assert.equal(overview.sources[0].due, false)
        assert.equal(
          (await refreshRadarSource('owner', sourceId, fetch)).checked,
          false,
        )
        assert.equal(calls, 1)
        await markRadarGroup('owner', [itemId], { read: true, saved: true })
        await pg.query(
          `UPDATE v2_radar_sources SET last_attempt=now()-interval '16 minutes' WHERE id=$1`,
          [sourceId],
        )
        await refreshRadarSource('owner', sourceId, fetch)
        overview = await readRadar('owner')
        assert.equal(overview.items.length, 1)
        assert.equal(overview.items[0].read, true)
        assert.equal(overview.items[0].saved, true)
        assert.equal((await readRadar('owner', true)).items.length, 1)
        await assert.rejects(
          markRadarGroup('foreign', [itemId], { saved: false }),
          /nicht gefunden/,
        )
      },
    )
    await t.test(
      'a failed source preserves earlier items and records a visible error; 304 needs no parse',
      async () => {
        await pg.query(
          `UPDATE v2_radar_sources SET last_attempt=now()-interval '16 minutes' WHERE id=$1`,
          [sourceId],
        )
        await refreshRadarSource('owner', sourceId, async () => ({
          status: 503,
          body: 'private upstream body',
          etag: null,
          modified: null,
        }))
        let overview = await readRadar('owner')
        assert.equal(overview.items.length, 1)
        assert.match(overview.sources[0].error!, /HTTP 503/)
        assert.ok(!overview.sources[0].error!.includes('private upstream'))
        await pg.query(
          `UPDATE v2_radar_sources SET last_attempt=now()-interval '16 minutes' WHERE id=$1`,
          [sourceId],
        )
        await refreshRadarSource('owner', sourceId, async () => ({
          status: 304,
          body: 'not XML',
          etag: null,
          modified: null,
        }))
        overview = await readRadar('owner')
        assert.equal(overview.sources[0].error, null)
        assert.equal(overview.items.length, 1)
      },
    )
    await t.test(
      'pausing a source during fetch prevents late item writes and preserves version protection',
      async () => {
        await pg.query(
          `UPDATE v2_radar_sources SET last_attempt=now()-interval '16 minutes' WHERE id=$1`,
          [sourceId],
        )
        await refreshRadarSource('owner', sourceId, async () => {
          await changeRadarSource('owner', sourceId, 1, false)
          return response(rss('Late item', 'https://example.com/late'))
        })
        assert.equal((await readRadar('owner')).items.length, 1)
        await assert.rejects(
          changeRadarSource('owner', sourceId, 1, true),
          /geändert/,
        )
        await changeRadarSource('owner', sourceId, 2, true)
      },
    )
    await t.test(
      'individual article project assignment is explicit and rejects foreign targets',
      async () => {
        await assert.rejects(
          markRadarGroup('owner', [itemId], {
            projectOverride: true,
            projectId: foreignProject,
          }),
          /nicht gefunden/,
        )
        await markRadarGroup('owner', [itemId], {
          projectOverride: true,
          projectId: null,
        })
        let item = (await readRadar('owner')).items[0]
        assert.equal(item.projectId, null)
        assert.equal(item.projectOverride, true)
        await markRadarGroup('owner', [itemId], {
          projectOverride: true,
          projectId: project,
        })
        item = (await readRadar('owner')).items[0]
        assert.equal(item.projectId, project)
        assert.equal(item.projectName, 'OMNI')
        await markRadarGroup('owner', [itemId], {
          projectOverride: false,
          projectId: null,
        })
        assert.equal((await readRadar('owner')).items[0].projectId, project)
      },
    )
    await t.test(
      'memory import is explicit, idempotent, projected to the owned project and retains original URL',
      async () => {
        await assert.rejects(
          saveRadarMemory('foreign', itemId),
          /nicht gefunden/,
        )
        const memory = await saveRadarMemory('owner', itemId)
        await saveRadarMemory('owner', itemId)
        const rows = (
          await pg.query('SELECT * FROM v2_omni_memories WHERE id=$1', [
            memory.id,
          ])
        ).rows
        assert.equal(rows.length, 1)
        assert.equal(rows[0].project_id, project)
        assert.ok(
          String(rows[0].content).includes('https://example.com/article'),
        )
        assert.ok(String(rows[0].content).includes('ungeprüfter Quellenauszug'))
      },
    )
    await t.test(
      'AI receives only the feed excerpt, never project data; caches valid results and isolates stale content',
      async () => {
        const oldFetch = globalThis.fetch,
          oldKey = process.env.OPENAI_API_KEY,
          oldBase = process.env.AI_BASE_URL
        process.env.OPENAI_API_KEY = 'test-key'
        process.env.AI_BASE_URL = 'https://ai.example.test/v1'
        let calls = 0
        try {
          globalThis.fetch = async (_url, init) => {
            calls++
            const body = JSON.parse(String(init?.body))
            assert.equal(body.tools, undefined)
            assert.equal(init?.redirect, 'error')
            const content = JSON.parse(body.messages[1].content)
            assert.deepEqual(Object.keys(content).sort(), ['excerpt', 'title'])
            return Response.json({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      summary:
                        'React veröffentlicht Verbesserungen laut Feed-Auszug.',
                    }),
                  },
                },
              ],
            })
          }
          assert.ok((await explainRadarItem('owner', itemId)).summary)
          await explainRadarItem('owner', itemId)
          assert.equal(calls, 1)
        } finally {
          globalThis.fetch = oldFetch
          if (oldKey === undefined) delete process.env.OPENAI_API_KEY
          else process.env.OPENAI_API_KEY = oldKey
          if (oldBase === undefined) delete process.env.AI_BASE_URL
          else process.env.AI_BASE_URL = oldBase
        }
      },
    )
    await t.test(
      'scheduler success is recorded separately from browser refresh',
      async () => {
        await pg.query(
          `UPDATE v2_radar_sources SET last_attempt=now()-interval '16 minutes' WHERE id=$1`,
          [sourceId],
        )
        await refreshRadarSource(
          'owner',
          sourceId,
          async () => response(),
          'scheduler',
        )
        assert.ok((await readRadar('owner')).sources[0].lastSchedulerAt)
      },
    )
    await t.test(
      'removed projects pause refresh without turning topic into personal; deleting source removes its items, not memory copies',
      async () => {
        await pg.query('DELETE FROM projects WHERE id=$1', [project])
        const overview = await readRadar('owner')
        assert.equal(overview.topics[0].projectMissing, true)
        assert.equal(overview.sources[0].due, false)
        await assert.rejects(saveRadarMemory('owner', itemId), /Projekt/)
        await deleteRadarRecord('owner', 'source', sourceId, 3)
        assert.equal((await readRadar('owner')).items.length, 0)
        assert.equal(
          (await pg.query('SELECT * FROM v2_omni_memories')).rows.length,
          1,
        )
      },
    )
  } finally {
    await storage.close()
  }
})

test('radar routes authenticate and reject browser-supplied owner, arbitrary refresh URLs and forged memory content', async () => {
  const app = createApp()
  for (const [method, path] of [
    ['GET', '/api/radar'],
    ['POST', '/api/radar/refresh'],
    ['POST', `/api/radar/items/${project}/memory`],
    ['GET', '/api/cron/radar-refresh'],
  ])
    assert.equal((await app.request(path, { method })).status, 401)
  const seen: string[] = [],
    deps = {
      initializeRadar: async () => {},
      readRadar: async (user: string) => {
        seen.push(user)
        return { topics: [], sources: [], items: [], limited: false }
      },
      saveRadarTopic: async (user: string) => {
        seen.push(user)
        return { id: project }
      },
      createRadarSource: async () => ({ id: project }),
      changeRadarSource: async () => ({ ok: true }),
      deleteRadarRecord: async () => ({ ok: true }),
      markRadarItem: async () => ({ ok: true }),
      markRadarGroup: async () => ({ ok: true }),
      refreshRadar: async (user: string) => {
        seen.push(user)
        return []
      },
      saveRadarMemory: async () => ({ id: project }),
      explainRadarItem: async () => ({ summary: '', relevance: '' }),
    }
  const auth = new Hono()
  auth.use('*', async (c, next) => {
    c.set('userId', 'session-owner')
    await next()
  })
  auth.route('/radar', createRadarRoute(deps))
  assert.equal((await auth.request('/radar')).status, 200)
  const post = (path: string, body: unknown) =>
    auth.request('/radar' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  assert.equal(
    (await post('/refresh', { sourceIds: [project], userId: 'foreign' }))
      .status,
    400,
  )
  assert.equal(
    (await post('/refresh', { url: 'https://169.254.169.254/' })).status,
    400,
  )
  assert.equal((await post('/refresh', { sourceIds: [project] })).status, 200)
  assert.equal(
    (await post(`/items/${project}/memory`, { content: 'forged' })).status,
    400,
  )
  assert.deepEqual(seen, ['session-owner', 'session-owner'])
})
