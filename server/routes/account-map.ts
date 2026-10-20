import { Hono } from 'hono'
import { z } from 'zod'
import { SecurityAccountError } from '../account-security-policy'
import { accountRelationSchema, relationUpdateSchema, relationVersionSchema } from '../account-map-policy'
import { createAccountRelation, deleteAccountRelation, initializeAccountMap, readAccountMap, updateAccountRelation } from '../account-map-store'
export function createAccountMapRoute(dependencies = { createAccountRelation, deleteAccountRelation, initializeAccountMap, readAccountMap, updateAccountRelation }) {
  const route = new Hono()
  route.onError((error, c) => c.json({ error: error instanceof SecurityAccountError ? error.message : 'Kontenkarte nicht verfügbar. Einrichtung und Datenbankrechte prüfen.' }, error instanceof SecurityAccountError ? error.status : 503))
  route.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  route.get('/', async (c) => c.json(await dependencies.readAccountMap(c.get('userId'))))
  route.post('/setup', async (c) => { await dependencies.initializeAccountMap(); return c.json({ ok: true }) })
  route.post('/', async (c) => {
    const parsed = accountRelationSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Zwei unterschiedliche Konten und passenden Verbindungstyp wählen. Anmeldeabhängigkeit nur für Anmeldung angeben.' }, 400)
    return c.json(await dependencies.createAccountRelation(c.get('userId'), parsed.data), 201)
  })
  route.put('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Ungültige Verbindungskennung.' }, 400)
    const parsed = relationUpdateSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Verbindung oder Eintragsversion.' }, 400)
    return c.json(await dependencies.updateAccountRelation(c.get('userId'), c.req.param('id'), parsed.data.version, parsed.data.relation))
  })
  route.delete('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Ungültige Verbindungskennung.' }, 400)
    const parsed = relationVersionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Eintragsversion.' }, 400)
    return c.json(await dependencies.deleteAccountRelation(c.get('userId'), c.req.param('id'), parsed.data.version))
  })
  return route
}
export const accountMapRoute = createAccountMapRoute()
