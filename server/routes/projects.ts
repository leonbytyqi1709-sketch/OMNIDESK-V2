import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import {
  PROJECT_STATUSES,
  PROJECT_TASK_STATUSES,
  TASK_PRIORITIES,
  milestones,
  projectTasks,
  projects,
} from '../../src/db/schema/index'

import { initializeWorkingHistory } from '../history-storage'
import { historyFingerprint } from '../history-policy'
const taskFields = {
  ...getTableColumns(projectTasks),
  fingerprint: sql<string>`md5(to_jsonb(${projectTasks})::text)`,
}

const projectInput = z.object({
  name: z.string().trim().min(1, 'Name fehlt').max(300),
  description: z.string().max(10_000),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(PROJECT_STATUSES),
  tags: z.array(z.string().trim().max(50)).optional(),
})

const projectTaskInput = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(300),
  status: z.enum(PROJECT_TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
})

const milestoneInput = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(300),
  dueDate: z.iso.datetime({ offset: true }).nullable(),
  done: z.boolean(),
})

export const projectsRoute = new Hono()
projectsRoute.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await initializeWorkingHistory()
  await next()
})

projectsRoute.get('/', async (c) => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, c.get('userId')))
    .orderBy(desc(projects.createdAt))
  return c.json(rows)
})

/** Detailansicht: Projekt + Board-Aufgaben + Meilensteine in einem Rutsch. */
projectsRoute.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404)

  const [tasks, projectMilestones] = await Promise.all([
    db
      .select(taskFields)
      .from(projectTasks)
      .where(
        and(eq(projectTasks.projectId, id), eq(projectTasks.userId, userId)),
      )
      .orderBy(asc(projectTasks.createdAt)),
    db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, id), eq(milestones.userId, userId)))
      .orderBy(asc(milestones.dueDate)),
  ])
  return c.json({ project, tasks, milestones: projectMilestones })
})

projectsRoute.post('/', async (c) => {
  const parsed = projectInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const [row] = await db
    .insert(projects)
    .values({ ...parsed.data, userId: c.get('userId') })
    .returning()
  return c.json(row, 201)
})

projectsRoute.put('/:id', async (c) => {
  const parsed = projectInput.partial().safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const [row] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, c.req.param('id')),
        eq(projects.userId, c.get('userId')),
      ),
    )
    .returning()
  if (!row) return c.json({ error: 'Projekt nicht gefunden' }, 404)
  return c.json(row)
})

projectsRoute.delete('/:id', async (c) => {
  const [row] = await db
    .delete(projects)
    .where(
      and(
        eq(projects.id, c.req.param('id')),
        eq(projects.userId, c.get('userId')),
      ),
    )
    .returning({ id: projects.id })
  if (!row) return c.json({ error: 'Projekt nicht gefunden' }, 404)
  return c.json({ ok: true })
})

// --- Board-Aufgaben ---

projectsRoute.post('/:id/tasks', async (c) => {
  const parsed = projectTaskInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404)

  const [row] = await db
    .insert(projectTasks)
    .values({ ...parsed.data, projectId, userId })
    .returning(taskFields)
  return c.json(row, 201)
})

projectsRoute.put('/tasks/:taskId', async (c) => {
  const parsed = projectTaskInput
    .partial()
    .extend({ expectedFingerprint: historyFingerprint })
    .strict()
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const [row] = await db
    .update(projectTasks)
    .set({
      title: parsed.data.title,
      status: parsed.data.status,
      priority: parsed.data.priority,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectTasks.id, c.req.param('taskId')),
        eq(projectTasks.userId, c.get('userId')),
        sql`md5(to_jsonb(${projectTasks})::text)=${parsed.data.expectedFingerprint}`,
        sql`EXISTS(SELECT 1 FROM projects p WHERE p.id=${projectTasks.projectId} AND p.user_id=${projectTasks.userId})`,
      ),
    )
    .returning(taskFields)
  if (!row)
    return c.json(
      {
        error:
          'Aufgabe inzwischen geändert oder nicht mehr verfügbar. Bitte neu laden.',
      },
      409,
    )
  return c.json(row)
})

projectsRoute.delete('/tasks/:taskId', async (c) => {
  const [row] = await db
    .delete(projectTasks)
    .where(
      and(
        eq(projectTasks.id, c.req.param('taskId')),
        eq(projectTasks.userId, c.get('userId')),
      ),
    )
    .returning({ id: projectTasks.id })
  if (!row) return c.json({ error: 'Aufgabe nicht gefunden' }, 404)
  return c.json({ ok: true })
})

// --- Meilensteine ---

projectsRoute.post('/:id/milestones', async (c) => {
  const parsed = milestoneInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  if (!project) return c.json({ error: 'Projekt nicht gefunden' }, 404)

  const { dueDate, ...rest } = parsed.data
  const [row] = await db
    .insert(milestones)
    .values({
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
      projectId,
      userId,
    })
    .returning()
  return c.json(row, 201)
})

projectsRoute.put('/milestones/:milestoneId', async (c) => {
  const parsed = milestoneInput.partial().safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const { dueDate, ...rest } = parsed.data
  const [row] = await db
    .update(milestones)
    .set({
      ...rest,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
    })
    .where(
      and(
        eq(milestones.id, c.req.param('milestoneId')),
        eq(milestones.userId, c.get('userId')),
      ),
    )
    .returning()
  if (!row) return c.json({ error: 'Meilenstein nicht gefunden' }, 404)
  return c.json(row)
})

projectsRoute.delete('/milestones/:milestoneId', async (c) => {
  const [row] = await db
    .delete(milestones)
    .where(
      and(
        eq(milestones.id, c.req.param('milestoneId')),
        eq(milestones.userId, c.get('userId')),
      ),
    )
    .returning({ id: milestones.id })
  if (!row) return c.json({ error: 'Meilenstein nicht gefunden' }, 404)
  return c.json({ ok: true })
})
