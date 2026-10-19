# Deployment-Zentrale einrichten

Stand: 19. Oktober 2026. Erste lesende Vercel-Anbindung als neues Modul **Deployments** und als Karte in den OMNIDESK-Projektansichten neben Neon. Das bisherige Design, die bestehende Vercel-Bereitstellung und vorhandene Monitore werden beibehalten. Es gibt keine neue Datenbanktabelle oder Migration.

## Was dieser Schritt anbietet

- Automatische Auswahl der über den Token erreichbaren Vercel-Projekte aus Konto und Teams.
- Optionale Projektzuordnung für Karten innerhalb des OMNIDESK-Projektmanagements.
- Aktuelle Produktionszuordnung aus Vercels `targets.production`. Ein erfolgreicher Verlaufseintrag wird nicht ersatzweise als aktuelle Produktion ausgegeben.
- Bis zu 20 jüngste Deployments mit Status, Umgebung, Zeitpunkt und verfügbaren Git-Commit-Angaben.
- Build-Logs auf ausdrücklichen Klick; bis zu 100 jüngste Ereignisse, anschließend chronologisch dargestellt. Kein dauerhaft geöffneter Stream.
- Teilfehler und fehlende Angaben werden sichtbar; fehlende Logrechte oder abgelaufene Aufbewahrung gelten nicht als leere erfolgreiche Build-Prüfung.

Kein Deployen, Neustarten, Abbrechen, Rollback oder Ändern von Domains und Umgebungsvariablen. Alle Anfragen an Vercel sind GET-Anfragen. Eine spätere Verbindung zu GitHub beziehungsweise eine gemeinsame Auswertung mit Neon/Uptime ist noch kein Bestandteil dieses ersten Schritts. Ein Vercel-Status „Bereit“ beweist nicht, dass Anmeldung, Datenbank oder Anwendungsfunktionen erfolgreich getestet wurden.

## 1. Vercel-Token hinterlegen

Unter [Vercel-Kontoeinstellungen → Tokens](https://vercel.com/account/settings/tokens) einen geeigneten Token für das Konto beziehungsweise Team erstellen, das das gewünschte Projekt besitzt. Wenn verfügbar, Zugriff und Laufzeit möglichst eng begrenzen. Ein persönlicher Token kann weitergehende Rechte als die von OMNIDESK verwendeten Lesezugriffe besitzen.

Den Wert ausschließlich im **Vercel-Projekt OMNIDESK-V2 → Settings → Environment Variables** hinterlegen:

```text
DEPLOYMENT_API_TOKEN = der neue Token
```

Für die feste Beta-Adresse gilt üblicherweise die Umgebung **Production**. Der Token hat keinen `VITE_`-Präfix und wird nicht an den Browser weitergegeben. Nicht in Git, Chat oder Screenshots veröffentlichen. Die bisherige Git-Authentifizierung der Entwicklungsumgebung ersetzt diesen Token für die produktive App nicht.

## 2. Automatische Projektliste freischalten

Zusätzlich zum Token diese Variable für Production hinterlegen:

```text
DEPLOYMENT_ACCOUNT_USER_ID = deine vollständige Clerk-Benutzerkennung
```

Für den aktuellen Betreiber ist die Kennung `user_3GdGzbr7SYJGIUrypi8R7iQChWe`. Danach neu deployen und **Deployments** öffnen. Dort werden Vercel-Projekte direkt auswählbar; es sind weder OMNIDESK-Projekte noch JSON-Zuordnungen notwendig. Bestehende `DEPLOYMENT_PROJECT_LINKS` dürfen erhalten bleiben.

Diese Freischaltung ist bewusst ausdrücklich: Nur dieser angemeldete Benutzer darf den gemeinsamen serverseitigen Token für die gesamte Projektliste verwenden. Andere Benutzer erhalten keinen Zugriff. Ein Token kann nur die Projekte anzeigen, für die er Rechte besitzt. Fehlgeschlagene Konto-/Teamabrufe werden als Teilfehler angezeigt. Pro Liste werden höchstens zehn Seiten mit jeweils 100 Einträgen und bis zu 30 Teams abgefragt; eine Begrenzung wird angezeigt. Es werden keine Vercel-Projekte angelegt oder kopiert.

## Optional: Zuordnung im OMNIDESK-Projektmanagement

Für die zusätzliche Karte innerhalb eines vorhandenen OMNIDESK-Projekts die Variable `DEPLOYMENT_PROJECT_LINKS` anlegen. Wert ist eine JSON-Liste ohne Markdown-Zeichen und ohne zusätzliche äußere Anführungszeichen:

```json
[
  {
    "userId": "user_DEINE_CLERK_ID",
    "projectId": "7860bb51-2bf3-427b-bdec-0ed7b3ef3cda",
    "vercelProjectId": "prj_DEINE_VERCEL_PROJEKT_ID",
    "teamId": "team_DEINE_TEAM_ID"
  }
]
```

- `userId`: eigener angemeldeter Clerk-Benutzer. In der Deployment-Karte unter **Kennungen für die Einrichtung** sichtbar.
- `projectId`: UUID des vorhandenen **OMNIDESK-Projekts**, nicht die Vercel-ID. In dessen Detailansicht ebenfalls unter **Kennungen für die Einrichtung** sichtbar. Der Beispielwert ist nur dann korrekt, wenn dieses Projekt dem betreffenden Benutzer gehört.
- `vercelProjectId`: echte `prj_...`-ID unter **Vercel-Projekt → Settings → General → Project ID**, nicht Name oder Webadresse.
- `teamId`: optional. Für Team-Projekte die passende `team_...`-Kennung aus den Team-Einstellungen verwenden. Für Projekte ohne erforderlichen Teamkontext die ganze Eigenschaft weglassen.

Mehrere unterschiedliche OMNIDESK-Projekte sind als weitere Listeneinträge möglich; pro Benutzer und OMNIDESK-Projekt gibt es zunächst genau eine Vercel-Zuordnung. Neben der Konfiguration prüft das Backend vor jedem Status-/Logabruf, ob das OMNIDESK-Projekt dem angemeldeten Benutzer noch gehört. Vor Abruf der Logs wird außerdem das Deployment selbst bei Vercel gelesen und seine `projectId` mit der freigegebenen Vercel-Projekt-ID verglichen. Ein anderer Benutzer oder eine andere Deployment-ID kann die Zuordnung nicht ersetzen.

Nach Änderung der Variablen ein **Redeploy** ausführen. Ohne Konfiguration erscheinen Einrichtungshinweise; bestehende Module bleiben nutzbar.

## 3. Prüfen

1. Deployment „Ready“ abwarten. Den Healthcheck und die bisherigen Monitore prüfen.
2. **Deployments** in der Sidebar öffnen und ein automatisch gefundenes Vercel-Projekt wählen. Das Modul kann wie andere Werkzeuge im Modul-Manager ausgeblendet werden; die Projektkarte ist unabhängig davon Teil der Projektansicht.
3. Produktionskarte und Verlauf mit dem Vercel-Dashboard vergleichen. Eine Preview muss als Vorschau erkennbar bleiben. Fehlt Vercels ausdrückliche Produktionszuordnung, wird keine vermutet.
4. Bei einem bekannten Build auf **Build-Logs** klicken. Ergebnis, Reihenfolge und Begrenzung prüfen. Vercel entscheidet nach Berechtigungen, Tarif und Aufbewahrung, welche Logs verfügbar sind.
5. Andere Benutzer dürfen keine fremden Zuordnungen erhalten. Auch direkt aufgerufene Logadressen bleiben geschützt.
6. Die beiden Karten in der OMNIDESK-Projektansicht prüfen. Bestehende Neon-Werte, Aufgaben und Uptime-Monitore müssen weiterhin zugänglich sein.

## Log-Inhalte

Nur Build-Ereignisse, keine Laufzeitlogs, werden angefordert. Die Antwort ist auf zwei MB begrenzt, einzelne ausgegebene Logzeilen auf 8000 Zeichen. Erkennbare Token-/Passwortzuweisungen, Verbindungsstrings mit Zugangsdaten, private Schlüssel und bekannte Geheimwerte der App-Umgebung werden vor Ausgabe bereinigt. **Diese Erkennung ist nicht vollständig:** Beliebige Geheimnisse aus Build-Ausgaben können nicht garantiert erkannt werden. Inhalte vor dem Weitergeben selbst prüfen. Die App speichert die Logs nicht in ihrer Datenbank und sendet sie nicht an Omni.

API-Antworten erhalten `Cache-Control: no-store`. Kurzzeitige React-Query-Caches im Browser werden nach Benutzerkennung getrennt. Direkte Providerantworten mit privaten Feldern wie Vercel-Umgebungsvariablen werden nicht durchgereicht; angezeigt werden nur ausdrücklich ausgewählte Felder.

## Technische Referenz und Validierung

Für die automatische Liste zusätzlich GET `/v10/projects` und GET `/v2/teams`, jeweils mit Pagination. Status und Logs werden nur für serverseitig gefundene Projekte im passenden Teamkontext abgerufen.

Verwendete Schnittstellen des offiziellen `@vercel/sdk` 1.28.46 (nur außerhalb des Checkouts als Referenz gelesen, nicht als neue Laufzeitabhängigkeit installiert):

```text
GET https://api.vercel.com/v9/projects/{projectId}
GET https://api.vercel.com/v7/deployments?projectId=...&limit=20
GET https://api.vercel.com/v13/deployments/{deploymentId}
GET https://api.vercel.com/v3/deployments/{deploymentId}/events?follow=0&builds=1&direction=backward&limit=100
```

Bei Teamkontext wird jeweils `teamId` hinzugefügt. Weiterleitungen zu anderen Hosts werden nicht verfolgt. Weitere Referenz: [Vercel REST API](https://vercel.com/docs/rest-api).

```bash
npx tsx --test tests/*.test.ts
npm run lint
npm run build
```

Regressionstests simulieren Vercel-Antworten und Projektdaten. Sie prüfen unter anderem Projekt-/Teamfilter, private Produktionszuordnung versus Preview-Verlauf, fehlende und ungültige Konfiguration, fremde Projekte/Deployment-IDs, endliche Logabfragen, Redaktion, Antwortgrößen und vorhandenen Authentifizierungsschutz. Ein echter Vercel-Kontotest und die visuelle Abnahme der angemeldeten Oberfläche stehen noch aus; in dieser Entwicklungsumgebung fehlen Token und lokale Datenbankkonfiguration.
