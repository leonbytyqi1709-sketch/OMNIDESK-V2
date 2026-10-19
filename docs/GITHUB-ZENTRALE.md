# GitHub-Zentrale einrichten

Stand: 19. Oktober 2026. Lesende GitHub-Integration als eigenes Modul und Karte im Projektmanagement. Unterstützt die dem Token zugänglichen Repositories, Branches, Commits des Standardbranches, offene Issues/Pull Requests, Actions-Läufe und Releases. Keine schreibenden GitHub-Aktionen.

## 1. GitHub-Token erstellen

Öffne [GitHub → Settings → Developer settings → Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens). Einen neuen Token mit geeigneter Laufzeit erstellen:

- Resource owner: Konto beziehungsweise Organisation, deren Repositories angezeigt werden sollen.
- Repository access: **Only select repositories**, dann gewünschte Repositories auswählen. **All repositories** nur wählen, wenn dieser breitere Zugriff gewünscht ist.
- Repository permissions jeweils **Read-only**: **Contents**, **Issues**, **Pull requests**, **Actions**. **Metadata** ist üblicherweise automatisch lesbar.
- Keine Schreibrechte oder Repository-Administration für OMNIDESK nötig.

Organisationsrichtlinien können eine Freigabe oder SSO-Autorisierung erfordern. Ein Token hat nur Zugriff auf die Ressourcen des gewählten Besitzers und der tatsächlich freigegebenen Repositories; die App kann keine zusätzlichen Berechtigungen erteilen. Nicht unterstützte Fine-grained-Konstellationen wie bestimmte externe Mitarbeit können eine andere unterstützte Token-Konfiguration verlangen. Umfang dabei bewusst auf erforderliche Leserechte begrenzen.

Der Git-Proxy dieser Entwicklungsumgebung ersetzt keinen Token für die auf Vercel laufende App. Token niemals in den Chat, das Repository oder Screenshots schreiben.

## 2. In Vercel hinterlegen

**OMNIDESK-V2 → Settings → Environment Variables → Production**:

```text
GITHUB_API_TOKEN = der neue geheime GitHub-Token
GITHUB_ACCOUNT_USER_ID = user_3GdGzbr7SYJGIUrypi8R7iQChWe
```

Die Benutzerkennung oben gehört zum aktuellen Betreiber. Für andere Installationen die eigene vollständige Clerk-Benutzerkennung verwenden. Die Freischaltung begrenzt die Nutzung des serverseitigen Tokens auf genau diesen angemeldeten OMNIDESK-Benutzer. Kein `VITE_`-Präfix verwenden. Danach **Redeploy** ausführen.

## 3. Repositories auswählen und Projekte verknüpfen

1. **GitHub** in der Sidebar öffnen; falls ausgeblendet im Modul-Manager aktivieren.
2. Repository aus der automatischen Liste auswählen.
3. Die sechs Bereiche prüfen. Fehlende Rechte/Teilfehler erscheinen ausdrücklich als nicht verfügbar; leere Listen sind davon getrennt.
4. Unter **Mit OMNIDESK-Projekt verknüpfen** ein eigenes Projekt wählen und **Zuordnung speichern** anklicken.
5. Im Projektmanagement erscheint dieselbe Repository-Ansicht am zugeordneten Projekt. Pro Projekt ist ein Repository vorgesehen; dasselbe Repository darf mehreren eigenen Projekten zugeordnet werden.

Die erste Zuordnung legt ausschließlich die zusätzliche Tabelle `v2_github_links` an. Dafür braucht die Anwendungsdatenbank einmalig CREATE-Rechte. Bestehende Tabellen werden nicht verändert. Scheitert die Einrichtung wegen Berechtigungen, kann eine berechtigte Rolle vorher dieses feste additive SQL in der Anwendungsdatenbank ausführen:

```sql
CREATE TABLE IF NOT EXISTS v2_github_links (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  repository text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Speichern/Entfernen verändert nur die OMNIDESK-Zuordnung, niemals GitHub-Repositories. Besitzer des OMNIDESK-Projekts und Zugriff auf das Repository werden vor dem Speichern geprüft. Die Schreibabfrage prüft den Projektbesitzer erneut. Bei nicht mehr zugänglichen oder umbenannten Repositories die Auswahl beziehungsweise Token-Rechte aktualisieren und neu zuordnen.

## 4. Verbindung zu Deployments

Wenn Vercel eine ausdrückliche GitHub-Repository-Verknüpfung für das Projekt liefert, erscheint in dessen Deployment-Karte **GitHub-Repository und Produktions-Commit anzeigen**. Der Link öffnet das passende Repository; vorhandene Commits, Branch-Spitzen und Actions-Läufe mit exakt gleicher Commit-SHA werden markiert. Ein fehlender Treffer bedeutet nur, dass im geladenen Ausschnitt kein Treffer gefunden wurde. Fehlende Repository-/Commit-Identitäten werden nicht erfunden.

Der Weg von Projekt → Repository → Vercel-Produktion ist damit sichtbar. Neon/Uptime bleiben über das gemeinsame OMNIDESK-Projekt erreichbar. Eine zeitliche Korrelation von Störungen, ein universeller Ursachenbericht und GitHub-Webhooks sind nicht implementiert. Zeitliche Nähe ist kein Nachweis einer Fehlerursache.

## Umfang und Grenzen

- Repository-Liste: bis zu zehn Seiten mit je 100 Repositories, danach sichtbarer Begrenzungshinweis.
- Je Detailbereich höchstens 20 Einträge; keine vollständigen Gesamtzahlen. Der Issues-Endpunkt enthält auch Pull Requests, die vor der Anzeige herausgefiltert werden; deshalb kann die Issues-Liste kürzer sein.
- Commits stammen vom Standardbranch. Andere Branches lassen sich direkt bei GitHub öffnen.
- Actions zeigt Status/Ergebnis und Links zum Original. Keine Log-Inhalte, Artefaktdownloads, Workflow-Starts oder Wiederholungen.
- Issues und PRs zeigen ausschließlich offene Einträge. Releases können je Berechtigung auch Entwürfe enthalten.
- Manueller Refresh, kurzzeitiger Browsercache mit separaten Schlüsseln pro Benutzer/Repository. API-Antworten `no-store`.
- API-Limits werden respektiert: kein automatisches Retry-Dauerfeuer. Teilfehler bleiben erkennbar, veraltete zuletzt geladene Daten werden bei Fehlern als solche gekennzeichnet.
- Nur GET-Anfragen an `https://api.github.com`, feste REST-Pfade, keine Weiterleitungen und begrenzte Antwortgrößen. Keine Zugangsdaten oder vollständigen Providerantworten an den Browser; nur ausgewählte Felder. Private Inhalte werden nicht automatisch an Omni geschickt.

## Live-Abnahme

1. Unveränderte Aufgaben, Projekte, Neon- und Uptime-Daten prüfen.
2. Eigenes öffentliches und optional privates Repository mit GitHub vergleichen.
3. Branches, Commit-SHA, offene Issues/PRs, Releases und Actions-Zustände gegen das Original prüfen.
4. Repository einem eigenen OMNIDESK-Projekt zuordnen, Projektansicht öffnen, Zuordnung ändern und entfernen.
5. Bei einem Vercel-Projekt mit GitHub-Verbindung den Produktions-Commit-Link prüfen. Nur exakte SHA-Treffer dürfen markiert werden.
6. Ein anderer OMNIDESK-Benutzer darf den serverseitigen GitHub-Token nicht nutzen und keine Zuordnungen lesen/verändern.
7. Fehlende Repository-/Actions-Rechte dürfen keine scheinbar gesunde erfolgreiche Prüfung erzeugen.

Lokale Tests prüfen Provider-Projektionen, Pagination, unsichere Links, Fehler, Rechte und tatsächliche Zuordnungsabfragen gegen PostgreSQL/WASM. Ein produktiver Token ist hier nicht vorhanden; echte GitHub-Anmeldung und Live-Abnahme stehen aus.
