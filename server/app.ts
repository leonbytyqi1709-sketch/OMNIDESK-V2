import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from './auth'
import { linksRoute } from './routes/links'
import { notesRoute } from './routes/notes'
import { tasksRoute } from './routes/tasks'
import { contactsRoute } from './routes/contacts'
import { appointmentsRoute } from './routes/appointments'
import { commandsRoute } from './routes/commands'
import { projectsRoute } from './routes/projects'
import { vaultRoute } from './routes/vault'
import { bookingRoute } from './routes/booking'
import { publicBookingRoute } from './routes/public-booking'
import { googleCallbackRoute } from './routes/google-callback'
import { integrationsRoute } from './routes/integrations'
import { microsoftCallbackRoute } from './routes/microsoft-callback'
import { cloudMonitorRoute } from './routes/cloud-monitor'
import { uptimeRoute } from './routes/uptime'
import { neonHistoryRoute } from './routes/neon-history'
import { neonMonitorRoute } from './routes/neon-monitor'
import { briefingRoute } from './routes/briefing'
import { accountMapRoute } from './routes/account-map'
import { accountSecurityRoute } from './routes/account-security'
import { githubRoute } from './routes/github'
import { deploymentsRoute } from './routes/deployments'
import { autoMemoryRoute } from './routes/omni-memory-auto'
import { omniMemoryRoute } from './routes/omni-memory'
import { omniActionsRoute } from './routes/omni-actions'
import { chatRoute } from './routes/chat'

/**
 * Gemeinsame App-Factory für beide Laufzeiten:
 * - lokal:   server/index.ts (@hono/node-server, Port 8787)
 * - Vercel:  api/[[...route]].ts (hono/vercel-Adapter)
 * Neue Routen NUR hier registrieren.
 */
export function createApp() {
  const app = new Hono().basePath('/api')

  // Zentraler Fehlerfänger: Wirft eine Route einen Fehler (z. B. DB-Ausfall),
  // antwortet die API sauber mit 500 statt den Fehler an Node durchreichen
  // zu lassen (früher ein häufiger Crash-/Absturzgrund).
  app.onError((err, c) => {
    console.error(`[API] Fehler in ${c.req.method} ${c.req.path}:`, err)
    // Diagnose: Fehlende Env-Variablen direkt in der Antwort verraten,
    // damit man sie im Browser sieht (statt nur in den Vercel-Logs).
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.startsWith('ENV_FEHLT:')) {
      return c.json({ error: msg }, 500)
    }
    return c.json({ error: 'Interner Serverfehler' }, 500)
  })

  // Health-Check (öffentlich, ohne Auth) – zum Überwachen der API
  app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

  // Öffentliche Routen VOR der Auth-Middleware registrieren
  app.route('/public/booking', publicBookingRoute)
  app.route('/integrations/google', googleCallbackRoute)
  app.route('/integrations/microsoft', microsoftCallbackRoute)

  // Vercel-Cron-Endpunkt: täglicher Uptime-Auto-Check auf Hobby (vercel.json).
  // Ersetzt den 5-Minuten-Ticker aus server/index.ts, der im Serverless-
  // Betrieb nicht laufen kann. Geschützt über CRON_SECRET (Vercel sendet
  // automatisch `Authorization: Bearer $CRON_SECRET`).
  app.get('/cron/uptime-refresh', async (c) => {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return c.json({ error: 'CRON_SECRET ist nicht konfiguriert' }, 403)
    }
    if (c.req.header('Authorization') !== `Bearer ${secret}`) {
      return c.json({ error: 'Ungültiges Cron-Secret' }, 401)
    }
    try {
      const { refreshAllMonitors } = await import('./uptime-check')
      await refreshAllMonitors()
      return c.json({ ok: true })
    } catch (err) {
      console.error('[Cron] Uptime-Refresh fehlgeschlagen:', err)
      return c.json({ error: 'Uptime-Refresh fehlgeschlagen' }, 500)
    }
  })

  // Public only for an authenticated scheduler; never accepts SQL/URLs from a caller.
  app.get('/cron/neon-refresh', async (c) => {
    c.header('Cache-Control', 'no-store')
    const secret = process.env.CRON_SECRET
    if (!secret || c.req.header('Authorization') !== `Bearer ${secret}`) return c.json({ error: 'Scheduler nicht autorisiert.' }, 401)
    const projectId = c.req.query('projectId')
    if (projectId && !z.uuid().safeParse(projectId).success) return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    try {
      const { runNeonScheduler } = await import('./neon-runner')
      return c.json({ ok: true, ...await runNeonScheduler(projectId) })
    } catch { return c.json({ error: 'Neon-Hintergrundprüfung fehlgeschlagen. Speicher und Konfiguration prüfen.' }, 503) }
  })

  app.use('*', requireAuth)
  app.route('/links', linksRoute)
  app.route('/notes', notesRoute)
  app.route('/tasks', tasksRoute)
  app.route('/contacts', contactsRoute)
  app.route('/appointments', appointmentsRoute)
  app.route('/commands', commandsRoute)
  app.route('/projects', projectsRoute)
  app.route('/vault', vaultRoute)
  app.route('/booking', bookingRoute)
  app.route('/integrations', integrationsRoute)
  app.route('/cloud-monitor', cloudMonitorRoute)
  app.route('/uptime', uptimeRoute)
  app.route('/neon', neonHistoryRoute)
  app.route('/neon', neonMonitorRoute)
  app.route('/deployments', deploymentsRoute)
  app.route('/github', githubRoute)
  app.route('/account-security', accountSecurityRoute)
  app.route('/account-map', accountMapRoute)
  app.route('/briefing', briefingRoute)
  app.route('/chat', chatRoute)
  app.route('/omni-actions', omniActionsRoute)
  app.route('/omni-memory', omniMemoryRoute)
  app.route('/omni-memory-auto', autoMemoryRoute)

  return app
}
