import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
  Activity,
  Bot,
  CalendarDays,
  Cloud,
  Contact,
  Crosshair,
  PanelsTopLeft,
  UsersRound,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListTodo,
  NotebookPen,
  Network,
  Rocket,
  Settings,
  ShieldCheck,
  SquareKanban,
  Terminal,
  Timer,
  type LucideIcon,
} from 'lucide-react'

/**
 * Zentrale Modul-Registry von OmniDesk.
 *
 * Jedes Werkzeug ist ein isoliertes Modul unter `src/modules/<id>/` und wird
 * per React.lazy erst beim ersten Aufruf geladen (Architektur-Prinzip
 * "Modulares Lazy-Loading", Spezifikation V2, Abschnitt 2).
 *
 * Sidebar, Router und der Modul-Manager in den Einstellungen speisen sich
 * ausschließlich aus dieser Liste – ein neues Modul wird nur hier registriert.
 */
/** Lazy geladenes Modul, dessen Code sich vorab anfordern lässt. */
export type PreloadableModule = LazyExoticComponent<ComponentType> & {
  /** Lädt den Modul-Code im Hintergrund, ohne ihn darzustellen. */
  preload: () => void
}

/**
 * Wie `React.lazy`, merkt sich aber den Ladevorgang, damit die Sidebar den
 * Code eines Moduls bereits beim Überfahren anfordern kann. Der Wechsel wirkt
 * dadurch sofort, statt erst beim Klick mit dem Nachladen zu beginnen.
 * Mehrfache Aufrufe lösen nur einen Ladevorgang aus; Fehler bleiben dem
 * regulären Suspense-Pfad überlassen.
 */
function lazyModule(
  loader: () => Promise<{ default: ComponentType }>,
): PreloadableModule {
  let started: Promise<{ default: ComponentType }> | null = null
  const load = () => (started ??= loader())
  const component = lazy(load) as PreloadableModule
  component.preload = () => {
    void load().catch(() => {
      // Ein fehlgeschlagener Vorabruf darf nichts auslösen; der echte Aufruf
      // der Route meldet den Fehler weiterhin über Suspense.
      started = null
    })
  }
  return component
}

export interface ModuleDefinition {
  /** Eindeutige ID, entspricht dem Ordnernamen unter src/modules/ */
  id: string
  /** Anzeigename in Sidebar und Titelzeile */
  title: string
  /** Routen-Pfad des Moduls */
  path: string
  /** Icon für Sidebar und Modul-Manager */
  icon: LucideIcon
  /** Lazy geladener Einstiegspunkt des Moduls, mit Vorladefunktion */
  component: PreloadableModule
  /** false für Core-Module (Dashboard, Settings), die der Modul-Manager nicht abschalten darf */
  toggleable: boolean
  /** Gruppierung in der Sidebar */
  category: 'core' | 'productivity' | 'it-tools' | 'security' | 'cloud'
}

export const moduleRegistry: ModuleDefinition[] = [
  // ⚙️ Core-System
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    component: lazyModule(() => import('@/modules/dashboard')),
    toggleable: false,
    category: 'core',
  },
  {
    id: 'settings',
    title: 'Einstellungen',
    path: '/settings',
    icon: Settings,
    component: lazyModule(() => import('@/modules/settings')),
    toggleable: false,
    category: 'core',
  },
  {
    id: 'mission-control',
    title: 'Mission Control',
    path: '/mission-control',
    icon: Crosshair,
    component: lazyModule(() => import('@/modules/mission-control')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'browser-desk', title: 'Browser-Kommandoebene', path: '/browser-desk',
    icon: PanelsTopLeft, component: lazyModule(() => import('@/modules/browser-desk')),
    toggleable: true, category: 'it-tools',
  },
  // 📑 Kern-Produktivität
  {
    id: 'shared-rooms', title: 'Gemeinsame Räume', path: '/shared-rooms',
    icon: UsersRound, component: lazyModule(() => import('@/modules/shared-rooms')),
    toggleable: true, category: 'productivity',
  },
  {
    id: 'notes',
    title: 'Notizen',
    path: '/notes',
    icon: NotebookPen,
    component: lazyModule(() => import('@/modules/notes')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'tasks',
    title: 'Aufgaben',
    path: '/tasks',
    icon: ListTodo,
    component: lazyModule(() => import('@/modules/tasks')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'calendar',
    title: 'Kalender & Booking',
    path: '/calendar',
    icon: CalendarDays,
    component: lazyModule(() => import('@/modules/calendar')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro-Timer',
    path: '/pomodoro',
    icon: Timer,
    component: lazyModule(() => import('@/modules/pomodoro')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'assistant',
    title: 'Omni',
    path: '/assistant',
    icon: Bot,
    component: lazyModule(() => import('@/modules/assistant')),
    toggleable: true,
    category: 'productivity',
  },
  // 🛠️ IT- & FiSi-Spezialtools
  {
    id: 'projects',
    title: 'Projektmanagement',
    path: '/projects',
    icon: SquareKanban,
    component: lazyModule(() => import('@/modules/projects')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'commands',
    title: 'Befehlsbibliothek',
    path: '/commands',
    icon: Terminal,
    component: lazyModule(() => import('@/modules/commands')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'links',
    title: 'Link-Manager',
    path: '/links',
    icon: Link2,
    component: lazyModule(() => import('@/modules/links')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'uptime',
    title: 'Uptime-Monitor',
    path: '/uptime',
    icon: Activity,
    component: lazyModule(() => import('@/modules/uptime')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'deployments',
    title: 'Deployments',
    path: '/deployments',
    icon: Rocket,
    component: lazyModule(() => import('@/modules/deployments')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'github',
    title: 'GitHub',
    path: '/github',
    icon: GitBranch,
    component: lazyModule(() => import('@/modules/github')),
    toggleable: true,
    category: 'it-tools',
  },
  // 🔒 Sicherheit & Kontakte
  {
    id: 'account-map',
    title: 'Kontenkarte',
    path: '/account-map',
    icon: Network,
    component: lazyModule(() => import('@/modules/account-map')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'account-security',
    title: 'Kontosicherheit',
    path: '/account-security',
    icon: ShieldCheck,
    component: lazyModule(() => import('@/modules/account-security')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'passwords',
    title: 'Passwort-Manager',
    path: '/passwords',
    icon: KeyRound,
    component: lazyModule(() => import('@/modules/passwords')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'contacts',
    title: 'Kontakte',
    path: '/contacts',
    icon: Contact,
    component: lazyModule(() => import('@/modules/contacts')),
    toggleable: true,
    category: 'security',
  },
  // ☁️ Cloud-Monitoring
  {
    id: 'cloud-monitor',
    title: 'Cloud-Monitoring',
    path: '/cloud-monitor',
    icon: Cloud,
    component: lazyModule(() => import('@/modules/cloud-monitor')),
    toggleable: true,
    category: 'cloud',
  },
]
