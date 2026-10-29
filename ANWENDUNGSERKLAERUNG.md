> **Historisch.** Dieses Dokument beschreibt einen Stand von September 2026 und ist überholt.
> Der aktuelle Stand steht in [PROJEKTDOKUMENTATION.md](PROJEKTDOKUMENTATION.md).

# OmniDesk – Anwendungsdokumentation

> Vollständige, strukturierte Übersicht der Web-Anwendung OmniDesk.
> Stand: September 2026 · Live: https://omnidesk-ruby.vercel.app

---

## 1. PROJEKT-ÜBERSICHT

### 1.1 Name der Anwendung
**OmniDesk** – die modulare All-in-One-Produktivitäts-Webapp für IT-Profis.

### 1.2 Hauptziel und Kerngedanke
IT-Profis jonglieren täglich mit einer Vielzahl getrennter Werkzeuge: eine To-Do-App hier, ein Kalender dort, ein Passwort-Manager, ChatGPT, ein Server-Monitor, Gmail, Markdown-Notizen und unzählige Browser-Tabs mit Cheatsheets. **OmniDesk löst dieses Zersplittert-Problem**, indem es sämtliche Werkzeuge des IT-Arbeitsalltags in **einer einzigen, zentralen Anwendung** vereint – mit einer einheitlichen Datenbank, einem einheitlichen Design und einer globalen Command-Palette als Steuerzentrale.

Der Kerngedanke: **„Ein Hub für den gesamten IT-Arbeitsalltag"** – vom Morgenteam-Check über das Bento-Grid-Dashboard (Aufgaben, Termine, Server-Uptime, Cloud-Speicher, Weltuhren) bis zum Abend-Deployment, alles ohne Kontextwechsel zwischen zehn verschiedenen Diensten.

### 1.3 Zielgruppe
- **Primär:** IT-Professionals – SysAdmins, DevOps-Engineers, IT-Support, Netzwerktechniker
- **Sekundär:** Entwickler, Freelancer und Power-User, die viele Werkzeuge parallel nutzen
- **Fokus:** deutschsprachige Nutzer (komplette UI auf Deutsch), aber international einsetzbar

---

## 2. FUNKTIONEN & FEATURES

### 2.1 Kernfunktionen (Module) im Detail

#### 📊 Dashboard (Bento-Grid)
- Anpassbares **Bento-Grid** mit **10 Widgets**: Begrüßungs-Hero, Aufgaben, Termine, Notizen, Links, Projekte, Pomodoro, Cloud-Speicher (Google Drive + MEGA), QuickStats (Tages-Fokus: überfällige/heutige Tasks, nächster Termin, Pomodoro-Mini) und IT-Weltuhren (Berlin, UTC, New York, Tokio)
- Widgets per **Drag & Drop** anordnen, aktivieren/deaktivieren; intelligente Modul-Kopplung (deaktivierte Module werden im Dashboard automatisch ausgeblendet)

#### ✅ Aufgaben (Tasks)
- **Kanban-Board und Listenansicht**, umschaltbar
- **Unteraufgaben (Checklisten)** mit Checkboxen abhaken/anlegen
- **Tagging-System** mit farbigen Badge-Pills und Fortschrittsbalken („X/Y erledigt")
- Fälligkeitsdaten, Überfälligkeits-Hervorhebung, Filter

#### 📝 Notizen
- Markdown-Editor mit Live-Rendering (React Markdown + GFM)
- Datei-/Bild-Anhänge pro Notiz
- Schnellsuche über alle Notizen

#### 📅 Kalender & Termine
- Monats-/Listenansicht für Termine
- Terminverwaltung mit Zeiten in **Europe/Berlin** (serverseitig korrekt gehandhabt, auch wenn die Cloud auf UTC läuft)

#### 👥 Kontakte
- Kontaktkarten mit zentralen Feldern (Name, Firma, E-Mail, Telefon, Notizen)

#### 🔗 Links
- Persönliche Link-Sammlung (Lesezeichen-Hub) mit Favicon-Darstellung

#### ⌨️ Befehlsbibliothek (Commands) – **Alleinstellungsmerkmal**
- **160+ kuratierte Profi-Befehle** aus Linux, Windows, Active Directory, Git, Docker, Kubernetes, Datenbanken, Security und Netzwerk
- **Interaktiver CommandParamDialog:** Befehle enthalten `{{platzhalter}}` – beim Ausführen öffnet sich ein Dialog mit Live-Vorschau und Kopieren-Button
- Leuchtende **Inline-Parameter-Chips** im Code, Terminal-Prompt-Symbole (`$`/`>`), Klick-to-Copy
- **Favoriten-System** (⭐ Stern-Pins via localStorage, eigener Favoriten-Tab)
- **Markdown-Export** der Befehle als Cheatsheet (.md-Download)

#### 🗂️ Projektmanagement (Projects)
- Projekt-Kacheln mit **Drag & Drop**
- **Tagging-System** in Formularen, Kacheln und Board-Detailansicht
- Projektfortschritt und -übersicht

#### 🔐 Passwort-Manager (Passwords) – **Alleinstellungsmerkmal**
- Eigener Vault mit **PBKDF2-Schlüsselableitung und AES-256-GCM-Verschlüsselung** (clientseitig)
- Zugangsdaten-Verwaltung mit Suche und Kategorien

#### 📧 Mail (Gmail-Klon)
- 50 Mails mit automatischer **Kategorien-Gruppierung ohne Werbung**
- **Live Google-Versand** über die Gmail API (echte Mails senden aus OmniDesk)

#### ☁️ Cloud-Monitoring – **Alleinstellungsmerkmal**
- **Google Drive & MEGA in einem Blick:** Speicherbalken mit Quota-Sync
- **Google OAuth2-Flow** mit automatischem Token-Refresh, Multi-Account-Unterstützung (`connected_accounts`-Schema)
- MEGA-Anbindung via megajs
- **Speicher-Schwellenwert-Alarme:** >80 % Warnung (gelb), >90 % kritisch (rot)
- „Sync-All"-Aktion im Dashboard-Widget

#### 🟢 Uptime & Service-Health-Monitor – **Alleinstellungsmerkmal**
- Websites, APIs und Ports überwachen: HTTP-Status, Latenz/Ping, SSL-Restlaufzeit
- Automatischer Update-Tick per **Vercel-Cron-Job** (1× täglich, Cron-Secret-geschützt)
- Gesundheitsstatus je Dienst mit Verlauf

#### 🤖 KI-Assistent (Chat)
- Eingebauter KI-Chat mit Streaming-Antworten
- **Groq-API** über eine OpenAI-kompatible Schnittstelle (`AI_BASE_URL` → `api.groq.com`), Modell konfigurierbar (`AI_MODEL`)
- Chat-Sitzungen und -Verlauf **persistent in der Datenbank** (pro Nutzer, umbenennbar, löschbar)
- **API-Key-Failover:** kommagetrennte Fallback-Keys (`AI_API_KEYS`), automatischer Wechsel bei 401/403/429/5xx

#### 🖥️ Booking (Eigenbau-Calendly)
- Öffentliche Buchungsseite unter `/book/:slug` – **ohne Login** erreichbar
- Termin-Slots nach konfigurierbarer Wochen-Verfügbarkeit, Zeitslot-Länge einstellbar
- Zeitlogik vollständig zeitzonensicher (Europe/Berlin)
- Gibt nur freie Slots preis, **nie Termindetails** (Datenschutz by design)

#### ⚙️ Einstellungen (Settings)
- Erscheinungsbild, Module-Verwaltung, Profil

#### 🧭 Globale Command-Palette (Strg + K) – **Alleinstellungsmerkmal**
- Überall aufrufbar; durchsucht **alle Module und alle 160+ Befehle**
- Navigation, Modulwechsel, Pomodoro-Steuerung
- Öffnet bei Befehlen mit Parametern direkt den Parameter-Dialog

### 2.2 Besondere Features & USPs (Zusammenfassung)
1. **Echte All-in-One-Abdeckung** – 15 Module, die im Gegensatz zu reinen „Link-Sammlungen" alle auf **einer gemeinsamen Datenbank** basieren
2. **Befehlsbibliothek mit Parameter-Dialog** – 160+ kuratierte IT-Befehle mit interaktiver Vorschau, ohne vergleichbares Pendant
3. **Eigenes Dashboard-Widget-System** mit Drag & Drop und Modul-Kopplung
4. **Serverlos & kostenarm** – komplett auf Vercel Hobby-Plan + Neon Free-Tier lauffähig
5. **PWA** – installierbar auf Desktop und Smartphone, offline-fähig
6. **Sicherheits-Architektur:** Clerk-Auth auf jedem geschützten Endpunkt (401-verified), clientseitige AES-256-GCM-Passwortverschlüsselung, keine Secrets im Repo/Frontend-Bundle
7. **KI mit Failover** – Groq-Chat mit Key-Rotation und persistenter Historie

### 2.3 User Journey (typischer Ablauf)
1. **Anmeldung:** Nutzer öffnet https://omnidesk-ruby.vercel.app und loggt sich über **Clerk** ein (E-Mail oder Google)
2. **Tagesstart:** Das Bento-Dashboard zeigt auf einen Blick: überfällige Aufgaben, heutige Termine, Cloud-Speicherstände, Server-Uptime, Uhrzeiten der IT-Standorte weltweit
3. **Arbeiten:** Der Nutzer springt per **Strg + K** direkt in ein Modul (z. B. Aufgaben abhaken, Notiz schreiben) oder kopiert einen Server-Befehl aus der Befehlsbibliothek – mit ausgefüllten Parametern im Parameter-Dialog
4. **Fokus:** Pomodoro-Timer läuft im Hintergrund; die QuickStats zeigen den Tages-Fortschritt
5. **Ops:** Der Uptime-Monitor warnt bei ausgefallenen Diensten; Cloud-Monitoring meldet vollen Drive-Speicher
6. **Externe:** Kollegen/Kunden buchen Termine über die öffentliche `/book/:slug`-Seite, die direkt in den Kalender schreibt
7. **Abends:** PWA auf dem Smartphone zeigt denselben Stand – alles aus einer Datenbank, überall synchron

---

## 3. TECH STACK & ARCHITEKTUR

### 3.1 Frontend
| Baustein | Technologie |
|---|---|
| Framework | **React 19 + TypeScript (strict)** |
| Build-Tool | **Vite 8** |
| Routing | **React Router** mit Lazy Loading über Modul-Registry (`src/config/modules.ts`) |
| Server-State | **TanStack Query v5** |
| Client-State | **Zustand v5** |
| Styling | **Tailwind CSS v4** (CSS-basierte Config in `src/styles/globals.css`) |
| UI-Bibliothek | **Shadcn/ui** (auf Radix UI), Icons: **Lucide React** |
| Validierung | **Zod v4** |
| Toasts | **Sonner** |
| Command-Palette | **cmdk** |
| Markdown | **react-markdown + remark-gfm** |
| PWA | **vite-plugin-pwa** (Service Worker, Manifest, installierbar) |

**Architekturprinzip (strikte Modultrennung):** Jedes Modul liegt unter `src/modules/<id>/` mit `index.tsx` als einzigem Export; neue Module werden ausschließlich über die Registry `src/config/modules.ts` angemeldet. Aktive Module: `assistant, calendar, cloud-monitor, commands, contacts, dashboard, links, mail, notes, passwords, pomodoro, projects, settings, tasks, uptime` (15 Module).

### 3.2 Backend
| Baustein | Technologie |
|---|---|
| API-Framework | **Hono v4** (TypeScript) |
| API lokal | Node-Server (`@hono/node-server`, Port 8787, Vite-Proxy `/api`) |
| API Produktion | **Vercel Serverless Function** – die Hono-App wird per **esbuild** zu einer Bundle-Datei (`api/index.js`) gebaut (`npm run bundle:api`, Teil von `npm run build`) |
| Datenbank | **Neon Postgres (serverless)** über `@neondatabase/serverless` |
| ORM | **Drizzle ORM** (neon-http; ein Schema pro Modul in `src/db/schema/`, immer mit `user_id` + Index) |
| Auth | **Clerk** – JWT-Verifizierung serverseitig via `jose` (JWKS der Clerk-Instanz, kein Secret-Key nötig); Middleware schützt alle privaten Endpunkte |
| KI | **Groq API** (OpenAI-kompatibel), Key-Failover-Logik |
| E-Mail | **Gmail API** (Live-Versand, OAuth2) |
| Cloud-Storage | **Google Drive API** (OAuth2 + Token-Refresh, Multi-Account) und **MEGA** via `megajs` |
| Validierung | **Zod** auf allen API-Eingängen |
| Zeitzone | Serverseitiges `TZ=Europe/Berlin`-Handling (auch auf UTC-Infrastruktur korrekt) |

**API-Endpunkte (19):** `/api/health`, `notes`, `tasks`, `contacts`, `appointments`, `links`, `projects`, `commands`, `vault`, `booking`, `public/booking/:slug(/slots)`, `integrations` (+ Google-Callback), `mail`, `cloud-monitor`, `uptime`, `chat`, `cron/uptime-refresh` (Cron-Secret-geschützt).

**Sicherheitsarchitektur:**
- Alle geschützten Endpunkte verlangen einen gültigen Clerk-JWT (verifiziert: Fake-Tokens → 401, POST ohne Auth → 401)
- `DATABASE_URL`, `OPENAI_API_KEY` (= Groq-Key), `GOOGLE_CLIENT_SECRET`, `CRON_SECRET` sind reine Server-Laufzeit-Variablen – nie im Frontend-Bundle
- Passwörter im Vault werden clientseitig mit PBKDF2/AES-256-GCM verschlüsselt – der Server sieht nie Klartexte
- Env-Checks sind lazy (Serverless-sicher); Fehler verraten nur den Namen der fehlenden Variable

### 3.3 Hosting & Deployment
| Aspekt | Umsetzung |
|---|---|
| Hosting | **Vercel** (Hobby-Plan) – https://omnidesk-ruby.vercel.app |
| Auto-Deploy | Bei jedem `git push origin main` (Git-Integration mit GitHub) |
| Build-Pipeline | `npm run build` = `tsc -b` (Typcheck) → `vite build` (Frontend) → `bundle:api` (esbuild-API-Bundle) – verbindlich per `buildCommand` in `vercel.json` |
| Routing | SPA-Rewrite für alle Nicht-API-Pfade; API-Rewrite `/api/(.*)` → `/api/index.js` |
| Cron | Vercel-Cron-Job (1× täglich 6:00) für den Uptime-Refresh, geschützt via `CRON_SECRET` |
| Env-Vars | Im Vercel-Projekt: `DATABASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `OPENAI_API_KEY` (Groq-Key), `AI_BASE_URL`, `AI_MODEL`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `CRON_SECRET`, `TZ` |
| Repository | https://github.com/leonbytyqi1709-sketch/OMNIDESK |
| Health-Check | `GET https://omnidesk-ruby.vercel.app/api/health` → `{"ok":true,...}` |
| Status | Prüfung A–Z: 19 Endpunkte getestet, 0 funktionale Fehler, 0 Sicherheitslücken, Lint 0 Fehler, Build 100 % grün |

### 3.4 Lokale Entwicklung
- Zwei Terminals: `npm run dev` (Frontend, Port 5173) und `npm run dev:api` (Hono-API, Port 8787)
- `.env.local` vollständig konfiguriert; DB-Migrationen via Drizzle Kit (`db:generate`, `db:push`, `db:migrate`, `db:studio`)

---

## 4. DESIGN & VIBE

### 4.1 Design-Stil
**„Dark-Neon High-Tech"** – ein dunkler, phosphoreszierender Cockpit-Look zwischen VS Code, Terminal-Ästhetik und futuristischem Dashboard. Zentrale Gestaltungsmittel:

- **Bento-Grid-Layout:** alle Informationen in Kacheln unterschiedlicher Größe
- **Glassmorphism:** Sidebar mit `backdrop-blur-xl`, leuchtende „Active-Pill" als Navigations-Highlight
- **Ambient-Glow-Sphären:** zwei sehr subtile Lichtkugeln in den Markenfarben (#230d8f Violett, #cf0a0a Rot) im Hintergrund
- **Card-Hover-Glows:** Bento-Karten leuchten beim Hovern subtil auf (`glow`, `glow-strong`, `glow-subtle`, `card-hover-glow`)
- **Gradient-Akzente:** alle Hervorhebungen nutzen den Signatur-Gradient **#230d8f → #cf0a0a**

### 4.2 Farbschema (strikt vorgegeben)
| Rolle | Farbe |
|---|---|
| Hintergrund | `#09090b` (fast schwarz) |
| Kacheln/Karten | `#18181b` (dunkelgrau) |
| Primärtext | `#fafafa` (weiß) |
| Sekundärtext | `#a1a1aa` (grau) |
| Marken-Gradient | `#230d8f` (Violett) → `#cf0a0a` (Rot) |

Fertige Utilities (in `globals.css`): `bg-gradient-accent`, `text-gradient-accent`, `glow`, `glow-strong`, `glow-subtle`, `glass-card`, `card-hover-glow`.

### 4.3 Tonalität & UI-Prinzipien
- **Komplett deutschsprachig** – UI-Texte, Toasts (via Sonner), Leeren-Zustände und Dialoge
- **Dichte mit Ruhe:** viele Informationen pro Blick (Bento-Grid, QuickStats), klare Kachelabgrenzung
- **Tastatur-first:** Command-Palette (Strg + K) als zentrale Steuerung – Navigation ohne Maus
- **Terminal-Ästhetik** in der Befehlsbibliothek: Prompt-Symbole, Monospace-Code, leuchtende Parameter-Chips
- **Responsiv:** eigene Mobile-Navigation (Sheet-Drawer, MobileHeader); volle Funktion als installierbare PWA
- **Feedback-Kultur:** jede Aktion bestätigt sich per Toast; Fortschritte als Balken/Pills

---

## 5. TECHNISCHER ZUSTAND (Kurzfassung)

- **Status:** fertiggestellt, live deployed und A–Z getestet (0 Fehler, 0 Sicherheitslücken)
- **Live-URL:** https://omnidesk-ruby.vercel.app · Health: `GET /api/health` → `{"ok":true}`
- **Repository:** github.com/leonbytyqi1709-sketch/OMNIDESK (Auto-Deploy bei Push auf `main`)
- **Geplante Erweiterungen (Roadmap):** IT-Toolbox & Dev-Converters (`/tools`: JWT-Debugger, Subnet/CIDR-Rechner, Base64/URL-Encoder, Hash-Generator, Cron-Visualizer, UUID-Generator, JSON-Formatter), Floating Scratchpad, Drag & Drop File-Upload ins Cloud-Monitoring, Upgrade auf Clerk-Production-Keys (`pk_live_`)

---

*Erstellt auf Basis von DOKUMENTATION.txt, WEITERMACHEN_PROMPT.txt, HOSTING_TEST_DOKUMENTATION.txt und der package.json des Repositories.*
