import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { browserPanelInput, BrowserDeskError } from '../server/browser-policy'
import * as store from '../server/browser-storage'
import {
  createBrowserExtensionRoute,
  createBrowserWebRoute,
} from '../server/routes/browser-desk'
import { MAX_BROWSER_PANEL_ENTRIES } from '../src/lib/browser-panel'
import { postgresStorage } from './support/postgres'

const linkId = '0a3d3fa2-6b53-4b2f-9a63-1a1a0b6f5c11',
  foreignLinkId = 'b0f5c4a1-2d8e-4e7a-9c33-77c3c0d41f20',
  entryId = 'c3b6a0d2-5f41-4a9e-8c17-2f0b9d6e4a55'

const entry = (over: Record<string, unknown> = {}) => ({
  id: entryId,
  kind: 'module' as const,
  target: '/tasks',
  ...over,
})

const config = (over: Record<string, unknown> = {}) => ({
  entries: [entry()],
  showCommands: true,
  commandCategory: null,
  version: 1,
  ...over,
})

async function core() {
  const storage = await postgresStorage()
  await storage.pg.exec(
    'CREATE TABLE links(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,url text NOT NULL)',
  )
  await storage.pg.exec(
    'CREATE TABLE commands(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,command text NOT NULL,category text NOT NULL)',
  )
  await storage.pg.exec(
    'CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL)',
  )
  await storage.pg.query(
    'INSERT INTO links VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
    [
      linkId,
      'owner',
      'Proxmox',
      'https://proxmox.example.com/',
      foreignLinkId,
      'other',
      'Fremd',
      'https://fremd.example.com/',
    ],
  )
  await storage.pg.query(
    'INSERT INTO commands VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),($11,$12,$13,$14,$15)',
    [
      '11111111-1111-4111-8111-111111111111',
      'owner',
      'Ports anzeigen',
      'ss -tulpen',
      'Linux',
      '22222222-2222-4222-8222-222222222222',
      'owner',
      'Dienste auflisten',
      'Get-Service',
      'PowerShell',
      '33333333-3333-4333-8333-333333333333',
      'other',
      'Fremder Befehl',
      'whoami',
      'Linux',
    ],
  )
  return storage
}

test('panel configuration only accepts known modules, own link ids and a bounded list', () => {
  assert.equal(browserPanelInput.safeParse(config()).success, true)
  assert.equal(
    browserPanelInput.safeParse(
      config({ entries: [entry({ kind: 'link', target: linkId })] }),
    ).success,
    true,
  )
  // Freie Adressen und unbekannte Module dürfen nicht in das Panel gelangen.
  for (const target of [
    '/vault',
    'https://example.com',
    '/passwords',
    '../tasks',
  ])
    assert.equal(
      browserPanelInput.safeParse(config({ entries: [entry({ target })] }))
        .success,
      false,
      target,
    )
  assert.equal(
    browserPanelInput.safeParse(
      config({ entries: [entry({ kind: 'link', target: '/tasks' })] }),
    ).success,
    false,
  )
  assert.equal(
    browserPanelInput.safeParse(config({ entries: [entry(), entry()] }))
      .success,
    false,
  )
  assert.equal(
    browserPanelInput.safeParse(
      config({
        entries: Array.from({ length: MAX_BROWSER_PANEL_ENTRIES + 1 }, () =>
          entry({ id: randomUUID() }),
        ),
      }),
    ).success,
    false,
  )
  assert.equal(
    browserPanelInput.safeParse({ ...config(), unknown: true }).success,
    false,
  )
  assert.equal(
    browserPanelInput.safeParse(config({ version: 0 })).success,
    false,
  )
})

test('panel storage is additive, owner-scoped, version protected and never invents targets', async () => {
  const { pg, close } = await core()
  try {
    // Ohne eingerichtete Tabellen gelten die Voreinstellungen statt eines Fehlers.
    assert.deepEqual(await store.readBrowserPanel('owner'), {
      entries: [],
      showCommands: true,
      commandCategory: null,
      version: 1,
    })
    await store.initializeBrowserStorage()
    await store.initializeBrowserStorage()

    const saved = await store.saveBrowserPanel('owner', {
      entries: [
        entry(),
        { id: entryId.replace('c3', 'd4'), kind: 'link', target: linkId },
        {
          id: entryId.replace('c3', 'e5'),
          kind: 'link',
          target: foreignLinkId,
        },
      ],
      showCommands: true,
      commandCategory: null,
      version: 1,
    })
    assert.equal(saved.entries.length, 3)
    assert.equal(saved.version, 2)

    // Ein veralteter Versionsstand darf eine neuere Einstellung nicht überschreiben.
    await assert.rejects(
      store.saveBrowserPanel('owner', config({ entries: [] })),
      (e) => e instanceof BrowserDeskError && e.status === 409,
    )

    const view = await store.browserPanelView(
      'owner',
      'https://omnidesk-v2-beta.vercel.app',
    )
    assert.deepEqual(
      view.quickAccess.map((item) => [item.label, item.url, item.available]),
      [
        ['Aufgaben', 'https://omnidesk-v2-beta.vercel.app/tasks', true],
        ['Proxmox', 'https://proxmox.example.com/', true],
        // Fremder Link: sichtbar, aber ausdrücklich nicht auflösbar.
        ['Entfernter Link', null, false],
      ],
    )
    assert.deepEqual(
      view.commands.map((command) => command.title),
      ['Ports anzeigen', 'Dienste auflisten'],
    )
    assert.deepEqual(view.commandCategories, ['Linux', 'PowerShell'])
    assert.equal(view.commandsLimited, false)

    // Andere Benutzer sehen weder Konfiguration noch Befehle.
    const foreign = await store.browserPanelView(
      'other',
      'https://omnidesk-v2-beta.vercel.app',
    )
    assert.deepEqual(foreign.entries, [])
    assert.deepEqual(foreign.quickAccess, [])
    assert.deepEqual(
      foreign.commands.map((command) => command.title),
      ['Fremder Befehl'],
    )

    // Kategoriefilter und abgeschaltete Befehlsanzeige wirken.
    const filtered = await store.saveBrowserPanel('owner', {
      entries: saved.entries,
      showCommands: true,
      commandCategory: 'PowerShell',
      version: saved.version,
    })
    assert.deepEqual(
      (
        await store.browserPanelView('owner', 'https://omnidesk-v2-beta.vercel.app')
      ).commands.map((command) => command.title),
      ['Dienste auflisten'],
    )
    await store.saveBrowserPanel('owner', {
      entries: filtered.entries,
      showCommands: false,
      commandCategory: null,
      version: filtered.version,
    })
    assert.deepEqual(
      (
        await store.browserPanelView('owner', 'https://omnidesk-v2-beta.vercel.app')
      ).commands,
      [],
    )

    // Ein gelöschter Link verschwindet nicht still, sondern wird gekennzeichnet.
    await pg.query('DELETE FROM links WHERE id=$1', [linkId])
    const afterDelete = await store.browserPanelView(
      'owner',
      'https://omnidesk-v2-beta.vercel.app',
    )
    assert.equal(afterDelete.quickAccess[1].available, false)
    assert.equal(afterDelete.quickAccess[1].label, 'Entfernter Link')
  } finally {
    await close()
  }
})

test('extension credentials may read the panel but never change it', async () => {
  const { close } = await core()
  try {
    const verifier = randomBytes(32).toString('base64url')
    const pair = await store.createBrowserPairing(
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
    const { token } = (await exchange.json()) as { token: string }
    const headers = {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    }

    const read = await app.request('/extension/data/panel', { headers })
    assert.equal(read.status, 200)
    const view = (await read.json()) as { quickAccess: unknown[] }
    assert.deepEqual(view.quickAccess, [])

    // Die Erweiterung hat keinen Schreibweg auf die Konfiguration.
    const write = await app.request('/extension/data/panel', {
      method: 'PUT',
      headers,
      body: JSON.stringify(config()),
    })
    assert.equal(write.status, 404)

    // Ohne gültigen Gerätezugang gibt es auch keinen Lesezugriff.
    assert.equal(
      (
        await app.request('/extension/data/panel', {
          headers: { Authorization: 'Bearer omni_ext_' + 'a'.repeat(43) },
        })
      ).status,
      401,
    )

    // Die angemeldete App darf speichern; der Benutzer kommt dort aus Clerk.
    const web = new Hono()
    web.use('*', async (c, next) => {
      c.set('userId', 'owner')
      await next()
    })
    web.route('/browser', createBrowserWebRoute())
    const saved = await web.request('/browser/panel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config()),
    })
    assert.equal(saved.status, 200)
    assert.equal(saved.headers.get('Cache-Control'), 'no-store')
    const afterWrite = await app.request('/extension/data/panel', { headers })
    assert.deepEqual(
      ((await afterWrite.json()) as { quickAccess: { label: string }[] })
        .quickAccess.map((item) => item.label),
      ['Aufgaben'],
    )
  } finally {
    await close()
  }
})
