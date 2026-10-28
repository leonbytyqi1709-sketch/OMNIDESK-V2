import { monitoringSql } from './neon-storage'

// Removal of the module must also stop triggers already installed in Neon.
// Keep old tables/data and unrelated triggers intact; do not reinstall storage.
export const retiredHistoryTriggers = [
  ['notes', 'v2_history_notes'],
  ['tasks', 'v2_history_tasks'],
  ['project_tasks', 'v2_history_project_tasks'],
] as const
export const retireHistoryDdl = retiredHistoryTriggers.map(
  ([table, trigger]) =>
    `DO $retire$ BEGIN IF to_regclass('public.${table}') IS NOT NULL THEN DROP TRIGGER IF EXISTS ${trigger} ON public.${table}; END IF; END $retire$`,
)
// Sind keine Trigger mehr vorhanden, bleibt das für diesen Prozess so. Ohne
// diesen Merker lief vor jeder Notiz-, Aufgaben- und Projektanfrage eine
// zusätzliche Datenbankabfrage mit, die nichts mehr zu tun hatte.
let retired = false

export async function retireWorkingHistory() {
  if (retired) return
  const sql = monitoringSql()
  const rows =
    await sql`SELECT 1 FROM pg_trigger t WHERE NOT t.tgisinternal AND (
    (t.tgname='v2_history_notes' AND t.tgrelid=to_regclass('public.notes')) OR
    (t.tgname='v2_history_tasks' AND t.tgrelid=to_regclass('public.tasks')) OR
    (t.tgname='v2_history_project_tasks' AND t.tgrelid=to_regclass('public.project_tasks'))) LIMIT 1`
  if (!rows.length) {
    retired = true
    return
  }
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730024)`,
    ...retireHistoryDdl.map((statement) => sql.query(statement)),
  ])
  retired = true
}
