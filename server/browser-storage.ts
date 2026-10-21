import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { monitoringSql, missingNeonStorage } from './neon-storage'
import { BrowserDeskError } from './browser-policy'
import type {
  BrowserDevice,
  BrowserItem,
  BrowserItemInput,
  BrowserProject,
} from '../src/types/browser-desk'
export const browserHash = (value: string) =>
  createHash('sha256').update(value).digest('hex')
export const browserDdl = [
  `CREATE TABLE IF NOT EXISTS v2_browser_items(id uuid PRIMARY KEY,user_id text NOT NULL,url text NOT NULL,title text NOT NULL,selection text NOT NULL,annotation text NOT NULL,project_id uuid REFERENCES projects(id) ON DELETE SET NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_browser_items_owner_url ON v2_browser_items(user_id,url,updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS v2_browser_pairings(code_hash text PRIMARY KEY,user_id text NOT NULL,challenge text NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_browser_devices(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,token_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,last_used_at timestamptz,revoked_at timestamptz)`,
]
export async function initializeBrowserStorage() {
  const sql = monitoringSql()
  const [state] =
    await sql`SELECT to_regclass('v2_browser_items') IS NOT NULL AND to_regclass('v2_browser_pairings') IS NOT NULL AND to_regclass('v2_browser_devices') IS NOT NULL AND to_regclass('v2_browser_items_owner_url') IS NOT NULL AS ready`
  if (state?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730022)`,
    ...browserDdl.map((s) => sql.query(s)),
  ])
}
export async function browserProjects(
  userId: string,
): Promise<BrowserProject[]> {
  return (await monitoringSql()`SELECT id,name FROM projects WHERE user_id=${userId} ORDER BY name,id`) as BrowserProject[]
}
export async function ownsBrowserProject(userId: string, projectId: string) {
  const [row] =
    await monitoringSql()`SELECT id FROM projects WHERE id=${projectId} AND user_id=${userId}`
  return Boolean(row)
}
export function boundBrowserItems(rows: BrowserItem[]) {
  const items: BrowserItem[] = []
  let bytes = 0
  for (const row of rows.slice(0, 100)) {
    const size = Buffer.byteLength(JSON.stringify(row), 'utf8')
    if (bytes + size > 2_000_000) break
    bytes += size
    items.push(row)
  }
  return { items, limited: rows.length > items.length }
}
export async function listBrowserItems(
  userId: string,
  filters: { url?: string; projectId?: string } = {},
): Promise<{ items: BrowserItem[]; limited: boolean }> {
  const sql = monitoringSql()
  try {
    const rows =
      await sql`SELECT i.id,i.title,i.url,i.selection,i.annotation,p.id AS "projectId",p.name AS "projectName",i.version,i.created_at AS "createdAt",i.updated_at AS "updatedAt"
      FROM v2_browser_items i LEFT JOIN projects p ON p.id=i.project_id AND p.user_id=i.user_id
      WHERE i.user_id=${userId} AND (${filters.url ?? null}::text IS NULL OR i.url=${filters.url ?? null})
      AND (${filters.projectId ?? null}::uuid IS NULL OR p.id=${filters.projectId ?? null}::uuid) ORDER BY i.updated_at DESC,i.id LIMIT 101`
    return boundBrowserItems(rows as unknown as BrowserItem[])
  } catch (e) {
    if (missingNeonStorage(e)) return { items: [], limited: false }
    throw e
  }
}
export async function saveBrowserItem(
  userId: string,
  input: BrowserItemInput,
): Promise<BrowserItem> {
  await initializeBrowserStorage()
  const sql = monitoringSql()
  const [item] =
    await sql`INSERT INTO v2_browser_items(id,user_id,url,title,selection,annotation,project_id)
    SELECT ${input.id}::uuid,${userId},${input.url},${input.title},${input.selection},${input.annotation},${input.projectId}::uuid
    WHERE ${input.projectId}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId}::uuid AND user_id=${userId})
    ON CONFLICT(id) DO UPDATE SET id=v2_browser_items.id WHERE v2_browser_items.user_id=excluded.user_id AND v2_browser_items.url=excluded.url AND v2_browser_items.title=excluded.title AND v2_browser_items.selection=excluded.selection AND v2_browser_items.annotation=excluded.annotation AND v2_browser_items.project_id IS NOT DISTINCT FROM excluded.project_id
    RETURNING id,title,url,selection,annotation,project_id AS "projectId",version,created_at AS "createdAt",updated_at AS "updatedAt"`
  if (!item)
    throw new BrowserDeskError(
      'Projekt gehört nicht zu deinem Konto oder diese Speicherung wurde mit anderem Inhalt bereits verwendet. Liste aktualisieren.',
      409,
    )
  return { ...item, projectName: null } as unknown as BrowserItem
}
export async function updateBrowserItem(
  userId: string,
  id: string,
  input: Omit<BrowserItemInput, 'id' | 'url'> & { version: number },
): Promise<BrowserItem> {
  const sql = monitoringSql()
  const [row] =
    await sql`UPDATE v2_browser_items SET title=${input.title},selection=${input.selection},annotation=${input.annotation},project_id=${input.projectId}::uuid,version=version+1,updated_at=now()
    WHERE id=${id} AND user_id=${userId} AND version=${input.version}
    AND (${input.projectId}::uuid IS NULL OR EXISTS(SELECT 1 FROM projects WHERE id=${input.projectId}::uuid AND user_id=${userId}))
    RETURNING id,title,url,selection,annotation,project_id AS "projectId",version,created_at AS "createdAt",updated_at AS "updatedAt"`
  if (!row)
    throw new BrowserDeskError(
      'Eintrag wurde verändert, entfernt oder das Projekt ist nicht zugänglich. Liste neu laden.',
      409,
    )
  return { ...row, projectName: null } as unknown as BrowserItem
}
export async function deleteBrowserItem(
  userId: string,
  id: string,
  version: number,
) {
  const rows =
    await monitoringSql()`DELETE FROM v2_browser_items WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length)
    throw new BrowserDeskError(
      'Eintrag wurde verändert oder ist nicht mehr zugänglich. Liste neu laden.',
      409,
    )
}
export async function createBrowserPairing(userId: string, challenge: string) {
  await initializeBrowserStorage()
  const sql = monitoringSql(),
    code = randomBytes(32).toString('base64url')
  // Serialize account limits across function instances. Codes are stored only as hashes and expire after five minutes.
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`browser-pair:${userId}`},0))`,
    sql`INSERT INTO v2_browser_pairings(code_hash,user_id,challenge,expires_at)
      SELECT ${browserHash(code)},${userId},${challenge},now()+interval '5 minutes'
      WHERE (SELECT count(*) FROM v2_browser_pairings WHERE user_id=${userId} AND created_at>now()-interval '1 hour')<20
      AND (SELECT count(*) FROM v2_browser_devices WHERE user_id=${userId} AND revoked_at IS NULL AND expires_at>now())<20 RETURNING code_hash`,
    sql`DELETE FROM v2_browser_pairings WHERE user_id=${userId} AND created_at<now()-interval '1 day'`,
  ])
  if (!rows.length)
    throw new BrowserDeskError(
      'Zu viele Verbindungsversuche oder aktive Erweiterungen. Alte Verbindungen trennen oder später erneut versuchen.',
      429,
    )
  return { code }
}
export async function exchangeBrowserPairing(code: string, verifier: string) {
  const sql = monitoringSql(),
    token = 'omni_ext_' + randomBytes(32).toString('base64url'),
    deviceId = randomUUID()
  try {
    const [row] =
      await sql`WITH consumed AS(UPDATE v2_browser_pairings SET consumed_at=now() WHERE code_hash=${browserHash(code)} AND challenge=${browserHash(verifier)} AND expires_at>now() AND consumed_at IS NULL RETURNING user_id)
      INSERT INTO v2_browser_devices(id,user_id,name,token_hash,expires_at) SELECT ${deviceId},user_id,'Browser-Kommandoebene',${browserHash(token)},now()+interval '30 days' FROM consumed RETURNING id,expires_at AS "expiresAt"`
    if (!row)
      throw new BrowserDeskError(
        'Verbindung ist ungültig, abgelaufen oder bereits verwendet. Erneut verbinden.',
        401,
      )
    return { token, deviceId, expiresAt: String(row.expiresAt) }
  } catch (e) {
    if (missingNeonStorage(e))
      throw new BrowserDeskError(
        'Erweiterung zuerst in OMNIDESK verbinden.',
        401,
      )
    throw e
  }
}
export async function authenticateBrowserDevice(token: string) {
  if (!/^omni_ext_[A-Za-z0-9_-]{43}$/.test(token)) return null
  try {
    const [row] =
      await monitoringSql()`UPDATE v2_browser_devices SET last_used_at=now() WHERE token_hash=${browserHash(token)} AND revoked_at IS NULL AND expires_at>now() RETURNING id,user_id AS "userId"`
    return row ? { id: String(row.id), userId: String(row.userId) } : null
  } catch (e) {
    if (missingNeonStorage(e)) return null
    throw e
  }
}
export async function listBrowserDevices(
  userId: string,
): Promise<BrowserDevice[]> {
  try {
    return (await monitoringSql()`SELECT id,name,created_at AS "createdAt",expires_at AS "expiresAt",last_used_at AS "lastUsedAt" FROM v2_browser_devices WHERE user_id=${userId} AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC`) as BrowserDevice[]
  } catch (e) {
    if (missingNeonStorage(e)) return []
    throw e
  }
}
export async function revokeBrowserDevice(userId: string, deviceId: string) {
  await monitoringSql()`UPDATE v2_browser_devices SET revoked_at=coalesce(revoked_at,now()) WHERE id=${deviceId} AND user_id=${userId}`
}
