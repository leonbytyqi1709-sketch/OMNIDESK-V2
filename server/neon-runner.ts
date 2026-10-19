import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/client'
import { projects, uptimeMonitors } from '../src/db/schema'
import { fetchNeonSnapshot, readNeonLinks } from './neon-monitor'
import type { NeonLink } from './neon-monitor'
import type { NeonSnapshot } from '../src/types/neon-monitoring'
import { checkSingleMonitor } from './uptime-check'
import { evaluateNeonAlerts } from './neon-policy'
import { checkNeonSql } from './neon-sql'
import { claimNeonCheck, completeNeonCheck, monitoringSql, missingNeonStorage } from './neon-storage'

async function ownsProject(link: NeonLink) {
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, link.projectId), eq(projects.userId, link.userId)))
  return Boolean(project)
}
async function refreshLinkedMonitors(link: NeonLink, ids: string[]) {
  if (!ids.length) return { unavailable: false, down: false }
  const monitors = await db.select().from(uptimeMonitors).where(and(eq(uptimeMonitors.userId, link.userId), inArray(uptimeMonitors.id, ids)))
  // Existing monitors only; no URL/host can be supplied through Neon settings.
  const results = await Promise.allSettled(monitors.filter((monitor) => monitor.active).map((monitor) =>
    checkSingleMonitor({ ...monitor, timeoutMs: Math.min(monitor.timeoutMs, 8000) })))
  const unavailable = monitors.length !== ids.length || results.some((result) => result.status === 'rejected')
  return { unavailable, down: results.some((result) => result.status === 'fulfilled' && result.value.status === 'down')
    ? true : unavailable || monitors.some((monitor) => !monitor.active) ? null : false }
}
export function createNeonRunner(dependencies = { ownsProject, claimNeonCheck, fetchNeonSnapshot, checkNeonSql, completeNeonCheck, refreshLinkedMonitors }) {
  return async (link: NeonLink, source: 'manual' | 'scheduler') => {
    if (!(await dependencies.ownsProject(link))) return { outcome: 'not_owned' as const }
    const claim = await dependencies.claimNeonCheck(link, source)
    if (!claim) return { outcome: 'not_due_or_running' as const }
    const { config, token } = claim
    const checkedAt = new Date().toISOString()
    let snapshot: NeonSnapshot | null = null
    try { snapshot = await dependencies.fetchNeonSnapshot(link) } catch { /* Persist a failed measurement, never manufacture healthy zeros. */ }
    const sqlDue = config.settings.sqlEnabled && (!config.last_sql || Date.now() - Date.parse(config.last_sql.checkedAt) >= config.settings.sqlIntervalMinutes * 60_000)
    const [sqlCheck, monitorResult] = await Promise.all([
      sqlDue ? dependencies.checkNeonSql(link, snapshot) : Promise.resolve(null),
      dependencies.refreshLinkedMonitors(link, config.settings.monitorIds).catch(() => ({ unavailable: true, down: false })),
    ])
    const complete = Boolean(snapshot && !snapshot.unavailable.length)
    const failures = complete ? 0 : config.failures + 1
    const conditions = evaluateNeonAlerts(config.settings, snapshot, failures, sqlCheck ?? config.last_sql)
    if (monitorResult.unavailable) conditions.push({ code: 'monitor_check', active: true, severity: 'warning', message: 'Mindestens eine verknüpfte Monitorprüfung konnte nicht gespeichert werden.' })
    else conditions.push({ code: 'monitor_check', active: false, severity: 'warning', message: '' })
    conditions.push({ code: 'monitor_down', active: monitorResult.down ? true : monitorResult.unavailable || monitorResult.down === null ? null : false, severity: 'critical', message: 'Ein verknüpfter Website-/API-/TCP-Monitor meldet eine Störung.' })
    await dependencies.completeNeonCheck(link, token, snapshot, sqlCheck, conditions, source, checkedAt)
    return { outcome: complete ? 'recorded' as const : 'recorded_with_errors' as const }
  }
}
export const runNeonCheck = createNeonRunner()
export async function runNeonScheduler(projectId?: string) {
  const sql = monitoringSql()
  const links = readNeonLinks()
  const permitted = JSON.stringify(links)
  let rows: Array<Record<string, unknown>>
  try {
    await sql`UPDATE v2_neon_config c SET last_scheduler_at=now() FROM projects p
      WHERE p.id=c.project_id AND p.user_id=c.user_id AND (c.settings->>'enabled')::boolean
      AND (${projectId ?? null}::uuid IS NULL OR c.project_id=${projectId ?? null}::uuid)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(${permitted}::jsonb) l WHERE l->>'projectId'=c.project_id::text AND l->>'userId'=c.user_id
        AND (l->>'neonProjectId')||':'||(l->>'branchId')=c.resource_key)`
    rows = await sql`SELECT c.project_id,c.user_id,c.resource_key FROM v2_neon_config c
      JOIN projects p ON p.id=c.project_id AND p.user_id=c.user_id
      WHERE (c.settings->>'enabled')::boolean AND (${projectId ?? null}::uuid IS NULL OR c.project_id=${projectId ?? null}::uuid)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(${permitted}::jsonb) l WHERE l->>'projectId'=c.project_id::text AND l->>'userId'=c.user_id
        AND (l->>'neonProjectId')||':'||(l->>'branchId')=c.resource_key)
      AND (c.lease_until IS NULL OR c.lease_until<now())
      AND (c.last_attempt_at IS NULL OR c.last_attempt_at<now()-(c.settings->>'intervalMinutes')::int*interval '1 minute')
      ORDER BY c.last_attempt_at ASC NULLS FIRST LIMIT 4`
  } catch (error) { if (missingNeonStorage(error)) return { setupRequired: true, processed: 0, pending: false, failures: 0 }; throw error }
  const eligible = rows.slice(0, 3).flatMap((row) => {
    const link = links.find((candidate) => candidate.userId === row.user_id && candidate.projectId === row.project_id && `${candidate.neonProjectId}:${candidate.branchId}` === row.resource_key)
    return link ? [link] : []
  })
  const results = await Promise.allSettled(eligible.map((link) => runNeonCheck(link, 'scheduler')))
  // Retention applies to paused and removed mappings too. Never touches existing application data.
  await sql.transaction([
    sql`DELETE FROM v2_neon_samples s USING v2_neon_config c WHERE s.project_id=c.project_id AND s.checked_at<now()-(c.settings->>'retentionDays')::int*interval '1 day'`,
    sql`DELETE FROM v2_neon_alerts a USING v2_neon_config c WHERE a.project_id=c.project_id AND a.resolved_at IS NOT NULL AND a.resolved_at<now()-(c.settings->>'retentionDays')::int*interval '1 day'`,
  ])
  return { setupRequired: false, processed: eligible.length, pending: rows.length > 3,
    failures: results.filter((result) => result.status === 'rejected' || result.value.outcome === 'recorded_with_errors').length }
}
