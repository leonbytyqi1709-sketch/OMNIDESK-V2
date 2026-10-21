import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { browserSourceUrl } from '../src/lib/browser-url'
import {
  browserItemInput,
  browserUpdateInput,
  BrowserDeskError,
} from '../server/browser-policy'
import * as store from '../server/browser-storage'
import {
  createBrowserDataRoute,
  createBrowserExtensionRoute,
} from '../server/routes/browser-desk'
import { createApp } from '../server/app'
import { postgresStorage } from './support/postgres'
const project = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda',
  foreignProject = 'dbcdaed6-b5b4-424d-97c4-e8d7c1c07f2f',
  itemId = '6a3592cb-31c5-47f7-a206-a79a0a10891e'
const input = () => ({
  id: itemId,
  title: 'Eine bewusst gespeicherte Quelle',
  url: 'https://example.com/article?a=1',
  selection: 'Ein ausgewählter Absatz.',
  annotation: 'Diesen Hinweis im Projekt prüfen.',
  projectId: project,
})
async function core() {
  const storage = await postgresStorage()
  await storage.pg.exec(
    'CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL)',
  )
  await storage.pg.query('INSERT INTO projects VALUES($1,$2,$3),($4,$5,$6)', [
    project,
    'owner',
    'Owned',
    foreignProject,
    'other',
    'Foreign',
  ])
  return storage
}

test('browser URL canonicalization removes fragments and access/tracking parameters without fetching the page', () => {
  assert.equal(
    browserSourceUrl(
      'https://EXAMPLE.com:443/article?b=2&utm_source=x&token=private&code=private&a=1#selection',
    ),
    'https://example.com/article?a=1&b=2',
  )
  assert.equal(
    browserSourceUrl('http://localhost:8080/path?document=4'),
    'http://localhost:8080/path?document=4',
  )
  for (const value of [
    'javascript:alert(1)',
    'chrome://settings',
    'file:///etc/passwd',
    'https://user:password@example.com',
    'data:text/html,test',
  ])
    assert.throws(() => browserSourceUrl(value))
  assert.equal(
    browserItemInput.safeParse({ ...input(), userId: 'other' }).success,
    false,
  )
  assert.equal(
    browserItemInput.safeParse({ ...input(), selection: '', annotation: ' ' })
      .success,
    false,
  )
  assert.equal(
    browserItemInput.safeParse({ ...input(), selection: 'x'.repeat(10001) })
      .success,
    false,
  )
  assert.equal(
    browserUpdateInput.safeParse({ ...input(), version: 1 }).success,
    false,
  )
})
test('browser storage is additive, owner-scoped, project-checked, idempotent and version protected', async () => {
  const { pg, close } = await core()
  try {
    assert.deepEqual(await store.listBrowserItems('owner'), {
      items: [],
      limited: false,
    })
    await store.initializeBrowserStorage()
    await store.initializeBrowserStorage()
    assert.deepEqual(
      (await store.browserProjects('owner')).map((p) => p.name),
      ['Owned'],
    )
    const item = await store.saveBrowserItem('owner', input())
    assert.equal(item.version, 1)
    assert.equal((await store.saveBrowserItem('owner', input())).id, item.id)
    assert.equal(
      (await pg.query('SELECT * FROM v2_browser_items')).rows.length,
      1,
    )
    for (const [user, data] of [
      ['other', input()],
      ['owner', { ...input(), annotation: 'Conflicting retry' }],
      ['owner', { ...input(), id: foreignProject, projectId: foreignProject }],
    ] as const)
      await assert.rejects(
        store.saveBrowserItem(user, data),
        (e) => e instanceof BrowserDeskError && e.status === 409,
      )
    assert.equal((await store.listBrowserItems('other')).items.length, 0)
    assert.equal(
      (await store.listBrowserItems('owner', { url: input().url })).items[0]
        .projectName,
      'Owned',
    )
    assert.equal(
      (
        await store.listBrowserItems('owner', {
          url: 'https://example.com/other',
        })
      ).items.length,
      0,
    )
    const update = {
      title: 'Aktualisiert',
      selection: 'Auswahl',
      annotation: 'Neue Anmerkung',
      projectId: null,
      version: 1,
    }
    await assert.rejects(store.updateBrowserItem('other', itemId, update))
    const edited = await store.updateBrowserItem('owner', itemId, update)
    assert.equal(edited.version, 2)
    await assert.rejects(store.updateBrowserItem('owner', itemId, update))
    await assert.rejects(store.deleteBrowserItem('other', itemId, 2))
    await assert.rejects(store.deleteBrowserItem('owner', itemId, 1))
    await store.deleteBrowserItem('owner', itemId, 2)
    assert.equal((await store.listBrowserItems('owner')).items.length, 0)
    await store.saveBrowserItem('owner', input())
    await pg.query('UPDATE projects SET user_id=$1 WHERE id=$2', [
      'other',
      project,
    ])
    assert.equal(
      (await store.listBrowserItems('owner')).items[0].projectId,
      null,
    )
    assert.equal(
      (await store.listBrowserItems('owner', { projectId: project })).items
        .length,
      0,
    )
    await pg.query('DELETE FROM projects WHERE id=$1', [project])
    assert.equal((await store.listBrowserItems('owner')).items.length, 1)
  } finally {
    await close()
  }
})
test('pairing uses hashed single-use proof-bound expiring codes and revocable scoped device credentials', async () => {
  const { pg, close } = await core()
  try {
    const verifier = randomBytes(32).toString('base64url'),
      challenge = store.browserHash(verifier)
    const { code } = await store.createBrowserPairing('owner', challenge)
    const pair = (
      await pg.query<{ code_hash: string; challenge: string }>(
        'SELECT * FROM v2_browser_pairings',
      )
    ).rows[0]
    assert.notEqual(pair.code_hash, code)
    assert.equal(pair.challenge, challenge)
    await assert.rejects(
      store.exchangeBrowserPairing(code, randomBytes(32).toString('base64url')),
    )
    const auth = await store.exchangeBrowserPairing(code, verifier)
    assert.equal(
      (await store.authenticateBrowserDevice(auth.token))?.userId,
      'owner',
    )
    assert.equal(
      (await store.authenticateBrowserDevice(auth.token))?.id,
      auth.deviceId,
    )
    assert.equal(
      await store.authenticateBrowserDevice('not-a-device-token'),
      null,
    )
    await assert.rejects(store.exchangeBrowserPairing(code, verifier))
    const persisted = (
      await pg.query<{ token_hash: string }>('SELECT * FROM v2_browser_devices')
    ).rows[0]
    assert.notEqual(persisted.token_hash, auth.token)
    assert.ok(
      !JSON.stringify(await store.listBrowserDevices('owner')).includes(
        auth.token,
      ),
    )
    await store.revokeBrowserDevice('other', auth.deviceId)
    assert.ok(await store.authenticateBrowserDevice(auth.token))
    await store.revokeBrowserDevice('owner', auth.deviceId)
    assert.equal(await store.authenticateBrowserDevice(auth.token), null)
    const second = await store.createBrowserPairing('owner', challenge)
    await pg.exec(
      "UPDATE v2_browser_pairings SET expires_at=now()-interval '1 minute'",
    )
    await assert.rejects(store.exchangeBrowserPairing(second.code, verifier))
    const third = await store.createBrowserPairing('owner', challenge)
    const next = await store.exchangeBrowserPairing(third.code, verifier)
    await pg.exec(
      "UPDATE v2_browser_devices SET expires_at=now()-interval '1 second'",
    )
    assert.equal(await store.authenticateBrowserDevice(next.token), null)
    assert.equal((await store.listBrowserDevices('owner')).length, 0)
    for (let i = 0; i < 17; i++)
      await store.createBrowserPairing('owner', challenge)
    await assert.rejects(
      store.createBrowserPairing('owner', challenge),
      (e) => e instanceof BrowserDeskError && e.status === 429,
    )
  } finally {
    await close()
  }
})
test('device API derives ownership from device credentials, cannot grant Clerk access, and rejects revoked devices', async () => {
  const { close } = await core()
  try {
    const verifier = randomBytes(32).toString('base64url'),
      pair = await store.createBrowserPairing(
        'owner',
        store.browserHash(verifier),
      )
    const app = new Hono()
    app.route('/extension', createBrowserExtensionRoute())
    const exchange = await app.request('/extension/pair/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pair.code, verifier }),
    })
    assert.equal(exchange.status, 200)
    assert.equal(exchange.headers.get('Cache-Control'), 'no-store')
    const { token, deviceId } = await exchange.json()
    const headers = {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    }
    const projects = await app.request(
      '/extension/data/projects?userId=other',
      { headers },
    )
    assert.equal(projects.status, 200)
    assert.deepEqual(
      (await projects.json()).map((p: { name: string }) => p.name),
      ['Owned'],
    )
    assert.equal(
      (
        await app.request('/extension/data/items', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...input(), userId: 'other' }),
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await app.request('/extension/data/items', {
          method: 'POST',
          headers,
          body: JSON.stringify(input()),
        })
      ).status,
      201,
    )
    assert.equal(
      (
        await app.request('/extension/data/items?projectId=' + foreignProject, {
          headers,
        })
      ).status,
      404,
    )
    assert.equal(
      (
        await app.request('/extension/data/projects', {
          headers: { Authorization: token },
        })
      ).status,
      401,
    )
    const real = createApp()
    assert.equal((await real.request('/api/notes', { headers })).status, 401)
    assert.equal(
      (
        await real.request('/api/browser/pair', {
          method: 'POST',
          headers,
          body: JSON.stringify({ challenge: store.browserHash(verifier) }),
        })
      ).status,
      401,
    )
    assert.equal(
      (
        await app.request('/extension/data/disconnect', {
          method: 'POST',
          headers,
        })
      ).status,
      200,
    )
    assert.equal(
      (await app.request('/extension/data/projects', { headers })).status,
      401,
    )
    assert.equal(
      (await store.listBrowserDevices('owner')).some((d) => d.id === deviceId),
      false,
    )
  } finally {
    await close()
  }
})
test('web API validates source filters, UUIDs and optimistic versions; initialization is not required for public health', async () => {
  const { close } = await core()
  try {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('userId', 'owner')
      await next()
    })
    app.route('/browser', createBrowserDataRoute())
    for (const path of [
      '/items?projectId=invalid',
      '/items?url=javascript:alert(1)',
    ])
      assert.equal((await app.request('/browser' + path)).status, 400)
    assert.equal(
      (await app.request('/browser/items?projectId=' + foreignProject)).status,
      404,
    )
    assert.equal(
      (await app.request('/browser/items/not-uuid', { method: 'DELETE' }))
        .status,
      400,
    )
    const health = await createApp().request('/api/health')
    assert.equal(health.status, 200)
    for (const path of [
      '/api/browser/items',
      '/api/browser/devices',
      '/api/browser-extension/data/items',
    ])
      assert.equal((await createApp().request(path)).status, 401)
  } finally {
    await close()
  }
})
test('extension manifest grants only deliberate tab access and exact OMNIDESK host; package builder is an explicit allowlist', () => {
  const manifest = JSON.parse(
    readFileSync('browser-extension/manifest.json', 'utf8'),
  )
  assert.deepEqual(manifest.permissions, [
    'activeTab',
    'scripting',
    'storage',
    'sidePanel',
  ])
  assert.deepEqual(manifest.host_permissions, [
    'https://omnidesk-v2-beta.vercel.app/*',
  ])
  assert.deepEqual(
    manifest.externally_connectable.matches,
    manifest.host_permissions,
  )
  assert.equal(manifest.content_scripts, undefined)
  const background = readFileSync('browser-extension/background.js', 'utf8')
  assert.ok(
    !background.includes('webNavigation') &&
      !background.includes('tabs.onUpdated'),
  )
  assert.ok(/accessLevel:\s*'TRUSTED_CONTEXTS'/.test(background))
  assert.ok(/origin\s*!==\s*APP/.test(background))
  const builder = readFileSync('scripts/build-browser-extension.mjs', 'utf8')
  assert.ok(!builder.includes('readdirSync'))
})

test('large UTF-8 annotation lists remain within the response budget without truncating individual entries', () => {
  const row = {
    ...input(),
    projectName: 'Owned',
    version: 1,
    createdAt: '2026-10-21T08:00:00Z',
    updatedAt: '2026-10-21T08:00:00Z',
    selection: '文'.repeat(10000),
    annotation: '文'.repeat(20000),
  }
  const rows = Array.from({ length: 101 }, (_, i) => ({
    ...row,
    id: String(i),
  }))
  const bounded = store.boundBrowserItems(rows)
  assert.equal(bounded.limited, true)
  assert.ok(bounded.items.length > 0 && bounded.items.length < 100)
  assert.ok(Buffer.byteLength(JSON.stringify(bounded), 'utf8') < 2_100_000)
  assert.equal(bounded.items[0].annotation.length, 20000)
})
