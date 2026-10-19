import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { PGlite } from '@electric-sql/pglite'
import { neonConfig } from '@neondatabase/serverless'
import { GitHubError, fetchGitHubSnapshot, githubGet, listGitHubRepositories, repositoryName } from '../server/github-monitor'
import { createGitHubRoute } from '../server/routes/github'
import { githubLinksDdl, saveGitHubLink, listGitHubLinks, deleteGitHubLink } from '../server/github-links'
const repository = { id: 1, full_name: 'owner/OMNIDESK', name: 'OMNIDESK', private: true, default_branch: 'main', updated_at: '2026-10-19T10:00:00Z', html_url: 'https://github.com/owner/OMNIDESK', secret: 'must-not-expose' }
const id = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda'

test('GitHub read-only provider and access control', async (t) => {
  const originalFetch = globalThis.fetch
  const oldToken = process.env.GITHUB_API_TOKEN; const oldOwner = process.env.GITHUB_ACCOUNT_USER_ID
  process.env.GITHUB_API_TOKEN = 'fake-token-test-only'; process.env.GITHUB_ACCOUNT_USER_ID = 'owner'
  try {
    await t.test('catalogue follows bounded pages, deduplicates, and projects only public fields', async () => {
      let requests = 0
      globalThis.fetch = async (input, init) => {
        requests++; const url = new URL(String(input))
        assert.equal(url.origin, 'https://api.github.com'); assert.equal(url.pathname, '/user/repos')
        assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error')
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fake-token-test-only')
        return Response.json(url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, (_, i) => ({ ...repository, id: i + 1, name: `repo${i}`, full_name: `owner/repo${i}` })) : [repository])
      }
      const result = await listGitHubRepositories()
      assert.equal(requests, 2); assert.equal(result.repositories.length, 100); assert.equal(result.limited, false)
      assert.ok(!JSON.stringify(result).includes('must-not-expose'))
    })
    await t.test('detail separates PRs from issues and keeps partial Actions failure explicit', async () => {
      globalThis.fetch = async (input) => {
        const path = new URL(String(input)).pathname
        if (path.endsWith('/actions/runs')) return new Response('private-provider-error', { status: 403 })
        if (path.endsWith('/issues')) return Response.json([{ id: 1, number: 1, title: 'Issue', html_url: 'https://github.com/owner/OMNIDESK/issues/1', state: 'open' }, { id: 2, number: 2, title: 'PR in issues endpoint', html_url: 'https://github.com/owner/OMNIDESK/pull/2', state: 'open', pull_request: {} }])
        if (path.endsWith('/pulls')) return Response.json([{ id: 2, number: 2, title: 'Draft PR', html_url: 'javascript:alert(1)', state: 'open', draft: true }])
        if (path.endsWith('/commits')) return Response.json([{ sha: 'a'.repeat(40), html_url: 'https://github.com/owner/OMNIDESK/commit/abc', commit: { message: 'A commit', committer: { date: '2026-10-19T10:00:00Z' }, private: 'must-not-expose' } }])
        if (path.endsWith('/branches') || path.endsWith('/releases')) return Response.json([])
        return Response.json(repository)
      }
      const result = await fetchGitHubSnapshot('owner/OMNIDESK')
      assert.equal(result.issues?.length, 1); assert.equal(result.pulls?.[0].status, 'Entwurf'); assert.equal(result.pulls?.[0].url, '')
      assert.equal(result.runs, null); assert.deepEqual(result.unavailable, ['runs']); assert.equal(result.commits?.[0].sha, 'a'.repeat(40))
      assert.ok(!JSON.stringify(result).includes('private-provider-error')); assert.ok(!JSON.stringify(result).includes('must-not-expose'))
    })
    await t.test('rate limit, oversized responses and path/identity mismatch fail safely', async () => {
      globalThis.fetch = async () => new Response('private', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
      await assert.rejects(githubGet('/user/repos'), (error: GitHubError) => error.status === 429 && !error.message.includes('private'))
      globalThis.fetch = async () => Response.json({ ...repository, full_name: 'other/other' })
      await assert.rejects(fetchGitHubSnapshot('owner/OMNIDESK'), /Zuordnung/)
      for (const name of ['../evil', 'owner/..', 'owner/repo/extra', 'https://evil.test', 'owner/repo?x=y']) {
        assert.equal(repositoryName.safeParse(name).success, false)
        await assert.rejects(fetchGitHubSnapshot(name), /Ungültiges/)
      }
      globalThis.fetch = async () => new Response('x'.repeat(2_000_001))
      await assert.rejects(githubGet('/user/repos'), /Größenbegrenzung/)
    })
    await t.test('unconfigured token does not perform network calls', async () => {
      delete process.env.GITHUB_API_TOKEN
      globalThis.fetch = async () => { throw new Error('must not call network') }
      await assert.rejects(githubGet('/user/repos'), /GITHUB_API_TOKEN/)
      process.env.GITHUB_API_TOKEN = 'fake-token-test-only'
    })
    await t.test('all endpoints are restricted to configured owner; project ownership blocks mutations', async () => {
      let network = 0; let writes = 0
      const dependencies = { fetchGitHubSnapshot: async () => { network++; return { repository, unavailable: [] } as unknown as Awaited<ReturnType<typeof fetchGitHubSnapshot>> },
        listGitHubRepositories: async () => { network++; return { repositories: [], limited: false } }, githubProjects: async () => [], ownsGitHubProject: async () => false,
        listGitHubLinks: async () => [], saveGitHubLink: async () => { writes++; return true }, deleteGitHubLink: async () => { writes++ } }
      const app = new Hono(); app.use('*', async (c, next) => { c.set('userId', c.req.header('X-Test-User') ?? 'foreign'); await next() }); app.route('/', createGitHubRoute(dependencies))
      for (const [path, method] of [['/', 'GET'], ['/repositories/owner/OMNIDESK', 'GET'], [`/links/${id}`, 'PUT'], [`/links/${id}`, 'DELETE']]) assert.equal((await app.request(path, { method })).status, 403)
      assert.equal(network, 0); assert.equal(writes, 0)
      const mutation = await app.request(`/links/${id}`, { method: 'PUT', headers: { 'X-Test-User': 'owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: 'owner/OMNIDESK' }) })
      assert.equal(mutation.status, 404); assert.equal(network, 0); assert.equal(writes, 0)
      const ownApp = new Hono()
      ownApp.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      ownApp.route('/', createGitHubRoute({ ...dependencies, ownsGitHubProject: async () => true,
        fetchGitHubSnapshot: async () => { throw new GitHubError('Repository nicht zugänglich.', 404) } }))
      assert.equal((await ownApp.request(`/links/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository: 'owner/OMNIDESK' }) })).status, 404)
      assert.equal(writes, 0)
      delete process.env.GITHUB_API_TOKEN
      const overview = await app.request('/', { headers: { 'X-Test-User': 'owner' } })
      assert.equal((await overview.json()).configured, false); assert.equal(network, 0)
    })
  } finally {
    globalThis.fetch = originalFetch
    if (oldToken === undefined) delete process.env.GITHUB_API_TOKEN; else process.env.GITHUB_API_TOKEN = oldToken
    if (oldOwner === undefined) delete process.env.GITHUB_ACCOUNT_USER_ID; else process.env.GITHUB_ACCOUNT_USER_ID = oldOwner
  }
})

test('GitHub links persist in PostgreSQL and follow current project ownership', async () => {
  const pg = new PGlite(); const previousUrl = process.env.DATABASE_URL; const previousFetch = neonConfig.fetchFunction
  process.env.DATABASE_URL = 'postgresql://test:test@ep-test.eu.neon.tech/test?sslmode=require'
  neonConfig.fetchFunction = async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    async function query(item: { query: string; params?: unknown[] }) {
      const result = await pg.query<Record<string, unknown>>(item.query, item.params)
      return { fields: result.fields, rows: result.rows.map((row) => result.fields.map((f) => { const v = row[f.name]; return v == null ? null : typeof v === 'boolean' ? v ? 't' : 'f' : v instanceof Date ? v.toISOString().replace('T', ' ').replace('Z', '+00') : typeof v === 'object' ? JSON.stringify(v) : String(v) })), rowCount: result.rows.length, command: 'SELECT' }
    }
    try {
      if (body.queries) { await pg.exec('BEGIN'); try { const results = []; for (const q of body.queries) results.push(await query(q)); await pg.exec('COMMIT'); return Response.json({ results }) } catch (e) { await pg.exec('ROLLBACK'); throw e } }
      return Response.json(await query(body))
    } catch (error) { return Response.json({ message: (error as Error).message, code: (error as { code?: string }).code }, { status: 400 }) }
  }
  try {
    await pg.exec('CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL)')
    await pg.query('INSERT INTO projects VALUES($1,$2)', [id, 'owner'])
    assert.deepEqual(await listGitHubLinks('owner'), [])
    assert.equal(await saveGitHubLink('owner', id, 'owner/OMNIDESK'), true)
    assert.deepEqual(await listGitHubLinks('owner'), [{ projectId: id, repository: 'owner/OMNIDESK' }])
    assert.deepEqual(await listGitHubLinks('foreign'), [])
    assert.equal(await saveGitHubLink('foreign', id, 'foreign/repo'), false)
    await deleteGitHubLink('foreign', id)
    assert.equal((await listGitHubLinks('owner')).length, 1)
    await pg.query('UPDATE projects SET user_id=$1 WHERE id=$2', ['new-owner', id])
    assert.deepEqual(await listGitHubLinks('owner'), [])
    assert.equal(await saveGitHubLink('new-owner', id, 'owner/NEW'), true)
    assert.deepEqual(await listGitHubLinks('new-owner'), [{ projectId: id, repository: 'owner/NEW' }])
    await deleteGitHubLink('new-owner', id)
    assert.deepEqual(await listGitHubLinks('new-owner'), [])
    assert.ok(githubLinksDdl.startsWith('CREATE TABLE IF NOT EXISTS'))
  } finally { neonConfig.fetchFunction = previousFetch; if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl; await pg.close() }
})
