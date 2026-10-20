import { randomUUID } from 'node:crypto'
import { monitoringSql } from './neon-storage'
import { initializeOmniMemory } from './omni-memory-storage'
import { OmniMemoryError } from './omni-memory-policy'
import type { AutoMemoryEvent, AutoMemoryState } from '../src/types/omni-memory'
export const autoMemoryDdl = [
  `CREATE TABLE IF NOT EXISTS v2_omni_memory_captures(source_id uuid PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,assistant_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,user_id text NOT NULL,project_id uuid,status text NOT NULL CHECK(status IN ('processing','done','failed')),created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_omni_memory_auto_events(id uuid PRIMARY KEY,user_id text NOT NULL,source_id uuid NOT NULL REFERENCES v2_omni_memory_captures(source_id) ON DELETE CASCADE,slot integer NOT NULL,project_id uuid,target_id uuid NOT NULL,target_version integer,memory_id uuid REFERENCES v2_omni_memories(id) ON DELETE CASCADE,saved_version integer,status text NOT NULL CHECK(status IN ('pending','saved','dismissed')),proposal jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source_id,slot))`,
  `CREATE INDEX IF NOT EXISTS v2_omni_memory_auto_owner_idx ON v2_omni_memory_auto_events(user_id,created_at DESC)`,
]
export async function initializeAutoMemory() {
  await initializeOmniMemory()
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT to_regclass('v2_omni_memory_captures') IS NOT NULL AND to_regclass('v2_omni_memory_auto_events') IS NOT NULL AS ready`
  if (row?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730030)`,
    ...autoMemoryDdl.map((ddl) => sql.query(ddl)),
  ])
}
export async function claimAutoCapture(
  userId: string,
  sourceId: string,
  assistantId: string,
  projectId: string | null,
) {
  const sql = monitoringSql()
  const rows =
    await sql`INSERT INTO v2_omni_memory_captures(source_id,assistant_id,user_id,project_id,status) SELECT u.id,a.id,${userId},${projectId},'processing' FROM chat_messages u JOIN chat_messages a ON a.session_id=u.session_id JOIN chat_sessions s ON s.id=u.session_id WHERE u.id=${sourceId} AND a.id=${assistantId} AND u.role='user' AND a.role='assistant' AND s.user_id=${userId} AND (${projectId}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${projectId} AND user_id=${userId})) ON CONFLICT(source_id) DO NOTHING RETURNING source_id`
  return Boolean(rows.length)
}
export async function finishAutoCapture(
  userId: string,
  sourceId: string,
  failed = false,
) {
  const sql = monitoringSql()
  await sql`UPDATE v2_omni_memory_captures SET status=${failed ? 'failed' : 'done'} WHERE source_id=${sourceId} AND user_id=${userId}`
}
export async function createAutoEvent(
  userId: string,
  sourceId: string,
  slot: number,
  projectId: string | null,
  proposal: { title: string; content: string; category: string },
  target: { id: string; version: number } | null,
) {
  const sql = monitoringSql()
  const id = randomUUID(),
    targetId = target?.id ?? randomUUID()
  const rows =
    await sql`INSERT INTO v2_omni_memory_auto_events(id,user_id,source_id,slot,project_id,target_id,target_version,memory_id,status,proposal) SELECT ${id},${userId},source_id,${slot},${projectId},${targetId},${target?.version ?? null},${target?.id ?? null},'pending',${JSON.stringify(proposal)}::jsonb FROM v2_omni_memory_captures WHERE source_id=${sourceId} AND user_id=${userId} AND project_id IS NOT DISTINCT FROM ${projectId}::uuid ON CONFLICT(source_id,slot) DO NOTHING RETURNING id`
  return rows[0] ? String(rows[0].id) : null
}
export async function applyAutoMemoryEvent(userId: string, id: string) {
  const sql = monitoringSql()
  const [event] =
    await sql`SELECT target_version FROM v2_omni_memory_auto_events WHERE id=${id} AND user_id=${userId}`
  if (!event)
    throw new OmniMemoryError('Gedächtnisvorschlag nicht gefunden.', 404)
  const locked = sql`SELECT e.* FROM v2_omni_memory_auto_events e WHERE e.id=${id} AND e.user_id=${userId} AND e.status='pending' AND e.proposal IS NOT NULL AND (e.project_id IS NULL OR EXISTS(SELECT 1 FROM projects p WHERE p.id=e.project_id AND p.user_id=${userId})) FOR UPDATE`
  // Fixed parameterized branches; every write and version snapshot occurs in the same statement.
  const mutation =
    event.target_version == null
      ? sql`WITH e AS(${locked}),changed AS(INSERT INTO v2_omni_memories(id,user_id,title,content,category,project_id,source_message_id)
 SELECT target_id,user_id,proposal->>'title',proposal->>'content',proposal->>'category',project_id,source_id FROM e WHERE (SELECT count(*) FROM v2_omni_memories WHERE user_id=${userId})<500 AND NOT EXISTS(SELECT 1 FROM v2_omni_memories m WHERE m.user_id=${userId} AND m.project_id IS NOT DISTINCT FROM e.project_id AND lower(regexp_replace(trim(m.content),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(e.proposal->>'content'),'[[:space:]]+',' ','g'))) RETURNING *),v AS(INSERT INTO v2_omni_memory_versions(memory_id,user_id,version,title,content,category,project_id,pinned,archived) SELECT id,user_id,version,title,content,category,project_id,pinned,archived FROM changed RETURNING memory_id,version)
 UPDATE v2_omni_memory_auto_events SET status='saved',memory_id=v.memory_id,saved_version=v.version,proposal=NULL FROM v WHERE id=${id} AND user_id=${userId} RETURNING id`
      : sql`WITH e AS(${locked}),changed AS(UPDATE v2_omni_memories m SET title=e.proposal->>'title',content=e.proposal->>'content',category=e.proposal->>'category',source_message_id=e.source_id,version=m.version+1,updated_at=clock_timestamp() FROM e WHERE m.id=e.target_id AND m.user_id=e.user_id AND m.version=e.target_version AND m.archived=false AND m.project_id IS NOT DISTINCT FROM e.project_id RETURNING m.*),v AS(INSERT INTO v2_omni_memory_versions(memory_id,user_id,version,title,content,category,project_id,pinned,archived) SELECT id,user_id,version,title,content,category,project_id,pinned,archived FROM changed RETURNING memory_id,version)
 UPDATE v2_omni_memory_auto_events SET status='saved',memory_id=v.memory_id,saved_version=v.version,proposal=NULL FROM v WHERE id=${id} AND user_id=${userId} RETURNING id`
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730029))`,
    mutation,
    sql`SELECT status FROM v2_omni_memory_auto_events WHERE id=${id} AND user_id=${userId}`,
  ])
  if (results[2][0]?.status !== 'saved')
    throw new OmniMemoryError(
      'Eintrag inzwischen geändert, archiviert, bereits vorhanden oder Speicher voll. Bitte im Gedächtnis prüfen.',
      409,
    )
  return { ok: true }
}
export async function dismissAutoMemoryEvent(userId: string, id: string) {
  const sql = monitoringSql()
  const rows =
    await sql`UPDATE v2_omni_memory_auto_events SET status='dismissed',proposal=NULL WHERE id=${id} AND user_id=${userId} AND status='pending' RETURNING id`
  if (!rows.length)
    throw new OmniMemoryError('Vorschlag nicht mehr offen.', 409)
  return { ok: true }
}
export async function readAutoMemoryStates(
  userId: string,
  sessionId: string,
): Promise<Record<string, AutoMemoryState>> {
  try {
    const sql = monitoringSql()
    const [ready] =
      await sql`SELECT to_regclass('v2_omni_memory_auto_events') IS NOT NULL AS ready`
    if (!ready?.ready) return {}
    const captures =
      await sql`SELECT c.* FROM v2_omni_memory_captures c JOIN chat_messages msg ON msg.id=c.assistant_id JOIN chat_sessions s ON s.id=msg.session_id WHERE c.user_id=${userId} AND s.user_id=${userId} AND s.id=${sessionId}`
    const rows =
      await sql`SELECT e.*,m.title,m.content,m.version AS current_version,m.archived,m.category,m.project_id AS current_project FROM v2_omni_memory_auto_events e JOIN v2_omni_memory_captures c ON c.source_id=e.source_id JOIN chat_messages msg ON msg.id=c.assistant_id JOIN chat_sessions s ON s.id=msg.session_id LEFT JOIN v2_omni_memories m ON m.id=e.memory_id AND m.user_id=e.user_id WHERE e.user_id=${userId} AND s.user_id=${userId} AND s.id=${sessionId} AND e.status<>'dismissed' ORDER BY e.created_at,e.slot`
    return Object.fromEntries(
      captures.map((c) => [
        String(c.assistant_id),
        {
          status:
            c.status === 'done'
              ? 'done'
              : c.status === 'failed'
                ? 'unavailable'
                : 'processing',
          events: rows
            .filter((e) => e.source_id === c.source_id)
            .map((e) => ({
              id: String(e.id),
              status: e.status as AutoMemoryEvent['status'],
              memoryId: e.memory_id ? String(e.memory_id) : null,
              targetId: String(e.target_id),
              targetVersion:
                e.target_version == null ? null : Number(e.target_version),
              savedVersion:
                e.saved_version == null ? null : Number(e.saved_version),
              currentVersion:
                e.current_version == null ? null : Number(e.current_version),
              title: String(e.status === 'saved' ? e.title : e.proposal.title),
              content: String(
                e.status === 'saved' ? e.content : e.proposal.content,
              ),
              previousContent:
                e.target_version != null && e.status === 'pending' && e.content
                  ? String(e.content)
                  : null,
              category: e.status === 'saved' ? e.category : e.proposal.category,
              projectId: e.project_id ? String(e.project_id) : null,
              changed:
                e.status === 'saved'
                  ? Number(e.current_version) !== Number(e.saved_version)
                  : e.target_version != null &&
                    Number(e.current_version) !== Number(e.target_version),
              archived: Boolean(e.archived),
            })),
        },
      ]),
    )
  } catch {
    return {}
  }
}
