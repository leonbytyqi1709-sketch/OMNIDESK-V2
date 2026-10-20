import { PGlite } from '@electric-sql/pglite'
import { neonConfig } from '@neondatabase/serverless'
/** Execute the actual production driver's parameterized statements against isolated PostgreSQL/WASM. */
export async function postgresStorage() {
  const pg = new PGlite(); const originalUrl = process.env.DATABASE_URL; const originalFetch = neonConfig.fetchFunction
  process.env.DATABASE_URL = 'postgresql://test:test@ep-test.eu.neon.tech/test?sslmode=require'
  neonConfig.fetchFunction = async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    async function query(item: { query: string; params?: unknown[] }) {
      const result = await pg.query<Record<string, unknown>>(item.query, item.params)
      return { fields: result.fields, rows: result.rows.map((row) => result.fields.map((field) => {
        const value = row[field.name]
        return value == null ? null : typeof value === 'boolean' ? value ? 't' : 'f' : value instanceof Date ? value.toISOString().replace('T', ' ').replace('Z', '+00') : typeof value === 'object' ? JSON.stringify(value) : String(value)
      })), rowCount: result.rows.length, command: 'SELECT' }
    }
    try {
      if (body.queries) {
        await pg.exec('BEGIN')
        try { const results = []; for (const item of body.queries) results.push(await query(item)); await pg.exec('COMMIT'); return Response.json({ results }) }
        catch (error) { await pg.exec('ROLLBACK'); throw error }
      }
      return Response.json(await query(body))
    } catch (error) { return Response.json({ message: (error as Error).message, code: (error as { code?: string }).code }, { status: 400 }) }
  }
  return { pg, close: async () => { neonConfig.fetchFunction = originalFetch; if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl; await pg.close() } }
}
