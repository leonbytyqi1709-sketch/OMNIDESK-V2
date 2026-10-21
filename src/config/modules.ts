import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
  Activity,
  Bot,
  CalendarDays,
  Cloud,
  Contact,
  Crosshair,
  PanelsTopLeft,
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
export interface ModuleDefinition {
  /** Eindeutige ID, entspricht dem Ordnernamen unter src/modules/ */
  id: string
  /** Anzeigename in Sidebar und Titelzeile */
  title: string
  /** Routen-Pfad des Moduls */
  path: string
  /** Icon für Sidebar und Modul-Manager */
  icon: LucideIcon
  /** Lazy geladener Einstiegspunkt des Moduls */
  component: LazyExoticComponent<ComponentType>
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
    component: lazy(() => import('@/modules/dashboard')),
    toggleable: false,
    category: 'core',
  },
  {
    id: 'settings',
    title: 'Einstellungen',
    path: '/settings',
    icon: Settings,
    component: lazy(() => import('@/modules/settings')),
    toggleable: false,
    category: 'core',
  },
  {
    id: 'mission-control',
    title: 'Mission Control',
    path: '/mission-control',
    icon: Crosshair,
    component: lazy(() => import('@/modules/mission-control')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'browser-desk', title: 'Browser-Kommandoebene', path: '/browser-desk',
    icon: PanelsTopLeft, component: lazy(() => import('@/modules/browser-desk')),
    toggleable: true, category: 'it-tools',
  },
  // 📑 Kern-Produktivität
  {
    id: 'notes',
    title: 'Notizen',
    path: '/notes',
    icon: NotebookPen,
    component: lazy(() => import('@/modules/notes')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'tasks',
    title: 'Aufgaben',
    path: '/tasks',
    icon: ListTodo,
    component: lazy(() => import('@/modules/tasks')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'calendar',
    title: 'Kalender & Booking',
    path: '/calendar',
    icon: CalendarDays,
    component: lazy(() => import('@/modules/calendar')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro-Timer',
    path: '/pomodoro',
    icon: Timer,
    component: lazy(() => import('@/modules/pomodoro')),
    toggleable: true,
    category: 'productivity',
  },
  {
    id: 'assistant',
    title: 'Omni',
    path: '/assistant',
    icon: Bot,
    component: lazy(() => import('@/modules/assistant')),
    toggleable: true,
    category: 'productivity',
  },
  // 🛠️ IT- & FiSi-Spezialtools
  {
    id: 'projects',
    title: 'Projektmanagement',
    path: '/projects',
    icon: SquareKanban,
    component: lazy(() => import('@/modules/projects')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'commands',
    title: 'Befehlsbibliothek',
    path: '/commands',
    icon: Terminal,
    component: lazy(() => import('@/modules/commands')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'links',
    title: 'Link-Manager',
    path: '/links',
    icon: Link2,
    component: lazy(() => import('@/modules/links')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'uptime',
    title: 'Uptime-Monitor',
    path: '/uptime',
    icon: Activity,
    component: lazy(() => import('@/modules/uptime')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'deployments',
    title: 'Deployments',
    path: '/deployments',
    icon: Rocket,
    component: lazy(() => import('@/modules/deployments')),
    toggleable: true,
    category: 'it-tools',
  },
  {
    id: 'github',
    title: 'GitHub',
    path: '/github',
    icon: GitBranch,
    component: lazy(() => import('@/modules/github')),
    toggleable: true,
    category: 'it-tools',
  },
  // 🔒 Sicherheit & Kontakte
  {
    id: 'account-map',
    title: 'Kontenkarte',
    path: '/account-map',
    icon: Network,
    component: lazy(() => import('@/modules/account-map')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'account-security',
    title: 'Kontosicherheit',
    path: '/account-security',
    icon: ShieldCheck,
    component: lazy(() => import('@/modules/account-security')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'passwords',
    title: 'Passwort-Manager',
    path: '/passwords',
    icon: KeyRound,
    component: lazy(() => import('@/modules/passwords')),
    toggleable: true,
    category: 'security',
  },
  {
    id: 'contacts',
    title: 'Kontakte',
    path: '/contacts',
    icon: Contact,
    component: lazy(() => import('@/modules/contacts')),
    toggleable: true,
    category: 'security',
  },
  // ☁️ Cloud-Monitoring
  {
    id: 'cloud-monitor',
    title: 'Cloud-Monitoring',
    path: '/cloud-monitor',
    icon: Cloud,
    component: lazy(() => import('@/modules/cloud-monitor')),
    toggleable: true,
    category: 'cloud',
  },
]
