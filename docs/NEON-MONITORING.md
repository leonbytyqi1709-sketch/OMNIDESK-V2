# Neon-Monitoring – erster lesender Ausbau

Stand: 19. Oktober 2026. Eine Neon-Übersicht ist im Uptime-Modul und in den Projekt-Detailansichten vorbereitet. Sie verbindet ein bestehendes OMNIDESK-Projekt mit einem explizit zugeordneten Neon-Projekt und Branch. Bestehende HTTP-/TCP-Monitore und die bestätigte Vercel-Bereitstellung bleiben unverändert.

## Umfang dieses Schritts

- Projektname, Region und Postgres-Version, sofern geliefert.
- Zugeordneter Branch mit Zustand und logischer Größe.
- Compute-Endpunkte ausschließlich dieses Branches: aktiv/ruhend/deaktiviert, Typ und verfügbare CU-Grenzen.
- Verfügbare projektweite Verbrauchswerte: Speicher inklusive Historie/WAL, Compute-Zeit in CU-h, aktive Zeit und Datenübertragung samt Verbrauchszeitraum.
- Zeitpunkt des Abrufs; fehlende Werte als „Nicht verfügbar“ und Teilfehler ausdrücklich markiert.
- Manuelles Aktualisieren. Der Client hält Ergebnisse bis zu einer Minute vor und kann bei Fokuswechsel neu laden; es ist kein engmaschiger Hintergrund-Scheduler eingerichtet.

Es werden ausschließlich GET-Anfragen an die Neon-Verwaltungs-API gesendet. Es gibt keinen Aufruf zum Starten/Stoppen oder Ändern eines Computes, keine SQL-Prüfabfrage, keinen Zugriff auf Tabelleninhalte und keine Datenbankmigration. Der Zustand „Ruht“ ist kein Ausfall. Ein erfolgreicher Verwaltungs-API-Aufruf beweist keine erfolgreiche SQL-Abfrage.

**Noch nicht enthalten:** gespeicherte Messhistorie, Diagramme über eigene Messpunkte, Warnregeln, engmaschige Hintergrundprüfungen und optionaler SQL-Funktionstest. Die gesamte ursprünglich ausgewählte Neon-Funktion ist damit noch nicht vollständig abgeschlossen.

## Sichere Zuordnung

Für jeden Abruf müssen zwei Bedingungen gelten:

1. Die serverseitige Konfiguration ordnet dem angemeldeten Clerk-Benutzer genau dieses OMNIDESK-Projekt und die Neon-Ressourcen zu.
2. Das OMNIDESK-Projekt gehört in der Datenbank weiterhin diesem Benutzer.

Ein im Browser übermittelter Projektname, Neon-Identifier oder Benutzerwert reicht nicht als Berechtigung. Fremde und veraltete Zuordnungen werden nicht angezeigt. Weder API-Schlüssel noch vollständige Neon-Antworten oder Verbindungsstrings werden an den Browser weitergegeben. Ergebnisse erhalten `Cache-Control: no-store`; es gibt keinen globalen Benutzer-Cache im Backend.

## Einrichtung im Vercel-Projekt OMNIDESK-V2

### NEON_API_KEY

Einen geeigneten API-Schlüssel aus der Neon-Konsole ausschließlich als Vercel-Variable `NEON_API_KEY` hinterlegen. Wenn für das Konto verfügbar, auf die benötigten Projekte und Leserechte beschränken. Die App nutzt nur GET, ein umfassender API-Schlüssel kann außerhalb der App trotzdem weitergehende Rechte besitzen. Den Schlüssel nicht hier im Chat, im Repository oder in einem Screenshot veröffentlichen. `DATABASE_URL` ist kein Ersatz für diesen Verwaltungs-API-Schlüssel und bleibt unverändert.

### NEON_MONITOR_LINKS

Eine JSON-Liste serverseitiger Zuordnungen als Vercel-Variable `NEON_MONITOR_LINKS` eintragen, zum Beispiel:

```json
[
  {
    "userId": "user_DEINE_CLERK_BENUTZER_ID",
    "projectId": "d7b2a703-4c85-46e7-950a-11327eeb5369",
    "neonProjectId": "DEINE-NEON-PROJEKT-ID",
    "branchId": "br-DEINE-BRANCH-ID"
  }
]
```

Beispielwerte müssen ersetzt werden; Neon-IDs werden als Kleinbuchstaben/Ziffern/Bindestriche validiert. Das `projectId` ist die echte UUID eines vorhandenen Projekts aus **OMNIDESK → Projektmanagement**, nicht die Neon-Projekt-ID. Benutzer- und OMNIDESK-Projektkennung lassen sich in der Projektansicht im Neon-Bereich unter **Kennungen für die Einrichtung** ablesen. Wenn noch kein OMNIDESK-Projekt vorhanden ist, zunächst eines über die normale Projektverwaltung anlegen. Projekt und Branch-ID aus der Neon-Konsole übernehmen; keine URL oder Datenbankverbindung eintragen.

Mehrere Einträge für unterschiedliche OMNIDESK-Projekte sind möglich. Pro Benutzer und OMNIDESK-Projekt ist in dieser ersten Version genau ein Branch vorgesehen. Keine automatische Freigabe für sämtliche angemeldeten Benutzer. Das Trennen einer Zuordnung erfolgt vorerst durch Entfernen ihres Konfigurationseintrags und erneutes Deployment; dabei werden weder Neon-Ressourcen noch OMNIDESK-Projekte gelöscht.

Nach Eintragen der Variablen neu deployen. Ohne Konfiguration bleibt die bestehende App nutzbar und die Neon-Karte zeigt einen Einrichtungshinweis statt eines fehlerhaften globalen API-Zustands. Kein `db:push` oder Datenimport erforderlich.

## Live-Abnahme

1. `/api/health` prüfen und die bisherigen Uptime-Monitore kontrollieren.
2. Neon-Karte im Uptime-Modul öffnen und das zugeordnete Projekt auswählen.
3. Den angegebenen Branch, dessen Compute-Zustand und die Werte mit der Neon-Konsole vergleichen. Projektweiter Verbrauch ist nicht gleich Branch-Verbrauch; Neon-Verbrauchsdaten können verzögert eintreffen.
4. Dieselbe Ansicht in der OMNIDESK-Projekt-Detailseite prüfen.
5. Mit einem anderen OMNIDESK-Benutzer darf die Zuordnung nicht zugänglich sein.
6. Fehlerhafte Zuordnung oder ungültiger API-Schlüssel dürfen keine scheinbar gesunden Nullwerte erzeugen.

Der Live-Test ist noch ausstehend. Lokale Regressionstests verwenden simulierte Neon-Antworten und Projektdaten. In dieser Entwicklungsumgebung sind die Vercel-Zugangsdaten nicht verfügbar; es wurden keine echten Neon-Datenbankoperationen ausgeführt.

## Technische Referenz

Verwendete GET-Endpunkte:

```text
https://console.neon.tech/api/v2/projects/{project_id}
https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}
https://console.neon.tech/api/v2/projects/{project_id}/endpoints
```

Geprüft anhand des offiziellen generierten Neon-API-Clients `@neondatabase/api-client` Version 2.7.3 aus dem npm-Registry. Dieser wurde nur außerhalb des Checkouts als Schnittstellenreferenz gelesen; keine neue Laufzeitabhängigkeit wurde installiert. Weitere Referenz: [Neon API](https://neon.com/docs/reference/api-reference/).

```bash
npx tsx --test tests/*.test.ts
npm run lint
npm run build
```
