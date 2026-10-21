# OmniDesk

Modulare All-in-One-Produktivitäts-Webapp für IT-Profis (FiSi/Power-User):
Dashboard, Notizen, Aufgaben, Kalender mit öffentlichem Booking, Pomodoro,
Kontakte, Projektmanagement (Kanban), Befehlsbibliothek, client-seitig
verschlüsselter Passwort-Manager u.v.m. – als installierbare PWA.

Vollständige fachliche Spezifikation: `omnidesk_spezifikation_v2.pdf`.
Aktuelle V2-Planung: `docs/V2-PLANUNG.md`.
Historischer V1-Entwicklungsstand: `DOKUMENTATION.txt`.

## V2 – erster Entwicklungsschritt

- Uptime-Modul mit responsiven Außenabständen (mobil 16 px, ab mittlerer Breite 24 px, auf großen Bildschirmen 32 px).
- Mail-Modul samt API und Gmail-Berechtigungen entfernt. Google Drive und MEGA bleiben erhalten; E-Mail-Felder bei Kontakten und Buchungen bleiben nutzbar.
- Bereits bei Google erteilte Gmail-Berechtigungen werden durch die Codeänderung nicht automatisch widerrufen. Eine erneute Autorisierung ist für die bisherigen Drive-Funktionen nicht erforderlich.
- Für V2 eine separate Entwicklungsdatenbank verwenden. Dieser Schritt benötigt keine Datenbankmigration.

## OneDrive in V2

OneDrive lässt sich zusätzlich zu Google Drive und MEGA verbinden (private Microsoft-Konten sowie Geschäfts-/Schulkonten, abhängig von Organisationsrichtlinien). Kontoanmeldung, Quotenanzeige, Synchronisation und Trennen sind vorbereitet. Vor dem ersten echten Kontotest müssen Microsoft-App-Registrierung und Vercel-Variablen eingerichtet werden: [OneDrive-Einrichtung](docs/ONEDRIVE-SETUP.md).

## Neon-Monitoring in V2

Der erste lesende Ausbau zeigt zugeordnete Neon-Branches, Compute-Status und verfügbare Projektverbrauchswerte im Uptime-Modul und in der Projektansicht. Vor dem echten Abruf sind API-Schlüssel und benutzerbezogene Projektzuordnungen einzurichten: [Neon-Einrichtung](docs/NEON-MONITORING.md). Ohne Konfiguration bleiben vorhandene Module nutzbar. Messhistorie, Alarme und SQL-Funktionstests folgen gesondert.

## Deployment-Zentrale in V2

Das Modul **Deployments** zeigt die explizite Produktionszuordnung, bis zu 20 jüngste Vercel-Deployments und verfügbare Build-Logs. Dieselbe Karte erscheint in den Projektansichten neben Neon. Vor dem echten Abruf sind ein serverseitiger Token und benutzerbezogene Projektzuordnungen nötig: [Vercel-Einrichtung](docs/VERCEL-MONITORING.md). Der Zugriff ist ausschließlich lesend; keine Deployments oder Rollbacks werden ausgelöst.

## Stack

- **Frontend:** Vite 8 + React 19 + TypeScript (strict), React Router v7,
  Tailwind CSS v4 (CSS-Config in `src/styles/globals.css`), Shadcn/ui,
  TanStack Query, zustand, vite-plugin-pwa
- **Auth:** Clerk (JWT-Prüfung serverseitig via JWKS, kein Secret Key nötig)
- **Backend:** Hono (lokal: Node-Server unter `server/`, Port 8787;
  Produktion: Vercel-Function unter `api/`), Zod-Validierung
- **Datenbank:** Neon Serverless Postgres + Drizzle ORM
  (ein Schema pro Modul in `src/db/schema/`, Mandantentrennung über `user_id`)

## Lokale Entwicklung

```bash
npm install
```

`.env.local` im Projektroot anlegen:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
DATABASE_URL=postgresql://…   # Neon-Dashboard -> Connection String
```

Schema nach Neon syncen und beide Server starten (zwei Terminals):

```bash
npm run db:push
npm run dev        # Frontend, Port 5173 (Proxy /api -> 8787)
npm run dev:api    # Hono-API, Port 8787
```

## Architektur-Kurzüberblick

- **Modul-Registry** `src/config/modules.ts`: Sidebar, Router und
  Modul-Manager speisen sich nur aus dieser Liste; jedes Modul ist ein
  Lazy-Chunk unter `src/modules/<id>/` mit `index.tsx` als einzigem Export.
- **API-Routen** unter `server/routes/`, registriert in `server/app.ts`
  (gemeinsame Factory für lokalen Node-Server und Vercel).
  Öffentliche Routen (z.B. `/api/public/booking/:slug`) stehen VOR der
  `requireAuth`-Middleware.
- **Öffentliche Buchungsseite** `/book/:slug` rendert ohne Login
  (Route vor dem SignedIn-Gate in `src/app/App.tsx`).
- **Passwort-Manager:** PBKDF2 (310.000 Iterationen, SHA-256) →
  AES-256-GCM im Browser (`src/lib/crypto.ts`); der Server speichert nur
  Base64-Ciphertext, das Master-Passwort verlässt den Client nie.

## Deployment (Vercel)

Das Repo ist Vercel-ready: `server/vercel-entry.ts` wird beim Build zu `api/index.js` gebündelt und bedient alle `/api/*`-Routen
über den `hono/vercel`-Adapter, `vercel.json` enthält die SPA-Rewrites.

1. Repo bei Vercel importieren (Framework-Preset **Vite** wird erkannt,
   Build `npm run build`, Output `dist/`).
2. Environment-Variablen im Vercel-Projekt setzen:
   | Variable | Wert |
   | --- | --- |
   | `DATABASE_URL` | Neon-Connection-String |
   | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key (für Produktion `pk_live_…`) |
   | `TZ` | optional `Europe/Berlin` (nicht mehr zwingend, s.u.) |
3. **Zeitzone:** Die Booking-Slot-Berechnung rechnet seit `server/timezone.ts`
   explizit in `Europe/Berlin` (DST-sicher über die Intl-API) und ist damit
   unabhängig von der Server-Zeitzone – auch auf Vercel (UTC) korrekt.
4. Clerk: In der Clerk-Konsole die Vercel-Domain als erlaubte Domain
   eintragen (für Produktion eine Production-Instance mit `pk_live_…`).
5. Nach dem ersten Deploy prüfen: Login, ein Modul mit Datenbankzugriff
   (z.B. Notizen) und `/book/<slug>` ohne Login.

## Nützliche Skripte

| Skript | Zweck |
| --- | --- |
| `npm run build` | Typecheck + Produktions-Build (inkl. PWA/Service-Worker) |
| `npm run lint` | Oxlint |
| `npm run db:push` | Drizzle-Schema nach Neon syncen |
| `npm run db:studio` | Drizzle Studio (DB-GUI) |

GitHub-Zentrale: [Einrichtung und Berechtigungen](docs/GITHUB-ZENTRALE.md).
Kontosicherheit: [Einrichtung, Selbstauskunft und Prüfablauf](docs/KONTOSICHERHEIT.md).
Kontenkarte: [Einrichtung, Pfeilrichtung und Abhängigkeiten](docs/KONTENKARTE.md).

## Omni-Startbriefing in V2

Persönlicher Arbeitsstand beim App-Start mit Aufgaben, Projekten, Terminen, gespeicherten Monitorwarnungen und optionaler Kontosicherheit. Quellenlinks, Zeitzone, Besuchsvergleich und begrenzte KI-Empfehlungen: [Einrichtung und Funktionsumfang](docs/OMNI-BRIEFING.md).

## Omni-Aktionen in V2

Omni schlägt interne Aufgabenänderungen, Termine und Projektnotizen mit genauer Vorschau vor und führt sie nach Bestätigung gemeinsam aus. Mit Verlauf, Ergebnislinks und Schutz gegen doppelte Ausführung: [Bedienung und Einrichtung](docs/OMNI-AKTIONEN.md).

## Omnis Gedächtnis in V2

Gezielt gespeicherte Vorlieben, Wissen und Entscheidungen mit Projektbindung, Chatquellen, Versionen, Archiv und Löschen. Passender Kontext ist pro Antwort nachvollziehbar und abschaltbar: [Bedienung und Einrichtung](docs/OMNI-GEDAECHTNIS.md).

Omni kann wichtige eigene Chatangaben jetzt auch automatisch merken, ausdrückliche Korrekturen versionieren und Unsicheres als Rückfrage anzeigen: [Automatisches Gedächtnis](docs/OMNI-AUTO-GEDAECHTNIS.md). Die Automatik lässt sich unter dem Chat abschalten.


## Mission Control in V2

Eigenes Projektlagebild mit expliziten GitHub-/Vercel-/Neon-/Uptime-Verbindungen, Quellenzeiten, Datenlücken, Ereignisverlauf, Besuchsvergleich, Messverläufen und Omni-Lagebericht. Eigene Uptime-Monitore lassen sich direkt zuordnen, unabhängig von Neon. Direkte Projektaufgaben und manuelle Uptime-Prüfungen verwenden bestehende APIs. [Bedienung, Zuordnungen und Grenzen](docs/MISSION-CONTROL.md).

## Kommandoebene in Google Chrome

Die Browser-Kommandoebene bietet ein Seitenpanel zum bewussten Speichern von Textauswahl, Quelle und eigenen Anmerkungen mit Projektzuordnung. Das App-Modul enthält den ZIP-Download und die Installation; die Kontoverbindung wird in der bestehenden Anmeldung ausdrücklich freigegeben und ist widerrufbar. [Installation, Berechtigungen und Prüfstatus](docs/BROWSER-KOMMANDOEBENE.md).
