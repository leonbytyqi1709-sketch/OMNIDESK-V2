import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { TASK_PRIORITIES, appointments } from '../../src/db/schema/index'
import { MAX_OCCURRENCES, RECURRENCE_FREQUENCIES, occurrences } from '../../src/lib/recurrence'
import {
  createSeries,
  deleteSeriesFrom,
  seriesForAppointment,
  seriesOf,
  updateSeriesFrom,
} from '../appointment-series'

const recurrenceInput = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1).max(52).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  ends: z.discriminatedUnion('type', [
    z.object({ type: z.literal('count'), count: z.number().int().min(1).max(MAX_OCCURRENCES) }),
    z.object({ type: z.literal('until'), until: z.iso.date() }),
  ]),
})

/** „Nur dieser Termin“ oder „dieser und alle folgenden“. */
const scopeOf = (c: { req: { query: (name: string) => string | undefined } }) =>
  c.req.query('scope') === 'series' ? 'series' : 'single'

const appointmentInput = z
  .object({
    title: z.string().trim().min(1, 'Titel fehlt').max(300),
    description: z.string().max(10_000).default(''),
    location: z.string().trim().max(300).default(''),
    priority: z.enum(TASK_PRIORITIES).default('medium'),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'Ende muss nach dem Beginn liegen',
    path: ['endsAt'],
  })

export const appointmentsRoute = new Hono()

appointmentsRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, userId))
    .orderBy(asc(appointments.startsAt))
  // Die Zugehörigkeit steht in einer eigenen Tabelle; die Terminzeilen selbst
  // bleiben unverändert, damit alle anderen Module nichts davon merken.
  const series = await seriesOf(userId, rows.map((row) => row.id))
  return c.json(rows.map((row) => ({ ...row, seriesId: series.get(row.id) ?? null })))
})

appointmentsRoute.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const parsed = appointmentInput.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  if (body?.recurrence) {
    const rule = recurrenceInput.safeParse(body.recurrence)
    if (!rule.success) return c.json({ error: z.prettifyError(rule.error) }, 400)
    if (occurrences(new Date(parsed.data.startsAt), rule.data).length === 0)
      return c.json({ error: 'Mit dieser Wiederholung entsteht kein einziger Termin.' }, 400)
    const result = await createSeries(
      c.get('userId'),
      { ...parsed.data, description: parsed.data.description, location: parsed.data.location },
      rule.data,
    )
    const [first] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, result.firstId), eq(appointments.userId, c.get('userId'))))
    return c.json({ ...first, seriesId: result.seriesId, created: result.created }, 201)
  }

  const { startsAt, endsAt, ...rest } = parsed.data
  const [row] = await db
    .insert(appointments)
    .values({
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      userId: c.get('userId'),
    })
    .returning()
  return c.json(row, 201)
})

/** Regel einer Serie – der Bearbeiten-Dialog zeigt sie an. */
appointmentsRoute.get('/:id/series', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: 'Ungültige Kennung' }, 400)
  const series = await seriesForAppointment(c.get('userId'), parsed.data)
  if (!series) return c.json({ error: 'Dieser Termin gehört zu keiner Serie' }, 404)
  return c.json(series)
})

appointmentsRoute.put('/:id', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const parsed = appointmentInput.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }
  const userId = c.get('userId')

  if (scopeOf(c) === 'series') {
    const id = z.uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'Ungültige Kennung' }, 400)
    const [current] = await db
      .select({ startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.id, id.data), eq(appointments.userId, userId)))
    if (!current) return c.json({ error: 'Termin nicht gefunden' }, 404)
    const series = await seriesForAppointment(userId, id.data)
    if (!series) return c.json({ error: 'Dieser Termin gehört zu keiner Serie' }, 404)

    const rule = recurrenceInput.safeParse(body?.recurrence ?? series.rule)
    if (!rule.success) return c.json({ error: z.prettifyError(rule.error) }, 400)
    if (occurrences(new Date(parsed.data.startsAt), rule.data).length === 0)
      return c.json({ error: 'Mit dieser Wiederholung entsteht kein einziger Termin.' }, 400)

    const result = await updateSeriesFrom(
      userId,
      series.seriesId,
      current.startsAt.toISOString(),
      parsed.data,
      rule.data,
    )
    const [first] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, result.firstId), eq(appointments.userId, userId)))
    return c.json({ ...first, seriesId: result.seriesId, created: result.created })
  }

  const { startsAt, endsAt, ...rest } = parsed.data
  const [row] = await db
    .update(appointments)
    .set({
      ...rest,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.id, c.req.param('id')),
        eq(appointments.userId, c.get('userId')),
      ),
    )
    .returning()
  if (!row) return c.json({ error: 'Termin nicht gefunden' }, 404)
  return c.json(row)
})

appointmentsRoute.delete('/:id', async (c) => {
  if (scopeOf(c) === 'series') {
    const id = z.uuid().safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'Ungültige Kennung' }, 400)
    const userId = c.get('userId')
    const [current] = await db
      .select({ startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.id, id.data), eq(appointments.userId, userId)))
    if (!current) return c.json({ error: 'Termin nicht gefunden' }, 404)
    const series = await seriesForAppointment(userId, id.data)
    if (!series) return c.json({ error: 'Dieser Termin gehört zu keiner Serie' }, 404)
    const removed = await deleteSeriesFrom(userId, series.seriesId, current.startsAt.toISOString())
    return c.json({ ok: true, removed })
  }

  const [row] = await db
    .delete(appointments)
    .where(
      and(
        eq(appointments.id, c.req.param('id')),
        eq(appointments.userId, c.get('userId')),
      ),
    )
    .returning({ id: appointments.id })
  if (!row) return c.json({ error: 'Termin nicht gefunden' }, 404)
  return c.json({ ok: true })
})
