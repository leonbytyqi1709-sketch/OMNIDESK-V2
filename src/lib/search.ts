/**
 * Suche über alle Module.
 *
 * Bis zum 29.10.2026 durchsuchte die Befehlspalette ausschließlich Notizen,
 * und zwar im Browser über die bereits geladene Liste. Gesucht wird jetzt auf
 * dem Server über alle Arten; die Palette zeigt nur noch an.
 */

export const SEARCH_KINDS = [
  'note',
  'task',
  'appointment',
  'contact',
  'project',
  'projectTask',
  'link',
  'command',
] as const

export type SearchKind = (typeof SEARCH_KINDS)[number]

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  /** Zweite Zeile: Datum, Firma, Status, Kategorie … */
  detail: string
  /** Textausschnitt rund um den Treffer, falls er im Inhalt lag. */
  snippet: string
  /** Fertige Adresse innerhalb der App, inklusive Direktlink-Parameter. */
  path: string
}

export const SEARCH_LABEL: Record<SearchKind, string> = {
  note: 'Notiz',
  task: 'Aufgabe',
  appointment: 'Termin',
  contact: 'Kontakt',
  project: 'Projekt',
  projectTask: 'Projektaufgabe',
  link: 'Link',
  command: 'Befehl',
}

/** Kürzester Suchbegriff, der eine Serveranfrage auslöst. */
export const SEARCH_MIN_LENGTH = 2

/** Treffer je Art; mehr würde die Palette unübersichtlich machen. */
export const SEARCH_PER_KIND = 5

/**
 * Textausschnitt rund um den ersten Treffer. Ohne Treffer im Text steht der
 * Anfang, damit die zweite Zeile nie leer bleibt.
 */
export function snippetAround(content: string, term: string, width = 70) {
  const text = content.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1
  if (at === -1) return text.slice(0, width) + (text.length > width ? '…' : '')
  const start = Math.max(0, at - 20),
    end = Math.min(text.length, at + term.length + width - 20)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}
