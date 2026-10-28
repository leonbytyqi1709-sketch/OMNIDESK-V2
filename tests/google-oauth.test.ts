import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { Hono } from 'hono'
import { createApp } from '../server/app'
import {
  GOOGLE_COOKIE,
  openGoogleValue,
  readGoogleTransaction,
  sealGoogleValue,
  startGoogleAuthorization,
} from '../server/google-auth'
import { googleCallbackRoute } from '../server/routes/google-callback'
import { integrationsRoute } from '../server/routes/integrations'

/**
 * Früher stand die Benutzerkennung unsigniert als Base64 im State und der
 * Callback vertraute ihr. Die Anmeldung ist jetzt wie bei Microsoft an ein
 * verschlüsseltes HttpOnly-Cookie dieses Browsers gebunden.
 */
test('Google authorization', async (t) => {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const
  const previous = names.map((name) => process.env[name])
  process.env.GOOGLE_CLIENT_ID = 'test-client'
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret-not-a-real-credential'
  process.env.GOOGLE_REDIRECT_URI = 'https://v2.test/api/integrations/google/callback'
  const originalFetch = globalThis.fetch

  try {
    await t.test('state carries no user, uses PKCE and clamps the return target', () => {
      const result = startGoogleAuthorization('owner-123', '//attacker.test')
      const url = new URL(result.url)
      assert.equal(url.origin, 'https://accounts.google.com')
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
      assert.ok(!result.url.includes('owner-123') && !result.cookie.includes('owner-123'))
      const transaction = readGoogleTransaction(result.cookie, url.searchParams.get('state')!)
      assert.equal(transaction.userId, 'owner-123')
      assert.equal(transaction.returnTo, '/settings')
      assert.equal(
        url.searchParams.get('code_challenge'),
        createHash('sha256').update(transaction.verifier).digest('base64url'),
      )
    })

    await t.test('rejects another browser, tampering, a wrong state and an expired start', () => {
      const { cookie, url } = startGoogleAuthorization('owner', '/cloud-monitor')
      const state = new URL(url).searchParams.get('state')!
      assert.equal(readGoogleTransaction(cookie, state).returnTo, '/cloud-monitor')
      assert.throws(() => readGoogleTransaction(undefined, state))
      assert.throws(() => readGoogleTransaction(cookie, undefined))
      assert.throws(() => readGoogleTransaction(cookie, 'wrong-state'))
      assert.throws(() => readGoogleTransaction('gg1.invalid', state))
      const transaction = readGoogleTransaction(cookie, state)
      const expired = sealGoogleValue(
        JSON.stringify({ ...transaction, createdAt: Date.now() - 601_000 }),
        'transaction',
      )
      assert.throws(() => readGoogleTransaction(expired, state))
      const buffer = Buffer.from(cookie.slice(4), 'base64url')
      buffer[buffer.length - 1] ^= 1
      assert.throws(() => openGoogleValue(`gg1.${buffer.toString('base64url')}`, 'transaction'))
    })

    await t.test('authorization endpoint sets a protected cookie and refuses another origin', async () => {
      const app = new Hono()
      app.use('*', async (c, next) => {
        c.set('userId', 'owner')
        await next()
      })
      app.route('/api/integrations', integrationsRoute)

      const response = await app.request(
        'https://v2.test/api/integrations/google/auth-url?returnTo=/cloud-monitor',
      )
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const cookie = response.headers.get('set-cookie')!
      for (const flag of [
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Max-Age=600',
        'Path=/api/integrations/google',
      ])
        assert.ok(cookie.includes(flag), `Fehlendes Cookie-Merkmal: ${flag}`)

      const foreign = await app.request('https://other.test/api/integrations/google/auth-url')
      assert.equal(foreign.status, 400)
      assert.equal(foreign.headers.get('set-cookie'), null)

      // Lokal laufen Oberfläche und API auf verschiedenen Ports; das darf die
      // Verbindung nicht verhindern, Cookies gelten je Host.
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:8787/api/integrations/google/callback'
      const local = await app.request('http://localhost:5173/api/integrations/google/auth-url')
      assert.equal(local.status, 200)
      assert.ok(!local.headers.get('set-cookie')!.includes('Secure'))
      process.env.GOOGLE_REDIRECT_URI = 'https://v2.test/api/integrations/google/callback'
      assert.equal(
        (await createApp().request('https://v2.test/api/integrations/google/auth-url')).status,
        401,
      )
    })

    await t.test('callback without the matching cookie never talks to Google', async () => {
      globalThis.fetch = (() => {
        throw new Error('Der Callback darf ohne gebundene Anmeldung keine Anfrage stellen.')
      }) as typeof globalThis.fetch

      const app = new Hono()
      app.route('/api/integrations/google', googleCallbackRoute)
      const foreignState = Buffer.from(JSON.stringify({ userId: 'fremd' })).toString('base64url')

      for (const request of [
        `https://v2.test/api/integrations/google/callback?code=abc&state=${foreignState}`,
        'https://v2.test/api/integrations/google/callback?code=abc',
      ]) {
        const response = await app.request(request)
        assert.equal(response.status, 302)
        const location = new URL(response.headers.get('location')!)
        assert.equal(location.pathname, '/settings')
        assert.match(location.searchParams.get('error')!, /Google/)
        assert.equal(response.headers.get('cache-control'), 'no-store')
      }
    })

    await t.test('an aborted login returns to the bound target without provider details', async () => {
      const { cookie, url } = startGoogleAuthorization('owner', '/cloud-monitor')
      const state = new URL(url).searchParams.get('state')!
      const app = new Hono()
      app.route('/api/integrations/google', googleCallbackRoute)

      const response = await app.request(
        `https://v2.test/api/integrations/google/callback?error=access_denied&state=${state}`,
        { headers: { Cookie: `${GOOGLE_COOKIE}=${cookie}` } },
      )
      assert.equal(response.status, 302)
      const location = new URL(response.headers.get('location')!)
      assert.equal(location.pathname, '/cloud-monitor')
      assert.ok(!location.search.includes('access_denied'))
      assert.match(response.headers.get('set-cookie')!, /Max-Age=0/)
    })
  } finally {
    globalThis.fetch = originalFetch
    names.forEach((name, index) => {
      const value = previous[index]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    })
  }
})
