import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import {
  localTimeToIso,
  omniOperationSchema,
  omniPlannerOutput,
  type OmniOperation,
} from '../server/omni-actions-policy'
import { prepareOmniOperations } from '../server/omni-actions-prepare'
import {
  loadOmniContext,
  publicOmniContext,
  type OmniContext,
} from '../server/omni-actions-context'
import {
  initializeOmniActions,
  readOmniPlans,
  saveOmniPlan,
  executeOmniPlan,
  cancelOmniPlan,
  claimOmniPlanning,
  findOmniRequest,
} from '../server/omni-actions-storage'
import { planOmniWithAI } from '../server/omni-actions-ai'
import { createOmniActionsRoute } from '../server/routes/omni-actions'
import { createApp } from '../server/app'
const zone = 'Europe/Berlin',
  id = randomUUID(),
  foreign = randomUUID(),
  taskId = randomUUID(),
  projectTask = randomUUID()
const createTask: OmniOperation = {
  kind: 'create_task',
  title: 'Backup prüfen',
  description: '',
  priority: 'high',
  status: 'todo',
  dueDate: '2026-10-21',
}
const empty: OmniContext = {
  tasks: [],
  projects: [],
  projectTasks: [],
  truncated: false,
}

test('Omni dates resolve real local wall times and reject DST gaps, ambiguities and invalid dates', () => {
  assert.equal(
    localTimeToIso('2026-10-21T14:00', zone),
    '2026-10-21T12:00:00.000Z',
  )
  assert.equal(
    localTimeToIso('2026-11-21T14:00', zone),
    '2026-11-21T13:00:00.000Z',
  )
  assert.throws(
    () => localTimeToIso('2026-03-29T02:30', zone),
    /Zeitumstellung/,
  )
  assert.throws(
    () => localTimeToIso('2026-10-25T02:30', zone),
    /Zeitumstellung/,
  )
  assert.throws(() => localTimeToIso('2026-02-30T14:00', zone), /ungültig/)
  assert.throws(() => localTimeToIso('2026-10-21T24:00', zone), /ungültig/)
  assert.equal(
    prepareOmniOperations([createTask], empty, zone).stored[0].after.dueDate,
    '2026-10-21T21:59:59.000Z',
  )
})

test('Omni day deadlines match the existing task form at the end of the local day, including DST', () => {
  assert.equal(
    prepareOmniOperations(
      [{ ...createTask, dueDate: '2026-03-29' }],
      empty,
      zone,
    ).stored[0].after.dueDate,
    '2026-03-29T21:59:59.000Z',
  )
  assert.equal(
    prepareOmniOperations(
      [{ ...createTask, dueDate: '2026-10-25' }],
      empty,
      zone,
    ).stored[0].after.dueDate,
    '2026-10-25T22:59:59.000Z',
  )
})

test('Omni only permits the supported operation schemas, owned known targets and nonempty changes', () => {
  assert.equal(
    omniOperationSchema.safeParse({ ...createTask, userId: 'forged' }).success,
    false,
  )
  assert.equal(
    omniOperationSchema.safeParse({ kind: 'delete_task', taskId }).success,
    false,
  )
  assert.equal(
    omniOperationSchema.safeParse({ kind: 'update_task', taskId, changes: {} })
      .success,
    false,
  )
  assert.equal(
    omniOperationSchema.safeParse({
      kind: 'create_project_task',
      projectId: id,
      title: 'Task',
      priority: 'medium',
      status: 'todo',
      dueDate: '2026-10-21',
    }).success,
    false,
  )
  assert.equal(
    omniPlannerOutput.safeParse({
      type: 'plan',
      operations: Array(6).fill(createTask),
    }).success,
    false,
  )
  assert.throws(
    () =>
      prepareOmniOperations(
        [{ kind: 'update_task', taskId, changes: { status: 'done' } }],
        empty,
        zone,
      ),
    /verfügbaren Quellen/,
  )
  assert.throws(
    () =>
      prepareOmniOperations(
        [{ kind: 'append_project_note', projectId: foreign, text: 'note' }],
        empty,
        zone,
      ),
    /verfügbaren Quellen/,
  )
  assert.throws(
    () =>
      prepareOmniOperations(
        [
          {
            kind: 'create_appointment',
            title: 'Meeting',
            description: '',
            location: '',
            priority: 'medium',
            startLocal: '2026-10-21T14:00',
            endLocal: '2026-10-21T13:00',
          },
        ],
        empty,
        zone,
      ),
    /Terminende/,
  )
  const context: OmniContext = {
    ...empty,
    tasks: [
      {
        id: taskId,
        title: 'Task',
        description: 'secret',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        version: 'v',
      },
    ],
  }
  assert.throws(
    () =>
      prepareOmniOperations(
        [{ kind: 'update_task', taskId, changes: { title: 'Task' } }],
        context,
        zone,
      ),
    /keine Änderung/,
  )
  assert.throws(
    () =>
      prepareOmniOperations(
        [
          { kind: 'update_task', taskId, changes: { title: 'A' } },
          { kind: 'update_task', taskId, changes: { title: 'B' } },
        ],
        context,
        zone,
      ),
    /mehrfach/,
  )
  assert.ok(!JSON.stringify(publicOmniContext(context)).includes('secret'))
})

test('Omni PostgreSQL: actual atomic execution, idempotency, conflicts, cancellation, ownership and limits', async (t) => {
  const storage = await postgresStorage(),
    { pg } = storage
  try {
    await pg.exec(`CREATE TABLE notes(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now());
 CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',priority text DEFAULT 'medium',status text DEFAULT 'active',updated_at timestamptz DEFAULT now());
 CREATE TABLE tasks(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'todo',priority text NOT NULL DEFAULT 'medium',due_date timestamptz,tags jsonb DEFAULT '[]',subtasks jsonb DEFAULT '[]',updated_at timestamptz DEFAULT now());
 CREATE TABLE project_tasks(id uuid PRIMARY KEY,user_id text NOT NULL,project_id uuid REFERENCES projects(id),title text NOT NULL,status text NOT NULL DEFAULT 'backlog',priority text NOT NULL DEFAULT 'medium',updated_at timestamptz DEFAULT now());
 CREATE TABLE appointments(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL);`)
    await pg.query(
      `INSERT INTO projects(id,user_id,name,description) VALUES($1,'owner','OMNIDESK V2','Vorhandene Beschreibung'),($2,'foreign','Foreign','Private foreign text')`,
      [id, foreign],
    )
    await pg.query(
      `INSERT INTO tasks(id,user_id,title,description) VALUES($1,'owner','Bestehende Aufgabe','Private description'),($2,'foreign','Foreign task','Foreign secret')`,
      [taskId, foreign],
    )
    await pg.query(
      `INSERT INTO project_tasks(id,user_id,project_id,title) VALUES($1,'owner',$2,'Board task'),($3,'foreign',$2,'Misowned task'),($4,'owner',$5,'Wrong parent')`,
      [projectTask, id, randomUUID(), randomUUID(), foreign],
    )
    await initializeOmniActions()
    await initializeOmniActions()
    const context = await loadOmniContext('owner')
    await t.test(
      'context is owned and excludes misowned joined targets',
      () => {
        assert.equal(context.tasks.length, 1)
        assert.equal(context.projects.length, 1)
        assert.equal(context.projectTasks.length, 1)
        assert.equal(context.projectTasks[0].id, projectTask)
        assert.ok(
          !JSON.stringify(publicOmniContext(context)).includes(
            'Private description',
          ),
        )
        assert.ok(!JSON.stringify(context).includes('Foreign secret'))
      },
    )
    const save = async (ops: OmniOperation[], ctx = context, owner = 'owner') =>
      saveOmniPlan(
        owner,
        randomUUID(),
        'Expliziter Auftrag',
        zone,
        prepareOmniOperations(ops, ctx, zone),
      )
    await t.test(
      'a proposal alone does not write business data; confirmation executes every step once',
      async () => {
        const plan = await save([
          createTask,
          {
            kind: 'create_project_task',
            projectId: id,
            title: 'Projektprüfung',
            priority: 'medium',
            status: 'todo',
          },
          {
            kind: 'create_appointment',
            title: 'Besprechung',
            description: '',
            location: 'Büro',
            priority: 'medium',
            startLocal: '2026-10-22T14:00',
            endLocal: '2026-10-22T15:00',
          },
          {
            kind: 'append_project_note',
            projectId: id,
            text: 'Neue Projektnotiz',
          },
        ])
        assert.equal(plan.status, 'pending')
        assert.equal(plan.results.length, 0)
        assert.equal(
          (await pg.query(`SELECT * FROM tasks WHERE title='Backup prüfen'`))
            .rows.length,
          0,
        )
        const result = await executeOmniPlan('owner', plan.id)
        assert.equal(result.status, 'executed')
        assert.equal(result.results.length, 4)
        assert.equal(
          (await pg.query(`SELECT description FROM projects WHERE id=$1`, [id]))
            .rows[0].description,
          'Vorhandene Beschreibung\n\nNeue Projektnotiz',
        )
        assert.equal(
          (
            await pg.query(
              `SELECT starts_at FROM appointments WHERE title='Besprechung'`,
            )
          ).rows.length,
          1,
        )
        await executeOmniPlan('owner', plan.id)
        assert.equal(
          (await pg.query(`SELECT * FROM tasks WHERE title='Backup prüfen'`))
            .rows.length,
          1,
        )
        assert.equal(
          (
            await pg.query(
              `SELECT * FROM appointments WHERE title='Besprechung'`,
            )
          ).rows.length,
          1,
        )
      },
    )
    await t.test(
      'updates preserve fields not requested and check current versions',
      async () => {
        const current = await loadOmniContext('owner')
        const plan = await save(
          [
            { kind: 'update_task', taskId, changes: { status: 'done' } },
            {
              kind: 'update_project_task',
              taskId: projectTask,
              changes: { priority: 'high' },
            },
          ],
          current,
        )
        await executeOmniPlan('owner', plan.id)
        const row = (
          await pg.query(`SELECT * FROM tasks WHERE id=$1`, [taskId])
        ).rows[0]
        assert.equal(row.status, 'done')
        assert.equal(row.description, 'Private description')
        assert.equal(row.title, 'Bestehende Aufgabe')
        assert.equal(
          (
            await pg.query(`SELECT priority FROM project_tasks WHERE id=$1`, [
              projectTask,
            ])
          ).rows[0].priority,
          'high',
        )
      },
    )
    await t.test(
      'a conflict in the final step rolls back all preceding writes',
      async () => {
        const current = await loadOmniContext('owner')
        const plan = await save(
          [
            { ...createTask, title: 'Must roll back' },
            { kind: 'update_task', taskId, changes: { priority: 'high' } },
          ],
          current,
        )
        await pg.query(
          `UPDATE tasks SET title='Changed by another tab' WHERE id=$1`,
          [taskId],
        )
        await assert.rejects(
          executeOmniPlan('owner', plan.id),
          /inzwischen geändert/,
        )
        assert.equal(
          (await pg.query(`SELECT * FROM tasks WHERE title='Must roll back'`))
            .rows.length,
          0,
        )
        assert.equal(
          (
            await pg.query(
              `SELECT status FROM v2_omni_action_plans WHERE id=$1`,
              [plan.id],
            )
          ).rows[0].status,
          'pending',
        )
      },
    )
    await t.test(
      'foreign confirmation and history are blocked; cancel and expiry prevent writes',
      async () => {
        const plan = await save([createTask])
        await assert.rejects(
          executeOmniPlan('foreign', plan.id),
          /nicht gefunden/,
        )
        assert.deepEqual(await readOmniPlans('foreign'), [])
        await assert.rejects(
          cancelOmniPlan('foreign', plan.id),
          /nicht gefunden/,
        )
        await cancelOmniPlan('owner', plan.id)
        await assert.rejects(executeOmniPlan('owner', plan.id), /abgebrochen/)
        const expired = await save([createTask])
        await pg.query(
          `UPDATE v2_omni_action_plans SET expires_at=now()-interval '1 minute' WHERE id=$1`,
          [expired.id],
        )
        await assert.rejects(executeOmniPlan('owner', expired.id), /abgelaufen/)
        assert.equal(
          (await readOmniPlans('owner')).find((p) => p.id === expired.id)
            ?.status,
          'expired',
        )
      },
    )
    await t.test(
      'a changed or removed project parent cancels every step, including task creates',
      async () => {
        const current = await loadOmniContext('owner'),
          plan = await save(
            [
              {
                kind: 'create_project_task',
                projectId: id,
                title: 'No write',
                priority: 'medium',
                status: 'todo',
              },
            ],
            current,
          )
        await pg.query(`UPDATE projects SET name='Renamed' WHERE id=$1`, [id])
        await assert.rejects(
          executeOmniPlan('owner', plan.id),
          /inzwischen geändert/,
        )
        assert.equal(
          (await pg.query(`SELECT * FROM project_tasks WHERE title='No write'`))
            .rows.length,
          0,
        )
      },
    )
    await t.test(
      'planning request IDs are idempotent and rate limits are per user',
      async () => {
        const req = randomUUID(),
          prepared = prepareOmniOperations([createTask], empty, zone)
        const first = await saveOmniPlan('owner', req, 'same', zone, prepared),
          second = await saveOmniPlan(
            'owner',
            req,
            'cannot replace',
            zone,
            prepared,
          )
        assert.equal(first.id, second.id)
        assert.equal(second.prompt, 'same')
        assert.equal((await findOmniRequest('owner', req))?.id, first.id)
        assert.equal(await findOmniRequest('foreign', req), null)
        await claimOmniPlanning('owner')
        await assert.rejects(claimOmniPlanning('owner'), /20 Sekunden/)
        await claimOmniPlanning('foreign')
      },
    )
    await t.test(
      'concurrent confirmations of the same proposal write exactly once',
      async () => {
        const plan = await save([
          { ...createTask, title: 'Concurrent exactly once' },
        ])
        const results = await Promise.all([
          executeOmniPlan('owner', plan.id),
          executeOmniPlan('owner', plan.id),
        ])
        assert.ok(results.every((result) => result.status === 'executed'))
        assert.equal(
          (
            await pg.query(
              "SELECT * FROM tasks WHERE title='Concurrent exactly once'",
            )
          ).rows.length,
          1,
        )
      },
    )
  } finally {
    await storage.close()
  }
})

test('Omni planner sends selected context only and validates model output without executing it', async () => {
  const oldFetch = globalThis.fetch,
    oldKey = process.env.OPENAI_API_KEY,
    oldKeys = process.env.AI_API_KEYS,
    oldBase = process.env.AI_BASE_URL
  process.env.OPENAI_API_KEY = 'private-test-key'
  process.env.AI_API_KEYS = ''
  process.env.AI_BASE_URL = 'https://ai.example.test/v1'
  let calls = 0
  try {
    globalThis.fetch = async (_url, init) => {
      calls++
      const payload = JSON.parse(String(init?.body))
      assert.equal(payload.tools, undefined)
      assert.equal(init?.redirect, 'error')
      assert.ok(!JSON.stringify(payload).includes('Private description'))
      const context = JSON.parse(payload.messages[1].content)
      assert.equal(context.request, 'Neue Aufgabe')
      assert.equal(context.timeZone, zone)
      assert.equal(context.currentDay, '2026-10-21')
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'plan',
                operations: [createTask],
              }),
            },
          },
        ],
      })
    }
    const response = await planOmniWithAI(
      'Neue Aufgabe',
      {
        ...empty,
        tasks: [
          {
            id: taskId,
            title: 'Task',
            description: 'Private description',
            status: 'todo',
            priority: 'medium',
            dueDate: null,
            version: 'v',
          },
        ],
      },
      zone,
      new Date('2026-10-20T22:30:00Z'),
    )
    assert.equal(response.type, 'plan')
    assert.equal(calls, 1)
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'plan',
                operations: [{ kind: 'delete_task', taskId }],
              }),
            },
          },
        ],
      })
    await assert.rejects(
      planOmniWithAI('Löschen', empty, zone),
      /keinen gültigen Vorschlag/,
    )
  } finally {
    globalThis.fetch = oldFetch
    for (const [k, v] of Object.entries({
      OPENAI_API_KEY: oldKey,
      AI_API_KEYS: oldKeys,
      AI_BASE_URL: oldBase,
    }))
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
  }
})

test('Omni routes derive owner from auth and reject forged confirmation content and planner fields', async () => {
  const app = createApp()
  for (const [method, path] of [
    ['GET', '/api/omni-actions'],
    ['POST', '/api/omni-actions/plan'],
    ['POST', `/api/omni-actions/${id}/confirm`],
  ])
    assert.equal((await app.request(path, { method })).status, 401)
  const seen: string[] = [],
    fakePlan = {
      id,
      status: 'pending' as const,
      prompt: 'request',
      timeZone: zone,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      previews: [],
      results: [],
    }
  const route = createOmniActionsRoute({
    initializeOmniActions: async () => {},
    readOmniPlans: async (user) => {
      seen.push(user)
      return []
    },
    findOmniRequest: async () => null,
    claimOmniPlanning: async () => {},
    loadOmniContext: async () => empty,
    planOmniWithAI: async () => ({
      type: 'clarification' as const,
      message: 'Welches Projekt?',
    }),
    saveOmniPlan: async () => fakePlan,
    executeOmniPlan: async (user) => {
      seen.push(user)
      return fakePlan
    },
    cancelOmniPlan: async () => ({ ok: true }),
  })
  const auth = new Hono()
  auth.use('*', async (c, next) => {
    c.set('userId', 'session-owner')
    await next()
  })
  auth.route('/actions', route)
  assert.equal((await auth.request('/actions')).status, 200)
  const post = (path: string, body: unknown) =>
    auth.request('/actions' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  assert.equal(
    (
      await post(`/${id}/confirm`, {
        userId: 'foreign',
        operations: [createTask],
      })
    ).status,
    400,
  )
  assert.equal((await post(`/${id}/confirm`, {})).status, 200)
  assert.equal(
    (
      await post('/plan', {
        requestId: randomUUID(),
        prompt: 'request',
        timeZone: zone,
        userId: 'foreign',
      })
    ).status,
    400,
  )
  const clarify = await post('/plan', {
    requestId: randomUUID(),
    prompt: 'request',
    timeZone: zone,
  })
  assert.equal((await clarify.json()).type, 'clarification')
  assert.ok(seen.every((user) => user === 'session-owner'))
  assert.equal(seen.length, 2)
})

test('Omni previews preserve literal titles and descriptions that resemble status values', () => {
  const prepared = prepareOmniOperations(
    [{ ...createTask, title: 'high', description: 'done' }],
    empty,
    zone,
  )
  assert.equal(
    prepared.previews[0].changes.find((c) => c.label === 'Titel')?.after,
    'high',
  )
  assert.equal(
    prepared.previews[0].changes.find((c) => c.label === 'Beschreibung')?.after,
    'done',
  )
})
