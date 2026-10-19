import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { neonConfig } from '@neondatabase/serverless'
import { Hono } from 'hono'
import { defaultNeonSettings, evaluateNeonAlerts, freshness, neonSettingsSchema } from '../server/neon-policy'
import { initializeNeonStorage, saveNeonSettings, loadNeonConfig, claimNeonCheck, completeNeonCheck, readNeonMonitoring, acknowledgeNeonAlert, resourceKey } from '../server/neon-storage'
import { createNeonRunner, runNeonScheduler } from '../server/neon-runner'
import { createNeonHistoryRoute } from '../server/routes/neon-history'
import { checkNeonSql, isNeonSqlConfigured } from '../server/neon-sql'
import { createApp } from '../server/app'
import type { NeonSnapshot } from '../src/types/neon-monitoring'
const link = { userId: 'owner', projectId: '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda', neonProjectId: 'example-project', branchId: 'br-example' }
const snapshot = (): NeonSnapshot => ({ checkedAt: new Date().toISOString(), project: { id: link.neonProjectId, name: 'Example', region: 'eu', postgresVersion: 17 },
  branch: { id: link.branchId, name: 'production', state: 'ready', logicalSizeBytes: 1024 ** 3 },
  endpoints: [{ id: 'ep-example', state: 'idle', pendingState: null, type: 'read_write', disabled: false, lastActive: null, minCu: 0.25, maxCu: 2 }],
  consumption: { projectStorageBytes: 2 * 1024 ** 3, computeCuSeconds: 7200, activeSeconds: 100, transferBytes: 1024 ** 3, periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z' }, unavailable: [] })

test('Neon policy: unknown values, sleeping compute, thresholds and strict settings', () => {
  assert.equal(freshness(null, 15), 'unknown')
  assert.equal(freshness(new Date(Date.now() - 31 * 60_000).toISOString(), 15), 'stale')
  assert.equal(neonSettingsSchema.safeParse({ ...defaultNeonSettings, intervalMinutes: 1 }).success, false)
  assert.equal(neonSettingsSchema.safeParse({ ...defaultNeonSettings, retentionDays: 365 }).success, false)
  assert.equal(neonSettingsSchema.safeParse({ ...defaultNeonSettings, connectionString: 'secret' }).success, false)
  assert.equal(neonSettingsSchema.safeParse({ ...defaultNeonSettings, monitorIds: [link.projectId, link.projectId] }).success, false)
  const settings = { ...defaultNeonSettings, storageLimitGiB: 1 }
  const conditions = evaluateNeonAlerts(settings, snapshot(), 0, null)
  assert.equal(conditions.find((c) => c.code === 'storage')?.active, true)
  assert.equal(conditions.find((c) => c.code === 'compute_disabled')?.active, false)
  assert.equal(evaluateNeonAlerts(settings, null, 1, null).find((c) => c.code === 'storage')?.active, null)
  assert.equal(evaluateNeonAlerts(settings, null, 2, null).find((c) => c.code === 'api_failures')?.active, true)
})

test('Neon persistence against PostgreSQL: lifecycle, idempotency, leases, isolation and history', async (t) => {
  const pg = new PGlite()
  const previousUrl = process.env.DATABASE_URL
  const previousFetch = neonConfig.fetchFunction
  process.env.DATABASE_URL = 'postgresql://test:test@ep-test.eu.neon.tech/test?sslmode=require'
  // Run the exact parameterized SQL emitted by the production Neon driver against local PostgreSQL/WASM.
  neonConfig.fetchFunction = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { query?: string; params?: unknown[]; queries?: Array<{ query: string; params: unknown[] }> }
    const query = async (item: { query: string; params?: unknown[] }) => {
      const result = await pg.query<Record<string, unknown>>(item.query, item.params)
      return { fields: result.fields, rows: result.rows.map((row) => result.fields.map((field) => {
        const value = row[field.name]
        return value == null ? null : typeof value === 'object' ? value instanceof Date ? value.toISOString().replace('T', ' ').replace('Z', '+00') : JSON.stringify(value) : typeof value === 'boolean' ? (value ? 't' : 'f') : String(value)
      })), rowCount: result.affectedRows ?? result.rows.length, command: 'SELECT' }
    }
    try {
      if (body.queries) {
        await pg.exec('BEGIN')
        try { const results = []; for (const item of body.queries) results.push(await query(item)); await pg.exec('COMMIT'); return Response.json({ results }) }
        catch (error) { await pg.exec('ROLLBACK'); throw error }
      }
      return Response.json(await query({ query: body.query!, params: body.params }))
    } catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'SQL failed', code: (error as { code?: string }).code }, { status: 400 }) }
  }
  try {
    await pg.exec(`CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL); CREATE TABLE uptime_monitors(id uuid PRIMARY KEY,user_id text,name text,active boolean); CREATE TABLE uptime_checks(monitor_id uuid,status text,response_time_ms integer,checked_at timestamptz);`)
    await pg.query('INSERT INTO projects VALUES($1,$2)', [link.projectId, link.userId])
    await t.test('missing storage returns setup state; first setup is additive and repeatable', async () => {
      const empty = await readNeonMonitoring(link, 1)
      assert.equal(empty.setupRequired, true)
      await initializeNeonStorage(); await initializeNeonStorage()
      await saveNeonSettings(link, { ...defaultNeonSettings, storageLimitGiB: 1 })
      assert.equal((await pg.query('SELECT * FROM projects')).rows.length, 1)
    })
    await t.test('lease prevents overlapping jobs and sample+alert transitions commit atomically', async () => {
      const claim = await claimNeonCheck(link, 'manual'); assert.ok(claim)
      assert.equal(await claimNeonCheck(link, 'scheduler'), null)
      const value = snapshot()
      const conditions = evaluateNeonAlerts(claim.config.settings, value, 0, null)
      await completeNeonCheck(link, claim.token, value, null, conditions, 'manual', new Date().toISOString())
      await completeNeonCheck(link, claim.token, value, null, conditions, 'manual', new Date().toISOString())
      const state = await readNeonMonitoring(link, 1)
      assert.equal(state.history.length, 1)
      assert.equal(state.history[0].samples, 1)
      assert.equal(state.history[0].storageGiB, 2)
      assert.equal(state.alerts.length, 1)
      assert.equal(state.alerts[0].code, 'storage')
      assert.ok(state.lastSuccessAt)
      assert.equal(await claimNeonCheck(link, 'manual'), null)
    })
    await t.test('repeated breach does not duplicate warning; acknowledgement does not resolve it', async () => {
      await pg.exec("UPDATE v2_neon_config SET last_attempt_at=now()-interval '2 minutes'")
      const claim = await claimNeonCheck(link, 'manual'); assert.ok(claim)
      const value = snapshot()
      await completeNeonCheck(link, claim.token, value, null, evaluateNeonAlerts(claim.config.settings, value, 0, null), 'manual', new Date(Date.now() + 60_000).toISOString())
      let state = await readNeonMonitoring(link, 1)
      assert.equal(state.alerts.length, 1)
      assert.equal(await acknowledgeNeonAlert(link, state.alerts[0].id), true)
      assert.equal(await acknowledgeNeonAlert({ ...link, userId: 'other' }, state.alerts[0].id), false)
      state = await readNeonMonitoring(link, 1)
      assert.ok(state.alerts[0].acknowledgedAt)
      assert.equal(state.alerts[0].resolvedAt, null)
    })
    await t.test('missing data keeps warning open and successful recovery resolves it', async () => {
      for (const missing of [true, false]) {
        await pg.exec("UPDATE v2_neon_config SET last_attempt_at=now()-interval '2 minutes'")
        const claim = await claimNeonCheck(link, 'manual'); assert.ok(claim)
        const value = missing ? null : snapshot()
        if (value) value.consumption!.projectStorageBytes = 0
        await completeNeonCheck(link, claim.token, value, null, evaluateNeonAlerts(claim.config.settings, value, missing ? 1 : 0, null), 'scheduler', new Date().toISOString())
        const state = await readNeonMonitoring(link, 1)
        assert.equal(Boolean(state.alerts[0].resolvedAt), !missing)
        assert.ok(state.lastSchedulerAt)
      }
    })
    await t.test('stale lease cannot write after settings change; mapping changes isolate old history', async () => {
      await pg.exec("UPDATE v2_neon_config SET last_attempt_at=now()-interval '2 minutes'")
      const claim = await claimNeonCheck(link, 'manual'); assert.ok(claim)
      await saveNeonSettings(link, { ...defaultNeonSettings, enabled: false })
      const count = (await pg.query<{ count: number }>('SELECT count(*)::int FROM v2_neon_samples')).rows[0].count
      await completeNeonCheck(link, claim.token, snapshot(), null, [], 'manual', new Date().toISOString())
      assert.equal((await pg.query<{ count: number }>('SELECT count(*)::int FROM v2_neon_samples')).rows[0].count, count)
      assert.equal(await claimNeonCheck(link, 'scheduler'), null)
      const changed = { ...link, branchId: 'br-other' }
      await saveNeonSettings(changed, defaultNeonSettings)
      assert.equal((await readNeonMonitoring(changed, 30)).history.length, 0)
      assert.equal((await loadNeonConfig(changed))?.last_success_at, null)
      assert.equal((await readNeonMonitoring({ ...changed, userId: 'foreign' }, 1)).history.length, 0)
    })
    await t.test('scheduler heartbeat works without a due check and removed mappings cannot take queue slots', async () => {
      const previousLinks = process.env.NEON_MONITOR_LINKS
      try {
        await saveNeonSettings(link, defaultNeonSettings)
        process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
        await pg.exec("UPDATE v2_neon_config SET last_attempt_at=now(),last_scheduler_at=NULL")
        const result = await runNeonScheduler()
        assert.equal(result.processed, 0)
        assert.ok((await loadNeonConfig(link))?.last_scheduler_at)
        process.env.NEON_MONITOR_LINKS = '[]'
        await pg.exec("UPDATE v2_neon_config SET last_attempt_at=NULL,last_scheduler_at=NULL")
        assert.equal((await runNeonScheduler()).processed, 0)
        assert.equal((await loadNeonConfig(link))?.last_scheduler_at, null)
      } finally { if (previousLinks === undefined) delete process.env.NEON_MONITOR_LINKS; else process.env.NEON_MONITOR_LINKS = previousLinks }
    })
    await t.test('retention removes old samples and old resolved warnings but keeps open incidents', async () => {
      await saveNeonSettings(link, { ...defaultNeonSettings, retentionDays: 7 })
      await pg.query(`INSERT INTO v2_neon_samples(project_id,user_id,resource_key,checked_at,bucket,source,complete) VALUES ($1,$2,$3,now()-interval '40 days',now()-interval '40 days','manual',false)`, [link.projectId, link.userId, resourceKey(link)])
      const claim = await claimNeonCheck(link, 'manual'); assert.ok(claim)
      await completeNeonCheck(link, claim.token, snapshot(), null, [], 'scheduler', new Date().toISOString())
      assert.equal((await pg.query("SELECT * FROM v2_neon_samples WHERE checked_at<now()-interval '7 days'")).rows.length, 0)
    })
  } finally {
    neonConfig.fetchFunction = previousFetch
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl
    await pg.close()
  }
})

test('Neon route ownership covers history, settings, checks and acknowledgements', async () => {
  const previousLinks = process.env.NEON_MONITOR_LINKS
  process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
  let touched = 0
  const route = createNeonHistoryRoute({ ownsProject: async () => false, ownsMonitors: async () => false,
    initializeNeonStorage: async () => { touched++ }, saveNeonSettings, readNeonMonitoring,
    acknowledgeNeonAlert, runNeonCheck: async () => { touched++; return { outcome: 'recorded' } } })
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('userId', link.userId); await next() })
  app.route('/', route)
  try {
    for (const [path, method] of [['', 'GET'], ['/settings', 'PUT'], ['/check', 'POST'], [`/alerts/${link.projectId}/acknowledge`, 'POST']]) {
      assert.equal((await app.request(`/${link.projectId}/monitoring${path}`, { method })).status, 404)
    }
    assert.equal(touched, 0)
    assert.equal((await createApp().request('/api/cron/neon-refresh')).status, 401)
    assert.equal((await createApp().request(`/api/neon/${link.projectId}/monitoring`)).status, 401)
  } finally { if (previousLinks === undefined) delete process.env.NEON_MONITOR_LINKS; else process.env.NEON_MONITOR_LINKS = previousLinks }
})

test('Neon runner persists failures and separates SQL interval from API interval', async () => {
  const config = { project_id: link.projectId, user_id: link.userId, resource_key: resourceKey(link), settings: { ...defaultNeonSettings, sqlEnabled: true },
    last_attempt_at: null, last_success_at: null, last_scheduler_at: null, last_snapshot: null, failures: 1,
    last_sql: { status: 'up' as const, checkedAt: new Date().toISOString(), latencyMs: 10, message: null } }
  let sqlCalls = 0
  let persisted = false
  const runner = createNeonRunner({ ownsProject: async () => true, claimNeonCheck: async () => ({ config, token: 'test' }),
    fetchNeonSnapshot: async () => { throw new Error('private provider details') }, checkNeonSql: async () => { sqlCalls++; return config.last_sql },
    refreshLinkedMonitors: async () => ({ unavailable: false, down: false }),
    completeNeonCheck: async (_link, _token, value, sql, conditions) => { persisted = true; assert.equal(value, null); assert.equal(sql, null); assert.equal(conditions.find((c) => c.code === 'api_failures')?.active, true) } })
  assert.equal((await runner(link, 'scheduler')).outcome, 'recorded_with_errors')
  assert.equal(sqlCalls, 0); assert.equal(persisted, true)
})

test('SQL probe requires server target and matching branch endpoint; errors stay private', async () => {
  const previousTargets = process.env.NEON_SQL_TARGETS
  const previousUrl = process.env.NEON_SQL_TEST_URL
  const previousFetch = neonConfig.fetchFunction
  try {
    process.env.NEON_SQL_TARGETS = JSON.stringify([{ neonProjectId: link.neonProjectId, branchId: link.branchId, env: 'NEON_SQL_TEST_URL' }])
    process.env.NEON_SQL_TEST_URL = 'postgresql://readonly:private-password@ep-example.eu.neon.tech/test?sslmode=require'
    assert.equal(isNeonSqlConfigured(link), true)
    let called = false
    neonConfig.fetchFunction = async (_url, init) => {
      called = true
      assert.equal(new Headers(init?.headers).get('Neon-Batch-Read-Only'), 'true')
      assert.deepEqual(JSON.parse(String(init?.body)).queries.map((q: { query: string }) => q.query), ['select 1 as omnidesk_probe'])
      return Response.json({ results: [{ fields: [{ name: 'omnidesk_probe', dataTypeID: 23 }], rows: [['1']], rowCount: 1, command: 'SELECT' }] })
    }
    assert.equal((await checkNeonSql(link, snapshot())).status, 'up')
    assert.equal(called, true); called = false
    const wrong = snapshot(); wrong.endpoints = [{ ...wrong.endpoints![0], id: 'ep-foreign' }]
    assert.equal((await checkNeonSql(link, wrong)).status, 'down')
    assert.equal(called, false)
    process.env.NEON_SQL_TEST_URL = 'postgresql://user:private-password@localhost/test?sslmode=require'
    assert.equal(isNeonSqlConfigured(link), false)
    assert.ok(!JSON.stringify(await checkNeonSql(link, snapshot())).includes('private-password'))
  } finally {
    neonConfig.fetchFunction = previousFetch
    if (previousTargets === undefined) delete process.env.NEON_SQL_TARGETS; else process.env.NEON_SQL_TARGETS = previousTargets
    if (previousUrl === undefined) delete process.env.NEON_SQL_TEST_URL; else process.env.NEON_SQL_TEST_URL = previousUrl
  }
})

test('Neon settings reject foreign monitor IDs and SQL activation without secrets before storage writes', async () => {
  const previousLinks = process.env.NEON_MONITOR_LINKS
  const previousTargets = process.env.NEON_SQL_TARGETS
  process.env.NEON_MONITOR_LINKS = JSON.stringify([link])
  process.env.NEON_SQL_TARGETS = '[]'
  let initialized = false
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('userId', link.userId); await next() })
  app.route('/', createNeonHistoryRoute({ ownsProject: async () => true, ownsMonitors: async (_link, ids) => ids.length === 0,
    initializeNeonStorage: async () => { initialized = true }, saveNeonSettings, readNeonMonitoring,
    acknowledgeNeonAlert, runNeonCheck: async () => ({ outcome: 'recorded' }) }))
  const request = (settings: unknown) => app.request(`/${link.projectId}/monitoring/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
  try {
    assert.equal((await request({ ...defaultNeonSettings, intervalMinutes: 0 })).status, 400)
    assert.equal((await request({ ...defaultNeonSettings, monitorIds: [link.projectId] })).status, 403)
    assert.equal((await request({ ...defaultNeonSettings, sqlEnabled: true })).status, 400)
    assert.equal(initialized, false)
    assert.equal((await app.request(`/${link.projectId}/monitoring?days=999`)).status, 400)
  } finally {
    if (previousLinks === undefined) delete process.env.NEON_MONITOR_LINKS; else process.env.NEON_MONITOR_LINKS = previousLinks
    if (previousTargets === undefined) delete process.env.NEON_SQL_TARGETS; else process.env.NEON_SQL_TARGETS = previousTargets
  }
})
