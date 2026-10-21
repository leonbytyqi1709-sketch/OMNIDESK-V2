# Arbeitsgedächtnis – entfernt

Am 21.10.2026 hat der Nutzer nach der Vorstellung ausdrücklich entschieden, das Arbeitsgedächtnis nicht zu nutzen und entfernen zu lassen. Er hält Arbeitsstände selbst fest und nutzt das Omni-Briefing. Die frühere Zusage wird damit zurückgenommen; es gibt keinen weiteren Ausbau- oder Ersatzauftrag.

Entfernt sind das Modul einschließlich Änderungsverlauf, Arbeitsständen und Missionsarchiv, die APIs `/api/working-history` und `/api/mission-records`, Verweise aus Notizen, Aufgaben, Projektboard und Mission Control sowie Schemaexporte und die ausschließlich zugehörigen Tests. Die alte Moduladresse fällt gemäß Router-Konvention auf das Dashboard zurück. Der eigenständige Schutz vor veralteten Bearbeitungen und die serialisierten Notiz-Autosaves bleiben erhalten. Persönliches Omni-Gedächtnis und Omni-Briefing sind separate, weiterhin vorhandene Funktionen.

## Bereits installierte Aufzeichnung beenden

Das Entfernen von Frontend und API allein würde vorhandene PostgreSQL-Trigger weiterlaufen lassen. `server/retire-working-history.ts` prüft deshalb bei Zugriffen auf Notizen, Aufgaben, Projekte sowie vor bestätigten Omni-Aktionen die drei eindeutig zugeordneten Trigger und entfernt sie bei Bedarf in einer Transaktion unter Sperre. Andere Trigger bleiben bestehen. Die Prüfung funktioniert auch, wenn das Modul in einer Datenbank nie eingerichtet war; neue Verlaufstabellen werden nicht angelegt.

Nach Bereitstellung beendet somit der nächste reguläre Zugriff die automatische Aufzeichnung in der verwendeten V2-Datenbank. Ohne eine authentifizierte produktive Sitzung wird diese Ausführung hier nicht als bereits erfolgt behauptet. Alternativ kann berechtigte Administration `docs/sql/ARBEITSGEDAECHTNIS-ENTFERNEN.sql` ausführen. Scheitert die Deaktivierung an Datenbankrechten, wird der Schreibschritt abgebrochen, statt still weiter aufzuzeichnen.

Originalnotizen, Aufgaben, bestehende Verlaufstabellen, Archivdaten und inzwischen ungenutzte SQL-Funktionen werden nicht automatisch gelöscht. Eine Datenbereinigung ist ein separater ausdrücklicher Auftrag. Es gibt kein neues Installations-SQL für das zurückgenommene Modul und keine Änderung an Cron-Konfigurationen.

Der gemeinsame Rundgang wird mit den übrigen neuen Funktionen fortgesetzt. Anschließend bleibt der vollständige App-Test verbindlich; erfolgreiche lokale Tests ersetzen ihn nicht.

Lokale Prüfung der Entfernung: 162 automatisierte Tests und Produktionsbuild erfolgreich; Lint nur mit den sieben bestehenden Warnungen. PostgreSQL-Tests prüfen gezielte Triggerdeaktivierung und Datenerhalt sowie Notiz-/Aufgabenbearbeitung ohne neue Verlaufstabellen. Browserprüfungen mit simuliertem Konto bestätigen die tatsächliche Routerweiterleitung alter Adressen, weiterhin verfügbare Räume/Notizen und den Schutz lokaler Notizentwürfe bei Versionskonflikten. Das Ausführen der Deaktivierung in der produktiven Datenbank bleibt bis zum nächsten authentifizierten Zugriff getrennt von diesen lokalen Nachweisen.
