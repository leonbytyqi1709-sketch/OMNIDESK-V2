import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes, randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import {
  browserCaptureInput,
  browserPanelInput,
  BrowserDeskError,
} from '../server/browser-policy'
import * as store from '../server/browser-storage'
import {
  createBrowserExtensionRoute,
  createBrowserWebRoute,
} from '../server/routes/browser-desk'
import { MAX_BROWSER_PANEL_ENTRIES } from '../src/lib/browser-panel'
import { postgresStorage } from './support/postgres'

const project = '7860bb51-2bf3-427b-bdec-0ed7b3ef3cda',
  foreignProject = 'dbcdaed6-b5b4-424d-97c4-e8d7c1c07f2f',
  linkId = '0a3d3fa2-6b53-4b2f-9a63-1a1a0b6f5c11',
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

test('extension credentials may read the panel, capture into modules, but never change the configuration', async () => {
  const { pg, close } = await core()
  try {
    await pg.exec(
      "CREATE TABLE notes(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())",
    )
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

    // Erfassen darf die Erweiterung: Das ist der Zweck des Gerätezugangs.
    const captured = await app.request('/extension/data/capture', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: '88888888-8888-4888-8888-888888888888',
        kind: 'note',
        title: 'Aus dem Browser',
        text: 'Kurz festgehalten.',
        source: null,
        projectId: null,
      }),
    })
    assert.equal(captured.status, 201)
    assert.equal(
      (
        await pg.query<{ user_id: string }>(
          'SELECT user_id FROM notes WHERE id=$1',
          ['88888888-8888-4888-8888-888888888888'],
        )
      ).rows[0].user_id,
      'owner',
    )

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

test('capture creates entries in the real modules, stays owner-scoped and never duplicates', async () => {
  const { pg, close } = await core()
  try {
    await pg.exec(
      "CREATE TABLE notes(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())",
    )
    await pg.exec(
      "CREATE TABLE tasks(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'todo',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())",
    )
    await pg.exec(
      "CREATE TABLE project_tasks(id uuid PRIMARY KEY,user_id text NOT NULL,project_id uuid NOT NULL,title text NOT NULL,status text NOT NULL DEFAULT 'backlog',priority text NOT NULL DEFAULT 'medium',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())",
    )
    await pg.query('INSERT INTO projects VALUES($1,$2,$3),($4,$5,$6)', [
      project,
      'owner',
      'Eigenes Projekt',
      foreignProject,
      'other',
      'Fremdes Projekt',
    ])

    const noteId = '44444444-4444-4444-8444-444444444444'
    const note = await store.captureBrowserEntry('owner', {
      id: noteId,
      kind: 'note',
      title: 'Kurzer Gedanke',
      text: 'Das hier merken.',
      source: { url: 'https://example.com/artikel', title: 'Der Artikel' },
      projectId: null,
    })
    assert.equal(note.alreadyCaptured, false)
    assert.equal(note.href, '/notes?note=' + noteId)
    const stored = (
      await pg.query<{ title: string; content: string }>(
        'SELECT title,content FROM notes WHERE id=$1',
        [noteId],
      )
    ).rows[0]
    assert.equal(stored.title, 'Kurzer Gedanke')
    // Die Quelle hängt unter dem Text, der Text selbst bleibt unverändert.
    assert.ok(stored.content.startsWith('Das hier merken.'))
    assert.ok(stored.content.includes('https://example.com/artikel'))
    assert.ok(stored.content.includes('Der Artikel'))

    // Ein zweiter Versuch mit derselben Kennung legt nichts doppelt an.
    const again = await store.captureBrowserEntry('owner', {
      id: noteId,
      kind: 'note',
      title: 'Kurzer Gedanke',
      text: 'Das hier merken.',
      source: null,
      projectId: null,
    })
    assert.equal(again.alreadyCaptured, true)
    assert.equal((await pg.query('SELECT id FROM notes')).rows.length, 1)

    // Dieselbe Kennung aus einem fremden Konto darf nichts erfahren oder ändern.
    await assert.rejects(
      store.captureBrowserEntry('other', {
        id: noteId,
        kind: 'note',
        title: 'Fremder Zugriff',
        text: '',
        source: null,
        projectId: null,
      }),
      (e) => e instanceof BrowserDeskError && e.status === 409,
    )

    const taskId = '55555555-5555-4555-8555-555555555555'
    const task = await store.captureBrowserEntry('owner', {
      id: taskId,
      kind: 'task',
      title: 'Nachlesen',
      text: 'Später prüfen.',
      source: { url: 'https://example.com/doc', title: '' },
      projectId: null,
    })
    assert.equal(task.href, '/tasks')
    const storedTask = (
      await pg.query<{ description: string; status: string }>(
        'SELECT description,status FROM tasks WHERE id=$1',
        [taskId],
      )
    ).rows[0]
    assert.equal(storedTask.status, 'todo')
    assert.ok(storedTask.description.includes('https://example.com/doc'))

    const projectTaskId = '66666666-6666-4666-8666-666666666666'
    const projectTask = await store.captureBrowserEntry('owner', {
      id: projectTaskId,
      kind: 'projectTask',
      title: 'Im Projekt klären',
      text: '',
      source: null,
      projectId: project,
    })
    assert.equal(projectTask.href, '/projects?project=' + project)
    assert.equal(
      (await pg.query('SELECT id FROM project_tasks')).rows.length,
      1,
    )

    // Ein fremdes Projekt darf keine Aufgabe erhalten.
    await assert.rejects(
      store.captureBrowserEntry('owner', {
        id: '77777777-7777-4777-8777-777777777777',
        kind: 'projectTask',
        title: 'Fremdes Projekt',
        text: '',
        source: null,
        projectId: foreignProject,
      }),
      (e) => e instanceof BrowserDeskError && e.status === 409,
    )
    assert.equal(
      (await pg.query('SELECT id FROM project_tasks')).rows.length,
      1,
    )
  } finally {
    await close()
  }
})

test('capture input rejects wrong targets, missing titles and unsupported sources', () => {
  const base = {
    id: '44444444-4444-4444-8444-444444444444',
    kind: 'note' as const,
    title: 'Titel',
    text: 'Text',
    source: null,
    projectId: null,
  }
  assert.equal(browserCaptureInput.safeParse(base).success, true)
  assert.equal(
    browserCaptureInput.safeParse({ ...base, title: '   ' }).success,
    false,
  )
  // Projekt nur bei Projektaufgaben, und dort verpflichtend.
  assert.equal(
    browserCaptureInput.safeParse({ ...base, projectId: project }).success,
    false,
  )
  assert.equal(
    browserCaptureInput.safeParse({ ...base, kind: 'projectTask' }).success,
    false,
  )
  assert.equal(
    browserCaptureInput.safeParse({
      ...base,
      kind: 'projectTask',
      projectId: project,
    }).success,
    true,
  )
  for (const url of ['javascript:alert(1)', 'chrome://settings', 'nonsense'])
    assert.equal(
      browserCaptureInput.safeParse({
        ...base,
        source: { url, title: 'x' },
      }).success,
      false,
      url,
    )
  assert.equal(
    browserCaptureInput.safeParse({ ...base, kind: 'milestone' }).success,
    false,
  )
})
