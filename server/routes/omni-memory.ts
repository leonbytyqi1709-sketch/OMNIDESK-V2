import { Hono } from 'hono'
import { z } from 'zod'
import {
  createMemorySchema,
  updateMemorySchema,
  OmniMemoryError,
} from '../omni-memory-policy'
import {
  readOmniMemories,
  createOmniMemory,
  updateOmniMemory,
  deleteOmniMemory,
  readMemoryVersions,
} from '../omni-memory-storage'
export function createOmniMemoryRoute(
  dependencies = {
    readOmniMemories,
    createOmniMemory,
    updateOmniMemory,
    deleteOmniMemory,
    readMemoryVersions,
  },
) {
  const route = new Hono()
  route.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof OmniMemoryError
            ? error.message
            : 'Omnis Gedächtnis ist gerade nicht verfügbar. Datenbank und Einrichtung prüfen.',
      },
      error instanceof OmniMemoryError ? error.status : 503,
    ),
  )
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.get('/', async (c) =>
    c.json(await dependencies.readOmniMemories(c.get('userId'))),
  )
  route.post('/', async (c) => {
    const parsed = createMemorySchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success)
      return c.json(
        { error: 'Titel, Inhalt oder Gedächtnis-Einstellungen sind ungültig.' },
        400,
      )
    return c.json(
      await dependencies.createOmniMemory(c.get('userId'), parsed.data),
      201,
    )
  })
  route.use('/:id/*', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Erinnerung.' }, 400)
    await next()
  })
  route.get('/:id/versions', async (c) =>
    c.json(
      await dependencies.readMemoryVersions(c.get('userId'), c.req.param('id')),
    ),
  )
  route.put('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Erinnerung.' }, 400)
    const parsed = updateMemorySchema.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!parsed.success)
      return c.json({ error: 'Ungültige Felder oder Version.' }, 400)
    return c.json(
      await dependencies.updateOmniMemory(
        c.get('userId'),
        c.req.param('id'),
        parsed.data,
      ),
    )
  })
  route.delete('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Erinnerung.' }, 400)
    const parsed = z
      .object({ version: z.number().int().positive() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Version fehlt.' }, 400)
    return c.json(
      await dependencies.deleteOmniMemory(
        c.get('userId'),
        c.req.param('id'),
        parsed.data.version,
      ),
    )
  })
  return route
}
export const omniMemoryRoute = createOmniMemoryRoute()
