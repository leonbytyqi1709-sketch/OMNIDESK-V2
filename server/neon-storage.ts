import { neon } from '@neondatabase/serverless'
import { randomUUID } from 'node:crypto'
import type { NeonLink } from './neon-monitor'
import { defaultNeonSettings, schedulerInterval } from './neon-policy'
import { isNeonSqlConfigured } from './neon-sql'
import type { AlertCondition } from './neon-policy'
import type { NeonAlert, NeonHistoryPoint, NeonMonitoringState, NeonSettings, NeonSnapshot, SqlCheck } from '../src/types/neon-monitoring'

export function monitoringSql() {
  if (!process.env.DATABASE_URL) throw new Error('Monitoring-Speicher: DATABASE_URL fehlt.')
  return neon(process.env.DATABASE_URL, { fetchOptions: { signal: AbortSignal.timeout(15_000) } })
}
export const resourceKey = (link: NeonLink) => `${link.neonProjectId}:${link.branchId}`
export const neonDdl = [
  `CREATE TABLE IF NOT EXISTS v2_neon_config (
    project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, settings jsonb NOT NULL,
    last_attempt_at timestamptz, last_success_at timestamptz, last_scheduler_at timestamptz,
    last_snapshot jsonb, last_sql jsonb, failures integer NOT NULL DEFAULT 0,
    lease_token uuid, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_neon_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, checked_at timestamptz NOT NULL, bucket timestamptz NOT NULL,
    source text NOT NULL CHECK (source IN ('manual','scheduler')), snapshot jsonb, sql_check jsonb,
    complete boolean NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_samples_unique ON v2_neon_samples(project_id, user_id, resource_key, bucket)`,
  `CREATE INDEX IF NOT EXISTS v2_neon_samples_lookup ON v2_neon_samples(project_id, user_id, resource_key, checked_at)`,
  `CREATE TABLE IF NOT EXISTS v2_neon_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, code text NOT NULL, message text NOT NULL,
    severity text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, acknowledged_at timestamptz)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_alerts_open ON v2_neon_alerts(project_id, user_id, resource_key, code) WHERE resolved_at IS NULL`,
]
export async function initializeNeonStorage() {
  const sql = monitoringSql()
  const [existing] = await sql`SELECT to_regclass('v2_neon_config') IS NOT NULL AND to_regclass('v2_neon_samples') IS NOT NULL
    AND to_regclass('v2_neon_alerts') IS NOT NULL AND to_regclass('v2_neon_samples_unique') IS NOT NULL
    AND to_regclass('v2_neon_alerts_open') IS NOT NULL AS ready`
  if (existing?.ready === true) return
  // Fixed additive DDL only. Advisory lock serializes concurrent first-time initializations.
  await sql.transaction([sql`SELECT pg_advisory_xact_lock(184730019)`, ...neonDdl.map((statement) => sql.query(statement))])
}
export interface StoredConfig {
  project_id: string; user_id: string; resource_key: string; settings: NeonSettings
  last_attempt_at: string | null; last_success_at: string | null; last_scheduler_at: string | null
  last_snapshot: NeonSnapshot | null; last_sql: SqlCheck | null; failures: number
}
export function missingNeonStorage(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01'
}
export async function loadNeonConfig(link: NeonLink): Promise<StoredConfig | null> {
  const sql = monitoringSql()
  const [config] = await sql`SELECT * FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)}`
  return config as StoredConfig ?? null
}
export async function saveNeonSettings(link: NeonLink, settings: NeonSettings) {
  const sql = monitoringSql()
  const [config] = await sql`INSERT INTO v2_neon_config (project_id,user_id,resource_key,settings)
    VALUES (${link.projectId},${link.userId},${resourceKey(link)},${JSON.stringify(settings)}::jsonb)
    ON CONFLICT (project_id) DO UPDATE SET user_id=EXCLUDED.user_id, resource_key=EXCLUDED.resource_key,
      settings=EXCLUDED.settings, updated_at=now(), lease_token=NULL, lease_until=NULL,
      last_attempt_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_attempt_at END,
      last_success_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_success_at END,
      last_snapshot=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_snapshot END,
      last_sql=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_sql END,
      last_scheduler_at=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.last_scheduler_at END,
      failures=CASE WHEN v2_neon_config.resource_key=EXCLUDED.resource_key AND v2_neon_config.user_id=EXCLUDED.user_id THEN v2_neon_config.failures ELSE 0 END
    RETURNING *`
  return config as StoredConfig
}
export async function claimNeonCheck(link: NeonLink, source: 'manual' | 'scheduler') {
  const sql = monitoringSql()
  const token = randomUUID()
  const [config] = await sql`UPDATE v2_neon_config SET lease_token=${token}, lease_until=now()+interval '90 seconds'
    WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)}
      AND (lease_until IS NULL OR lease_until<now())
      AND (${source}='manual' OR (settings->>'enabled')::boolean)
      AND (last_attempt_at IS NULL OR last_attempt_at<now()-
        (CASE WHEN ${source}='manual' THEN 60 ELSE (settings->>'intervalMinutes')::int*60 END)*interval '1 second')
    RETURNING *`
  return config ? { config: config as StoredConfig, token } : null
}
export async function completeNeonCheck(link: NeonLink, token: string, snapshot: NeonSnapshot | null, sqlCheck: SqlCheck | null,
  conditions: AlertCondition[], source: 'manual' | 'scheduler', checkedAt: string) {
  const sql = monitoringSql()
  const complete = Boolean(snapshot && !snapshot.unavailable.length)
  const key = resourceKey(link)
  const guard = sql`SELECT 1 FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key} AND lease_token=${token}`
  const statements = [
    // Lock the lease row for the full transaction so settings changes cannot race a completed sample.
    sql`SELECT project_id FROM v2_neon_config WHERE project_id=${link.projectId} AND user_id=${link.userId} AND lease_token=${token} FOR UPDATE`,
    sql`INSERT INTO v2_neon_samples (project_id,user_id,resource_key,checked_at,bucket,source,snapshot,sql_check,complete)
      SELECT ${link.projectId},${link.userId},${key},${checkedAt}::timestamptz,date_trunc('minute',${checkedAt}::timestamptz),${source},
      ${snapshot ? JSON.stringify(snapshot) : null}::jsonb,${sqlCheck ? JSON.stringify(sqlCheck) : null}::jsonb,${complete}
      WHERE EXISTS (${guard}) ON CONFLICT (project_id,user_id,resource_key,bucket) DO NOTHING`,
    ...conditions.filter((condition) => condition.active !== null).map((condition) => condition.active
      ? sql`INSERT INTO v2_neon_alerts (project_id,user_id,resource_key,code,message,severity)
          SELECT ${link.projectId},${link.userId},${key},${condition.code},${condition.message},${condition.severity} WHERE EXISTS (${guard})
          ON CONFLICT (project_id,user_id,resource_key,code) WHERE resolved_at IS NULL DO NOTHING`
      : sql`UPDATE v2_neon_alerts SET resolved_at=now() WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
          AND code=${condition.code} AND resolved_at IS NULL AND EXISTS (${guard})`),
    sql`DELETE FROM v2_neon_samples WHERE project_id=${link.projectId} AND user_id=${link.userId}
      AND checked_at<now()-(SELECT (settings->>'retentionDays')::int FROM v2_neon_config WHERE project_id=${link.projectId})*interval '1 day' AND EXISTS (${guard})`,
    sql`DELETE FROM v2_neon_alerts WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resolved_at IS NOT NULL
      AND resolved_at<now()-(SELECT (settings->>'retentionDays')::int FROM v2_neon_config WHERE project_id=${link.projectId})*interval '1 day' AND EXISTS (${guard})`,
    sql`UPDATE v2_neon_config SET last_attempt_at=${checkedAt}::timestamptz,
      last_success_at=CASE WHEN ${complete} THEN ${checkedAt}::timestamptz ELSE last_success_at END,
      last_scheduler_at=CASE WHEN ${source}='scheduler' THEN now() ELSE last_scheduler_at END,
      last_snapshot=COALESCE(${snapshot ? JSON.stringify(snapshot) : null}::jsonb,last_snapshot),
      last_sql=COALESCE(${sqlCheck ? JSON.stringify(sqlCheck) : null}::jsonb,last_sql), failures=CASE WHEN ${complete} THEN 0 ELSE failures+1 END,
      lease_token=NULL, lease_until=NULL WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key} AND lease_token=${token}`,
  ]
  await sql.transaction(statements)
}

export async function monitoringMonitors(link: NeonLink, settings: NeonSettings) {
  const sql = monitoringSql()
  const rows = await sql`SELECT m.id,m.name,m.active,c.status,c.response_time_ms,c.checked_at FROM uptime_monitors m
    LEFT JOIN LATERAL (SELECT status,response_time_ms,checked_at FROM uptime_checks WHERE monitor_id=m.id ORDER BY checked_at DESC LIMIT 1) c ON true
    WHERE m.user_id=${link.userId} ORDER BY m.name LIMIT 500`
  return rows.map((row) => ({ id: String(row.id), name: String(row.name), active: Boolean(row.active), linked: settings.monitorIds.includes(String(row.id)),
    status: row.status as 'up' | 'down' | null, responseTimeMs: row.response_time_ms as number | null, checkedAt: row.checked_at as string | null }))
}
export async function readNeonMonitoring(link: NeonLink, days: number): Promise<NeonMonitoringState> {
  const sql = monitoringSql()
  let config: StoredConfig | null = null
  let setupRequired = false
  try { config = await loadNeonConfig(link) } catch (error) { if (!missingNeonStorage(error)) throw error; setupRequired = true }
  const settings = config?.settings ?? defaultNeonSettings
  const monitors = await monitoringMonitors(link, settings)
  const base = { setupRequired: setupRequired || !config, settings, lastAttemptAt: config?.last_attempt_at ?? null,
    lastSuccessAt: config?.last_success_at ?? null, lastSchedulerAt: config?.last_scheduler_at ?? null,
    snapshot: config?.last_snapshot ?? null, lastSql: config?.last_sql ?? null,
    schedulerIntervalMinutes: schedulerInterval(), sqlConfigured: isNeonSqlConfigured(link), monitors, historyDays: days }
  if (!config) return { ...base, history: [], alerts: [] }
  const key = resourceKey(link)
  const bucketSeconds = days === 1 ? 300 : days === 7 ? 3600 : days === 30 ? 21600 : 86400
  const [history, alerts] = await Promise.all([
    sql`SELECT to_timestamp(floor(extract(epoch FROM checked_at)/${bucketSeconds})*${bucketSeconds}) AS at, snapshot->'consumption'->>'periodStart' AS "periodStart",
      avg((snapshot->'consumption'->>'projectStorageBytes')::double precision)/1073741824 AS "storageGiB",
      avg((snapshot->'branch'->>'logicalSizeBytes')::double precision)/1073741824 AS "branchGiB",
      max((snapshot->'consumption'->>'computeCuSeconds')::double precision)/3600 AS "computeHours",
      max((snapshot->'consumption'->>'transferBytes')::double precision)/1073741824 AS "transferGiB",
      avg((sql_check->>'latencyMs')::double precision) AS "sqlLatencyMs", count(*)::int AS samples,
      count(*) FILTER (WHERE NOT complete)::int AS failures
      FROM v2_neon_samples WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
      AND checked_at>=now()-${days}*interval '1 day' GROUP BY 1,2 ORDER BY 1 LIMIT 800`,
    sql`SELECT id,code,message,severity,started_at AS "startedAt",resolved_at AS "resolvedAt",acknowledged_at AS "acknowledgedAt"
      FROM v2_neon_alerts WHERE project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${key}
      ORDER BY (resolved_at IS NULL) DESC,started_at DESC LIMIT 100`,
  ])
  return { ...base, history: history as NeonHistoryPoint[], alerts: alerts as NeonAlert[] }
}
export async function acknowledgeNeonAlert(link: NeonLink, id: string) {
  const sql = monitoringSql()
  const rows = await sql`UPDATE v2_neon_alerts SET acknowledged_at=COALESCE(acknowledged_at,now())
    WHERE id=${id} AND project_id=${link.projectId} AND user_id=${link.userId} AND resource_key=${resourceKey(link)} RETURNING id`
  return rows.length > 0
}
