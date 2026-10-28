# Gesamttest: Auffälligkeiten und Änderungsideen

Sammelliste für den vom Nutzer verlangten vollständigen App-Test. Jede Auffälligkeit wird mit
Bereich, konkretem Ablauf, erwartetem und tatsächlichem Verhalten, Auswirkung und Priorität
festgehalten. Erst gemeinsam priorisieren, dann gezielt verbessern.

Status der Einträge: **offen**, **in Arbeit**, **behoben** oder **kein Fehler**.

## Stand

**Abgeschlossen am 28.10.2026.** Der Nutzer hat die produktive Umgebung zu Hause sorgfältig
geprüft und bestätigt, dass alles funktioniert. Der verbindliche Gesamttest ist damit erledigt
und wird nicht erneut angestoßen. Die unten aufgeführten Einzelpunkte bleiben als eigenständige
Aufgaben bestehen.

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
- **Status:** behoben am 28.10.2026. Der Hinweis war vorhanden, bestand aber aus unformatiertem
  Fließtext ohne Farbe und Symbol und wurde deshalb übersehen. Er wird jetzt als Warnung
  dargestellt und benennt ausdrücklich, dass bis zur Auflösung nichts mehr gespeichert wird.
  Die Versionsprüfung selbst arbeitete bereits korrekt. Der gemeldete Ablauf ließ sich ohne
  angemeldete Sitzung nicht nachstellen; bleibt der Hinweis weiterhin aus, ist die Ursache eine
  andere (docs/CODEPRUEFUNG-28-10-2026.md, Punkt 5).

## Offene Punkte aus der laufenden Arbeit

- Neon-Monitoring ist weiterhin nicht eingerichtet; ohne Einrichtung bleiben Historie und
  Diagramme leer („Noch keine Messwerte verfügbar“). Erwartetes Verhalten, keine Auffälligkeit.
- Ein externer Scheduler für Neon existiert unverändert nicht. Die Kachel **Hintergrundprüfungen**
  wird deshalb dauerhaft „Noch nicht nachgewiesen“ oder „Überfällig“ melden.
- Die Neon-Karte wurde aus dem Uptime-Monitor entfernt. Die Änderung ist lokal committet, aber
  noch nicht auf `main` veröffentlicht und nicht bereitgestellt.
