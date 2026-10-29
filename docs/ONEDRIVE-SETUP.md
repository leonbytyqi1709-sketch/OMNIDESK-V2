# OneDrive in OMNIDESK V2 einrichten

Implementierung: 19. Oktober 2026. Die Anmeldung unterstützt private Microsoft-Konten und Geschäfts-/Schulkonten. Der echte Microsoft-Kontotest steht noch aus; lokale Tests simulieren die Microsoft-Antworten. Die ursprüngliche OMNIDESK-App und deren Google-Anmeldung werden nicht verändert.

## 1. Microsoft-App registrieren

1. Das [Microsoft Entra Admin Center](https://entra.microsoft.com/) öffnen und zu **App-Registrierungen / App registrations → Neue Registrierung / New registration** gehen. Für die Registrierung wird ein Verzeichnis benötigt, in dem das eigene Konto Apps registrieren darf. Falls dieser Bereich fehlt oder gesperrt ist, müssen zuerst die eigenen Verzeichnisrechte geklärt werden.
2. Beispielsweise **OMNIDESK V2 – OneDrive** als Namen wählen.
3. Als unterstützte Kontotypen **Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten** wählen. Nur Organisationskonten oder nur persönliche Konten wären für den hier gewünschten gemeinsamen Umfang nicht ausreichend.
4. Eine Redirect-URI für die Plattform **Web** eintragen (keine SPA-Konfiguration):

   ```text
   https://omnidesk-work.vercel.app/api/integrations/microsoft/callback
   ```

5. Nach Registrierung die **Anwendungs-ID / Application (client) ID** notieren.
6. Unter **Zertifikate & Geheimnisse / Certificates & secrets** einen Client Secret mit geeigneter begrenzter Laufzeit erstellen. Den **Wert / Value**, nicht die Secret-ID, direkt in Vercel hinterlegen. Den Wert weder in Git noch im Chat speichern. Ablaufdatum notieren.
7. Unter **API-Berechtigungen / API permissions** für **Microsoft Graph → Delegierte Berechtigungen / Delegated permissions** die Berechtigungen `User.Read`, `Files.Read` und `offline_access` sicherstellen. OMNIDESK fordert ausschließlich diese Scopes an. Keine Application Permissions, kein Mail- oder Dateischreibzugriff erforderlich. Den impliziten Grant nicht einschalten.

Geschäfts-/Schulkonten können abhängig von ihrer Organisation eine Administratorzustimmung benötigen. Das lässt sich nicht durch Code umgehen. Ein Konto muss außerdem ein verfügbares OneDrive besitzen; fehlende Lizenz oder noch nicht vorhandenes Laufwerk kann die Speicherabfrage verhindern. Persönliche Microsoft-Konten sind nicht automatisch in jedem Organisationsverzeichnis als Benutzer zugelassen, werden aber über den gemeinsamen Anmeldeendpunkt unterstützt, wenn die App passend registriert ist.

## 2. Variablen ausschließlich im Vercel-Projekt von V2 setzen

Unter **Settings → Environment Variables**:

| Name | Wert |
|---|---|
| `MICROSOFT_CLIENT_ID` | Application (client) ID der neuen Registrierung |
| `MICROSOFT_CLIENT_SECRET` | Client-Secret-Wert, nur serverseitig |
| `MICROSOFT_REDIRECT_URI` | `https://omnidesk-work.vercel.app/api/integrations/microsoft/callback` |
| `MICROSOFT_TENANT` | `common` (Standard, unterstützt private und Organisationskonten) |

Die Variablen brauchen keinen `VITE_`-Präfix und dürfen nicht in das Frontend-Bundle gelangen. Für die veröffentlichte V2-Adresse müssen sie in der zugehörigen Vercel-Umgebung verfügbar sein. Anschließend neu deployen. Der bestehende Clerk-Login bei OMNIDESK bleibt die App-Anmeldung; Microsoft verbindet zusätzlich das Cloud-Konto.

Der OneDrive-Login muss auf derselben Adresse begonnen werden, die in `MICROSOFT_REDIRECT_URI` steht. Eine beliebige Vercel-Preview-Domain kann nicht einfach auf die feste Beta-Domain zurückspringen, weil dort das browsergebundene Transaktions-Cookie fehlt. Für eine weitere Adresse eine eigene passende Registrierung/Redirect-Konfiguration und entsprechende Variablen verwenden. Lokal ist beispielsweise `http://localhost:5173/api/integrations/microsoft/callback` möglich, wenn diese Web-Redirect-URI registriert und der Vite-API-Proxy gestartet ist.

## 3. Funktion prüfen

1. Erfolgreiches Vercel-Deployment abwarten. `/api/health` muss JSON mit `ok: true` liefern. Die zuvor bestätigte API-Dateistruktur und Vercel-Rewrites wurden für OneDrive nicht geändert.
2. In V2 anmelden und **Einstellungen → Integrationen → Microsoft OneDrive → Mit Microsoft verbinden** öffnen. Alternativ im Cloud-Monitoring **Konto verknüpfen → Microsoft OneDrive** auswählen.
3. Bei Microsoft das gewünschte Konto wählen und die angezeigten Berechtigungen prüfen. Das Microsoft-Passwort nur bei Microsoft eingeben.
4. Nach Rückkehr muss das Konto erscheinen. Speicherwerte und letzter Abruf sind in Einstellungen, Cloud-Monitoring und dem Cloud-Widget sichtbar. Die OneDrive-Filteransicht muss nur Microsoft-Konten zeigen.
5. Synchronisieren; anschließend neu laden und Bestand prüfen. Nach einer längeren Sitzung muss auch die serverseitige Token-Erneuerung funktionieren.
6. Ein privates und ein Geschäfts-/Schulkonto separat verbinden und prüfen, soweit vorhanden und durch die Organisation erlaubt.
7. Ein OneDrive-Konto trennen: Es wird nur die Verbindung in OMNIDESK gelöscht, keine Datei bei Microsoft. Die externe Microsoft-Zustimmung bleibt gegebenenfalls bestehen und kann zusätzlich im Microsoft-Konto widerrufen werden. Andere Cloud-Konten bleiben erhalten.
8. Google Drive, MEGA, Uptime, Notizen und Aufgaben als Regression auf der Beta-Seite prüfen.

## Messwerte und Fehlerverhalten

- Die Daten kommen aus `GET https://graph.microsoft.com/v1.0/me/drive` mit ausgewählten Feldern. Microsoft weist darauf hin, dass OneDrive Personal die **gemeinsame Microsoft-Speicherquote** mehrerer Dienste melden kann. Die Oberfläche kennzeichnet dies; sie verspricht keinen exklusiven OneDrive-Dateiverbrauch.
- Fehlende oder unvollständige Quoten werden nicht durch erfundene Kapazitäten ersetzt. Beim fehlgeschlagenen Verbindungsaufbau wird kein neues Konto mit Demo-Werten angelegt. Beim Synchronisationsfehler bleiben die letzten erfolgreichen Messwerte und ihr Abrufzeitpunkt erhalten.
- `User.Read` wird für ein Konto-Profil abgerufen, `Files.Read` für die Drive-Metadaten, `offline_access` für die Erneuerung. Files.Read gestattet mehr als nur Quotenabfragen; der implementierte Code ruft weder Dateiinhalte ab noch schreibt er Dateien.
- Tokens werden serverseitig verschlüsselt in den vorhandenen Token-Spalten gespeichert. Die Schlüsselableitung verwendet das Microsoft-Client-Secret mit eigener Zwecktrennung. Bei Änderung/Ablauf des Secrets müssen OneDrive-Konten erneut verbunden werden; auch eine neue App-ID sollte mit erneuter Verbindung einhergehen. Google-/MEGA-Tokens werden dabei nicht geändert.
- Es gibt keine Schemaänderung und keinen Bedarf für `db:push`: `provider` ist bereits eine Textspalte. Die Provider-Typisierung wird um `microsoft` erweitert. Daten bestehender Konten werden nicht migriert oder gelöscht.
- Der neue Flow nutzt PKCE und ein verschlüsseltes, kurzlebiges HttpOnly-Cookie mit zufälligem State und fester Rücksprungauswahl. Microsoft-Fehlermeldungen und Tokens werden nicht in Redirect-URLs übernommen. Gleichzeitige Anmeldungen in mehreren Tabs können eine ältere Transaktion ungültig machen; dann erneut verbinden.

## Lokale Validierung

```bash
npx tsx --test tests/*.test.ts
npm run lint
npm run build
```

Tests decken unter anderem State-/Cookie-Bindung, PKCE, sichere Redirects, Callback-Erfolg und -Abweisung, verschlüsselte Speicherung, Token-Rotation vor einer fehlgeschlagenen Quotenabfrage, fehlende Konfiguration, öffentliche Rückgaben ohne Tokens und bisherige Cloud-Routen ab. Sie ersetzen keinen Test mit einer echten Microsoft-Registrierung und einer Neon-Datenbank.

## Quellen

- [Microsoft: Authorization Code Flow mit PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft Graph: Get Drive, unterstützte delegierte Berechtigungen](https://learn.microsoft.com/en-us/graph/api/drive-get?view=graph-rest-1.0)
- [Microsoft Graph: quota und gemeinsame persönliche Speicherquote](https://learn.microsoft.com/en-us/graph/api/resources/quota?view=graph-rest-1.0)
