import {
  monitoringSql,
  missingNeonStorage,
  loadNeonConfig,
} from './neon-storage'
import { readNeonLinks } from './neon-monitor'
import { analyzeMission } from '../src/lib/mission-control'
import type {
  MissionComparison,
  MissionMonitorOptions,
  MissionSnapshot,
  MissionUptime,
  MissionObservation,
} from '../src/types/mission-control'

export class MissionStorageError extends Error {
  status: 400 | 403 | 404 | 409 | 429 | 503
  constructor(message: string, status: MissionStorageError['status']) {
    super(message)
    this.status = status
  }
}
export const missionDdl = [
  `CREATE TABLE IF NOT EXISTS v2_mission_settings(project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,user_id text NOT NULL,monitor_ids jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_mission_visits(project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id text NOT NULL,visit_id uuid NOT NULL,baseline jsonb,baseline_at timestamptz,latest jsonb NOT NULL,last_visit_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,user_id,visit_id))`,
  `CREATE TABLE IF NOT EXISTS v2_mission_ai_limits(user_id text PRIMARY KEY,next_at timestamptz NOT NULL)`,
]
export async function initializeMissionStorage() {
  const sql = monitoringSql()
  const [existing] =
    await sql`SELECT to_regclass('v2_mission_settings') IS NOT NULL AND to_regclass('v2_mission_visits') IS NOT NULL AND to_regclass('v2_mission_ai_limits') IS NOT NULL AS ready`
  if (existing?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730021)`,
    ...missionDdl.map((s) => sql.query(s)),
  ])
}
async function settings(userId: string, projectId: string) {
  const sql = monitoringSql()
  try {
    const [row] =
      await sql`SELECT s.monitor_ids,s.version FROM v2_mission_settings s JOIN projects p ON p.id=s.project_id AND p.user_id=s.user_id WHERE s.user_id=${userId} AND s.project_id=${projectId}`
    return row as { monitor_ids: string[]; version: number } | undefined
  } catch (e) {
    if (missingNeonStorage(e)) return undefined
    throw e
  }
}
async function selectedMonitors(userId: string, projectId: string) {
  const config = await settings(userId, projectId)
  if (config)
    return {
      ids: config.monitor_ids,
      origin: 'direct' as const,
      version: config.version,
    }
  const link = readNeonLinks().find(
    (l) => l.userId === userId && l.projectId === projectId,
  )
  let ids: string[] = []
  if (link) {
    try {
      ids = (await loadNeonConfig(link))?.settings.monitorIds ?? []
    } catch (e) {
      if (!missingNeonStorage(e)) throw e
    }
  }
  return {
    ids,
    origin: ids.length ? ('neon' as const) : ('none' as const),
    version: 0,
  }
}
export async function readMissionMonitorOptions(
  userId: string,
  projectId: string,
): Promise<MissionMonitorOptions> {
  const sql = monitoringSql(),
    selected = await selectedMonitors(userId, projectId)
  const monitors =
    await sql`SELECT m.id,m.name,m.active FROM uptime_monitors m WHERE m.user_id=${userId} AND EXISTS(SELECT 1 FROM projects WHERE id=${projectId} AND user_id=${userId}) ORDER BY m.name,m.id`
  return {
    version: selected.version,
    origin: selected.origin,
    selectedIds: selected.ids,
    monitors: monitors as MissionMonitorOptions['monitors'],
  }
}
export async function saveMissionMonitors(
  userId: string,
  projectId: string,
  ids: string[],
  version: number,
) {
  await initializeMissionStorage()
  const sql = monitoringSql(),
    json = JSON.stringify(ids)
  // Validate project AND every monitor within the mutation; never trust browser ownership claims.
  const rows =
    await sql`INSERT INTO v2_mission_settings(project_id,user_id,monitor_ids)
    SELECT p.id,p.user_id,${json}::jsonb FROM projects p WHERE p.id=${projectId} AND p.user_id=${userId}
    AND (SELECT count(*) FROM uptime_monitors m WHERE m.user_id=${userId} AND m.id IN(SELECT value::uuid FROM jsonb_array_elements_text(${json}::jsonb)))=jsonb_array_length(${json}::jsonb)
    AND (${version}=0 OR EXISTS(SELECT 1 FROM v2_mission_settings s WHERE s.project_id=p.id AND s.user_id=p.user_id AND s.version=${version}))
    ON CONFLICT(project_id) DO UPDATE SET monitor_ids=excluded.monitor_ids,version=v2_mission_settings.version+1,updated_at=now()
    WHERE v2_mission_settings.user_id=excluded.user_id AND v2_mission_settings.version=${version}
    RETURNING version`
  if (!rows.length)
    throw new MissionStorageError(
      'Zuordnung nicht gespeichert. Projekt/Monitore gehören nicht zu deinem Konto oder die Einstellungen wurden inzwischen geändert. Neu laden und erneut prüfen.',
      409,
    )
  return { version: Number(rows[0].version) }
}
export async function readMissionUptime(
  userId: string,
  projectId: string,
): Promise<MissionUptime> {
  const sql = monitoringSql(),
    selected = await selectedMonitors(userId, projectId)
  const rows =
    await sql`SELECT m.id,m.name,m.active,c.status,c.response_time_ms AS "responseTimeMs",c.checked_at AS "checkedAt",
    COALESCE(h.checks,'[]'::jsonb) AS "recentChecks" FROM uptime_monitors m
    LEFT JOIN LATERAL(SELECT status,response_time_ms,checked_at FROM uptime_checks WHERE monitor_id=m.id ORDER BY checked_at DESC LIMIT 1) c ON true
    LEFT JOIN LATERAL(SELECT jsonb_agg(jsonb_build_object('at',checked_at,'status',status,'responseTimeMs',response_time_ms) ORDER BY checked_at) AS checks
      FROM(SELECT checked_at,status,response_time_ms FROM uptime_checks WHERE monitor_id=m.id AND checked_at>=now()-interval '24 hours' AND checked_at<=now() ORDER BY checked_at DESC LIMIT 288) bounded) h ON true
    WHERE m.user_id=${userId} AND m.id IN(SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(selected.ids)}::jsonb))
    AND EXISTS(SELECT 1 FROM projects WHERE id=${projectId} AND user_id=${userId}) ORDER BY m.name,m.id`
  const monitors = rows.map((r) => {
    const checks =
      r.recentChecks as MissionUptime['monitors'][number]['recentChecks']
    return {
      id: String(r.id),
      name: String(r.name),
      active: Boolean(r.active),
      linked: true,
      status: r.status as 'up' | 'down' | null,
      responseTimeMs: r.responseTimeMs as number | null,
      checkedAt: r.checkedAt as string | null,
      recentChecks: checks,
      sampleCount: checks.length,
      upCount: checks.filter((c) => c.status === 'up').length,
    }
  })
  return {
    origin: selected.origin,
    version: selected.version,
    missingMonitors: Math.max(0, selected.ids.length - monitors.length),
    monitors,
  }
}
export function missionObservation(
  snapshot: MissionSnapshot,
): MissionObservation {
  const analysis = analyzeMission(snapshot)
  return {
    facts: [
      {
        id: 'project',
        title: snapshot.project.name,
        value: `${snapshot.project.status}: ${snapshot.project.description}`,
        href: `/projects?project=${snapshot.project.id}`,
      },
      {
        id: 'uptime-selection',
        title: 'Verfügbare Projektmonitore',
        value: snapshot.uptime.data
          ? `${snapshot.uptime.data.origin}: ${
              snapshot.uptime.data.monitors
                .map((m) => m.id)
                .sort()
                .join(', ') || 'keine'
            }; nicht verfügbar: ${snapshot.uptime.data.missingMonitors}`
          : 'Zuordnung nicht abrufbar',
        href: `/mission-control?project=${snapshot.project.id}`,
      },
      ...analysis.facts.map((f) => ({
        id: f.id,
        title: f.title,
        value: `${f.status}: ${f.detail}`,
        href: f.href,
      })),
      ...analysis.events
        .filter((e) => !e.id.startsWith('check-'))
        .map((e) => ({
          id: `event:${e.id}`,
          title: e.title,
          value: e.detail,
          href: e.href,
        })),
      ...(
        [
          'github',
          'deployment',
          'neon',
          'monitoring',
          'uptime',
          'tasks',
        ] as const
      ).map((key) => ({
        id: `source:${key}`,
        title: `Datenquelle ${key}`,
        value: `${snapshot[key].state}: ${snapshot[key].message}`,
        href: `/mission-control?project=${snapshot.project.id}`,
      })),
    ].slice(0, 100),
  }
}
export function compareMission(
  before: MissionObservation | null,
  after: MissionObservation,
  previousAt: string | null,
): MissionComparison {
  if (!before)
    return {
      status: 'first_visit',
      previousAt: null,
      changes: [],
      totalChanges: 0,
    }
  const previous = new Map(before.facts.map((f) => [f.id, f]))
  const changes = after.facts
    .filter((f) => {
      const old = previous.get(f.id)
      return !old || old.value !== f.value || old.title !== f.title
    })
    .map((f) => ({
      id: f.id,
      title: f.title,
      before: previous.get(f.id)?.value ?? null,
      after: f.value,
      href: f.href,
    }))
  // Absence from bounded provider lists is not evidence of deletion. Do not invent removed events.
  return {
    status: 'compared',
    previousAt,
    changes: changes.slice(0, 20),
    totalChanges: changes.length,
  }
}
export async function recordMissionVisit(
  userId: string,
  projectId: string,
  visitId: string,
  snapshot: MissionSnapshot,
): Promise<MissionComparison> {
  await initializeMissionStorage()
  const sql = monitoringSql(),
    observation = missionObservation(snapshot)
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId + ':' + projectId},0))`,
    sql`INSERT INTO v2_mission_visits(project_id,user_id,visit_id,baseline,baseline_at,latest)
      SELECT p.id,p.user_id,${visitId}::uuid,previous.latest,previous.last_visit_at,${JSON.stringify(observation)}::jsonb
      FROM projects p LEFT JOIN LATERAL(SELECT latest,last_visit_at FROM v2_mission_visits WHERE project_id=p.id AND user_id=p.user_id ORDER BY last_visit_at DESC,visit_id DESC LIMIT 1) previous ON true
      WHERE p.id=${projectId} AND p.user_id=${userId}
      ON CONFLICT(project_id,user_id,visit_id) DO UPDATE SET latest=excluded.latest
      RETURNING baseline,baseline_at`,
    sql`DELETE FROM v2_mission_visits WHERE project_id=${projectId} AND user_id=${userId} AND visit_id IN(SELECT visit_id FROM v2_mission_visits WHERE project_id=${projectId} AND user_id=${userId} ORDER BY last_visit_at DESC,visit_id DESC OFFSET 10)`,
  ])
  const row = rows[0]
  if (!row)
    throw new MissionStorageError('Eigenes Projekt nicht mehr vorhanden.', 404)
  return compareMission(
    row.baseline as MissionObservation | null,
    observation,
    row.baseline_at as string | null,
  )
}
export async function claimMissionAI(userId: string) {
  await initializeMissionStorage()
  const sql = monitoringSql()
  const rows =
    await sql`INSERT INTO v2_mission_ai_limits(user_id,next_at) VALUES(${userId},now()+interval '1 minute')
    ON CONFLICT(user_id) DO UPDATE SET next_at=excluded.next_at WHERE v2_mission_ai_limits.next_at<=now() RETURNING user_id`
  return rows.length > 0
}
