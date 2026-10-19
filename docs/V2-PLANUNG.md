# OMNIDESK: Produktanalyse und V2-Konzept

Stand: 17. Oktober 2026. Analyse des bereitgestellten Checkouts, keine Änderung am Anwendungscode und kein Deployment. Grundlage: Modul-Registry, Frontend-Einstiegspunkte und gemeinsame Bedienoberflächen, API-Routen, Datenbankschemas, Integrationen, Build-/Deployment-Konfiguration, Spezifikation und Entwicklungsdokumentation. Keine vollständige authentifizierte Live-Prüfung und kein abgeschlossener Sicherheitsaudit. V2 bezeichnet hier das nächste Produktrelease; das bestehende Spezifikations-PDF heißt bereits V2.

## Bestand und Chancen

| Bereich | Vorhanden | Ausbauchance |
|---|---|---|
| Core | 15 registrierte Module, Lazy Loading, Clerk, Theme, modulares Dashboard, mobile Navigation | Kontextbezogene Arbeitsräume statt nur Modulwechsel |
| Aufgaben | Liste/Kanban, Priorität, Fälligkeit, Tags, Unteraufgaben | Verbindungen zu Mail, Kontakten, Projekten und Fokuszeiten |
| Projekte | Eigene Projektaufgaben und Meilensteine | Globale und projektbezogene Aufgaben zusammenführen oder eindeutig verknüpfen |
| Wissen | Markdown-Notizen, lokale IndexedDB-Anhänge, Scratchpad, Link-Sammlung | Verlinktes Wissen, Versionen, Cloud-Anhänge, Quellenbezug |
| Kalender | Termine und öffentliche Buchungsseite | Vorbereitung, Nachbereitung, Kapazitätsplanung und Kundenkontext |
| Kontakte | Persönliche Kontaktdaten und Firma als Text | Kunden-/Systemakten mit gemeinsamen Beziehungen |
| Fokus | Browserlokaler Pomodoro-Zustand | Zugeordnete Arbeitssitzungen und Wiederaufnahme nach Unterbrechungen |
| IT | Parametrisierte Befehle, Favoriten, Export, Uptime inklusive TCP/TLS | Geführte Runbooks, Systeminventar, Vorfälle und Lernsimulationen |
| Kommunikation | Gmail-Anbindung mit Lesen/Senden/Statusaktionen und Demo-Fallback | Mail zu Vorgang; nachvollziehbarer tatsächlicher Versandstatus |
| Cloud | Google-/MEGA-Konten und Quota-Monitoring | Dateisuche, Ablagekontext und Speichertrends; kein bestehender universeller Dateimanager |
| Vault | Clientseitige Verschlüsselung und Schlüssel im Arbeitsspeicher | Bewusste, getrennte Verknüpfung von Zugangseinträgen; Klartext bleibt außerhalb von Suche und KI |
| Omni | Gespeicherte Chats, konfigurierbarer OpenAI-kompatibler Anbieter, Key-Failover | Berechtigte Kontextsuche, belegte Antworten, überprüfbare Aktionsvorschläge |

Die zentrale Produktchance: Die vorhandenen Werkzeuge durch gemeinsame Beziehungen und Abläufe verbinden. Viele weitere isolierte Module würden die Navigation und Pflege vergrößern, ohne das ursprüngliche Problem des Kontextwechsels vollständig zu lösen.

## Konkrete Befunde aus dem Code

- `src/db/schema/tasks.ts` und `projects.ts`: persönliche Aufgaben und Projektaufgaben sind getrennte Modelle. Es gibt noch kein gemeinsames Beziehungsmodell für Mail, Notiz, Kontakt, System und Projekt.
- `server/routes/chat.ts`: KI erhält Systemprompt und Chatnachrichten, keine Werkzeugdefinitionen und keinen abgerufenen Modulkontext. Die Antwort wird als JSON empfangen, kein echtes Token-Streaming. Die aufsteigend sortierte Historie mit `limit(20)` lädt außerdem die ersten 20 Nachrichten statt der im Kommentar behaupteten letzten 20.
- `src/components/layout/CommandPalette.tsx`: Navigation, Schnellaktionen, Befehle und Volltexttreffer aus Notizen existieren bereits. Eine umfassende globale Suche wäre eine Erweiterung dieses Bestands.
- `src/components/layout/FloatingScratchpad.tsx`: Scratchpad ist bereits eingebaut, trotz älterer Roadmap-Einträge.
- `src/modules/dashboard/widgets.ts`: Uptime-Widget existiert; ältere Beschreibungen des Dashboards sind unvollständig.
- `src/modules/notes/attachments.ts`: Anhänge liegen im jeweiligen Browser. Die PWA-Konfiguration cached die App-Shell, bietet aber keinen vollständigen Offline-Schreib-/Synchronisationsablauf für Serverdaten.
- `src/modules/settings/components/GeneralTab.tsx`: Export umfasst fünf Datenbereiche, kein vollständiges Backup aller 15 Module. Beim Task-Import werden Tags und Unteraufgaben nicht übernommen.
- `vercel.json`: geplanter Cron einmal täglich; lokaler API-Prozess und abrufabhängige Uptime-Aktualisierung ersetzen keine dauerhaft häufigen Checks im Hintergrund.
- `server/routes/mail.ts`: Bei fehlgeschlagenem echten Versand kann ein Demo-Eintrag mit HTTP 201 entstehen. Vor KI- oder Regelautomation muss tatsächlicher Versand klar vom Demo-Ergebnis getrennt werden. Der Demo-Speicher ist pro Prozess global statt nutzerbezogen.
- `server/google-auth.ts` / `server/routes/google-callback.ts`: OAuth-State enthält Base64-kodierte Benutzer-/Redirectdaten; im untersuchten Ablauf fehlt eine kryptografische beziehungsweise serverseitige Bindung an eine einmalige Anmeldetransaktion. Vor erweiterten Kontoaktionen separat härten.

Die historischen Dokumentationsaussagen „0 Sicherheitslücken“ sind kein belastbarer Nachweis für umfassende Sicherheit. Die genannten Punkte sind Codebefunde; ihre Live-Auswirkungen wurden hier nicht durch Angriffe oder fremde Kontozugriffe geprüft.

## Die V2-Ideen

### 1. Mission Control: ein Arbeitsraum pro Vorhaben

Ein Vorhaben wie „Kunde Müller auf Microsoft 365 migrieren“ bündelt Kontakte, Aufgaben, Termine, Notizen, Mails, Links und betroffene Systeme. Eine konfigurierbare Arbeitsfläche zeigt passende Werkzeuge nebeneinander. Beim Wiederöffnen erscheint eine Zusammenfassung: letzter Stand, offene Entscheidungen, nächster sinnvoller Schritt. Kleinster sinnvoller Umfang: manuell verknüpfbare bestehende Datensätze und speicherbare Ansichten. Wert: unmittelbare Entlastung bei jedem Kontextwechsel.

### 2. Omni mit Arbeitskontext und überprüfbaren Aktionen

Fragen wie „Was muss ich vor dem Kundentermin erledigen?“ nutzen freigegebene Aufgaben, Notizen und Termine. Antworten verweisen auf konkrete Quellen und deren Aktualität. Aus einem Text entsteht ein vorgeschlagener Plan mit einzelnen Änderungen; der Nutzer kann ihn korrigieren und anwenden. Start mit lesendem Kontext und Aufgabenentwürfen, später Aktionen. Externe Inhalte bleiben Daten und dürfen keine Ausführungsberechtigungen erteilen; Vault-Klartexte bleiben ausgeschlossen. Kosten, Latenz und Anbietergrenzen werden sichtbar.

### 3. Incident Room: vom Alarm zum dokumentierten Vorfall

Ein fehlgeschlagener Monitorcheck kann einen Vorfall vorschlagen. Der Arbeitsraum zeigt Messwerte, zugeordnete Systeme, Abhängigkeiten, zuständige Kontakte und ein passendes Runbook. Untersuchungsschritte und Entscheidungen landen in einer Zeitleiste. Nach Abschluss entsteht ein Bericht mit überprüfbaren Fakten, offenen Ursachenfragen und Folgeaufgaben. Erster Umfang ohne Serversteuerung: Vorfall, Timeline und manuell gestartetes Runbook. Für schnelle automatische Erkennung braucht es einen häufigeren externen Scheduler beziehungsweise Worker.

### 4. Infrastructure Atlas: interaktive Karte der eigenen IT

Systeme, Dienste, Domains und Kunden werden mit Beziehungen dargestellt: „läuft auf“, „nutzt“, „gehört zu“. Ein Ausfall hebt die erfassten abhängigen Dienste hervor; ein Zeitregler zeigt spätere historische Zustände, sobald Änderungsdaten existieren. Einstieg mit manuellem Inventar und Monitor-Verknüpfungen, ohne automatische Netzwerkerkennung. Abhängigkeiten und Messwerte getrennt darstellen; eine Karte ist keine bewiesene Ursachenanalyse.

### 5. Runbook Studio: ausführbare Arbeitsanleitungen

Aus der Befehlsbibliothek entstehen Abläufe mit Parametern, Erklärungen, Checklisten, erwarteten Ergebnissen und Rückfallplan. Nutzer kopieren Befehle, fügen bereinigte Ergebnisse ein und protokollieren den Fortschritt. Beispiel: Zertifikat erneuern, Konfiguration prüfen, Dienst neu laden, Healthcheck dokumentieren. Später kann ein gesonderter lokaler Agent ausgewählte Schritte ausführen. Vercel allein liefert keinen sicheren direkten Zugriff auf private Server oder dauerhafte SSH-Sitzungen.

### 6. Scenario Lab: das eigene Trainingszentrum

Fiktive Störungen mit glaubwürdigen Logs, Netzplänen und simulierten Terminalantworten: DNS defekt, Zertifikat abgelaufen, Backup unbrauchbar. Jede Entscheidung beeinflusst den Verlauf. Auswertung bewertet Diagnose, Nachweise und gewählte Maßnahmen. Besonders passend für FiSi-Ausbildung und persönliche Übung. Zunächst deterministische Simulationen statt echter Shell; später isolierte Labs außerhalb des Vercel-Request-Lebenszyklus. Als langfristige Erweiterung lassen sich bereinigte echte Vorfälle in Übungen verwandeln.

### 7. Flow Builder: eigene Regeln zwischen den Modulen

Auslöser, Bedingung, Aktion: „Buchung eingegangen → Kontakt zuordnen → Vorbereitungsaufgabe erstellen“ oder „Zertifikat läuft bald ab → Aufgabe und Hinweis anlegen“. Start mit kleinen getesteten Vorlagen, danach grafischer Editor. Dauerhafte Ausführung benötigt gespeicherte Jobs, Wiederholungsregeln, Idempotenz, Begrenzungen und einen Verlauf. Externe Schreibaktionen erhalten eine explizite Freigaberegel; eine KI-Antwort allein löst sie nicht aus.

### 8. Arbeitsgedächtnis: Zeitleiste, Wiederaufnahme und gezieltes Undo

Vom Nutzer ausdrücklich als fester V2-Schwerpunkt ausgewählt: „Thema Gedächtnis will ich auf jeden Fall“. Die Zusage betrifft das übergreifende Produktkonzept; einzelne Ausbaustufen sind noch zu priorisieren.

Jede relevante Änderung wird mit Herkunft und Zeitpunkt sichtbar. Eine unterbrochene Mission kann den letzten Arbeitsstand und offene Fragen wiederherstellen. Ein ausgewählter geänderter Titel oder verschobener Task lässt sich später anhand einer Version rückgängig machen. Start mit Notizversionen und Aufgabenhistorie. Das Wiederherstellen externer Mails oder Infrastrukturzustände wird nicht als universelles Undo versprochen.

Das Gedächtnis umfasst auch ein durchsuchbares Archiv abgeschlossener Missionen mit Ausgangslage, Entscheidungen, zugehörigen Quellen, Ergebnissen und offenen Nacharbeiten. Beim Wiederaufnehmen eines Vorhabens lässt sich der letzte dokumentierte Stand nachvollziehen. Zeitliche Ansichten und Vergleiche können auf künftig gespeicherten Versionen aufbauen; frühere, nicht erfasste Zustände lassen sich nicht nachträglich vollständig rekonstruieren.

Erinnerungen müssen auf gespeicherte Originalquellen verweisen; Zusammenfassungen bleiben als abgeleitete Inhalte erkennbar. Nutzer bestimmen, was aufgenommen, aufbewahrt und gelöscht wird. Berechtigungen gelten auch für Historien und Suchergebnisse; das Gedächtnis darf keine entzogenen Raumfreigaben umgehen. Vault-Klartexte und heimliche Browseraufzeichnungen gehören nicht dazu. Status: ausgewählt und geplant, noch nicht implementiert.

### 9. Universal Capture: aus Rohmaterial entsteht strukturierte Arbeit

Ein gemeinsamer Eingang nimmt Text, URLs, Screenshots oder Sprachnotizen auf. Nutzer erhalten überprüfbare Vorschläge für Notiz, Aufgabe, Kontakt oder Termin, samt Quelle und Mission. Beispiel: „Freitag Firewall bei Müller prüfen, Frau Weber vorher anrufen“ wird als verknüpfter Entwurf gezeigt; unklare Daten werden markiert. Einstieg mit Text/URL, danach OCR und Transkription mit wählbarer Verarbeitung und Aufbewahrung.

### 10. Change Preview: Änderungen und Folgen vorab betrachten

Aus einer Mission oder einem Runbook entsteht ein Änderungsplan: betroffene Systeme, erfasste Abhängigkeiten, Prüfschritte und Rückfallplan. Beispiel: DNS-Wechsel zeigt betroffene Mail-/Webdienste und fehlende Nachweise. Ein späterer Abgleich mit aktuellen Konfigurationen kann Abweichungen markieren. Keine Garantie, Produktionsfolgen vollständig vorherzusagen; die Qualität hängt von Inventar und Datenfrische ab. Dieser Ausbau nutzt Atlas und Runbook Studio gemeinsam.

### 11. Projektbezogene Neon-Überwachung im Uptime-Modul

Vom Nutzer ausdrücklich zur V2-Ideenliste hinzugefügt. Das bestehende Uptime-Modul wird um eine gemeinsame Betriebsübersicht je OMNIDESK-Projekt erweitert. Website-/API-Monitore und die zugeordnete Neon-Datenbank erscheinen zusammen; das OMNIDESK-Projekt wird dafür eindeutig mit Neon-Projekt, Branch und gegebenenfalls Compute verknüpft.

Geplanter Funktionsumfang:

- Bestehende HTTP-/TCP-Monitore mit Status, Antwortzeit und Verlauf einem Projekt zuordnen.
- Unterstützte Neon-Metadaten und Messwerte abrufen, beispielsweise Compute-Status, Branches sowie Speicher- und Verbrauchswerte. Die konkrete Verfügbarkeit ist vor Umsetzung anhand aktueller Neon-Schnittstellen und Tarifrechte zu prüfen.
- Optional eine kleine lesende Datenbank-Prüfabfrage für Funktionsfähigkeit und Abfragelaufzeit ausführen. API-Erreichbarkeit, Compute-Status und erfolgreiche Datenbankabfrage getrennt anzeigen.
- Eine Projektübersicht mit Einzelstatus, Zeitpunkt der letzten erfolgreichen Aktualisierung, Messhistorie und konfigurierbaren Warnschwellen anbieten. Fehlende oder veraltete Messungen als unbekannt beziehungsweise veraltet kennzeichnen.
- Beispiel: „OMNIDESK Produktion“ zeigt Website, Hono-API und zugehörige Neon-Datenbank gemeinsam, inklusive verfügbarer Verbrauchsentwicklung.

Neon-Werte werden über unterstützte APIs und bei Bedarf gezielte Postgres-Abfragen eingebunden. Eine unveränderte Übernahme sämtlicher Neon-Konsolendiagramme oder bestehender Alarmregeln wird nicht vorausgesetzt; dafür müsste Neon passende Schnittstellen bereitstellen. Zugangsdaten bleiben im Backend, mit möglichst eingeschränkten Rechten und nutzerbezogener Zugriffskontrolle. Es werden keine beliebigen Tabelleninhalte automatisch übernommen.

Für häufige Hintergrundprüfungen muss die bisher täglich geplante Vercel-Ausführung um eine passende Scheduler-/Worker-Lösung ergänzt werden. Intervalle für Verbrauchswerte und Funktionschecks werden getrennt konfiguriert. Datenbank-Prüfabfragen können einen ruhenden Compute aufwecken und Verbrauch erzeugen; Rate-Limits, Aufbewahrung der Historie und laufende Kosten gehören zur Planung.

Erster sinnvoller Umfang: Projektzuordnung, Anzeige unterstützter Neon-Statusdaten, optionaler lesender Funktionscheck und gemeinsame Statuskarten. Danach Historien, Verbrauchsdiagramme und Benachrichtigungen. Status: festgehaltene Produktidee, noch nicht implementiert oder gegen Neon verifiziert.

### 12. Kommandoebene im Browser

Vom Nutzer ausdrücklich für die V2-Planung ausgewählt. Eine Browser-Erweiterung macht OMNIDESK auf bewusst freigegebenen Webseiten über ein Panel oder Overlay erreichbar. Nutzer können ausgewählte Textpassagen mit Quelle speichern, seitenbezogene Anmerkungen hinterlegen und Inhalte einer Mission zuordnen. Beim erneuten Besuch einer Seite sind die eigenen Anmerkungen wieder erreichbar.

Erster sinnvoller Umfang: Erweiterung für einen zunächst festzulegenden Browser, bewusstes Öffnen per Schaltfläche oder Shortcut, Übernahme von URL/Titel und ausgewähltem Text, persönliche Seitenanmerkungen und Missionszuordnung. Zugriff auf Seiten erfolgt nur mit passenden, möglichst eng begrenzten Berechtigungen; keine pauschale Hintergrundaufzeichnung des Browserverlaufs. Anmeldung und Synchronisation mit OMNIDESK werden ausdrücklich eingerichtet. Geänderte Seiten und eingeschränkte Browserseiten müssen verständlich behandelt werden; Textmarkierungen können nach Seitenänderungen ihre genaue Position verlieren.

Spätere optionale Ausbaustufen sind gespeicherte Seitenstände und deren Vergleich. Diese sind nicht Voraussetzung für die erste Version. Status: ausgewählte V2-Funktion, noch nicht implementiert; Browserunterstützung und Verteilung der Erweiterung sind vor Umsetzung festzulegen.

### 13. Temporäre gemeinsame Räume

Vom Nutzer ausdrücklich für die V2-Planung ausgewählt. Aus einer Mission oder unabhängig davon entsteht ein begrenzter gemeinsamer Raum, beispielsweise für eine Kundenübergabe, einen Urlaub oder eine Veranstaltung. Eingeladene Personen sehen ausschließlich die ausdrücklich für diesen Raum freigegebenen Inhalte, nicht den persönlichen OMNIDESK-Bereich.

Mögliche Bausteine: gemeinsame Listen, Dateien, Termine, Abstimmungen und eine Pinnwand. Erster sinnvoller Umfang: Raum erstellen, Teilnehmer einladen, Rollen für Lesen/Bearbeiten festlegen, gemeinsame Liste und Pinnwand nutzen sowie Raum schließen oder ablaufen lassen. Dateifreigaben, Abstimmungen und weitere Bausteine folgen schrittweise; sicherer gemeinsamer Dateispeicher ist im bisherigen lokalen Notiz-Anhangssystem noch nicht vorhanden.

Eine Mission kann einen ausgewählten Ausschnitt für einen Raum bereitstellen. Vor Freigabe muss sichtbar sein, welche Inhalte geteilt werden. Ob Inhalte als Kopie oder live verknüpft geteilt werden, ist vor Implementierung eindeutig festzulegen. Zugriffe werden serverseitig je Raum und Objekt geprüft; Einladungen sind widerrufbar und gegebenenfalls zeitlich begrenzt. Ablauf beendet weiteren Zugriff, kann bereits heruntergeladene Kopien aber nicht zurückholen. Aufbewahrung und Löschung von Rauminhalten sowie Gastzugang sind vor Umsetzung zu definieren.

Status: ausgewählte V2-Funktion, noch nicht implementiert. Mission Control liefert den internen Kontext; der gemeinsame Raum ist die bewusst freigegebene Zusammenarbeit mit anderen.

### 14. Omni-Briefing beim Öffnen der App

Vom Nutzer ausdrücklich für V2 ausgewählt. Diese Idee ersetzt den zuvor vorgeschlagenen personalisierten Live-Schreibtisch: Beim Öffnen der App erscheint eine persönliche Zusammenfassungsnachricht von Omni über den aktuellen Arbeitsstand. Kein zusätzlicher frei gestaltbarer Live-Schreibtisch ist damit beauftragt.

Das Briefing berücksichtigt offene, heute fällige und überfällige Aufgaben, aktive und sonstige offene Projekte sowie bevorstehende Termine. Weitere sinnvolle Bereiche sind Änderungen seit dem letzten Besuch, offene Punkte aus Missionen und wichtige Monitor-/Neon-Meldungen. Welche zusätzlichen Bereiche dazugehören, bleibt konfigurierbar und wird noch konkretisiert. Pausierte Projekte werden von aktiven unterschieden; persönliche Aufgaben und Projektaufgaben dürfen nicht doppelt gezählt werden.

Jede Aussage verlinkt auf die zugrunde liegenden Daten. Fakten wie Termine, Status und Fälligkeiten werden strukturiert ermittelt; Omnis Priorisierungsvorschläge sind als Empfehlungen erkennbar. Fehlende Datenquellen erscheinen als nicht verfügbar, nicht als „keine offenen Punkte“. Zeitangaben verwenden die Nutzerzeitzone, bei diesem Nutzer Europe/Berlin.

Beim Öffnen ist ein datiertes Briefing sichtbar. Datenfrische prüfen und bei relevanten Änderungen aktualisieren; keine neue kostenpflichtige KI-Anfrage bei jedem Modulwechsel. Manueller Refresh und eine verständliche Faktenübersicht bei KI-Ausfall sind vorzusehen. Private Inhalte aus gesperrten Räumen oder Vault-Klartexte bleiben ausgeschlossen. Status: ausgewählte V2-Funktion, noch nicht implementiert.

### 15. Persönliches Internet-Radar

Vom Nutzer ausdrücklich für V2 ausgewählt und zur weiteren Ausarbeitung vorgesehen. Ein persönlicher Feed verfolgt bewusst gewählte Themen, Tools und Quellen: beispielsweise GitHub-Releases, Herstellerblogs, Sicherheitsmeldungen, RSS und Statusseiten. Quellenzugang, Aktualisierungsintervalle und verfügbare Schnittstellen sind vor Umsetzung zu prüfen.

Erster sinnvoller Umfang: Quellen und Themen auswählen, neue Meldungen gesammelt lesen, nach Kategorien filtern und einzelne Meldungen speichern oder einer Mission zuordnen. Meldungen zeigen Originalquelle, Veröffentlichungsdatum, Abrufzeit und gegebenenfalls betroffene Versionen. Doppelte Berichte werden gruppiert, während unterschiedliche Quellen nachvollziehbar bleiben. Externe Inhalte gelten als untrusted Daten und dürfen keine Aktionen autorisieren.

Vorschläge zur Erweiterung, noch nicht einzeln vom Nutzer bestätigt:

- Relevanz zu Projekten und bewusst hinterlegten Tools anzeigen: „Warum betrifft mich diese Meldung?“ Für Versionsbezug werden tatsächlich eingesetzte Versionen benötigt; unbekannte Versionen dürfen nicht als nachweislich betroffen dargestellt werden.
- Meldungen nach Sicherheitswarnung, Release, Störung und allgemeiner Neuigkeit unterscheiden; Themen stummschalten und Benachrichtigungsschwellen wählen.
- Ausgewählte wichtige Radar-Meldungen in das Omni-Briefing aufnehmen, getrennt von eigenen Aufgaben und Terminen.
- Interessante Inhalte mit Quellenbezug im Gedächtnis ablegen. Speichern eines Links und Archivieren eines vollständigen Inhalts klar unterscheiden.

Keine pauschale Überwachung aller Webseiten und keine garantierte Vollständigkeit von Sicherheitsmeldungen. Status: Grundidee ausgewählt; Erweiterungen sind Planungsvorschläge, keine implementierten Funktionen.

### 16. OneDrive als zusätzliche Cloud-Integration

Vom Nutzer ausdrücklich für V2 ausgewählt: Ein eigenes OneDrive-Konto soll neben Google Drive und MEGA mit OMNIDESK verbunden werden können. Dies ist die achte ausgewählte größere V2-Funktion; die Nummerierung dieser Ideensammlung enthält zusätzlich nicht ausgewählte Vorschläge.

Geplanter erster Umfang: Microsoft-Anmeldung über OAuth, Anzeige des verbundenen Kontos unter Integrationen, Abruf der verfügbaren Speicher-/Quota-Werte und Synchronisationsstatus im Cloud-Monitoring sowie Berücksichtigung im bestehenden Cloud-Speicher-Widget. Konto trennen und abgelaufene oder entzogene Berechtigungen verständlich behandeln. Microsoft Graph ist die vorgesehene Schnittstelle; unterstützte Kontotypen, tatsächliche Quota-Verfügbarkeit und minimale Berechtigungen sind anhand der aktuellen Dokumentation zu prüfen. Ziel ist zunächst das persönliche OneDrive-Konto des Nutzers; Organisationskonten sind nicht automatisch mit zugesagt.

Vor Umsetzung sind eine passende Microsoft-App-Registrierung, Redirect-URIs und sichere serverseitige Tokenverwaltung einzurichten. Anmeldetransaktionen müssen gegen Manipulation und Wiederverwendung geschützt werden. Zugangsdaten gehören nicht in Browser-Bundles oder die Planungsdatei. Dateibrowser, Upload, Download und SharePoint-Unterstützung sind nicht Teil des bisher ausgewählten Umfangs und können später separat geplant werden.

Status: ausgewählte V2-Erweiterung, noch nicht implementiert oder mit einem Microsoft-Konto getestet.

### 17. Mail-Modul vollständig entfernen

Vom Nutzer ausdrücklich als V2-Änderung ausgewählt: Das Mail-Modul wird als überflüssig angesehen und soll vollständig entfallen. Dies ist die neunte ausgewählte größere V2-Änderung. Die aktuelle Arbeit hält diese Entscheidung in der Planung fest; Anwendungscode wird in dieser Planungsrunde nicht entfernt.

Geplanter Umfang: Mail aus Modul-Registry, Navigation und Routing entfernen; Mail-Oberflächen, ausschließlich für Mail verwendete API-Routen, Demo-Speicher und Abhängigkeiten bereinigen. Gemeinsame Infrastruktur bleibt erhalten, soweit andere Funktionen sie benötigen. Insbesondere Google-OAuth, Kontoverwaltung, Token-Refresh und Google-Drive-Quota-Monitoring dürfen nicht versehentlich entfernt werden. Gmail-spezifische OAuth-Scopes werden aus künftigen Autorisierungen entfernt; bestehende Einwilligungen werden dadurch nicht automatisch beim Anbieter widerrufen.

Konsequenz für die übrige V2-Planung: Briefing, Gedächtnis, Mission Control und andere Funktionen dürfen keinen integrierten Mailzugriff voraussetzen. Frühere Mail-Beispiele und mailbasierte Ablaufvorschläge in dieser Ideensammlung sind damit überholt, keine weiterhin beschlossenen Anforderungen. Externe Mail-Links können bei Bedarf wie normale Links behandelt werden; eine Ersatz-Mailintegration ist nicht beauftragt.

Bei Umsetzung sind verbleibende Verweise, gemeinsame Importpfade und Dokumentation zu prüfen sowie Build, Typprüfung und Google-Drive-Kontoverbindung/-Synchronisation zu validieren. Private Kontodaten oder gemeinsam verwendete Tokens werden nicht pauschal gelöscht. Status: beschlossene V2-Entfernung, noch nicht implementiert.

### 18. Deployment-Zentrale

Am 18. Oktober 2026 vom Nutzer ausdrücklich als zehnte V2-Änderung ausgewählt. Vercel-Projekte werden mit OMNIDESK-Projekten verknüpft. Eine gemeinsame Ansicht zeigt laufende Produktionsversion, Vorschau-Deployments, Build-/Deployment-Status, Veröffentlichungszeitpunkte und verfügbare zugehörige Commit-Informationen. Fehlgeschlagene Builds lassen sich mit den über die unterstützten Schnittstellen zugänglichen Logs untersuchen.

Die Verbindung zu Uptime und Neon ermöglicht eine zeitliche Gegenüberstellung von Deployments, Erreichbarkeitsproblemen und Datenbankstatus. Ein zeitlicher Zusammenhang wird nicht als bewiesene Fehlerursache dargestellt. Wichtige Änderungen können im Omni-Briefing erscheinen und mit Quellenbezug im Gedächtnis beziehungsweise einer Mission festgehalten werden.

Erster sinnvoller Umfang: lesende Vercel-Anbindung, Projektzuordnung, klare Trennung von Produktion und Vorschau, Deployment-Historie sowie verfügbare Build-Logs. Schnittstellen, Tarifrechte, Aufbewahrung und Aktualisierungsintervalle sind vor Umsetzung zu prüfen. Logs können sensible Informationen enthalten; Zugriff und Darstellung müssen entsprechend geschützt werden. Zugangsdaten bleiben im Backend. Erneutes Bereitstellen, Rollback oder andere schreibende Produktionsaktionen sind optionale spätere Ausbaustufen und nicht durch die Auswahl der lesenden Zentrale automatisch autorisiert.

Status: fest für V2 ausgewählt, noch nicht implementiert oder mit Vercel getestet.

### 19. Persönliche Sicherheitsübersicht der Konten

Am 18. Oktober 2026 vom Nutzer ausdrücklich als elfte V2-Änderung ausgewählt. Eine persönliche Übersicht dokumentiert wichtige eigene Konten und deren Absicherung: Passkeys, Zwei-Faktor-Anmeldung, Wiederherstellungswege und das Vorhandensein gesicherter Wiederherstellungscodes. Fehlende Angaben werden von tatsächlich fehlenden Sicherheitsmaßnahmen unterschieden. Manuell dokumentierte Angaben erhalten einen Prüfzeitpunkt und dürfen nicht als automatisch verifizierter Kontostatus erscheinen.

Erster sinnvoller Umfang: Konten erfassen, Wichtigkeit und Absicherungsmerkmale dokumentieren, Lücken filtern sowie überprüfbare Hinweise im Omni-Briefing anzeigen. Die Funktion ist unabhängig vom zur Entfernung vorgesehenen Mail-Modul; eine erfasste E-Mail-Adresse ist kein Zugriff auf das Postfach. Eine Verknüpfung zu vorhandenen Vault-Einträgen kann später helfen, ohne deren entschlüsselte Inhalte in die Übersicht, das Gedächtnis oder KI-Anfragen zu übernehmen.

Als gesondert zu prüfender Ausbau kommen Datenleck-Abfragen über einen geeigneten Anbieter für ausdrücklich bestätigte eigene E-Mail-Adressen infrage. Verfügbarkeit, Kosten, Verifikation und die dabei notwendige Weitergabe einer Adresse werden vor Aktivierung geklärt. Passwörter werden dafür nicht an einen Dienst übermittelt. Direkte automatische Prüfung der Sicherheitseinstellungen beliebiger Fremdkonten wird nicht versprochen; dies hängt von unterstützten Anbieter-Schnittstellen ab.

Status: fest für V2 ausgewählt, noch nicht implementiert. Die Übersicht liefert nachvollziehbare Angaben und Hinweise, keine Garantie umfassender Kontosicherheit.

### 20. GitHub-Zentrale

Am 18. Oktober 2026 vom Nutzer ausdrücklich als zwölfte V2-Änderung ausgewählt. GitHub-Repositories werden mit OMNIDESK-Projekten verknüpft. Die Übersicht zeigt zugängliche Issues, Pull Requests, GitHub-Actions-Läufe und Releases einschließlich Status, Aktualisierungszeit und Links zum Original.

Zusammen mit Deployment-Zentrale, Uptime und Neon lässt sich der Weg von einer Codeänderung über Build und Vercel-Deployment bis zum beobachteten Betriebszustand nachvollziehen. Die Zuordnung soll nach Möglichkeit über Repository-, Commit- und Deployment-Identitäten erfolgen; fehlende Zuordnungen werden offengelegt und zeitliche Nähe nicht als bewiesene Fehlerursache dargestellt.

Erster sinnvoller Umfang: lesende GitHub-Anbindung, explizite Repository-Auswahl, Projektzuordnung und Anzeige der genannten Bereiche. Authentifizierung, minimale Repository-Berechtigungen, Rate-Limits und Zugang zu privaten beziehungsweise Organisations-Repositories sind anhand der unterstützten Schnittstellen zu prüfen. Die im Entwicklungscontainer vorhandene Git-Proxy-Authentifizierung ersetzt keine GitHub-API-Anmeldung der produktiven OMNIDESK-App. Geheimnisse bleiben im Backend; Repository-Inhalte und Ergebnisse sind nutzerbezogen zu schützen.

Schreibende Aktionen wie Issues erstellen, Pull Requests zusammenführen, Workflows starten oder Code pushen sind nicht Teil des zunächst ausgewählten lesenden Umfangs. Optionale Webhooks können Aktualisierungen liefern, benötigen aber eine abgesicherte Verarbeitung. Status: fest für V2 ausgewählt, noch nicht implementiert oder mit GitHub getestet.

### 21. Kontenkarte: Verbindungen und Abhängigkeiten sichtbar machen

Am 18. Oktober 2026 vom Nutzer ausdrücklich als dreizehnte V2-Änderung ausgewählt. Eine persönliche Kontenkarte zeigt Beziehungen zwischen eigenen Konten: Anmeldung über Google/Microsoft oder einen anderen Identitätsanbieter, hinterlegte Wiederherstellungsadresse und bewusst dokumentierte weitere Wiederherstellungswege. Beispiel: Welche Zugänge hängen an einem bestimmten Google-Konto und könnten bei dessen Verlust betroffen sein?

Erster sinnvoller Umfang: Konten und typisierte, gerichtete Verbindungen manuell erfassen, Beziehungen als Karte und zugängliche Liste anzeigen sowie direkte und indirekte Abhängigkeiten eines ausgewählten Kontos hervorheben. Eine reine Wiederherstellungsadresse ist von einem tatsächlich notwendigen Anmeldeweg zu unterscheiden. Alternative Anmeldemethoden, sofern dokumentiert, werden berücksichtigt; die Karte darf nicht jede Verbindung als zwangsläufigen Zugangsverlust darstellen. Nicht geprüfte oder unvollständige Angaben sind entsprechend markiert und erhalten einen Aktualisierungszeitpunkt.

Die Kontenkarte ergänzt die bereits ausgewählte Sicherheitsübersicht: Diese dokumentiert die Absicherung einzelner Konten, die Karte stellt deren Beziehungen und mögliche Ausfallfolgen dar. Ein gemeinsames Kontenmodell vermeidet doppelte Pflege. Erster Aufbau ohne Zugriff auf fremde Kontoeinstellungen; automatische Ergänzungen nur bei tatsächlich unterstützten, ausdrücklich autorisierten Schnittstellen. Die Google-Anmeldung bei OMNIDESK gewährt keinen allgemeinen Überblick über alle anderen mit Google verbundenen Dienste.

Keine Passwörter, Wiederherstellungscodes oder Vault-Klartexte in Graphbeschriftungen, KI-Kontext oder Gedächtnis übernehmen. Die Karte ist privat; Freigabe über gemeinsame Räume erfolgt nicht automatisch. Status: fest für V2 ausgewählt, noch nicht implementiert. Eine automatische Änderung von Anmelde- oder Wiederherstellungseinstellungen ist nicht beauftragt.

### 22. Uptime-Modul: Abstand zu Sidebar und Seitenrändern korrigieren

Am 18. Oktober 2026 anhand eines Screenshots vom Nutzer bestätigt und ausdrücklich zur Planungsdatei hinzugefügt. Der Inhalt des Uptime-Moduls sitzt zu dicht an der Sidebar, am rechten Seitenrand beziehungsweise der Scrollleiste und am oberen Rand. Geplant ist ausschließlich eine gezielte Layoutkorrektur: ein gemeinsamer responsiver Innenabstand um die gesamte Modulansicht, als Richtwert etwa 24–32 px auf Desktop und 16 px auf Mobilgeräten. Überschrift, Kennzahlen, Suche/Filter und Monitorkarten sollen an gemeinsamen Außenkanten ausgerichtet sein.

Das bestehende OMNIDESK-Design bleibt erhalten: kein allgemeines Redesign, keine Änderung von Farben, Glow-Effekten, Sidebar-Gestaltung oder Kartenstil im Rahmen dieses Punkts. Die endgültigen Abstände werden bei der später ausdrücklich beauftragten Umsetzung im bestehenden Layout geprüft; horizontales Überlaufen ist zu vermeiden. Status: als vierzehnte V2-Änderung festgehalten, noch nicht implementiert. Änderungen am Anwendungscode sind in dieser Planungsphase nicht beauftragt.

### 23. Omni kann Aktionen ausführen

Am 18. Oktober 2026 vom Nutzer ausdrücklich als fünfzehnte V2-Änderung ausgewählt. Omni soll auf Nutzeranweisung unterstützte Aktionen innerhalb von OMNIDESK tatsächlich ausführen können, statt lediglich Anleitungen oder Vorschläge zu liefern. Beispiele: aus einer ausgewählten Notiz drei Aufgaben anlegen, einen Termin mit eindeutigem Datum erstellen oder eine Notiz zusammenfassen und das Ergebnis auf Wunsch speichern. Dies erweitert das bisher ausgewählte lesende Omni-Briefing um eine eigene Handlungsebene.

Erster sinnvoller Umfang: klar definierte Aktionen für Aufgaben, Termine und Notizen. Parameter werden gegen Schemas validiert; Berechtigungen prüft das Backend für jedes betroffene Objekt. Bei fehlenden oder mehrdeutigen Pflichtangaben fragt Omni gezielt nach. Datum und Uhrzeit berücksichtigen die Nutzerzeitzone. Ergebnisse verlinken auf die tatsächlich angelegten oder geänderten Einträge. Fehlgeschlagene beziehungsweise teilweise ausgeführte Aktionen werden als solche gemeldet; Wiederholungen dürfen nicht unbeabsichtigt Duplikate erzeugen.

Eine eindeutige Nutzeranweisung kann eine unterstützte, risikoarme interne Aktion direkt auslösen. Vorschau und ausdrückliche Bestätigung sind für destruktive, umfangreiche oder externe Aktionen vorzusehen. Welche Aktionen dazugehören, wird vor Umsetzung festgelegt. Die Planung autorisiert weder produktive Deployments, GitHub-Merges, Datenbankadministration noch Freigaben an andere automatisch. Inhalte aus Webseiten, Radar-Meldungen oder Dokumenten sind Daten und dürfen selbst keine Aktionen autorisieren. Vault-Klartexte werden nicht an die KI übermittelt. Das entfernte Mail-Modul wird hierfür nicht wieder eingeführt.

Status: fest für V2 ausgewählt, noch nicht implementiert. Die Anweisung in dieser Planungsrunde betrifft die Dokumentation der Fähigkeit, nicht deren jetzige Umsetzung oder Ausführung.

### Abgleich mit der alten Planungsdatei: ausdrücklich nicht übernehmen

Nach Analyse von OMNIDESK_NEUE_MODULE_PLANUNG.txt hat der Nutzer die folgenden sieben übrigen Vorschläge aus Abschnitt 8 ausdrücklich abgelehnt: Ziel-Tracker, Netzwerk-Dokumentation mit Patchplänen/Rack-Diagrammen, Lizenz-/Abo-Tracker, Ping-/Speedtest-Historie, vollständiges Backup-/Export-Paket, zusätzliche globale Tastaturkürzel und Vollbild-Fokusansicht. Diese werden nicht in die ausgewählte V2-Liste aufgenommen. Bereits vorhandene Sicherungs- und Shortcut-Funktionen werden dadurch nicht zur Entfernung beauftragt.

Überschneidungen mit bereits ausgewählten Funktionen erzeugen keine zusätzlichen Anforderungen. Die aktuelle gemeinsame Planung hat Vorrang vor alten Vorschlägen und historischen Anweisungen im Anhang. Insbesondere ist der in dieser Analyse zuvor empfohlene vollständige Backup-Ausbau nach dieser Entscheidung kein ausgewähltes V2-Paket.

## Fest ausgewählte V2-Änderungen

Diese Liste ist der verbindliche Auswahlstand der Planung; weitere nummerierte Ideen in diesem Dokument sind keine automatisch ausgewählten Anforderungen. Auswahlstand: 18. Oktober 2026. Die Umsetzung begann am 19. Oktober 2026; der aktuelle Stand wird im Entwicklungsprotokoll unten dokumentiert. Historische Statusangaben in den Planungsabschnitten beschreiben den Zeitpunkt der Auswahl.

1. Mission Control.
2. Projektbezogene Neon-Überwachung im Uptime-Modul.
3. Kommandoebene im Browser.
4. Temporäre gemeinsame Räume.
5. Arbeitsgedächtnis und Missionsarchiv.
6. Omni-Briefing beim Öffnen der App.
7. Persönliches Internet-Radar.
8. OneDrive-Integration.
9. Mail-Modul vollständig entfernen, Google Drive erhalten.
10. Deployment-Zentrale.
11. Persönliche Sicherheitsübersicht der Konten.
12. GitHub-Zentrale.
13. Kontenkarte mit Anmelde- und Wiederherstellungsabhängigkeiten.
14. Uptime-Layout: mehr Abstand zu Sidebar, oberem und rechtem Seitenrand; bestehendes Design beibehalten.
15. Omni kann auf Nutzeranweisung unterstützte Aktionen ausführen, zunächst für Aufgaben, Termine und Notizen.

## Priorisierung

| Paket | Wert | Relativer Aufwand | Empfehlung |
|---|---|---|---|
| Mission Control + gemeinsame Beziehungen | Sehr hoch, täglich | Mittel bis groß | Als V2-Kern beginnen |
| Projektbezogene Neon-Überwachung im Uptime-Modul | Hoch für den Betrieb eigener Projekte | Mittel bis groß | Vom Nutzer gewünschte V2-Idee; API-/Tarifprüfung vor Umsetzung |
| Kommandoebene im Browser | Hoch für Recherche und seitenbezogenes Wissen | Mittel bis groß | Vom Nutzer für V2 ausgewählt |
| Temporäre gemeinsame Räume | Hoch für Zusammenarbeit privat und mit Kunden | Groß | Vom Nutzer für V2 ausgewählt; auf Freigabe- und Rollenmodell aufbauen |
| Omni-Briefing beim Öffnen der App | Hoch, täglicher Einstieg | Mittel bis groß | Vom Nutzer für V2 ausgewählt; ersetzt die Live-Schreibtisch-Idee |
| Persönliches Internet-Radar | Hoch für individuell relevante Neuigkeiten | Mittel bis groß | Vom Nutzer für V2 ausgewählt; Erweiterungen gemeinsam konkretisieren |
| OneDrive-Integration | Hoch für die eigenen Cloud-Konten | Mittel | Vom Nutzer als achte V2-Funktion ausgewählt; zunächst Kontoverbindung und Cloud-Monitoring |
| Mail-Modul entfernen | Vereinfachung der Anwendung | Klein bis mittel | Vom Nutzer als neunte V2-Änderung ausgewählt; Google Drive und gemeinsame OAuth-Infrastruktur erhalten |
| Deployment-Zentrale | Hoch für den Betrieb eigener Projekte | Mittel bis groß | Vom Nutzer als zehnte V2-Änderung ausgewählt; zunächst lesende Vercel-Anbindung |
| Persönliche Sicherheitsübersicht der Konten | Hoch für den persönlichen Überblick | Mittel bis groß | Vom Nutzer als elfte V2-Änderung ausgewählt; dokumentierte und verifizierte Angaben unterscheiden |
| GitHub-Zentrale | Hoch für die Entwicklung eigener Projekte | Mittel bis groß | Vom Nutzer als zwölfte V2-Änderung ausgewählt; zunächst lesend und mit der Deployment-Zentrale verknüpft |
| Kontenkarte | Hoch für den Überblick über Kontoabhängigkeiten | Mittel | Vom Nutzer als dreizehnte V2-Änderung ausgewählt; gemeinsames Kontenmodell mit der Sicherheitsübersicht |
| Uptime-Layout: äußere Abstände korrigieren | Gezielte Verbesserung der Lesbarkeit | Klein | Vom Nutzer als vierzehnte V2-Änderung bestätigt; ausschließlich planen, bestehendes Design erhalten |
| Omni führt Aktionen aus | Hoch für die direkte Bedienung der Anwendung | Groß | Vom Nutzer als fünfzehnte V2-Änderung ausgewählt; typisierte Aktionen und serverseitige Berechtigungsprüfung |
| Omni: Kontextsuche mit Quellen | Hoch | Mittel bis groß | Danach, an derselben Mission demonstrieren |
| Runbook Studio | Hoch für IT-Zielgruppe | Mittel | Frühes markantes Feature |
| Universal Capture, zunächst Text | Hoch | Mittel | Früher, gut abgrenzbarer Einstieg |
| Incident Room | Hoch für Betrieb/Support | Groß | Auf Missions- und Ereignismodell aufbauen |
| Infrastructure Atlas | Hoch bei echtem Inventar | Groß | Gemeinsam mit Incident Room erweitern |
| Arbeitsgedächtnis und Missionsarchiv | Hoch | Mittel bis groß | Vom Nutzer fest für V2 ausgewählt; Ereignisse früh speichern, Oberfläche schrittweise |
| Flow Builder | Hoch bei wiederholter Arbeit | Groß | Erst robuste Aktions-/Job-Infrastruktur |
| Scenario Lab | Stark für FiSi/Lernen | Groß | Eigenständige spätere V2-Ausbaustufe |
| Change Preview | Hoch bei guter Datenlage | Sehr groß | Langfristig auf Atlas und Runbooks |

Aufwand ist relativ eingeschätzt, keine Termin- oder Budgetzusage. KI-APIs, Speicher, häufiges Monitoring, externe Jobs und echte Labs können zusätzliche laufende Kosten erzeugen. Bestehende Free-Tier-Ziele müssen pro Ausbau erneut geprüft werden.

## Empfohlener erster durchgängiger Ablauf

Eine Kundenmail auswählen → Mission anlegen → Kontakt, Mail und bestehende Notiz verknüpfen → Omni schlägt drei belegte Aufgaben vor → Nutzer übernimmt zwei davon → passende Befehlsanleitung öffnen → Ergebnis und Folgeaufgabe dokumentieren → Mission später mit verständlichem Übergabestand fortsetzen.

Das demonstriert den Produktfortschritt besser als mehrere gleichzeitig halbfertige neue Module.

## Technischer Weg

1. Verlässlichkeit: Demo-/Echtstatus trennen, OAuth-State härten, repräsentative Auth-/Berechtigungs-, Mailfehler- und Kernablauftests ergänzen. Chatkontext-Reihenfolge und Backup-Abdeckung korrigieren.
2. Verbindungen: Missionsmodell und typisierte, berechtigungsgeprüfte Beziehungen zwischen bestehenden Datensätzen; globalen und Projektaufgaben eine eindeutige Zuordnung geben. Gemeinsame Datenbank bedeutet noch keine gemeinsame Semantik.
3. Nachvollziehbarkeit: Ereignisse mit Besitzer, Objekt, Quelle, Zeitpunkt und Version speichern. Serveraktionen erhalten stabile IDs; spätere Wiederholungen dürfen keine doppelten Aufgaben/Mails erzeugen.
4. Kontext: zunächst Postgres-Volltextsuche und strukturierte Filter; Vektorsuche erst bei belegtem Bedarf. Quellenzugriff vor jedem Abruf prüfen, externen Text nicht als vertrauenswürdige Anweisung behandeln.
5. Aktionen: typisierte Vorschläge mit Schema-Validierung, Berechtigungsprüfung und kontrollierter Ausführung. Vorschau und Ergebnis müssen unterscheidbar sein.
6. Laufzeit: Frontend und kurze API-Aufrufe bleiben auf Vercel; lange Jobs, engmaschige Checks und private Infrastrukturzugriffe brauchen eine passende zusätzliche Laufzeit. Browserlokale Daten und cloudgespeicherte Daten klar kennzeichnen.

## Grenzen der Bewertung

Build, Typprüfung, Lint und lokale HTTP-Smokechecks wurden im vorausgehenden Setup erfolgreich geprüft; Lint hatte sieben Warnungen. Für diese Ideenanalyse wurden keine neuen Anwendungstests behauptet. In dieser Cloud-Instanz fehlen Clerk-/Neon-Konfigurationen; authentifizierte Datenflüsse und das laufende Vercel-Deployment wurden hier nicht umfassend getestet. Der Code und die vorhandenen historischen Testberichte sind getrennte Evidenzquellen.


## Entwicklungsprotokoll – 19. Oktober 2026

Erster Umsetzungsschritt ausschließlich in OMNIDESK-V2:

- Nr. 14: Uptime-Seite erhält gemeinsame responsive Außenabstände (16/24/32 px); vorhandenes Design bleibt erhalten.
- Nr. 9: Mail-Modul, Schnellaktion, Backend-Routen und prozessglobaler Mail-Demospeicher entfernt. Neue Google-Autorisierungen fragen keine Gmail-Berechtigungen mehr an. Gemeinsame Kontenverwaltung, Google Drive, MEGA und bestehende Tokens bleiben erhalten; keine Datenbankmigration.
- API-Build schreibt nun nach api/index.js, passend zum vorhandenen Vercel-Rewrite. Das zuvor versionierte generierte Catch-all-Bundle wurde entfernt, damit kein veralteter Mail-Code als zweiter Endpunkt bestehen bleibt.
- Regressionstests: `npx tsx --test tests/mail-removal.test.ts` prüft Drive-/Identitäts-Scopes ohne Gmail, erhaltene Cloud-/Callback-Routen sowie Healthcheck und Auth-Schutz. Drei Tests erfolgreich.
- Ein authentifizierter Google-Drive-Synchronisationstest und eine visuelle Browserprüfung konnten hier mangels lokaler Zugangskonfiguration nicht durchgeführt werden. Vercel-Livezugriff aus dieser Cloud ist weiterhin durch den Netzwerkproxy blockiert. Der Test des fertigen Deployments durch den Nutzer bleibt erforderlich.
- Die übrigen 13 ausgewählten V2-Punkte sind noch nicht umgesetzt. Das Original-Repository wird nicht verändert.
