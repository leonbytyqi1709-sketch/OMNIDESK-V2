import { randomUUID } from 'node:crypto'
import { monitoringSql } from './neon-storage'
import {
  RadarError,
  radarMatches,
  radarTopicInput,
  radarSourceInput,
} from './radar-policy'
import type { z } from 'zod'
import type {
  RadarOverview,
  RadarTopic,
  RadarSource,
  RadarItem,
} from '../src/types/radar'
export const radarDdl = [
  `CREATE TABLE IF NOT EXISTS v2_radar_topics(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,keywords jsonb NOT NULL,project_id uuid,enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_radar_sources(id uuid PRIMARY KEY,user_id text NOT NULL,topic_id uuid NOT NULL REFERENCES v2_radar_topics(id) ON DELETE CASCADE,name text NOT NULL,url text NOT NULL,category text NOT NULL CHECK(category IN ('news','security','release','status')),enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,last_attempt timestamptz,last_success timestamptz,last_scheduler_at timestamptz,error text,etag text,modified text,lease_token uuid,lease_until timestamptz,UNIQUE(user_id,topic_id,url))`,
  `CREATE TABLE IF NOT EXISTS v2_radar_items(id uuid PRIMARY KEY,user_id text NOT NULL,source_id uuid NOT NULL REFERENCES v2_radar_sources(id) ON DELETE CASCADE,title text NOT NULL,url text NOT NULL,excerpt text NOT NULL,published_at timestamptz,found_at timestamptz NOT NULL DEFAULT now(),read boolean NOT NULL DEFAULT false,saved boolean NOT NULL DEFAULT false,project_id uuid,project_override boolean NOT NULL DEFAULT false,memory_id uuid NOT NULL DEFAULT gen_random_uuid(),explanation jsonb,explanation_at timestamptz,UNIQUE(source_id,url))`,
  `CREATE INDEX IF NOT EXISTS v2_radar_items_owner_idx ON v2_radar_items(user_id,found_at DESC)`,
]
export async function initializeRadar() {
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT to_regclass('v2_radar_topics') IS NOT NULL AND to_regclass('v2_radar_sources') IS NOT NULL AND to_regclass('v2_radar_items') IS NOT NULL AS ready`
  if (row?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730031)`,
    ...radarDdl.map((ddl) => sql.query(ddl)),
  ])
}
const iso = (value: unknown) =>
  value ? new Date(String(value)).toISOString() : null
export async function readRadar(
  userId: string,
  savedOnly = false,
): Promise<RadarOverview> {
  await initializeRadar()
  const sql = monitoringSql()
  const [topicRows, sourceRows, itemRows] = await sql.transaction(
    [
      sql`SELECT t.*,p.name AS project_name FROM v2_radar_topics t LEFT JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE t.user_id=${userId} ORDER BY t.created_at,t.id`,
      sql`SELECT s.* FROM v2_radar_sources s JOIN v2_radar_topics t ON t.id=s.topic_id AND t.user_id=s.user_id WHERE s.user_id=${userId} ORDER BY s.name,s.id`,
      sql`SELECT i.*,s.topic_id,CASE WHEN i.project_override THEN i.project_id ELSE t.project_id END AS effective_project,p.name AS project_name FROM v2_radar_items i JOIN v2_radar_sources s ON s.id=i.source_id AND s.user_id=i.user_id JOIN v2_radar_topics t ON t.id=s.topic_id AND t.user_id=s.user_id LEFT JOIN projects p ON p.id=(CASE WHEN i.project_override THEN i.project_id ELSE t.project_id END) AND p.user_id=i.user_id WHERE i.user_id=${userId} AND (${savedOnly}::boolean=false OR i.saved=true) ORDER BY i.found_at DESC,i.id LIMIT 401`,
    ],
    { isolationLevel: 'RepeatableRead', readOnly: true },
  )
  const topics = topicRows.map(
    (t) =>
      ({
        id: String(t.id),
        name: String(t.name),
        keywords: t.keywords as string[],
        projectId: t.project_id ? String(t.project_id) : null,
        projectName: t.project_name ? String(t.project_name) : null,
        projectMissing: Boolean(t.project_id && !t.project_name),
        enabled: Boolean(t.enabled),
        version: Number(t.version),
      }) satisfies RadarTopic,
  )
  const sources = sourceRows.map((s) => {
    const topic = topics.find((t) => t.id === s.topic_id)
    return {
      id: String(s.id),
      topicId: String(s.topic_id),
      name: String(s.name),
      url: String(s.url),
      category: s.category as RadarSource['category'],
      enabled: Boolean(s.enabled),
      version: Number(s.version),
      lastAttempt: iso(s.last_attempt),
      lastSuccess: iso(s.last_success),
      lastSchedulerAt: iso(s.last_scheduler_at),
      error: s.error ? String(s.error) : null,
      due: Boolean(
        s.enabled &&
          topic?.enabled &&
          !topic.projectMissing &&
          (!s.last_attempt ||
            Date.now() - new Date(s.last_attempt).getTime() >= 900000) &&
          (!s.lease_until || new Date(s.lease_until).getTime() < Date.now()),
      ),
    } satisfies RadarSource
  })
  const items = itemRows.slice(0, 400).map(
    (i) =>
      ({
        id: String(i.id),
        projectId: i.effective_project ? String(i.effective_project) : null,
        projectName: i.project_name ? String(i.project_name) : null,
        projectMissing: Boolean(i.effective_project && !i.project_name),
        projectOverride: Boolean(i.project_override),
        sourceId: String(i.source_id),
        topicId: String(i.topic_id),
        title: String(i.title),
        url: String(i.url),
        excerpt: String(i.excerpt),
        publishedAt: iso(i.published_at),
        foundAt: iso(i.found_at)!,
        read: Boolean(i.read),
        saved: Boolean(i.saved),
        matches: radarMatches(
          String(i.title),
          String(i.excerpt),
          topics.find((t) => t.id === i.topic_id)?.keywords ?? [],
        ),
        memoryId: i.memory_id ? String(i.memory_id) : null,
        explanation: i.explanation as RadarItem['explanation'],
      }) satisfies RadarItem,
  )
  return { topics, sources, items, limited: itemRows.length > 400 }
}
export async function saveRadarTopic(
  userId: string,
  input: z.infer<typeof radarTopicInput>,
  id?: string,
  version?: number,
) {
  const sql = monitoringSql()
  if (id) {
    const rows =
      await sql`UPDATE v2_radar_topics SET name=${input.name},keywords=${JSON.stringify(input.keywords)}::jsonb,project_id=${input.projectId},enabled=${input.enabled},version=version+1 WHERE id=${id} AND user_id=${userId} AND version=${version ?? 0} AND (${input.projectId}::uuid IS NULL OR project_id=${input.projectId}::uuid OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId} AND user_id=${userId})) RETURNING id`
    if (!rows.length)
      throw new RadarError(
        'Thema wurde geändert oder Projekt ist nicht verfügbar. Bitte neu laden.',
        409,
      )
    return { id }
  }
  const topicId = randomUUID()
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730032))`,
    sql`INSERT INTO v2_radar_topics(id,user_id,name,keywords,project_id,enabled) SELECT ${topicId},${userId},${input.name},${JSON.stringify(input.keywords)}::jsonb,${input.projectId},${input.enabled} WHERE (SELECT count(*) FROM v2_radar_topics WHERE user_id=${userId})<20 AND (${input.projectId}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId} AND user_id=${userId})) RETURNING id`,
  ])
  if (!results[1].length)
    throw new RadarError(
      'Maximal 20 Themen; ein zugeordnetes Projekt muss dir gehören.',
      409,
    )
  return { id: topicId }
}
export async function createRadarSource(
  userId: string,
  input: z.infer<typeof radarSourceInput>,
) {
  const sql = monitoringSql(),
    id = randomUUID()
  try {
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730032))`,
      sql`INSERT INTO v2_radar_sources(id,user_id,topic_id,name,url,category) SELECT ${id},${userId},t.id,${input.name},${input.url},${input.category} FROM v2_radar_topics t WHERE t.id=${input.topicId} AND t.user_id=${userId} AND (SELECT count(*) FROM v2_radar_sources WHERE user_id=${userId})<20 RETURNING id`,
    ])
    if (!results[1].length)
      throw new RadarError(
        'Maximal 20 Quellen; bitte ein eigenes Thema wählen.',
        409,
      )
    return { id }
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      throw new RadarError(
        'Diese Quelle ist für das Thema bereits vorhanden.',
        409,
      )
    throw error
  }
}
export async function changeRadarSource(
  userId: string,
  id: string,
  version: number,
  enabled: boolean,
) {
  const sql = monitoringSql()
  const rows =
    await sql`UPDATE v2_radar_sources SET enabled=${enabled},version=version+1,lease_token=NULL,lease_until=NULL WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length)
    throw new RadarError(
      'Quelle wurde inzwischen geändert. Bitte neu laden.',
      409,
    )
  return { ok: true }
}
export async function deleteRadarRecord(
  userId: string,
  kind: 'topic' | 'source',
  id: string,
  version: number,
) {
  const sql = monitoringSql()
  const rows =
    kind === 'topic'
      ? await sql`DELETE FROM v2_radar_topics WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
      : await sql`DELETE FROM v2_radar_sources WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length)
    throw new RadarError(
      'Eintrag inzwischen geändert oder nicht gefunden.',
      409,
    )
  return { ok: true }
}
export async function markRadarItem(
  userId: string,
  id: string,
  input: {
    read?: boolean
    saved?: boolean
    projectId?: string | null
    projectOverride?: boolean
  },
) {
  const sql = monitoringSql()
  const rows =
    await sql`UPDATE v2_radar_items SET read=coalesce(${input.read ?? null}::boolean,read),saved=coalesce(${input.saved ?? null}::boolean,saved) WHERE id=${id} AND user_id=${userId} RETURNING id`
  if (!rows.length) throw new RadarError('Fund nicht gefunden.', 404)
  return { ok: true }
}
export async function ownRadarItem(userId: string, id: string) {
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT i.*,s.topic_id,s.name AS source_name,s.category,t.name AS topic_name,t.keywords,CASE WHEN i.project_override THEN i.project_id ELSE t.project_id END AS effective_project,p.id AS valid_project FROM v2_radar_items i JOIN v2_radar_sources s ON s.id=i.source_id AND s.user_id=i.user_id JOIN v2_radar_topics t ON t.id=s.topic_id AND t.user_id=s.user_id LEFT JOIN projects p ON p.id=(CASE WHEN i.project_override THEN i.project_id ELSE t.project_id END) AND p.user_id=t.user_id WHERE i.id=${id} AND i.user_id=${userId}`
  if (!row) throw new RadarError('Fund nicht gefunden.', 404)
  row.project_id = row.effective_project
  return row
}

export async function markRadarGroup(
  userId: string,
  ids: string[],
  input: {
    read?: boolean
    saved?: boolean
    projectId?: string | null
    projectOverride?: boolean
  },
) {
  const sql = monitoringSql()
  const rows =
    await sql`UPDATE v2_radar_items SET read=coalesce(${input.read ?? null}::boolean,read),saved=coalesce(${input.saved ?? null}::boolean,saved),project_id=CASE WHEN ${input.projectOverride ?? null}::boolean IS NOT NULL THEN ${input.projectId ?? null}::uuid ELSE project_id END,project_override=coalesce(${input.projectOverride ?? null}::boolean,project_override) WHERE (${input.projectId ?? null}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId ?? null} AND user_id=${userId})) AND id=ANY(${ids}::uuid[]) AND user_id=${userId} RETURNING id`
  if (!rows.length) throw new RadarError('Funde nicht gefunden.', 404)
  return { ok: true }
}
