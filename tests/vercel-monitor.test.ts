import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { createApp } from '../server/app'
import { createDeploymentsRoute } from '../server/routes/deployments'
import { fetchVercelLogs, fetchVercelSnapshot, readVercelLinks, redactBuildLog } from '../server/vercel-monitor'

const projectId = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda'
const link = { userId: 'owner', projectId, vercelProjectId: 'prj_example', teamId: 'team_example' }

test('read-only Vercel deployment monitoring', async (t) => {
  const previousLinks = process.env.DEPLOYMENT_PROJECT_LINKS
  const previousToken = process.env.DEPLOYMENT_API_TOKEN
  const originalFetch = globalThis.fetch
  process.env.DEPLOYMENT_PROJECT_LINKS = JSON.stringify([link])
  process.env.DEPLOYMENT_API_TOKEN = 'test-token-only-not-a-real-credential'
  try {
    await t.test('configuration errors name the field and never expose values', () => {
      assert.deepEqual(readVercelLinks(), [link])
      for (const raw of ['```json []```', JSON.stringify([link, link]), JSON.stringify([{ ...link, vercelProjectId: 'https://secret.test' }])]) {
        process.env.DEPLOYMENT_PROJECT_LINKS = raw
        assert.throws(readVercelLinks, (error: Error) => !error.message.includes('secret.test'))
      }
      process.env.DEPLOYMENT_PROJECT_LINKS = JSON.stringify([link])
    })
    await t.test('GET requests are scoped to project and team; production comes from explicit target', async () => {
      const paths: string[] = []
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        paths.push(url.pathname)
        assert.equal(url.origin, 'https://api.vercel.com')
        assert.equal(url.searchParams.get('teamId'), 'team_example')
        assert.equal(init?.method, 'GET')
        assert.equal(init?.redirect, 'error')
        assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${process.env.DEPLOYMENT_API_TOKEN}`)
        if (url.pathname.startsWith('/v9/')) return Response.json({ id: link.vercelProjectId, name: 'OMNIDESK V2', link: { type: 'github', org: 'owner', repo: 'OMNIDESK' },
          env: [{ value: 'must-not-expose' }], targets: { production: { id: 'dpl_production', readyState: 'READY', url: 'production.vercel.app', meta: { githubCommitSha: 'abcdef123456' } } } })
        assert.equal(url.searchParams.get('projectId'), link.vercelProjectId)
        assert.equal(url.searchParams.get('limit'), '20')
        return Response.json({ deployments: [
          { uid: 'dpl_preview', state: 'READY', target: null, created: 1000, url: 'preview.vercel.app', env: 'sensitive', meta: { githubCommitMessage: 'Preview only', otherSecret: 'must-not-expose' } },
        ] })
      }
      const result = await fetchVercelSnapshot(link)
      assert.equal(result.githubRepository, 'owner/OMNIDESK')
      assert.equal(result.production?.id, 'dpl_production')
      assert.equal(result.production?.target, 'production')
      assert.equal(result.deployments?.[0].target, 'preview')
      assert.equal(result.deployments?.[0].createdAt, 1000)
      assert.equal(result.deployments?.[0].commit.message, 'Preview only')
      assert.equal(paths.length, 2)
      assert.ok(paths.every((path) => !path.includes('events')))
      assert.ok(!JSON.stringify(result).includes('must-not-expose'))
    })
    await t.test('partial API failure is explicit; a READY history entry is not invented production', async () => {
      globalThis.fetch = async (input) => String(input).includes('/v9/') ? new Response('private-provider-error', { status: 403 })
        : Response.json({ deployments: [{ uid: 'dpl_ready', readyState: 'READY', target: 'production' }] })
      const result = await fetchVercelSnapshot(link)
      assert.equal(result.production, null)
      assert.equal(result.project, null)
      assert.deepEqual(result.unavailable, ['Projekt und Produktionszuordnung'])
      assert.ok(!JSON.stringify(result).includes('private-provider-error'))
    })
    await t.test('foreign project responses are rejected', async () => {
      globalThis.fetch = async (input) => String(input).includes('/v9/') ? Response.json({ id: 'prj_foreign', name: 'Foreign' }) : Response.json({ deployments: [] })
      await assert.rejects(fetchVercelSnapshot(link), /Projekt-ID/)
    })
    await t.test('another project deployment cannot be used to obtain logs', async () => {
      let calls = 0
      globalThis.fetch = async () => { calls++; return Response.json({ id: 'dpl_foreign', projectId: 'prj_other' }) }
      await assert.rejects(fetchVercelLogs(link, 'dpl_foreign'), /gehört nicht/)
      assert.equal(calls, 1)
      await assert.rejects(fetchVercelLogs(link, '../escape'), /Ungültige/)
      assert.equal(calls, 1)
    })
    await t.test('logs use finite build-only query, strip credentials and render chronologically', async () => {
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        assert.equal(init?.method, 'GET')
        if (!url.pathname.endsWith('/events')) return Response.json({ id: 'dpl_own', projectId: link.vercelProjectId, env: ['not exposed'] })
        assert.equal(url.searchParams.get('follow'), '0')
        assert.equal(url.searchParams.get('builds'), '1')
        assert.equal(url.searchParams.get('limit'), '100')
        return Response.json([
          { deploymentId: 'dpl_own', created: 2000, text: `token=${process.env.DEPLOYMENT_API_TOKEN}`, type: 'stderr' },
          null,
          { deploymentId: 'dpl_own', created: 1000, text: 'Building project', type: 'stdout' },
        ])
      }
      const result = await fetchVercelLogs(link, 'dpl_own')
      assert.equal(result.entries[0].text, 'Building project')
      assert.equal(result.entries[1].text, 'token=[ENTFERNT]')
      assert.ok(!JSON.stringify(result).includes(process.env.DEPLOYMENT_API_TOKEN!))
    })
    await t.test('redaction handles common credential assignments, URLs, terminal escapes and private keys', () => {
      const output = redactBuildLog('password=secret123 postgres://user:password@host/db\nAuthorization: Bearer abcdef\n\u001b[31mBuild\u001b[0m\n-----BEGIN PRIVATE KEY-----\nkeydata\n-----END PRIVATE KEY-----')
      for (const secret of ['secret123', 'user:password', 'abcdef', 'keydata', '\u001b']) assert.ok(!output.includes(secret))
      assert.match(output, /Build/)
    })
    await t.test('oversized provider responses are bounded', async () => {
      globalThis.fetch = async () => new Response('x'.repeat(2_000_001))
      await assert.rejects(fetchVercelLogs(link, 'dpl_own'), /zu groß/)
    })
    await t.test('missing token does not make an outbound request', async () => {
      delete process.env.DEPLOYMENT_API_TOKEN
      globalThis.fetch = async () => { throw new Error('must not fetch') }
      await assert.rejects(fetchVercelSnapshot(link), /DEPLOYMENT_API_TOKEN fehlt/)
      process.env.DEPLOYMENT_API_TOKEN = 'test-token-only-not-a-real-credential'
    })
    await t.test('API owner checks protect both status and log endpoints', async () => {
      let calls = 0
      const dependencies = {
        listOwnedProjects: async () => [{ id: projectId, name: 'Owned' }],
        ownsProject: async (userId: string, id: string) => userId === 'owner' && id === projectId,
        fetchVercelSnapshot: async () => { calls++; return { checkedAt: 'test' } as Awaited<ReturnType<typeof fetchVercelSnapshot>> },
        fetchVercelLogs: async () => { calls++; return { deploymentId: 'dpl_own' } as Awaited<ReturnType<typeof fetchVercelLogs>> },
      }
      const app = new Hono()
      app.use('*', async (c, next) => { c.set('userId', c.req.header('X-Test-User') || 'other'); await next() })
      app.route('/deployments', createDeploymentsRoute(dependencies))
      assert.deepEqual((await (await app.request('/deployments')).json()).links, [])
      for (const path of [`/deployments/${projectId}`, `/deployments/${projectId}/dpl_own/logs`]) assert.equal((await app.request(path)).status, 404)
      assert.equal(calls, 0)
      assert.equal((await app.request(`/deployments/${projectId}`, { headers: { 'X-Test-User': 'owner' } })).status, 200)
      assert.equal((await app.request(`/deployments/${projectId}/dpl_own/logs`, { headers: { 'X-Test-User': 'owner' } })).status, 200)
      assert.equal(calls, 2)
      for (const path of ['/api/deployments', `/api/deployments/${projectId}/dpl_own/logs`]) assert.equal((await createApp().request(path)).status, 401)
    })
    await t.test('unconfigured API remains usable without a database query', async () => {
      delete process.env.DEPLOYMENT_PROJECT_LINKS
      const route = new Hono()
      route.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      route.route('/deployments', createDeploymentsRoute({
        listOwnedProjects: async () => { throw new Error('must not query') },
        ownsProject: async () => false, fetchVercelSnapshot, fetchVercelLogs,
      }))
      const response = await route.request('/deployments')
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await response.json(), { configured: false, userId: 'owner', links: [] })
    })
  } finally {
    globalThis.fetch = originalFetch
    if (previousLinks === undefined) delete process.env.DEPLOYMENT_PROJECT_LINKS
    else process.env.DEPLOYMENT_PROJECT_LINKS = previousLinks
    if (previousToken === undefined) delete process.env.DEPLOYMENT_API_TOKEN
    else process.env.DEPLOYMENT_API_TOKEN = previousToken
  }
})
