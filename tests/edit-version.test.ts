import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import { retireWorkingHistory } from '../server/retire-working-history'
import { notesRoute } from '../server/routes/notes'
import { tasksRoute } from '../server/routes/tasks'
import { projectsRoute } from '../server/routes/projects'
import { createApp } from '../server/app'

async function fixture() {
  const storage = await postgresStorage()
  await storage.pg
    .exec(`CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',priority text DEFAULT 'medium',status text DEFAULT 'active',tags jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'todo',due_date timestamptz,tags jsonb DEFAULT '[]',subtasks jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE project_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title text NOT NULL,priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'backlog',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`)
  return storage
}
function appFor(userId: string) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/notes', notesRoute)
  app.route('/tasks', tasksRoute)
  app.route('/projects', projectsRoute)
  return app
}
const request = (app: Hono, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }),
  })

test('retirement disables installed history triggers without removing old records, originals or unrelated triggers', async () => {
  const { pg, close } = await fixture()
  try {
    await pg.exec(`CREATE TABLE v2_working_history(message text);INSERT INTO v2_working_history VALUES('Bestehender Altstand');
      CREATE TABLE audit_events(message text);
      CREATE FUNCTION legacy_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO v2_working_history VALUES('Neue Aufzeichnung');RETURN NEW;END $$;
      CREATE FUNCTION keep_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO audit_events VALUES('Unabhängige Prüfung');RETURN NEW;END $$;
      CREATE TRIGGER v2_history_notes AFTER INSERT OR UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION legacy_capture();
      CREATE TRIGGER v2_history_tasks AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION legacy_capture();
      CREATE TRIGGER v2_history_project_tasks AFTER INSERT OR UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION legacy_capture();
      CREATE TRIGGER unrelated_audit AFTER INSERT ON notes FOR EACH ROW EXECUTE FUNCTION keep_audit();`)
    const response = await request(appFor('owner'), '/notes', 'POST')
    assert.equal(response.status, 201)
    await retireWorkingHistory()
    const triggers = await pg.query<{ tgname: string }>(
      'SELECT tgname FROM pg_trigger WHERE NOT tgisinternal',
    )
    assert.deepEqual(
      triggers.rows.map((t) => t.tgname),
      ['unrelated_audit'],
    )
    assert.deepEqual(
      (await pg.query('SELECT message FROM v2_working_history')).rows,
      [{ message: 'Bestehender Altstand' }],
    )
    assert.equal((await pg.query('SELECT * FROM audit_events')).rows.length, 1)
    assert.equal((await pg.query('SELECT * FROM notes')).rows.length, 1)
  } finally {
    await close()
  }
})
test('notes retain owner-scoped optimistic editing without creating history storage', async () => {
  const { pg, close } = await fixture()
  try {
    const app = appFor('owner'),
      created = await request(app, '/notes', 'POST'),
      note = await created.json()
    assert.equal(created.status, 201)
    assert.match(note.fingerprint, /^[a-f0-9]{32}$/)
    const update = {
      title: 'Geändert',
      content: 'Mein Text',
      expectedFingerprint: note.fingerprint,
    }
    assert.equal(
      (await request(appFor('other'), '/notes/' + note.id, 'PUT', update))
        .status,
      409,
    )
    assert.equal(
      (await request(app, '/notes/' + note.id, 'PUT', update)).status,
      200,
    )
    assert.equal(
      (await request(app, '/notes/' + note.id, 'PUT', update)).status,
      409,
    )
    const rows = await (await request(app, '/notes')).json()
    assert.equal(rows[0].content, 'Mein Text')
    assert.deepEqual(
      await (await request(appFor('other'), '/notes')).json(),
      [],
    )
    assert.equal(
      (await pg.query("SELECT to_regclass('v2_working_history') AS storage"))
        .rows[0].storage,
      null,
    )
    assert.equal(
      (await request(app, '/notes/' + note.id, 'DELETE')).status,
      200,
    )
  } finally {
    await close()
  }
})
test('personal and project tasks still update with version protection after history removal', async () => {
  const { pg, close } = await fixture()
  try {
    const app = appFor('owner'),
      task = await (
        await request(app, '/tasks', 'POST', {
          title: 'Aufgabe',
          description: 'Details',
          priority: 'high',
          status: 'todo',
          dueDate: null,
          tags: ['wichtig'],
          subtasks: [],
        })
      ).json()
    const update = { status: 'done', expectedFingerprint: task.fingerprint }
    assert.equal(
      (await request(app, '/tasks/' + task.id, 'PUT', update)).status,
      200,
    )
    assert.equal(
      (await request(app, '/tasks/' + task.id, 'PUT', update)).status,
      409,
    )
    const tasks = await (await request(app, '/tasks')).json()
    assert.equal(tasks[0].status, 'done')
    assert.equal(tasks[0].description, 'Details')
    const project = randomUUID()
    await pg.query(
      "INSERT INTO projects(id,user_id,name) VALUES($1,'owner','Projekt')",
      [project],
    )
    const board = await (
      await request(app, '/projects/' + project + '/tasks', 'POST', {
        title: 'Board',
        status: 'backlog',
        priority: 'medium',
      })
    ).json()
    const move = {
      status: 'in_progress',
      expectedFingerprint: board.fingerprint,
    }
    assert.equal(
      (await request(app, '/projects/tasks/' + board.id, 'PUT', move)).status,
      200,
    )
    assert.equal(
      (await request(app, '/projects/tasks/' + board.id, 'PUT', move)).status,
      409,
    )
    assert.equal(
      (
        await request(
          appFor('other'),
          '/projects/tasks/' + board.id,
          'PUT',
          move,
        )
      ).status,
      409,
    )
    for (const path of ['/api/notes', '/api/tasks', '/api/projects'])
      assert.equal((await createApp().request(path)).status, 401)
  } finally {
    await close()
  }
})
