import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import * as store from '../server/history-storage'
import { createHistoryRoute } from '../server/routes/working-history'
import { notesRoute } from '../server/routes/notes'
import { tasksRoute } from '../server/routes/tasks'
import { projectsRoute } from '../server/routes/projects'
import { createApp } from '../server/app'
import {
  initializeOmniActions,
  saveOmniPlan,
  executeOmniPlan,
} from '../server/omni-actions-storage'
import { prepareOmniOperations } from '../server/omni-actions-prepare'
async function fixture() {
  const result = await postgresStorage()
  await result.pg
    .exec(`CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',priority text DEFAULT 'medium',status text DEFAULT 'active',tags jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'todo',due_date timestamptz,tags jsonb DEFAULT '[]',subtasks jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE project_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,title text NOT NULL,priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'backlog',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE milestones(id uuid PRIMARY KEY,project_id uuid,user_id text,title text,due_date timestamptz,done boolean,created_at timestamptz);`)
  return result
}
function appFor(user: string) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', user)
    await next()
  })
  app.route('/history', createHistoryRoute())
  app.route('/notes', notesRoute)
  app.route('/tasks', tasksRoute)
  app.route('/projects', projectsRoute)
  return app
}
function send(app: Hono, path: string, method = 'GET', body?: unknown) {
  return app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }),
  })
}
test('history captures baseline only from rollout, skips timestamp-only saves and rolls back with the original write', async () => {
  const { pg, close } = await fixture()
  try {
    const id = randomUUID()
    await pg.query(
      "INSERT INTO notes(id,user_id,title,content) VALUES($1,'owner','Vorher','Text')",
      [id],
    )
    await store.initializeWorkingHistory()
    await store.initializeWorkingHistory()
    assert.equal(
      (await store.historyDetail('owner', 'note', id)).versions.length,
      0,
    )
    await pg.query(
      "UPDATE notes SET title='Danach',updated_at=clock_timestamp() WHERE id=$1",
      [id],
    )
    let detail = await store.historyDetail('owner', 'note', id)
    assert.equal(detail.versions.length, 2)
    assert.equal(detail.versions[1].operation, 'baseline')
    assert.equal(
      (await store.compareHistory('owner', 'note', id, detail.versions[1].id))
        .snapshot.title,
      'Vorher',
    )
    await pg.query(
      'UPDATE notes SET updated_at=clock_timestamp() WHERE id=$1',
      [id],
    )
    assert.equal(
      (await store.historyDetail('owner', 'note', id)).versions.length,
      2,
    )
    await pg.exec('BEGIN')
    await pg.query("UPDATE notes SET title='Rollback' WHERE id=$1", [id])
    await pg.exec('ROLLBACK')
    detail = await store.historyDetail('owner', 'note', id)
    assert.equal(detail.current.snapshot.title, 'Danach')
    assert.equal(detail.versions.length, 2)
    const timeline = await store.historyTimeline('owner', null, 'vorher')
    assert.equal(timeline.entries.length, 1)
    assert.equal(timeline.entries[0].title, 'Vorher')
    assert.ok(!JSON.stringify(detail).includes('user_id'))
  } finally {
    await close()
  }
})
test('real note routes and selective restore reject stale fingerprints and preserve unselected current fields', async () => {
  const { close } = await fixture()
  try {
    const app = appFor('owner')
    const created = await send(app, '/notes', 'POST')
    assert.equal(created.status, 201)
    const original = await created.json()
    assert.match(original.fingerprint, /^[a-f0-9]{32}$/)
    const change = await send(app, '/notes/' + original.id, 'PUT', {
      title: 'Neu',
      content: 'Neuer Inhalt',
      expectedFingerprint: original.fingerprint,
    })
    assert.equal(change.status, 200)
    const current = await change.json()
    assert.notEqual(current.fingerprint, original.fingerprint)
    assert.equal(
      (
        await send(app, '/notes/' + original.id, 'PUT', {
          title: 'Veraltet',
          content: 'Alt',
          expectedFingerprint: original.fingerprint,
        })
      ).status,
      409,
    )
    const detail = await store.historyDetail('owner', 'note', original.id),
      old = detail.versions.at(-1)!
    await assert.rejects(
      store.restoreHistory(
        'other',
        'note',
        original.id,
        old.id,
        current.fingerprint,
        ['title'],
      ),
    )
    await assert.rejects(
      store.restoreHistory(
        'owner',
        'note',
        original.id,
        old.id,
        current.fingerprint,
        ['status'],
      ),
    )
    await store.restoreHistory(
      'owner',
      'note',
      original.id,
      old.id,
      current.fingerprint,
      ['title'],
    )
    const after = await store.historyDetail('owner', 'note', original.id)
    assert.equal(after.current.snapshot.title, 'Unbenannte Notiz')
    assert.equal(after.current.snapshot.content, 'Neuer Inhalt')
    assert.equal(after.versions[0].operation, 'restored')
    assert.equal(after.versions[0].source, 'restore')
    await assert.rejects(
      store.restoreHistory(
        'owner',
        'note',
        original.id,
        old.id,
        current.fingerprint,
        ['title'],
      ),
    )
    assert.equal(
      (
        await send(app, '/notes/' + original.id, 'PUT', {
          title: 'Staler Editor',
          content: 'Veraltet',
          expectedFingerprint: current.fingerprint,
        })
      ).status,
      409,
    )
    const other = await send(appFor('other'), '/notes/' + original.id, 'PUT', {
      title: 'Fremd',
      content: '',
      expectedFingerprint: after.current.fingerprint,
    })
    assert.equal(other.status, 409)
    assert.equal(
      (
        await send(app, '/notes/' + original.id, 'PUT', {
          title: 'Ohne Version',
          content: '',
        })
      ).status,
      400,
    )
  } finally {
    await close()
  }
})
test('personal and project tasks retain full state, protect ownership and do not expose history after project transfer/deletion', async () => {
  const { pg, close } = await fixture()
  try {
    const app = appFor('owner'),
      taskBody = {
        title: 'Aufgabe',
        description: 'Privat',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-12-01T12:00:00Z',
        tags: ['wichtig'],
        subtasks: [{ id: 'one', title: 'Prüfen', done: false }],
      }
    const made = await send(app, '/tasks', 'POST', taskBody)
    assert.equal(made.status, 201)
    const task = await made.json()
    const change = await send(app, '/tasks/' + task.id, 'PUT', {
      status: 'done',
      expectedFingerprint: task.fingerprint,
    })
    assert.equal(change.status, 200)
    const detail = await store.historyDetail('owner', 'task', task.id),
      old = detail.versions.at(-1)!
    await store.restoreHistory(
      'owner',
      'task',
      task.id,
      old.id,
      detail.current.fingerprint,
      ['status'],
    )
    const state = (await store.historyDetail('owner', 'task', task.id)).current
      .snapshot
    assert.equal(state.status, 'todo')
    assert.equal(state.description, 'Privat')
    assert.deepEqual(state.tags, ['wichtig'])
    assert.equal((state.subtasks as { done: boolean }[])[0].done, false)
    const project = randomUUID()
    await pg.query(
      "INSERT INTO projects(id,user_id,name) VALUES($1,'owner','Projekt')",
      [project],
    )
    const board = await send(app, '/projects/' + project + '/tasks', 'POST', {
      title: 'Board',
      status: 'backlog',
      priority: 'medium',
    })
    assert.equal(board.status, 201)
    const boardTask = await board.json()
    const boardUpdate = await send(
      app,
      '/projects/tasks/' + boardTask.id,
      'PUT',
      { status: 'in_progress', expectedFingerprint: boardTask.fingerprint },
    )
    assert.equal(boardUpdate.status, 200)
    const history = await store.historyDetail(
      'owner',
      'project_task',
      boardTask.id,
    )
    assert.equal(history.versions.length, 2)
    await pg.query("UPDATE projects SET user_id='other' WHERE id=$1", [project])
    await assert.rejects(
      store.historyDetail('owner', 'project_task', boardTask.id),
    )
    await assert.rejects(
      store.compareHistory(
        'owner',
        'project_task',
        boardTask.id,
        history.versions[0].id,
      ),
    )
    assert.equal(
      (await store.historyTimeline('owner', 'project_task', '')).entries.length,
      0,
    )
    assert.equal(
      (
        await send(app, '/projects/tasks/' + boardTask.id, 'PUT', {
          status: 'done',
          expectedFingerprint: history.current.fingerprint,
        })
      ).status,
      409,
    )
    await pg.query('DELETE FROM projects WHERE id=$1', [project])
    assert.equal(
      (
        await pg.query('SELECT id FROM v2_working_history WHERE object_id=$1', [
          boardTask.id,
        ])
      ).rows.length,
      0,
    )
  } finally {
    await close()
  }
})
test('pause, retention, capacity and forgetting are owner-scoped and do not remove originals', async () => {
  const { pg, close } = await fixture()
  try {
    await store.initializeWorkingHistory()
    const id = randomUUID(),
      other = randomUUID()
    await pg.query(
      "INSERT INTO notes(id,user_id,title) VALUES($1,'owner','Start'),($2,'other','Fremd')",
      [id, other],
    )
    await store.saveHistorySettings('owner', {
      enabled: true,
      retentionDays: 7,
      maxVersions: 10,
    })
    for (let i = 0; i < 15; i++)
      await pg.query('UPDATE notes SET title=$1 WHERE id=$2', [
        'Stand ' + i,
        id,
      ])
    let detail = await store.historyDetail('owner', 'note', id)
    assert.equal(detail.versions.length, 10)
    const previous = detail.versions[0].id
    await store.saveHistorySettings('owner', {
      enabled: false,
      retentionDays: 7,
      maxVersions: 10,
    })
    await pg.query("UPDATE notes SET title='Pause' WHERE id=$1", [id])
    detail = await store.historyDetail('owner', 'note', id)
    assert.equal(detail.versions.length, 10)
    await assert.rejects(
      store.restoreHistory(
        'owner',
        'note',
        id,
        previous,
        detail.current.fingerprint,
        ['title'],
      ),
    )
    await pg.query(
      "UPDATE v2_working_history SET captured_at=now()-interval '8 days' WHERE user_id='owner'",
    )
    assert.equal(
      (await store.historyDetail('owner', 'note', id)).versions.length,
      0,
    )
    await assert.rejects(store.compareHistory('owner', 'note', id, previous))
    await store.readHistorySettings('owner')
    assert.equal(
      (
        await pg.query(
          "SELECT id FROM v2_working_history WHERE user_id='owner'",
        )
      ).rows.length,
      0,
    )
    await store.saveHistorySettings('owner', {
      enabled: true,
      retentionDays: 7,
      maxVersions: 10,
    })
    assert.equal(
      (
        await pg.query(
          "SELECT id FROM v2_working_history WHERE user_id='owner'",
        )
      ).rows.length,
      0,
    )
    await pg.query("UPDATE notes SET title='Wieder aktiv' WHERE id=$1", [id])
    assert.equal(
      (await store.historyDetail('owner', 'note', id)).versions.length,
      1,
    )
    await store.clearWorkingHistory('owner')
    assert.equal(
      (await store.historyDetail('owner', 'note', id)).versions.length,
      0,
    )
    assert.equal(
      (await store.historyDetail('other', 'note', other)).versions.length,
      1,
    )
    assert.equal((await pg.query('SELECT id FROM notes')).rows.length, 2)
    await pg.query('DELETE FROM notes WHERE id=$1', [other])
    assert.equal(
      (
        await pg.query('SELECT id FROM v2_working_history WHERE object_id=$1', [
          other,
        ])
      ).rows.length,
      0,
    )
  } finally {
    await close()
  }
})
test('actual confirmed Omni operations are captured in the same atomic transaction with source labels', async () => {
  const { close } = await fixture()
  try {
    await initializeOmniActions()
    const prepared = prepareOmniOperations(
      [
        {
          kind: 'create_task',
          title: 'Omni-Aufgabe',
          description: '',
          priority: 'medium',
          status: 'todo',
          dueDate: null,
        },
      ],
      { tasks: [], projects: [], projectTasks: [], truncated: false },
      'Europe/Berlin',
    )
    const plan = await saveOmniPlan(
      'owner',
      randomUUID(),
      'Aufgabe anlegen',
      'Europe/Berlin',
      prepared,
    )
    await executeOmniPlan('owner', plan.id)
    await executeOmniPlan('owner', plan.id)
    const timeline = await store.historyTimeline(
      'owner',
      'task',
      'Omni-Aufgabe',
    )
    assert.equal(timeline.entries.length, 1)
    assert.equal(timeline.entries[0].source, 'omni')
    assert.equal(timeline.entries[0].operation, 'created')
  } finally {
    await close()
  }
})
test('history API enforces authenticated source ownership, bounded filters and explicit destructive confirmation', async () => {
  for (const path of [
    '/api/working-history',
    '/api/working-history/settings',
    '/api/working-history/note/' + randomUUID(),
  ])
    assert.equal((await createApp().request(path)).status, 401)
  const { close } = await fixture()
  try {
    const app = appFor('owner'),
      made = await send(app, '/notes', 'POST'),
      note = await made.json()
    const detail = await store.historyDetail('owner', 'note', note.id),
      version = detail.versions[0].id
    assert.equal(
      (await send(app, '/history')).headers.get('Cache-Control'),
      'no-store',
    )
    assert.equal((await send(app, '/history?kind=unknown')).status, 400)
    assert.equal((await send(app, '/history/note/not-uuid')).status, 400)
    assert.equal(
      (
        await send(
          appFor('other'),
          '/history/note/' + note.id + '/versions/' + version,
        )
      ).status,
      404,
    )
    assert.equal((await send(app, '/history', 'DELETE', {})).status, 400)
    assert.equal(
      (
        await send(app, '/history/settings', 'PUT', {
          enabled: true,
          retentionDays: 90,
          maxVersions: 50,
          userId: 'foreign',
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await send(app, '/history/note/' + note.id + '/restore', 'POST', {
          versionId: version,
          expectedFingerprint: note.fingerprint,
          fields: ['projectId'],
        })
      ).status,
      400,
    )
    assert.equal(
      (await send(app, '/history', 'DELETE', { confirm: 'Verlauf löschen' }))
        .status,
      200,
    )
  } finally {
    await close()
  }
})
