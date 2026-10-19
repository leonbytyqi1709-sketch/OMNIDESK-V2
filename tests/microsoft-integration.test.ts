import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { Hono } from 'hono'
import type { ConnectedAccount, NewConnectedAccount } from '../src/db/schema/integrations'
import { createApp } from '../server/app'
import { syncMicrosoftAccount } from '../server/microsoft-account'
import { MICROSOFT_COOKIE, exchangeMicrosoftCode, getMicrosoftStorage, microsoftConfig,
  openMicrosoftValue, readMicrosoftTransaction, refreshMicrosoftTokens,
  sealMicrosoftValue, startMicrosoftAuthorization } from '../server/microsoft-auth'
import { publicAccount } from '../server/public-account'
import { integrationsRoute } from '../server/routes/integrations'
import { createMicrosoftCallbackRoute } from '../server/routes/microsoft-callback'

test('Microsoft integration', async (t) => {
  const names = ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_REDIRECT_URI', 'MICROSOFT_TENANT']
  const previous = names.map((name) => process.env[name])
  process.env.MICROSOFT_CLIENT_ID = 'test-client'
  process.env.MICROSOFT_CLIENT_SECRET = 'test-only-secret-not-a-real-credential'
  process.env.MICROSOFT_REDIRECT_URI = 'https://v2.test/api/integrations/microsoft/callback'
  delete process.env.MICROSOFT_TENANT
  const originalFetch = globalThis.fetch
  try {
    await t.test('private and organization accounts use common with read-only scopes and PKCE', () => {
      const result = startMicrosoftAuthorization('owner-123', '//attacker.test')
      const url = new URL(result.url)
      assert.equal(url.pathname, '/common/oauth2/v2.0/authorize')
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
      const transaction = readMicrosoftTransaction(result.cookie, url.searchParams.get('state')!)
      assert.equal(transaction.userId, 'owner-123')
      assert.equal(transaction.returnTo, '/settings')
      assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(transaction.verifier).digest('base64url'))
      const scopes = url.searchParams.get('scope')!
      assert.match(scopes, /offline_access/)
      assert.match(scopes, /Files.Read/)
      assert.ok(!scopes.includes('Write') && !scopes.includes('Mail.'))
      assert.ok(!result.url.includes('owner-123') && !result.cookie.includes('owner-123'))
    })
    await t.test('rejects a different browser, tampering, wrong state and expired transactions', () => {
      const { cookie, url } = startMicrosoftAuthorization('owner', '/cloud-monitor')
      const state = new URL(url).searchParams.get('state')!
      assert.throws(() => readMicrosoftTransaction(undefined, state))
      assert.throws(() => readMicrosoftTransaction(cookie, 'wrong-state'))
      assert.throws(() => readMicrosoftTransaction('ms1.invalid', state))
      const transaction = readMicrosoftTransaction(cookie, state)
      const expired = sealMicrosoftValue(JSON.stringify({ ...transaction, createdAt: Date.now() - 601_000 }), 'transaction')
      assert.throws(() => readMicrosoftTransaction(expired, state))
      assert.throws(() => openMicrosoftValue(cookie, 'token'))
    })
    await t.test('encrypted stored tokens cannot be read after tampering', () => {
      const encrypted = sealMicrosoftValue('test-access-token', 'token')
      assert.ok(!encrypted.includes('test-access-token'))
      assert.equal(openMicrosoftValue(encrypted, 'token'), 'test-access-token')
      const buffer = Buffer.from(encrypted.slice(4), 'base64url')
      buffer[buffer.length - 1] ^= 1
      assert.throws(() => openMicrosoftValue(`ms1.${buffer.toString('base64url')}`, 'token'))
    })
    await t.test('authorization endpoint sets a protected cookie and refuses another origin', async () => {
      const app = new Hono()
      app.use('*', async (c, next) => { c.set('userId', 'owner'); await next() })
      app.route('/api/integrations', integrationsRoute)
      const response = await app.request('https://v2.test/api/integrations/microsoft/auth-url?returnTo=/cloud-monitor')
      assert.equal(response.status, 200)
      const cookie = response.headers.get('set-cookie')!
      for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=600', 'Path=/api/integrations/microsoft']) assert.ok(cookie.includes(flag))
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const foreign = await app.request('https://other.test/api/integrations/microsoft/auth-url')
      assert.equal(foreign.status, 400)
      assert.equal(foreign.headers.get('set-cookie'), null)
      assert.equal((await createApp().request('https://v2.test/api/integrations/microsoft/auth-url')).status, 401)
    })
    await t.test('successful callback stores credentials encrypted for the original owner and clears cookie', async () => {
      const authorization = startMicrosoftAuthorization('original-owner', '/cloud-monitor')
      const state = new URL(authorization.url).searchParams.get('state')!
      const transaction = readMicrosoftTransaction(authorization.cookie, state)
      globalThis.fetch = async (input, init) => {
        const url = String(input)
        if (url.endsWith('/token')) {
          const body = new URLSearchParams(String(init?.body))
          assert.equal(body.get('code_verifier'), transaction.verifier)
          return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 })
        }
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer access')
        return url.includes('/me/drive')
          ? Response.json({ id: 'drive', driveType: 'personal', quota: { used: 10, total: 100 } })
          : Response.json({ id: 'ms-user', displayName: 'Test', mail: 'user@example.test' })
      }
      let saved: NewConnectedAccount | undefined
      const route = createMicrosoftCallbackRoute(async (connection) => { saved = connection })
      const response = await route.request(`https://v2.test/callback?code=code&state=${state}`, { headers: { Cookie: `${MICROSOFT_COOKIE}=${authorization.cookie}` } })
      assert.equal(response.status, 302)
      assert.equal(response.headers.get('location'), 'https://v2.test/cloud-monitor?connected=microsoft')
      assert.match(response.headers.get('set-cookie')!, /Max-Age=0/)
      assert.equal(saved!.userId, 'original-owner')
      assert.equal(saved!.provider, 'microsoft')
      assert.equal(saved!.storageUsedBytes, '10')
      assert.equal(openMicrosoftValue(saved!.accessToken!, 'token'), 'access')
      assert.equal(openMicrosoftValue(saved!.refreshToken!, 'token'), 'refresh')
      assert.equal(saved!.metadata?.quotaScope, 'microsoft-unified')
    })
    await t.test('invalid callback never calls Microsoft or writes data', async () => {
      globalThis.fetch = async () => { throw new Error('must not fetch') }
      let writes = 0
      const route = createMicrosoftCallbackRoute(async () => { writes++ })
      const response = await route.request('https://v2.test/callback?code=stolen&state=wrong')
      assert.equal(response.status, 302)
      assert.equal(writes, 0)
      assert.ok(!response.headers.get('location')!.includes('stolen'))
    })
    await t.test('quota failure does not save fake values or leak provider response bodies', async () => {
      globalThis.fetch = async () => Response.json({ error: 'sensitive-provider-message' }, { status: 403 })
      await assert.rejects(getMicrosoftStorage('access'), (error: Error) => error.message.includes('403') && !error.message.includes('sensitive'))
      globalThis.fetch = async () => Response.json({ id: 'drive', driveType: 'business', quota: {} })
      await assert.rejects(getMicrosoftStorage('access'), /keine vollständige/)
      globalThis.fetch = async () => Response.json({ id: 'drive', driveType: 'business', quota: { used: 4, total: 100 } })
      assert.equal((await getMicrosoftStorage('access')).metadata.quotaScope, 'drive')
    })
    await t.test('refresh token grant stays server-side and returns rotated tokens', async () => {
      globalThis.fetch = async (input, init) => {
        assert.ok(String(input).endsWith('/common/oauth2/v2.0/token'))
        const body = new URLSearchParams(String(init?.body))
        assert.equal(body.get('grant_type'), 'refresh_token')
        assert.equal(body.get('refresh_token'), 'old-refresh')
        assert.equal(body.get('client_secret'), process.env.MICROSOFT_CLIENT_SECRET)
        return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 })
      }
      assert.equal((await refreshMicrosoftTokens('old-refresh')).refresh_token, 'new-refresh')
      globalThis.fetch = async () => Response.json({ error_description: 'secret-provider-body' }, { status: 400 })
      await assert.rejects(exchangeMicrosoftCode('code', 'verifier'), (error: Error) => !error.message.includes('secret-provider-body'))
    })
    await t.test('refresh rotation is saved before a failing quota fetch; stored quota stays untouched', async () => {
      const account: ConnectedAccount = { id: 'account', userId: 'owner', provider: 'microsoft',
        email: 'user@example.test', label: 'OneDrive', avatarUrl: null, scopes: null,
        accessToken: sealMicrosoftValue('expired', 'token'), refreshToken: sealMicrosoftValue('old-refresh', 'token'),
        tokenExpiry: new Date(0), storageUsedBytes: '42', storageTotalBytes: '100', metadata: {},
        createdAt: new Date(), updatedAt: new Date() }
      const writes: Partial<ConnectedAccount>[] = []
      globalThis.fetch = async (input) => String(input).endsWith('/token')
        ? Response.json({ access_token: 'new-access', refresh_token: 'rotated', expires_in: 3600 })
        : new Response(null, { status: 503 })
      await assert.rejects(syncMicrosoftAccount(account, async (fields) => { writes.push(fields); return { ...account, ...fields } }))
      assert.equal(writes.length, 1)
      assert.equal(openMicrosoftValue(writes[0].refreshToken!, 'token'), 'rotated')
      assert.equal(writes[0].storageUsedBytes, undefined)
      const serialized = JSON.stringify(publicAccount(account))
      for (const key of ['accessToken', 'refreshToken', 'tokenExpiry']) assert.ok(!serialized.includes(`"${key}"`))
    })
    await t.test('missing configuration fails clearly and HTTP remote callbacks are rejected', () => {
      const secret = process.env.MICROSOFT_CLIENT_SECRET
      delete process.env.MICROSOFT_CLIENT_SECRET
      assert.throws(microsoftConfig, /noch nicht eingerichtet/)
      process.env.MICROSOFT_CLIENT_SECRET = secret
      process.env.MICROSOFT_REDIRECT_URI = 'http://external.test/api/integrations/microsoft/callback'
      assert.throws(microsoftConfig, /HTTPS/)
    })
  } finally {
    globalThis.fetch = originalFetch
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i] })
  }
})
