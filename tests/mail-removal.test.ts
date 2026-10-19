import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../server/app'
import { getGoogleOAuthUrl } from '../server/google-auth'

test('Google authorization retains Drive and identity scopes without requesting Gmail access', () => {
  const previous = process.env.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_ID = 'test-client'
  try {
    const url = new URL(getGoogleOAuthUrl('test-user'))
    const scopes = url.searchParams.get('scope')!.split(' ')
    assert.equal(url.origin, 'https://accounts.google.com')
    assert.ok(scopes.includes('https://www.googleapis.com/auth/drive.metadata.readonly'))
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.email'))
    assert.ok(scopes.includes('https://www.googleapis.com/auth/userinfo.profile'))
    assert.ok(scopes.every((scope) => !scope.includes('/auth/gmail.')))
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = previous
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
