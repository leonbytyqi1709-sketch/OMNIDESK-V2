import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { createApp } from '../server/app'
import { fetchNeonSnapshot, readNeonLinks } from '../server/neon-monitor'
import { createNeonMonitorRoute } from '../server/routes/neon-monitor'

const projectId = 'd7b2a703-4c85-46e7-950a-11327eeb5369'
const link = { userId: 'owner', projectId, neonProjectId: 'gentle-test-123', branchId: 'br-test-123' }

test('read-only project-scoped Neon monitoring', async (t) => {
  const previousLinks = process.env.NEON_MONITOR_LINKS
  const previousKey = process.env.NEON_API_KEY
  const originalFetch = globalThis.fetch
  process.env.NEON_API_KEY = 'test-only-neon-key'
  process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
  try {
    await t.test('configuration rejects malformed IDs and duplicate project assignments', () => {
      assert.deepEqual(readNeonLinks(), [link])
      for (const value of ['not json', JSON.stringify([{ ...link, branchId: '../escape' }]), JSON.stringify([link, link])]) {
        process.env.NEON_MONITOR_LINKS = value
        assert.throws(readNeonLinks, /ungültig/)
      }
      process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
    })
    await t.test('configuration and database lookup failures are distinguishable without exposing values', async () => {
      let queries = 0
      const app = new Hono()
      app.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      app.route('/neon', createNeonMonitorRoute({
        listOwnedProjects: async () => { queries++; throw new Error('sensitive database connection details') },
        ownsProject: async () => false,
        fetchNeonSnapshot,
      }))
      process.env.NEON_MONITOR_LINKS = '```json\n[]\n```'
      const invalid = await app.request('/neon')
      assert.equal(invalid.status, 503)
      const invalidBody = await invalid.json()
      assert.equal(invalidBody.code, 'NEON_CONFIG_INVALID')
      assert.match(invalidBody.error, /ungültiges JSON/)
      assert.equal(queries, 0)
      process.env.NEON_MONITOR_LINKS = JSON.stringify([{ ...link, branchId: 'https://not-a-branch' }])
      const fieldBody = await (await app.request('/neon')).json()
      assert.equal(fieldBody.code, 'NEON_CONFIG_INVALID')
      assert.match(fieldBody.error, /0.branchId/)
      assert.ok(!fieldBody.error.includes('https://not-a-branch'))
      process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
      const unavailable = await app.request('/neon')
      assert.equal(unavailable.status, 503)
      const databaseBody = await unavailable.json()
      assert.equal(databaseBody.code, 'NEON_PROJECT_LOOKUP_FAILED')
      assert.ok(!JSON.stringify(databaseBody).includes('sensitive'))
    })
    await t.test('snapshot uses only GET, filters other branches and never returns credentials', async () => {
      let requests = 0
      globalThis.fetch = async (input, init) => {
        requests++
        const url = new URL(String(input))
        assert.equal(url.origin, 'https://console.neon.tech')
        assert.equal(init?.method, 'GET')
        assert.equal(init?.redirect, 'error')
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-only-neon-key')
        if (url.pathname.endsWith('/endpoints')) return Response.json({ endpoints: [
          { id: 'ep-own', branch_id: link.branchId, project_id: link.neonProjectId, current_state: 'suspended', type: 'read_write', disabled: false },
          { id: 'ep-other', branch_id: 'br-other', project_id: link.neonProjectId, current_state: 'active', type: 'read_write', disabled: false },
        ] })
        if (url.pathname.includes('/branches/')) return Response.json({ branch: { id: link.branchId, project_id: link.neonProjectId, name: 'development', current_state: 'ready', logical_size: 0 } })
        return Response.json({ project: { id: link.neonProjectId, name: 'Test', compute_time_seconds: 3600, connection_uri: 'never-expose' } })
      }
      const result = await fetchNeonSnapshot(link)
      assert.equal(requests, 3)
      assert.equal(result.endpoints?.length, 1)
      assert.equal(result.endpoints?.[0].state, 'suspended')
      assert.equal(result.branch?.logicalSizeBytes, 0)
      assert.equal(result.consumption?.computeCuSeconds, 3600)
      assert.equal(result.consumption?.transferBytes, null)
      assert.ok(!JSON.stringify(result).includes('never-expose'))
      assert.ok(!JSON.stringify(result).includes('test-only-neon-key'))
    })
    await t.test('partial failures stay explicit instead of appearing as zero usage', async () => {
      globalThis.fetch = async (input) => String(input).includes('/branches/')
        ? Response.json({ branch: { id: link.branchId, project_id: link.neonProjectId, name: 'dev', current_state: 'ready' } })
        : new Response('sensitive-provider-error', { status: 403 })
      const result = await fetchNeonSnapshot(link)
      assert.equal(result.project, null)
      assert.equal(result.consumption, null)
      assert.equal(result.endpoints, null)
      assert.deepEqual(result.unavailable, ['Projektwerte', 'Compute-Status'])
      assert.ok(!JSON.stringify(result).includes('sensitive'))
    })
    await t.test('fully unavailable service and wrong branch identity fail closed', async () => {
      globalThis.fetch = async () => new Response('secret', { status: 429 })
      await assert.rejects(fetchNeonSnapshot(link), /nicht abrufbar/)
      globalThis.fetch = async (input) => String(input).includes('/branches/')
        ? Response.json({ branch: { id: 'br-wrong', project_id: link.neonProjectId, name: 'wrong', current_state: 'ready' } })
        : new Response(null, { status: 503 })
      await assert.rejects(fetchNeonSnapshot(link), /Branchzuordnung/)
    })
    await t.test('authorization requires both configured user assignment and current project ownership', async () => {
      let remoteCalls = 0
      let ownershipChecks = 0
      const dependencies = {
        listOwnedProjects: async () => [{ id: projectId, name: 'My project' }],
        ownsProject: async (userId: string, id: string) => { ownershipChecks++; return userId === 'owner' && id === projectId },
        fetchNeonSnapshot: async () => { remoteCalls++; return { checkedAt: 'test' } as Awaited<ReturnType<typeof fetchNeonSnapshot>> },
      }
      const app = new Hono()
      app.use('*', async (c, next) => { c.set('userId', c.req.header('X-Test-User') || 'other'); await next() })
      app.route('/neon', createNeonMonitorRoute(dependencies))
      const forbidden = await app.request(`/neon/${projectId}`)
      assert.equal(forbidden.status, 404)
      assert.equal(remoteCalls, 0)
      assert.equal(ownershipChecks, 0)
      const hiddenList = await (await app.request('/neon')).json()
      assert.deepEqual(hiddenList.links, [])
      const allowed = await app.request(`/neon/${projectId}`, { headers: { 'X-Test-User': 'owner' } })
      assert.equal(allowed.status, 200)
      assert.equal(remoteCalls, 1)
      const stale = new Hono()
      stale.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      stale.route('/neon', createNeonMonitorRoute({ ...dependencies, ownsProject: async () => false }))
      assert.equal((await stale.request(`/neon/${projectId}`)).status, 404)
      assert.equal(remoteCalls, 1)
      const unauthenticated = await createApp().request('/api/neon')
      assert.equal(unauthenticated.status, 401)
    })
    await t.test('unconfigured overview does not access the database or Neon', async () => {
      delete process.env.NEON_MONITOR_LINKS
      const app = new Hono()
      app.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      app.route('/neon', createNeonMonitorRoute({
        listOwnedProjects: async () => { throw new Error('must not query') },
        ownsProject: async () => { throw new Error('must not query') },
        fetchNeonSnapshot: async () => { throw new Error('must not fetch') },
      }))
      const response = await app.request('/neon')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await response.json(), { configured: false, userId: 'owner', links: [] })
    })
  } finally {
    globalThis.fetch = originalFetch
    if (previousLinks === undefined) delete process.env.NEON_MONITOR_LINKS
    else process.env.NEON_MONITOR_LINKS = previousLinks
    if (previousKey === undefined) delete process.env.NEON_API_KEY
    else process.env.NEON_API_KEY = previousKey
  }
})
