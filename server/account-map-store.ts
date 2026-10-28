import { monitoringSql } from './neon-storage'
import { SecurityAccountError } from './account-security-policy'
import { initializeSecurityStorage, readSecurityOverview } from './account-security-store'
import type { AccountMapOverview, AccountRelation, AccountRelationInput } from '../src/types/account-map'
export const accountMapDdl = [
  `CREATE TABLE IF NOT EXISTS v2_account_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
    from_account_id uuid NOT NULL REFERENCES v2_account_security(id) ON DELETE CASCADE,
    to_account_id uuid NOT NULL REFERENCES v2_account_security(id) ON DELETE CASCADE,
    type text NOT NULL, login_dependency text,
    manual_reviewed_at timestamptz,version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT v2_account_relations_no_self CHECK(from_account_id <> to_account_id),
    CONSTRAINT v2_account_relations_type CHECK(type IN ('login','recovery_email','recovery_other')),
    CONSTRAINT v2_account_relations_dependency CHECK((type='login' AND login_dependency IS NOT NULL AND login_dependency IN ('only_known','alternative_known','unknown')) OR (type<>'login' AND login_dependency IS NULL)))`,
  `CREATE INDEX IF NOT EXISTS v2_account_relations_user ON v2_account_relations(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS v2_account_relations_pair ON v2_account_relations(user_id,from_account_id,to_account_id,type)`,
]
export async function initializeAccountMap() {
  await initializeSecurityStorage()
  const sql = monitoringSql()
  const [exists] = await sql`SELECT to_regclass('v2_account_relations') IS NOT NULL AND to_regclass('v2_account_relations_pair') IS NOT NULL AND to_regclass('v2_account_relations_user') IS NOT NULL AS ready`
  if (exists?.ready) return
  await sql.transaction([sql`SELECT pg_advisory_xact_lock(184730032)`, ...accountMapDdl.map((ddl) => sql.query(ddl))])
}
const iso = (value: string | Date) => new Date(value).toISOString()
export async function readAccountMap(userId: string): Promise<AccountMapOverview> {
  const accounts = await readSecurityOverview(userId)
  let relations: AccountRelation[] = []; let setupRequired = false
  try {
    const sql = monitoringSql()
    const rows = await sql`SELECT r.* FROM v2_account_relations r
      JOIN v2_account_security a ON a.id=r.from_account_id AND a.user_id=r.user_id
      JOIN v2_account_security b ON b.id=r.to_account_id AND b.user_id=r.user_id
      WHERE r.user_id=${userId} ORDER BY r.created_at DESC LIMIT 1001`
    relations = rows.map((row) => ({ id: String(row.id), fromAccountId: String(row.from_account_id), toAccountId: String(row.to_account_id),
      type: row.type as AccountRelation['type'], loginDependency: row.login_dependency as AccountRelation['loginDependency'],
      version: Number(row.version), manualReviewedAt: row.manual_reviewed_at ? iso(row.manual_reviewed_at) : null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }))
  } catch (error) { if ((error as { code?: string }).code !== '42P01') throw error; setupRequired = true }
  return { accounts: accounts.accounts, relations, setupRequired: setupRequired || accounts.setupRequired, accountsSetupRequired: accounts.setupRequired, checkedAt: new Date().toISOString() }
}
function translate(error: unknown): never {
  if ((error as { code?: string }).code === '23505') throw new SecurityAccountError('Diese gerichtete Verbindung mit diesem Typ ist bereits vorhanden.', 409)
  if ((error as { code?: string }).code === '42P01') throw new SecurityAccountError('Bitte zuerst die Kontenkarte einrichten.', 503)
  throw error
}
export async function createAccountRelation(userId: string, relation: AccountRelationInput) {
  const sql = monitoringSql()
  try {
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId},184730024))`,
      sql`INSERT INTO v2_account_relations(user_id,from_account_id,to_account_id,type,login_dependency,manual_reviewed_at)
        SELECT ${userId},a.id,b.id,${relation.type},${relation.loginDependency},CASE WHEN ${relation.reviewed} THEN now() END
        FROM v2_account_security a,v2_account_security b WHERE a.id=${relation.fromAccountId} AND b.id=${relation.toAccountId}
          AND a.user_id=${userId} AND b.user_id=${userId} AND a.id<>b.id
          AND (SELECT count(*) FROM v2_account_relations WHERE user_id=${userId})<1000 RETURNING id`,
    ])
    if (!results[1].length) throw new SecurityAccountError('Beide Konten müssen dir gehören. Höchstens 1000 Verbindungen sind möglich.', 409)
    return { id: String(results[1][0].id) }
  } catch (error) { return translate(error) }
}
export async function updateAccountRelation(userId: string, id: string, version: number, relation: AccountRelationInput) {
  const sql = monitoringSql()
  try {
    const rows = await sql`UPDATE v2_account_relations r SET from_account_id=a.id,to_account_id=b.id,type=${relation.type},login_dependency=${relation.loginDependency},
      manual_reviewed_at=CASE WHEN ${relation.reviewed} THEN now() END,updated_at=now(),version=r.version+1
      FROM v2_account_security a,v2_account_security b WHERE r.id=${id} AND r.user_id=${userId} AND r.version=${version}
        AND a.id=${relation.fromAccountId} AND b.id=${relation.toAccountId} AND a.user_id=${userId} AND b.user_id=${userId} AND a.id<>b.id RETURNING r.id`
    if (!rows.length) throw new SecurityAccountError('Verbindung oder Konten nicht verfügbar oder zwischenzeitlich geändert. Bitte neu laden.', 409)
    return { id }
  } catch (error) { return translate(error) }
}
export async function deleteAccountRelation(userId: string, id: string, version: number) {
  const sql = monitoringSql()
  const rows = await sql`DELETE FROM v2_account_relations r USING v2_account_security a,v2_account_security b
    WHERE r.id=${id} AND r.user_id=${userId} AND r.version=${version} AND a.id=r.from_account_id AND b.id=r.to_account_id AND a.user_id=${userId} AND b.user_id=${userId} RETURNING r.id`
  if (!rows.length) throw new SecurityAccountError('Verbindung nicht verfügbar oder zwischenzeitlich geändert. Bitte neu laden.', 409)
  return { id }
}
