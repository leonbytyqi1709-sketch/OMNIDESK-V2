import { Hono } from 'hono'
import { z } from 'zod'
import { collectBriefing } from '../briefing-data'
import { generateBriefingMessage } from '../briefing-ai'
import { recordBriefingVisit, saveBriefingPreferences } from '../briefing-storage'
import { briefingContextSchema, briefingPreferencesSchema } from '../briefing-policy'
import { SecurityAccountError } from '../account-security-policy'
export function createBriefingRoute(dependencies = { collectBriefing, generateBriefingMessage, recordBriefingVisit, saveBriefingPreferences }) {
  const route = new Hono()
  route.onError((error, c) => c.json({ error: error instanceof SecurityAccountError ? error.message : 'Omni-Briefing konnte nicht vollständig geladen werden. Bitte erneut versuchen.' }, error instanceof SecurityAccountError ? error.status : 503))
  route.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  route.get('/', async (c) => {
    const parsed = briefingContextSchema.safeParse({ visitId: c.req.query('visitId'), exclude: c.req.query('exclude')?.split(',').filter(Boolean) ?? [] })
    if (!parsed.success) return c.json({ error: 'Ungültiger Briefing-Kontext.' }, 400)
    return c.json(await dependencies.collectBriefing(c.get('userId'), parsed.data.visitId, parsed.data.exclude))
  })
  route.post('/visit', async (c) => {
    const parsed = z.object({ visitId: z.uuid() }).strict().safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Besuchskennung.' }, 400)
    await dependencies.recordBriefingVisit(c.get('userId'), parsed.data.visitId)
    return c.json({ ok: true })
  })
  route.put('/preferences', async (c) => {
    const parsed = z.object({ preferences: briefingPreferencesSchema, version: z.number().int().positive() }).strict().safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültige Einstellungen, Zeitzone oder Version.' }, 400)
    await dependencies.saveBriefingPreferences(c.get('userId'), parsed.data.version, parsed.data.preferences)
    return c.json({ ok: true })
  })
  route.post('/message', async (c) => {
    const parsed = briefingContextSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: 'Ungültiger Briefing-Kontext.' }, 400)
    // Re-read all facts and permissions; the browser never supplies trusted facts or AI prompts.
    const snapshot = await dependencies.collectBriefing(c.get('userId'), parsed.data.visitId, parsed.data.exclude)
    return c.json(await dependencies.generateBriefingMessage(c.get('userId'), snapshot))
  })
  return route
}
export const briefingRoute = createBriefingRoute()
