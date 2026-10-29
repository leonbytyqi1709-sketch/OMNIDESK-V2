# OMNIDESK: Produktanalyse und V2-Konzept

Stand: 17. Oktober 2026. Analyse des bereitgestellten Checkouts, keine Änderung am Anwendungscode und kein Deployment. Grundlage: Modul-Registry, Frontend-Einstiegspunkte und gemeinsame Bedienoberflächen, API-Routen, Datenbankschemas, Integrationen, Build-/Deployment-Konfiguration, Spezifikation und Entwicklungsdokumentation. Keine vollständige authentifizierte Live-Prüfung und kein abgeschlossener Sicherheitsaudit. V2 bezeichnet hier das nächste Produktrelease; das bestehende Spezifikations-PDF heißt bereits V2.

## Verbindlicher Abschluss und verbleibende Arbeiten · 20.10.2026

Aktueller Stand vom 21.10.2026: Die Browser-Kommandoebene ist implementiert und vom Nutzer mit „Alles hat funktioniert“ für seinen eigenen Chrome live bestätigt. Temporäre gemeinsame Räume sind als erste Version mit Anmeldung, Rollen, Liste/Pinnwand, Einladungen, Ablauf und bewusst ausgewählten Projektkopien implementiert; ihre produktive Nutzung mit Testkonto wurde vom Nutzer nach weiteren Tests am 21.10.2026 bestätigt. Arbeitsgedächtnis, Änderungsverlauf, Arbeitsstände und Missionsarchiv wurden nach der Vorstellung am 21.10.2026 auf ausdrücklichen Nutzerwunsch entfernt und aus der weiteren Planung gestrichen. Der Nutzer nutzt dafür eigene Notizen und das Omni-Briefing und möchte kein Ersatzmodul. Das persönliche Omni-Gedächtnis und das Omni-Briefing bleiben erhalten. Der gemeinsame Rundgang und der vollständige App-Test werden mit den verbleibenden Funktionen fortgesetzt. OneDrive ist auf Nutzerwunsch vollständig aus der weiteren Planung gestrichen. Das Internet-Radar ist entfernt. Nach Abschluss der vereinbarten Änderungen bleibt der vollständige gemeinsame App-Test verbindlich.

Der Nutzer hat Mission Control nach Anmeldung live geprüft und bestätigt, dass Projekte und Verbindungen vollständig erscheinen. Die anschließende Layoutkorrektur wurde bereitgestellt und vom Nutzer mit „Perfekt gemacht“ bestätigt. Dies ersetzt keine separate, bisher unbestätigte Neon-Scheduler-Abnahme oder sonstige ausstehende Provider-Prüfungen. Der optionale Neon-SQL-Test bleibt auf Nutzerwunsch aus.

**Wichtige dauerhafte Nutzeranweisung:** Sobald alle vereinbarten Änderungen abgeschlossen sind, den Nutzer ausdrücklich an einen vollständigen Test der gesamten App erinnern. Gemeinsam alle Module, Modulverbindungen und zentralen Abläufe auf Fehler, Auffälligkeiten und Verbesserungsmöglichkeiten prüfen. Dies ist ein verpflichtender abschließender Arbeitspunkt, kein optionaler Nebensatz. Ein erfolgreicher Build oder einzelne Modultests ersetzen diesen Gesamttest nicht. Gefundene Auffälligkeiten dokumentieren und gemeinsam priorisieren. Den V2-Abschluss nicht mit einer vollständigen App-Abnahme gleichsetzen. Die Erinnerung erfolgt beim Abschluss der Änderungen im Gespräch; es ist kein zeitgesteuerter Benachrichtigungsdienst eingerichtet.

## Bestand und Chancen

**Ergänzender Abschlussauftrag · 21.10.2026:** Der Nutzer wünscht nach Abschluss aller vereinbarten Änderungen eine gemeinsame Vorstellung sämtlicher neuer Module und Verbesserungen. Je Bereich Zweck, Fundstelle, konkrete Bedienung und Verbindungen zu anderen Modulen erklären; anschließend gemeinsam den vollständigen App-Test durchführen und Auffälligkeiten festhalten. Bei den jetzigen angeleiteten Tests jeweils nur einen konkreten nächsten Schritt geben und das Ergebnis abwarten, da der Nutzer den Überblick verloren hat. Sein Screenshot belegt einen geöffneten gemeinsamen Raum mit Eingabeformular, keine abgeschlossene Raum- oder Mehrkonto-Abnahme.

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

### 8. Arbeitsgedächtnis – zurückgenommen

Der Nutzer nimmt diese Funktion am 21.10.2026 nach der Vorstellung ausdrücklich zurück: Er sieht keinen Nutzen, würde sie nicht verwenden und hält Arbeitsstände selbst fest; zudem nutzt er das Omni-Briefing. Änderungsverlauf, manuelle Arbeitsstände und Missionsarchiv werden einschließlich Modul, API, Querverweisen, Schemaexporten und eigenen Tests entfernt. Keine erneute Umsetzung oder Ersatzplanung ohne neuen ausdrücklichen Auftrag.

Bereits eingerichtete automatische Verlaufstrigger werden beim nächsten Zugriff auf Notizen, Aufgaben, Projekte oder bei bestätigten Omni-Aktionen deaktiviert. Bestehende Originale und Alttabellen/-daten werden nicht automatisch gelöscht. Der eigenständige Schutz vor veralteten Bearbeitungen und die serialisierten Notiz-Autosaves bleiben erhalten. Persönliches Omni-Gedächtnis und Omni-Briefing sind keine entfernten Bestandteile. Details: docs/ARBEITSGEDAECHTNIS.md.

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

Status 21.10.2026: Erste Version implementiert. Der Nutzer wählt ausdrücklich OMNIDESK-Anmeldung statt Gastzugang. Geteilte Projekttexte sind unabhängige Kopien nach Auswahl und Vorschau, keine Live-Verknüpfungen. Ablauf oder Schließen beendet den Teilnehmerzugriff; die Raumleitung behält eine schreibgeschützte Nachsicht bis zur ausdrücklich bestätigten Löschung. Details und produktive Mehrkonto-Abnahme: docs/GEMEINSAME-RAEUME.md.

### 14. Omni-Briefing beim Öffnen der App

Vom Nutzer ausdrücklich für V2 ausgewählt. Diese Idee ersetzt den zuvor vorgeschlagenen personalisierten Live-Schreibtisch: Beim Öffnen der App erscheint eine persönliche Zusammenfassungsnachricht von Omni über den aktuellen Arbeitsstand. Kein zusätzlicher frei gestaltbarer Live-Schreibtisch ist damit beauftragt.

Das Briefing berücksichtigt offene, heute fällige und überfällige Aufgaben, aktive und sonstige offene Projekte sowie bevorstehende Termine. Weitere sinnvolle Bereiche sind Änderungen seit dem letzten Besuch, offene Punkte aus Missionen und wichtige Monitor-/Neon-Meldungen. Welche zusätzlichen Bereiche dazugehören, bleibt konfigurierbar und wird noch konkretisiert. Pausierte Projekte werden von aktiven unterschieden; persönliche Aufgaben und Projektaufgaben dürfen nicht doppelt gezählt werden.

Jede Aussage verlinkt auf die zugrunde liegenden Daten. Fakten wie Termine, Status und Fälligkeiten werden strukturiert ermittelt; Omnis Priorisierungsvorschläge sind als Empfehlungen erkennbar. Fehlende Datenquellen erscheinen als nicht verfügbar, nicht als „keine offenen Punkte“. Zeitangaben verwenden die Nutzerzeitzone, bei diesem Nutzer Europe/Berlin.

Beim Öffnen ist ein datiertes Briefing sichtbar. Datenfrische prüfen und bei relevanten Änderungen aktualisieren; keine neue kostenpflichtige KI-Anfrage bei jedem Modulwechsel. Manueller Refresh und eine verständliche Faktenübersicht bei KI-Ausfall sind vorzusehen. Private Inhalte aus gesperrten Räumen oder Vault-Klartexte bleiben ausgeschlossen. Status: ausgewählte V2-Funktion, noch nicht implementiert.

### 15. Internet-Radar – zurückgenommen

Am 20.10.2026 auf Nutzerwunsch aus der aktiven Anwendung entfernt. Bestehende Datenbanktabellen und bewusst gespeicherte Gedächtniseinträge bleiben erhalten.

### 16. OneDrive als zusätzliche Cloud-Integration

**Aktuelle Entscheidung vom 20.10.2026: aus der weiteren Planung gestrichen. Die folgenden Absätze dokumentieren die frühere Planung und sind kein aktueller Entwicklungsauftrag.**

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

Eine eindeutige Nutzeranweisung kann eine unterstützte, risikoarme interne Aktion direkt auslösen. Vorschau und ausdrückliche Bestätigung sind für destruktive, umfangreiche oder externe Aktionen vorzusehen. Welche Aktionen dazugehören, wird vor Umsetzung festgelegt. Die Planung autorisiert weder produktive Deployments, GitHub-Merges, Datenbankadministration noch Freigaben an andere automatisch. Inhalte aus Webseiten oder Dokumenten sind Daten und dürfen selbst keine Aktionen autorisieren. Vault-Klartexte werden nicht an die KI übermittelt. Das entfernte Mail-Modul wird hierfür nicht wieder eingeführt.

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
5. ~~Arbeitsgedächtnis und Missionsarchiv~~ – am 21.10.2026 vom Nutzer zurückgenommen.
6. Omni-Briefing beim Öffnen der App.
7. Internet-Radar: zurückgenommen und entfernt (20.10.2026).
8. OneDrive-Integration: aus der weiteren Planung gestrichen (20.10.2026).
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
| ~~Arbeitsgedächtnis und Missionsarchiv~~ | Entfällt | – | Am 21.10.2026 nach Vorstellung vom Nutzer ausdrücklich zurückgenommen |
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

### Korrektur nach Rückmeldung: Monitore in V2 nicht sichtbar

Der Nutzer meldet, dass Monitore vor Commit 81199e1 in V2 sichtbar waren, nach dessen Deployment aber nicht mehr; im Original sind sie weiterhin sichtbar. Es wurden keine Monitor-Löschungen oder Migrationen ausgeführt. Als erste isolierte Korrektur wird die Änderung der API-Bereitstellung zurückgenommen: bundle:api erzeugt wieder das versionierte api/[[...route]].js wie im zuvor funktionierenden Deployment. Das Bundle wird aus den aktuellen Quellen ohne Mail-Modul neu generiert; die Vercel-Rewrites bleiben unverändert. Mail-Entfernung und Uptime-Abstände bleiben bestehen.

Die Ursache ist ohne Zugriff auf die Live-Antworten noch nicht abschließend nachgewiesen. Die Wiederherstellung der Anzeige muss nach dem erneuten Deployment geprüft werden. Weitere Featureentwicklung pausiert bis zur Klärung.

### OneDrive – Implementierung vorbereitet, echter Kontotest ausstehend

19. Oktober 2026: Nr. 8 wurde im Code ergänzt. Der Nutzer wünscht sowohl private Microsoft-Konten als auch Geschäfts-/Schulkonten. Neue lesende Microsoft-OAuth-Verbindung mit PKCE, browsergebundener verschlüsselter Transaktion, verschlüsselten Microsoft-Tokens und Token-Erneuerung. OneDrive erscheint in Einstellungen, Verknüpfungsdialog, Cloud-Monitoring mit Anbieterfilter und aggregierten Werten sowie Dashboard-Widget. Fehlerhafte Quotenabrufe erzeugen keine fiktiven OneDrive-Daten.

Die bestehende Kontentabelle wird weiterverwendet, keine Schema-Migration oder produktiven Datenbankoperationen. Bestehende API-Bereitstellung und Vercel-Rewrites bleiben unverändert. Konto-Detail-/Sync-Antworten verwenden eine öffentliche Projektion ohne Tokenfelder; dies schließt auch eine bisherige Token-Rückgabe bei anderen Cloud-Anbietern.

Einrichtung und Testschritte: docs/ONEDRIVE-SETUP.md. Client-ID, Client-Secret und Redirect-URI sind hier noch nicht vorhanden. Der Nutzer muss die Microsoft-App registrieren, die Werte sicher in Vercel eintragen und den echten privaten beziehungsweise Organisations-Login testen. Lokale Mock- und Regressionstests ersetzen diesen Kontotest nicht. Dieser Punkt ist implementiert, aber noch nicht vollständig live abgenommen.

### OneDrive pausiert; erster lesender Neon-Ausbau

19. Oktober 2026: Der Nutzer pausiert OneDrive, weil die Microsoft-App im Schulverzeichnis nicht ausreichend verwaltet werden kann. Das gewünschte Schul-OneDrive (1 TB) ist nicht verbunden; Code und Anleitung bleiben vorbereitet. Keine Umgehung der Schulberechtigungen und kein behaupteter erfolgreicher Kontotest.

Als nächster V2-Schritt wird Nr. 2 zunächst lesend umgesetzt: sichere serverseitige Benutzer-/Projekt-/Branchzuordnung, Neon-Übersicht im Uptime-Modul und der Projektansicht, Compute-Zustand, Branchgröße und verfügbare projektweite Verbrauchswerte. Die bestehende Datenbank braucht keine Migration. Keine SQL-Abfrage gegen die überwachte Datenbank und keine schreibenden Neon-Verwaltungsaktionen. Vorhandene Monitore, Vercel-Rewrites und der API-Ausgabepfad bleiben erhalten.

Einrichtung: docs/NEON-MONITORING.md mit NEON_API_KEY und NEON_MONITOR_LINKS in Vercel. Echte Live-Abnahme erfordert die Konfiguration durch den Nutzer und steht noch aus. Historie, Alarmierung, Hintergrund-Scheduler und optionaler SQL-Funktionstest sind in diesem ersten Ausbau nicht enthalten; die gesamte Neon-Funktion bleibt daher teilweise offen.

### Neon-Live-Rückmeldung und Deployment-Zentrale

19. Oktober 2026: Der Nutzer bestätigt nach Korrektur von NEON_MONITOR_LINKS, dass die Neon-Anbindung funktioniert. Die offene Arbeit an Historie, Alarmierung und optionalem SQL-Test bleibt davon unberührt.

Nr. 10 ist als erste lesende Vercel-Integration im Code ergänzt: eigenes Modul Deployments und Projektkarte neben Neon, ausdrückliche Produktionszuordnung, bis zu 20 jüngste Deployments mit Commit-Angaben sowie auf Klick abrufbare endliche Build-Logs. Projekt- und Teamzuordnung erfolgt serverseitig und wird zusätzlich gegen den Besitzer des OMNIDESK-Projekts geprüft. Vor Logabruf wird die tatsächliche Projektzuordnung des Deployments geprüft. Private Providerfelder werden nicht durchgereicht; bekannte Geheimwerte und typische Zugangsdaten in Logs werden bestmöglich entfernt, ohne vollständige Redaktion zu versprechen.

Einrichtung: docs/VERCEL-MONITORING.md mit DEPLOYMENT_API_TOKEN und DEPLOYMENT_PROJECT_LINKS. Es gibt keine Schema-Migration, keine schreibenden Vercel-Aufrufe und keine Änderung der bestehenden API-Dateistruktur/Rewrites. GitHub-Verknüpfung, Korrelation von Deployments mit Uptime/Neon und produktionsverändernde Aktionen sind nicht implementiert. Echter Token-/Kontotest und visuelle Live-Abnahme stehen noch aus.

### Ergänzung Deployment-Zentrale · 19.10.2026

Die eigenständige Zentrale listet Vercel-Projekte automatisch aus Konto und zugänglichen Teams auf. Einmalige Freischaltung über DEPLOYMENT_ACCOUNT_USER_ID statt JSON pro Projekt. Bestehende Projektzuordnungen bleiben für die Karten im Projektmanagement erhalten. Lokale Tests prüfen Pagination, Teamkontext, begrenzte Feldausgabe und Benutzerschutz; Prüfung mit dem echten Vercel-Token steht noch aus.

### Neon-Vollausbau · 19.10.2026

Auf ausdrücklichen Auftrag des Nutzers werden die offenen Neon-Bausteine umgesetzt: zusätzliche V2-Monitoring-Tabellen mit selbst einrichtbarer additiver Initialisierung, Messhistorie und fünf Diagramme, konfigurierbare Schwellen mit dedupliziertem Warnungs-/Behebungsverlauf, getrennte Datenfrische und Scheduler-Nachweis, Zuordnung von bis zu drei eigenen vorhandenen Website-/API-/TCP-Monitoren sowie ein ausdrücklich einschaltbarer READ-ONLY-SQL-Funktionstest mit separatem Intervall und serverseitigem Branch-/Endpoint-Abgleich. Historien und Warnungen bleiben benutzer-, projekt- und ressourcenbezogen. Gleichzeitige Prüfläufe werden mit Datenbank-Leases begrenzt; Messspeicherung und Warnungsänderungen erfolgen transaktional.

Der Nutzer verwendet Vercel Hobby. Der tägliche Vercel-Rückfall wird deshalb um einen geschützten extern aufrufbaren Scheduler-Endpunkt ergänzt. Ein Fünf-Minuten-Job muss extern eingerichtet werden; eine Intervallvariable allein führt nichts aus. Fehlende Scheduler-Aufrufe und alte Daten werden sichtbar, ein ruhender Compute gilt nicht als Ausfall. Die Einrichtung ist in docs/NEON-MONITORING.md beschrieben. Die bestehende API-Bereitstellung und Rewrites bleiben erhalten.

Lokale PostgreSQL/WASM-Integrationstests, vollständige Regressionstests sowie Desktop-/Mobil-Browserprüfung mit Beispieldaten werden ausgeführt. Neue Tabellen, echter Scheduler und optionaler SQL-Zugang sind ohne produktive Zugangsdaten in dieser Arbeitsumgebung nicht live abgenommen. Neon wird erst nach diesen Einrichtungsschritten und der dokumentierten Live-Abnahme als vollständig abgeschlossen gezählt. Es wurde kein neuer externer Scheduler-Account im Namen des Nutzers erstellt und kein Secret an einen externen Dienst übertragen.

### GitHub-Zentrale · 19.10.2026

Der Nutzer verzichtet ausdrücklich auf den optionalen Neon-SQL-Test und setzt die Arbeit mit GitHub fort. Die frühere fehlgeschlagene Scheduler-Abnahme bleibt unbestätigt; eine gute Tabellenansicht beweist keinen erfolgreichen Hintergrundbetrieb.

Nr. 12 ist als lesende Integration ergänzt: eigenes Modul GitHub, automatische Repository-Liste, Branches, Standardbranch-Commits, offene Issues/PRs, Actions-Läufe und Releases. Repositories lassen sich innerhalb der App eigenen OMNIDESK-Projekten zuordnen; dafür wird beim ersten Speichern ausschließlich v2_github_links angelegt. Eine GitHub-Karte erscheint im Projektmanagement. Vercel-Repository-Identitäten und Produktions-SHAs führen in die GitHub-Zentrale; nur exakte SHA-Treffer werden markiert. Keine behauptete Störungsursache oder automatische zeitliche Korrelation.

Einrichtung über GITHUB_API_TOKEN und GITHUB_ACCOUNT_USER_ID, beschrieben in docs/GITHUB-ZENTRALE.md. Keine schreibenden GitHub-Aktionen. Lokale Tests und Browserprüfung werden durchgeführt; Token-Einrichtung und produktive Live-Abnahme bleiben erforderlich. Das Original-Repository wird nicht verändert.

### Kontosicherheit · 20.10.2026

Nach vollständiger Live-Bestätigung der GitHub-Zentrale und neuem ausdrücklichem Entwicklungsauftrag wird Nr. 11 umgesetzt: eigenes Modul Kontosicherheit, manuelle Kontenerfassung und ausdrückliche Übernahme eigener Cloud-Verbindungen, Passkeys/2FA/Wiederherstellungswege/Codes jeweils mit unbekannt/aktiv/nicht aktiv/nicht verfügbar, Wichtigkeit und manuelles Prüfdatum mit wiederkehrender Fälligkeit. Dokumentierte Lücken, Unbekanntes, Prüfbedarf und Empfehlungen werden getrennt. Ein vorhandener Verbindungsdatensatz ist ausdrücklich kein Anbieter-Nachweis für die Sicherheitsmerkmale.

Ein auswählbares Dashboard-Widget und eine quellenbezogene Zusammenfassungs-API bereiten das spätere Omni-Briefing vor; kein KI-Datenversand und noch kein fertiges Startbriefing. Versionen schützen veraltete Tabs. Die zusätzlich einrichtbare Tabelle v2_account_security verändert keine vorhandenen Konten, Vault-Daten oder bestehenden Tabellen. Keine zusätzlichen Provider-API-Schlüssel, keine Datenleck-Prüfung und keine automatische Änderung von Anbieter-Einstellungen. Die Kontenkarte bleibt separat geplant.

Einrichtung und Abnahme: docs/KONTOSICHERHEIT.md. PostgreSQL-Integrationstests und Browserprüfung mit Beispieldaten werden durchgeführt. Produktive Einrichtung und Live-Abnahme bleiben bis zur Rückmeldung des Nutzers offen. Die Bestätigung der GitHub-Zentrale ersetzt keine weiterhin ausstehende Neon-Scheduler-Abnahme; der optionale Neon-SQL-Test bleibt auf Wunsch des Nutzers ausgeschaltet.

### Kontosicherheit live bestätigt; Kontenkarte · 20.10.2026

Der Nutzer bestätigt den erfolgreichen Funktionstest der Kontosicherheit mit seinem Google-Konto und autorisiert die Fortsetzung. Nr. 11 ist damit für den getesteten eigenen Kontoablauf live bestätigt.

Nr. 13 wird als Kontenkarte umgesetzt: gemeinsames Kontenmodell aus Kontosicherheit, private typisierte und gerichtete Beziehungen für Anmeldung und Wiederherstellung, explizite Angabe weiterer Anmeldewege, interaktive Karte mit Zoom und Tastaturauswahl sowie zugängliche filterbare Verbindungsliste. Eine Betrachtung des ausgewählten Kontos zeigt direkte/indirekte Pfade und zirkuläre Strukturen, ohne Wiederherstellungsadressen oder dokumentierte Alternativen als sicheren Zugangsverlust zu behandeln. Keine automatische Abfrage fremder Kontoeinstellungen, keine Anbieter-Änderungen, keine Vault-Inhalte und keine KI-Übertragung.

Die neue Tabelle v2_account_relations wird additiv über die App eingerichtet. Beide Endkonten werden in Lese- und Schreibabfragen auf Besitzer geprüft; Versionen verhindern Überschreiben aus veralteten Tabs. Beim Entfernen eines gemeinsamen Kontoeintrags werden dessen dokumentierte Beziehungen ebenfalls entfernt; der bestehende Bestätigungsdialog weist darauf hin. Keine neuen API-Schlüssel oder Scheduler erforderlich.

Einrichtung: docs/KONTENKARTE.md. Lokale PostgreSQL- und Pfadtests sowie Desktop-/Mobil-Browserprüfung mit Beispieldaten werden durchgeführt. Die neue Kontenkarte ist bis zur produktiven Einrichtung und Rückmeldung noch nicht live abgenommen.

### Kontenkarte bestätigt; Omni-Startbriefing · 20.10.2026

Der Nutzer bestätigt die Kontenkarte und autorisiert die Fortsetzung. Nr. 6 wird umgesetzt: persönliche Zusammenfassung beim App-Start, Aufgaben/Projekte/Termine mit getrennten Zählern, gespeicherte Uptime- und Neon-Warnungen, optional dokumentierte Kontosicherheit. Direktlinks öffnen passende Aufgaben und Termine sowie Projektkarten und Meilensteine. Kontosicherheit ist standardmäßig ausgeschlossen; Quellen, Zeitzone, automatisches Öffnen und KI sind einstellbar.

Die Faktenübersicht ist von der KI-Auswahl nächster Schritte getrennt. Die bestehende Omni-KI wählt nur überprüfbare Quellen und Gründe; keine freien erfundenen Zahlen, keine Aktionen. Fehler führen zu gekennzeichneter regelbasierter Orientierung. Benutzerbezogener Cache, zehnminütige Generierungssperre und begrenzte Anbieter-Anfragen verhindern dauernde Generierung. Zwei additive Tabellen speichern Einstellungen, Besuchsvergleich und KI-Auswahl; keine bestehenden Datensätze werden umgeschrieben.

Einrichtung und Grenzen: docs/OMNI-BRIEFING.md. Lokale automatisierte Tests und Desktop-/Mobil-Browserprüfung mit Beispieldaten; produktive Zahlen und echter KI-Anbieter bleiben nach dem Deployment gemeinsam zu prüfen. Keine vorgezogene Umsetzung von Mission Control, Gedächtnis oder ausführbaren Omni-Aktionen. Neon-Scheduler-Abnahme bleibt unbestätigt; SQL-Test bleibt auf Nutzerwunsch aus.

### Omni-Briefing bestätigt; interne Omni-Aktionen · 20.10.2026

Der Nutzer bestätigt das Startbriefing und autorisiert den vorgeschlagenen nächsten Schritt ausdrücklich. Nr. 15 wird als klar begrenzte interne Ausführung ergänzt: eigener Aktionen-Bereich im bestehenden Omni-Modul, natürliche Aufträge, Vorschau mit alten/neuen Werten, ausdrückliche Bestätigung, Abbrechen, 15 Minuten Gültigkeit, benutzerbezogener Verlauf und Ergebnislinks. Der normale Wissenschat verweist für Änderungen auf diesen Bereich und behauptet keine Ausführung.

Unterstützt sind persönliche Aufgaben anlegen/bearbeiten, Projektaufgaben anlegen/bearbeiten, interne Termine anlegen und Text an Projektbeschreibungen anhängen. Das bestehende Projektboard hat keine Fälligkeit oder Beschreibung; entsprechende Wünsche erfordern eine Rückfrage, statt stillschweigend Daten wegzulassen. Keine Löschungen oder externen Anbieteraktionen. Höchstens fünf Schritte werden in einer PostgreSQL-Transaktion ausgeführt. Sperren, Besitz- und Zustandsprüfungen verhindern fremde Änderungen, veraltetes Überschreiben und doppelte Ausführung desselben Vorschlags.

Zwei additive Tabellen und eine Ausführungsfunktion, keine Änderungen an bestehenden Tabellen. Bestehender KI-Anbieter wird weitergenutzt; ausdrücklicher Auftrag sendet begrenzten eigenen Zuordnungskontext ohne vorhandene Beschreibungen oder Vault-Daten. Dokumentation und Installations-SQL: docs/OMNI-AKTIONEN.md. Lokale PostgreSQL-/API-Tests und Browserprüfung mit Beispieldaten; echte Modell- und Kontoabnahme bleibt nach Deployment offen. Andere geplante Module sowie Neon-Scheduler bleiben von diesem Schritt unberührt.

### Omni-Aktionen live bestätigt; persönliches Omni-Gedächtnis · 20.10.2026

Der Nutzer bestätigt die Omni-Aktionen als live funktionsfähig und beauftragt ausdrücklich das vorgeschlagene persönliche Gedächtnis. Nr. 5 erhält einen ersten klar abgegrenzten Ausbau: gezielt gespeicherte Vorlieben, Wissen und Entscheidungen, optionale Projektbindung, Merken-Entwurf aus Chatnachrichten mit Originalquelle, Suche, Bearbeiten, Versionen mit Übernahme als neuer Entwurf, Archivieren und endgültiges Löschen einschließlich Gedächtnisversionen. Keine automatische Übernahme aller Chats und keine heimliche Datensammlung.

Im Chat lässt sich die Verwendung pro Nachricht abschalten; die Präferenz bleibt pro Nutzer im Browser erhalten. Projektwissen wird ausschließlich bei ausdrücklicher Auswahl des betreffenden Projekts berücksichtigt. Begrenzte Stichwortauswahl bevorzugt gepinnte Einträge und Vorlieben. Pro Antwort werden die tatsächlich mitgesendeten Eintrags-IDs/Versionen nachvollziehbar; dies ist kein Beweis ihrer tatsächlichen Verwendung durch das Modell. Gelöschte/archivierte Einträge werden nicht neu geladen, bereits vorhandene Chatantworten bleiben bestehen. Die bisherige Historienabfrage wird auf die neuesten 20 Nachrichten korrigiert.

Drei additive Tabellen für aktuellen Bestand, Versionen und Kontextnachweise; keine bestehenden Tabellen/Spalten umgebaut. Kein neuer KI-Schlüssel. Gedächtnis erhält keinen automatischen Zugriff auf Vault, Kontosicherheit, Mail oder fremde Projekte und kann keine Aktionen auslösen. Briefing und Aktionsplaner bleiben in diesem Schritt ohne Gedächtnisinjektion. Das größere Arbeitsgedächtnis mit automatischen Aufgaben-/Notizhistorien, Missionsarchiv und gezieltem Undo ist damit noch nicht vollständig umgesetzt und bleibt separat offen.

Einrichtung, Datenfluss, Grenzen und Abnahme: docs/OMNI-GEDAECHTNIS.md. Lokale PostgreSQL-/Chat-Endpunkt-Tests sowie Desktop-/Mobil-Browserprüfung mit Beispieldaten; produktive Anbieterabnahme nach Deployment weiterhin erforderlich. Neon-Scheduler-Abnahme bleibt unbestätigt, optionaler SQL-Test bleibt aus.

### Automatische Gedächtnispflege · 20.10.2026

Der Nutzer möchte das Gedächtnis nicht selbst ausfüllen und autorisiert ausdrücklich die vorgeschlagene Automatisierung. Neue eigene Chatnachrichten werden bei eingeschalteter Automatik auf dauerhafte Vorlieben, Wissen und Entscheidungen geprüft. Eindeutige extraktive Angaben können automatisch gespeichert werden; ausdrückliche Korrekturen aktualisieren aktive unveränderte Ziele mit neuer Version. Unsicherheit oder mögliche Widersprüche bleiben Vorschläge zur Bestätigung. Unter Antworten erscheinen die tatsächlichen Ergebnisse mit Bearbeiten/Vergessen bzw. Ja/Nicht merken. Automatik und gesamte Gedächtnisnutzung sind abschaltbar; manuelles Merken bleibt zusätzlich bestehen.

Projektbereich kommt aus der ausdrücklichen Chatauswahl, nicht aus einer erfundenen Modellzuordnung. Keine Aufnahme von KI-Behauptungen, kein rückwirkendes Sammeln kompletter Chats oder heimlicher Zugriff auf andere Module. Der zusätzliche begrenzte KI-Aufruf nutzt den bestehenden Anbieter. Zwei additive Tabellen sichern Quellen-Idempotenz und Vorschlagszustände; Schreiben und Versionssnapshot sind atomar und besitzer-/versionsgeprüft. Erkannte Zugangsdaten werden ausgeschlossen; die Erkennung bleibt heuristisch und nicht fehlerfrei.

Bedienung, Datenfluss und Grenzen: docs/OMNI-AUTO-GEDAECHTNIS.md. Automatisierte PostgreSQL-/Chat-Tests und Browserprüfung mit Beispieldaten; produktive Modellabnahme nach Deployment erforderlich. Das umfassende Arbeitsgedächtnis/Missionsarchiv und andere offene V2-Module werden dadurch nicht als abgeschlossen erklärt.

### Entfernung Internet-Radar · 20.10.2026

Auf ausdrücklichen Nutzerwunsch wurden Modul, Registrierung, Feed-Verarbeitung, API, Browserautomatik, Scheduler-Endpunkt, Schema-Exporte und eigene Tests entfernt. Nur hierfür benötigte Abhängigkeiten entfallen. Bestehende Radar-Tabellen werden nicht gelöscht; ausdrücklich übernommene Gedächtniseinträge bleiben unverändert. Alte Modul-URLs fallen gemäß Router-Konvention auf das Dashboard zurück. Gemeinsam genutzte Cron-Secrets und Neon-/Uptime-Scheduler bleiben erhalten. Der Nutzer hat inzwischen bestätigt, dass kein externer Radar-Cronjob existiert; hierfür ist keine Bereinigung erforderlich.

### Mission Control – erste zusammenhängende Version · 20.10.2026

Eigenes Modul zusätzlich zum Dashboard im bestehenden Design. Projektlagebild mit Statusfilter/Suche, Projekt-Cockpit, bestehende explizite GitHub-/Vercel-/Neon-Verbindungen und über Neon-Einstellungen verknüpfte Uptime-Monitore. Quellenstatus, Messzeit und Abruffehler bleiben getrennt; fehlende/veraltete Daten gelten nicht als gesund. Begrenzte Ereigniszeitleiste, verlinkte Belege und vorhandene Detailansichten. Direktes Anlegen von Projektaufgaben und manuelle Uptime-Prüfung über vorhandene APIs. Kein Start des optionalen SQL-Tests, keine externen Schreibrechte und keine Änderungen an Vercel-Rewrites.

Regelbasierter Omni-Lagebericht funktioniert ohne KI. Optional priorisiert der bestehende KI-Selektor ausschließlich vorhandene Fakten. Exakte Commit-Verknüpfung erfordert gleiche Repository-Zuordnung; zeitliche Nähe von Deployment und Warnung ist ausdrücklich keine Ursachenanalyse. Datenbankverbindungszahlen und durchgehende Antwortzeitreihen fehlen für weitergehende Aussagen. Allgemeine Projekt-Monitor-Zuordnung ohne Neon, dauerhaftes Missionsarchiv und umfassende Ursachenanalysen bleiben offen. Einrichtung und Abnahme: docs/MISSION-CONTROL.md. Lokale SQL-/API-/Policy-Tests und Browserprüfung verwenden Testdaten; echte Provider- und Nutzerabnahme wird dadurch nicht behauptet.

### Mission Control – Kernumfang vervollständigt · 20.10.2026

Uptime-Monitore sind direkt im Cockpit unabhängig von Neon zuordenbar. Bestehende Neon-Zuordnungen bleiben als Ausgangspunkt erhalten; eigene direkte Zuordnungen haben Vorrang. Server prüft sämtliche Besitzer und Versionsstände auch innerhalb des Schreibvorgangs. Direkter Rückweg aus dem Projekt in Mission Control. Zähler im Lagebild beziehen sich ausdrücklich nur auf die sichtbaren Projekte.

Persistenter Besuchsvergleich mit stabiler Basis bei Aktualisierung und parallelen Tabs, begrenzt auf zehn Besuchsstände je Benutzer und Projekt. Keine erfundenen Löschungen aus begrenzten Provider-Ausschnitten. Tatsächliche Uptime-Antwortzeitverläufe und vorhandene Neon-Diagramme im Cockpit, fehlgeschlagene Prüfungen separat. Zeitlich eingegrenzter Vorher-/Nachher-Vergleich nur bei mindestens drei erfolgreichen Messungen je Seite; kein Kausalitätsversprechen. Atomarer benutzerbezogener KI-Limiter ersetzt das lokale Instanzlimit. Drei additive Tabellen; keine Änderungen an produktiven Bestandstabellen oder Vercel-Rewrites.

Live-Erreichbarkeit und Vercel-Erfolg für den vorherigen Commit sind jetzt belegt; der zuvor vermutete Rewrite-Widerspruch ist kein nachgewiesener Routingfehler. Authentifizierte Provider-/Nutzerabnahme bleibt getrennt von lokalen SQL-, API- und Browserprüfungen. Der Nutzer bestätigt, dass kein Radar-Cronjob besteht. Aktueller Funktionsumfang und Grenzen: docs/MISSION-CONTROL.md.

### Kommandoebene im Browser · 21.10.2026

Der Nutzer autorisiert den sofortigen Start und bestätigt Google Chrome als seinen Browser; Edge darf kompatibel sein. Erste Version: eigenes App-Modul, Chrome-Seitenpanel ab Version 116 mit bewusstem activeTab-Zugriff, Symbol/Shortcut, Titel/URL/Textauswahl, persönliche Anmerkungen, eigene Projektzuordnung, Wiederfinden anhand der normalisierten Quelle, Bearbeiten/Löschen und Projektquellen in Mission Control. Kein Browserverlauf, keine pauschalen Website-Rechte oder automatischen externen Aktionen.

Ein installierbares ZIP wird aus festen Quelldateien beim Build erzeugt und über die App heruntergeladen. Explizite Freigabe in der bestehenden Clerk-Sitzung; einmaliger, fünf Minuten gültiger und an einen Verifier gebundener Code. Gerätezugang für 30 Tage ausschließlich für Browser-Anmerkungen und eigene Projektnamen, jederzeit widerrufbar. Keine Übertragung des Clerk-Tokens an die Erweiterung. Drei additive Tabellen; bestehende Inhalte und Vercel-Rewrites bleiben erhalten. Neue Provider-Schlüssel sind nicht nötig.

SQL-/API-/Hintergrundcode-Tests und Browseroberflächenprüfungen verwenden isolierte bzw. simulierte Daten. Das Laden entpackter Erweiterungen ist im Cloud-Chromium per Administratorrichtlinie blockiert; ein echter Erweiterungsstart wird deshalb nicht behauptet. Installation, native Chrome-Freigabe und produktive Verbindung im Browser des Nutzers müssen separat bestätigt werden. Seiten-Snapshots, Positionsmarkierungen nach Seitenänderungen und Firefox-Unterstützung sind kein abgeschlossener Bestandteil. Bedienung, Datenfluss und Prüfgrenzen: docs/BROWSER-KOMMANDOEBENE.md. Der abschließende Gesamttest der App bleibt nach den weiteren vereinbarten Änderungen ein verbindlicher Arbeitspunkt.


### Gemeinsame Räume · 21.10.2026

Nach erfolgreicher Chrome-Rückmeldung startet der Nutzer das nächste Paket und entscheidet sich für OMNIDESK-Anmeldung. Erstumfang: eigenes Modul, Räume mit verpflichtendem Ablauf innerhalb eines Jahres, private Raumleitung, Leser/Bearbeiter, gemeinsame Checkliste und Text-Pinnwand, einmalige widerrufbare Einladungslinks, Rollenwechsel, Zugangsentzug, Verlassen, Schließen und bestätigte endgültige Löschung. In Mission Control führt „Ausschnitt im Raum teilen“ zur leeren Auswahl eigener Projektbeschreibung und Aufgaben. Eine Vorschau zeigt exakt die anschließend als Kopien gespeicherten Texte; private Modulzugriffe entstehen nicht.

Vier additive Tabellen; bestehende Clerk-/Neon-Konfiguration reicht aus. Token werden gehasht gespeichert, im Linkfragment übergeben und vor Clerks Hash-Anmeldung für höchstens eine Stunde im Sitzungsspeicher zwischengespeichert. Berechtigungen werden in SQL pro Raum und Objekt geprüft; Schreibzugriffe und Rechteentzug werden pro Raum unter einer Transaktionssperre serialisiert. Versionen schützen parallele Änderungen. Keine Dateien, Gäste ohne Anmeldung, Abstimmungen, E-Mail-Versand, Raum-KI oder Übernahme in private Gedächtnisse.

Lokale SQL-/API-Tests und Browserprüfung mit simulierten Konten sind keine produktive Mehrkonto-Abnahme. Diese bleibt mit einem zweiten angemeldeten Konto nach Bereitstellung erforderlich. Einrichtung, Aufbewahrung und Prüfablauf: docs/GEMEINSAME-RAEUME.md. Das Arbeitsgedächtnis/Missionsarchiv sowie der anschließende vollständige App-Test bleiben offen.


### Nutzerabnahme gemeinsame Räume · 21.10.2026

Der Nutzer bestätigt zunächst den gespeicherten Listenpunkt, anschließend Erstellung des Einladungslinks und erfolgreichen Beitritt mit einem Testkonto. Nach weiteren eigenen Tests meldet er: „alles getestet und funktioniert alles gut“. Die erste Raumversion gilt damit als vom Nutzer live bestätigt. Dies ist eine Nutzerabnahme, kein einzeln protokollierter Nachweis jedes technischen Sonderfalls und kein vollständiger App-Gesamttest. Als nächstes größeres Funktionspaket bleibt das übergreifende Arbeitsgedächtnis/Missionsarchiv gemäß Abschnitt 8; danach folgen die ausdrücklich gewünschte gemeinsame Funktionsvorstellung und der vollständige App-Test.


### Arbeitsgedächtnis und Missionsarchiv · 21.10.2026

Der Nutzer autorisiert den Start nach gemeinsamer Festlegung von Verlauf, Wiederaufnahme und Archiv. Neues Modul /working-history mit Änderungsverlauf für eigene Notizen, persönliche Aufgaben und Projektaufgaben; Vergleich mit Original, bewusst leerer Feldauswahl und bestätigter Wiederherstellung einzelner Felder unter Versionsprüfung. Normale Editoren erhalten dieselbe Versionsprüfung; Notiz-Autosaves werden serialisiert, Konfliktentwürfe bleiben sichtbar. Auch bestätigte Omni-Aufgabenschritte werden atomar mit Herkunft erfasst. Alte nie erfasste Zustände werden nicht erfunden.

Zweiter Bereich: private manuelle Arbeitsstände mit Ausgangslage, Entscheidungen, offenen Fragen, nächsten Schritten, Ergebnis und geprüften Originalverweisen. Zustände In Arbeit/Unterbrochen/Archiv, Suche, Wiederaufnahme und bewusste Löschung. Einstieg aus Mission Control mit Projektzuordnung, ohne automatische Textkopien oder Freigaben. Vier zusätzliche Tabellen, eigene SQL-Funktionen und drei Trigger auf Originaltabellen; keine vorhandenen Spalten umgebaut. Bestehende Clerk-/Neon-Konfiguration reicht aus, kein neuer KI-Anbieter oder Scheduler. Verlauf mit steuerbarer Pause/Aufbewahrung; manuelle Dokumentation bis zur ausdrücklichen Löschung.

Einrichtung und Grenzen: docs/ARBEITSGEDAECHTNIS.md. SQL-/API- und Browserprüfungen verwenden isolierte bzw. simulierte Daten; produktive Abnahme bleibt offen. Die vereinbarten ersten Funktionspakete sind implementiert. Nächster gemeinsamer Schritt: alle neuen Module und Verbesserungen anhand docs/V2-RUNDGANG.md vorstellen, anschließend den ausdrücklich gewünschten vollständigen App-Test durchführen und Auffälligkeiten dokumentieren/priorisieren. Diesen Abschluss nicht aus erfolgreichen automatisierten Tests ableiten.


### Arbeitsgedächtnis entfernt · 21.10.2026

Während des gemeinsamen Rundgangs erklärt der Nutzer Mission Control für verstanden und bestätigt erneut seine Cockpitansicht. Anschließend lehnt er das Arbeitsgedächtnis als unnötig ab und beauftragt dessen Entfernung. Modul, Verlaufs-/Archiv-API und alle Produktverweise entfallen; der Router behandelt die alte URL wie andere unbekannte Module. Installierte Verlaufstrigger werden beim nächsten regulären Zugriff deaktiviert, ohne Originale oder Altdaten zu löschen. Die allgemeinen Bearbeitungssicherungen bleiben vom zurückgenommenen Modul unabhängig. Gemeinsamen Rundgang mit den verbleibenden Funktionen fortsetzen und anschließend den gesamten App-Test durchführen. Keine erneute Gedächtnis-/Archivplanung daraus ableiten.


### Omni-Chat kürzer und natürlicher · 21.10.2026

Im Rundgang erklärt der Nutzer Deployments und GitHub für bekannt, die Kontenkarte für verstanden sowie Kontosicherheit und Omni-Aktionen für bekannt. Beim Omni-Chat beauftragt er eine konkrete Verbesserung: Antworten sind ihm viel zu lang und kontextlastig; kurze natürliche Antworten sind die wichtigste Vorgabe.

Serverseitiger Antwortstil mit standardmäßig 1–3 kurzen Sätzen, Smalltalk 1–2. Klar erkannter alleinstehender Smalltalk wird ohne alten Gesprächs-/Projektkontext beantwortet; gespeicherte Originale bleiben erhalten. Pinning und ausgewählter Projektbezug erzwingen keine unpassenden Erinnerungen mehr. Der aktuelle Wunsch nach ausführlichen Erklärungen oder vollständigen Skripten bleibt möglich, ohne normale Antworten mechanisch abzuschneiden. Fehlermeldungen und die Chatoberfläche werden von wiederholtem Zusatztext befreit. Bestehende Aktionen, persönliche Erinnerungen und Briefing bleiben eigenständig; kein erneutes Arbeitsgedächtnis.

Details und Prüfgrenzen: docs/OMNI-CHAT.md. Isolierte Tests prüfen Anbieterauftrag und Speicherung; die tatsächliche Modellantwort muss anschließend in der angemeldeten Sitzung geprüft werden. Danach den Rundgang und den vollständigen App-Test fortsetzen.


### Verbesserungen aus dem Gesamttest · 26.10.2026

Der Nutzer hat die produktive V2-Umgebung vollständig durchgesehen und sieben Punkte übergeben. Umgesetzt sind die Schreibweise OMNIDESK in der gesamten Oberfläche, die Beschränkung des Omni-Briefing-Auslösers auf das Dashboard, eine Liste der anstehenden Termine mit aufklappbaren Details unter dem Kalender sowie vier Ursachen der langsamen Modulwechsel.

Zur Langsamkeit: Die Faktenabfrage des Briefings wurde nach jeder erfolgreichen Mutation der Anwendung ungültig gemacht und sammelte dabei Aufgaben, Projekte, Kalender, Uptime, Neon und Kontosicherheit ein; schon ein Notiz-Autosave löste das aus. Die Command-Palette lud Befehle und Notizen auf jeder Seite, die Überfälligkeits-Erinnerung die Aufgabenliste auch nach erledigter Tagesmeldung. Deterministische Fehlerantworten wurden dreimal wiederholt und verzögerten die Anzeige in Neon, GitHub und Deployments. Zusätzlich halten zwischengespeicherte Daten länger, und Modulcode wird beim Überfahren des Sidebar-Eintrags vorgeladen. Keine Funktion und keine Anzeige wurde dabei entfernt.

Offen zur gemeinsamen Entscheidung bleiben Dashboard-Widgets für die neuen Module, der Ausbau der Browser-Kommandoebene zu einer aus OMNIDESK konfigurierbaren Oberfläche und ein Werkzeug für Proxmox VE. Diese drei sind ausdrücklich Gesprächspunkte, keine beauftragten Pakete. Einzelheiten und Prüfgrenzen: docs/VERBESSERUNGEN-26-10-2026.md. Der gemessene Zeitgewinn in der angemeldeten Produktivumgebung steht noch aus.


### Browser-Kommandoebene, Stufe 1 · 26.10.2026

Der Nutzer beauftragt den Ausbau der Kommandoebene und lässt ihn eigenständig fertigstellen. Umgesetzt ist die lesende erste Stufe: In OMNIDESK konfigurierbare Schnellzugriffe auf eigene Module und Link-Manager-Einträge sowie die eigene Befehlsbibliothek mit Suche und Kopierknopf im Seitenpanel. Erweiterungsversion 1.1.0; nach dem Update ist die Erweiterung in Chrome neu zu laden.

Modulziele werden serverseitig gegen eine gemeinsame Liste geprüft, Linkziele gegen die eigenen Einträge; freie Adressen sind nicht konfigurierbar und der Passwort-Manager steht nicht zur Auswahl. Entfernte Ziele bleiben gekennzeichnet sichtbar. Lesen darf die Erweiterung über die gemeinsame Datenroute, schreiben ausschließlich die angemeldete App: Der Gerätezugang erhält keine zusätzlichen Rechte. Eine additive Tabelle mit Versionsschutz.

Drei zusätzliche Tests gegen isoliertes PostgreSQL/WASM prüfen Zielprüfung, Besitzgrenzen, Versionsschutz und die fehlende Schreibmöglichkeit der Erweiterung; insgesamt 168 Tests bestanden. Die Erweiterung selbst wurde nicht in einem Browser ausgeführt und ist vom Nutzer zu bestätigen (TESTANLEITUNG-CLAUDE-CODE.txt). Stufe 2 mit Schreibrechten bleibt offen und unbeauftragt. Einzelheiten: docs/BROWSER-KOMMANDOEBENE.md.


### Browser-Kommandoebene: Erfassen statt Anmerken · 27.10.2026

Der Nutzer probiert Stufe 1 aus und stellt klar, dass sein eigentliches Ziel verfehlt wurde: Er will im Browser eine schnelle Notiz schreiben und sie im Notizen-Modul wiederfinden. Nach gemeinsamer Klärung legt das Panel jetzt Notizen, persönliche Aufgaben und Projektaufgaben direkt in den vorhandenen Modulen an; eine übernommene Seite wird bei Notiz und Aufgabe automatisch unter den Text gesetzt. Projektaufgaben haben kein Textfeld, dort entfallen Text und Quelle mit sichtbarem Hinweis. Erweiterungsversion 1.2.0.

Der Gerätezugang der Erweiterung darf damit erstmals schreiben, eng begrenzt auf das Anlegen dieser drei Eintragsarten. Kein Ändern, kein Löschen, kein Zugriff auf Vault oder andere Module, kein Schreibweg auf die Panel-Konfiguration; Projektbesitz wird serverseitig geprüft. Die vom Panel vergebene Kennung verhindert Doppelungen bei einem zweiten Versuch. Der getrennte Anmerkungsbereich nimmt keine neuen Einträge mehr auf; vorhandene bleiben als Altbestand erhalten, es wurde nichts migriert und nichts gelöscht.

170 Tests bestanden. Die Erweiterung selbst wurde nicht in einem Browser ausgeführt; Bestätigung durch den Nutzer anhand TESTANLEITUNG-CLAUDE-CODE.txt steht aus. Einzelheiten: docs/BROWSER-KOMMANDOEBENE.md.


### Nutzerabnahme des Gesamttests · 28.10.2026

Der Nutzer hat die produktive V2-Umgebung zu Hause sorgfältig geprüft und bestätigt ausdrücklich: Es funktioniert alles, die Umsetzung ist aus seiner Sicht vollständig. Damit ist der seit Oktober verbindlich geführte Gesamttest abgeschlossen und die vereinbarten Änderungen sind abgenommen. Eingeschlossen sind die Schreibweise OMNIDESK, das auf das Dashboard begrenzte Omni-Briefing, die Terminliste im Kalender, die behobenen Ladezeiten, die Widgets für Gemeinsame Räume und Mission Control sowie die Browser-Kommandoebene mit Erfassung in Notizen, Aufgaben und Projektaufgaben einschließlich Textfeld für Projektaufgaben.

Dies ist eine Nutzerabnahme auf Grundlage eigener Prüfung, kein protokollierter Einzelnachweis jedes technischen Sonderfalls. Weitere Erinnerungen an den Gesamttest entfallen; er ist erledigt und wird nicht erneut angestoßen.

Offen bleiben als eigenständige Punkte: der fehlende sichtbare Konflikthinweis beim parallelen Bearbeiten einer Notiz (docs/GESAMTTEST-AUFFAELLIGKEITEN.md, Punkt 1), die fehlende Bearbeitbarkeit des Textes einer Projektaufgabe, das weiterhin nicht eingerichtete Neon-Monitoring ohne externen Scheduler und der Anwendungsname in der Clerk-Instanz, der die Anmeldemaske weiterhin „OmniDesk“ schreiben lässt.


### Code- und Systemprüfung · 28.10.2026

Nach der Abnahme gibt der Nutzer eine vollständige Prüfung von Anwendung, Code und Anbindungen frei. Vollständig gelesen wurden Routenverdrahtung und Auth-Grenze, sämtliche kleineren Servermodule sowie die sicherheitsrelevanten Speicher- und Routendateien; Frontend-Module stichprobenartig mit Schwerpunkt Notizen. Gesamteindruck: sauber gebaut, Besitzprüfungen durchgängig in SQL und innerhalb der Schreibtransaktion wiederholt, externe Abrufe mit Zeitlimit und Größengrenze, keine Preisgabe von Anbieterinhalten in Fehlermeldungen.

Behoben: Die Uptime-Übersicht lud die Messungen sämtlicher Monitore statt nur der eigenen; die Trigger-Prüfung des entfernten Arbeitsgedächtnisses lief bei jedem Notiz-, Aufgaben- und Projektzugriff mit; der Chat rief den KI-Anbieter ohne Zeitlimit auf; der Uptime-Check gab den Antwortkörper nicht frei; der Konflikthinweis in den Notizen war nicht als Warnung erkennbar; drei Einrichtungsvorgänge teilten sich eine Advisory-Lock-Nummer; die Rückleitung nach der Google-Anmeldung zeigte ohne gesetzte Variable auf localhost; Produktname in der Systemanweisung und fehlende Einträge in .env.example.

Offen zur Entscheidung: Der Google-OAuth-State ist nicht an die Sitzung gebunden, während der Microsoft-Weg genau das vorbildlich löst; die öffentliche Buchungsseite kennt keine Begrenzung je Zeitraum und hat ein kleines Zeitfenster zwischen Prüfung und Einfügen; der Uptime-Monitor liest Zertifikatslaufzeiten ohne Gültigkeitsprüfung; mehrere Routen prüfen ihre Kennung nicht auf UUID-Form und antworten deshalb mit 500 statt 404. API-Dateistruktur und Vercel-Rewrites blieben ausdrücklich unberührt. Einzelheiten und Prüfgrenzen: docs/CODEPRUEFUNG-28-10-2026.md.


### Google-Anmeldung an die Sitzung gebunden · 28.10.2026

Der Nutzer entscheidet: umstellen. Die Google-Autorisierung läuft jetzt denselben Weg wie Microsoft. Die laufende Anmeldung liegt verschlüsselt in einem HttpOnly-Cookie dieses Browsers (`omnidesk-google-oauth`, nur für `/api/integrations/google`, zehn Minuten gültig), zusätzlich mit PKCE (S256). Im State steht nur noch eine Zufallszahl; die Benutzerkennung verlässt den Server nicht mehr. Der Callback nimmt die Kennung ausschließlich aus dem entschlüsselten Cookie, löscht es danach und leitet nur noch auf `/settings` oder `/cloud-monitor` zurück. Produktiv prüft der Start, dass die App auf der in `GOOGLE_REDIRECT_URI` konfigurierten Adresse läuft; lokal entfällt diese Prüfung, weil Oberfläche und API auf verschiedenen Ports laufen und Cookies je Host gelten. `GOOGLE_REDIRECT_URI` muss auf den Google-Callback dieser App zeigen.

Zusätzlich behoben: Der Code-Austausch übernahm bei einem Fehler den Antworttext von Google in die Fehlermeldung, und der Callback schrieb diese Meldung in die Rückleitungsadresse. Jetzt wird nur der HTTP-Status erwähnt und die Rückleitung enthält einen festen Text. Der Austausch hat ein Zeitlimit von 15 Sekunden, der Callback setzt `Cache-Control: no-store` und `Referrer-Policy: no-referrer`.

Neuer Test `tests/google-oauth.test.ts` mit fünf Prüfungen: kein Benutzer im State, PKCE-Prüfwert passend zum Verifier, geklammertes Rückleitungsziel, Ablehnung von fremdem Browser, verändertem Cookie, falschem State und abgelaufener Anmeldung, geschützte Cookie-Merkmale am Startpunkt samt Abweisung einer fremden Adresse, und ein Callback ohne passendes Cookie, der Google gar nicht erst anspricht. Gegenprobe gelaufen: ohne die Bindung schlägt der Test fehl. 177 Tests bestanden.

**Nicht umgesetzt:** Google-Tokens liegen weiterhin im Klartext in der Datenbank, während Microsoft sie verschlüsselt ablegt. Das betrifft bestehende Zeilen und erfordert eine Live-Prüfung der Google-Drive-Verbindung; als eigener Punkt festgehalten, nicht nebenbei geändert.

**Live-Prüfung steht aus:** Die Google-Verbindung wurde nicht in der angemeldeten produktiven Sitzung neu durchlaufen. Beim nächsten Verbinden eines Google-Kontos ist zu prüfen, dass die Rückleitung in den Einstellungen bzw. im Cloud-Monitor ankommt.

### OneDrive bleibt eingebaut, aber ungenutzt · 28.10.2026

Nutzerfrage: Die Microsoft-Anmeldung stammt aus der OneDrive-Anbindung, die er eigentlich weglassen wollte. Befund: Sie gehört ausschließlich zum Modul Cloud-Monitor und ist ohne `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` und `MICROSOFT_REDIRECT_URI` vollständig untätig; keine dieser Variablen ist gesetzt, weder lokal noch produktiv. Der Code wird nicht entfernt, weil die Planungsentscheidung gegen OneDrive kein Auftrag zum Löschen vorhandenen Integrationscodes ist und er die Vorlage für die sichere Google-Umstellung war. Ob die Schaltfläche im Cloud-Monitor ausgeblendet wird, entscheidet der Nutzer.

### OneDrive in der Oberfläche ausgeblendet · 28.10.2026

Der Nutzer entscheidet: ausblenden. Ein Schalter in `src/lib/cloud-providers.ts` (`ONEDRIVE_OFFERED = false`) steuert alle Stellen zentral; auf `true` gesetzt kommt das Angebot vollständig zurück. Nicht mehr sichtbar sind: der Anbieter „Microsoft OneDrive“ in der Auswahl des Verknüpfen-Dialogs samt dazugehörigem Abschnitt, die OneDrive-Karte in den Einstellungen mit der Schaltfläche „Mit Microsoft verbinden“, die OneDrive-Kachel und der OneDrive-Filterreiter im Cloud-Monitor sowie die OneDrive-Zeile im Dashboard-Widget. Die Texte nennen nur noch Google Drive und MEGA.

Vorhandene Konten bleiben sichtbar: `showOneDrive(anzahl)` zeigt Kachel, Reiter, Karte und Widget-Zeile weiterhin an, solange ein OneDrive-Konto verknüpft ist, dann ohne Verbinden-Schaltfläche, damit es trennbar bleibt. Verknüpft ist derzeit keines. Serverseitig wurde nichts entfernt: Route, Callback, Synchronisation und Tests der Microsoft-Anbindung bleiben unverändert und untätig, weil keine Microsoft-Variable gesetzt ist.

177 Tests bestanden, Typprüfung sauber, Lint unverändert bei sieben Warnungen, Build erfolgreich. **Nicht geprüft:** die Ansicht in der angemeldeten Sitzung; Cloud-Monitor und Einstellungen liegen hinter der Anmeldung. Der Nutzer sieht das Ergebnis nach dem Deployment in der Live-App.

### Google-Rückleitung zeigt produktiv auf localhost · 29.10.2026

Der Nutzer berichtet, dass er zum Verbinden eines Google-Kontos stets beide lokalen Server starten muss. Ursache: In der produktiven Umgebung steht `GOOGLE_REDIRECT_URI` weiterhin auf `http://localhost:8787/api/integrations/google/callback`. Google leitet deshalb immer dorthin zurück, unabhängig davon, wo der Vorgang beginnt; das Konto landet trotzdem in der Live-App, weil der lokale Server auf dieselbe Neon-Datenbank schreibt. Nicht direkt ausgelesen – die Vercel-CLI ließ sich nicht mehr starten –, sondern aus dem geschilderten Verhalten geschlossen.

Folge der Cookie-Bindung vom 28.10.2026: Der bisherige Mischweg (Start auf der Live-Adresse, Rückkehr auf localhost) funktioniert nicht mehr, weil das Cookie nicht über zwei Adressen hinweg gilt. Bis zur Umstellung muss der Vorgang auch auf `http://localhost:5173` beginnen. Rein lokal und rein produktiv funktioniert der Ablauf unverändert.

Lösung in `GOOGLE-ANMELDUNG-UMSTELLEN.txt`: erst die produktive Callback-Adresse in der Google Cloud Console eintragen, dann `GOOGLE_REDIRECT_URI` in Vercel umstellen, neu bereitstellen, testen. Der localhost-Eintrag in der Cloud Console bleibt für die lokale Entwicklung bestehen. Beide Stellen liegen beim Nutzer; Umsetzung und Live-Prüfung stehen aus.

### Neue Adresse omnidesk-work.vercel.app · 29.10.2026

Der Nutzer hat das verwaiste V1-Projekt auf Vercel gelöscht und das verbliebene Projekt in `omnidesk-work` umbenannt; die App läuft final unter `https://omnidesk-work.vercel.app`. Die alte Adresse `omnidesk-v2-beta.vercel.app` beantwortet Vercel weiterhin mit einer Weiterleitung (307) auf die neue; im Browser bleibt sie damit benutzbar. Für die Erweiterung ändert das nichts, weil sie nur ihren fest eingetragenen Ursprung anspricht und Weiterleitungen nicht folgt. Nachträglich geprüft, die ursprüngliche Annahme „ersatzlos weg" war falsch. Der Zeitpunkt war bewusst gewählt: vor dem Eintragen der produktiven Google-Rückleitung, damit diese nur einmal gesetzt werden muss.

Im Code war der Ursprung nur an einer Art Stelle fest verdrahtet, nämlich in der Browser-Erweiterung, dort aber sechsfach: `host_permissions`, `externally_connectable`, Inhaltssicherheitsrichtlinie, `background.js`, `panel.js` und `panel.html`. Alle umgestellt, Erweiterungsversion 1.4.0, Paket neu erzeugt. Nachgezogen wurden außerdem die drei Testdateien mit festem Ursprung, `.env.example`, docs/ONEDRIVE-SETUP.md, docs/NEON-MONITORING.md, docs/GESAMTTEST-AUFFAELLIGKEITEN.md, docs/BROWSER-KOMMANDOEBENE.md, TESTANLEITUNG-CLAUDE-CODE.txt und GOOGLE-ANMELDUNG-UMSTELLEN.txt. Die Anwendung selbst bildet Rückleitungen aus dem Ursprung der jeweiligen Anfrage; dort war nichts zu ändern.

177 Tests bestanden, Typprüfung sauber, Build erfolgreich. **Offen beim Nutzer:** Erweiterung neu herunterladen und in Chrome neu laden, sonst erreicht das Panel die App nicht mehr; danach die Google-Umstellung nach GOOGLE-ANMELDUNG-UMSTELLEN.txt mit der neuen Adresse; außerdem prüfen, ob Clerk die neue Domain als erlaubten Ursprung führt und ob ein Uptime-Monitor noch die alte Adresse überwacht.

### Google-Anmeldung produktiv · Nutzerbestätigung 29.10.2026

Die Ursache des Umwegs ist bestätigt: In der Google Cloud Console stand als einzige Weiterleitungs-URI `http://localhost:8787/api/integrations/google/callback`, und `GOOGLE_REDIRECT_URI` in Vercel zeigte ebenfalls dorthin. Deshalb musste bisher der lokale API-Server laufen.

Der Nutzer hat nacheinander die produktive Callback-Adresse in der Cloud Console ergänzt (der localhost-Eintrag bleibt für die lokale Entwicklung bestehen), `GOOGLE_REDIRECT_URI` in Vercel auf `https://omnidesk-work.vercel.app/api/integrations/google/callback` gesetzt und neu bereitgestellt. Anschließend hat er ein Google-Konto direkt in der Live-App verbunden und das Ergebnis bestätigt: „funktioniert wie ich mir das vorgestellt habe“. Lokale Server waren dabei nicht nötig.

Damit ist die am 28.10.2026 eingeführte Cookie-Bindung erstmals produktiv durchlaufen: Start, Rückkehr und Speichern des Kontos liefen vollständig auf einer Adresse. Die Browser-Kommandoebene hat der Nutzer zuvor auf Version 1.4.0 aktualisiert und als erledigt gemeldet; eine eigene Funktionsprüfung dazu hat er nicht geschildert.

Offen bleiben: die verschlüsselte Ablage der Google-Tokens (docs/CODEPRUEFUNG-28-10-2026.md, Punkt A), die Prüfung der erlaubten Ursprünge in Clerk und ein möglicher Uptime-Monitor auf die alte Adresse.
