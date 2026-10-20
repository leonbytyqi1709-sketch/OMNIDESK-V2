# Kontenkarte

Stand: 20. Oktober 2026. Die Kontenkarte stellt manuell dokumentierte Anmelde- und Wiederherstellungsverbindungen zwischen eigenen Konten dar. Sie verwendet dieselben Konten wie **Kontosicherheit**. Es werden keine separaten Konten, Passwörter, Codes oder Vault-Klartexte angelegt oder übernommen.

## Einrichtung

1. Vercel-Deployment abwarten und **Kontenkarte** in der Sidebar öffnen. Falls ausgeblendet, im Modul-Manager aktivieren.
2. Einmal **Kontenkarte einrichten** wählen. Legt ausschließlich die zusätzliche Tabelle `v2_account_relations` mit Indizes an. Falls die gemeinsame Kontosicherheit noch nicht eingerichtet war, wird deren eigene Tabelle ebenfalls vorbereitet. Bestehende Konten und Cloud-Verbindungen bleiben erhalten.
3. Mindestens zwei eigene Konten in **Kontosicherheit** erfassen. Ein Konto muss dafür nicht per OAuth verbunden sein; eine manuelle Dokumentation des eigenen Kontos genügt.
4. In der Kontenkarte **Verbindung hinzufügen** wählen und Startkonto, Zielkonto und Verbindungstyp festlegen.

Keine zusätzlichen API-Schlüssel, Environment Variables oder Scheduler nötig. Für die einmalige Einrichtung benötigt die Anwendungsdatenbank CREATE-Rechte. Alternativ mit einer berechtigten Rolle zuerst gegebenenfalls [ACCOUNT-SECURITY.sql](sql/ACCOUNT-SECURITY.sql), dann [ACCOUNT-MAP.sql](sql/ACCOUNT-MAP.sql) in der Anwendungsdatenbank ausführen. Kein `db:push` und keine Änderung vorhandener Tabellen erforderlich.

## Pfeilrichtung und Verbindungstypen

Ein Pfeil führt **vom unterstützenden Konto zum Konto, das dieses Konto nutzt**:

- **Google → Notion / Anmeldung:** Notion nutzt das Google-Konto zur Anmeldung.
- **GitHub → Vercel / Anmeldung:** Vercel nutzt das GitHub-Konto zur Anmeldung.
- **E-Mail-Konto A → Konto B / Wiederherstellungs-E-Mail:** Konto B hat eine Wiederherstellungsadresse aus Konto A hinterlegt. Das ist kein automatischer Nachweis einer Anmeldeabhängigkeit.
- **Weiterer Wiederherstellungsweg:** bewusst dokumentierte sonstige Wiederherstellungsbeziehung zwischen zwei eigenen Konten.

Keine automatische Entdeckung: Die Google-Anmeldung bei OMNIDESK verrät nicht, welche anderen Dienste Google zur Anmeldung nutzen. Jede Verbindung wird ausdrücklich angelegt. Nur unterschiedliche eigene Konten dürfen verbunden werden. Gleiche gerichtete Verbindung mit gleichem Typ ist nur einmal möglich; Anmeldung und Wiederherstellung zwischen demselben Paar dürfen getrennt erfasst werden.

Für **Anmeldung** wird zusätzlich dokumentiert:

- Einziger mir bekannter Anmeldeweg.
- Weiterer Anmeldeweg dokumentiert.
- Weitere Anmeldewege ungeklärt.

Diese Angabe bezieht sich auf das nutzende Zielkonto. Ein weiterer Anmeldeweg kann zum Beispiel ein eigenständiges Passwort/Passkey oder ein anderer Anbieter sein. Seine tatsächliche Unabhängigkeit und Nutzbarkeit müssen beim Anbieter geprüft werden. Ein in Kontosicherheit erfasster Passkey oder eine Zwei-Faktor-Methode wird nicht automatisch als unabhängige Anmeldealternative interpretiert. Mehrere gespeicherte Anbieter-Verbindungen beweisen ebenfalls keine funktionsfähige Alternative. Widersprüchliche Angaben zu einem einzigen bekannten Weg bei mehreren Anmeldeverbindungen werden sichtbar.

## Manuelle Prüfung und Versionen

Beim Erstellen und Bearbeiten kann eine tatsächliche eigene Prüfung bestätigt werden. Ohne Bestätigung bleibt die Verbindung ungeprüft; beim Bearbeiten ohne erneute Bestätigung wird ein bisheriges Prüfdatum zurückgesetzt. Zeitstempel werden serverseitig gesetzt. Die Fälligkeit folgt dem Prüfintervall des nutzenden Kontos aus Kontosicherheit. Ungeprüfte und erneut fällige Verbindungen erscheinen gestrichelt und mit Textkennzeichnung.

Der Prüfzeitpunkt betrifft nur die manuelle Dokumentation. Er beweist keine aktuellen Anbieter-Einstellungen. Es wird keine Abfrage beim Anbieter, keine Sicherheitsänderung und kein KI-Datenversand ausgelöst.

Verbindungen besitzen eine Version. Ein veralteter Tab darf eine neuere Änderung oder Löschung nicht überschreiben; bei HTTP 409 aktuelle Daten laden und den Dialog erneut öffnen.

## Karte und Betrachtung möglicher Folgen

Ein Konto über Auswahlfeld, Klick oder Enter/Leertaste auf einem Knoten auswählen. Zoomen und der begrenzte, horizontal/vertikal scrollbarere Kartenbereich ändern nicht die übrige Seitenbreite. Die Karte zeigt im Fokusmodus strukturell verbundene Konten; alle übrigen können eingeblendet werden. Maximal 60 Konten werden gleichzeitig grafisch gezeichnet, mit ausdrücklichem Begrenzungshinweis. Kontoauswahl und zugängliche Verbindungsliste bleiben vollständig.

**Wenn dieses Konto nicht verfügbar wäre** zeigt mögliche Wege anhand der gespeicherten Beziehungen:

- Direkte und indirekte Anmeldeketten werden mit dem genauen Verbindungspfad angezeigt.
- Ein ungeklärter Anmeldeweg bleibt in der weiteren Anmeldekette ungeklärt.
- Ein dokumentierter alternativer Anmeldeweg unterbricht die Ableitung einer zwingenden nachgelagerten Anmeldeabhängigkeit. Dahinterliegende Konten bleiben nur als strukturelle Verbindungen sichtbar.
- Eine reine Wiederherstellungsverbindung wird nicht als Anmeldeverlust weiterverfolgt. Nachgelagerte Strukturen werden entsprechend als Verbindung ohne ableitbaren Zugangsverlust gekennzeichnet.
- Zirkuläre Strukturen, an denen das ausgewählte Konto beteiligt ist, erhalten einen Hinweis. Angezeigte Namen beschreiben die beteiligte Gruppe und nicht zwangsläufig eine einzelne Pfeilfolge.

Die Ansicht simuliert keine tatsächliche Anbieter-Sperre und behauptet keinen sicheren Kontoverlust. Dokumentierte Alternativen können von anderen betroffenen Konten abhängen, veraltet oder praktisch unbenutzbar sein. Fehlende Verbindungen sind kein Beweis für Unabhängigkeit. Die vollständige Verbindungsliste mit Typ, Richtung, Aktualisierungsdatum und Prüfzeitpunkt bleibt die nachvollziehbare Grundlage.

## Gemeinsames Kontenmodell und Entfernen

Kontonamen, Anbieter und Prüfintervalle werden in Kontosicherheit gepflegt; Änderungen erscheinen auch in der Karte. Eine neue Karte übernimmt vorhandene Konten automatisch, aber erstellt keine Beziehungen automatisch.

**Verbindung entfernen** löscht nach Bestätigung nur diesen Dokumentationseintrag. Echte Konten und Anbieter-Einstellungen bleiben erhalten. Wird ein gemeinsamer Kontoeintrag in Kontosicherheit entfernt, werden seine dokumentierten Beziehungen per Fremdschlüssel mit entfernt; der Bestätigungsdialog weist darauf hin. Ein echtes Anbieter-Konto, Cloud-Verbindungen und Vault-Einträge werden dadurch nicht gelöscht.

Jeder Datenzugriff ist an den angemeldeten Clerk-Benutzer gebunden. Beide Verbindungskonten werden in den Lese- und Schreibabfragen auf Besitz geprüft. Fremde Konten können weder verknüpft noch über eine gespeicherte Beziehung sichtbar gemacht werden. Antworten sind `no-store`; Browsercaches sind nach Benutzer getrennt. Höchstens 1000 Beziehungen pro Benutzer. Die Liste bietet Filter nach Kontonamen/Typ und eine direkte Auswahl zum ausgewählten Konto sowie weitere Einträge in Schritten von 100.

## Live-Abnahme

1. Vorhandenes Google-Konto aus Kontosicherheit in der Karte wiederfinden.
2. Zweites eigenes Konto erfassen. Eine tatsächlich bekannte Beziehung in korrekter Richtung anlegen.
3. Karte, Typ und Verbindungsliste vergleichen; Seite neu laden und Speicherung prüfen.
4. Eine Alternative beziehungsweise ungeklärte Anmeldewege dokumentieren und die vorsichtige Kennzeichnung vergleichen.
5. Bei mehreren eigenen Konten direkte und indirekte Pfade prüfen. Wiederherstellung darf nicht als sicherer Loginverlust ausgegeben werden.
6. Beziehung bearbeiten, Prüfung bestätigen, danach erneut bearbeiten ohne Bestätigung und zurückgesetztes Prüfdatum prüfen.
7. Beziehung entfernen: beide gemeinsamen Konten müssen erhalten bleiben.
8. In zwei Tabs eine veraltete Version ändern; sie muss abgewiesen werden. Ein anderer Benutzer darf keine fremden Konten/Beziehungen sehen oder verändern.

Lokale Tests prüfen die Pfadberechnung mit Ketten, unbekannten Wegen, Alternativen und Kreisen sowie echte parametrisierte Speicherabfragen gegen PostgreSQL/WASM. Browserprüfung verwendet Beispieldaten und prüft Auswahl per Tastatur, Zoom, Verbindung anlegen/entfernen und Mobilansicht. Produktive Einrichtung und Live-Abnahme stehen noch aus.
