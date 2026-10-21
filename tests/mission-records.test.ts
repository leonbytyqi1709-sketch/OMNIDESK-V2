import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import * as store from '../server/mission-records-storage'
import { createMissionRecordsRoute } from '../server/routes/mission-records'
import { createApp } from '../server/app'
import type { MissionRecordInput } from '../src/types/mission-records'
async function fixture() {
  const result = await postgresStorage()
  await result.pg
    .exec(`CREATE TABLE projects(id uuid PRIMARY KEY,user_id text,name text);
  CREATE TABLE notes(id uuid PRIMARY KEY,user_id text,title text);
  CREATE TABLE tasks(id uuid PRIMARY KEY,user_id text,title text);
  CREATE TABLE project_tasks(id uuid PRIMARY KEY,user_id text,title text,project_id uuid REFERENCES projects(id) ON DELETE CASCADE);`)
  return result
}
const data = (): MissionRecordInput => ({
  title: 'Übergabe',
  projectId: null,
  state: 'paused',
  context: 'Bisheriger Stand',
  decisions: 'Sicherung zuerst prüfen',
  questions: 'Freigabe fehlt',
  nextSteps: 'Kunden anrufen',
  outcome: '',
  sources: [],
})
test('record and source lists are bounded and the account capacity cannot be bypassed', async () => {
  const { pg, close } = await fixture()
  try {
    await store.initializeMissionRecords()
    await pg.exec(
      "INSERT INTO notes(id,user_id,title) SELECT gen_random_uuid(),'owner','Notiz '||n FROM generate_series(1,51) n",
    )
    const choices = await store.missionReferenceChoices('owner', 'note', '')
    assert.equal(choices.sources.length, 50)
    assert.equal(choices.limited, true)
    await pg.exec(
      "INSERT INTO v2_mission_records(id,user_id,creation_hash,title,state,context,decisions,outcome,questions,next_steps,sources) SELECT gen_random_uuid(),'owner','fixture','Stand '||n,'paused','','','','','','[]'::jsonb FROM generate_series(1,200) n",
    )
    const list = await store.listMissionRecords('owner', null, '')
    assert.equal(list.records.length, 100)
    assert.equal(list.limited, true)
    await assert.rejects(
      store.writeMissionRecord('owner', randomUUID(), data(), null),
    )
    await store.writeMissionRecord('other', randomUUID(), data(), null)
    assert.equal(
      (await store.listMissionRecords('other', null, '')).records.length,
      1,
    )
  } finally {
    await close()
  }
})
test('mission records preserve documented context, support archive/search/resume and protect versioned edits and retries', async () => {
  const { close } = await fixture()
  try {
    const id = randomUUID(),
      input = data()
    await store.writeMissionRecord('owner', id, input, null)
    await store.writeMissionRecord('owner', id, input, null)
    assert.equal(
      (await store.listMissionRecords('owner', null, '')).records.length,
      1,
    )
    assert.equal(
      (await store.listMissionRecords('owner', 'paused', 'kunden')).records[0]
        .id,
      id,
    )
    assert.equal(
      (await store.readMissionRecord('owner', id)).decisions,
      input.decisions,
    )
    await assert.rejects(store.readMissionRecord('other', id))
    await assert.rejects(store.writeMissionRecord('other', id, input, null))
    await assert.rejects(
      store.writeMissionRecord(
        'owner',
        id,
        { ...input, title: 'Changed retry' },
        null,
      ),
    )
    await store.writeMissionRecord(
      'owner',
      id,
      { ...input, state: 'archived', outcome: 'Erfolgreich übergeben' },
      1,
    )
    let record = await store.readMissionRecord('owner', id)
    assert.equal(record.version, 2)
    assert.ok(record.archivedAt)
    assert.equal(
      (await store.listMissionRecords('owner', 'archived', 'übergeben'))
        .records[0].id,
      id,
    )
    await assert.rejects(store.writeMissionRecord('owner', id, input, 1))
    await store.writeMissionRecord(
      'owner',
      id,
      { ...input, state: 'active', outcome: 'Erfolgreich übergeben' },
      2,
    )
    record = await store.readMissionRecord('owner', id)
    assert.equal(record.state, 'active')
    assert.equal(record.archivedAt, null)
    assert.equal(record.nextSteps, input.nextSteps)
    assert.equal(record.outcome, 'Erfolgreich übergeben')
    await assert.rejects(store.deleteMissionRecord('other', id, record.version))
    await assert.rejects(store.deleteMissionRecord('owner', id, 1))
    await store.deleteMissionRecord('owner', id, record.version)
    await assert.rejects(store.readMissionRecord('owner', id))
  } finally {
    await close()
  }
})
test('record references check each original source and project, and never retain foreign source labels after access is lost', async () => {
  const { pg, close } = await fixture()
  try {
    const project = randomUUID(),
      foreign = randomUUID(),
      note = randomUUID(),
      board = randomUUID()
    await pg.query(
      "INSERT INTO projects VALUES($1,'owner','Privates Projekt'),($2,'other','Fremdes Projekt')",
      [project, foreign],
    )
    await pg.query("INSERT INTO notes VALUES($1,'owner','Private Notiz')", [
      note,
    ])
    await pg.query(
      "INSERT INTO project_tasks VALUES($1,'owner','Private Boardaufgabe',$2)",
      [board, project],
    )
    const id = randomUUID(),
      input = {
        ...data(),
        projectId: project,
        sources: [
          { kind: 'note' as const, id: note },
          { kind: 'project_task' as const, id: board },
        ],
      }
    await assert.rejects(
      store.writeMissionRecord('other', randomUUID(), input, null),
    )
    await assert.rejects(
      store.writeMissionRecord(
        'owner',
        randomUUID(),
        { ...input, projectId: foreign },
        null,
      ),
    )
    await store.writeMissionRecord('owner', id, input, null)
    let record = await store.readMissionRecord('owner', id)
    assert.equal(record.sources.length, 2)
    assert.equal(record.projectName, 'Privates Projekt')
    assert.ok(record.sources.every((s) => s.available))
    assert.equal(
      (
        await store.missionReferenceChoices(
          'owner',
          'project_task',
          'Boardaufgabe',
        )
      ).sources.length,
      1,
    )
    await pg.query("UPDATE projects SET user_id='other' WHERE id=$1", [project])
    await pg.query(
      "UPDATE notes SET user_id='other',title='Fremder neuer Titel' WHERE id=$1",
      [note],
    )
    record = await store.readMissionRecord('owner', id)
    assert.equal(record.projectId, null)
    assert.equal(record.projectName, null)
    assert.ok(
      record.sources.every(
        (s) => !s.available && s.title === null && s.projectId === null,
      ),
    )
    assert.ok(!JSON.stringify(record).includes('Fremder neuer Titel'))
    assert.equal(
      (await store.missionReferenceChoices('owner', 'project_task', '')).sources
        .length,
      0,
    )
    await assert.rejects(store.writeMissionRecord('owner', id, input, 1))
    await pg.query('DELETE FROM projects WHERE id=$1', [project])
    assert.equal(
      (await store.readMissionRecord('owner', id)).context,
      input.context,
    )
    await store.deleteMissionRecord('owner', id, 1)
    assert.equal(
      (await pg.query('SELECT id FROM notes WHERE id=$1', [note])).rows.length,
      1,
    )
  } finally {
    await close()
  }
})
test('mission record API enforces auth, strict content, explicit result before archive and owned source filters', async () => {
  assert.equal((await createApp().request('/api/mission-records')).status, 401)
  const { close } = await fixture()
  try {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('userId', 'owner')
      await next()
    })
    app.route('/records', createMissionRecordsRoute())
    const request = (path: string, method = 'GET', body?: unknown) =>
      app.request('/records' + path, {
        method,
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            }),
      })
    assert.equal(
      (
        await request('', 'POST', {
          id: randomUUID(),
          data: { ...data(), state: 'archived' },
        })
      ).status,
      400,
    )
    assert.equal(
      (
        await request('', 'POST', {
          id: randomUUID(),
          data: { ...data(), userId: 'other' },
        })
      ).status,
      400,
    )
    assert.equal((await request('/sources?kind=room')).status, 400)
    assert.equal((await request('/not-a-uuid')).status, 400)
    const id = randomUUID()
    assert.equal((await request('', 'POST', { id, data: data() })).status, 201)
    const detail = await request('/' + id)
    assert.equal(detail.status, 200)
    assert.equal(detail.headers.get('Cache-Control'), 'no-store')
    assert.equal(
      (await request('/' + id, 'PUT', { data: data(), version: 7 })).status,
      409,
    )
    assert.equal(
      (await request('/' + id, 'DELETE', { version: 1 })).status,
      200,
    )
  } finally {
    await close()
  }
})
