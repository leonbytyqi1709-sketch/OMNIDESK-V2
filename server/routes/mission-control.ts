import { Hono } from 'hono'
import { z } from 'zod'
import { loadMission, readMissionProject } from '../mission-control'
import { generateMissionReport } from '../mission-report'
import {
  MissionStorageError,
  claimMissionAI,
  recordMissionVisit,
  readMissionMonitorOptions,
  saveMissionMonitors,
} from '../mission-storage'
const visitInput = z.object({ visitId: z.uuid() }).strict()
const monitorInput = z
  .object({
    monitorIds: z
      .array(z.uuid())
      .max(30)
      .refine((v) => new Set(v).size === v.length),
    version: z.number().int().min(0),
  })
  .strict()
export const missionRouteDependencies = {
  loadMission,
  generateMissionReport,
  readMissionProject,
  claimMissionAI,
  recordMissionVisit,
  readMissionMonitorOptions,
  saveMissionMonitors,
}
export function createMissionRoute(deps = missionRouteDependencies) {
  const route = new Hono()
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof MissionStorageError
            ? error.message
            : 'Projektlage konnte nicht geladen werden. Datenbank und Projektzugriff prüfen.',
      },
      error instanceof MissionStorageError ? error.status : 503,
    ),
  )
  route.use('/:projectId/*', async (c, next) => {
    const id = c.req.param('projectId')
    if (!z.uuid().safeParse(id).success)
      return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    await next()
  })
  route.get('/:projectId', async (c) => {
    const snapshot = await deps.loadMission(
      c.get('userId'),
      c.req.param('projectId'),
    )
    if (!snapshot)
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json(snapshot)
  })
  route.post('/:projectId/visit', async (c) => {
    const input = visitInput.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Ungültige Besuchskennung.' }, 400)
    const userId = c.get('userId'),
      id = c.req.param('projectId')
    const snapshot = await deps.loadMission(userId, id)
    if (!snapshot)
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    try {
      snapshot.comparison = await deps.recordMissionVisit(
        userId,
        id,
        input.data.visitId,
        snapshot,
      )
    } catch (error) {
      if (error instanceof MissionStorageError) throw error
      snapshot.comparison = {
        status: 'unavailable',
        previousAt: null,
        changes: [],
        totalChanges: 0,
      }
    }
    return c.json(snapshot)
  })
  route.get('/:projectId/monitors', async (c) => {
    const userId = c.get('userId'),
      id = c.req.param('projectId')
    if (!(await deps.readMissionProject(userId, id)))
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json(await deps.readMissionMonitorOptions(userId, id))
  })
  route.put('/:projectId/monitors', async (c) => {
    const parsed = monitorInput.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success)
      return c.json(
        { error: 'Ungültige Monitorzuordnung oder Versionsnummer.' },
        400,
      )
    const userId = c.get('userId'),
      id = c.req.param('projectId')
    if (!(await deps.readMissionProject(userId, id)))
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json(
      await deps.saveMissionMonitors(
        userId,
        id,
        parsed.data.monitorIds,
        parsed.data.version,
      ),
    )
  })
  route.post('/:projectId/report', async (c) => {
    const id = c.req.param('projectId'),
      userId = c.get('userId')
    if (!(await deps.readMissionProject(userId, id)))
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    if (!(await deps.claimMissionAI(userId)))
      return c.json(
        {
          error: 'Bitte eine Minute bis zur nächsten KI-Priorisierung warten.',
        },
        429,
      )
    const snapshot = await deps.loadMission(userId, id)
    if (!snapshot)
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json({
      snapshot,
      report: await deps.generateMissionReport(snapshot),
    })
  })
  return route
}
export const missionRoute = createMissionRoute()
