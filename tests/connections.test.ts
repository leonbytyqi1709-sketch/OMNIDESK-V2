import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { connectionsRoute } from '../server/routes/connections'
import { postgresStorage } from './support/postgres'

const owner = 'owner',
  stranger = 'stranger'

const ids = {
  note: '11111111-1111-4111-8111-111111111111',
  task: '22222222-2222-4222-8222-222222222222',
  project: '33333333-3333-4333-8333-333333333333',
  contact: '44444444-4444-4444-8444-444444444444',
  appointment: '55555555-5555-4555-8555-555555555555',
  foreignNote: '66666666-6666-4666-8666-666666666666',
}

/** Die fünf verknüpfbaren Tabellen, auf das für den Test Nötige reduziert. */
async function seed(pg: Awaited<ReturnType<typeof postgresStorage>>['pg']) {
  await pg.exec(`
    CREATE TABLE notes(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL DEFAULT '',
      content text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tasks(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,
      description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'todo',due_date timestamptz,tags jsonb DEFAULT '[]',
      subtasks jsonb DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE appointments(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,
      description text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',
      priority text NOT NULL DEFAULT 'medium',starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE contacts(id uuid PRIMARY KEY,user_id text NOT NULL,first_name text NOT NULL,
      last_name text NOT NULL DEFAULT '',email text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',
      company text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,
      description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'active',tags jsonb DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
  `)
  await pg.query('INSERT INTO notes(id,user_id,title,content) VALUES($1,$2,$3,$4),($5,$6,$7,$8)', [
    ids.note,
    owner,
    'Angebot Mustermann',
    'Preise prüfen',
    ids.foreignNote,
    stranger,
    'Fremde Notiz',
    '',
  ])
  await pg.query('INSERT INTO tasks(id,user_id,title) VALUES($1,$2,$3)', [
    ids.task,
    owner,
    'Angebot schreiben',
  ])
  await pg.query('INSERT INTO projects(id,user_id,name) VALUES($1,$2,$3)', [
    ids.project,
    owner,
    'Mustermann GmbH',
  ])
  await pg.query('INSERT INTO contacts(id,user_id,first_name,last_name,company) VALUES($1,$2,$3,$4,$5)', [
    ids.contact,
    owner,
    'Erika',
    'Mustermann',
    'Mustermann GmbH',
  ])
  await pg.query(
    "INSERT INTO appointments(id,user_id,title,starts_at,ends_at) VALUES($1,$2,$3,now()+interval '1 day',now()+interval '1 day'+interval '1 hour')",
    [ids.appointment, owner, 'Besprechung'],
  )
}

function api(userId = owner) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/connections', connectionsRoute)
  const call = (path: string, init?: RequestInit) =>
    app.request(`/connections${path}`, init as never)
  return {
    list: (kind: string, id: string) => call(`/${kind}/${id}`),
    search: (term: string) => call(`/search?q=${encodeURIComponent(term)}`),
    connect: (source: unknown, target: unknown) =>
      call('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target }),
      }),
    disconnect: (connectionId: string) => call(`/${connectionId}`, { method: 'DELETE' }),
  }
}

test('Verknüpfungen zwischen Modulen', async (t) => {
  const storage = await postgresStorage()
  try {
    await seed(storage.pg)

    await t.test('verbindet zwei Objekte und zeigt sie von beiden Seiten', async () => {
      const created = await api().connect(
        { kind: 'note', id: ids.note },
        { kind: 'project', id: ids.project },
      )
      assert.equal(created.status, 201)
      const { connectionId } = (await created.json()) as { connectionId: string }

      const fromNote = (await (await api().list('note', ids.note)).json()) as Array<{
        kind: string
        id: string
        title: string
        connectionId: string
      }>
      assert.deepEqual(
        fromNote.map((item) => [item.kind, item.title]),
        [['project', 'Mustermann GmbH']],
      )
      assert.equal(fromNote[0].connectionId, connectionId)

      const fromProject = (await (await api().list('project', ids.project)).json()) as Array<{
        kind: string
        title: string
      }>
      assert.deepEqual(
        fromProject.map((item) => [item.kind, item.title]),
        [['note', 'Angebot Mustermann']],
      )
    })

    await t.test('legt dieselbe Verbindung auch in umgekehrter Richtung nicht doppelt an', async () => {
      const again = await api().connect(
        { kind: 'project', id: ids.project },
        { kind: 'note', id: ids.note },
      )
      assert.equal(again.status, 200)
      const rows = await storage.pg.query('SELECT id FROM v2_connections')
      assert.equal(rows.rows.length, 1, 'Es darf nur eine Zeile geben')
    })

    await t.test('weist fremde Objekte und Selbstverknüpfungen ab', async () => {
      const foreign = await api().connect(
        { kind: 'note', id: ids.foreignNote },
        { kind: 'task', id: ids.task },
      )
      assert.equal(foreign.status, 404)

      const asStranger = await api(stranger).connect(
        { kind: 'note', id: ids.note },
        { kind: 'task', id: ids.task },
      )
      assert.equal(asStranger.status, 404)

      const itself = await api().connect(
        { kind: 'task', id: ids.task },
        { kind: 'task', id: ids.task },
      )
      assert.equal(itself.status, 400)

      const broken = await api().connect({ kind: 'task', id: 'keine-uuid' }, { kind: 'note', id: ids.note })
      assert.equal(broken.status, 400)

      const rows = await storage.pg.query('SELECT id FROM v2_connections')
      assert.equal(rows.rows.length, 1, 'Keine der Abweisungen darf etwas anlegen')
    })

    await t.test('fremde Liste bleibt verborgen', async () => {
      assert.equal((await api(stranger).list('note', ids.note)).status, 404)
      assert.equal((await api().list('note', ids.foreignNote)).status, 404)
      assert.equal((await api().list('note', 'keine-uuid')).status, 400)
      assert.equal((await api().list('passwort', ids.note)).status, 400)
    })

    await t.test('verträgt alle fünf Arten', async () => {
      for (const kind of ['task', 'contact', 'appointment'] as const) {
        const response = await api().connect(
          { kind: 'project', id: ids.project },
          { kind, id: ids[kind] },
        )
        assert.equal(response.status, 201, `${kind} ließ sich nicht verknüpfen`)
      }
      const list = (await (await api().list('project', ids.project)).json()) as Array<{
        kind: string
      }>
      assert.deepEqual(new Set(list.map((item) => item.kind)), new Set(['note', 'task', 'contact', 'appointment']))
    })

    await t.test('gelöschtes Gegenstück verschwindet und hinterlässt keine Zeile', async () => {
      await storage.pg.query('DELETE FROM contacts WHERE id=$1', [ids.contact])
      const list = (await (await api().list('project', ids.project)).json()) as Array<{
        kind: string
      }>
      assert.ok(!list.some((item) => item.kind === 'contact'))
      const rows = await storage.pg.query('SELECT b_kind FROM v2_connections')
      assert.ok(
        !rows.rows.some((row) => (row as { b_kind: string }).b_kind === 'contact'),
        'Die verwaiste Zeile wurde nicht aufgeräumt',
      )
    })

    await t.test('löst eine Verknüpfung und schützt fremde', async () => {
      const list = (await (await api().list('project', ids.project)).json()) as Array<{
        connectionId: string
        kind: string
      }>
      const target = list.find((item) => item.kind === 'task')!
      assert.equal((await api(stranger).disconnect(target.connectionId)).status, 404)
      assert.equal((await api().disconnect(target.connectionId)).status, 200)
      assert.equal((await api().disconnect(target.connectionId)).status, 404)

      const after = (await (await api().list('project', ids.project)).json()) as Array<{
        kind: string
      }>
      assert.ok(!after.some((item) => item.kind === 'task'))
    })

    await t.test('die Suche findet über Module hinweg, aber nur Eigenes', async () => {
      const hits = (await (await api().search('mustermann')).json()) as Array<{
        kind: string
        title: string
      }>
      assert.deepEqual(
        new Set(hits.map((hit) => hit.kind)),
        new Set(['note', 'project']),
        'Erwartet werden Notiz und Projekt mit „Mustermann“',
      )

      const nothing = (await (await api(stranger).search('mustermann')).json()) as unknown[]
      assert.equal(nothing.length, 0)

      const empty = (await (await api().search('')).json()) as unknown[]
      assert.ok(empty.length > 0, 'Ohne Suchbegriff soll eine Auswahl erscheinen')

      // Platzhalter dürfen nicht als Muster wirken.
      const wildcard = (await (await api().search('%')).json()) as unknown[]
      assert.equal(wildcard.length, 0)
    })
  } finally {
    await storage.close()
  }
})
