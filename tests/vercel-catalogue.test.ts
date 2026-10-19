import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { fetchVercelProjects } from '../server/vercel-monitor'
import { createDeploymentsRoute } from '../server/routes/deployments'

test('account catalogue: pagination, teams, projection and owner isolation', async () => {
  const originalFetch = globalThis.fetch
  const token = process.env.DEPLOYMENT_API_TOKEN
  const owner = process.env.DEPLOYMENT_ACCOUNT_USER_ID
  process.env.DEPLOYMENT_API_TOKEN = 'test-only'
  process.env.DEPLOYMENT_ACCOUNT_USER_ID = 'owner'
  let calls = 0
  globalThis.fetch = async (input, init) => {
    calls++
    const url = new URL(String(input))
    assert.equal(init?.method, 'GET')
    assert.equal(url.origin, 'https://api.vercel.com')
    if (url.pathname === '/v2/teams') return Response.json({ teams: [{ id: 'team_one', name: 'Team One' }] })
    assert.equal(url.pathname, '/v10/projects')
    if (url.searchParams.has('teamId')) return Response.json({ projects: [{ id: 'prj_team', name: 'Team App', accountId: 'team_one', env: 'private' }] })
    if (url.searchParams.has('until')) return Response.json({ projects: [{ id: 'prj_second', name: 'Second' }] })
    return Response.json({ projects: [{ id: 'prj_first', name: 'First', secret: 'private' }], pagination: { next: 123 } })
  }
  try {
    const catalogue = await fetchVercelProjects()
    assert.equal(catalogue.projects.length, 3)
    assert.equal(catalogue.projects.find((p) => p.id === 'prj_team')?.teamId, 'team_one')
    assert.equal(catalogue.limited, false)
    assert.deepEqual(catalogue.unavailable, [])
    assert.ok(!JSON.stringify(catalogue).includes('private'))
    const app = new Hono()
    app.use('*', async (c, next) => { c.set('userId', c.req.header('X-Test-User') ?? 'other'); await next() })
    app.route('/', createDeploymentsRoute())
    const before = calls
    for (const path of ['/account/projects', '/account/projects/prj_first', '/account/projects/prj_first/dpl_one/logs']) {
      assert.equal((await app.request(path)).status, 403)
    }
    assert.equal(calls, before)
    assert.equal((await app.request('/account/projects', { headers: { 'X-Test-User': 'owner' } })).status, 200)
    const notFound = await app.request('/account/projects/prj_foreign', { headers: { 'X-Test-User': 'owner' } })
    assert.equal(notFound.status, 404)
    globalThis.fetch = async (input) => String(input).includes('/teams') ? new Response('', { status: 403 }) : Response.json({ projects: [{ id: 'prj_scoped', name: 'Scoped' }] })
    const partial = await fetchVercelProjects()
    assert.equal(partial.projects.length, 1)
    assert.deepEqual(partial.unavailable, ['Team-Liste'])
  } finally {
    globalThis.fetch = originalFetch
    if (token === undefined) delete process.env.DEPLOYMENT_API_TOKEN; else process.env.DEPLOYMENT_API_TOKEN = token
    if (owner === undefined) delete process.env.DEPLOYMENT_ACCOUNT_USER_ID; else process.env.DEPLOYMENT_ACCOUNT_USER_ID = owner
  }
})
