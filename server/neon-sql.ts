import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import type { NeonLink } from './neon-monitor'
import type { NeonSnapshot, SqlCheck } from '../src/types/neon-monitoring'
const targetSchema = z.array(z.object({ neonProjectId: z.string(), branchId: z.string(), env: z.string().regex(/^NEON_SQL_[A-Z0-9_]+_URL$/) })).max(100)
function targetUrl(link: NeonLink) {
  const targets = targetSchema.parse(JSON.parse(process.env.NEON_SQL_TARGETS || '[]'))
  const matches = targets.filter((target) => target.neonProjectId === link.neonProjectId && target.branchId === link.branchId)
  if (matches.length !== 1) throw new Error('SQL target missing or ambiguous')
  const raw = process.env[matches[0].env]
  if (!raw) throw new Error('SQL secret missing')
  const url = new URL(raw)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech') || !url.username || !url.password ||
      !['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) throw new Error('SQL target invalid')
  return { raw, url }
}
export function isNeonSqlConfigured(link: NeonLink) {
  try { targetUrl(link); return true } catch { return false }
}
export async function checkNeonSql(link: NeonLink, snapshot: NeonSnapshot | null): Promise<SqlCheck> {
  const checkedAt = new Date().toISOString()
  try {
    const { raw, url } = targetUrl(link)
    // Prevent a connection string for a different branch/database endpoint from being used accidentally.
    const hostname = url.hostname.split('.')[0]
    if (!snapshot?.endpoints?.some((endpoint) => hostname === endpoint.id || hostname === `${endpoint.id}-pooler`)) throw new Error('Endpoint mismatch')
    const sql = neon(raw, { fetchOptions: { signal: AbortSignal.timeout(8000) } })
    const started = performance.now()
    const [rows] = await sql.transaction([sql`select 1 as omnidesk_probe`], { readOnly: true, isolationLevel: 'ReadCommitted' })
    if (rows[0]?.omnidesk_probe !== 1) throw new Error('Probe result invalid')
    return { checkedAt, status: 'up', latencyMs: Math.round(performance.now() - started), message: null }
  } catch {
    // Never return database errors/hostnames/passwords to the client or logs.
    return { checkedAt, status: isNeonSqlConfigured(link) ? 'down' : 'unavailable', latencyMs: null,
      message: 'SQL-Prüfung nicht erfolgreich. Serverseitige Zielzuordnung, Branch und Leseberechtigungen prüfen.' }
  }
}
