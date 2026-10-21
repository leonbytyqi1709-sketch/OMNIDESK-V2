import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { HistoryError, historyKind } from '../history-policy'
import * as storage from '../mission-records-storage'
export function createMissionRecordsRoute() {
  const route = new Hono()
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.use(
    '*',
    bodyLimit({
      maxSize: 200000,
      onError: (c) => c.json({ error: 'Anfrage zu groß.' }, 413),
    }),
  )
  route.onError((e, c) =>
    c.json(
      {
        error:
          e instanceof HistoryError
            ? e.message
            : 'Arbeitsstand konnte nicht verarbeitet werden. Verbindung und Speichereinrichtung prüfen.',
      },
      e instanceof HistoryError ? e.status : 503,
    ),
  )
  route.get('/projects', async (c) =>
    c.json(await storage.missionRecordProjects(c.get('userId'))),
  )
  route.get('/sources', async (c) => {
    const kind = historyKind.safeParse(c.req.query('kind')),
      search = c.req.query('search') ?? ''
    if (!kind.success || search.length > 200)
      return c.json({ error: 'Quellenfilter prüfen.' }, 400)
    return c.json(
      await storage.missionReferenceChoices(c.get('userId'), kind.data, search),
    )
  })
  route.get('/', async (c) => {
    const state = c.req.query('state') ?? null,
      search = c.req.query('search') ?? ''
    if (
      (state && !['active', 'paused', 'archived'].includes(state)) ||
      search.length > 200
    )
      return c.json({ error: 'Filter prüfen.' }, 400)
    return c.json(
      await storage.listMissionRecords(c.get('userId'), state, search),
    )
  })
  route.post('/', async (c) => {
    const input = z
      .object({ id: z.uuid(), data: storage.missionRecordInput })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json(
        {
          error:
            'Titel, Quellen und Texte prüfen. Für das Archiv ist ein Ergebnis erforderlich.',
        },
        400,
      )
    return c.json(
      await storage.writeMissionRecord(
        c.get('userId'),
        input.data.id,
        input.data.data,
        null,
      ),
      201,
    )
  })
  route.use('/:id/*', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Kennung.' }, 400)
    await next()
  })
  route.get('/:id', async (c) =>
    c.json(await storage.readMissionRecord(c.get('userId'), c.req.param('id'))),
  )
  route.put('/:id', async (c) => {
    const input = z
      .object({
        version: z.number().int().positive(),
        data: storage.missionRecordInput,
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json(
        {
          error:
            'Versionsstand, Texte und Quellen prüfen. Für das Archiv ist ein Ergebnis erforderlich.',
        },
        400,
      )
    return c.json(
      await storage.writeMissionRecord(
        c.get('userId'),
        c.req.param('id'),
        input.data.data,
        input.data.version,
      ),
    )
  })
  route.delete('/:id', async (c) => {
    const input = z
      .object({ version: z.number().int().positive() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Versionsstand fehlt.' }, 400)
    await storage.deleteMissionRecord(
      c.get('userId'),
      c.req.param('id'),
      input.data.version,
    )
    return c.json({ ok: true })
  })
  return route
}
export const missionRecordsRoute = createMissionRecordsRoute()
