# OMNIDESK – Projektdokumentation

**Stand: 30. Oktober 2026 · Live: https://omnidesk-work.vercel.app**

Dieses Dokument beschreibt OMNIDESK so, wie die Anwendung heute ist. Es ist das
aktuelle Hauptdokument; alles andere im Projekt ist entweder ein Tagebuch
(`docs/V2-PLANUNG.md`), eine Vertiefung zu einem einzelnen Modul (`docs/*.md`)
oder historisch.

**Teil A** ist für die Benutzung gedacht, **Teil B** für die Weiterentwicklung.

---

## Was OMNIDESK ist

Eine Arbeitsumgebung für eine Person: Notizen, Aufgaben, Projekte, Kalender,
Kontakte — und daneben Werkzeuge für IT-Arbeit wie Uptime-Überwachung,
Befehlsbibliothek, Deployment- und GitHub-Einblick, Passwortspeicher und
Kontenkarte. Dazu Omni, ein KI-Assistent, der nicht nur antwortet, sondern auf
Wunsch auch in den Modulen arbeitet.

Der Unterschied zu einer Sammlung einzelner Werkzeuge liegt in den
Querverbindungen: Jeder Eintrag lässt sich mit jedem anderen verknüpfen, eine
Suche findet alles, Dateien hängen an jedem Objekt, und die Arbeitszeit lässt
sich Aufgaben und Projekten zuordnen.

Die Anwendung ist für genau einen Benutzer gebaut. Mehrbenutzerfähig ist sie
nur dort, wo es ausdrücklich gewollt ist: in den gemeinsamen Räumen und auf der
öffentlichen Buchungsseite.

---

# Teil A – Die Anwendung

## Die Module

21 Module, in der Seitenleiste nach Bereichen gruppiert. Alle außer Dashboard
und Einstellungen lassen sich in den Einstellungen abschalten.

### Produktivität

| Modul | Zweck |
|---|---|
| **Dashboard** | Startseite mit frei wählbaren Kacheln (Widgets), darunter Aufgaben, Termine, Cloud-Speicher, gemeinsame Räume und Mission Control |
| **Notizen** | Markdown-Notizen mit Vorschau, Anhängen und Verknüpfungen |
| **Aufgaben** | Persönliche Aufgaben als Liste oder Board, mit Priorität, Status, Frist, Schlagwörtern und Teilaufgaben |
| **Kalender & Booking** | Monatsansicht, Terminliste der nächsten Termine, Serientermine und eine öffentliche Buchungsseite für Fremde |
| **Pomodoro-Timer** | 25 Minuten Fokus, 5 Minuten Pause — mit Zuordnung zu einer Aufgabe oder einem Projekt und Wochenrückblick |
| **Kontakte** | Adressbuch mit Firma, E-Mail, Telefon und Notizfeld |
| **Gemeinsame Räume** | Zeitlich begrenzte Räume, in die andere per Einladungslink kommen; mit Rollen, Liste und Pinnwand |
| **Omni** | Chat mit Gedächtnis, Briefing und ausführbaren Aktionen |

### IT-Werkzeuge

| Modul | Zweck |
|---|---|
| **Projektmanagement** | Projekte mit Kanban-Board, Meilensteinen, Verknüpfungen, Anhängen und den Karten für Neon, Deployments und GitHub |
| **Mission Control** | Lagebild über mehrere Projekte hinweg |
| **Browser-Kommandoebene** | Chrome-Erweiterung mit Seitenpanel: Notiz, Aufgabe oder Projektaufgabe direkt aus dem Browser anlegen, mit automatisch übernommener Seitenquelle |
| **Befehlsbibliothek** | Eigene CLI-Befehle plus ein mitgeliefertes Cheat-Sheet, abrufbar über die Befehlspalette |
| **Link-Manager** | Gespeicherte Weboberflächen mit Kategorie und Symbol |
| **Uptime-Monitor** | Eigene Dienste überwachen (HTTP oder Port), mit Verlauf, Antwortzeiten und Zertifikatslaufzeit |
| **Deployments** | Lesender Blick auf die eigenen Vercel-Projekte |
| **GitHub** | Lesender Blick auf verknüpfte Repositories |

### Sicherheit

| Modul | Zweck |
|---|---|
| **Passwort-Manager** | Verschlüsselter Speicher mit eigenem Hauptpasswort |
| **Kontenkarte** | Selbst dokumentierte Verbindungen zwischen Konten (Anmeldung, Wiederherstellung) |
| **Kontosicherheit** | Selbst dokumentierte Absicherungsmerkmale je Konto |

### Cloud

| Modul | Zweck |
|---|---|
| **Cloud-Monitoring** | Speicherauslastung von Google Drive und MEGA. OneDrive ist eingebaut, wird aber seit dem 29.10.2026 nicht mehr angeboten |

## Was durch alle Module hindurchgeht

Diese fünf Dinge sind der eigentliche Unterschied zu einer Werkzeugsammlung.

**Verknüpfungen.** Notizen, Aufgaben, Termine, Kontakte und Projekte lassen
sich beliebig miteinander verbinden. Eine Verknüpfung gilt in beide Richtungen
und steht im Bereich „Verknüpft" an beiden Enden. Ein Klick springt zum
verknüpften Eintrag. Löschst du einen Eintrag, verschwindet die Verknüpfung
von selbst.

**Suche über alles.** `Strg+K` öffnet die Befehlspalette. Sie durchsucht
Notizen, Aufgaben, Termine, Kontakte, Projekte, Projektaufgaben, Links und
Befehle — Titel wie Inhalt — und zeigt den Textausschnitt rund um den Treffer,
den Suchbegriff hervorgehoben. Ein Treffer öffnet den Eintrag direkt. Daneben
enthält die Palette Navigation, Schnellaktionen, den Pomodoro-Timer und das
Befehls-Cheat-Sheet.

**Anhänge.** An Notizen, Aufgaben, Terminen, Kontakten und Projekten hängen
Dateien — per Knopf oder Hineinziehen. Bilder, PDFs und Klartext öffnen sich in
einem Fenster, alles andere wird heruntergeladen. Grenzen: 3 MB je Datei, 20
Anhänge je Eintrag, 50 MB insgesamt. Der belegte Platz steht in den
Einstellungen unter „Allgemein". Mit einem Eintrag verschwinden auch seine
Anhänge.

**Fokuszeiten.** Der Pomodoro-Timer schreibt seine Zeit auf eine Aufgabe, eine
Projektaufgabe oder ein Projekt. Der Rückblick zeigt die letzten sieben Tage
mit Gesamtzeit, Tagesverlauf und Zeit je Ziel; an Aufgabe und Projekt steht die
bisher erfasste Zeit. Blöcke unter einer Minute werden verworfen.

**Omni.** Der Assistent hat drei Teile:

- *Chat* – antwortet standardmäßig kurz und natürlich; Gedächtnis und
  Projektbezug lassen sich zuschalten.
- *Briefing* – begrüßt dich auf dem Dashboard mit deinem Arbeitsstand.
- *Aktionen* – Omni schlägt konkrete Änderungen vor und führt sie **erst nach
  deiner Bestätigung** aus.

Klingt eine Chat-Nachricht nach einem Auftrag („leg eine Aufgabe an …",
„verschieb den Termin …"), plant Omni sie sofort und zeigt den Vorschlag als
Karte im Gespräch. Derselbe Weg steht über den Knopf „Aktionen" zur Verfügung,
dort mit dem Verlauf der letzten Vorschläge.

Omni darf anlegen und ändern: persönliche Aufgaben, Projektaufgaben, Termine,
Notizen, Kontakte, Projektbeschreibungen und Verknüpfungen. **Löschen darf er
nicht.** Jeder Vorschlag zeigt Vorher und Nachher, umfasst höchstens fünf
Schritte und wird ganz oder gar nicht ausgeführt. Hat sich ein betroffener
Eintrag inzwischen geändert, scheitert der ganze Vorschlag.

## Was Omni an den KI-Anbieter sendet

Titel, Status, Priorität und Fristen der letzten 200 Aufgaben, 100 Projekte,
200 Projektaufgaben, 100 Notizen, 100 anstehenden Termine und 100 Kontakte —
von Notizen nur der Titel, von Kontakten nur Name und Firma. **Nicht**
übertragen werden Inhalte und Beschreibungen bestehender Einträge, Anhänge,
Vault-Inhalte und Zugangsdaten. Der Hinweis steht auch im Aktionen-Dialog.

---

# Teil B – Technik

## Aufbau

| Schicht | Wahl |
|---|---|
| Oberfläche | React 19, TypeScript (strikt), Vite, Tailwind 4, Radix/shadcn |
| Zustand & Daten | TanStack Query, Zustand, React Router |
| Server | Hono, als eine Anwendung in `server/app.ts` |
| Datenbank | Neon (PostgreSQL, serverless) über Drizzle ORM |
| Anmeldung | Clerk, serverseitig per JWKS geprüft |
| Betrieb | Vercel (Hobby), PWA mit Service Worker |

Dieselbe Hono-Anwendung läuft lokal über `server/index.ts` (Port 8787) und
produktiv über `server/vercel-entry.ts`. Es gibt nur eine Verdrahtung, keine
zwei Wahrheiten.

### Lokal starten

Zwei Prozesse: `npm run dev:api` (Port 8787) und `npm run dev` (Port 5173, der
`/api` auf 8787 weiterreicht). Beide sind in `.claude/launch.json` hinterlegt.
`.env.local` muss mindestens `DATABASE_URL` und `VITE_CLERK_PUBLISHABLE_KEY`
enthalten.

## Sicherheitsprinzipien

Diese Regeln gelten überall und sollten bei jeder Erweiterung eingehalten
werden:

1. **Besitz wird in SQL geprüft, nicht in JavaScript.** Jede Abfrage enthält
   `user_id = $benutzer`. Bei Änderungen wird der Besitz **in derselben
   Anweisung** erneut geprüft, damit eine gleichzeitige Übertragung kein
   Zeitfenster öffnet.
2. **Optimistische Nebenläufigkeit.** Einträge tragen eine Version oder einen
   Fingerabdruck (`md5(to_jsonb(zeile)::text)`). Wer auf einem veralteten Stand
   schreibt, bekommt einen Konflikt statt eines stillen Überschreibens.
3. **Fehlermeldungen verraten nichts.** Antworten fremder Dienste, Hostnamen
   und Schlüssel erscheinen nie in Fehlertexten oder Adressen.
4. **Externe Abrufe sind begrenzt**: Zeitlimit, Größengrenze, keine
   Weiterleitungen.
5. **Hochgeladene Dateien laufen nicht im Ursprung der App.** HTML, SVG und XML
   werden als `application/octet-stream` gespeichert und ausgeliefert, immer mit
   `Content-Disposition: attachment` und `X-Content-Type-Options: nosniff`.
6. **Der Vault ist eine eigene Welt** mit eigenem Hauptpasswort; sein Inhalt
   geht nie an die KI und steht in keiner Suche.

## Datenhaltung

Zwei Generationen von Tabellen, bewusst getrennt:

**Kerntabellen** (`notes`, `tasks`, `projects`, `project_tasks`, `milestones`,
`appointments`, `booking_settings`, `contacts`, `links`, `commands`,
`chat_sessions`, `chat_messages`, `uptime_monitors`, `uptime_checks`,
`connected_accounts`, `vaults`, `vault_entries`) sind in `src/db/schema/`
beschrieben und werden über Drizzle angesprochen.

**V2-Tabellen** (`v2_*`, rund 30 Stück) gehören zu den später entstandenen
Funktionen. Sie werden **additiv zur Laufzeit angelegt**: Beim ersten Zugriff
prüft das jeweilige Speichermodul, ob die Tabelle existiert, und legt sie
gegebenenfalls unter einer Advisory-Lock-Nummer an. Es gibt bewusst keine
Migrationsläufe gegen die produktive Datenbank.

> **Beim Hinzufügen einer V2-Tabelle:** eine noch nicht vergebene
> Advisory-Lock-Nummer verwenden (bisher 184730019 bis 184730037) und die
> Tabelle in einer eigenen `*-storage.ts` kapseln.

**Polymorphe Bezüge ohne Fremdschlüssel.** Verknüpfungen, Fokuszeiten und
Anhänge zeigen auf mehrere Tabellen gleichzeitig; Fremdschlüssel sind dort
nicht möglich. Stattdessen: Besitzprüfung beim Schreiben in derselben
Anweisung, und beim Lesen fallen verwaiste Zeilen heraus und werden entfernt.
Fokuszeiten bleiben absichtlich erhalten, wenn ihr Ziel gelöscht wird —
gearbeitet wurde die Zeit schließlich.

## Externe Dienste

Alle optional außer Datenbank und Anmeldung. Fehlt eine Variable, meldet das
betroffene Modul „nicht eingerichtet", statt die Anwendung zu stören.

| Dienst | Variablen | Wofür |
|---|---|---|
| Neon | `DATABASE_URL` | Datenbank (zwingend) |
| Clerk | `VITE_CLERK_PUBLISHABLE_KEY` | Anmeldung (zwingend) |
| KI-Anbieter | `OPENAI_API_KEY`, `AI_API_KEYS`, `AI_BASE_URL`, `AI_MODEL` | Chat, Briefing, Omni-Aktionen |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Drive im Cloud-Monitoring |
| Microsoft | `MICROSOFT_*` | OneDrive (nicht gesetzt, Anbindung ruht) |
| Neon-API | `NEON_API_KEY`, `NEON_MONITOR_LINKS` | Datenbank-Überwachung je Projekt |
| Vercel | `DEPLOYMENT_API_TOKEN`, `DEPLOYMENT_PROJECT_LINKS`, `DEPLOYMENT_ACCOUNT_USER_ID` | Deployments-Modul |
| GitHub | `GITHUB_API_TOKEN`, `GITHUB_ACCOUNT_USER_ID` | GitHub-Modul |
| Cron | `CRON_SECRET` | Schutz der geplanten Läufe |
| Sonstiges | `TZ`, `APP_URL`, `API_PORT` | Zeitzone, Rückleitungen, lokaler Port |

`GOOGLE_REDIRECT_URI` muss exakt auf
`https://omnidesk-work.vercel.app/api/integrations/google/callback` zeigen und
genauso in der Google Cloud Console eingetragen sein; der localhost-Eintrag
bleibt dort für die lokale Entwicklung bestehen.

## Bauen und Bereitstellen

```
npm run build
```

führt vier Schritte aus: Typprüfung (`tsc -b`), Bau der Browser-Erweiterung,
Vite-Build und **Bündeln des Backends** nach `api/[[...route]].js`.

> **Wichtig:** Dieses Bündel ist eingecheckt. Wer Servercode ändert, muss
> `npm run build` ausführen und das neue Bündel mitcommitten — sonst läuft
> produktiv weiter der alte Server.

Vercel baut bei jedem Push auf `main` selbst und vergibt dabei eigene
Dateinamen. Ein Vergleich der Dateinamen mit dem lokalen Build sagt deshalb
nichts darüber aus, ob eine Änderung live ist — gesucht werden muss nach
Inhalt.

**Geplante Läufe** (`vercel.json`, Hobby erlaubt einen Lauf pro Tag je
Eintrag): Uptime-Aktualisierung um 06:00, Neon-Aktualisierung um 06:05, beide
geschützt über `CRON_SECRET`.

**Aktualisierung beim Benutzer.** Die App ist eine PWA. Sie prüft beim Start,
alle 30 Minuten und bei jedem Zurückwechseln in den Tab auf eine neue Fassung
und meldet sie mit einem Hinweis samt „Neu laden". Sie lädt nie von selbst neu.

## Tests

```
npx --no-install tsx --test tests/*.test.ts
```

258 Tests in 31 Dateien. Sie laufen gegen eine **echte PostgreSQL-Instanz**
(PGlite im Arbeitsspeicher): `tests/support/postgres.ts` hängt sich in den
Neon-Treiber ein, sodass der Produktionscode unverändert seine echten
Anweisungen ausführt. Geprüft werden vor allem die Dinge, die sich nicht
ansehen lassen — Besitzgrenzen, Nebenläufigkeit, Idempotenz, Zeitrechnung.

`npm run lint` (oxlint) ist bei sieben bekannten Fast-Refresh-Warnungen stabil;
jede weitere Warnung ist neu.

## Grenzen des Betriebs

- **Vercel Hobby:** rund 4,5 MB je Anfrage (daher 3 MB je Anhang), ein
  Cron-Lauf pro Tag und Eintrag.
- **Neon:** begrenzter Speicher — deshalb die 50-MB-Grenze für Anhänge.
- **Serienterminen:** höchstens 200 Termine, zwei Jahre im Voraus.
- **Omni:** höchstens fünf Schritte je Vorschlag, ein Vorschlag alle 20
  Sekunden, Vorschläge verfallen nach 15 Minuten.
- **Suche:** `ILIKE` statt Volltextindizes. Bei spürbarer Trägheit ist das die
  Stelle zum Nachrüsten.

---

## Offene Punkte

Stand 30.10.2026, keiner davon dringend:

**Entscheidungen aus der Codeprüfung** (`docs/CODEPRUEFUNG-28-10-2026.md`):
Google-Tokens liegen im Klartext in der Datenbank, während Microsoft sie
verschlüsselt; die öffentliche Buchungsseite hat keine Begrenzung je Zeitraum;
der Uptime-Monitor liest Zertifikatslaufzeiten ohne Gültigkeitsprüfung;
einige Routen antworten bei fehlerhafter Kennung mit 500 statt 404.

**Länger liegengeblieben:** Der Text einer Projektaufgabe lässt sich in
OMNIDESK nicht bearbeiten (das Board hat keinen Editor); das Neon-Monitoring
ist nicht eingerichtet; die Anmeldemaske schreibt „OmniDesk", was sich nur im
Clerk-Konto ändern lässt.

**Unbestätigt:** Die Vorschau für Anhänge ist ausgeliefert, aber in der
angemeldeten Sitzung noch nicht gesehen worden. Der Nutzer hat das am
30.10.2026 ausdrücklich zurückgestellt.

**Live bestätigt am 30.10.2026:** Omni-Aktionen aus dem Chat. Der Nutzer
führt einen Auftrag im Chat aus, sieht die Vorschlagskarte und bestätigt sie
("Ja, geht").

## Entschiedenes, das nicht zurückkommt

Damit es niemand erneut vorschlägt: **Arbeitsgedächtnis und Missionsarchiv**
(entfernt am 21.10.2026), **Internet-Radar**, **OneDrive in der Planung**
(21.10.2026, Code bleibt bestehen) und **das Mail-Modul**. Das persönliche
Omni-Gedächtnis und das Omni-Briefing sind davon ausdrücklich nicht betroffen.

## Weiterführende Dokumente

- `docs/V2-PLANUNG.md` — chronologischer Verlauf aller Entscheidungen
- `docs/CODEPRUEFUNG-28-10-2026.md` — Ergebnis der vollständigen Codeprüfung
- `docs/*.md` — je ein Dokument zu Browser-Kommandoebene, gemeinsamen Räumen,
  Mission Control, Omni (Chat, Briefing, Gedächtnis, Aktionen), Kontenkarte,
  Kontosicherheit, Neon-, Vercel- und GitHub-Anbindung
- `TESTPLAN-GESAMT.md` — abschließender Durchgang durch die ganze App
- `TESTANLEITUNG-AUSBAUSTUFEN.txt` — Durchgang durch die sechs Ausbaustufen
- `GOOGLE-ANMELDUNG-UMSTELLEN.txt` — erledigt, als Nachschlagewerk
- `AGENTS.md` — verbindliche Arbeitsregeln für KI-Assistenten in diesem Projekt
