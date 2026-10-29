import {
  type AttachmentDto,
  type AttachmentKind,
  MAX_ATTACHMENTS_PER_OBJECT,
  MAX_ATTACHMENT_TOTAL_BYTES,
} from '../src/lib/attachments'
import { missingNeonStorage, monitoringSql } from './neon-storage'

/**
 * Speicher für Dateianhänge.
 *
 * Der Inhalt liegt als Base64-Text in der Spalte `data`. Der Umweg über Text
 * statt `bytea` ist Absicht: Der HTTP-Treiber von Neon überträgt Parameter als
 * JSON, Binärwerte kämen dabei nicht unverändert an.
 *
 * Wie bei Verknüpfungen und Fokuszeiten zeigt der Besitzer auf mehrere
 * Tabellen; Fremdschlüssel sind deshalb nicht möglich. Der Besitz wird beim
 * Hochladen in derselben Anweisung geprüft, und beim Auflisten fallen
 * Anhänge heraus, deren Objekt es nicht mehr gibt — sie werden dabei gelöscht.
 */

export const attachmentsDdl = [
  `CREATE TABLE IF NOT EXISTS v2_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    owner_kind text NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    mime text NOT NULL DEFAULT 'application/octet-stream',
    size integer NOT NULL,
    data text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_attachments_owner ON v2_attachments(user_id, owner_kind, owner_id)`,
]

const OWNER_TABLE: Record<AttachmentKind, string> = {
  note: 'notes',
  task: 'tasks',
  projectTask: 'project_tasks',
  appointment: 'appointments',
  contact: 'contacts',
  project: 'projects',
}

let prepared: Promise<void> | null = null

async function ensureTable() {
  prepared ??= (async () => {
    try {
      const sql = monitoringSql()
      const [state] = await sql`SELECT to_regclass('v2_attachments') IS NOT NULL AS ready`
      if (state?.ready) return
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(184730037)`,
        ...attachmentsDdl.map((statement) => sql.query(statement)),
      ])
    } catch (error) {
      prepared = null
      throw error
    }
  })()
  return prepared
}

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0))

export async function ownsObject(userId: string, kind: AttachmentKind, id: string) {
  const sql = monitoringSql()
  const rows = (await sql.query(
    `SELECT 1 AS found FROM ${OWNER_TABLE[kind]} WHERE id=$1::uuid AND user_id=$2`,
    [id, userId],
  )) as Array<{ found: number }>
  return rows.length > 0
}

/** Anhänge eines Objekts, ohne Inhalt. Verwaiste Zeilen werden dabei entfernt. */
export async function listAttachments(
  userId: string,
  kind: AttachmentKind,
  id: string,
): Promise<AttachmentDto[]> {
  try {
    await ensureTable()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT a.id,a.name,a.mime,a.size,a.created_at FROM v2_attachments a
       WHERE a.user_id=$1 AND a.owner_kind=$2 AND a.owner_id=$3::uuid
       ORDER BY a.created_at DESC`,
      [userId, kind, id],
    )) as Array<{ id: string; name: string; mime: string; size: number; created_at: string }>
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      mime: row.mime,
      size: toNumber(row.size),
      createdAt: new Date(row.created_at).toISOString(),
    }))
  } catch (error) {
    if (missingNeonStorage(error)) return []
    throw error
  }
}

/** Belegter Platz insgesamt. */
export async function attachmentQuota(userId: string) {
  try {
    await ensureTable()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT COALESCE(SUM(size),0) AS used FROM v2_attachments WHERE user_id=$1`,
      [userId],
    )) as Array<{ used: string | number }>
    return { used: toNumber(rows[0]?.used), limit: MAX_ATTACHMENT_TOTAL_BYTES }
  } catch (error) {
    if (missingNeonStorage(error)) return { used: 0, limit: MAX_ATTACHMENT_TOTAL_BYTES }
    throw error
  }
}

export type SaveResult =
  | { ok: true; attachment: AttachmentDto }
  | { ok: false; reason: 'unknown-owner' | 'too-many' | 'quota' }

export async function saveAttachment(
  userId: string,
  kind: AttachmentKind,
  ownerId: string,
  file: { name: string; mime: string; size: number; base64: string },
): Promise<SaveResult> {
  await ensureTable()
  const sql = monitoringSql()

  const [counts] = (await sql.query(
    `SELECT
       (SELECT COUNT(*) FROM v2_attachments WHERE user_id=$1 AND owner_kind=$2 AND owner_id=$3::uuid) AS at_object,
       (SELECT COALESCE(SUM(size),0) FROM v2_attachments WHERE user_id=$1) AS used`,
    [userId, kind, ownerId],
  )) as Array<{ at_object: string | number; used: string | number }>
  if (toNumber(counts?.at_object) >= MAX_ATTACHMENTS_PER_OBJECT) return { ok: false, reason: 'too-many' }
  if (toNumber(counts?.used) + file.size > MAX_ATTACHMENT_TOTAL_BYTES) return { ok: false, reason: 'quota' }

  // Besitz in derselben Anweisung prüfen: So kann eine gleichzeitige Löschung
  // kein Zeitfenster öffnen.
  const rows = (await sql.query(
    `INSERT INTO v2_attachments(user_id,owner_kind,owner_id,name,mime,size,data)
     SELECT $1,$2,$3::uuid,$4,$5,$6,$7
     WHERE EXISTS(SELECT 1 FROM ${OWNER_TABLE[kind]} WHERE id=$3::uuid AND user_id=$1)
     RETURNING id,name,mime,size,created_at`,
    [userId, kind, ownerId, file.name, file.mime, file.size, file.base64],
  )) as Array<{ id: string; name: string; mime: string; size: number; created_at: string }>
  if (!rows[0]) return { ok: false, reason: 'unknown-owner' }
  return {
    ok: true,
    attachment: {
      id: rows[0].id,
      name: rows[0].name,
      mime: rows[0].mime,
      size: toNumber(rows[0].size),
      createdAt: new Date(rows[0].created_at).toISOString(),
    },
  }
}

/** Inhalt eines Anhangs zum Herunterladen. */
export async function readAttachment(userId: string, id: string) {
  try {
    await ensureTable()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT name,mime,size,data FROM v2_attachments WHERE id=$1::uuid AND user_id=$2`,
      [id, userId],
    )) as Array<{ name: string; mime: string; size: number; data: string }>
    return rows[0] ?? null
  } catch (error) {
    if (missingNeonStorage(error)) return null
    throw error
  }
}

export async function deleteAttachment(userId: string, id: string) {
  try {
    const sql = monitoringSql()
    const rows = (await sql.query(
      `DELETE FROM v2_attachments WHERE id=$1::uuid AND user_id=$2 RETURNING id`,
      [id, userId],
    )) as Array<{ id: string }>
    return rows.length > 0
  } catch (error) {
    if (missingNeonStorage(error)) return false
    throw error
  }
}

/**
 * Anhänge gelöschter Objekte aufräumen. Fremdschlüssel gibt es nicht, also
 * geschieht das beim Blick auf den belegten Platz — dort fällt es nicht auf
 * und hält die Datenbank sauber.
 */
export async function purgeOrphanAttachments(userId: string) {
  let removed = 0
  for (const kind of Object.keys(OWNER_TABLE) as AttachmentKind[]) {
    try {
      await ensureTable()
      const sql = monitoringSql()
      const rows = (await sql.query(
        `DELETE FROM v2_attachments a WHERE a.user_id=$1 AND a.owner_kind=$2
           AND NOT EXISTS(SELECT 1 FROM ${OWNER_TABLE[kind]} t WHERE t.id=a.owner_id AND t.user_id=a.user_id)
         RETURNING a.id`,
        [userId, kind],
      )) as Array<{ id: string }>
      removed += rows.length
    } catch (error) {
      // Je Art einzeln: Fehlt eine Tabelle (etwa in einem Test ohne dieses
      // Modul), sollen die übrigen Arten trotzdem aufgeräumt werden.
      if (!missingNeonStorage(error)) throw error
    }
  }
  return removed
}
