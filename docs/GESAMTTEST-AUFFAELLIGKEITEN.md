# Gesamttest: Auffälligkeiten und Änderungsideen

Sammelliste für den vom Nutzer verlangten vollständigen App-Test. Jede Auffälligkeit wird mit
Bereich, konkretem Ablauf, erwartetem und tatsächlichem Verhalten, Auswirkung und Priorität
festgehalten. Erst gemeinsam priorisieren, dann gezielt verbessern.

Status der Einträge: **offen**, **in Arbeit**, **behoben** oder **kein Fehler**.

## Stand

Begonnen am 22.10.2026. Der Nutzer prüft die produktive V2-Umgebung
(https://omnidesk-v2-beta.vercel.app) eigenständig und bringt seine eigene Liste mit
Änderungsideen in das nächste gemeinsame Gespräch ein. Diese Datei führt beide Quellen zusammen.

Prüfumgebung beachten: Lokal (`localhost:5173`) fehlen die in Vercel als *Sensitive* markierten
Variablen (`NEON_API_KEY`, `NEON_MONITOR_LINKS`, `DEPLOYMENT_*`, `GITHUB_*`, `CRON_SECRET`).
Neon, Deployments und GitHub melden dort deshalb „nicht eingerichtet“. Das ist eine Grenze der
lokalen Umgebung und keine Auffälligkeit der Anwendung.

## 1 · Notizen: Kein sichtbarer Hinweis beim Speicherkonflikt

- **Bereich:** Notizen, Bearbeitung in mehreren Tabs
- **Ablauf:** Dieselbe Notiz in zwei Browser-Tabs geöffnet. In Tab 1 Text ergänzt und automatisch
  speichern lassen. Anschließend in Tab 2 ohne Neuladen weitergeschrieben.
- **Erwartet:** Über dem Editor erscheint der vorgesehene Hinweis mit der Servermeldung, dem Satz
  „Dein Entwurf bleibt im Editor. Er wird nicht automatisch überschrieben.“ und der Schaltfläche
  **Aktuellen Stand laden** (`src/modules/notes/index.tsx`).
- **Tatsächlich:** Es erscheint kein Hinweis und keine Schaltfläche. Der Nutzer erhält keine
  Erklärung, warum sein Entwurf nicht gespeichert wird.
- **Auswirkung:** Der Schutz gegen veraltetes Überschreiben greift, bleibt aber unsichtbar. Der
  Nutzer kann den Konflikt nicht bewusst auflösen und hält die Notiz womöglich für gespeichert.
- **Priorität:** Mittel. Kein Datenverlust beobachtet, aber irreführend.
- **Status:** offen. Ursache noch nicht untersucht; Beobachtung vom 22.10.2026 auf `localhost:5173`.
  Verhalten in der produktiven Umgebung noch nicht geprüft.

## Offene Punkte aus der laufenden Arbeit

- Neon-Monitoring ist weiterhin nicht eingerichtet; ohne Einrichtung bleiben Historie und
  Diagramme leer („Noch keine Messwerte verfügbar“). Erwartetes Verhalten, keine Auffälligkeit.
- Ein externer Scheduler für Neon existiert unverändert nicht. Die Kachel **Hintergrundprüfungen**
  wird deshalb dauerhaft „Noch nicht nachgewiesen“ oder „Überfällig“ melden.
- Die Neon-Karte wurde aus dem Uptime-Monitor entfernt. Die Änderung ist lokal committet, aber
  noch nicht auf `main` veröffentlicht und nicht bereitgestellt.
