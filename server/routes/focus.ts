import { Hono } from 'hono'
import { z } from 'zod'
import { FOCUS_KINDS, FOCUS_MAX_SECONDS, FOCUS_MIN_SECONDS } from '../../src/lib/focus'
import { deleteFocusSession, focusForTarget, focusSummary, recordFocusSession } from '../focus-storage'

const sessionInput = z.object({
  id: z.uuid('Ungültige Kennung'),
  startedAt: z.iso.datetime({ offset: true }),
  seconds: z.number().int().min(FOCUS_MIN_SECONDS).max(FOCUS_MAX_SECONDS),
  target: z
    .object({ kind: z.enum(FOCUS_KINDS), id: z.uuid('Ungültige Kennung') })
    .nullable()
    .default(null),
})

export const focusRoute = new Hono()

/** Auswertung der letzten Tage; der Zeitraum ist auf ein Jahr begrenzt. */
focusRoute.get('/summary', async (c) => {
  const days = z.coerce.number().int().min(1).max(365).catch(7).parse(c.req.query('days'))
  return c.json(await focusSummary(c.get('userId'), days))
})

/** Gesamtzeit an einem Ziel – zeigt die Aufgaben- und Projektansicht an. */
focusRoute.get('/for/:kind/:id', async (c) => {
  const parsed = z
    .object({ kind: z.enum(FOCUS_KINDS), id: z.uuid() })
    .safeParse({ kind: c.req.param('kind'), id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)
  return c.json(await focusForTarget(c.get('userId'), parsed.data.kind, parsed.data.id))
})

focusRoute.post('/', async (c) => {
  const parsed = sessionInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)
  // Eine Zukunftszeit wäre entweder eine falsch gestellte Uhr oder ein Versuch,
  // die Auswertung zu verbiegen; beides gehört nicht in die Statistik.
  if (Date.parse(parsed.data.startedAt) > Date.now() + 60_000)
    return c.json({ error: 'Der Startzeitpunkt liegt in der Zukunft.' }, 400)

  const result = await recordFocusSession(c.get('userId'), parsed.data)
  if (result === 'unknown-target') return c.json({ error: 'Das Ziel wurde nicht gefunden.' }, 404)
  return c.json({ ok: true }, result === 'created' ? 201 : 200)
})

focusRoute.delete('/:id', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: 'Ungültige Kennung' }, 400)
  if (!(await deleteFocusSession(c.get('userId'), parsed.data)))
    return c.json({ error: 'Fokuszeit nicht gefunden' }, 404)
  return c.json({ ok: true })
})
