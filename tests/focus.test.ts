import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import type { FocusSummary } from '../src/lib/focus'
import { focusRoute } from '../server/routes/focus'
import { postgresStorage } from './support/postgres'

const owner = 'owner',
  stranger = 'stranger'

const session = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  seconds: 1500,
  target: null,
  ...overrides,
})

async function seed(pg: Awaited<ReturnType<typeof postgresStorage>>['pg']) {
  await pg.exec(`
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'todo',due_date timestamptz,tags jsonb DEFAULT '[]',
      subtasks jsonb DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      name text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',
      status text NOT NULL DEFAULT 'active',tags jsonb DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE project_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title text NOT NULL,
      description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'backlog',
      priority text NOT NULL DEFAULT 'medium',created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
  `)
  const [task] = (
    await pg.query<{ id: string }>(
      `INSERT INTO tasks(user_id,title) VALUES($1,'Angebot schreiben') RETURNING id`,
      [owner],
    )
  ).rows
  const [foreignTask] = (
    await pg.query<{ id: string }>(
      `INSERT INTO tasks(user_id,title) VALUES($1,'Fremde Aufgabe') RETURNING id`,
      [stranger],
    )
  ).rows
  const [project] = (
    await pg.query<{ id: string }>(
      `INSERT INTO projects(user_id,name) VALUES($1,'Rechenzentrum') RETURNING id`,
      [owner],
    )
  ).rows
  return { task: task.id, foreignTask: foreignTask.id, project: project.id }
}

function api(userId = owner) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/focus', focusRoute)
  return {
    record: (body: unknown) =>
      app.request('/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    summary: async (days = 7) => {
      const response = await app.request(`/focus/summary?days=${days}`)
      assert.equal(response.status, 200)
      return (await response.json()) as FocusSummary
    },
    forTarget: (kind: string, id: string) => app.request(`/focus/for/${kind}/${id}`),
    remove: (id: string) => app.request(`/focus/${id}`, { method: 'DELETE' }),
  }
}

test('Fokuszeiten', async (t) => {
  const storage = await postgresStorage()
  try {
    const ids = await seed(storage.pg)

    await t.test('hält einen Block fest und rechnet ihn dem Ziel zu', async () => {
      const created = await api().record(
        session({ seconds: 1500, target: { kind: 'task', id: ids.task } }),
      )
      assert.equal(created.status, 201)

      const summary = await api().summary()
      assert.equal(summary.seconds, 1500)
      assert.equal(summary.sessions, 1)
      assert.deepEqual(
        summary.totals.map((total) => [total.title, total.seconds]),
        [['Angebot schreiben', 1500]],
      )
      assert.equal(summary.days.length, 1)
    })

    await t.test('derselbe Block zweimal gesendet zählt einmal', async () => {
      const entry = session({ seconds: 600, target: { kind: 'project', id: ids.project } })
      assert.equal((await api().record(entry)).status, 201)
      assert.equal((await api().record(entry)).status, 200)
      const summary = await api().summary()
      assert.equal(summary.seconds, 2100)
      assert.equal(summary.sessions, 2)
    })

    await t.test('fremde Ziele und Unfug werden abgewiesen', async () => {
      assert.equal(
        (await api().record(session({ target: { kind: 'task', id: ids.foreignTask } }))).status,
        404,
      )
      assert.equal(
        (await api(stranger).record(session({ target: { kind: 'task', id: ids.task } }))).status,
        404,
      )
      // Zu kurz, zu lang, unbekannte Art, keine Kennung, Zukunft
      assert.equal((await api().record(session({ seconds: 30 }))).status, 400)
      assert.equal((await api().record(session({ seconds: 99_999 }))).status, 400)
      assert.equal((await api().record(session({ target: { kind: 'notiz', id: ids.task } }))).status, 400)
      assert.equal((await api().record(session({ id: 'keine-uuid' }))).status, 400)
      assert.equal(
        (await api().record(session({ startedAt: new Date(Date.now() + 3_600_000).toISOString() })))
          .status,
        400,
      )

      const summary = await api().summary()
      assert.equal(summary.sessions, 2, 'Keine der Abweisungen darf etwas anlegen')
    })

    await t.test('jeder sieht nur die eigene Zeit', async () => {
      const foreign = await api(stranger).summary()
      assert.equal(foreign.seconds, 0)
      assert.deepEqual(foreign.totals, [])
    })

    await t.test('Zeit an einem einzelnen Ziel', async () => {
      const response = await api().forTarget('task', ids.task)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { seconds: 1500, sessions: 1 })

      const foreign = await api(stranger).forTarget('task', ids.task)
      assert.deepEqual(await foreign.json(), { seconds: 0, sessions: 0 })

      assert.equal((await api().forTarget('task', 'keine-uuid')).status, 400)
    })

    await t.test('ein gelöschtes Ziel verliert nicht die gearbeitete Zeit', async () => {
      await storage.pg.query('DELETE FROM tasks WHERE id=$1', [ids.task])
      const summary = await api().summary()
      assert.equal(summary.seconds, 2100, 'Die Zeit bleibt erhalten')
      assert.ok(
        summary.totals.some((total) => total.title === 'Gelöschtes Ziel'),
        'Das verwaiste Ziel wird als solches ausgewiesen',
      )
    })

    await t.test('ein Eintrag lässt sich löschen, aber nicht von fremder Hand', async () => {
      const entry = session({ seconds: 300 })
      await api().record(entry)
      assert.equal((await api(stranger).remove(entry.id)).status, 404)
      assert.equal((await api().remove(entry.id)).status, 200)
      assert.equal((await api().remove(entry.id)).status, 404)
      assert.equal((await api().summary()).seconds, 2100)
    })

    await t.test('ältere Blöcke fallen aus dem Zeitraum', async () => {
      await storage.pg.query(
        `INSERT INTO v2_focus_sessions(id,user_id,started_at,seconds)
         VALUES(gen_random_uuid(),$1,now()-interval '40 days',900)`,
        [owner],
      )
      assert.equal((await api().summary(7)).seconds, 2100)
      assert.equal((await api().summary(365)).seconds, 3000)
    })
  } finally {
    await storage.close()
  }
})
