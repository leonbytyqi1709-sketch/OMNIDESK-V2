import { monitoringSql } from './neon-storage'
import {
  OmniMemoryError,
  type createMemorySchema,
  type updateMemorySchema,
} from './omni-memory-policy'
import type { z } from 'zod'
import type { OmniMemory, MemoryVersion } from '../src/types/omni-memory'
export const omniMemoryDdl = [
  `CREATE TABLE IF NOT EXISTS v2_omni_memories(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,content text NOT NULL,category text NOT NULL CHECK(category IN ('preference','knowledge','decision')),project_id uuid,pinned boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,source_message_id uuid,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_omni_memories_owner_idx ON v2_omni_memories(user_id,updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS v2_omni_memory_versions(memory_id uuid NOT NULL REFERENCES v2_omni_memories(id) ON DELETE CASCADE,user_id text NOT NULL,version integer NOT NULL,title text NOT NULL,content text NOT NULL,category text NOT NULL,project_id uuid,pinned boolean NOT NULL,archived boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(memory_id,version))`,
  `CREATE TABLE IF NOT EXISTS v2_omni_memory_receipts(message_id uuid PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,user_id text NOT NULL,status text NOT NULL CHECK(status IN ('used','none','disabled','unavailable')),project_id uuid,refs jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now())`,
]
export async function initializeOmniMemory() {
  const sql = monitoringSql()
  const [exists] =
    await sql`SELECT to_regclass('v2_omni_memories') IS NOT NULL AND to_regclass('v2_omni_memory_versions') IS NOT NULL AND to_regclass('v2_omni_memory_receipts') IS NOT NULL AS ready`
  if (exists?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730028)`,
    ...omniMemoryDdl.map((ddl) => sql.query(ddl)),
  ])
}
export async function memoryIsReady() {
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT to_regclass('v2_omni_memories') IS NOT NULL AND to_regclass('v2_omni_memory_receipts') IS NOT NULL AS ready`
  return Boolean(row?.ready)
}
function serialize(row: Record<string, unknown>): OmniMemory {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: row.category as OmniMemory['category'],
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    projectMissing: Boolean(row.project_id && !row.project_name),
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    version: Number(row.version),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    sourceMessageId: row.source_id ? String(row.source_id) : null,
    sourceSessionId: row.source_session_id
      ? String(row.source_session_id)
      : null,
    sourceRole: (row.source_role as OmniMemory['sourceRole']) ?? null,
    sourceMissing: Boolean(row.source_message_id && !row.source_id),
  }
}
export async function readOmniMemories(userId: string) {
  await initializeOmniMemory()
  const sql = monitoringSql()
  return (
    await sql`SELECT m.*,p.name AS project_name,msg.id AS source_id,msg.session_id AS source_session_id,msg.role AS source_role FROM v2_omni_memories m LEFT JOIN projects p ON p.id=m.project_id AND p.user_id=m.user_id LEFT JOIN (chat_messages msg JOIN chat_sessions s ON s.id=msg.session_id AND s.user_id=${userId}) ON msg.id=m.source_message_id WHERE m.user_id=${userId} ORDER BY m.pinned DESC,m.updated_at DESC,m.id LIMIT 500`
  ).map(serialize)
}
export async function createOmniMemory(
  userId: string,
  input: z.infer<typeof createMemorySchema>,
) {
  await initializeOmniMemory()
  const sql = monitoringSql()
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730029))`,
    sql`WITH added AS(INSERT INTO v2_omni_memories(id,user_id,title,content,category,project_id,pinned,archived,source_message_id)
   SELECT ${input.id},${userId},${input.title},${input.content},${input.category},${input.projectId},${input.pinned},${input.archived},${input.sourceMessageId}
   WHERE (SELECT count(*) FROM v2_omni_memories WHERE user_id=${userId})<500
    AND (${input.projectId}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId} AND user_id=${userId}))
    AND (${input.sourceMessageId}::uuid IS NULL OR EXISTS(SELECT 1 FROM chat_messages msg JOIN chat_sessions s ON s.id=msg.session_id WHERE msg.id=${input.sourceMessageId} AND s.user_id=${userId} AND msg.role IN ('user','assistant')))
   ON CONFLICT(id) DO NOTHING RETURNING *)
   INSERT INTO v2_omni_memory_versions(memory_id,user_id,version,title,content,category,project_id,pinned,archived) SELECT id,user_id,version,title,content,category,project_id,pinned,archived FROM added RETURNING memory_id`,
    sql`SELECT id FROM v2_omni_memories WHERE id=${input.id} AND user_id=${userId}`,
  ])
  if (!results[2].length)
    throw new OmniMemoryError(
      'Erinnerung konnte nicht gespeichert werden. Projekt/Chatquelle muss dir gehören; höchstens 500 Einträge einschließlich Archiv.',
      409,
    )
  return { id: input.id }
}
export async function updateOmniMemory(
  userId: string,
  id: string,
  input: z.infer<typeof updateMemorySchema>,
) {
  const sql = monitoringSql()
  const rows =
    await sql`WITH changed AS(UPDATE v2_omni_memories SET title=${input.title},content=${input.content},category=${input.category},project_id=${input.projectId},pinned=${input.pinned},archived=${input.archived},version=version+1,updated_at=clock_timestamp() WHERE id=${id} AND user_id=${userId} AND version=${input.version} AND (${input.projectId}::uuid IS NULL OR project_id=${input.projectId}::uuid OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId} AND user_id=${userId})) RETURNING *) INSERT INTO v2_omni_memory_versions(memory_id,user_id,version,title,content,category,project_id,pinned,archived) SELECT id,user_id,version,title,content,category,project_id,pinned,archived FROM changed RETURNING memory_id`
  if (!rows.length)
    throw new OmniMemoryError(
      'Eintrag zwischenzeitlich geändert, entfernt oder Projekt nicht verfügbar. Bitte neu laden.',
      409,
    )
  return { ok: true }
}
export async function deleteOmniMemory(
  userId: string,
  id: string,
  version: number,
) {
  const sql = monitoringSql()
  const rows =
    await sql`DELETE FROM v2_omni_memories WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length)
    throw new OmniMemoryError(
      'Eintrag zwischenzeitlich geändert oder entfernt. Bitte neu laden.',
      409,
    )
  return { ok: true }
}
export async function readMemoryVersions(
  userId: string,
  id: string,
): Promise<MemoryVersion[]> {
  const sql = monitoringSql()
  const rows =
    await sql`SELECT v.* FROM v2_omni_memory_versions v JOIN v2_omni_memories m ON m.id=v.memory_id AND m.user_id=v.user_id WHERE v.memory_id=${id} AND v.user_id=${userId} ORDER BY v.version DESC LIMIT 50`
  return rows.map((row) => ({
    title: String(row.title),
    content: String(row.content),
    category: row.category as MemoryVersion['category'],
    projectId: row.project_id ? String(row.project_id) : null,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    version: Number(row.version),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }))
}
