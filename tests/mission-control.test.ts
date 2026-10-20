import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import {
  analyzeMission,
  missionFresh,
  safeMissionUrl,
} from '../src/lib/mission-control'
import {
  createMissionLoader,
  missionDependencies,
  readMissionProject,
  readMissionTasks,
} from '../server/mission-control'
import { createMissionRoute } from '../server/routes/mission-control'
import { createMissionReport } from '../server/mission-report'
import { createApp } from '../server/app'
import { postgresStorage } from './support/postgres'
import {
  missionFixture,
  missionProjectId as id,
  missionOtherId as otherId,
} from './support/mission-fixtures'

const now = Date.now()
test('complete project data is unremarkable only within observed scope; sleeping Neon is not an outage', () => {
  const analysis = analyzeMission(missionFixture(now), now)
  assert.equal(analysis.status, 'ok')
  assert.equal(analysis.gaps.length, 0)
  assert.ok(
    analysis.connections.some((c) => c.title.includes('denselben Commit')),
  )
  assert.ok(analysis.events.some((e) => e.source === 'Vercel API'))
  assert.ok(
    analysis.events.every(
      (e, i, events) =>
        i === 0 || Date.parse(events[i - 1].at!) >= Date.parse(e.at!),
    ),
  )
})
test('missing connections, partial provider data, stale or future measurements never become healthy', () => {
  for (const change of [
    (s: ReturnType<typeof missionFixture>) => {
      s.github = { state: 'missing', data: null, message: 'Kein Repository' }
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.neon.data!.unavailable = ['branch']
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.deployment.data!.production = null
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.github.data!.runs = []
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.monitoring.data!.monitors = []
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.monitoring.data!.monitors[0].checkedAt = new Date(
        now - 16 * 60_000,
      ).toISOString()
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.monitoring.data!.monitors[0].active = false
    },
    (s: ReturnType<typeof missionFixture>) => {
      s.neon.data!.checkedAt = new Date(now - 11 * 60_000).toISOString()
    },
  ]) {
    const s = missionFixture(now)
    change(s)
    assert.equal(analyzeMission(s, now).status, 'unknown')
  }
  assert.equal(
    missionFresh(new Date(now + 3600_000).toISOString(), 15, now),
    false,
  )
  assert.equal(missionFresh('invalid', 15, now), false)
})
test('current down monitor and unresolved acknowledged alerts demand attention; old CI failures do not', () => {
  const s = missionFixture(now)
  s.github.data!.runs!.push({
    ...s.github.data!.runs![0],
    id: 'old',
    status: 'failure',
    updatedAt: new Date(now - 3600_000).toISOString(),
  })
  assert.equal(
    analyzeMission(s, now).facts.find((f) => f.id === 'github')?.status,
    'ok',
  )
  s.monitoring.data!.monitors[0].status = 'down'
  assert.equal(analyzeMission(s, now).status, 'attention')
  s.monitoring.data!.monitors[0].checkedAt = new Date(
    now - 3600_000,
  ).toISOString()
  assert.equal(analyzeMission(s, now).status, 'unknown')
  s.monitoring.data!.alerts.push({
    id: 'alert1',
    code: 'storage',
    message: 'Speichergrenze',
    severity: 'warning',
    startedAt: new Date(now - 600_000).toISOString(),
    resolvedAt: null,
    acknowledgedAt: new Date(now).toISOString(),
  })
  const a = analyzeMission(s, now)
  assert.equal(a.status, 'attention')
  assert.ok(a.connections.some((c) => c.detail.includes('keine Ursache')))
  s.monitoring.data!.alerts[0].resolvedAt = new Date(now).toISOString()
  assert.equal(
    analyzeMission(s, now).facts.find((f) => f.id === 'neon-alerts')?.status,
    'ok',
  )
})
test('cross-repository and nonmatching SHA are never correlated; unsafe source URLs are rejected', () => {
  for (const mode of ['repository', 'sha']) {
    const s = missionFixture(now)
    if (mode === 'repository')
      s.deployment.data!.githubRepository = 'example/other'
    else s.deployment.data!.production!.commit.sha = 'b'.repeat(40)
    assert.ok(
      !analyzeMission(s, now).connections.some((c) =>
        c.title.includes('denselben Commit'),
      ),
    )
  }
  for (const url of [
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example',
    'http://example.com',
    'https://user:pass@example.com',
  ])
    assert.equal(safeMissionUrl(url), null)
  assert.equal(
    safeMissionUrl('/projects?project=test'),
    '/projects?project=test',
  )
})
test('project and task SQL enforce owner AND project identity against real local PostgreSQL', async () => {
  const storage = await postgresStorage()
  try {
    await storage.pg.exec(
      'CREATE TABLE projects(id uuid PRIMARY KEY,user_id text,name text,description text,status text,updated_at timestamptz); CREATE TABLE project_tasks(id uuid,user_id text,project_id uuid,title text,status text,priority text,updated_at timestamptz)',
    )
    await storage.pg.query(
      "INSERT INTO projects VALUES($1,'owner','Owned','','active',now()),($2,'other','Foreign','','active',now())",
      [id, otherId],
    )
    await storage.pg.query(
      "INSERT INTO project_tasks VALUES(gen_random_uuid(),'owner',$1,'Mine','todo','high',now()),(gen_random_uuid(),'other',$1,'Injected foreign task','todo','high',now()),(gen_random_uuid(),'owner',$2,'Wrong owner project','todo','high',now())",
      [id, otherId],
    )
    assert.equal((await readMissionProject('owner', id))?.name, 'Owned')
    assert.equal(await readMissionProject('other', id), null)
    assert.equal(await readMissionProject('owner', otherId), null)
    assert.deepEqual(
      (await readMissionTasks('owner', id)).map((t) => t.title),
      ['Mine'],
    )
    assert.deepEqual(await readMissionTasks('owner', otherId), [])
  } finally {
    await storage.close()
  }
})
test('loader denies foreign projects before fetching providers; isolates failures and filters account monitors', async () => {
  const s = missionFixture(now),
    called: string[] = []
  const original = {
    owner: process.env.GITHUB_ACCOUNT_USER_ID,
    github: process.env.GITHUB_API_TOKEN,
    vercel: process.env.DEPLOYMENT_API_TOKEN,
    neon: process.env.NEON_API_KEY,
  }
  process.env.GITHUB_ACCOUNT_USER_ID = 'owner'
  process.env.GITHUB_API_TOKEN = 'test'
  process.env.DEPLOYMENT_API_TOKEN = 'test'
  process.env.NEON_API_KEY = 'test'
  try {
    const deps: typeof missionDependencies = {
      ...missionDependencies,
      readMissionProject: async (user, project) =>
        user === 'owner' && project === id ? s.project : null,
      readMissionTasks: async () => s.tasks.data!,
      listGitHubLinks: async () => [
        { projectId: otherId, repository: 'foreign/repo' },
        { projectId: id, repository: 'example/omnidesk' },
      ],
      fetchGitHubSnapshot: async (repository) => {
        called.push(repository)
        throw Error('secret provider body must not escape')
      },
      readVercelLinks: () => [
        { userId: 'other', projectId: id, vercelProjectId: 'foreign' },
        { userId: 'owner', projectId: id, vercelProjectId: 'owned' },
      ],
      fetchVercelSnapshot: async (link) => {
        assert.equal(link.vercelProjectId, 'owned')
        called.push('vercel')
        return s.deployment.data!
      },
      readNeonLinks: () => [
        {
          userId: 'owner',
          projectId: id,
          neonProjectId: 'neon-test',
          branchId: 'br-test',
        },
      ],
      fetchNeonSnapshot: async () => {
        called.push('neon')
        return s.neon.data!
      },
      readNeonMonitoring: async () => ({
        ...s.monitoring.data!,
        monitors: [
          ...s.monitoring.data!.monitors,
          {
            ...s.monitoring.data!.monitors[0],
            id: id,
            name: 'Unlinked',
            linked: false,
          },
        ],
      }),
    }
    const loader = createMissionLoader(deps)
    assert.equal(await loader('other', id), null)
    assert.deepEqual(called, [])
    const result = await loader('owner', id)
    assert.equal(result?.github.state, 'error')
    assert.ok(!JSON.stringify(result).includes('secret provider body'))
    assert.equal(result?.deployment.state, 'ready')
    assert.equal(result?.monitoring.data?.monitors.length, 1)
    assert.deepEqual(called.sort(), ['example/omnidesk', 'neon', 'vercel'])
    let reads = 0
    assert.equal(
      await createMissionLoader({
        ...deps,
        readMissionProject: async () => (++reads === 1 ? s.project : null),
      })('owner', id),
      null,
    )
  } finally {
    for (const [key, value] of Object.entries({
      GITHUB_ACCOUNT_USER_ID: original.owner,
      GITHUB_API_TOKEN: original.github,
      DEPLOYMENT_API_TOKEN: original.vercel,
      NEON_API_KEY: original.neon,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
test('AI selector cannot invent facts or reasons; no AI safely falls back to rule-based evidence', async () => {
  const s = missionFixture(now)
  const valid = await createMissionReport(async () => ({
    recommendations: [{ sourceId: 'github', reason: 'review' }],
  }))(s)
  assert.equal(valid.mode, 'ai')
  assert.deepEqual(valid.factIds, ['github'])
  for (const answer of [
    { recommendations: [{ sourceId: 'invented', reason: 'attention' }] },
    { recommendations: [{ sourceId: 'github', reason: 'attention' }] },
  ]) {
    const result = await createMissionReport(async () => answer as never)(s)
    assert.equal(result.mode, 'rules')
    assert.ok(
      result.factIds.every((id) =>
        analyzeMission(s).facts.some((f) => f.id === id),
      ),
    )
  }
  assert.equal(
    (
      await createMissionReport(async () => {
        throw Error('unconfigured')
      })(s)
    ).mode,
    'rules',
  )
})
test('API validates IDs, trusts server user identity, limits AI calls, and keeps existing auth/cron routes', async () => {
  const s = missionFixture(now),
    owners: string[] = []
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', 'owner')
    await next()
  })
  app.route(
    '/mission',
    createMissionRoute({
      loadMission: async (user, project) => {
        owners.push(user)
        return project === id ? s : null
      },
      generateMissionReport: createMissionReport(async () => ({
        recommendations: [],
      })),
    }),
  )
  assert.equal((await app.request('/mission/not-a-uuid')).status, 400)
  assert.equal((await app.request('/mission/' + otherId)).status, 404)
  const response = await app.request('/mission/' + id + '?userId=other')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.ok(owners.every((u) => u === 'owner'))
  assert.equal(
    (
      await app.request(`/mission/${id}/report`, {
        method: 'POST',
        body: JSON.stringify({ userId: 'other', facts: ['invented'] }),
      })
    ).status,
    200,
  )
  assert.equal(
    (await app.request(`/mission/${id}/report`, { method: 'POST' })).status,
    429,
  )
  const real = createApp(),
    paths = real.routes.map((r) => r.path)
  assert.ok(!paths.some((p) => /radar/.test(p)))
  for (const path of [
    '/api/cron/neon-refresh',
    '/api/cron/uptime-refresh',
    '/api/mission-control/:projectId',
  ])
    assert.ok(paths.includes(path))
  assert.equal((await real.request('/api/mission-control/' + id)).status, 401)
  assert.equal((await real.request('/api/health')).status, 200)
})
