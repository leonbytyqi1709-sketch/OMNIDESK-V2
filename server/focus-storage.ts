import { eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/client'
import { projects, projectTasks, tasks } from '../src/db/schema/index'
import {
  FOCUS_MAX_SECONDS,
  FOCUS_MIN_SECONDS,
  type FocusKind,
  type FocusSessionInput,
  type FocusSummary,
  type FocusTotal,
} from '../src/lib/focus'
import { missingNeonStorage, monitoringSql } from './neon-storage'

/**
 * Speicher für Fokuszeiten.
 *
 * Wie bei den Verknüpfungen zeigt das Ziel auf mehrere Tabellen, Fremdschlüssel
 * sind deshalb nicht möglich. Der Besitz wird beim Schreiben in derselben
 * Anweisung geprüft; gelöschte Ziele lassen die Zeit bestehen – gearbeitet
 * wurde sie schließlich – und erscheinen in der Auswertung als „Ohne Ziel“.
 */

export const focusDdl = [
  `CREATE TABLE IF NOT EXISTS v2_focus_sessions (
    id uuid PRIMARY KEY,
    user_id text NOT NULL,
    started_at timestamptz NOT NULL,
    seconds integer NOT NULL,
    target_kind text,
    target_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT v2_focus_seconds CHECK (seconds >= ${FOCUS_MIN_SECONDS} AND seconds <= ${FOCUS_MAX_SECONDS}),
    CONSTRAINT v2_focus_target CHECK ((target_kind IS NULL) = (target_id IS NULL)))`,
  `CREATE INDEX IF NOT EXISTS v2_focus_user_time ON v2_focus_sessions(user_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS v2_focus_target ON v2_focus_sessions(user_id, target_kind, target_id)`,
]

const TARGET_TABLE: Record<FocusKind, string> = {
  task: 'tasks',
  projectTask: 'project_tasks',
  project: 'projects',
}

let prepared: Promise<void> | null = null

async function ensureTable() {
  prepared ??= (async () => {
    try {
      const sql = monitoringSql()
      const [state] = await sql`SELECT to_regclass('v2_focus_sessions') IS NOT NULL AS ready`
      if (state?.ready) return
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(184730035)`,
        ...focusDdl.map((statement) => sql.query(statement)),
      ])
    } catch (error) {
      prepared = null
      throw error
    }
  })()
  return prepared
}

export type RecordResult = 'created' | 'known' | 'unknown-target'

/**
 * Hält einen abgeschlossenen Fokusblock fest. Die Kennung stammt vom Browser,
 * damit ein Wiederholungsversuch nach einem Verbindungsabbruch nichts doppelt
 * anlegt.
 */
export async function recordFocusSession(
  userId: string,
  input: FocusSessionInput,
): Promise<RecordResult> {
  await ensureTable()
  const sql = monitoringSql()
  const seconds = Math.round(input.seconds)

  if (!input.target) {
    const rows = (await sql.query(
      `INSERT INTO v2_focus_sessions(id,user_id,started_at,seconds)
       VALUES($1::uuid,$2,$3::timestamptz,$4) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [input.id, userId, input.startedAt, seconds],
    )) as Array<{ id: string }>
    return rows[0] ? 'created' : 'known'
  }

  const rows = (await sql.query(
    `INSERT INTO v2_focus_sessions(id,user_id,started_at,seconds,target_kind,target_id)
     SELECT $1::uuid,$2,$3::timestamptz,$4,$5,$6::uuid
     WHERE EXISTS(SELECT 1 FROM ${TARGET_TABLE[input.target.kind]} WHERE id=$6::uuid AND user_id=$2)
     ON CONFLICT(id) DO NOTHING RETURNING id`,
    [input.id, userId, input.startedAt, seconds, input.target.kind, input.target.id],
  )) as Array<{ id: string }>
  if (rows[0]) return 'created'

  // Kein Treffer heißt entweder „schon vorhanden“ oder „Ziel gehört dir nicht“.
  const known = (await sql.query(`SELECT id FROM v2_focus_sessions WHERE id=$1::uuid AND user_id=$2`, [
    input.id,
    userId,
  ])) as Array<{ id: string }>
  return known[0] ? 'known' : 'unknown-target'
}

export async function deleteFocusSession(userId: string, id: string) {
  try {
    const sql = monitoringSql()
    const rows = (await sql.query(
      `DELETE FROM v2_focus_sessions WHERE id=$1::uuid AND user_id=$2 RETURNING id`,
      [id, userId],
    )) as Array<{ id: string }>
    return rows.length > 0
  } catch (error) {
    if (missingNeonStorage(error)) return false
    throw error
  }
}

const EMPTY: FocusSummary = { seconds: 0, sessions: 0, days: [], totals: [] }

/** Titel der Ziele nachschlagen, je Art eine Abfrage. */
async function targetTitles(wanted: Map<FocusKind, Set<string>>) {
  const titles = new Map<string, string>()
  const key = (kind: FocusKind, id: string) => `${kind}:${id}`
  for (const [kind, ids] of wanted) {
    const list = [...ids]
    if (list.length === 0) continue
    if (kind === 'task')
      for (const row of await db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.id, list)))
        titles.set(key(kind, row.id), row.title)
    else if (kind === 'projectTask')
      for (const row of await db
        .select({ id: projectTasks.id, title: projectTasks.title, project: projects.name })
        .from(projectTasks)
        .innerJoin(projects, eq(projects.id, projectTasks.projectId))
        .where(inArray(projectTasks.id, list)))
        titles.set(key(kind, row.id), `${row.title} (${row.project})`)
    else
      for (const row of await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, list)))
        titles.set(key(kind, row.id), row.name)
  }
  return titles
}

interface SummaryRow {
  target_kind: FocusKind | null
  target_id: string | null
  seconds: string | number
  sessions: string | number
}

interface DayRow {
  day: string
  seconds: string | number
}

const toNumber = (value: string | number) => (typeof value === 'number' ? value : Number(value))

/**
 * Auswertung der letzten Tage: Gesamtzeit, Zeit je Tag und Zeit je Ziel.
 * Die Tage stammen aus der Datenbank und folgen deren Zeitzone (TZ=Europe/Berlin).
 */
export async function focusSummary(userId: string, days: number): Promise<FocusSummary> {
  try {
    await ensureTable()
    const sql = monitoringSql()
    const since = `${days} days`

    const [groupedRows, perDayRows] = await Promise.all([
      sql.query(
        `SELECT target_kind,target_id,SUM(seconds) AS seconds,COUNT(*) AS sessions
         FROM v2_focus_sessions
         WHERE user_id=$1 AND started_at >= now() - $2::interval
         GROUP BY target_kind,target_id ORDER BY SUM(seconds) DESC`,
        [userId, since],
      ),
      sql.query(
        `SELECT to_char(started_at::date,'YYYY-MM-DD') AS day,SUM(seconds) AS seconds
         FROM v2_focus_sessions
         WHERE user_id=$1 AND started_at >= now() - $2::interval
         GROUP BY 1 ORDER BY 1`,
        [userId, since],
      ),
    ])
    const grouped = groupedRows as SummaryRow[],
      perDay = perDayRows as DayRow[]

    const wanted = new Map<FocusKind, Set<string>>()
    for (const row of grouped)
      if (row.target_kind && row.target_id)
        (
          wanted.get(row.target_kind) ?? wanted.set(row.target_kind, new Set()).get(row.target_kind)!
        ).add(row.target_id)
    const titles = await targetTitles(wanted)

    const totals: FocusTotal[] = grouped.map((row) => ({
      kind: row.target_kind,
      id: row.target_id,
      title:
        row.target_kind && row.target_id
          ? (titles.get(`${row.target_kind}:${row.target_id}`) ?? 'Gelöschtes Ziel')
          : 'Ohne Ziel',
      seconds: toNumber(row.seconds),
      sessions: toNumber(row.sessions),
    }))

    return {
      seconds: totals.reduce((sum, entry) => sum + entry.seconds, 0),
      sessions: totals.reduce((sum, entry) => sum + entry.sessions, 0),
      days: perDay.map((row) => ({ date: row.day, seconds: toNumber(row.seconds) })),
      totals,
    }
  } catch (error) {
    if (missingNeonStorage(error)) return EMPTY
    throw error
  }
}

/** Gesamtzeit an einem einzelnen Ziel – für Aufgaben- und Projektansicht. */
export async function focusForTarget(userId: string, kind: FocusKind, id: string) {
  try {
    await ensureTable()
    const sql = monitoringSql()
    const rows = (await sql.query(
      `SELECT COALESCE(SUM(seconds),0) AS seconds,COUNT(*) AS sessions
       FROM v2_focus_sessions WHERE user_id=$1 AND target_kind=$2 AND target_id=$3::uuid`,
      [userId, kind, id],
    )) as Array<{ seconds: string | number; sessions: string | number }>
    return {
      seconds: toNumber(rows[0]?.seconds ?? 0),
      sessions: toNumber(rows[0]?.sessions ?? 0),
    }
  } catch (error) {
    if (missingNeonStorage(error)) return { seconds: 0, sessions: 0 }
    throw error
  }
}
