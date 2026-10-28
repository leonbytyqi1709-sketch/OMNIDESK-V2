import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../server/app'
import { startGoogleAuthorization } from '../server/google-auth'

test('Google authorization retains Drive and identity scopes without requesting Gmail access', () => {
  const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const
  const previous = names.map((name) => process.env[name])
  process.env.GOOGLE_CLIENT_ID = 'test-client'
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret-not-a-real-credential'
  process.env.GOOGLE_REDIRECT_URI = 'https://v2.test/api/integrations/google/callback'
  try {
    const url = new URL(startGoogleAuthorization('test-user').url)
    const scopes = url.searchParams.get('scope')!.split(' ')
    assert.equal(url.origin, 'https://accounts.google.com')
    assert.ok(scopes.includes('https://www.googleapis.com/auth/drive.metadata.readonly'))
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.email'))
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.profile'))
    assert.ok(scopes.every((scope) => !scope.includes('/auth/gmail.')))
  } finally {
    names.forEach((name, index) => {
      const value = previous[index]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    })
  }
})

test('API no longer registers mail handlers and preserves cloud account and Google callback routes', () => {
  const paths = createApp().routes.map((route) => route.path)
  assert.ok(!paths.some((path) => path === '/api/mail' || path.startsWith('/api/mail/')))
  for (const path of [
    '/api/integrations/google/callback',
    '/api/integrations/google/auth-url',
    '/api/integrations/accounts',
    '/api/integrations/accounts/:id/sync',
    '/api/cloud-monitor/overview',
  ]) assert.ok(paths.includes(path), `Missing preserved route: ${path}`)
})

test('public health and authentication protection still work without database credentials', async () => {
  const app = createApp()
  const response = await app.request('/api/health')
  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  for (const path of ['/api/integrations/accounts', '/api/cloud-monitor/overview', '/api/notes']) {
    const denied = await app.request(path)
    assert.equal(denied.status, 401, `${path} must remain protected`)
  }
})
