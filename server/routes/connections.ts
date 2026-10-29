import { Hono } from 'hono'
import { z } from 'zod'
import { CONNECTION_KINDS, sameEnd } from '../../src/lib/connections'
import {
  connect,
  disconnect,
  listConnections,
  ownsEntity,
  searchEntities,
} from '../connections-storage'

const endInput = z.object({
  kind: z.enum(CONNECTION_KINDS),
  id: z.uuid('Ungültige Kennung'),
})

const connectInput = z
  .object({ source: endInput, target: endInput })
  .refine((value) => !sameEnd(value.source, value.target), {
    message: 'Ein Objekt lässt sich nicht mit sich selbst verknüpfen.',
  })

export const connectionsRoute = new Hono()

/** Auswahlliste für den Verknüpfen-Dialog; ohne Suchbegriff die jüngsten Einträge. */
connectionsRoute.get('/search', async (c) => {
  const term = (c.req.query('q') ?? '').slice(0, 100)
  return c.json(await searchEntities(c.get('userId'), term))
})

connectionsRoute.get('/:kind/:id', async (c) => {
  const parsed = endInput.safeParse({ kind: c.req.param('kind'), id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)
  const userId = c.get('userId')
  // Ohne diese Prüfung verriete eine leere Liste nicht, ob das Objekt fremd ist
  // oder nur keine Verknüpfungen hat.
  if (!(await ownsEntity(userId, parsed.data))) return c.json({ error: 'Nicht gefunden' }, 404)
  return c.json(await listConnections(userId, parsed.data))
})

connectionsRoute.post('/', async (c) => {
  const parsed = connectInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)
  const result = await connect(c.get('userId'), parsed.data.source, parsed.data.target)
  if (!result.ok) return c.json({ error: 'Mindestens eines der Objekte wurde nicht gefunden.' }, 404)
  return c.json({ connectionId: result.connectionId }, result.created ? 201 : 200)
})

connectionsRoute.delete('/:connectionId', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('connectionId'))
  if (!parsed.success) return c.json({ error: 'Ungültige Kennung' }, 400)
  if (!(await disconnect(c.get('userId'), parsed.data)))
    return c.json({ error: 'Verknüpfung nicht gefunden' }, 404)
  return c.json({ ok: true })
})
