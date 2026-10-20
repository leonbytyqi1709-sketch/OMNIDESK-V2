import { randomUUID } from 'node:crypto'
import { monitoringSql } from './neon-storage'
import { initializeRadar } from './radar-storage'
import { requestRadarFeed, parseRadarFeed } from './radar-feed'
import { RadarError } from './radar-policy'
export async function refreshRadarSource(
  userId: string,
  id: string,
  fetchFeed = requestRadarFeed,
  mode: 'manual' | 'scheduler' = 'manual',
) {
  const sql = monitoringSql(),
    token = randomUUID()
  const [source] =
    await sql`UPDATE v2_radar_sources s SET last_attempt=clock_timestamp(),lease_token=${token},lease_until=now()+interval '60 seconds' WHERE s.id=${id} AND s.user_id=${userId} AND s.enabled=true AND (s.last_attempt IS NULL OR s.last_attempt<=now()-interval '15 minutes') AND (s.lease_until IS NULL OR s.lease_until<now()) AND EXISTS(SELECT 1 FROM v2_radar_topics t LEFT JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE t.id=s.topic_id AND t.user_id=s.user_id AND t.enabled=true AND (t.project_id IS NULL OR p.id IS NOT NULL)) RETURNING s.*`
  if (!source) return { id, checked: false }
  try {
    const response = await fetchFeed(String(source.url), {
      etag: source.etag,
      modified: source.modified,
    })
    if (response.status !== 200 && response.status !== 304)
      throw new RadarError(`Quelle antwortet mit HTTP ${response.status}.`)
    const entries =
      response.status === 304
        ? []
        : parseRadarFeed(response.body, String(source.url))
    const queries = entries.map(
      (entry) =>
        sql`INSERT INTO v2_radar_items(id,user_id,source_id,title,url,excerpt,published_at) SELECT ${randomUUID()},${userId},s.id,${entry.title},${entry.url},${entry.excerpt},${entry.publishedAt}::timestamptz FROM v2_radar_sources s JOIN v2_radar_topics t ON t.id=s.topic_id AND t.user_id=s.user_id LEFT JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE s.id=${id} AND s.user_id=${userId} AND s.lease_token=${token} AND s.enabled=true AND t.enabled=true AND (t.project_id IS NULL OR p.id IS NOT NULL) ON CONFLICT(source_id,url) DO UPDATE SET title=excluded.title,excerpt=excluded.excerpt,published_at=excluded.published_at,explanation=CASE WHEN v2_radar_items.title=excluded.title AND v2_radar_items.excerpt=excluded.excerpt THEN v2_radar_items.explanation ELSE NULL END`,
    )
    const results = await sql.transaction([
      ...queries,
      sql`UPDATE v2_radar_sources SET last_success=clock_timestamp(),last_scheduler_at=CASE WHEN ${mode}='scheduler' THEN clock_timestamp() ELSE last_scheduler_at END,error=NULL,etag=coalesce(${response.etag},etag),modified=coalesce(${response.modified},modified),lease_token=NULL,lease_until=NULL WHERE id=${id} AND user_id=${userId} AND lease_token=${token} RETURNING id`,
      sql`DELETE FROM v2_radar_items WHERE id IN(SELECT id FROM v2_radar_items WHERE source_id=${id} AND user_id=${userId} AND saved=false ORDER BY found_at DESC,id OFFSET 200)`,
    ])
    return {
      id,
      checked: Boolean(results[queries.length].length),
      entries: entries.length,
    }
  } catch (error) {
    const message =
      error instanceof RadarError
        ? error.message
        : 'Quelle konnte nicht sicher abgerufen oder verarbeitet werden.'
    await sql`UPDATE v2_radar_sources SET error=${message},lease_token=NULL,lease_until=NULL WHERE id=${id} AND user_id=${userId} AND lease_token=${token}`
    return { id, checked: true, error: message }
  }
}
export async function runRadarScheduler() {
  const sql = monitoringSql()
  const [ready] =
    await sql`SELECT to_regclass('v2_radar_sources') IS NOT NULL AS ready`
  if (!ready?.ready) return { checked: 0, results: [] }
  const sources =
    await sql`SELECT s.id,s.user_id FROM v2_radar_sources s JOIN v2_radar_topics t ON t.id=s.topic_id AND t.user_id=s.user_id LEFT JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE s.enabled=true AND t.enabled=true AND (t.project_id IS NULL OR p.id IS NOT NULL) AND (s.last_attempt IS NULL OR s.last_attempt<=now()-interval '15 minutes') AND (s.lease_until IS NULL OR s.lease_until<now()) ORDER BY s.last_attempt ASC NULLS FIRST,s.id LIMIT 3`
  const results = await Promise.all(
    sources.map((s) =>
      refreshRadarSource(
        String(s.user_id),
        String(s.id),
        requestRadarFeed,
        'scheduler',
      ),
    ),
  )
  return { checked: results.filter((r) => r.checked).length, results }
}
export async function refreshRadar(userId: string, ids: string[]) {
  await initializeRadar()
  return Promise.all(ids.map((id) => refreshRadarSource(userId, id)))
}
