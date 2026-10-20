import { Hono } from 'hono'
import { z } from 'zod'
import { loadMission } from '../mission-control'
import { generateMissionReport } from '../mission-report'

export function createMissionRoute(
  deps = { loadMission, generateMissionReport },
) {
  const route = new Hono()
  const attempts = new Map<string, number>()
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.onError((_error, c) =>
    c.json(
      {
        error:
          'Projektlage konnte nicht geladen werden. Datenbank und Projektzugriff prüfen.',
      },
      503,
    ),
  )
  route.get('/:projectId', async (c) => {
    const id = c.req.param('projectId')
    if (!z.uuid().safeParse(id).success)
      return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    const snapshot = await deps.loadMission(c.get('userId'), id)
    if (!snapshot)
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json(snapshot)
  })
  route.post('/:projectId/report', async (c) => {
    const id = c.req.param('projectId'),
      userId = c.get('userId')
    if (!z.uuid().safeParse(id).success)
      return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    const now = Date.now()
    for (const [key, at] of attempts)
      if (now - at >= 60_000) attempts.delete(key)
    if (attempts.has(userId))
      return c.json(
        {
          error: 'Bitte eine Minute bis zur nächsten KI-Priorisierung warten.',
        },
        429,
      )
    // Never accept facts, project mappings, user IDs or actions from the browser.
    const snapshot = await deps.loadMission(userId, id)
    if (!snapshot)
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    if (attempts.has(userId))
      return c.json({ error: 'Eine Priorisierung läuft bereits.' }, 429)
    attempts.set(userId, now)
    return c.json({
      snapshot,
      report: await deps.generateMissionReport(snapshot),
    })
  })
  return route
}
export const missionRoute = createMissionRoute()
