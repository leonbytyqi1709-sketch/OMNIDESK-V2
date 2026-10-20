# Persönlicher Internet-Radar

Der Internet-Radar sammelt Meldungen aus ausdrücklich gewählten öffentlichen RSS-/Atom-Feeds. GitHub-Releases sind über `https://github.com/OWNER/REPO/releases.atom` nutzbar. Es ist kein neuer Suchmaschinen- oder Feed-API-Schlüssel erforderlich. Der Radar ist keine allgemeine Websuche und durchsucht nicht automatisch das gesamte Internet.

## Einstieg

1. In **Internet-Radar → Themen & Quellen einrichten** ein Thema mit 1–12 Suchbegriffen anlegen. Suchbegriffe mit Komma trennen. Ein Thema kann persönlich oder einem eigenen Projekt zugeordnet sein.
2. **Quelle hinzufügen** wählen, ein Thema zuweisen und eine öffentliche HTTPS-Feed-Adresse eintragen. Voreinstellungen gibt es für React-Releases, Next.js-Releases, GitHub Blog und OpenAI News. Voreinstellungen sind Startadressen, keine dauerhaft garantierten Anbieter-Schnittstellen.
3. Der Radar prüft fällige Quellen beim Öffnen automatisch. Bis zu drei Quellen werden gemeinsam abgerufen, mit mindestens 15 Minuten Abstand pro Quelle. Weitere fällige Quellen folgen in der geöffneten Ansicht. Der Automatik-Schalter bleibt pro Nutzer im Browser gespeichert. **Quellen prüfen** stößt ebenfalls nur fällige Abrufe an.
4. Titel, Feed-Auszug, Original-URL, Quelldatum und erster Fundzeitpunkt erscheinen als Meldung. Fehlt ein gültiges Quelldatum, wird keines erfunden. Lesen, Merkliste, Textsuche, Themenfilter und „Nur Suchbegriff-Treffer“ helfen beim Sichten.

Quellenkategorien werden bei der Einrichtung gewählt: Neuigkeit, Sicherheitsmeldung, Release oder Statusmeldung. Sie sind keine automatische Inhaltsdiagnose. Suchbegriffe werden im Titel und Feed-Auszug gesucht und sichtbar aufgelistet. Eine passende Zeichenfolge ist kein Nachweis einer Sicherheitsbetroffenheit oder tatsächlich eingesetzter Versionen. Standardmäßig bleiben auch Meldungen ohne Suchbegriff-Treffer sichtbar, da der Nutzer die Quelle bewusst gewählt hat.

## Einzelne Funde und Projektwissen

Ein Thema kann ein Projekt vorgeben. **Fund zuordnen** erlaubt zusätzlich eine ausdrückliche Zuordnung des einzelnen Artikels zu einem eigenen Projekt oder zum persönlichen Bereich. „Zuordnung des Themas verwenden“ kehrt zur Themenzuordnung zurück. Entfernte Projekte werden als nicht verfügbar behandelt; sie werden nicht still durch eine persönliche Zuordnung ersetzt.

**Ins Gedächtnis** übernimmt ausdrücklich Titel, Original-URL, Quelldatum, Abrufzeit und Feed-Auszug in eine eigene Erinnerung. Der Text kennzeichnet sich als externer ungeprüfter Quellenauszug, keine vollständige Webseitenkopie. Die wirksame Projektzuordnung des Funds wird übernommen. Ein erneuter Klick erzeugt keine zweite Erinnerung für denselben Quelleintrag. Gedächtniskopien werden unabhängig gepflegt und nicht automatisch mit späteren Feedänderungen überschrieben. Bei nachträglich anderer Projektzuordnung muss die bereits vorhandene Erinnerung im Gedächtnis neu zugeordnet werden.

**Omni einordnen lassen** erstellt auf Wunsch eine zusätzliche KI-Zusammenfassung ausschließlich aus Titel und Auszug. Es werden keine Artikel-Webseiten geöffnet oder neue Recherchen gestartet. Projektdaten, Vault und sonstige private Modulinhalte werden nicht gesendet. Die bestehende Omni-Konfiguration wird wiederverwendet. Die Ergebnisanzeige bleibt als KI-Zusammenfassung gekennzeichnet; die Suchbegriff-Erklärung entsteht getrennt aus tatsächlichen Texttreffern. Einordnungen werden wiederverwendet und bei geändertem Titel/Auszug verworfen. Nach einer fehlgeschlagenen Anfrage gilt eine fünfminütige Begrenzung. Der erste konfigurierte Schlüssel wird verwendet, mit sieben Sekunden Timeout und begrenzter Antwortgröße.

## Gruppierung und Grenzen

Gleiche normalisierte Artikel-URLs aus mehreren Quellen werden in der Ansicht gruppiert. Trackingparameter wie `utm_*` und Fragmente werden entfernt, andere Queryparameter bleiben erhalten. Jeder zugehörige Quellen- und Themenbezug bleibt sichtbar. Gelesen/Merkliste und eine ausdrückliche Fundzuordnung gelten beim Gruppenknopf für die dargestellten Quelleinträge. Der Gedächtnisknopf zeigt das Thema des konkret übernommenen ersten Quelleintrags. Ähnliche Berichte mit unterschiedlichen URLs werden nicht als identisch behauptet.

Je Nutzer sind 20 Themen und 20 Quellen möglich. Ein Feedabruf betrachtet höchstens 100 Einträge. Pro Quelle bleiben höchstens 200 nicht vorgemerkte Funde erhalten; vorgemerkte Einträge werden bei dieser Bereinigung nicht gelöscht. Die Ansicht zeigt jeweils maximal 400 zuletzt gefundene Einträge, die Merkliste einen eigenen Ausschnitt aus vorgemerkten Einträgen. Suche und Zähler beziehen sich auf den jeweils sichtbaren Ausschnitt; ein Hinweis kennzeichnet weitere Datensätze. Ein erster Abruf kann auch ältere Feed-Einträge einlesen und ist keine Aussage über deren Neuveröffentlichung.

Feeds sind nicht vollständig: Manche Anbieter liefern nur wenige jüngste Einträge oder keinen Feed. Abrufausfälle, Rate-Limits und nicht unterstützte Formate können Meldungen auslassen. Das Modul bietet keine garantierte lückenlose Sicherheitsüberwachung, tatsächliche Versionsinventur, automatische Störungserkennung oder vollständiges Webarchiv. Briefing und Mission Control erhalten in diesem Schritt keinen automatischen neuen Datenzugriff.

## Hintergrundbetrieb bei geschlossener App

Ohne Scheduler gibt es automatische Abrufe beim Öffnen der Radaransicht, aber keine garantierten Offline-Abrufe. Unter **Automatik, Quellen und Grenzen** zeigt die App die korrekte URL und den letzten tatsächlich erfolgreichen Scheduler-Abruf für eigene Quellen.

Für das bestehende Vercel-Hobby-Projekt kann beispielsweise cron-job.org genutzt werden:

- URL: `https://omnidesk-v2-beta.vercel.app/api/cron/radar-refresh`
- Methode: `GET`
- Zeitplan: alle fünf Minuten.
- **HTTP-Basic-Authentifizierung ausgeschaltet lassen.**
- Kopfzeile: Schlüssel `Authorization`, Wert `Bearer ` gefolgt vom bestehenden `CRON_SECRET` aus Vercel. Nicht den Vercel-API-Token oder das persönliche Kontopasswort einsetzen.
- Testaufruf prüfen: HTTP 200 und JSON-Ergebnis. Danach sollte beim tatsächlichen erfolgreichen Abruf eine Scheduler-Zeit im Radar erscheinen. Gibt es aktuell keine fälligen Quellen, ist `checked: 0` korrekt; mindestens 15 Minuten seit dem letzten Versuch abwarten.

Pro Aufruf werden global höchstens drei fällige Quellen abgerufen; mehrere Nutzer/Quellen teilen sich diese Kapazität. Das Intervall von 15 Minuten ist ein Mindestabstand, keine zugesagte Prüfung jedes Feeds im 15-Minuten-Takt. Mit vielen Quellen dauert ein Umlauf entsprechend länger. Der Abruf ist durch `CRON_SECRET` geschützt und akzeptiert keine freien URLs vom Scheduler. Die bestehenden Vercel-Rewrites und vorhandenen Cronjobs bleiben unverändert. Die Einrichtung eines externen Scheduler-Jobs ist durch den Code-Push allein nicht erfolgt.

## Speicherung und sicherer Abruf

Der erste Zugriff richtet ausschließlich `v2_radar_topics`, `v2_radar_sources`, `v2_radar_items` und einen Index additiv ein. Voraussetzung sind die vorhandene `DATABASE_URL` und CREATE-Rechte, alternativ [das Einrichtungsskript](sql/INTERNET-RADAR.sql). Bestehende Tabellen und das Original-Repository bleiben unverändert. Gedächtnistabellen werden erst bei ausdrücklicher Übernahme entsprechend der vorhandenen Gedächtniseinrichtung verwendet.

Alle Datenzugriffe prüfen den angemeldeten Besitzer. Projektzuordnungen müssen eigene Projekte sein; Versionsnummern schützen Quellen- und Themenänderungen aus veralteten Tabs. Quellen werden mit Zeitbegrenzung und Lease abgerufen. Pausieren oder Entfernen verhindert verspätete Schreibvorgänge eines laufenden Abrufs. Frühere Funde bleiben bei Quellenfehlern erhalten. Entfernen einer Quelle oder eines Themas löscht die zugehörigen Radar-Funde; bewusst übernommene Gedächtniskopien bleiben erhalten.

Der Server akzeptiert nur öffentliche HTTPS-Ziele ohne URL-Zugangsdaten und ohne abweichenden Port. IPv4/IPv6-Adressen werden auf öffentliche Bereiche geprüft, sämtliche DNS-Ergebnisse validiert und die Verbindung an eine geprüfte Adresse gebunden. Weiterleitungen werden erneut geprüft und begrenzt. Private, lokale, Link-Local- und sonstige reservierte Netze sind ausgeschlossen. Feedgröße maximal 1 MiB; ausschließlich unkomprimierte UTF-8-Feeds werden verarbeitet. XML-DTD/Entity-Deklarationen werden abgelehnt, HTML zu Text reduziert und Inhalte nie als HTML ausgeführt. Es werden keine Cookies oder Zugangsdaten an Feedserver geschickt. Externe Inhalte dürfen keine Aktionen autorisieren.

## Prüfung

Automatisierte Tests nutzen echte parametrisierte SQL-Abfragen gegen isoliertes PostgreSQL/WASM: Besitzer-/Projektgrenzen, Versionskonflikte, Abruf-Leases und Mindestabstand, Quellenausfälle, HTTP 304, URL-Deduplikation und Erhalt von Lese-/Merkstatus, individuelle Projektzuordnung, Gedächtnisübernahme, KI-Kontext, Scheduler-Zeit und Löschverhalten. Parser-/Netzwerkregeln prüfen RSS/Atom, XML-Sicherheit, Link- und Adressvalidierung. Browserprüfungen mit Beispieldaten prüfen Einrichtung, Voreinstellungen, automatischen Abruf, Gruppierung, Filter, KI-Anzeige, Gedächtnisübernahme, Projektwahl, Scheduler-Status und Mobilansicht.

Ein echter GitHub-Feedabruf war aus der lokalen Arbeitsumgebung wegen DNS-Auflösungsfehler nicht möglich. Der produktive Quellenabruf und ein echter KI-Aufruf müssen nach Deployment geprüft werden. Der externe Scheduler ist bis zur Einrichtung und einem bestätigten erfolgreichen Abruf nicht live abgenommen.

### Website-Adressen und automatische Feed-Erkennung

Beim Hinzufügen einer Quelle kann eine öffentliche HTTPS-Website eingegeben werden.
„Feeds suchen“ liest deren HTML und bietet als RSS/Atom ausgewiesene `link rel="alternate"`-Adressen zur Auswahl an. Relative Links werden gegen die endgültige Adresse nach Weiterleitungen aufgelöst. Direkte RSS-/Atom-Adressen werden ebenfalls erkannt. Erst die Auswahl und „Quelle speichern“ legen eine Quelle an; die vorhandene Quelle wird nicht überschrieben. Bei zuvor falsch hinterlegten Websites kann über „Feed für diese Website suchen“ eine korrigierte Quelle angelegt und die alte anschließend entfernt werden.

Die Erkennung führt keine Skripte aus und durchsucht keine beliebigen Unterseiten. Fehlen veröffentlichte Feed-Links, ist weiterhin eine Feed-Adresse des Anbieters nötig. Gefundene Links sind Angebote der Website; ihre Erreichbarkeit und Inhalte prüft der normale Quellenabruf mit denselben DNS-, HTTPS-, Größen- und Weiterleitungsgrenzen. Die Erkennung liegt hinter der bestehenden Anmeldung (`POST /api/radar/discover`, ausschließlich `{url}`).
