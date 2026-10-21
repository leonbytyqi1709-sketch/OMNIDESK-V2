import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { monitoringSql, missingNeonStorage } from './neon-storage'
import {
  RoomError,
  roomCreate,
  roomItemCreate,
  roomItemUpdate,
} from './rooms-policy'
import type { z } from 'zod'
import type {
  RoomDetail,
  RoomSource,
  SharedRoom,
} from '../src/types/shared-rooms'

export const roomDdl = [
  `CREATE TABLE IF NOT EXISTS v2_shared_rooms(id uuid PRIMARY KEY,owner_id text NOT NULL,creation_hash text NOT NULL,title text NOT NULL,description text NOT NULL,expires_at timestamptz NOT NULL,closed boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_shared_rooms_owner ON v2_shared_rooms(owner_id)`,
  `CREATE TABLE IF NOT EXISTS v2_room_members(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,user_id text NOT NULL,name text NOT NULL,role text NOT NULL CHECK(role IN ('reader','editor')),revoked boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,UNIQUE(room_id,user_id))`,
  `CREATE INDEX IF NOT EXISTS v2_room_members_user ON v2_room_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS v2_room_invites(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,role text NOT NULL CHECK(role IN ('reader','editor')),expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false,consumed_by text,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_room_items(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('list','pin')),text text NOT NULL,done boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_room_items_room ON v2_room_items(room_id)`,
]
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
export async function initializeRooms() {
  const sql = monitoringSql()
  const [state] =
    await sql`SELECT to_regclass('v2_shared_rooms_owner') IS NOT NULL AND to_regclass('v2_room_members_user') IS NOT NULL AND to_regclass('v2_room_invites') IS NOT NULL AND to_regclass('v2_room_items_room') IS NOT NULL AS ready`
  if (!state?.ready)
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(184730023)`,
      ...roomDdl.map((s) => sql.query(s)),
    ])
}
function denied(): never {
  throw new RoomError(
    'Nicht mehr zugänglich, verändert oder Grenze erreicht. Bitte neu laden.',
  )
}
// All writes, including revocations, joins and item writes, serialize per room.
// Permission checks run AFTER the lock, in the same transaction, across instances.
async function mutate(
  id: string,
  statement: ReturnType<ReturnType<typeof monitoringSql>>,
) {
  const sql = monitoringSql()
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`room:${id}`},0))`,
    statement,
  ])
  if (!rows.length) denied()
  return rows
}
export async function listRooms(userId: string): Promise<SharedRoom[]> {
  try {
    return (await monitoringSql()`SELECT r.id,r.title,r.description,r.expires_at AS "expiresAt",r.closed,r.version,
      CASE WHEN r.owner_id=${userId} THEN 'owner' ELSE m.role END AS role, (NOT r.closed AND r.expires_at>clock_timestamp()) AS active
      FROM v2_shared_rooms r LEFT JOIN v2_room_members m ON m.room_id=r.id AND m.user_id=${userId} AND NOT m.revoked
      WHERE r.owner_id=${userId} OR (m.id IS NOT NULL AND NOT r.closed AND r.expires_at>clock_timestamp()) ORDER BY r.created_at DESC,r.id`) as SharedRoom[]
  } catch (e) {
    if (missingNeonStorage(e)) return []
    throw e
  }
}
export async function createRoom(
  userId: string,
  input: z.infer<typeof roomCreate>,
) {
  await initializeRooms()
  const sql = monitoringSql()
  // Client UUID makes retries after response loss safe. Initial copies are exactly
  // the text confirmed in the preview, not a live relationship to private objects.
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`room-owner:${userId}`},0))`,
    sql`WITH made AS(INSERT INTO v2_shared_rooms(id,owner_id,creation_hash,title,description,expires_at)
      SELECT ${input.id},${userId},${hash(JSON.stringify(input))},${input.title},${input.description},${input.expiresAt}::timestamptz
      WHERE (SELECT count(*) FROM v2_shared_rooms WHERE owner_id=${userId})<100
      ON CONFLICT(id) DO NOTHING RETURNING id)
      INSERT INTO v2_room_items(id,room_id,kind,text)
      SELECT gen_random_uuid(),made.id,x.kind,x.text FROM made CROSS JOIN jsonb_to_recordset(${JSON.stringify(input.initialItems)}::jsonb) AS x(kind text,text text) RETURNING id`,
    sql`SELECT id FROM v2_shared_rooms WHERE id=${input.id} AND owner_id=${userId} AND creation_hash=${hash(JSON.stringify(input))}`,
  ])
  // A room may deliberately have no initial items.
  if (!results[2].length) denied()
  return { id: input.id }
}
export async function roomDetail(
  userId: string,
  id: string,
): Promise<RoomDetail> {
  const sql = monitoringSql()
  // Single statement/snapshot: never return stale contents after a separate permission check.
  const [row] =
    await sql`SELECT jsonb_build_object('id',r.id,'title',r.title,'description',r.description,'expiresAt',r.expires_at,'closed',r.closed,'version',r.version,
    'role',CASE WHEN r.owner_id=${userId} THEN 'owner' ELSE m.role END,'active',NOT r.closed AND r.expires_at>clock_timestamp()) AS room,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'kind',i.kind,'text',i.text,'done',i.done,'version',i.version) ORDER BY i.created_at,i.id) FROM v2_room_items i WHERE i.room_id=r.id),'[]'::jsonb) AS items,
    CASE WHEN r.owner_id=${userId} THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'role',a.role,'version',a.version) ORDER BY a.name,a.id) FROM v2_room_members a WHERE a.room_id=r.id AND NOT a.revoked),'[]'::jsonb) ELSE '[]'::jsonb END AS members,
    CASE WHEN r.owner_id=${userId} THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'role',v.role,'expiresAt',v.expires_at) ORDER BY v.created_at) FROM v2_room_invites v WHERE v.room_id=r.id AND NOT v.revoked AND v.consumed_by IS NULL AND v.expires_at>clock_timestamp()),'[]'::jsonb) ELSE '[]'::jsonb END AS invites
    FROM v2_shared_rooms r LEFT JOIN v2_room_members m ON m.room_id=r.id AND m.user_id=${userId} AND NOT m.revoked
    WHERE r.id=${id} AND (r.owner_id=${userId} OR (m.id IS NOT NULL AND NOT r.closed AND r.expires_at>clock_timestamp()))`
  if (!row)
    throw new RoomError(
      'Raum nicht zugänglich, geschlossen oder abgelaufen.',
      404,
    )
  return row as unknown as RoomDetail
}
export async function createRoomItem(
  userId: string,
  roomId: string,
  input: z.infer<typeof roomItemCreate>,
) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`INSERT INTO v2_room_items(id,room_id,kind,text)
    SELECT ${input.id},r.id,${input.kind},${input.text} FROM v2_shared_rooms r
    WHERE r.id=${roomId} AND NOT r.closed AND r.expires_at>clock_timestamp()
    AND (r.owner_id=${userId} OR EXISTS(SELECT 1 FROM v2_room_members m WHERE m.room_id=r.id AND m.user_id=${userId} AND NOT m.revoked AND m.role='editor'))
    AND (SELECT count(*) FROM v2_room_items WHERE room_id=r.id)<200
    ON CONFLICT(id) DO UPDATE SET id=v2_room_items.id WHERE v2_room_items.room_id=excluded.room_id AND v2_room_items.kind=excluded.kind AND v2_room_items.text=excluded.text RETURNING id`,
  )
  return { id: input.id }
}
export async function updateRoomItem(
  userId: string,
  roomId: string,
  id: string,
  input: z.infer<typeof roomItemUpdate>,
) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`UPDATE v2_room_items i SET text=${input.text},done=CASE WHEN i.kind='list' THEN ${input.done} ELSE false END,version=i.version+1
    FROM v2_shared_rooms r WHERE i.id=${id} AND i.room_id=r.id AND r.id=${roomId} AND i.version=${input.version} AND NOT r.closed AND r.expires_at>clock_timestamp()
    AND (r.owner_id=${userId} OR EXISTS(SELECT 1 FROM v2_room_members m WHERE m.room_id=r.id AND m.user_id=${userId} AND NOT m.revoked AND m.role='editor')) RETURNING i.id`,
  )
}
export async function deleteRoomItem(
  userId: string,
  roomId: string,
  id: string,
  version: number,
) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`DELETE FROM v2_room_items i USING v2_shared_rooms r WHERE i.id=${id} AND i.room_id=r.id AND r.id=${roomId} AND i.version=${version} AND NOT r.closed AND r.expires_at>clock_timestamp()
    AND (r.owner_id=${userId} OR EXISTS(SELECT 1 FROM v2_room_members m WHERE m.room_id=r.id AND m.user_id=${userId} AND NOT m.revoked AND m.role='editor')) RETURNING i.id`,
  )
}
export async function closeRoom(userId: string, id: string, version: number) {
  const sql = monitoringSql()
  await mutate(
    id,
    sql`UPDATE v2_shared_rooms SET closed=true,version=version+1 WHERE id=${id} AND owner_id=${userId} AND version=${version} AND NOT closed RETURNING id`,
  )
}
export async function deleteRoom(userId: string, id: string, version: number) {
  const sql = monitoringSql()
  await mutate(
    id,
    sql`DELETE FROM v2_shared_rooms WHERE id=${id} AND owner_id=${userId} AND version=${version} RETURNING id`,
  )
}
export async function inviteToRoom(
  userId: string,
  id: string,
  role: 'editor' | 'reader',
  expiresAt: string,
) {
  const sql = monitoringSql(),
    token = randomBytes(32).toString('base64url'),
    inviteId = randomUUID()
  await mutate(
    id,
    sql`INSERT INTO v2_room_invites(id,room_id,token_hash,role,expires_at)
    SELECT ${inviteId},id,${hash(token)},${role},least(expires_at,${expiresAt}::timestamptz) FROM v2_shared_rooms
    WHERE id=${id} AND owner_id=${userId} AND NOT closed AND expires_at>clock_timestamp()
    AND (SELECT count(*) FROM v2_room_invites WHERE room_id=${id} AND NOT revoked AND consumed_by IS NULL AND expires_at>clock_timestamp())<20 RETURNING id`,
  )
  return { id: inviteId, token }
}
export async function revokeRoomInvite(
  userId: string,
  roomId: string,
  id: string,
) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`UPDATE v2_room_invites v SET revoked=true FROM v2_shared_rooms r WHERE v.id=${id} AND v.room_id=r.id AND r.id=${roomId} AND r.owner_id=${userId} RETURNING v.id`,
  )
}
export async function previewRoomInvite(token: string) {
  try {
    const [row] =
      await monitoringSql()`SELECT r.title,v.role,least(v.expires_at,r.expires_at) AS "expiresAt" FROM v2_room_invites v JOIN v2_shared_rooms r ON r.id=v.room_id
      WHERE v.token_hash=${hash(token)} AND NOT v.revoked AND v.consumed_by IS NULL AND v.expires_at>clock_timestamp() AND NOT r.closed AND r.expires_at>clock_timestamp()`
    if (!row)
      throw new RoomError('Einladung ungültig, verwendet oder abgelaufen.', 404)
    return row as {
      title: string
      role: 'editor' | 'reader'
      expiresAt: string
    }
  } catch (e) {
    if (missingNeonStorage(e))
      throw new RoomError('Einladung nicht verfügbar.', 404)
    throw e
  }
}
export async function joinRoom(userId: string, token: string, name: string) {
  const sql = monitoringSql()
  const [found] =
    await sql`SELECT room_id AS id FROM v2_room_invites WHERE token_hash=${hash(token)}`
  if (!found) denied()
  const roomId = String(found.id)
  const rows = await mutate(
    roomId,
    sql`WITH used AS(UPDATE v2_room_invites v SET consumed_by=${userId} FROM v2_shared_rooms r
    WHERE v.token_hash=${hash(token)} AND v.room_id=r.id AND r.owner_id<>${userId} AND NOT v.revoked AND v.consumed_by IS NULL
    AND v.expires_at>clock_timestamp() AND NOT r.closed AND r.expires_at>clock_timestamp()
    AND (SELECT count(*) FROM v2_room_members WHERE room_id=r.id AND NOT revoked)<50
    RETURNING v.room_id,v.role), joined AS(
    INSERT INTO v2_room_members(id,room_id,user_id,name,role)
    SELECT ${randomUUID()},room_id,${userId},${name},role FROM used
    ON CONFLICT(room_id,user_id) DO UPDATE SET revoked=false,name=excluded.name,role=excluded.role,version=v2_room_members.version+1 RETURNING room_id AS id)
    SELECT id FROM joined UNION ALL SELECT r.id FROM v2_room_invites v JOIN v2_shared_rooms r ON r.id=v.room_id JOIN v2_room_members m ON m.room_id=r.id AND m.user_id=${userId}
    WHERE v.token_hash=${hash(token)} AND v.consumed_by=${userId} AND NOT v.revoked AND v.expires_at>clock_timestamp() AND NOT r.closed AND r.expires_at>clock_timestamp() AND NOT m.revoked AND NOT EXISTS(SELECT 1 FROM joined)`,
  )
  return { id: String(rows[0].id) }
}
export async function updateRoomMember(
  userId: string,
  roomId: string,
  id: string,
  role: 'editor' | 'reader',
  revoked: boolean,
  version: number,
) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`UPDATE v2_room_members m SET role=${role},revoked=${revoked},version=m.version+1 FROM v2_shared_rooms r
    WHERE m.id=${id} AND m.room_id=r.id AND r.id=${roomId} AND r.owner_id=${userId} AND m.version=${version} AND NOT m.revoked RETURNING m.id`,
  )
}
export async function leaveRoom(userId: string, roomId: string) {
  const sql = monitoringSql()
  await mutate(
    roomId,
    sql`UPDATE v2_room_members SET revoked=true,version=version+1 WHERE room_id=${roomId} AND user_id=${userId} AND NOT revoked RETURNING id`,
  )
}
export async function roomSource(
  userId: string,
  projectId: string,
): Promise<RoomSource> {
  const [row] =
    await monitoringSql()`SELECT p.name,p.description,coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'title',t.title) ORDER BY t.id) FROM (SELECT id,title FROM project_tasks WHERE project_id=p.id AND user_id=${userId} ORDER BY id LIMIT 101) t),'[]'::jsonb) AS tasks FROM projects p WHERE p.id=${projectId} AND p.user_id=${userId}`
  if (!row) throw new RoomError('Eigenes Projekt nicht gefunden.', 404)
  const source = row as unknown as RoomSource
  return {
    ...source,
    tasks: source.tasks.slice(0, 100),
    limited: source.tasks.length > 100,
  }
}
