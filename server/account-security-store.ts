import { monitoringSql } from './neon-storage'
import { SecurityAccountError } from './account-security-policy'
import type { SecurityAccount, SecurityAccountInput, SecurityConnection, SecurityOverview } from '../src/types/account-security'
export const securityDdl = [
  `CREATE TABLE IF NOT EXISTS v2_account_security (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
    connected_account_id uuid REFERENCES connected_accounts(id) ON DELETE SET NULL,
    details jsonb NOT NULL, manual_reviewed_at timestamptz, version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS v2_account_security_user ON v2_account_security(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS v2_account_security_connection ON v2_account_security(user_id,connected_account_id) WHERE connected_account_id IS NOT NULL`,
]
const missing = (error: unknown) => (error as { code?: string })?.code === '42P01'
export async function initializeSecurityStorage() {
  const sql = monitoringSql()
  const [existing] = await sql`SELECT to_regclass('v2_account_security') IS NOT NULL AND to_regclass('v2_account_security_connection') IS NOT NULL AND to_regclass('v2_account_security_user') IS NOT NULL AS ready`
  if (existing?.ready) return
  await sql.transaction([sql`SELECT pg_advisory_xact_lock(184730021)`, ...securityDdl.map((ddl) => sql.query(ddl))])
}
interface SecurityRow { id: string; user_id: string; connected_account_id: string | null; details: Omit<SecurityAccountInput, 'connectedAccountId' | 'reviewed'>;
  manual_reviewed_at: Date | string | null; version: number; created_at: Date | string; updated_at: Date | string }
const iso = (value: Date | string) => new Date(value).toISOString()
function publicSecurityAccount(row: SecurityRow, connections: SecurityConnection[]): SecurityAccount {
  const connection = connections.find((candidate) => candidate.id === row.connected_account_id) ?? null
  return { id: row.id, version: row.version, ...row.details, connectedAccountId: row.connected_account_id,
    manualReviewedAt: row.manual_reviewed_at ? iso(row.manual_reviewed_at) : null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), connection }
}
async function securityConnections(userId: string): Promise<SecurityConnection[]> {
  const sql = monitoringSql()
  // Explicit projection: no tokens, scopes, metadata or vault values are selected.
  return await sql`SELECT id,provider,email,label FROM connected_accounts WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 500` as SecurityConnection[]
}
export async function readSecurityOverview(userId: string): Promise<SecurityOverview> {
  const sql = monitoringSql()
  const connectionsResult = await Promise.allSettled([securityConnections(userId)])
  const connections = connectionsResult[0].status === 'fulfilled' ? connectionsResult[0].value : []
  let rows: SecurityRow[] = []; let setupRequired = false
  try { rows = await sql`SELECT * FROM v2_account_security WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 501` as SecurityRow[] }
  catch (error) { if (!missing(error)) throw error; setupRequired = true }
  return { setupRequired, accounts: rows.map((row) => publicSecurityAccount(row, connections)), connections,
    connectionsUnavailable: connectionsResult[0].status === 'rejected', checkedAt: new Date().toISOString() }
}
async function validatedDetails(userId: string, input: SecurityAccountInput) {
  const { reviewed, connectedAccountId, ...details } = input
  if (connectedAccountId) {
    const connection = (await securityConnections(userId)).find((candidate) => candidate.id === connectedAccountId)
    if (!connection) throw new SecurityAccountError('Diese Cloud-Verbindung gehört nicht zu deinem Konto oder ist nicht mehr vorhanden.', 404)
    // Identity comes from the existing owned connection, not a forged browser label.
    details.provider = connection.provider
    details.login = connection.email
  }
  return { reviewed, connectedAccountId, details }
}
function translateStorageError(error: unknown): never {
  if ((error as { code?: string }).code === '23505') throw new SecurityAccountError('Diese Cloud-Verbindung ist bereits in deiner Sicherheitsübersicht erfasst.', 409)
  if (missing(error)) throw new SecurityAccountError('Bitte zuerst die Sicherheitsübersicht einrichten.', 503)
  throw error
}
export async function createSecurityAccount(userId: string, input: SecurityAccountInput) {
  const sql = monitoringSql(); const value = await validatedDetails(userId, input)
  try {
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730022))`,
      sql`INSERT INTO v2_account_security(user_id,connected_account_id,details,manual_reviewed_at)
        SELECT ${userId},${value.connectedAccountId}::uuid,${JSON.stringify(value.details)}::jsonb,CASE WHEN ${value.reviewed} THEN now() END
        WHERE (SELECT count(*) FROM v2_account_security WHERE user_id=${userId})<500
          AND (${value.connectedAccountId}::uuid IS NULL OR EXISTS (SELECT 1 FROM connected_accounts WHERE id=${value.connectedAccountId}::uuid AND user_id=${userId})) RETURNING id`,
    ])
    if (!results[1].length) throw new SecurityAccountError('Das Konto konnte nicht angelegt werden. Höchstens 500 Konten sind möglich; die gewählte Verbindung muss weiterhin dir gehören.', 409)
    return { id: String(results[1][0].id) }
  } catch (error) { return translateStorageError(error) }
}
export async function updateSecurityAccount(userId: string, id: string, version: number, input: SecurityAccountInput) {
  const sql = monitoringSql(); const value = await validatedDetails(userId, input)
  try {
    const rows = await sql`UPDATE v2_account_security SET details=${JSON.stringify(value.details)}::jsonb,connected_account_id=${value.connectedAccountId}::uuid,
      manual_reviewed_at=CASE WHEN ${value.reviewed} THEN now() END, updated_at=now(),version=version+1
      WHERE id=${id} AND user_id=${userId} AND version=${version}
        AND (${value.connectedAccountId}::uuid IS NULL OR EXISTS (SELECT 1 FROM connected_accounts WHERE id=${value.connectedAccountId}::uuid AND user_id=${userId})) RETURNING id`
    if (!rows.length) throw new SecurityAccountError('Eintrag nicht mehr verfügbar oder zwischenzeitlich geändert. Bitte neu laden.', 409)
    return { id }
  } catch (error) { return translateStorageError(error) }
}
export async function reviewSecurityAccount(userId: string, id: string, version: number) {
  const sql = monitoringSql()
  const rows = await sql`UPDATE v2_account_security SET manual_reviewed_at=now(),updated_at=now(),version=version+1 WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length) throw new SecurityAccountError('Eintrag nicht mehr verfügbar oder zwischenzeitlich geändert. Bitte neu laden.', 409)
  return { id }
}
export async function deleteSecurityAccount(userId: string, id: string, version: number) {
  const sql = monitoringSql()
  const rows = await sql`DELETE FROM v2_account_security WHERE id=${id} AND user_id=${userId} AND version=${version} RETURNING id`
  if (!rows.length) throw new SecurityAccountError('Eintrag nicht mehr verfügbar oder zwischenzeitlich geändert. Bitte neu laden.', 409)
  return { id }
}
