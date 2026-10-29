import { and, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { db } from '../src/db/client'
import {
  appointments,
  contacts,
  notes,
  projects,
  tasks,
} from '../src/db/schema/index'
import {
  type ConnectedItem,
  type ConnectionEnd,
  type ConnectionKind,
  CONNECTION_KINDS,
  orderEnds,
} from '../src/lib/connections'
import { missingNeonStorage, monitoringSql } from './neon-storage'

/**
 * Speicher für modulübergreifende Verknüpfungen.
 *
 * Die Tabelle wird wie die übrigen V2-Tabellen additiv zur Laufzeit angelegt.
 * Fremdschlüssel sind nicht möglich, weil ein Ende auf fünf verschiedene
 * Tabellen zeigen kann; stattdessen prüft jede Schreiboperation den Besitz in
 * derselben Anweisung, und beim Lesen fallen Zeilen heraus (und werden
 * entfernt), deren Gegenstück es nicht mehr gibt.
 */

export const connectionsDdl = [
  `CREATE TABLE IF NOT EXISTS v2_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    a_kind text NOT NULL, a_id uuid NOT NULL,
    b_kind text NOT NULL, b_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT v2_connections_distinct CHECK (a_kind <> b_kind OR a_id <> b_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS v2_connections_pair
    ON v2_connections(user_id, a_kind, a_id, b_kind, b_id)`,
  `CREATE INDEX IF NOT EXISTS v2_connections_a ON v2_connections(user_id, a_kind, a_id)`,
  `CREATE INDEX IF NOT EXISTS v2_connections_b ON v2_connections(user_id, b_kind, b_id)`,
]

/** Tabelle und Titelspalte je Art. Feste Zuordnung – nichts davon stammt aus einer Eingabe. */
const SOURCES = {
  note: { table: 'notes', entity: notes },
  task: { table: 'tasks', entity: tasks },
  appointment: { table: 'appointments', entity: appointments },
  contact: { table: 'contacts', entity: contacts },
  project: { table: 'projects', entity: projects },
} as const satisfies Record<ConnectionKind, { table: string; entity: unknown }>

async function withTable<T>(run: () => Promise<T>, fallback: () => T) {
  try {
    return await run()
  } catch (error) {
    if (missingNeonStorage(error)) return fallback()
    throw error
  }
}

let prepared: Promise<void> | null = null

async function ensureTable() {
  prepared ??= (async () => {
    try {
      const sql = monitoringSql()
      const [state] = await sql`SELECT to_regclass('v2_connections') IS NOT NULL AS ready`
      if (state?.ready) return
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(184730034)`,
        ...connectionsDdl.map((statement) => sql.query(statement)),
      ])
    } catch (error) {
      prepared = null
      throw error
    }
  })()
  return prepared
}

interface Row {
  id: string
  a_kind: ConnectionKind
  a_id: string
  b_kind: ConnectionKind
  b_id: string
  created_at: string
}

/** Titel und Zusatzzeile der Gegenstücke nachschlagen, je Art eine Abfrage. */
async function describe(wanted: Map<ConnectionKind, Set<string>>) {
  const found = new Map<string, { title: string; detail: string }>()
  const key = (kind: ConnectionKind, id: string) => `${kind}:${id}`

  for (const [kind, ids] of wanted) {
    const list = [...ids]
    if (list.length === 0) continue
    if (kind === 'note') {
      for (const row of await db
        .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
        .from(notes)
        .where(inArray(notes.id, list)))
        found.set(key(kind, row.id), {
          title: row.title.trim() || 'Unbenannte Notiz',
          detail: `Zuletzt geändert ${row.updatedAt.toLocaleDateString('de-DE')}`,
        })
    } else if (kind === 'task') {
      for (const row of await db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
        .from(tasks)
        .where(inArray(tasks.id, list)))
        found.set(key(kind, row.id), {
          title: row.title,
          detail: row.dueDate
            ? `Fällig ${row.dueDate.toLocaleDateString('de-DE')}`
            : row.status === 'done'
              ? 'Erledigt'
              : 'Ohne Frist',
        })
    } else if (kind === 'appointment') {
      for (const row of await db
        .select({ id: appointments.id, title: appointments.title, startsAt: appointments.startsAt })
        .from(appointments)
        .where(inArray(appointments.id, list)))
        found.set(key(kind, row.id), {
          title: row.title,
          detail: row.startsAt.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })
    } else if (kind === 'contact') {
      for (const row of await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          company: contacts.company,
          email: contacts.email,
        })
        .from(contacts)
        .where(inArray(contacts.id, list)))
        found.set(key(kind, row.id), {
          title: `${row.firstName} ${row.lastName}`.trim() || row.email || 'Ohne Namen',
          detail: row.company || row.email,
        })
    } else {
      for (const row of await db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(inArray(projects.id, list)))
        found.set(key(kind, row.id), { title: row.name, detail: `Status: ${row.status}` })
    }
  }
  return found
}

/** Alle Gegenstücke eines Objekts. Verwaiste Zeilen werden dabei entfernt. */
export async function listConnections(
  userId: string,
  end: ConnectionEnd,
): Promise<ConnectedItem[]> {
  return withTable(
    async () => {
      await ensureTable()
      const sql = monitoringSql()
      const rows = (await sql.query(
        `SELECT id,a_kind,a_id,b_kind,b_id,created_at FROM v2_connections
         WHERE user_id=$1 AND ((a_kind=$2 AND a_id=$3) OR (b_kind=$2 AND b_id=$3))
         ORDER BY created_at DESC`,
        [userId, end.kind, end.id],
      )) as Row[]
      if (rows.length === 0) return []

      const others = rows.map((row) => {
        const mine = row.a_kind === end.kind && row.a_id === end.id
        return {
          connectionId: row.id,
          kind: mine ? row.b_kind : row.a_kind,
          id: mine ? row.b_id : row.a_id,
          linkedAt: new Date(row.created_at).toISOString(),
        }
      })

      const wanted = new Map<ConnectionKind, Set<string>>()
      for (const other of others)
        (wanted.get(other.kind) ?? wanted.set(other.kind, new Set()).get(other.kind)!).add(other.id)
      const described = await describe(wanted)

      const items: ConnectedItem[] = []
      const orphans: string[] = []
      for (const other of others) {
        const info = described.get(`${other.kind}:${other.id}`)
        if (!info) {
          orphans.push(other.connectionId)
          continue
        }
        items.push({ ...other, ...info })
      }
      // Gelöschte Objekte hinterlassen Zeilen ohne Gegenstück; sie können
      // nicht per Fremdschlüssel wegfallen, also räumen wir sie hier auf.
      if (orphans.length > 0)
        await sql.query(
          `DELETE FROM v2_connections WHERE user_id=$1 AND id IN (${orphans
            .map((_, index) => `$${index + 2}::uuid`)
            .join(',')})`,
          [userId, ...orphans],
        )
      return items
    },
    () => [],
  )
}

export type ConnectResult =
  | { ok: true; connectionId: string; created: boolean }
  | { ok: false; reason: 'unknown' }

/**
 * Verbindet zwei Objekte. Beide müssen dem Benutzer gehören; das wird in
 * derselben Anweisung geprüft, damit eine gleichzeitige Löschung kein Zeitfenster
 * öffnet. Ein zweiter Aufruf legt nichts doppelt an.
 */
export async function connect(
  userId: string,
  one: ConnectionEnd,
  other: ConnectionEnd,
): Promise<ConnectResult> {
  await ensureTable()
  const [a, b] = orderEnds(one, other)
  const sql = monitoringSql()
  const inserted = (await sql.query(
    `INSERT INTO v2_connections(user_id,a_kind,a_id,b_kind,b_id)
     SELECT $1,$2,$3::uuid,$4,$5::uuid
     WHERE EXISTS(SELECT 1 FROM ${SOURCES[a.kind].table} WHERE id=$3::uuid AND user_id=$1)
       AND EXISTS(SELECT 1 FROM ${SOURCES[b.kind].table} WHERE id=$5::uuid AND user_id=$1)
     ON CONFLICT DO NOTHING RETURNING id`,
    [userId, a.kind, a.id, b.kind, b.id],
  )) as Array<{ id: string }>
  if (inserted[0]) return { ok: true, connectionId: inserted[0].id, created: true }

  // Kein Treffer heißt entweder „gibt es schon“ oder „gehört dir nicht“.
  const existing = (await sql.query(
    `SELECT id FROM v2_connections
     WHERE user_id=$1 AND a_kind=$2 AND a_id=$3::uuid AND b_kind=$4 AND b_id=$5::uuid`,
    [userId, a.kind, a.id, b.kind, b.id],
  )) as Array<{ id: string }>
  return existing[0]
    ? { ok: true, connectionId: existing[0].id, created: false }
    : { ok: false, reason: 'unknown' }
}

export async function disconnect(userId: string, connectionId: string) {
  return withTable(
    async () => {
      const sql = monitoringSql()
      const rows = (await sql.query(
        `DELETE FROM v2_connections WHERE id=$1::uuid AND user_id=$2 RETURNING id`,
        [connectionId, userId],
      )) as Array<{ id: string }>
      return rows.length > 0
    },
    () => false,
  )
}

export interface SearchHit {
  kind: ConnectionKind
  id: string
  title: string
  detail: string
}

/**
 * Objekte zum Verknüpfen suchen. Ohne Suchbegriff kommen die zuletzt
 * geänderten Einträge, damit die Auswahl nicht leer startet.
 */
export async function searchEntities(
  userId: string,
  term: string,
  perKind = 5,
): Promise<SearchHit[]> {
  const needle = `%${term.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`
  type Searchable = Parameters<typeof ilike>[0]
  const filter = (owner: SQL, ...columns: Searchable[]) =>
    term.trim() ? and(owner, or(...columns.map((column) => ilike(column, needle)))) : owner

  const [noteRows, taskRows, appointmentRows, contactRows, projectRows] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .where(filter(eq(notes.userId, userId), notes.title, notes.content))
      .orderBy(notes.updatedAt)
      .limit(perKind),
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(filter(eq(tasks.userId, userId), tasks.title, tasks.description))
      .limit(perKind),
    db
      .select({ id: appointments.id, title: appointments.title, startsAt: appointments.startsAt })
      .from(appointments)
      .where(filter(eq(appointments.userId, userId), appointments.title, appointments.location))
      .limit(perKind),
    db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        company: contacts.company,
        email: contacts.email,
      })
      .from(contacts)
      .where(
        filter(
          eq(contacts.userId, userId),
          contacts.firstName,
          contacts.lastName,
          contacts.company,
          contacts.email,
        ),
      )
      .limit(perKind),
    db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(filter(eq(projects.userId, userId), projects.name, projects.description))
      .limit(perKind),
  ])

  return [
    ...noteRows.map((row) => ({
      kind: 'note' as const,
      id: row.id,
      title: row.title.trim() || 'Unbenannte Notiz',
      detail: `Zuletzt geändert ${row.updatedAt.toLocaleDateString('de-DE')}`,
    })),
    ...taskRows.map((row) => ({
      kind: 'task' as const,
      id: row.id,
      title: row.title,
      detail: row.status === 'done' ? 'Erledigt' : 'Offen',
    })),
    ...appointmentRows.map((row) => ({
      kind: 'appointment' as const,
      id: row.id,
      title: row.title,
      detail: row.startsAt.toLocaleDateString('de-DE'),
    })),
    ...contactRows.map((row) => ({
      kind: 'contact' as const,
      id: row.id,
      title: `${row.firstName} ${row.lastName}`.trim() || row.email || 'Ohne Namen',
      detail: row.company || row.email,
    })),
    ...projectRows.map((row) => ({
      kind: 'project' as const,
      id: row.id,
      title: row.name,
      detail: `Status: ${row.status}`,
    })),
  ]
}

/** Prüft, ob ein Objekt dem Benutzer gehört – für die Route vor dem Lesen. */
export async function ownsEntity(userId: string, end: ConnectionEnd) {
  const sql = monitoringSql()
  const rows = (await sql.query(
    `SELECT 1 AS found FROM ${SOURCES[end.kind].table} WHERE id=$1::uuid AND user_id=$2`,
    [end.id, userId],
  )) as Array<{ found: number }>
  return rows.length > 0
}

export const CONNECTION_SOURCE_TABLES = CONNECTION_KINDS.map((kind) => SOURCES[kind].table)
