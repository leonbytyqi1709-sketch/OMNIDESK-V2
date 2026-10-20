import { monitoringSql } from './neon-storage'
import { DEFAULT_BRIEFING_PREFERENCES } from '../src/lib/briefing'
import type { BriefingPreferences, BriefingRecommendation } from '../src/types/briefing'
import { SecurityAccountError } from './account-security-policy'
export const briefingDdl = [
  `CREATE TABLE IF NOT EXISTS v2_briefing_state(user_id text PRIMARY KEY,preferences jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
    last_visit_at timestamptz,ai_digest text,ai_message jsonb,ai_generated_at timestamptz,next_ai_at timestamptz,lease_token uuid,lease_until timestamptz)`,
  `CREATE TABLE IF NOT EXISTS v2_briefing_visits(user_id text NOT NULL,visit_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),previous_visit_at timestamptz,PRIMARY KEY(user_id,visit_id))`,
]
export interface BriefingState { preferences: BriefingPreferences; version: number; ai_digest: string | null; ai_message: { recommendations: BriefingRecommendation[] } | null; ai_generated_at: Date | string | null; next_ai_at: Date | string | null }
export async function initializeBriefing() {
  const sql = monitoringSql(); const [exists] = await sql`SELECT to_regclass('v2_briefing_state') IS NOT NULL AND to_regclass('v2_briefing_visits') IS NOT NULL AS ready`
  if (exists?.ready) return
  await sql.transaction([sql`SELECT pg_advisory_xact_lock(184730025)`, ...briefingDdl.map((ddl) => sql.query(ddl))])
}
export async function readBriefingState(userId: string): Promise<BriefingState | null> {
  const sql = monitoringSql()
  try { const [state] = await sql`SELECT preferences,version,ai_digest,ai_message,ai_generated_at,next_ai_at FROM v2_briefing_state WHERE user_id=${userId}`; return state as BriefingState ?? null }
  catch (error) { if ((error as { code?: string }).code === '42P01') return null; throw error }
}
export async function recordBriefingVisit(userId: string, visitId: string) {
  await initializeBriefing(); const sql = monitoringSql()
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730026))`,
    sql`INSERT INTO v2_briefing_state(user_id,preferences) VALUES(${userId},${JSON.stringify(DEFAULT_BRIEFING_PREFERENCES)}::jsonb) ON CONFLICT(user_id) DO NOTHING`,
    sql`INSERT INTO v2_briefing_visits(user_id,visit_id,created_at,previous_visit_at)
      SELECT ${userId},${visitId},clock_timestamp(),last_visit_at FROM v2_briefing_state WHERE user_id=${userId} ON CONFLICT(user_id,visit_id) DO NOTHING`,
    sql`UPDATE v2_briefing_state SET last_visit_at=v.created_at FROM v2_briefing_visits v WHERE v.user_id=${userId} AND v.visit_id=${visitId} AND v2_briefing_state.user_id=v.user_id AND (v2_briefing_state.last_visit_at IS NULL OR v2_briefing_state.last_visit_at<v.created_at)`,
    sql`DELETE FROM v2_briefing_visits WHERE user_id=${userId} AND created_at<now()-interval '30 days' AND visit_id<>${visitId}`,
  ])
}
export async function previousBriefingVisit(userId: string, visitId?: string) {
  if (!visitId) return null
  const sql = monitoringSql()
  try { const [row] = await sql`SELECT previous_visit_at FROM v2_briefing_visits WHERE user_id=${userId} AND visit_id=${visitId}`; return row?.previous_visit_at ? new Date(row.previous_visit_at).toISOString() : null }
  catch (error) { if ((error as { code?: string }).code === '42P01') return null; throw error }
}
export async function saveBriefingPreferences(userId: string, version: number, preferences: BriefingPreferences) {
  const sql = monitoringSql()
  const rows = await sql`UPDATE v2_briefing_state SET preferences=${JSON.stringify(preferences)}::jsonb,version=version+1,
    ai_digest=NULL,ai_message=NULL,ai_generated_at=NULL,lease_token=NULL,lease_until=NULL WHERE user_id=${userId} AND version=${version} RETURNING user_id`
  if (!rows.length) throw new SecurityAccountError('Einstellungen zwischenzeitlich geändert. Bitte neu laden.', 409)
}
