export interface BrowserItem {
  id: string
  title: string
  url: string
  selection: string
  annotation: string
  projectId: string | null
  projectName: string | null
  version: number
  createdAt: string
  updatedAt: string
}
export interface BrowserItemInput {
  id: string
  title: string
  url: string
  selection: string
  annotation: string
  projectId: string | null
}
export interface BrowserDevice {
  id: string
  name: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
}
export interface BrowserProject {
  id: string
  name: string
}

/** Ein gespeicherter Schnellzugriff des Seitenpanels. */
export interface BrowserPanelEntry {
  id: string
  kind: 'module' | 'link'
  /** Modulpfad oder Kennung eines eigenen Eintrags aus dem Link-Manager */
  target: string
}

/** Schnellzugriff, wie ihn das Panel darstellt. */
export interface BrowserPanelResolvedEntry extends BrowserPanelEntry {
  label: string
  /** Vollständige Zieladresse; null, wenn das Ziel nicht mehr auflösbar ist */
  url: string | null
  available: boolean
}

/** Befehl aus der Befehlsbibliothek, wie ihn das Panel darstellt. */
export interface BrowserPanelCommand {
  id: string
  title: string
  command: string
  category: string
}

/** Gespeicherte Panel-Konfiguration des Benutzers. */
export interface BrowserPanelConfig {
  entries: BrowserPanelEntry[]
  showCommands: boolean
  /** null = alle Kategorien */
  commandCategory: string | null
  version: number
}

/** Was das Panel in einem Abruf erhält. */
export interface BrowserPanelView extends BrowserPanelConfig {
  quickAccess: BrowserPanelResolvedEntry[]
  commands: BrowserPanelCommand[]
  commandsLimited: boolean
  /** Vorhandene Kategorien der eigenen Befehle, für die Konfiguration */
  commandCategories: string[]
}

