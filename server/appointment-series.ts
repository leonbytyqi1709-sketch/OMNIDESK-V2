import {
  MAX_OCCURRENCES,
  type RecurrenceRule,
  occurrences,
} from '../src/lib/recurrence'
import { missingNeonStorage, monitoringSql } from './neon-storage'

/**
 * Serientermine.
 *
 * Eine Serie erzeugt ganz normale Termine; nur die Zugehörigkeit steht in
 * einer eigenen Tabelle. Dadurch bleiben Kalender, Terminliste, Suche,
 * Verknüpfungen und die Buchungsprüfung unverändert – sie sehen Termine wie
 * jeden anderen auch. Die Zuordnung hängt per Fremdschlüssel am Termin: Wird
 * ein einzelner gelöscht, verschwindet sie von selbst.
 */

export const seriesDdl = [
  `CREATE TABLE IF NOT EXISTS v2_appointment_series (
    id uuid PRIMARY KEY,
    user_id text NOT NULL,
    rule jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS v2_appointment_series_items (
    appointment_id uuid PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
    series_id uuid NOT NULL REFERENCES v2_appointment_series(id) ON DELETE CASCADE,
    user_id text NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS v2_series_items_series ON v2_appointment_series_items(series_id)`,
]

let prepared: Promise<void> | null = null

export async function ensureSeriesTables() {
  prepared ??= (async () => {
    try {
      const sql = monitoringSql()
      const [state] = await sql`SELECT to_regclass('v2_appointment_series_items') IS NOT NULL AS ready`
      if (state?.ready) return
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(184730036)`,
        ...seriesDdl.map((statement) => sql.query(statement)),
      ])
    } catch (error) {
      prepared = null
      throw error
    }
  })()
  return prepared
}

export interface AppointmentFields {
  title: string
  description: string
  location: string
  priority: string
  startsAt: string
  endsAt: string
}

/** Zuordnung Termin → Serie für eine Liste von Terminen. */
export async function seriesOf(userId: string, appointmentIds: string[]) {
  if (appointmentIds.length === 0) return new Map<string, string>()
  try {
    await ensureSeriesTables()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT appointment_id,series_id FROM v2_appointment_series_items
       WHERE user_id=$1 AND appointment_id IN (${appointmentIds
         .map((_, index) => `$${index + 2}::uuid`)
         .join(',')})`,
      [userId, ...appointmentIds],
    )) as Array<{ appointment_id: string; series_id: string }>
    return new Map(rows.map((row) => [row.appointment_id, row.series_id]))
  } catch (error) {
    if (missingNeonStorage(error)) return new Map<string, string>()
    throw error
  }
}

/** Serie und Regel zu einem einzelnen Termin. */
export async function seriesForAppointment(userId: string, appointmentId: string) {
  try {
    await ensureSeriesTables()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT s.id,s.rule FROM v2_appointment_series_items i
       JOIN v2_appointment_series s ON s.id=i.series_id AND s.user_id=i.user_id
       WHERE i.appointment_id=$1::uuid AND i.user_id=$2`,
      [appointmentId, userId],
    )) as Array<{ id: string; rule: RecurrenceRule | string }>
    if (!rows[0]) return null
    const rule = typeof rows[0].rule === 'string' ? (JSON.parse(rows[0].rule) as RecurrenceRule) : rows[0].rule
    return { seriesId: rows[0].id, rule }
  } catch (error) {
    if (missingNeonStorage(error)) return null
    throw error
  }
}

function rows(fields: AppointmentFields, userId: string, starts: Date[]) {
  const span = new Date(fields.endsAt).getTime() - new Date(fields.startsAt).getTime()
  return starts.map((start) => ({
    id: crypto.randomUUID(),
    userId,
    startsAt: start,
    endsAt: new Date(start.getTime() + span),
  }))
}

/** Werte einer Terminzeile in der Reihenfolge der INSERT-Spalten. */
const values = (
  entry: { id: string; userId: string; startsAt: Date; endsAt: Date },
  fields: AppointmentFields,
) => [
  entry.id,
  entry.userId,
  fields.title,
  fields.description,
  fields.location,
  fields.priority,
  entry.startsAt.toISOString(),
  entry.endsAt.toISOString(),
]

const COLUMNS = 8

function insertStatements(
  seriesId: string,
  userId: string,
  fields: AppointmentFields,
  starts: Date[],
) {
  const entries = rows(fields, userId, starts)
  const appointmentParams: unknown[] = []
  const appointmentPlaceholders = entries
    .map((entry, index) => {
      appointmentParams.push(...values(entry, fields))
      const base = index * COLUMNS
      return `($${base + 1}::uuid,$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7}::timestamptz,$${base + 8}::timestamptz)`
    })
    .join(',')

  const itemParams: unknown[] = [seriesId, userId]
  const itemPlaceholders = entries
    .map((entry, index) => {
      itemParams.push(entry.id)
      return `($${index + 3}::uuid,$1::uuid,$2)`
    })
    .join(',')

  return {
    entries,
    appointments: {
      text: `INSERT INTO appointments(id,user_id,title,description,location,priority,starts_at,ends_at)
             VALUES ${appointmentPlaceholders}`,
      params: appointmentParams,
    },
    items: {
      text: `INSERT INTO v2_appointment_series_items(appointment_id,series_id,user_id) VALUES ${itemPlaceholders}`,
      params: itemParams,
    },
  }
}

export interface SeriesResult {
  seriesId: string
  created: number
  firstId: string
}

/** Legt eine Serie an: alle Termine und die Zuordnung in einer Transaktion. */
export async function createSeries(
  userId: string,
  fields: AppointmentFields,
  rule: RecurrenceRule,
): Promise<SeriesResult> {
  await ensureSeriesTables()
  const starts = occurrences(new Date(fields.startsAt), rule)
  if (starts.length === 0) throw new Error('Die Serie enthält keinen einzigen Termin.')

  const seriesId = crypto.randomUUID()
  const statements = insertStatements(seriesId, userId, fields, starts)
  const sql = monitoringSql()
  await sql.transaction([
    sql.query(`INSERT INTO v2_appointment_series(id,user_id,rule) VALUES($1::uuid,$2,$3::jsonb)`, [
      seriesId,
      userId,
      JSON.stringify(rule),
    ]),
    sql.query(statements.appointments.text, statements.appointments.params),
    sql.query(statements.items.text, statements.items.params),
  ])
  return { seriesId, created: starts.length, firstId: statements.entries[0].id }
}

/**
 * Ändert eine Serie ab einem Termin: Alles ab diesem Zeitpunkt wird ersetzt,
 * Vergangenes bleibt unangetastet. So bleibt die Vergangenheit das, was
 * tatsächlich stattgefunden hat.
 */
export async function updateSeriesFrom(
  userId: string,
  seriesId: string,
  fromStartsAt: string,
  fields: AppointmentFields,
  rule: RecurrenceRule,
): Promise<SeriesResult> {
  await ensureSeriesTables()
  const starts = occurrences(new Date(fields.startsAt), rule)
  if (starts.length === 0) throw new Error('Die Serie enthält keinen einzigen Termin.')
  if (starts.length > MAX_OCCURRENCES) starts.length = MAX_OCCURRENCES

  const statements = insertStatements(seriesId, userId, fields, starts)
  const sql = monitoringSql()
  await sql.transaction([
    sql.query(
      `DELETE FROM appointments a USING v2_appointment_series_items i
       WHERE i.appointment_id=a.id AND i.series_id=$1::uuid AND i.user_id=$2
         AND a.user_id=$2 AND a.starts_at >= $3::timestamptz`,
      [seriesId, userId, fromStartsAt],
    ),
    sql.query(`UPDATE v2_appointment_series SET rule=$3::jsonb,updated_at=now() WHERE id=$1::uuid AND user_id=$2`, [
      seriesId,
      userId,
      JSON.stringify(rule),
    ]),
    sql.query(statements.appointments.text, statements.appointments.params),
    sql.query(statements.items.text, statements.items.params),
  ])
  return { seriesId, created: starts.length, firstId: statements.entries[0].id }
}

/** Löscht diesen und alle folgenden Termine der Serie. */
export async function deleteSeriesFrom(userId: string, seriesId: string, fromStartsAt: string) {
  await ensureSeriesTables()
  const sql = monitoringSql()
  const removed = (await sql.query(
    `DELETE FROM appointments a USING v2_appointment_series_items i
     WHERE i.appointment_id=a.id AND i.series_id=$1::uuid AND i.user_id=$2
       AND a.user_id=$2 AND a.starts_at >= $3::timestamptz RETURNING a.id`,
    [seriesId, userId, fromStartsAt],
  )) as Array<{ id: string }>
  // Bleibt kein Termin übrig, ist auch die Serie gegenstandslos.
  await sql.query(
    `DELETE FROM v2_appointment_series s WHERE s.id=$1::uuid AND s.user_id=$2
       AND NOT EXISTS(SELECT 1 FROM v2_appointment_series_items i WHERE i.series_id=s.id)`,
    [seriesId, userId],
  )
  return removed.length
}
