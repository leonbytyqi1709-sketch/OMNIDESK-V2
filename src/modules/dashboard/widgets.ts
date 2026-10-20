import type { ComponentType } from 'react'
import {
  Activity,
  CalendarDays,
  Cloud,
  Globe,
  Link2,
  ListTodo,
  NotebookPen,
  Sparkles,
  SquareKanban,
  ShieldCheck,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { AccountSecurityWidget } from './components/AccountSecurityWidget'
import { AppointmentsWidget } from './components/AppointmentsWidget'
import { CloudStorageWidget } from './components/CloudStorageWidget'
import { GreetingWidget } from './components/GreetingWidget'
import { LinksWidget } from './components/LinksWidget'
import { NotesWidget } from './components/NotesWidget'
import { PomodoroWidget } from './components/PomodoroWidget'
import { ProjectsWidget } from './components/ProjectsWidget'
import { QuickStatsWidget } from './components/QuickStatsWidget'
import { TasksWidget } from './components/TasksWidget'
import { TimezonesWidget } from './components/TimezonesWidget'
import { UptimeWidget } from './components/UptimeWidget'

export interface DashboardWidgetMeta {
  id: string
  title: string
  description: string
  icon: LucideIcon
  component: ComponentType
  /** CSS-Klasse für Grid-Spannbreite */
  colSpanClass?: string
  /** Zugehöriges Modul aus der moduleRegistry; wird das Modul deaktiviert, entfällt auch das Widget */
  moduleId?: string
}

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  {
    id: 'account-security',
    title: 'Kontosicherheit',
    description: 'Dokumentierte Absicherung und offene Kontoprüfungen',
    icon: ShieldCheck,
    component: AccountSecurityWidget,
    moduleId: 'account-security',
  },
  {
    id: 'greeting',
    title: 'Begrüßung & Live-Uhr',
    description: 'Große Statuskarte mit Tageszeit, Datum und Live-Sekundenuhr',
    icon: Sparkles,
    component: GreetingWidget,
    colSpanClass: 'md:col-span-2',
  },
  {
    id: 'quick-stats',
    title: 'Tages-Fokus & Status',
    description: 'Zentrale Übersicht über offene Aufgaben, nächste Termine und Fokus-Timer',
    icon: Zap,
    component: QuickStatsWidget,
  },
  {
    id: 'cloud-storage',
    title: 'Cloud-Speicher',
    description: 'Aggregierte Speicherauslastung für Google Drive und MEGA mit Schwellenwert-Alarm',
    icon: Cloud,
    component: CloudStorageWidget,
    moduleId: 'cloud-monitor',
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro-Timer',
    description: 'Kompakte Steuerung des global laufenden Fokus-Timers',
    icon: Timer,
    component: PomodoroWidget,
    moduleId: 'pomodoro',
  },
  {
    id: 'tasks',
    title: 'Offene Aufgaben',
    description: 'Dringendste To-Dos sortiert nach Priorität und Fälligkeit',
    icon: ListTodo,
    component: TasksWidget,
    moduleId: 'tasks',
  },
  {
    id: 'appointments',
    title: 'Nächste Termine',
    description: 'Kommende Kalender- und Booking-Ereignisse',
    icon: CalendarDays,
    component: AppointmentsWidget,
    moduleId: 'calendar',
  },
  {
    id: 'timezones',
    title: 'IT-Weltuhr & Zeitzonen',
    description: 'Live-Uhrzeiten für Berlin, Server (UTC), New York und Tokio',
    icon: Globe,
    component: TimezonesWidget,
  },
  {
    id: 'notes',
    title: 'Letzte Notizen',
    description: 'Schnellzugriff auf zuletzt geänderte Dokumente',
    icon: NotebookPen,
    component: NotesWidget,
    moduleId: 'notes',
  },
  {
    id: 'links',
    title: 'Schnellzugriff Links',
    description: 'Gepinnte Web-Interfaces mit Favicons',
    icon: Link2,
    component: LinksWidget,
    moduleId: 'links',
  },
  {
    id: 'projects',
    title: 'Aktive Projekte',
    description: 'Status- und Prioritätsübersicht laufender Projekte',
    icon: SquareKanban,
    component: ProjectsWidget,
    moduleId: 'projects',
  },
  {
    id: 'uptime',
    title: 'Service-Health & Uptime',
    description: 'Live-Status und Latenz überwachter Dienste & Webseiten',
    icon: Activity,
    component: UptimeWidget,
    moduleId: 'uptime',
  },
]
