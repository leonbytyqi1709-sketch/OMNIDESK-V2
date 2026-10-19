import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { projects, uptimeMonitors } from '../../src/db/schema'
import { NeonConfigurationError, readNeonLinks } from '../neon-monitor'
import type { NeonLink } from '../neon-monitor'
import { neonSettingsSchema } from '../neon-policy'
import { isNeonSqlConfigured } from '../neon-sql'
import { initializeNeonStorage, saveNeonSettings, readNeonMonitoring, acknowledgeNeonAlert, missingNeonStorage } from '../neon-storage'
import { runNeonCheck } from '../neon-runner'
async function ownsProject(link: NeonLink) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, link.projectId), eq(projects.userId, link.userId)))
  return Boolean(row)
}
async function ownsMonitors(link: NeonLink, ids: string[]) {
  if (!ids.length) return true
  const rows = await db.select({ id: uptimeMonitors.id }).from(uptimeMonitors).where(and(eq(uptimeMonitors.userId, link.userId), inArray(uptimeMonitors.id, ids)))
  return rows.length === ids.length
}
export function createNeonHistoryRoute(dependencies = { ownsProject, ownsMonitors, initializeNeonStorage, saveNeonSettings, readNeonMonitoring, acknowledgeNeonAlert, runNeonCheck }) {
  const route = new Hono<{ Variables: { userId: string; neonLink: NeonLink } }>()
  route.onError(() => new Response(JSON.stringify({ error: 'Neon-Monitoring-Speicher nicht verfügbar. Datenbankrechte und Einrichtung prüfen.' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }))
  route.use('/:projectId/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    try {
      const link = readNeonLinks().find((candidate) => candidate.userId === c.get('userId') && candidate.projectId === c.req.param('projectId'))
      if (!link || !(await dependencies.ownsProject(link))) return c.json({ error: 'Keine eigene Neon-Projektzuordnung vorhanden.' }, 404)
      c.set('neonLink', link)
      await next()
    } catch (error) {
      return c.json({ error: error instanceof NeonConfigurationError ? error.message : 'Neon-Monitoring-Speicher nicht verfügbar. Datenbank und Einrichtung prüfen.' }, 503)
    }
  })
  route.get('/:projectId/monitoring', async (c) => {
    const days = Number(c.req.query('days') ?? 1)
    if (![1, 7, 30, 90].includes(days)) return c.json({ error: 'Ungültiger Zeitraum.' }, 400)
    return c.json(await dependencies.readNeonMonitoring(c.get('neonLink'), days))
  })
  route.put('/:projectId/monitoring/settings', async (c) => {
    const parsed = neonSettingsSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Monitoring-Einstellungen. Intervalle, Grenzen und Monitorzuordnung prüfen.' }, 400)
    const link = c.get('neonLink')
    if (!(await dependencies.ownsMonitors(link, parsed.data.monitorIds))) return c.json({ error: 'Mindestens ein Monitor gehört nicht zu deinem Konto.' }, 403)
    if (parsed.data.sqlEnabled && !isNeonSqlConfigured(link)) return c.json({ error: 'Vor Aktivierung des SQL-Tests NEON_SQL_TARGETS und die zugehörige geheime Verbindungsvariable einrichten.' }, 400)
    await dependencies.initializeNeonStorage()
    await dependencies.saveNeonSettings(link, parsed.data)
    return c.json({ ok: true })
  })
  route.post('/:projectId/monitoring/check', async (c) => {
    try { return c.json(await dependencies.runNeonCheck(c.get('neonLink'), 'manual')) }
    catch (error) {
      return c.json({ error: missingNeonStorage(error) ? 'Monitoring zuerst über Einstellungen speichern einrichten.' : 'Prüfung konnte nicht gespeichert werden. Bitte erneut versuchen.' }, 503)
    }
  })
  route.post('/:projectId/monitoring/alerts/:alertId/acknowledge', async (c) => {
    if (!z.uuid().safeParse(c.req.param('alertId')).success) return c.json({ error: 'Ungültige Warnungskennung.' }, 400)
    if (!(await dependencies.acknowledgeNeonAlert(c.get('neonLink'), c.req.param('alertId')))) return c.json({ error: 'Warnung nicht gefunden.' }, 404)
    return c.json({ ok: true })
  })
  return route
}
export const neonHistoryRoute = createNeonHistoryRoute()
