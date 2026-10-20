import { Hono } from 'hono'
import { z } from 'zod'
import {
  applyAutoMemoryEvent,
  dismissAutoMemoryEvent,
} from '../omni-memory-auto-storage'
import { OmniMemoryError } from '../omni-memory-policy'
export function createAutoMemoryRoute(
  dependencies = { applyAutoMemoryEvent, dismissAutoMemoryEvent },
) {
  const route = new Hono()
  route.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof OmniMemoryError
            ? error.message
            : 'Automatisches Gedächtnis gerade nicht verfügbar.',
      },
      error instanceof OmniMemoryError ? error.status : 503,
    ),
  )
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  for (const action of ['accept', 'dismiss'] as const)
    route.post(`/:id/${action}`, async (c) => {
      const id = c.req.param('id')
      if (
        !z.uuid().safeParse(id).success ||
        !z
          .object({})
          .strict()
          .safeParse(await c.req.json().catch(() => null)).success
      )
        return c.json({ error: 'Ungültiger Gedächtnisvorschlag.' }, 400)
      return c.json(
        await (
          action === 'accept'
            ? dependencies.applyAutoMemoryEvent
            : dependencies.dismissAutoMemoryEvent
        )(c.get('userId'), id),
      )
    })
  return route
}
export const autoMemoryRoute = createAutoMemoryRoute()
