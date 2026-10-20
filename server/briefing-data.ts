import { createHash } from 'node:crypto'
import { monitoringSql } from './neon-storage'
import { readNeonLinks } from './neon-monitor'
import { readSecurityOverview } from './account-security-store'
import { summarizeSecurity } from '../src/lib/account-security'
import { addBriefingDays, briefingDay, briefingDayStart, DEFAULT_BRIEFING_PREFERENCES } from '../src/lib/briefing'
import { previousBriefingVisit, readBriefingState } from './briefing-storage'
import type { BriefingItem, BriefingReason, BriefingSection, BriefingSnapshot, BriefingSource } from '../src/types/briefing'
const iso = (value: unknown) => value ? new Date(value as string | Date).toISOString() : null
const number = (value: unknown) => Number(value ?? 0)
const item = (id: string, title: unknown, href: string, kind: string, state: string, at: unknown, reasons: BriefingReason[]): BriefingItem => ({ id, title: String(title).slice(0, 500), href, kind, state, at: iso(at), reasons })
const partial = (source: BriefingSource, status: BriefingSection['status']): BriefingSection => ({ source, status, counts: {}, items: [], changes: null })
export interface BriefingDataContext { userId: string; now: Date; day: string; timeZone: string; previousVisitAt: string | null }
export async function loadBriefingTasks(ctx: BriefingDataContext): Promise<BriefingSection> {
  const sql = monitoringSql(), { userId, timeZone, day, previousVisitAt: since } = ctx
  const [totals, rows] = await sql.transaction([
    sql`SELECT count(*) FILTER(WHERE status<>'done')::int AS open,
      count(*) FILTER(WHERE status<>'done' AND (due_date AT TIME ZONE ${timeZone})::date<${day}::date)::int AS overdue,
      count(*) FILTER(WHERE status<>'done' AND (due_date AT TIME ZONE ${timeZone})::date=${day}::date)::int AS today,
      CASE WHEN ${since}::timestamptz IS NULL THEN NULL ELSE count(*) FILTER(WHERE updated_at>${since}::timestamptz)::int END AS changes
      FROM tasks WHERE user_id=${userId}`,
    sql`SELECT id,title,status,priority,due_date FROM tasks WHERE user_id=${userId} AND status<>'done'
      ORDER BY due_date ASC NULLS LAST,CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,id LIMIT 12`,
  ], { isolationLevel: 'RepeatableRead', readOnly: true })
  return { source: 'tasks', status: 'ready', counts: { open: number(totals[0].open), overdue: number(totals[0].overdue), today: number(totals[0].today) }, changes: totals[0].changes == null ? null : number(totals[0].changes),
    items: rows.map((row) => { const dueDay = row.due_date ? briefingDay(row.due_date, timeZone) : null; return item(`task:${row.id}`, row.title, `/tasks?task=${row.id}`, 'Persönliche Aufgabe', String(row.status), row.due_date,
      [...(dueDay && dueDay < day ? ['overdue' as const] : []), ...(dueDay === day ? ['today' as const] : []), ...(row.priority === 'high' ? ['high_priority' as const] : [])]) }) }
}
export async function loadBriefingProjects(ctx: BriefingDataContext): Promise<BriefingSection> {
  const sql = monitoringSql(), { userId, previousVisitAt: since } = ctx
  const [counts, projects, taskCounts, tasks, milestoneCounts, milestones] = await sql.transaction([
    sql`SELECT count(*) FILTER(WHERE status='active')::int AS active,count(*) FILTER(WHERE status='paused')::int AS paused,
      CASE WHEN ${since}::timestamptz IS NULL THEN NULL ELSE count(*) FILTER(WHERE updated_at>${since}::timestamptz)::int END AS changes FROM projects WHERE user_id=${userId}`,
    sql`SELECT id,name,status,priority FROM projects WHERE user_id=${userId} AND status<>'done' ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,CASE priority WHEN 'high' THEN 0 ELSE 1 END,updated_at DESC,id LIMIT 8`,
    sql`SELECT count(*)::int AS open,count(*) FILTER(WHERE p.status='paused')::int AS paused FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE p.user_id=${userId} AND p.status<>'done' AND t.status<>'done'`,
    sql`SELECT t.id,t.project_id,t.title,t.priority,p.status AS project_status FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE p.user_id=${userId} AND p.status<>'done' AND t.status<>'done' ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END,CASE t.priority WHEN 'high' THEN 0 ELSE 1 END,t.updated_at DESC,t.id LIMIT 12`,
    sql`SELECT count(*)::int AS open FROM milestones m JOIN projects p ON p.id=m.project_id AND p.user_id=m.user_id WHERE p.user_id=${userId} AND p.status<>'done' AND NOT m.done`,
    sql`SELECT m.id,m.project_id,m.title,m.due_date,p.status AS project_status FROM milestones m JOIN projects p ON p.id=m.project_id AND p.user_id=m.user_id WHERE p.user_id=${userId} AND p.status<>'done' AND NOT m.done AND m.due_date<${briefingDayStart(addBriefingDays(ctx.day, 7), ctx.timeZone)}::timestamptz ORDER BY m.due_date,m.id LIMIT 12`,
  ], { isolationLevel: 'RepeatableRead', readOnly: true })
  return { source: 'projects', status: 'ready', counts: { active: number(counts[0].active), paused: number(counts[0].paused), projectTasks: number(taskCounts[0].open), pausedTasks: number(taskCounts[0].paused), milestones: number(milestoneCounts[0].open) }, changes: counts[0].changes == null ? null : number(counts[0].changes),
    items: [
      ...projects.map((row) => item(`project:${row.id}`, row.name, `/projects?project=${row.id}`, 'Projekt', String(row.status), null, row.status === 'active' && row.priority === 'high' ? ['high_priority'] : [])),
      ...tasks.map((row) => item(`project-task:${row.id}`, row.title, `/projects?project=${row.project_id}#project-task-${row.id}`, 'Projektaufgabe', String(row.project_status), null, row.project_status === 'active' && row.priority === 'high' ? ['high_priority'] : [])),
      ...milestones.map((row) => { const due = briefingDay(row.due_date, ctx.timeZone); return item(`milestone:${row.id}`, row.title, `/projects?project=${row.project_id}#milestone-${row.id}`, 'Meilenstein', String(row.project_status), row.due_date,
        row.project_status !== 'active' ? [] : due < ctx.day ? ['overdue'] : due === ctx.day ? ['today'] : []) }),
    ] }
}
export async function loadBriefingCalendar(ctx: BriefingDataContext): Promise<BriefingSection> {
  const sql = monitoringSql(), end = briefingDayStart(addBriefingDays(ctx.day, 7), ctx.timeZone), now = ctx.now.toISOString()
  const [counts, rows] = await sql.transaction([
    sql`SELECT count(*)::int AS upcoming,count(*) FILTER(WHERE (starts_at AT TIME ZONE ${ctx.timeZone})::date=${ctx.day}::date)::int AS today,
      CASE WHEN ${ctx.previousVisitAt}::timestamptz IS NULL THEN NULL ELSE count(*) FILTER(WHERE updated_at>${ctx.previousVisitAt}::timestamptz)::int END AS changes FROM appointments WHERE user_id=${ctx.userId} AND ends_at>${now}::timestamptz AND starts_at<${end}::timestamptz`,
    sql`SELECT id,title,starts_at,ends_at FROM appointments WHERE user_id=${ctx.userId} AND ends_at>${now}::timestamptz AND starts_at<${end}::timestamptz ORDER BY starts_at,id LIMIT 12`,
  ], { isolationLevel: 'RepeatableRead', readOnly: true })
  return { source: 'calendar', status: 'ready', counts: { upcoming: number(counts[0].upcoming), todayAppointments: number(counts[0].today) }, changes: counts[0].changes == null ? null : number(counts[0].changes), items: rows.map((row) => item(`appointment:${row.id}`, row.title, `/calendar?appointment=${row.id}`, 'Termin', new Date(row.starts_at) <= ctx.now ? 'ongoing' : 'upcoming', row.starts_at, ['upcoming'])) }
}
export async function loadBriefingUptime(ctx: BriefingDataContext): Promise<BriefingSection> {
  const sql = monitoringSql()
  const rows = await sql`SELECT m.id,m.name,c.status,c.checked_at,c.ssl_days_left FROM uptime_monitors m LEFT JOIN LATERAL
    (SELECT status,checked_at,ssl_days_left FROM uptime_checks WHERE monitor_id=m.id ORDER BY checked_at DESC LIMIT 1) c ON true
    WHERE m.user_id=${ctx.userId} AND m.active ORDER BY m.id`
  const mapped = rows.map((row) => { const age = row.checked_at ? ctx.now.getTime() - new Date(row.checked_at).getTime() : Infinity
    const stale = age > 600_000 || age < -60_000, down = !stale && row.status === 'down', ssl = !stale && row.ssl_days_left != null && row.ssl_days_left < 14
    return { row, stale, down, ssl } })
  return { source: 'uptime', status: 'ready', counts: { down: mapped.filter((r) => r.down).length, stale: mapped.filter((r) => r.stale).length, ssl: mapped.filter((r) => r.ssl).length }, changes: null,
    items: mapped.filter((r) => r.down || r.stale || r.ssl).sort((a, b) => Number(b.down) - Number(a.down)).slice(0, 12).map(({ row, stale, down }) => item(`monitor:${row.id}`, row.name, `/uptime?monitor=${row.id}`, 'Uptime-Monitor', stale ? 'stale' : down ? 'down' : 'ssl_warning', row.checked_at, ['attention'])) }
}
export async function loadBriefingNeon(ctx: BriefingDataContext): Promise<BriefingSection> {
  const links = readNeonLinks().filter((link) => link.userId === ctx.userId)
  if (!links.length) return partial('neon', 'not_configured')
  const sql = monitoringSql(), allowed = JSON.stringify(links)
  try {
    const configs = await sql`SELECT c.project_id,c.last_success_at,c.settings,p.name FROM v2_neon_config c JOIN projects p ON p.id=c.project_id AND p.user_id=c.user_id
      WHERE c.user_id=${ctx.userId} AND EXISTS(SELECT 1 FROM jsonb_array_elements(${allowed}::jsonb) l WHERE l->>'projectId'=c.project_id::text AND (l->>'neonProjectId')||':'||(l->>'branchId')=c.resource_key)`
    if (!configs.length) return partial('neon', 'not_configured')
    const alerts = await sql`SELECT a.id,a.project_id,a.message,a.started_at FROM v2_neon_alerts a JOIN projects p ON p.id=a.project_id AND p.user_id=a.user_id
      WHERE a.user_id=${ctx.userId} AND a.resolved_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(${allowed}::jsonb) l WHERE l->>'projectId'=a.project_id::text AND (l->>'neonProjectId')||':'||(l->>'branchId')=a.resource_key) ORDER BY a.started_at DESC`
    const stale = configs.filter((c) => c.settings.enabled && (!c.last_success_at || ctx.now.getTime() - new Date(c.last_success_at).getTime() > Number(c.settings.intervalMinutes) * 120_000))
    return { source: 'neon', status: 'ready', counts: { projects: configs.length, alerts: alerts.length, stale: stale.length }, changes: null, items: [
      ...alerts.slice(0, 8).map((a) => item(`neon-alert:${a.id}`, a.message, `/projects?project=${a.project_id}`, 'Neon-Warnung', 'warning', a.started_at, ['attention'])),
      ...stale.slice(0, 4).map((c) => item(`neon-stale:${c.project_id}`, c.name, `/projects?project=${c.project_id}`, 'Neon-Messung', 'stale', c.last_success_at, ['attention'])),
    ] }
  } catch (error) { if ((error as { code?: string }).code === '42P01') return partial('neon', 'not_configured'); throw error }
}
export async function loadBriefingSecurity(ctx: BriefingDataContext): Promise<BriefingSection> {
  const overview = await readSecurityOverview(ctx.userId)
  if (overview.setupRequired) return partial('security', 'not_configured')
  const summary = summarizeSecurity({ ...overview, checkedAt: ctx.now.toISOString() })
  return { source: 'security', status: 'ready', counts: { total: summary.total, gaps: summary.accountsWithGaps, review: summary.reviewDue, unknown: summary.accountsWithUnknowns }, changes: null,
    items: [...new Map(summary.actions.map((action) => [action.accountId, item(`security:${action.accountId}`, action.accountName, action.href, 'Kontosicherheit · Selbstauskunft', 'review', null, ['review'])])).values()].slice(0, 8) }
}
const loaders = { tasks: loadBriefingTasks, projects: loadBriefingProjects, calendar: loadBriefingCalendar, uptime: loadBriefingUptime, neon: loadBriefingNeon, security: loadBriefingSecurity }
export function createBriefingCollector(dependencies = { readBriefingState, previousBriefingVisit, loaders }) {
  return async (userId: string, visitId?: string, exclude: BriefingSource[] = [], now = new Date()): Promise<BriefingSnapshot> => {
    let state: Awaited<ReturnType<typeof readBriefingState>> = null, previousVisitAt: string | null = null
    try { state = await dependencies.readBriefingState(userId); previousVisitAt = await dependencies.previousBriefingVisit(userId, visitId) } catch { /* facts remain useful when persistence is unavailable */ }
    const preferences = state?.preferences ?? DEFAULT_BRIEFING_PREFERENCES, day = briefingDay(now, preferences.timeZone)
    const keys = Object.keys(dependencies.loaders) as BriefingSource[]
    const sections = await Promise.all(keys.map(async (key) => {
      if (!preferences.sources[key] || exclude.includes(key)) return partial(key, 'excluded')
      try { return await dependencies.loaders[key]({ userId, now, day, timeZone: preferences.timeZone, previousVisitAt }) } catch { return partial(key, 'unavailable') }
    }))
    const digest = createHash('sha256').update(JSON.stringify({ day, preferences, sections: sections.map(({ changes: _changes, ...facts }) => facts) })).digest('hex')
    return { checkedAt: now.toISOString(), day, timeZone: preferences.timeZone, digest, previousVisitAt, storageReady: Boolean(state), preferences, preferenceVersion: state?.version ?? 0, sections }
  }
}
export const collectBriefing = createBriefingCollector()
