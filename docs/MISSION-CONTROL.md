# Mission Control

Eigenes Modul unter `/mission-control`, zusätzlich zum bestehenden Dashboard. Das Lagebild lädt bis zu sechs sichtbare Projekte pro Seite; Suche und Statusfilter helfen bei größeren Beständen. Ein über `?project=<UUID>` gewähltes eigenes Projekt kann direkt geöffnet werden. Abrufe erfolgen beim Öffnen, manuell und alle zwei Minuten, solange die Ansicht geöffnet ist. Dies ist kein neuer Hintergrundscheduler.

## Projektquellen

- **Projektboard:** vorhandene eigene Projektaufgaben, getrennt von persönlichen Aufgaben ohne Projektbindung. Aufgaben lassen sich direkt ins Backlog erstellen; die bestehende Projekt-API prüft die serverseitige Benutzerkennung.
- **GitHub:** ausschließlich die gespeicherte Projektzuordnung aus der GitHub-Zentrale; deren Benutzerfreischaltung und Token gelten unverändert. Kein automatisches Zuordnen aller Account-Repositories. Commits, Actions, Releases, Issues und Pull Requests stammen aus den bestehenden begrenzten API-Ausschnitten.
- **Vercel:** ausschließlich der zu Benutzer und Projekt passende Eintrag in `DEPLOYMENT_PROJECT_LINKS`. Die Kontoübersicht allein erzeugt keine OMNIDESK-Projektbindung. Produktion, letzter Versuch, Status und Logs bleiben getrennt. Ein READY-Deployment ist kein Erreichbarkeitsnachweis.
- **Neon:** vorhandene `NEON_MONITOR_LINKS` mit Projekt- und Branchbindung; aktueller Verwaltungsstatus, Branchgröße, gespeicherte Warnungen und Messhistorie. Ruhende Computes sind kein Ausfall und ein API-Status ist kein SQL-Funktionstest.
- **Uptime:** ausschließlich ausdrücklich verknüpfte eigene Monitore aus den bestehenden Neon-Monitoring-Einstellungen (`monitorIds`). Unverknüpfte Account-Monitore werden vor der Antwort entfernt. Projekte ohne Neon-Zuordnung können in dieser ersten Version noch keine eigenständige Uptime-Verknüpfung anlegen. Eine solche allgemeine Projekt-Monitor-Zuordnung ist ein späterer Ausbau.

Fehlende Konfiguration, fehlerhafte Abrufe und fehlende Datensätze sind getrennt erkennbar. Die Aggregations-API `/api/mission-control/:projectId` liegt hinter Clerk, prüft Projektbesitz vor den Provider-Aufrufen und erneut vor der Antwort und verwendet `Cache-Control: no-store`. Einzelne Quellenfehler blockieren die übrigen Quellen nicht. Fehlertexte enthalten keine Provider-Antworten oder Zugangsdaten.

## Lagebericht und Belege

Der grundlegende Omni-Lagebericht arbeitet regelbasiert und benötigt keinen KI-Schlüssel. Er nennt belegte Auffälligkeiten, Datenlücken, nächste Schritte und verlinkte Ereignisse. „Unauffällig im erfassten Umfang“ ist keine vollständige Systemfreigabe. Fehlende, pausierte, zukünftige oder veraltete Prüfungen gelten nicht als gesund. Die letzten zehn Minuten gelten für aktuelle Provider-Abrufe, 15 Minuten für Uptime-Messungen. Gespeicherte Neon-Messungen werden anhand des größeren Prüf-/Schedulerintervalls beurteilt (zweifaches Intervall).

Gleiche Commit-IDs werden nur bei übereinstimmendem GitHub-/Vercel-Repository verbunden. Eine offene Neon-Warnung innerhalb einer Stunde nach der Erstellung des Produktionsdeployments wird als zeitliche Nähe dargestellt, ausdrücklich ohne Ursachenbehauptung. Der Deployment-Erstellungszeitpunkt ist kein belegter Go-live-Zeitpunkt. Keine erfundenen Zeitreihen: Datenbankverbindungszahlen und eine durchgehende projektbezogene Uptime-Latenzreihe sind in diesem Bericht nicht verfügbar.

Der Ereignisverlauf zeigt bis zu 25 datierte Einträge aus den begrenzten Quellenausschnitten. Aufgaben zeigen ihren letzten Änderungszeitpunkt, keine nachträglich erfundene Versionshistorie. Die Messhistorie ist im vorhandenen Neon-Detailbereich erreichbar. Das vollständige Missionsarchiv, dauerhafte Besuchsvergleiche und belastbare Ursachenanalysen sind nicht Teil dieser ersten Version.

Optional wählt **Schwerpunkte mit Omni priorisieren** über den bestehenden KI-Anbieter höchstens drei vorhandene Fakten. Dabei werden Projektfakten einschließlich ihrer Titel, Zustände und Zeitpunkte an den konfigurierten Anbieter übermittelt. Der bestehende Omni-Selektor validiert Quellen-IDs und erlaubte Gründe; er erzeugt keine frei erfundenen Tatsachen und führt keine Aktionen aus. Ohne nutzbaren KI-Zugang bleibt eine als regelbasiert gekennzeichnete Auswahl. Ein lokales Request-Limit begrenzt KI-Anfragen auf eine pro Benutzer und Minute pro laufender Function-Instanz; es ist keine verteilte globale Kostenbegrenzung.

## Aktionen und Sicherheit

Aufgabenerstellung und manuelle Uptime-Prüfung verwenden vorhandene, benutzergeprüfte APIs. Nur eigene aktive, ausdrücklich zugeordnete Monitore sind auswählbar. Es gibt keine automatischen Deployments, externen Schreibaktionen oder Löschaktionen. Die vorhandenen Omni-Aktionspläne, Vorschauen, Bestätigungen und Validierungsregeln bleiben unverändert. Die KI-Priorisierung verwendet keine Aktionsschnittstelle. Der optionale SQL-Test wird durch Mission Control nicht aktiviert oder gestartet.

## Lokale Prüfung und Live-Abnahme

```sh
npm ci --cache /tmp/omnidesk-npm-cache --no-audit --no-fund
npx --no-install tsx --test tests/mission-control.test.ts
npm run lint
npm run build
```

Für die authentifizierte lokale Anwendung benötigt die Cloud-Umgebung ihre eigenen bestehenden Clerk-/Entwicklungsdatenbankwerte; Vercel-Variablen werden nicht automatisch übernommen. Keine Produktionsmigration ist für Mission Control erforderlich. Keine produktive Datenbankbereinigung ausführen.

Automatisierte Tests verwenden PGlite und simulierte Provider-Antworten. Eine Browserprüfung mit Beispieldaten ersetzt keine echte GitHub-, Vercel-, Neon-, Clerk- oder KI-Anbieterabnahme. Nach Bereitstellung: eigenes Projekt öffnen, Quellenzeiten und fehlende Zuordnungen prüfen, Details öffnen, eine Projektaufgabe erstellen und gegebenenfalls einen verknüpften Uptime-Monitor manuell prüfen. Mit einem zweiten Benutzer dürfen weder fremde Projekte noch deren Provider-Daten erscheinen.

## Entferntes Internet-Radar

Das Radar-Modul einschließlich API, Feed-Verarbeitung, Browserautomatik, Scheduler-Endpunkt, eigenen Tests und exklusiven Abhängigkeiten wurde entfernt. Alte Modul-Links fallen über die vorhandene Catch-all-Route auf das Dashboard zurück. Unbenutzte produktive Radar-Tabellen und ausdrücklich ins Gedächtnis übernommene Einträge bleiben erhalten. Gemeinsames `CRON_SECRET` sowie Neon-/Uptime-Cron bleiben bestehen.

Falls in cron-job.org ein separater Auftrag für `/api/cron/radar-refresh` angelegt wurde, diesen dort deaktivieren oder löschen. Aus dem Repository lässt sich dessen Existenz nicht feststellen; Codeentfernung löscht keinen externen Scheduler-Auftrag.

## Offener Befund zur Bereitstellung

Im geprüften Ausgangsstand `2d78bee` verweist `vercel.json` auf `/api/index.js`, während `bundle:api` ausschließlich `api/[[...route]].js` erzeugt. Dieser bereits bestehende Widerspruch wurde im Rahmen dieser Änderung nicht durch eine neue Rewrite-Strategie ersetzt. Der generierte Handler wurde lokal mit einem echten Health-Request geprüft; das beweist nicht die Weiterleitung im Vercel-Routing. Der direkte Live-Abruf und die GitHub-Deployment-API waren in der Cloud-Umgebung durch den Netzwerkproxy gesperrt. Deshalb sind Vercel-Routing, erfolgreicher Deploy und authentifizierte Provider-Abnahme weiterhin separat zu verifizieren.
