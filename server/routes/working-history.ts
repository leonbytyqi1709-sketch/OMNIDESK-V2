import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import {
  HistoryError,
  historyKind,
  historyPreferences,
  historyRestore,
} from '../history-policy'
import * as storage from '../history-storage'
export const historyDependencies = {
  readHistorySettings: storage.readHistorySettings,
  saveHistorySettings: storage.saveHistorySettings,
  clearWorkingHistory: storage.clearWorkingHistory,
  historyTimeline: storage.historyTimeline,
  historyDetail: storage.historyDetail,
  compareHistory: storage.compareHistory,
  restoreHistory: storage.restoreHistory,
}
export function createHistoryRoute(deps = historyDependencies) {
  const route = new Hono()
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.use(
    '*',
    bodyLimit({
      maxSize: 8000,
      onError: (c) => c.json({ error: 'Anfrage ist zu groß.' }, 413),
    }),
  )
  route.onError((e, c) =>
    c.json(
      {
        error:
          e instanceof HistoryError
            ? e.message
            : 'Arbeitsverlauf gerade nicht verfügbar. Verbindung und Speichereinrichtung prüfen.',
      },
      e instanceof HistoryError ? e.status : 503,
    ),
  )
  route.get('/settings', async (c) =>
    c.json(await deps.readHistorySettings(c.get('userId'))),
  )
  route.put('/settings', async (c) => {
    const input = historyPreferences.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json({ error: 'Ungültige Verlaufseinstellungen.' }, 400)
    return c.json(await deps.saveHistorySettings(c.get('userId'), input.data))
  })
  route.delete('/', async (c) => {
    const input = z
      .object({ confirm: z.literal('Verlauf löschen') })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Löschen bitte ausdrücklich bestätigen.' }, 400)
    await deps.clearWorkingHistory(c.get('userId'))
    return c.json({ ok: true })
  })
  route.get('/', async (c) => {
    const kind = c.req.query('kind'),
      search = c.req.query('search') ?? ''
    if ((kind && !historyKind.safeParse(kind).success) || search.length > 200)
      return c.json({ error: 'Ungültiger Filter.' }, 400)
    return c.json(
      await deps.historyTimeline(
        c.get('userId'),
        kind ? historyKind.parse(kind) : null,
        search,
      ),
    )
  })
  route.use('/:kind/:id/*', async (c, next) => {
    if (
      !historyKind.safeParse(c.req.param('kind')).success ||
      !z.uuid().safeParse(c.req.param('id')).success
    )
      return c.json({ error: 'Ungültige Quelle.' }, 400)
    await next()
  })
  route.get('/:kind/:id', async (c) =>
    c.json(
      await deps.historyDetail(
        c.get('userId'),
        historyKind.parse(c.req.param('kind')),
        c.req.param('id'),
      ),
    ),
  )
  route.get('/:kind/:id/versions/:versionId', async (c) => {
    if (!z.uuid().safeParse(c.req.param('versionId')).success)
      return c.json({ error: 'Ungültige Version.' }, 400)
    return c.json(
      await deps.compareHistory(
        c.get('userId'),
        historyKind.parse(c.req.param('kind')),
        c.req.param('id'),
        c.req.param('versionId'),
      ),
    )
  })
  route.post('/:kind/:id/restore', async (c) => {
    const input = historyRestore.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json(
        { error: 'Version, Vergleichsstand und Feldauswahl prüfen.' },
        400,
      )
    return c.json(
      await deps.restoreHistory(
        c.get('userId'),
        historyKind.parse(c.req.param('kind')),
        c.req.param('id'),
        input.data.versionId,
        input.data.expectedFingerprint,
        input.data.fields,
      ),
    )
  })
  return route
}
export const workingHistoryRoute = createHistoryRoute()
