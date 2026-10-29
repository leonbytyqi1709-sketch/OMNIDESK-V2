/**
 * Fokuszeiten: abgeschlossene Pomodoro-Blöcke, die an einer Aufgabe, einer
 * Projektaufgabe oder einem Projekt hängen können.
 *
 * Der Timer lief bisher frei in der Luft – gezählt wurden nur die Blöcke der
 * laufenden Browser-Sitzung, und sie gingen beim Neuladen verloren.
 */

export const FOCUS_KINDS = ['task', 'projectTask', 'project'] as const

export type FocusKind = (typeof FOCUS_KINDS)[number]

export const FOCUS_LABEL: Record<FocusKind, string> = {
  task: 'Aufgabe',
  projectTask: 'Projektaufgabe',
  project: 'Projekt',
}

export interface FocusTarget {
  kind: FocusKind
  id: string
  /** Im Browser gemerkter Titel, damit der Timer ihn ohne Abruf anzeigen kann. */
  title: string
}

export interface FocusSessionInput {
  /** Vom Browser vergeben, damit ein zweiter Versuch nichts doppelt anlegt. */
  id: string
  startedAt: string
  seconds: number
  target: { kind: FocusKind; id: string } | null
}

export interface FocusTotal {
  kind: FocusKind | null
  id: string | null
  title: string
  seconds: number
  sessions: number
}

export interface FocusSummary {
  /** Summe des gesamten Zeitraums in Sekunden. */
  seconds: number
  sessions: number
  days: Array<{ date: string; seconds: number }>
  totals: FocusTotal[]
}

/** Kürzeste Zeitspanne, die gespeichert wird – darunter ist es kein Fokusblock. */
export const FOCUS_MIN_SECONDS = 60

/** Obergrenze je Eintrag (vier Stunden); schützt vor Unsinn aus einem Fehler. */
export const FOCUS_MAX_SECONDS = 4 * 60 * 60

export const isFocusKind = (value: unknown): value is FocusKind =>
  typeof value === 'string' && (FOCUS_KINDS as readonly string[]).includes(value)

/** „1 h 25 min“, „25 min“, „45 s“ – kurz genug für eine Kachel. */
export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
