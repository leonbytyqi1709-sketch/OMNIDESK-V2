import { Hono } from 'hono'
import { z } from 'zod'
import { summarizeSecurity } from '../../src/lib/account-security'
import { SecurityAccountError, securityAccountSchema, securityUpdateSchema, securityVersionSchema } from '../account-security-policy'
import { createSecurityAccount, deleteSecurityAccount, initializeSecurityStorage, readSecurityOverview, reviewSecurityAccount, updateSecurityAccount } from '../account-security-store'
export function createAccountSecurityRoute(dependencies = { createSecurityAccount, deleteSecurityAccount, initializeSecurityStorage, readSecurityOverview, reviewSecurityAccount, updateSecurityAccount }) {
  const route = new Hono()
  route.onError((error, c) => c.json({ error: error instanceof SecurityAccountError ? error.message : 'Sicherheitsübersicht nicht verfügbar. Datenbankrechte und Einrichtung prüfen.' }, error instanceof SecurityAccountError ? error.status : 503))
  route.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  route.get('/', async (c) => c.json(await dependencies.readSecurityOverview(c.get('userId'))))
  // Structured facts for the future briefing; this route does not send anything to an AI provider.
  route.get('/summary', async (c) => c.json(summarizeSecurity(await dependencies.readSecurityOverview(c.get('userId')))))
  route.post('/setup', async (c) => { await dependencies.initializeSecurityStorage(); return c.json({ ok: true }) })
  route.post('/', async (c) => {
    const parsed = securityAccountSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Kontodaten sind ungültig. Name, Sicherheitsstatus und HTTPS-Adresse prüfen; keine Passwörter oder Wiederherstellungscodes eintragen.' }, 400)
    return c.json(await dependencies.createSecurityAccount(c.get('userId'), parsed.data), 201)
  })
  route.use('/:id/*', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Ungültige Kontokennung.' }, 400)
    await next()
  })
  route.put('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Ungültige Kontokennung.' }, 400)
    const parsed = securityUpdateSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Kontodaten oder Eintragsversion.' }, 400)
    return c.json(await dependencies.updateSecurityAccount(c.get('userId'), c.req.param('id'), parsed.data.version, parsed.data.account))
  })
  route.post('/:id/review', async (c) => {
    const parsed = securityVersionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Eintragsversion.' }, 400)
    return c.json(await dependencies.reviewSecurityAccount(c.get('userId'), c.req.param('id'), parsed.data.version))
  })
  route.delete('/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Ungültige Kontokennung.' }, 400)
    const parsed = securityVersionSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Eintragsversion.' }, 400)
    return c.json(await dependencies.deleteSecurityAccount(c.get('userId'), c.req.param('id'), parsed.data.version))
  })
  return route
}
export const accountSecurityRoute = createAccountSecurityRoute()
