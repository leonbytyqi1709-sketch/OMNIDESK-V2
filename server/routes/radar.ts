import { Hono } from 'hono'
import { z } from 'zod'
import { RadarError, radarTopicInput, radarSourceInput } from '../radar-policy'
import {
  initializeRadar,
  readRadar,
  saveRadarTopic,
  createRadarSource,
  changeRadarSource,
  deleteRadarRecord,
  markRadarItem,
  markRadarGroup,
} from '../radar-storage'
import { refreshRadar } from '../radar-runner'
import { saveRadarMemory, explainRadarItem } from '../radar-actions'
export function createRadarRoute(
  deps = {
    initializeRadar,
    readRadar,
    saveRadarTopic,
    createRadarSource,
    changeRadarSource,
    deleteRadarRecord,
    markRadarItem,
    markRadarGroup,
    refreshRadar,
    saveRadarMemory,
    explainRadarItem,
  },
) {
  const route = new Hono()
  route.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof RadarError
            ? error.message
            : 'Internet-Radar gerade nicht verfügbar. Speicherung und Quellen prüfen.',
      },
      error instanceof RadarError ? error.status : 503,
    ),
  )
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.get('/', async (c) =>
    c.json(
      await deps.readRadar(c.get('userId'), c.req.query('view') === 'saved'),
    ),
  )
  route.post('/topics', async (c) => {
    const p = radarTopicInput.safeParse(await c.req.json().catch(() => null))
    if (!p.success)
      return c.json(
        {
          error:
            'Thema benötigt Name, 1–12 Suchbegriffe und gültige Zuordnung.',
        },
        400,
      )
    await deps.initializeRadar()
    return c.json(await deps.saveRadarTopic(c.get('userId'), p.data), 201)
  })
  route.put('/topics/:id', async (c) => {
    const p = radarTopicInput
      .extend({ version: z.number().int().positive() })
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success || !z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültiges Thema oder Version.' }, 400)
    const { version, ...input } = p.data
    return c.json(
      await deps.saveRadarTopic(
        c.get('userId'),
        input,
        c.req.param('id'),
        version,
      ),
    )
  })
  route.post('/sources', async (c) => {
    const p = radarSourceInput.safeParse(await c.req.json().catch(() => null))
    if (!p.success)
      return c.json(
        {
          error:
            'Eigene Themenzuordnung und öffentliche HTTPS-Feed-Adresse erforderlich.',
        },
        400,
      )
    await deps.initializeRadar()
    return c.json(await deps.createRadarSource(c.get('userId'), p.data), 201)
  })
  route.put('/sources/:id', async (c) => {
    const p = z
      .object({ version: z.number().int().positive(), enabled: z.boolean() })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success || !z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Quellenänderung.' }, 400)
    return c.json(
      await deps.changeRadarSource(
        c.get('userId'),
        c.req.param('id'),
        p.data.version,
        p.data.enabled,
      ),
    )
  })
  for (const [kind, path] of [
    ['topic', 'topics'],
    ['source', 'sources'],
  ] as const)
    route.delete(`/${path}/:id`, async (c) => {
      const p = z
        .object({ version: z.number().int().positive() })
        .strict()
        .safeParse(await c.req.json().catch(() => null))
      if (!p.success || !z.uuid().safeParse(c.req.param('id')).success)
        return c.json(
          { error: 'Version fehlt oder Kennung ist ungültig.' },
          400,
        )
      return c.json(
        await deps.deleteRadarRecord(
          c.get('userId'),
          kind,
          c.req.param('id'),
          p.data.version,
        ),
      )
    })
  route.post('/items/state', async (c) => {
    const p = z
      .object({
        ids: z.array(z.uuid()).min(1).max(20),
        read: z.boolean().optional(),
        saved: z.boolean().optional(),
        projectId: z.uuid().nullable().optional(),
        projectOverride: z.boolean().optional(),
      })
      .strict()
      .refine(
        (v) =>
          (v.read !== undefined ||
            v.saved !== undefined ||
            v.projectOverride !== undefined) &&
          ((v.projectOverride === undefined && v.projectId === undefined) ||
            (v.projectOverride !== undefined &&
              v.projectId !== undefined &&
              (v.projectOverride || v.projectId === null))),
      )
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success) return c.json({ error: 'Ungültige Fundgruppe.' }, 400)
    const { ids, ...input } = p.data
    return c.json(await deps.markRadarGroup(c.get('userId'), ids, input))
  })
  route.put('/items/:id', async (c) => {
    const p = z
      .object({ read: z.boolean().optional(), saved: z.boolean().optional() })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success || !z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Fundänderung.' }, 400)
    return c.json(
      await deps.markRadarItem(c.get('userId'), c.req.param('id'), p.data),
    )
  })
  route.post('/refresh', async (c) => {
    const p = z
      .object({ sourceIds: z.array(z.uuid()).min(1).max(3) })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!p.success)
      return c.json({ error: 'Maximal drei Quellen pro Abruf.' }, 400)
    return c.json(
      await deps.refreshRadar(c.get('userId'), [...new Set(p.data.sourceIds)]),
    )
  })
  for (const action of ['memory', 'explain'] as const)
    route.post(`/items/:id/${action}`, async (c) => {
      if (
        !z.uuid().safeParse(c.req.param('id')).success ||
        !z
          .object({})
          .strict()
          .safeParse(await c.req.json().catch(() => null)).success
      )
        return c.json({ error: 'Ungültiger Fundauftrag.' }, 400)
      return c.json(
        await (
          action === 'memory' ? deps.saveRadarMemory : deps.explainRadarItem
        )(c.get('userId'), c.req.param('id')),
      )
    })
  return route
}
export const radarRoute = createRadarRoute()
