import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import {
  BrowserDeskError,
  browserItemInput,
  browserUpdateInput,
  browserPairInput,
  browserExchangeInput,
  browserPanelInput,
} from '../browser-policy'
import { browserSourceUrl } from '../../src/lib/browser-url'
import * as storage from '../browser-storage'
const versionInput = z.object({ version: z.number().int().positive() }).strict()
export const browserDataDependencies = {
  browserPanelView: storage.browserPanelView,
  browserProjects: storage.browserProjects,
  ownsBrowserProject: storage.ownsBrowserProject,
  listBrowserItems: storage.listBrowserItems,
  saveBrowserItem: storage.saveBrowserItem,
  updateBrowserItem: storage.updateBrowserItem,
  deleteBrowserItem: storage.deleteBrowserItem,
}
function baseRoute() {
  const route = new Hono()
  route.use(
    '*',
    bodyLimit({
      maxSize: 128_000,
      onError: (c) => c.json({ error: 'Die Anfrage ist zu groß.' }, 413),
    }),
  )
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.onError((e, c) =>
    c.json(
      {
        error:
          e instanceof BrowserDeskError
            ? e.message
            : 'Browser-Notizen konnten nicht verarbeitet werden. Verbindung und Datenbankeinrichtung prüfen.',
      },
      e instanceof BrowserDeskError ? e.status : 503,
    ),
  )
  return route
}
export function createBrowserDataRoute(deps = browserDataDependencies) {
  const route = baseRoute()
  // Lesend für App und Erweiterung. Die Erweiterung erhält hierüber ihre
  // Schnellzugriffe und Befehle; ändern kann sie die Konfiguration nicht.
  route.get('/panel', async (c) =>
    c.json(
      await deps.browserPanelView(c.get('userId'), new URL(c.req.url).origin),
    ),
  )
  route.get('/projects', async (c) =>
    c.json(await deps.browserProjects(c.get('userId'))),
  )
  route.get('/items', async (c) => {
    const projectId = c.req.query('projectId'),
      rawUrl = c.req.query('url')
    if (projectId && !z.uuid().safeParse(projectId).success)
      return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    let url: string | undefined
    if (rawUrl) {
      try {
        url = browserSourceUrl(rawUrl)
      } catch {
        return c.json({ error: 'Nicht unterstützte Seitenadresse.' }, 400)
      }
    }
    if (
      projectId &&
      !(await deps.ownsBrowserProject(c.get('userId'), projectId))
    )
      return c.json({ error: 'Eigenes Projekt nicht gefunden.' }, 404)
    return c.json(
      await deps.listBrowserItems(c.get('userId'), { url, projectId }),
    )
  })
  route.post('/items', async (c) => {
    const input = browserItemInput.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json(
        {
          error:
            'Titel, Seitenadresse, Textauswahl, Anmerkung und Projektzuordnung prüfen.',
        },
        400,
      )
    return c.json(await deps.saveBrowserItem(c.get('userId'), input.data), 201)
  })
  route.use('/items/:id', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Eintragskennung.' }, 400)
    await next()
  })
  route.put('/items/:id', async (c) => {
    const input = browserUpdateInput.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json({ error: 'Ungültiger Inhalt oder Versionsstand.' }, 400)
    return c.json(
      await deps.updateBrowserItem(
        c.get('userId'),
        c.req.param('id'),
        input.data,
      ),
    )
  })
  route.delete('/items/:id', async (c) => {
    const input = versionInput.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Versionsstand fehlt.' }, 400)
    await deps.deleteBrowserItem(
      c.get('userId'),
      c.req.param('id'),
      input.data.version,
    )
    return c.json({ ok: true })
  })
  return route
}
export const browserWebDependencies = {
  ...browserDataDependencies,
  saveBrowserPanel: storage.saveBrowserPanel,
  createBrowserPairing: storage.createBrowserPairing,
  listBrowserDevices: storage.listBrowserDevices,
  revokeBrowserDevice: storage.revokeBrowserDevice,
}
export function createBrowserWebRoute(deps = browserWebDependencies) {
  const route = baseRoute()
  route.post('/pair', async (c) => {
    const input = browserPairInput.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json(
        {
          error:
            'Ungültige Verbindungsanfrage. Verbindung aus der Erweiterung erneut starten.',
        },
        400,
      )
    return c.json(
      await deps.createBrowserPairing(c.get('userId'), input.data.challenge),
    )
  })
  // Schreiben ausschließlich aus der angemeldeten App, nie aus der Erweiterung.
  route.put('/panel', async (c) => {
    const input = browserPanelInput.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json(
        {
          error:
            input.error.issues[0]?.message ??
            'Schnellzugriffe, Befehlsanzeige oder Versionsstand prüfen.',
        },
        400,
      )
    return c.json(await deps.saveBrowserPanel(c.get('userId'), input.data))
  })
  route.get('/devices', async (c) =>
    c.json(await deps.listBrowserDevices(c.get('userId'))),
  )
  route.delete('/devices/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success)
      return c.json({ error: 'Ungültige Verbindungskennung.' }, 400)
    await deps.revokeBrowserDevice(c.get('userId'), c.req.param('id'))
    return c.json({ ok: true })
  })
  route.route('/', createBrowserDataRoute(deps))
  return route
}
export const browserExtensionDependencies = {
  ...browserDataDependencies,
  exchangeBrowserPairing: storage.exchangeBrowserPairing,
  authenticateBrowserDevice: storage.authenticateBrowserDevice,
  revokeBrowserDevice: storage.revokeBrowserDevice,
}
export function createBrowserExtensionRoute(
  deps = browserExtensionDependencies,
) {
  const route = baseRoute()
  route.post('/pair/exchange', async (c) => {
    const input = browserExchangeInput.safeParse(
      await c.req.json().catch(() => null),
    )
    if (!input.success)
      return c.json({ error: 'Ungültige Verbindungsanfrage.' }, 400)
    return c.json(
      await deps.exchangeBrowserPairing(input.data.code, input.data.verifier),
    )
  })
  const data = baseRoute()
  data.use('*', async (c, next) => {
    const header = c.req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
    const device = await deps.authenticateBrowserDevice(token)
    if (!device)
      return c.json(
        {
          error:
            'Erweiterung nicht verbunden, abgelaufen oder widerrufen. In OMNIDESK erneut verbinden.',
        },
        401,
      )
    c.set('userId', device.userId)
    c.set('browserDeviceId', device.id)
    await next()
  })
  data.post('/disconnect', async (c) => {
    await deps.revokeBrowserDevice(c.get('userId'), c.get('browserDeviceId'))
    return c.json({ ok: true })
  })
  data.route('/', createBrowserDataRoute(deps))
  route.route('/data', data)
  return route
}
declare module 'hono' {
  interface ContextVariableMap {
    browserDeviceId: string
  }
}
export const browserWebRoute = createBrowserWebRoute()
export const browserExtensionRoute = createBrowserExtensionRoute()
