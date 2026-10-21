import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  tasks,
} from '../../src/db/schema/index'

import { retireWorkingHistory } from '../retire-working-history'
import { editFingerprint } from '../edit-version'

const rowFields = {
  ...getTableColumns(tasks),
  fingerprint: sql<string>`md5(to_jsonb(${tasks})::text)`,
}

const subtaskInput = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1, 'Unteraufgabe darf nicht leer sein').max(300),
  done: z.boolean(),
})

// Bewusst OHNE .default(): die Update-Route nutzt .partial(), und Defaults
// würden dort nicht mitgeschickte Felder auf ihre Standardwerte zurücksetzen.
const taskInput = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(300),
  description: z.string().max(10_000),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  /** ISO-Datum oder null (keine Fälligkeit) */
  dueDate: z.iso.datetime({ offset: true }).nullable(),
  tags: z.array(z.string().trim().max(50)).optional(),
  subtasks: z.array(subtaskInput).optional(),
})

export const tasksRoute = new Hono()
tasksRoute.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await retireWorkingHistory()
  await next()
})

tasksRoute.get('/', async (c) => {
  const rows = await db
    .select(rowFields)
    .from(tasks)
    .where(eq(tasks.userId, c.get('userId')))
    .orderBy(desc(tasks.createdAt))
  return c.json(rows)
})

tasksRoute.post('/', async (c) => {
  const parsed = taskInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const { dueDate, ...rest } = parsed.data
  const [row] = await db
    .insert(tasks)
    .values({
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
      userId: c.get('userId'),
    })
    .returning(rowFields)
  return c.json(row, 201)
})

// Teil-Update: erlaubt auch reine Statuswechsel (Kanban)
tasksRoute.put('/:id', async (c) => {
  const parsed = taskInput
    .partial()
    .extend({ expectedFingerprint: editFingerprint })
    .strict()
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const { dueDate, expectedFingerprint, ...rest } = parsed.data
  const [row] = await db
    .update(tasks)
    .set({
      ...rest,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tasks.id, c.req.param('id')),
        eq(tasks.userId, c.get('userId')),
        sql`md5(to_jsonb(${tasks})::text)=${expectedFingerprint}`,
      ),
    )
    .returning(rowFields)
  if (!row)
    return c.json(
      {
        error:
          'Aufgabe inzwischen geändert oder nicht mehr verfügbar. Bitte neu laden',
      },
      409,
    )
  return c.json(row)
})

tasksRoute.delete('/:id', async (c) => {
  const [row] = await db
    .delete(tasks)
    .where(
      and(eq(tasks.id, c.req.param('id')), eq(tasks.userId, c.get('userId'))),
    )
    .returning({ id: tasks.id })
  if (!row) return c.json({ error: 'Aufgabe nicht gefunden' }, 404)
  return c.json({ ok: true })
})
