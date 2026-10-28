import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import {
  MONITOR_TYPES,
  uptimeChecks,
  uptimeMonitors,
} from '../../src/db/schema/index'
import { checkSingleMonitor, refreshAllMonitors } from '../uptime-check'

const monitorInput = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(100),
  type: z.enum(MONITOR_TYPES).default('http'),
  url: z.string().trim().min(1, 'URL oder Host ist erforderlich').max(500),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  active: z.boolean().default(true),
})

export const uptimeRoute = new Hono()

/**
 * GET /api/uptime - Alle Monitore mit letztem Check, 30-Tage-Uptime und Historie.
 * Führt automatischen TTL-Refresh durch, wenn der letzte Check > 5 Min alt ist.
 */
uptimeRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const monitors = await db
    .select()
    .from(uptimeMonitors)
    .where(eq(uptimeMonitors.userId, userId))
    .orderBy(desc(uptimeMonitors.createdAt))

  if (monitors.length === 0) {
    return c.json([])
  }

  // Prüfe, ob Monitore einen Refresh benötigen (> 5 Min seit letztem Check)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Nur die Messungen der EIGENEN Monitore laden. Ohne diese Einschränkung
  // las die Übersicht sämtliche Messungen aller Monitore der Datenbank und
  // verwarf den Großteil anschließend wieder.
  const monitorIds = monitors.map((m) => m.id)
  const loadChecks = () =>
    db
      .select()
      .from(uptimeChecks)
      .where(
        and(
          inArray(uptimeChecks.monitorId, monitorIds),
          gte(uptimeChecks.checkedAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(uptimeChecks.checkedAt))

  const allChecks = await loadChecks()

  // Gruppiere Checks nach Monitor-ID
  const checksByMonitor = new Map<string, typeof allChecks>()
  for (const chk of allChecks) {
    const list = checksByMonitor.get(chk.monitorId) || []
    list.push(chk)
    checksByMonitor.set(chk.monitorId, list)
  }

  // Prüfe, ob aktive Monitore einen Refresh brauchen
  let needRefresh = false
  for (const m of monitors) {
    if (!m.active) continue
    const mChecks = checksByMonitor.get(m.id)
    if (!mChecks || mChecks.length === 0) {
      needRefresh = true
      break
    }
    const latest = mChecks[0]
    if (new Date(latest.checkedAt) < fiveMinutesAgo) {
      needRefresh = true
      break
    }
  }

  if (needRefresh) {
    await refreshAllMonitors(userId)
    // Lade Checks neu nach Refresh
    const refreshedChecks = await loadChecks()

    checksByMonitor.clear()
    for (const chk of refreshedChecks) {
      const list = checksByMonitor.get(chk.monitorId) || []
      list.push(chk)
      checksByMonitor.set(chk.monitorId, list)
    }
  }

  // Berechne aggregierte Metriken für jeden Monitor
  const result = monitors.map((monitor) => {
    const mChecks = checksByMonitor.get(monitor.id) || []
    const lastCheck = mChecks[0] || null

    const totalChecks = mChecks.length
    const upChecks = mChecks.filter((c) => c.status === 'up').length
    const uptime30d =
      totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(1)) : 100

    // 30 Tages-Buckets für den Uptime-Balken (von vor 29 Tagen bis heute)
    const dailyBuckets: { date: string; up: number; total: number; pct: number }[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)

      const dayChecks = mChecks.filter(
        (c) => new Date(c.checkedAt).toISOString().slice(0, 10) === dateStr,
      )
      const dTotal = dayChecks.length
      const dUp = dayChecks.filter((c) => c.status === 'up').length
      const dPct = dTotal > 0 ? Math.round((dUp / dTotal) * 100) : 100
      dailyBuckets.push({
        date: dateStr,
        up: dUp,
        total: dTotal,
        pct: dPct,
      })
    }

    return {
      ...monitor,
      lastCheck,
      uptime30d,
      daily30d: dailyBuckets,
      totalChecks,
    }
  })

  return c.json(result)
})

/**
 * POST /api/uptime - Neuen Monitor anlegen und direkt ersten Check ausführen.
 */
uptimeRoute.post('/', async (c) => {
  const userId = c.get('userId')
  const parsed = monitorInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const [row] = await db
    .insert(uptimeMonitors)
    .values({
      ...parsed.data,
      userId,
    })
    .returning()

  // Führe sofort den ersten Check aus
  try {
    await checkSingleMonitor(row)
  } catch (err) {
    console.error('Initial uptime check failed:', err)
  }

  return c.json(row, 201)
})

/**
 * PUT /api/uptime/:id - Monitor bearbeiten.
 */
uptimeRoute.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const parsed = monitorInput.partial().safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const [existing] = await db
    .select()
    .from(uptimeMonitors)
    .where(and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, userId)))

  if (!existing) {
    return c.json({ error: 'Monitor nicht gefunden' }, 404)
  }

  const [updated] = await db
    .update(uptimeMonitors)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, userId)))
    .returning()

  return c.json(updated)
})

/**
 * DELETE /api/uptime/:id - Monitor löschen (Kaskadiert Checks).
 */
uptimeRoute.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [deleted] = await db
    .delete(uptimeMonitors)
    .where(and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, userId)))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Monitor nicht gefunden' }, 404)
  }

  return c.json({ success: true })
})

/**
 * POST /api/uptime/refresh-all - Alle Monitore des Nutzers jetzt sofort prüfen.
 */
uptimeRoute.post('/refresh-all', async (c) => {
  const userId = c.get('userId')
  await refreshAllMonitors(userId)
  return c.json({ success: true })
})

/**
 * POST /api/uptime/:id/check - Einen einzelnen Monitor jetzt sofort prüfen.
 */
uptimeRoute.post('/:id/check', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [monitor] = await db
    .select()
    .from(uptimeMonitors)
    .where(and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, userId)))

  if (!monitor) {
    return c.json({ error: 'Monitor nicht gefunden' }, 404)
  }

  const check = await checkSingleMonitor(monitor)
  return c.json(check)
})

/**
 * GET /api/uptime/:id/checks - Die letzten 20 Checks eines Monitors für die Detailansicht.
 */
uptimeRoute.get('/:id/checks', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [monitor] = await db
    .select()
    .from(uptimeMonitors)
    .where(and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, userId)))

  if (!monitor) {
    return c.json({ error: 'Monitor nicht gefunden' }, 404)
  }

  const checks = await db
    .select()
    .from(uptimeChecks)
    .where(eq(uptimeChecks.monitorId, id))
    .orderBy(desc(uptimeChecks.checkedAt))
    .limit(20)

  return c.json(checks)
})
