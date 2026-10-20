# Mission Control

Eigenes Modul unter `/mission-control`, zusätzlich zum bestehenden Dashboard. Das Lagebild lädt bis zu sechs sichtbare Projekte pro Seite; Suche und Statusfilter helfen bei größeren Beständen. Ein über `?project=<UUID>` gewähltes eigenes Projekt kann direkt geöffnet werden. Abrufe erfolgen beim Öffnen, manuell und alle zwei Minuten, solange die Ansicht geöffnet ist. Dies ist kein neuer Hintergrundscheduler.

## Projektquellen

- **Projektboard:** vorhandene eigene Projektaufgaben, getrennt von persönlichen Aufgaben ohne Projektbindung. Aufgaben lassen sich direkt ins Backlog erstellen; die bestehende Projekt-API prüft die serverseitige Benutzerkennung.
- **GitHub:** ausschließlich die gespeicherte Projektzuordnung aus der GitHub-Zentrale; deren Benutzerfreischaltung und Token gelten unverändert. Kein automatisches Zuordnen aller Account-Repositories. Commits, Actions, Releases, Issues und Pull Requests stammen aus den bestehenden begrenzten API-Ausschnitten.
- **Vercel:** ausschließlich der zu Benutzer und Projekt passende Eintrag in `DEPLOYMENT_PROJECT_LINKS`. Die Kontoübersicht allein erzeugt keine OMNIDESK-Projektbindung. Produktion, letzter Versuch, Status und Logs bleiben getrennt. Ein READY-Deployment ist kein Erreichbarkeitsnachweis.
- **Neon:** vorhandene `NEON_MONITOR_LINKS` mit Projekt- und Branchbindung; aktueller Verwaltungsstatus, Branchgröße, gespeicherte Warnungen und Messhistorie. Ruhende Computes sind kein Ausfall und ein API-Status ist kein SQL-Funktionstest.
- **Uptime:** ausschließlich ausdrücklich verknüpfte eigene Monitore; unverknüpfte Account-Monitore werden nie als Projektdaten ausgegeben. Unter **Projektverbindungen verwalten → Uptime-Monitore zuordnen** lassen sich eigene Monitore unabhängig von Neon zuordnen. Bestehende Neon-Zuordnungen werden solange übernommen, bis erstmals eine direkte Projektzuordnung gespeichert wird. Eine leere direkte Auswahl bleibt leer; Monitore werden dabei nicht gelöscht.

Fehlende Konfiguration, fehlerhafte Abrufe und fehlende Datensätze sind getrennt erkennbar. Die Aggregations-API `/api/mission-control/:projectId` liegt hinter Clerk, prüft Projektbesitz vor den Provider-Aufrufen und erneut vor der Antwort und verwendet `Cache-Control: no-store`. Einzelne Quellenfehler blockieren die übrigen Quellen nicht. Fehlertexte enthalten keine Provider-Antworten oder Zugangsdaten.

## Lagebericht und Belege

Der grundlegende Omni-Lagebericht arbeitet regelbasiert und benötigt keinen KI-Schlüssel. Er nennt belegte Auffälligkeiten, Datenlücken, nächste Schritte und verlinkte Ereignisse. „Unauffällig im erfassten Umfang“ ist keine vollständige Systemfreigabe. Fehlende, pausierte, zukünftige oder veraltete Prüfungen gelten nicht als gesund. Die letzten zehn Minuten gelten für aktuelle Provider-Abrufe, 15 Minuten für Uptime-Messungen. Gespeicherte Neon-Messungen werden anhand des größeren Prüf-/Schedulerintervalls beurteilt (zweifaches Intervall).

Gleiche Commit-IDs werden nur bei übereinstimmendem GitHub-/Vercel-Repository verbunden. Eine offene Neon-Warnung innerhalb einer Stunde nach der Erstellung des Produktionsdeployments wird als zeitliche Nähe dargestellt, ausdrücklich ohne Ursachenbehauptung. Der Deployment-Erstellungszeitpunkt ist kein belegter Go-live-Zeitpunkt. Keine erfundenen Zeitreihen: Datenbankverbindungszahlen und eine durchgehende projektbezogene Uptime-Latenzreihe sind in diesem Bericht nicht verfügbar.

Der Ereignisverlauf zeigt bis zu 25 datierte Einträge aus den begrenzten Quellenausschnitten. Aufgaben zeigen ihren letzten Änderungszeitpunkt, keine nachträglich erfundene Versionshistorie. Die Messhistorie ist im vorhandenen Neon-Detailbereich erreichbar. Der neue Besuchsvergleich zeigt Veränderungen gegenüber dem vorherigen Öffnen anhand gespeicherter Fakten und Ereignisse. Es bleiben höchstens zehn Besuchsstände pro Projekt und Benutzer gespeichert; parallele Tabs behalten ihre eigene Vergleichsbasis. Aktualisieren in derselben Ansicht verschiebt die Basis nicht. Der Vergleich erfasst nur die beim Öffnen tatsächlich sichtbaren Projekte und beginnt mit dem ersten erfassten Besuch. Ein nicht mehr im begrenzten API-Ausschnitt enthaltener Eintrag gilt nicht als gelöscht. Dies ist kein vollständiges Missions-/Versionsarchiv.

Optional wählt **Schwerpunkte mit Omni priorisieren** über den bestehenden KI-Anbieter höchstens drei vorhandene Fakten. Dabei werden Projektfakten einschließlich ihrer Titel, Zustände und Zeitpunkte an den konfigurierten Anbieter übermittelt. Der bestehende Omni-Selektor validiert Quellen-IDs und erlaubte Gründe; er erzeugt keine frei erfundenen Tatsachen und führt keine Aktionen aus. Ohne nutzbaren KI-Zugang bleibt eine als regelbasiert gekennzeichnete Auswahl. Ein atomar in PostgreSQL gespeichertes Request-Limit begrenzt KI-Anfragen auf eine pro Benutzer und Minute, über Projekte und Function-Instanzen hinweg. Fremde Projektkennungen werden vor der Reservierung abgewiesen. Bei nicht verfügbarem Limiter wird kein KI-Aufruf gestartet.

## Aktionen und Sicherheit

Aufgabenerstellung und manuelle Uptime-Prüfung verwenden vorhandene, benutzergeprüfte APIs. Nur eigene aktive, ausdrücklich zugeordnete Monitore sind auswählbar. Es gibt keine automatischen Deployments, externen Schreibaktionen oder Löschaktionen. Die vorhandenen Omni-Aktionspläne, Vorschauen, Bestätigungen und Validierungsregeln bleiben unverändert. Die KI-Priorisierung verwendet keine Aktionsschnittstelle. Der optionale SQL-Test wird durch Mission Control nicht aktiviert oder gestartet.

## Lokale Prüfung und Live-Abnahme

```sh
npm ci --cache /tmp/omnidesk-npm-cache --no-audit --no-fund
npx --no-install tsx --test tests/mission-control.test.ts
npm run lint
npm run build
```

Für die authentifizierte lokale Anwendung benötigt die Cloud-Umgebung ihre eigenen bestehenden Clerk-/Entwicklungsdatenbankwerte; Vercel-Variablen werden nicht automatisch übernommen. Es werden ausschließlich drei zusätzliche Tabellen für Mission Control angelegt (Monitorzuordnungen, begrenzte Besuchsstände und KI-Limit). Die erste Besuchserfassung bzw. das erste Speichern initialisiert sie bei vorhandenen CREATE-Rechten unter einer Datenbanksperre. Bestehende Tabellen bleiben unverändert. Alternativ kann ein berechtigter Administrator das additive Skript `docs/sql/MISSION-CONTROL.sql` ausführen. Kein `db:push` und keine produktive Datenbankbereinigung sind erforderlich. Wenn der Besuchsspeicher nicht verfügbar ist, bleibt das aktuelle Lagebild nutzbar und der Vergleich wird als nicht verfügbar angezeigt.

Automatisierte Tests verwenden PGlite und simulierte Provider-Antworten. Eine Browserprüfung mit Beispieldaten ersetzt keine echte GitHub-, Vercel-, Neon-, Clerk- oder KI-Anbieterabnahme. Nach Bereitstellung: eigenes Projekt öffnen, Quellenzeiten und fehlende Zuordnungen prüfen, Details öffnen, eine Projektaufgabe erstellen und gegebenenfalls einen verknüpften Uptime-Monitor manuell prüfen. Mit einem zweiten Benutzer dürfen weder fremde Projekte noch deren Provider-Daten erscheinen.

## Entferntes Internet-Radar

Das Radar-Modul einschließlich API, Feed-Verarbeitung, Browserautomatik, Scheduler-Endpunkt, eigenen Tests und exklusiven Abhängigkeiten wurde entfernt. Alte Modul-Links fallen über die vorhandene Catch-all-Route auf das Dashboard zurück. Unbenutzte produktive Radar-Tabellen und ausdrücklich ins Gedächtnis übernommene Einträge bleiben erhalten. Gemeinsames `CRON_SECRET` sowie Neon-/Uptime-Cron bleiben bestehen.

Der Nutzer hat am 20.10.2026 ausdrücklich bestätigt: Es gibt keinen Radar-Cronjob bei cron-job.org. Für den Radar ist kein externer Bereinigungsschritt offen.

## Bereitstellung und bestätigter Routing-Befund

Die zuvor durch den Netzwerkproxy blockierten Live-Abrufe sind inzwischen möglich. Für Commit `2bca0fd` meldete der GitHub-Commitstatus von Vercel am 20.10.2026 einen erfolgreichen Deploy; `/api/health` antwortete mit HTTP 200 und JSON `ok: true`, Mission Control ohne Anmeldung mit HTTP 401. Die vorhandenen Rewrites funktionieren damit im geprüften Live-Deployment. Der zuvor dokumentierte Unterschied zwischen Rewrite-Ziel und Bundle-Dateiname ist kein belegter Routingfehler und rechtfertigt keine spekulative Änderung. Die Rewrites bleiben erhalten. Der konkrete Status dieser Ausbauversion und die authentifizierte Abnahme werden getrennt geprüft.

## Messverläufe und zeitliche Vergleiche

Das Cockpit zeigt gespeicherte Uptime-Messungen der letzten 24 Stunden (maximal 288 pro Monitor), tatsächliche Antwortzeiten, fehlgeschlagene Prüfungen und den Erfolgsanteil der vorhandenen Stichprobe. Fehlende/fehlgeschlagene Latenzen und Lücken über 15 Minuten werden nicht verbunden. Ein hoher Stichproben-Erfolgsanteil ist kein Nachweis für unbeobachtete Zeiten. Vorhandene Neon-Verläufe für Projektspeicher und Compute-Verbrauch werden über die bestehenden Diagramme angezeigt.

Liegen innerhalb der Stunde vor und nach Erstellung des Produktionsdeployments jeweils mindestens drei erfolgreiche Uptime-Latenzmessungen vor, kann Omni einen höheren Median benennen (mehr als 25 % und mehr als 50 ms Anstieg). Zeitfenster, Stichprobengrößen und verlinkte Belege werden angezeigt. Ausfälle werden separat dargestellt. Die Deployment-Erstellung ist kein bestätigter Go-live-Zeitpunkt; aus dem Vergleich wird keine Ursache behauptet. Für Aussagen über ansteigende Datenbankverbindungen fehlen weiterhin die entsprechenden Messwerte.

## Verifizierter Umfang

Projektlagebild, explizite Quellenbindungen, unabhängige Uptime-Zuordnungen, aktuelle Quellenfehler und Datenfrische, belegte Ereignisse, Besuchsvergleich, Messverläufe, regelbasierter Omni-Bericht, optionale KI-Priorisierung und die vorhandenen internen Aktionen bilden den vereinbarten Mission-Control-Kern. Das separate umfassende Missionsarchiv, neue Provider-Berechtigungen, automatische Deployments und unbelegte Ursachenanalysen werden daraus nicht abgeleitet. Eine produktive Nutzerabnahme bleibt von lokalen Tests mit Beispieldaten zu unterscheiden.
