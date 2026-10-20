import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import { assessSecurityAccount, summarizeSecurity } from '../src/lib/account-security'
import { SecurityAccountError, securityAccountSchema } from '../server/account-security-policy'
import { createSecurityAccount, deleteSecurityAccount, initializeSecurityStorage, readSecurityOverview, reviewSecurityAccount, updateSecurityAccount } from '../server/account-security-store'
import { createAccountSecurityRoute } from '../server/routes/account-security'
import { createApp } from '../server/app'
import type { SecurityAccount, SecurityAccountInput, SecurityOverview } from '../src/types/account-security'
const connectionId = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda'
const input: SecurityAccountInput = { name: 'Private account', provider: 'Example', login: 'me@example.test', securityUrl: 'https://example.test/security', importance: 'critical',
  passkey: 'unknown', twoFactor: 'unknown', recovery: 'unknown', recoveryCodes: 'unknown', recoveryMethods: [], reviewIntervalDays: 90, connectedAccountId: null, reviewed: false }
function account(override: Partial<SecurityAccount> = {}): SecurityAccount {
  const { reviewed: _reviewed, ...details } = input
  return { ...details, id: connectionId, connection: null, version: 1, manualReviewedAt: null, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', ...override }
}

test('security assessments distinguish unknown, unsupported, actual gaps and manual review', () => {
  const unknown = assessSecurityAccount(account())
  assert.equal(unknown.status, 'unknown'); assert.ok(unknown.actions.every((action) => action.kind !== 'gap'))
  const disabled = assessSecurityAccount(account({ twoFactor: 'disabled', recovery: 'disabled', recoveryCodes: 'disabled' }))
  assert.equal(disabled.status, 'gaps'); assert.equal(disabled.actions.filter((action) => action.kind === 'gap').length, 3)
  assert.ok(disabled.actions.filter((action) => action.kind === 'gap').every((action) => action.priority === 'high'))
  const unsupported = assessSecurityAccount(account({ passkey: 'unsupported', twoFactor: 'unsupported', recoveryCodes: 'unsupported' }))
  assert.ok(!unsupported.actions.some((action) => ['codes_missing', 'two_factor_missing', 'passkey_suggested'].includes(action.code)))
  const passkey = assessSecurityAccount(account({ passkey: 'enabled', twoFactor: 'disabled' }))
  assert.ok(!passkey.actions.some((action) => action.code === 'two_factor_missing'))
  const recovery = assessSecurityAccount(account({ recovery: 'enabled' }))
  assert.ok(recovery.actions.some((action) => action.code === 'recovery_method_unknown'))
  const complete = account({ passkey: 'enabled', twoFactor: 'enabled', recovery: 'enabled', recoveryMethods: ['email'], recoveryCodes: 'enabled', manualReviewedAt: '2026-10-20T10:00:00Z' })
  assert.equal(assessSecurityAccount(complete, Date.parse('2026-10-20T11:00:00Z')).status, 'documented')
  assert.equal(assessSecurityAccount(complete, Date.parse('2027-02-01T00:00:00Z')).status, 'review')
})

test('security schema rejects secret fields, unsafe URLs, forged timestamps and inconsistent recovery methods', () => {
  assert.equal(securityAccountSchema.safeParse(input).success, true)
  for (const securityUrl of ['javascript:alert(1)', 'http://example.test/security', 'https://user:password@example.test', 'https://example.test/?token=secret', 'https://example.test/#token']) assert.equal(securityAccountSchema.safeParse({ ...input, securityUrl }).success, false)
  for (const extra of [{ password: 'private' }, { recoveryCodeValue: 'private' }, { manualReviewedAt: '2099-01-01' }, { userId: 'other' }, { id: connectionId }]) assert.equal(securityAccountSchema.safeParse({ ...input, ...extra }).success, false)
  assert.equal(securityAccountSchema.safeParse({ ...input, recoveryMethods: ['email'] }).success, false)
  assert.equal(securityAccountSchema.safeParse({ ...input, recovery: 'enabled', recoveryMethods: ['email', 'email'] }).success, false)
})

test('briefing summary has sourced links and cannot turn missing setup into an all-clear', () => {
  const overview: SecurityOverview = { setupRequired: false, accounts: [account()], connections: [], connectionsUnavailable: false, checkedAt: '2026-10-20T11:00:00Z' }
  const summary = summarizeSecurity(overview)
  assert.equal(summary.available, true); assert.equal(summary.accountsWithGaps, 0); assert.equal(summary.accountsWithUnknowns, 1); assert.equal(summary.reviewDue, 1)
  assert.ok(summary.actions.every((action) => action.source === 'manual' && action.href.includes(connectionId)))
  assert.equal(summarizeSecurity({ ...overview, setupRequired: true, accounts: [] }).available, false)
})

test('account-security storage uses PostgreSQL for setup, CRUD, ownership and stale-write protection', async (t) => {
  const store = await postgresStorage(); const { pg } = store
  let id: string
  try {
    await pg.exec(`CREATE TABLE connected_accounts(id uuid PRIMARY KEY,user_id text NOT NULL,provider text NOT NULL,email text NOT NULL,label text NOT NULL,access_token text,metadata jsonb,created_at timestamptz DEFAULT now())`)
    await pg.query('INSERT INTO connected_accounts(id,user_id,provider,email,label,access_token,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)', [connectionId, 'owner', 'google', 'me@example.test', 'My Google', 'private-token', JSON.stringify({ refreshToken: 'private-refresh' })])
    await t.test('setup is additive and repeatable; connection projection excludes tokens', async () => {
      const before = await readSecurityOverview('owner'); assert.equal(before.setupRequired, true)
      assert.equal(before.connections.length, 1); assert.ok(!JSON.stringify(before).includes('private-token')); assert.ok(!JSON.stringify(before).includes('private-refresh'))
      await initializeSecurityStorage(); await initializeSecurityStorage()
      assert.equal((await readSecurityOverview('owner')).setupRequired, false)
      assert.equal((await pg.query('SELECT * FROM connected_accounts')).rows.length, 1)
    })
    await t.test('a linked account is explicitly imported with unknown security and authoritative connection identity', async () => {
      id = (await createSecurityAccount('owner', { ...input, connectedAccountId: connectionId, provider: 'forged', login: 'forged' })).id
      const own = await readSecurityOverview('owner'); assert.equal(own.accounts.length, 1)
      assert.equal(own.accounts[0].provider, 'google'); assert.equal(own.accounts[0].login, 'me@example.test')
      assert.equal(own.accounts[0].passkey, 'unknown'); assert.equal(own.accounts[0].manualReviewedAt, null)
      assert.ok(own.accounts[0].connection)
      assert.equal((await readSecurityOverview('foreign')).accounts.length, 0)
      assert.equal((await readSecurityOverview('foreign')).connections.length, 0)
      await assert.rejects(createSecurityAccount('foreign', { ...input, connectedAccountId: connectionId }), (error: SecurityAccountError) => error.status === 404)
      await assert.rejects(createSecurityAccount('owner', { ...input, connectedAccountId: connectionId }), (error: SecurityAccountError) => error.status === 409)
    })
    await t.test('temporary connection lookup failure does not remove an existing link or claim provider verification', async () => {
      await pg.exec('ALTER TABLE connected_accounts RENAME TO offline_connected_accounts')
      try {
        const overview = await readSecurityOverview('owner')
        assert.equal(overview.connectionsUnavailable, true)
        assert.equal(overview.accounts[0].connectedAccountId, connectionId)
        assert.equal(overview.accounts[0].connection, null)
        assert.equal(overview.accounts[0].twoFactor, 'unknown')
      } finally { await pg.exec('ALTER TABLE offline_connected_accounts RENAME TO connected_accounts') }
    })
    await t.test('foreign changes and stale versions cannot update, review or remove another record', async () => {
      for (const operation of [() => updateSecurityAccount('foreign', id, 1, input), () => reviewSecurityAccount('foreign', id, 1), () => deleteSecurityAccount('foreign', id, 1)]) await assert.rejects(operation(), (error: SecurityAccountError) => error.status === 409)
      await updateSecurityAccount('owner', id, 1, { ...input, connectedAccountId: connectionId, twoFactor: 'enabled', reviewed: true })
      let row = (await readSecurityOverview('owner')).accounts[0]; assert.equal(row.version, 2); assert.ok(row.manualReviewedAt)
      await assert.rejects(updateSecurityAccount('owner', id, 1, input), (error: SecurityAccountError) => error.status === 409)
      await assert.rejects(deleteSecurityAccount('owner', id, 1), (error: SecurityAccountError) => error.status === 409)
      await updateSecurityAccount('owner', id, 2, { ...input, connectedAccountId: connectionId, reviewed: false })
      row = (await readSecurityOverview('owner')).accounts[0]; assert.equal(row.manualReviewedAt, null); assert.equal(row.version, 3)
      await reviewSecurityAccount('owner', id, 3)
      row = (await readSecurityOverview('owner')).accounts[0]; assert.ok(row.manualReviewedAt); assert.equal(row.version, 4)
    })
    await t.test('loss of a connection does not erase the independent manual documentation', async () => {
      await pg.query('DELETE FROM connected_accounts WHERE id=$1', [connectionId])
      const row = (await readSecurityOverview('owner')).accounts[0]
      assert.equal(row.connectedAccountId, null); assert.equal(row.connection, null); assert.equal(row.login, 'me@example.test')
      await deleteSecurityAccount('owner', id, row.version)
      assert.equal((await readSecurityOverview('owner')).accounts.length, 0)
    })
    await t.test('capacity guard refuses extra accounts without removing existing records', async () => {
      const { reviewed: _reviewed, connectedAccountId: _connection, ...details } = input
      await pg.query('INSERT INTO v2_account_security(user_id,details) SELECT $1,$2::jsonb FROM generate_series(1,500)', ['owner', JSON.stringify(details)])
      await assert.rejects(createSecurityAccount('owner', input), (error: SecurityAccountError) => error.status === 409)
      assert.equal((await readSecurityOverview('owner')).accounts.length, 500)
      assert.ok((await createSecurityAccount('foreign', input)).id)
    })
  } finally { await store.close() }
})

test('security routes require authentication, derive user identity from the session and validate input', async () => {
  const calls: string[] = []
  const emptyOverview: SecurityOverview = { setupRequired: false, accounts: [], connections: [], connectionsUnavailable: false, checkedAt: new Date().toISOString() }
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('userId', 'session-owner'); await next() })
  app.route('/', createAccountSecurityRoute({
    initializeSecurityStorage: async () => { calls.push('setup') }, readSecurityOverview: async (user) => { calls.push(user); return emptyOverview },
    createSecurityAccount: async (user) => { calls.push(user); return { id: connectionId } },
    updateSecurityAccount: async (user, id) => { calls.push(user); return { id } }, reviewSecurityAccount: async (user, id) => { calls.push(user); return { id } }, deleteSecurityAccount: async (user, id) => { calls.push(user); return { id } },
  }))
  assert.equal((await app.request('/')).status, 200)
  assert.equal((await app.request('/summary')).status, 200)
  assert.equal((await app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, userId: 'foreign' }) })).status, 400)
  assert.equal((await app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 201)
  assert.equal((await app.request('/not-a-uuid', { method: 'PUT', body: '{}' })).status, 400)
  assert.equal((await app.request(`/${connectionId}/review`, { method: 'POST', body: '{}' })).status, 400)
  assert.ok(calls.every((value) => value === 'session-owner'))
  for (const [path, method] of [['/api/account-security', 'GET'], ['/api/account-security/summary', 'GET'], ['/api/account-security/setup', 'POST'], [`/api/account-security/${connectionId}/review`, 'POST']]) assert.equal((await createApp().request(path, { method })).status, 401)
})
