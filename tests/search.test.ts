import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import type { SearchHit } from '../src/lib/search'
import { searchRoute } from '../server/routes/search'
import { postgresStorage } from './support/postgres'

const owner = 'owner',
  stranger = 'stranger'

/**
 * Bis zum 29.10.2026 durchsuchte die Befehlspalette nur die bereits geladene
 * Notizliste im Browser. Aufgaben, Projekte, Kontakte, Termine, Links und
 * Befehle waren darin unsichtbar.
 */
async function seed(pg: Awaited<ReturnType<typeof postgresStorage>>['pg']) {
  await pg.exec(`
    CREATE TABLE notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL DEFAULT '',content text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'todo',due_date timestamptz,tags jsonb DEFAULT '[]',
      subtasks jsonb DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,description text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',
      priority text NOT NULL DEFAULT 'medium',starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      first_name text NOT NULL,last_name text NOT NULL DEFAULT '',email text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',company text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      name text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'active',tags jsonb DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE project_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title text NOT NULL,
      description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'backlog',
      priority text NOT NULL DEFAULT 'medium',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,url text NOT NULL,category text,icon text,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE commands(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,command text NOT NULL,category text NOT NULL DEFAULT 'Allgemein',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
  `)

  await pg.query(
    `INSERT INTO notes(user_id,title,content) VALUES
      ($1,'Backup-Strategie','Wöchentliches Backup der Datenbank prüfen'),
      ($1,'Einkaufsliste','Nichts mit dem Suchwort'),
      ($2,'Fremdes Backup','geheim')`,
    [owner, stranger],
  )
  await pg.query(
    `INSERT INTO tasks(user_id,title,description) VALUES($1,'Server neu starten','Vorher Backup anlegen')`,
    [owner],
  )
  await pg.query(
    `INSERT INTO appointments(user_id,title,location,starts_at,ends_at)
     VALUES($1,'Backup-Besprechung','Büro',now()+interval '2 days',now()+interval '2 days')`,
    [owner],
  )
  await pg.query(
    `INSERT INTO contacts(user_id,first_name,last_name,company) VALUES($1,'Erika','Mustermann','Backup AG')`,
    [owner],
  )
  const [project] = (
    await pg.query<{ id: string }>(
      `INSERT INTO projects(user_id,name,description) VALUES($1,'Rechenzentrum','Umzug inklusive Backup') RETURNING id`,
      [owner],
    )
  ).rows
  await pg.query(
    `INSERT INTO project_tasks(user_id,project_id,title,description) VALUES($1,$2,'Backup-Konzept schreiben','')`,
    [owner, project.id],
  )
  await pg.query(`INSERT INTO links(user_id,title,url,category) VALUES($1,'Backup-Portal','https://backup.example.com','Infrastruktur')`, [owner])
  await pg.query(`INSERT INTO commands(user_id,title,command,category) VALUES($1,'Backup starten','restic backup /daten','Linux')`, [owner])
  return project.id
}

function api(userId = owner) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/search', searchRoute)
  return async (term: string) => {
    const response = await app.request(`/search?q=${encodeURIComponent(term)}`)
    assert.equal(response.status, 200)
    return (await response.json()) as SearchHit[]
  }
}

test('Suche über alle Module', async (t) => {
  const storage = await postgresStorage()
  try {
    const projectId = await seed(storage.pg)
    const search = api()

    await t.test('findet denselben Begriff in allen acht Arten', async () => {
      const hits = await search('backup')
      assert.deepEqual(
        new Set(hits.map((hit) => hit.kind)),
        new Set([
          'note',
          'task',
          'appointment',
          'contact',
          'project',
          'projectTask',
          'link',
          'command',
        ]),
      )
    })

    await t.test('Titeltreffer stehen vor Inhaltstreffern', async () => {
      const hits = (await search('backup')).filter((hit) => hit.kind === 'note' || hit.kind === 'task')
      assert.equal(hits[0].title, 'Backup-Strategie', 'Der Titeltreffer gehört nach oben')
      assert.ok(
        hits.some((hit) => hit.title === 'Server neu starten'),
        'Der Treffer im Beschreibungstext fehlt',
      )
    })

    await t.test('jeder Treffer führt an die richtige Stelle', async () => {
      const hits = await search('backup')
      const path = (kind: string) => hits.find((hit) => hit.kind === kind)!.path
      assert.match(path('note'), /^\/notes\?note=[0-9a-f-]{36}$/)
      assert.match(path('task'), /^\/tasks\?task=[0-9a-f-]{36}$/)
      assert.match(path('appointment'), /^\/calendar\?appointment=[0-9a-f-]{36}$/)
      assert.match(path('contact'), /^\/contacts\?contact=[0-9a-f-]{36}$/)
      assert.equal(path('project'), `/projects?project=${projectId}`)
      // Eine Projektaufgabe hat keine eigene Seite; sie führt ins Projekt.
      assert.equal(path('projectTask'), `/projects?project=${projectId}`)
      assert.equal(path('link'), '/links')
      assert.equal(path('command'), '/commands')
    })

    await t.test('zeigt den Fundort im Text', async () => {
      const note = (await search('datenbank')).find((hit) => hit.kind === 'note')!
      assert.equal(note.title, 'Backup-Strategie')
      assert.match(note.snippet, /Datenbank/i)
    })

    await t.test('jeder sieht ausschließlich das Eigene', async () => {
      // Der Fremde besitzt selbst eine Notiz mit diesem Wort – und nur die.
      const foreign = await api(stranger)('backup')
      assert.deepEqual(
        foreign.map((hit) => hit.title),
        ['Fremdes Backup'],
      )
      const mine = await search('backup')
      assert.ok(
        !mine.some((hit) => hit.title.includes('Fremdes')),
        'Die fremde Notiz darf hier nicht auftauchen',
      )
      assert.ok(mine.length >= 8)
    })

    await t.test('kurze Begriffe und Platzhalter liefern nichts', async () => {
      assert.deepEqual(await search('b'), [])
      assert.deepEqual(await search(''), [])
      assert.deepEqual(await search('%%'), [])
      assert.deepEqual(await search('__'), [])
    })
  } finally {
    await storage.close()
  }
})
