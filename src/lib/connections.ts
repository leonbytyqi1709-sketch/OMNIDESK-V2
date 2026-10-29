/**
 * Verknüpfungen zwischen Modulen.
 *
 * Eine Verknüpfung ist ungerichtet: „Notiz hängt an Projekt“ ist dasselbe wie
 * „Projekt hängt an Notiz“. Gespeichert wird sie deshalb in einer festen
 * Reihenfolge (siehe `orderEnds`), damit dieselbe Verbindung nicht zweimal
 * entstehen kann.
 */

export const CONNECTION_KINDS = ['note', 'task', 'appointment', 'contact', 'project'] as const

export type ConnectionKind = (typeof CONNECTION_KINDS)[number]

export interface ConnectionEnd {
  kind: ConnectionKind
  id: string
}

/** Ein verknüpftes Objekt, wie es die Oberfläche anzeigt. */
export interface ConnectedItem extends ConnectionEnd {
  /** Verknüpfungs-Kennung, zum Lösen der Verbindung. */
  connectionId: string
  title: string
  /** Zusatzzeile, etwa Datum eines Termins oder Firma eines Kontakts. */
  detail: string
  linkedAt: string
}

export const CONNECTION_LABEL: Record<ConnectionKind, string> = {
  note: 'Notiz',
  task: 'Aufgabe',
  appointment: 'Termin',
  contact: 'Kontakt',
  project: 'Projekt',
}

/** Zielseite je Art – damit ein Treffer anklickbar ist. */
export const CONNECTION_PATH: Record<ConnectionKind, string> = {
  note: '/notes',
  task: '/tasks',
  appointment: '/calendar',
  contact: '/contacts',
  project: '/projects',
}

export const isConnectionKind = (value: unknown): value is ConnectionKind =>
  typeof value === 'string' && (CONNECTION_KINDS as readonly string[]).includes(value)

/**
 * Feste Reihenfolge der beiden Enden. Ohne sie lägen „A→B“ und „B→A“ als zwei
 * Zeilen in der Tabelle und die Eindeutigkeit liefe ins Leere.
 */
export function orderEnds(one: ConnectionEnd, other: ConnectionEnd) {
  const left = `${one.kind}:${one.id}`,
    right = `${other.kind}:${other.id}`
  return left <= right ? ([one, other] as const) : ([other, one] as const)
}

export const sameEnd = (one: ConnectionEnd, other: ConnectionEnd) =>
  one.kind === other.kind && one.id === other.id
