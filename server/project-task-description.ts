import { monitoringSql, missingNeonStorage } from './neon-storage'

/**
 * Ergänzt die Spalte `description` in `project_tasks`.
 *
 * Die Tabelle ist älter als dieses Feld und existiert produktiv bereits. Der
 * Zusatz erfolgt deshalb additiv zur Laufzeit – wie bei den V2-Tabellen – und
 * genau einmal je Prozess. Bestehende Zeilen behalten ihren Inhalt und
 * bekommen einen leeren Text.
 */
let ensured: Promise<void> | null = null

export function ensureProjectTaskDescription() {
  ensured ??= (async () => {
    try {
      const sql = monitoringSql()
      const [state] =
        await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='project_tasks' AND column_name='description') AS ready`
      if (state?.ready) return
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(184730023)`,
        sql.query(
          `ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''`,
        ),
      ])
    } catch (e) {
      // Fehlt die Tabelle (etwa in isolierten Tests ohne Projektmodul), ist
      // nichts zu ergänzen. Andere Fehler dürfen den Aufrufer nicht blockieren;
      // die Spalte wird beim nächsten Versuch erneut geprüft.
      ensured = null
      if (!missingNeonStorage(e)) throw e
    }
  })()
  return ensured
}
