import { createHash } from 'node:crypto'
import { z } from 'zod'
import { monitoringSql } from './neon-storage'
import { HistoryError, historyKind } from './history-policy'
import type { HistoryKind } from '../src/types/working-history'
import type {
  MissionRecord,
  MissionRecordInput,
  MissionRecordSummary,
  MissionReference,
} from '../src/types/mission-records'
export const missionRecordInput = z
  .object({
    title: z.string().trim().min(1).max(300),
    projectId: z.uuid().nullable(),
    state: z.enum(['active', 'paused', 'archived']),
    context: z.string().trim().max(5000),
    decisions: z.string().trim().max(5000),
    outcome: z.string().trim().max(5000),
    questions: z.string().trim().max(5000),
    nextSteps: z.string().trim().max(5000),
    sources: z
      .array(z.object({ kind: historyKind, id: z.uuid() }).strict())
      .max(30),
  })
  .strict()
  .refine((v) => v.state !== 'archived' || v.outcome.length > 0, {
    message: 'Für den Archivabschluss ein Ergebnis festhalten.',
  })
export const missionRecordsDdl = [
  `CREATE TABLE IF NOT EXISTS v2_mission_records(id uuid PRIMARY KEY,user_id text NOT NULL,creation_hash text NOT NULL,title text NOT NULL,project_id uuid REFERENCES projects(id) ON DELETE SET NULL,state text NOT NULL CHECK(state IN ('active','paused','archived')),context text NOT NULL,decisions text NOT NULL,outcome text NOT NULL,questions text NOT NULL,next_steps text NOT NULL,sources jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),archived_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS v2_mission_records_owner ON v2_mission_records(user_id,state,updated_at DESC)`,
]
export async function initializeMissionRecords() {
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT to_regclass('v2_mission_records_owner') IS NOT NULL AS ready`
  if (!row?.ready)
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(184730031)`,
      ...missionRecordsDdl.map((d) => sql.query(d)),
    ])
}
const sourceObjects = `SELECT 'note'::text AS kind,n.id,n.user_id,n.title,NULL::uuid AS project_id FROM notes n UNION ALL SELECT 'task',t.id,t.user_id,t.title,NULL::uuid FROM tasks t UNION ALL SELECT 'project_task',t.id,t.user_id,t.title,t.project_id FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id`
export async function missionReferenceChoices(
  userId: string,
  kind: HistoryKind,
  search: string,
) {
  const rows = await monitoringSql().query(
    `WITH objects AS(${sourceObjects}) SELECT kind,id,title,project_id AS "projectId",true AS available FROM objects WHERE user_id=$1 AND kind=$2 AND strpos(lower(title),lower($3))>0 ORDER BY title,id LIMIT 51`,
    [userId, kind, search],
  )
  return {
    sources: rows.slice(0, 50) as unknown as MissionReference[],
    limited: rows.length > 50,
  }
}
export async function missionRecordProjects(userId: string) {
  return (await monitoringSql()`SELECT id,name FROM projects WHERE user_id=${userId} ORDER BY name,id`) as {
    id: string
    name: string
  }[]
}
export async function listMissionRecords(
  userId: string,
  state: string | null,
  search: string,
) {
  await initializeMissionRecords()
  const rows =
    await monitoringSql()`SELECT r.id,r.title,r.state,p.name AS "projectName",r.updated_at AS "updatedAt",r.archived_at AS "archivedAt" FROM v2_mission_records r LEFT JOIN projects p ON p.id=r.project_id AND p.user_id=r.user_id
  WHERE r.user_id=${userId} AND (${state}::text IS NULL OR r.state=${state}) AND (strpos(lower(r.title||' '||r.context||' '||r.decisions||' '||r.outcome||' '||r.questions||' '||r.next_steps),lower(${search}))>0) ORDER BY r.updated_at DESC,r.id LIMIT 101`
  return {
    records: rows.slice(0, 100) as unknown as MissionRecordSummary[],
    limited: rows.length > 100,
  }
}
export async function readMissionRecord(
  userId: string,
  id: string,
): Promise<MissionRecord> {
  await initializeMissionRecords()
  const [row] = await monitoringSql().query(
    `WITH objects AS(${sourceObjects}) SELECT r.id,r.title,p.id AS "projectId",p.name AS "projectName",r.state,r.context,r.decisions,r.outcome,r.questions,r.next_steps AS "nextSteps",r.version,r.updated_at AS "updatedAt",r.archived_at AS "archivedAt",
    coalesce((SELECT jsonb_agg(jsonb_build_object('kind',x.kind,'id',x.id,'title',o.title,'projectId',o.project_id,'available',o.id IS NOT NULL)) FROM jsonb_to_recordset(r.sources) x(kind text,id uuid) LEFT JOIN objects o ON o.kind=x.kind AND o.id=x.id AND o.user_id=r.user_id),'[]'::jsonb) AS sources
    FROM v2_mission_records r LEFT JOIN projects p ON p.id=r.project_id AND p.user_id=r.user_id WHERE r.id=$1 AND r.user_id=$2`,
    [id, userId],
  )
  if (!row) throw new HistoryError('Arbeitsstand nicht mehr verfügbar.', 404)
  return row as unknown as MissionRecord
}
export async function writeMissionRecord(
  userId: string,
  id: string,
  input: MissionRecordInput,
  version: number | null,
) {
  await initializeMissionRecords()
  const sql = monitoringSql(),
    hash = createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    sources = JSON.stringify(input.sources)
  const guard = `($12::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=$12 AND user_id=$2)) AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset($13::jsonb) x(kind text,id uuid) WHERE NOT EXISTS(SELECT 1 FROM objects o WHERE o.user_id=$2 AND o.kind=x.kind AND o.id=x.id))`
  const params = [
    id,
    userId,
    input.title,
    input.state,
    input.context,
    input.decisions,
    input.outcome,
    input.questions,
    input.nextSteps,
    hash,
    version,
    input.projectId,
    sources,
  ]
  const statement =
    version === null
      ? `WITH objects AS(${sourceObjects}) INSERT INTO v2_mission_records(id,user_id,title,state,context,decisions,outcome,questions,next_steps,creation_hash,project_id,sources,archived_at)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$12::uuid,$13::jsonb,CASE WHEN $4='archived' THEN clock_timestamp() ELSE NULL END WHERE ${guard} AND (SELECT count(*) FROM v2_mission_records WHERE user_id=$2)<200
    ON CONFLICT(id) DO UPDATE SET id=v2_mission_records.id WHERE v2_mission_records.user_id=excluded.user_id AND v2_mission_records.creation_hash=excluded.creation_hash RETURNING id`
      : `WITH objects AS(${sourceObjects}) UPDATE v2_mission_records SET title=$3,state=$4,context=$5,decisions=$6,outcome=$7,questions=$8,next_steps=$9,project_id=$12::uuid,sources=$13::jsonb,version=version+1,updated_at=clock_timestamp(),archived_at=CASE WHEN $4='archived' THEN coalesce(archived_at,clock_timestamp()) ELSE NULL END WHERE id=$1 AND user_id=$2 AND version=$11 AND ${guard} RETURNING id`
  // Explicit casts for otherwise unused parameters keep Neon/PostgreSQL type inference stable.
  const casted = statement.replace(
    `WITH objects AS(${sourceObjects})`,
    `WITH unused AS(SELECT $10::text AS hash,$11::integer AS version),objects AS(${sourceObjects})`,
  )
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`mission-records:${userId}`},0))`,
    sql.query(casted, params),
  ])
  if (!rows.length)
    throw new HistoryError(
      'Arbeitsstand verändert, Quelle nicht zugänglich oder Grenze von 200 Einträgen erreicht. Bitte neu laden.',
    )
  return { id }
}
export async function deleteMissionRecord(
  userId: string,
  id: string,
  version: number,
) {
  const rows =
    await monitoringSql()`DELETE FROM v2_mission_records WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length)
    throw new HistoryError(
      'Arbeitsstand verändert oder nicht mehr verfügbar. Bitte neu laden.',
    )
}
