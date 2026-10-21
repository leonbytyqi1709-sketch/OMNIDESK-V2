import { monitoringSql } from './neon-storage'
import { HistoryError, historyFields } from './history-policy'
import type {
  HistoryComparison,
  HistoryDetail,
  HistoryEntry,
  HistoryField,
  HistoryKind,
  HistorySettings,
} from '../src/types/working-history'

export const historyDdl = [
  `CREATE TABLE IF NOT EXISTS v2_history_settings(user_id text PRIMARY KEY,enabled boolean NOT NULL DEFAULT true,retention_days integer NOT NULL DEFAULT 90 CHECK(retention_days IN (7,30,90,365)),max_versions integer NOT NULL DEFAULT 50 CHECK(max_versions IN (10,25,50)))`,
  `CREATE TABLE IF NOT EXISTS v2_history_heads(user_id text NOT NULL,kind text NOT NULL,object_id uuid NOT NULL,revision integer NOT NULL,PRIMARY KEY(user_id,kind,object_id))`,
  `CREATE TABLE IF NOT EXISTS v2_working_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('note','task','project_task')),object_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,operation text NOT NULL,source text NOT NULL,captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(user_id,kind,object_id,revision))`,
  `CREATE INDEX IF NOT EXISTS v2_working_history_lookup ON v2_working_history(user_id,kind,object_id,captured_at DESC)`,
  `CREATE OR REPLACE FUNCTION public.omnidesk_history_snapshot_v2(k text,r jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $history$
    SELECT CASE k WHEN 'note' THEN jsonb_build_object('title',r->'title','content',r->'content')
      WHEN 'task' THEN jsonb_build_object('title',r->'title','description',r->'description','priority',r->'priority','status',r->'status','dueDate',r->'due_date','tags',r->'tags','subtasks',r->'subtasks')
      WHEN 'project_task' THEN jsonb_build_object('title',r->'title','status',r->'status','priority',r->'priority') END
    $history$`,
  `CREATE OR REPLACE FUNCTION public.omnidesk_history_prune_v2(u text) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $history$
    DELETE FROM public.v2_working_history WHERE id IN (
      SELECT id FROM (SELECT h.id,h.captured_at,row_number() OVER(PARTITION BY h.kind,h.object_id ORDER BY h.revision DESC) AS n,
        coalesce(s.retention_days,90) AS days,coalesce(s.max_versions,50) AS cap
        FROM public.v2_working_history h LEFT JOIN public.v2_history_settings s ON s.user_id=h.user_id WHERE h.user_id=u) q
      WHERE captured_at<clock_timestamp()-days*interval '1 day' OR n>cap)
    $history$`,
  `CREATE OR REPLACE FUNCTION public.omnidesk_history_record_v2(u text,k text,o uuid,s jsonb,op text,src text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $history$
    DECLARE n integer;
    BEGIN
      INSERT INTO public.v2_history_heads(user_id,kind,object_id,revision) VALUES(u,k,o,1)
      ON CONFLICT(user_id,kind,object_id) DO UPDATE SET revision=v2_history_heads.revision+1 RETURNING revision INTO n;
      INSERT INTO public.v2_working_history(user_id,kind,object_id,revision,snapshot,operation,source) VALUES(u,k,o,n,s,op,src);
    END $history$`,
  `CREATE OR REPLACE FUNCTION public.omnidesk_history_capture_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $history$
    DECLARE k text:=TG_ARGV[0];u text;o uuid;before_state jsonb;after_state jsonb;src text;active boolean;days integer;cap integer;
    BEGIN
      IF TG_OP='DELETE' THEN
        PERFORM pg_advisory_xact_lock_shared(hashtextextended('working-history:'||OLD.user_id,0));
        DELETE FROM public.v2_working_history WHERE user_id=OLD.user_id AND kind=k AND object_id=OLD.id;
        DELETE FROM public.v2_history_heads WHERE user_id=OLD.user_id AND kind=k AND object_id=OLD.id;
        RETURN OLD;
      END IF;
      u:=NEW.user_id;o:=NEW.id;
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('working-history:'||u,0));
      IF TG_OP='UPDATE' AND OLD.user_id IS DISTINCT FROM u THEN
        DELETE FROM public.v2_working_history WHERE user_id=OLD.user_id AND kind=k AND object_id=o;
        DELETE FROM public.v2_history_heads WHERE user_id=OLD.user_id AND kind=k AND object_id=o;
      END IF;
      SELECT coalesce(s.enabled,true),coalesce(s.retention_days,90),coalesce(s.max_versions,50) INTO active,days,cap FROM (SELECT 1) q LEFT JOIN public.v2_history_settings s ON s.user_id=u;
      IF NOT active THEN RETURN NEW; END IF;
      IF k='project_task' THEN
        IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.user_id=u) THEN RETURN NEW; END IF;
      END IF;
      after_state:=public.omnidesk_history_snapshot_v2(k,to_jsonb(NEW));
      src:=coalesce(nullif(current_setting('omnidesk.history_source',true),''),'module');
      IF src NOT IN ('module','omni','restore') THEN src:='module'; END IF;
      IF TG_OP='UPDATE' AND OLD.user_id=u THEN
        before_state:=public.omnidesk_history_snapshot_v2(k,to_jsonb(OLD));
        IF before_state=after_state THEN RETURN NEW; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.v2_history_heads WHERE user_id=u AND kind=k AND object_id=o) THEN
          PERFORM public.omnidesk_history_record_v2(u,k,o,before_state,'baseline','module');
        END IF;
      END IF;
      PERFORM public.omnidesk_history_record_v2(u,k,o,after_state,CASE WHEN src='restore' THEN 'restored' WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,src);
      DELETE FROM public.v2_working_history WHERE user_id=u AND kind=k AND object_id=o AND
        (captured_at<clock_timestamp()-days*interval '1 day' OR id IN(SELECT id FROM public.v2_working_history WHERE user_id=u AND kind=k AND object_id=o ORDER BY revision DESC OFFSET cap));
      RETURN NEW;
    END $history$`,
  ...(
    [
      ['notes', 'note'],
      ['tasks', 'task'],
      ['project_tasks', 'project_task'],
    ] as const
  ).map(
    ([table, kind]) =>
      `DO $history$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='v2_history_${table}' AND tgrelid='public.${table}'::regclass) THEN CREATE TRIGGER v2_history_${table} AFTER INSERT OR UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.omnidesk_history_capture_v2('${kind}'); END IF; END $history$`,
  ),
]
export async function initializeWorkingHistory() {
  const sql = monitoringSql()
  const [state] =
    await sql`SELECT to_regclass('public.v2_working_history_lookup') IS NOT NULL AND to_regclass('public.v2_history_settings') IS NOT NULL AND to_regclass('public.v2_history_heads') IS NOT NULL AND (SELECT count(*) FROM pg_trigger WHERE tgname IN ('v2_history_notes','v2_history_tasks','v2_history_project_tasks') AND NOT tgisinternal)=3 AS ready`
  if (!state?.ready)
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(184730024)`,
      ...historyDdl.map((s) => sql.query(s)),
    ])
}
export async function readHistorySettings(
  userId: string,
): Promise<HistorySettings> {
  await initializeWorkingHistory()
  const sql = monitoringSql()
  const [, , rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`working-history:${userId}`},0))`,
    sql`SELECT public.omnidesk_history_prune_v2(${userId})`,
    sql`SELECT enabled,retention_days AS "retentionDays",max_versions AS "maxVersions" FROM v2_history_settings WHERE user_id=${userId}`,
  ])
  const [row] = rows
  return (
    (row as unknown as HistorySettings) ?? {
      enabled: true,
      retentionDays: 90,
      maxVersions: 50,
    }
  )
}
export async function saveHistorySettings(
  userId: string,
  input: HistorySettings,
) {
  await initializeWorkingHistory()
  const sql = monitoringSql()
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`working-history:${userId}`},0))`,
    sql`INSERT INTO v2_history_settings(user_id,enabled,retention_days,max_versions) VALUES(${userId},${input.enabled},${input.retentionDays},${input.maxVersions}) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,retention_days=excluded.retention_days,max_versions=excluded.max_versions`,
    sql`SELECT public.omnidesk_history_prune_v2(${userId})`,
  ])
  return input
}
export async function clearWorkingHistory(userId: string) {
  await initializeWorkingHistory()
  const sql = monitoringSql()
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`working-history:${userId}`},0))`,
    sql`DELETE FROM v2_working_history WHERE user_id=${userId}`,
    sql`DELETE FROM v2_history_heads WHERE user_id=${userId}`,
  ])
}
const currentObjects = `SELECT 'note'::text AS kind,n.id,n.user_id,n.title,NULL::uuid AS project_id FROM notes n
  UNION ALL SELECT 'task',t.id,t.user_id,t.title,NULL::uuid FROM tasks t
  UNION ALL SELECT 'project_task',t.id,t.user_id,t.title,t.project_id FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id`
export async function historyTimeline(
  userId: string,
  kind: HistoryKind | null,
  search: string,
) {
  await initializeWorkingHistory()
  const sql = monitoringSql()
  const rows = await sql.query(
    `WITH objects AS (${currentObjects}) SELECT h.id,h.kind,h.object_id AS "objectId",h.snapshot->>'title' AS title,h.revision,h.operation,h.source,h.captured_at AS "capturedAt",o.project_id AS "projectId"
    FROM v2_working_history h JOIN objects o ON o.id=h.object_id AND o.kind=h.kind AND o.user_id=h.user_id LEFT JOIN v2_history_settings s ON s.user_id=h.user_id
    WHERE h.user_id=$1 AND ($2::text IS NULL OR h.kind=$2) AND (strpos(lower(h.snapshot->>'title'),lower($3))>0 OR strpos(lower(o.title),lower($3))>0)
    AND h.captured_at>=clock_timestamp()-coalesce(s.retention_days,90)*interval '1 day' ORDER BY h.captured_at DESC,h.id LIMIT 101`,
    [userId, kind, search],
  )
  return {
    entries: rows.slice(0, 100) as unknown as HistoryEntry[],
    limited: rows.length > 100,
  }
}
const tables = {
  note: 'notes',
  task: 'tasks',
  project_task: 'project_tasks',
} as const
async function currentObject(userId: string, kind: HistoryKind, id: string) {
  const sql = monitoringSql(),
    table = tables[kind]
  const [row] = await sql.query(
    `SELECT md5(to_jsonb(o)::text) AS fingerprint,public.omnidesk_history_snapshot_v2($1,to_jsonb(o)) AS snapshot,${kind === 'project_task' ? 'o.project_id' : 'NULL::uuid'} AS "projectId"
    FROM ${table} o WHERE o.id=$2 AND o.user_id=$3 ${kind === 'project_task' ? 'AND EXISTS(SELECT 1 FROM projects p WHERE p.id=o.project_id AND p.user_id=o.user_id)' : ''}`,
    [kind, id, userId],
  )
  if (!row) throw new HistoryError('Eintrag nicht mehr zugänglich.', 404)
  return row as unknown as HistoryDetail['current']
}
// Details and comparison use a read-only repeatable snapshot so owner/source checks
// and historical contents cannot come from different moments.
export async function historyDetail(
  userId: string,
  kind: HistoryKind,
  id: string,
): Promise<HistoryDetail> {
  await initializeWorkingHistory()
  const sql = monitoringSql(),
    table = tables[kind]
  const [row] = await sql.query(
    `SELECT jsonb_build_object('fingerprint',md5(to_jsonb(o)::text),'snapshot',public.omnidesk_history_snapshot_v2($1,to_jsonb(o)),'projectId',${kind === 'project_task' ? 'o.project_id' : 'NULL::uuid'}) AS current,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'kind',h.kind,'objectId',h.object_id,'title',h.snapshot->>'title','revision',h.revision,'operation',h.operation,'source',h.source,'capturedAt',h.captured_at,'projectId',${kind === 'project_task' ? 'o.project_id' : 'NULL::uuid'}) ORDER BY h.revision DESC)
      FROM v2_working_history h LEFT JOIN v2_history_settings s ON s.user_id=h.user_id WHERE h.user_id=$3 AND h.kind=$1 AND h.object_id=$2 AND h.captured_at>=clock_timestamp()-coalesce(s.retention_days,90)*interval '1 day'),'[]'::jsonb) AS versions
    FROM ${table} o WHERE o.id=$2 AND o.user_id=$3 ${kind === 'project_task' ? 'AND EXISTS(SELECT 1 FROM projects p WHERE p.id=o.project_id AND p.user_id=o.user_id)' : ''}`,
    [kind, id, userId],
  )
  if (!row) throw new HistoryError('Eintrag nicht mehr zugänglich.', 404)
  return row as unknown as HistoryDetail
}
export async function compareHistory(
  userId: string,
  kind: HistoryKind,
  id: string,
  versionId: string,
): Promise<HistoryComparison> {
  await initializeWorkingHistory()
  const sql = monitoringSql(),
    table = tables[kind]
  const [row] = await sql.query(
    `SELECT jsonb_build_object('fingerprint',md5(to_jsonb(o)::text),'snapshot',public.omnidesk_history_snapshot_v2($1,to_jsonb(o)),'projectId',${kind === 'project_task' ? 'o.project_id' : 'NULL::uuid'}) AS current,
    jsonb_build_object('id',h.id,'kind',h.kind,'objectId',h.object_id,'title',h.snapshot->>'title','revision',h.revision,'operation',h.operation,'source',h.source,'capturedAt',h.captured_at,'projectId',${kind === 'project_task' ? 'o.project_id' : 'NULL::uuid'}) AS version,h.snapshot
    FROM ${table} o JOIN v2_working_history h ON h.object_id=o.id AND h.kind=$1 AND h.user_id=o.user_id LEFT JOIN v2_history_settings s ON s.user_id=h.user_id
    WHERE o.id=$2 AND o.user_id=$3 AND h.id=$4 AND h.captured_at>=clock_timestamp()-coalesce(s.retention_days,90)*interval '1 day'
    ${kind === 'project_task' ? 'AND EXISTS(SELECT 1 FROM projects p WHERE p.id=o.project_id AND p.user_id=o.user_id)' : ''}`,
    [kind, id, userId, versionId],
  )
  if (!row)
    throw new HistoryError(
      'Version nicht mehr zugänglich oder bereits entfernt.',
      404,
    )
  return row as unknown as HistoryComparison
}
export async function restoreHistory(
  userId: string,
  kind: HistoryKind,
  id: string,
  versionId: string,
  expectedFingerprint: string,
  fields: HistoryField[],
) {
  if (!fields.length || fields.some((f) => !historyFields[kind].includes(f)))
    throw new HistoryError(
      'Diese Felder lassen sich hier nicht wiederherstellen.',
      400,
    )
  await initializeWorkingHistory()
  const sql = monitoringSql(),
    table = tables[kind]
  // The fixed field mapping is the only source of SQL identifiers. User strings
  // never enter identifiers or SQL expressions.
  const columns: Record<HistoryField, string> = {
    title: 'title',
    content: 'content',
    description: 'description',
    status: 'status',
    priority: 'priority',
    dueDate: 'due_date',
    tags: 'tags',
    subtasks: 'subtasks',
  }
  const setters = [...new Set(fields)].map(
    (f) =>
      `${columns[f]}=${f === 'tags' || f === 'subtasks' ? `NULLIF(h.snapshot->'${f}','null'::jsonb)` : f === 'dueDate' ? `(h.snapshot->>'dueDate')::timestamptz` : `h.snapshot->>'${f}'`}`,
  )
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`working-history:${userId}`},0)),set_config('omnidesk.history_source','restore',true)`,
    sql.query(
      `UPDATE ${table} o SET ${setters.join(',')},updated_at=clock_timestamp() FROM v2_working_history h
      WHERE o.id=$1 AND o.user_id=$2 AND md5(to_jsonb(o)::text)=$3 AND h.id=$4 AND h.user_id=o.user_id AND h.kind=$5 AND h.object_id=o.id
      AND h.captured_at>=clock_timestamp()-coalesce((SELECT retention_days FROM v2_history_settings WHERE user_id=$2),90)*interval '1 day'
      AND coalesce((SELECT enabled FROM v2_history_settings WHERE user_id=$2),true)
      ${kind === 'project_task' ? 'AND EXISTS(SELECT 1 FROM projects p WHERE p.id=o.project_id AND p.user_id=o.user_id)' : ''} RETURNING o.id`,
      [id, userId, expectedFingerprint, versionId, kind],
    ),
  ])
  if (!rows.length)
    throw new HistoryError(
      'Eintrag wurde inzwischen verändert, Verlauf pausiert oder Version entfernt. Bitte neu laden; nichts wurde überschrieben.',
    )
  return currentObject(userId, kind, id)
}
