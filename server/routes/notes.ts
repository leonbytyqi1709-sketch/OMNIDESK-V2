import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { notes } from '../../src/db/schema/index'

import { retireWorkingHistory } from '../retire-working-history'
import { editFingerprint } from '../edit-version'

const rowFields = {
  ...getTableColumns(notes),
  fingerprint: sql<string>`md5(to_jsonb(${notes})::text)`,
}

const noteInput = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(300),
  content: z.string().max(100_000),
})

export const notesRoute = new Hono()
notesRoute.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await retireWorkingHistory()
  await next()
})

notesRoute.get('/', async (c) => {
  const rows = await db
    .select(rowFields)
    .from(notes)
    .where(eq(notes.userId, c.get('userId')))
    .orderBy(desc(notes.updatedAt))
  return c.json(rows)
})

// Neue Notiz mit Defaults – der Editor benennt sie danach um
notesRoute.post('/', async (c) => {
  const [row] = await db
    .insert(notes)
    .values({ userId: c.get('userId') })
    .returning(rowFields)
  return c.json(row, 201)
})

notesRoute.put('/:id', async (c) => {
  const parsed = noteInput
    .extend({ expectedFingerprint: editFingerprint })
    .strict()
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const [row] = await db
    .update(notes)
    .set({
      title: parsed.data.title,
      content: parsed.data.content,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notes.id, c.req.param('id')),
        eq(notes.userId, c.get('userId')),
        sql`md5(to_jsonb(${notes})::text)=${parsed.data.expectedFingerprint}`,
      ),
    )
    .returning(rowFields)
  if (!row)
    return c.json(
      {
        error:
          'Notiz inzwischen geändert oder nicht mehr verfügbar. Bitte neu laden',
      },
      409,
    )
  return c.json(row)
})

notesRoute.delete('/:id', async (c) => {
  const [row] = await db
    .delete(notes)
    .where(
      and(eq(notes.id, c.req.param('id')), eq(notes.userId, c.get('userId'))),
    )
    .returning({ id: notes.id })
  if (!row) return c.json({ error: 'Notiz nicht gefunden' }, 404)
  return c.json({ ok: true })
})
