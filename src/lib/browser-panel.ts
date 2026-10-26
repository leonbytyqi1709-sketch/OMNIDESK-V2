/**
 * Gemeinsame Grundlage für die Schnellzugriffe im Browser-Seitenpanel.
 *
 * Die Modulliste steht bewusst hier und nicht in `src/config/modules.ts`: Jene
 * Datei lädt React-Komponenten und Icons und lässt sich deshalb nicht auf dem
 * Server auswerten. Der Server prüft Schnellzugriffe gegen genau diese Liste,
 * damit über die Konfiguration keine beliebigen Adressen in das Panel gelangen.
 *
 * Der Passwort-Manager fehlt absichtlich: Das Panel ist eine Abkürzung in die
 * App, und ein Direktlink in den Vault gehört nicht in eine Browser-Erweiterung.
 */
export interface BrowserPanelModule {
  /** Modul-ID aus der Registry, nur zur Zuordnung */
  id: string
  /** Anzeigename im Panel und in der Konfiguration */
  title: string
  /** Routenpfad, zugleich das gespeicherte Ziel */
  path: string
}

export const BROWSER_PANEL_MODULES: BrowserPanelModule[] = [
  { id: 'dashboard', title: 'Dashboard', path: '/' },
  { id: 'mission-control', title: 'Mission Control', path: '/mission-control' },
  { id: 'browser-desk', title: 'Browser-Kommandoebene', path: '/browser-desk' },
  { id: 'shared-rooms', title: 'Gemeinsame Räume', path: '/shared-rooms' },
  { id: 'notes', title: 'Notizen', path: '/notes' },
  { id: 'tasks', title: 'Aufgaben', path: '/tasks' },
  { id: 'calendar', title: 'Kalender & Booking', path: '/calendar' },
  { id: 'assistant', title: 'Omni', path: '/assistant' },
  { id: 'projects', title: 'Projektmanagement', path: '/projects' },
  { id: 'commands', title: 'Befehlsbibliothek', path: '/commands' },
  { id: 'links', title: 'Link-Manager', path: '/links' },
  { id: 'uptime', title: 'Uptime-Monitor', path: '/uptime' },
  { id: 'deployments', title: 'Deployments', path: '/deployments' },
  { id: 'github', title: 'GitHub', path: '/github' },
  { id: 'account-map', title: 'Kontenkarte', path: '/account-map' },
  { id: 'account-security', title: 'Kontosicherheit', path: '/account-security' },
  { id: 'contacts', title: 'Kontakte', path: '/contacts' },
  { id: 'cloud-monitor', title: 'Cloud-Monitoring', path: '/cloud-monitor' },
  { id: 'pomodoro', title: 'Pomodoro-Timer', path: '/pomodoro' },
]

/** Höchstzahl der Schnellzugriffe; das Panel ist schmal und bleibt übersichtlich. */
export const MAX_BROWSER_PANEL_ENTRIES = 8

/** Höchstzahl der an das Panel gelieferten Befehle. */
export const MAX_BROWSER_PANEL_COMMANDS = 200

/** Modul zu einem gespeicherten Pfad, sonst null. */
export function browserPanelModule(path: string): BrowserPanelModule | null {
  return BROWSER_PANEL_MODULES.find((entry) => entry.path === path) ?? null
}

/**
 * Nur http- und https-Adressen dürfen als Schnellzugriff in das Panel. Andere
 * Protokolle würden dort als anklickbares Ziel erscheinen, ohne dass der
 * Browser sie sinnvoll öffnen kann.
 */
export function browserPanelLinkUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}
