# Persönliche Kontosicherheit

Stand: 20. Oktober 2026. Neues Modul **Kontosicherheit** mit selbst dokumentierten Absicherungsmerkmalen, Wiederherstellungsarten, manuellen Prüfzeitpunkten und offenen Maßnahmen. Vorhandenes Design bleibt erhalten. Die Kontenkarte ist eine spätere eigenständige Funktion.

## Start

1. Neues Vercel-Deployment abwarten. Es sind keine zusätzlichen API-Schlüssel oder Environment Variables nötig.
2. In der Sidebar **Kontosicherheit** öffnen. Falls ausgeblendet, im Modul-Manager aktivieren.
3. Einmal **Übersicht einrichten** anklicken. Dadurch werden ausschließlich `v2_account_security` und ihre Indizes angelegt. Cloud-Verbindungen, Vault und andere vorhandene Daten werden nicht verändert.
4. **Konto erfassen** wählen oder **Vorhandene Cloud-Verbindungen übernehmen** aufklappen und eine Verbindung ausdrücklich auswählen.
5. Name, Wichtigkeit, Absicherung und Prüfintervall eintragen. Beim Anbieter nachsehen; unbekannte Werte nicht als aktiv markieren.
6. Falls tatsächlich geprüft, **Ich habe diese Angaben selbst beim Anbieter geprüft** bestätigen und speichern.

Die Tabelle liegt in der bestehenden OMNIDESK-Anwendungsdatenbank. Die App-Rolle benötigt für die erste Einrichtung CREATE-Rechte; anschließend passende Rechte auf der neuen Tabelle. Ohne CREATE-Rechte kann eine berechtigte Rolle vorher [das feste additive SQL](sql/ACCOUNT-SECURITY.sql) in der Anwendungsdatenbank ausführen. Kein `db:push` und keine Veränderung bestehender Tabellen erforderlich. Eine mit V1 gemeinsam verwendete DATABASE_URL bedeutet, dass die zusätzliche Tabelle dort liegt; V1-Code und bestehende V1-Daten werden nicht umgebaut.

## Was dokumentiert wird

- Kontoname, Anbieter, optional Anmeldename/E-Mail und HTTPS-Link zur Sicherheitsseite.
- Wichtigkeit: normal, wichtig oder kritisch.
- Passkey, Zwei-Faktor-Anmeldung, Wiederherstellungsweg und gesicherte Wiederherstellungscodes jeweils mit **unbekannt**, **aktiv/vorhanden**, **nicht aktiv/fehlt** oder **nicht verfügbar/nicht zutreffend**.
- Arten vorhandener Wiederherstellungswege: E-Mail, Telefon, Vertrauensperson, Wiederherstellungsschlüssel oder Hardware-Schlüssel. Keine konkreten Adressen, Telefonnummern oder Geheimwerte dieser Wege.
- Eigenes Prüfdatum und erneute Prüfung nach 30, 90, 180 oder 365 Tagen.

Es werden **keine Passwörter, Wiederherstellungscodes oder geheimen Schlüssel** abgefragt. Dafür weiterhin den Passwort-Manager verwenden. Es gibt keine Freitext-Notizen für Geheimnisse und keine Vault-Entschlüsselung. Diese Übersicht speichert persönliche Konten-Metadaten in der Anwendungsdatenbank; sie ist kein zusätzlicher verschlüsselter Passwort-Tresor.

## Selbstauskunft und technischer Nachweis

Sicherheitsmerkmale sind immer **Selbstauskunft**. Der Server bestätigt ausschließlich, ob ein eigener gespeicherter OMNIDESK-Verbindungsdatensatz vorhanden ist. Diese Verbindung ist kein Beleg für aktive Passkeys, Zwei-Faktor-Anmeldung, einen funktionierenden Token oder aktuelle Sicherheitseinstellungen beim Anbieter.

Beim Übernehmen einer Verbindung kommen Anbieter und Anmeldename aus dem eigenen Verbindungsdatensatz. Alle Sicherheitsmerkmale beginnen mit „Unbekannt“. Fremde Verbindungen können nicht übernommen werden. Zugriffstoken, Refresh-Token, Scopes, private Metadaten und Vault-Einträge werden für die Vorschlagsliste nicht ausgewählt und nicht zurückgegeben.

Ein manueller Prüfzeitpunkt wird nur durch ausdrückliche Bestätigung gesetzt, mit Serverzeit. Unbekannte Merkmale werden dadurch nicht automatisch auf aktiv gesetzt. Bearbeiten und Speichern ohne erneute Prüfbestätigung entfernt den bisherigen Prüfzeitpunkt für die geänderten Angaben. Ein Bestätigungsdialog bei **Angaben geprüft** vermeidet versehentliche Prüfbestätigungen.

## Hinweise und Filter

Die Übersicht trennt:

- **Dokumentierte Lücken:** fehlende zusätzliche Anmeldeabsicherung, fehlender Wiederherstellungsweg oder nicht gesicherte Wiederherstellungscodes. Bei wichtigen/kritischen Konten priorisiert.
- **Unbekannte Angaben:** noch nicht dokumentierte Zustände oder ein vorhandener Wiederherstellungsweg ohne dokumentierte Art.
- **Prüfung offen/fällig:** nie bestätigte oder nach dem gewählten Intervall erneut zu prüfende Angaben.
- **Empfehlung:** ein als nicht aktiv dokumentierter Passkey kann als zusätzliche Anmeldemöglichkeit geprüft werden.

Ein vorhandener Passkey wird bei der Empfehlung zur zusätzlichen Anmeldeabsicherung berücksichtigt; fehlende klassische Zwei-Faktor-Anmeldung wird dann nicht automatisch als dieselbe Lücke eingestuft. Das bewertet weder die konkrete Passkey-Implementierung noch deren Authentifizierungsniveau. Vom Anbieter nicht unterstützte Merkmale gelten nicht als fehlende Maßnahme.

**Dokumentiert** bedeutet nur, dass aus den erfassten Angaben derzeit keine Lücke, Unklarheit oder fällige Prüfung abgeleitet wird. Es ist keine technische Freigabe, kein Sicherheits-Score und keine Garantie vollständiger Kontosicherheit. Ein Konto kann in mehreren Kennzahlen vorkommen. Die Aktionen ändern keine Kontoeinstellungen; Änderungen beim Anbieter nimmt der Nutzer selbst vor und dokumentiert anschließend den Stand.

Filter nach Lücken, Unbekannt, fälliger Prüfung, Dokumentationsstand und Wichtigkeit sowie Suche nach Konto/Anbieter/Anmeldename sind vorhanden. Offene Maßnahmen verweisen auf ihren Kontoeintrag. Die Sicherheitsseite wird nur nach Klick im Browser geöffnet; der Server ruft keine eingegebene URL ab. Nur HTTPS ohne eingebettete Zugangsdaten, Suchparameter oder Fragment ist zulässig.

## Dashboard und späteres Omni-Briefing

Das auswählbare Dashboard-Widget **Kontosicherheit** zeigt die wichtigsten offenen Punkte und verlinkt direkt zum betreffenden Eintrag. Es kann im Dashboard-Konfigurator ergänzt werden; eine individuell gespeicherte Anordnung wird nicht zurückgesetzt.

`GET /api/account-security/summary` liefert benutzerbezogene strukturierte Hinweise mit Quellenlink und Kennzeichnung `source: manual`. Ohne eingerichteten Speicher lautet `available: false`; Datenfehler werden nicht als „keine offenen Punkte“ ausgegeben. Dies bereitet das geplante Omni-Startbriefing vor. Das Briefing selbst ist noch nicht implementiert. Es werden in diesem Schritt keine Daten an Omni oder einen KI-Anbieter gesendet.

## Besitz, Änderungen und Löschung

Jeder Lese-/Schreib-/Prüf-/Löschzugriff verwendet die authentifizierte Clerk-Benutzerkennung. Ein Browser kann keine fremde Benutzerkennung setzen. Übernommene Cloud-Verbindungen werden zusätzlich auf Besitz geprüft, auch in der Schreibabfrage. Alle Antworten sind `no-store`; Browsercaches sind nach Benutzer getrennt.

Versionen schützen gegen Überschreiben aus veralteten Tabs. Bei HTTP 409 aktuelle Angaben neu laden und den Dialog erneut öffnen. Pro Benutzer sind höchstens 500 dokumentierte Konten vorgesehen. Dieselbe Cloud-Verbindung kann pro Benutzer nur einmal übernommen werden.

Entfernen verlangt eine Bestätigung und löscht ausschließlich diesen Dokumentationseintrag. Das echte Konto, Cloud-Verbindungen und Vault-Einträge bleiben bestehen. Wird eine Cloud-Verbindung unabhängig davon entfernt, bleibt die manuelle Dokumentation erhalten und verliert nur ihre Verknüpfung. Bei vorübergehend nicht ladbaren Verbindungen wird kein technischer Nachweis behauptet; die bisherige Zuordnung wird nicht automatisch entfernt.

## Bewusst nicht Bestandteil

Keine automatische Prüfung fremder Anbieter-Einstellungen, kein Sicherheits-Scan, keine Datenleck-Abfrage, kein Versand von E-Mail-Adressen an externe Prüfdienste, keine Push-/E-Mail-Erinnerungen und noch keine Konten-Abhängigkeitskarte. Fälligkeiten werden beim Öffnen/Aktualisieren der App und im Widget ausgewertet; ein Hintergrund-Scheduler ist dafür nicht erforderlich.

## Prüfung vor Live-Abnahme

1. Bestehende Module, Cloud-Verbindungen und Vault prüfen.
2. Übersicht einrichten; leere Liste korrekt anzeigen.
3. Eigenes Konto manuell erfassen, bearbeiten, Änderungen erneut manuell bestätigen.
4. Eigene Cloud-Verbindung übernehmen: unbekannte Sicherheitswerte, korrekter Anbieter/Anmeldename, keine Token im API-Ergebnis.
5. Bekannte Lücke dokumentieren, Filter und nächste Schritte prüfen. Anschließend tatsächlichen Zustand beim Anbieter prüfen und Eintrag aktualisieren.
6. In zwei Tabs denselben Eintrag bearbeiten: veraltete Version muss abgewiesen werden.
7. Ein anderer Benutzer darf keine fremden Einträge lesen, prüfen, ändern oder löschen.
8. Eintrag entfernen und bestätigen, dass echtes Konto, Cloud-Verbindung und Vault unverändert bleiben.

Lokale Tests führen die tatsächlichen parametrisierten Speicherabfragen gegen PostgreSQL/WASM aus und prüfen Authentifizierung, Besitz, Versionskonflikte, eindeutige Verknüpfungen, Grenzwerte, Prüfzeitpunkte und Bewertungsregeln. Browserprüfung verwendet Beispieldaten. Die produktive Einrichtung und echte Benutzer-Abnahme stehen noch aus.
