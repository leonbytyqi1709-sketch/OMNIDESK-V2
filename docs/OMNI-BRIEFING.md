# Omni-Startbriefing

Beim Öffnen der angemeldeten App begrüßt Omni den Nutzer mit seinem Arbeitsstand. Der Knopf **Omni-Briefing** öffnet die Übersicht erneut. Das bisherige Layout bleibt erhalten.

## Einrichtung und Bedienung

Nach dem Vercel-Deployment die App vollständig neu laden. Der erste Aufruf legt ausschließlich `v2_briefing_state` und `v2_briefing_visits` additiv an. Bestehende Aufgaben, Projekte und Monitore werden nicht verändert. Die konfigurierte `DATABASE_URL` benötigt dafür CREATE-Rechte. Alternativ kann ein Administrator [das SQL](sql/OMNI-BRIEFING.sql) vorab ausführen. Fehlende Speicherung und einzelne ausgefallene Datenquellen werden sichtbar gekennzeichnet.

Unter **Briefing-Einstellungen** lassen sich automatisches Öffnen, Zeitzone, Quellen und KI-Empfehlungen speichern. Kontosicherheit ist zunächst ausgeschlossen und muss ausdrücklich aktiviert werden. Im Modul-Manager deaktivierte Bereiche bleiben ebenfalls ausgeschlossen. Ist das Omni-Modul deaktiviert, werden keine KI-Anfragen gestartet. Ohne KI bleibt die Faktenübersicht nutzbar.

Die bestehende Omni-Konfiguration wird wiederverwendet: `OPENAI_API_KEY` oder `AI_API_KEYS`, optional `AI_BASE_URL` und `AI_MODEL`. Es ist kein neuer Schlüssel und kein Scheduler erforderlich. Die KI-Funktion ist standardmäßig aktiv. Sie erhält ausgewählte Titel, Status, Termine und erlaubte Empfehlungsgründe der einbezogenen Quellen. Keine Notiztexte, Vault-Inhalte, Passwörter, Wiederherstellungscodes oder Anbieter-Tokens. Bei Bedarf vor der nächsten Nutzung abschalten.

## Umfang und Genauigkeit

- Persönliche Aufgaben: alle eigenen offenen Aufgaben sowie heute fällige und überfällige Aufgaben nach eingestellter Zeitzone.
- Projekte: aktive/pausierte Projekte, offene Projektaufgaben und Meilensteine getrennt; ausgewählte Quellen führen direkt zur Projektkarte oder zum Meilenstein.
- Kalender: noch laufende und bevorstehende Termine von heute bis vor Beginn des siebten folgenden Kalendertags. Sommerzeit und Ortsdatum werden berücksichtigt.
- Uptime: ausschließlich gespeicherte Prüfungen; über zehn Minuten alte Prüfungen gelten als unbekannt/veraltet. Das Briefing löst keine Prüfungen aus.
- Neon: eigene, weiterhin gültig konfigurierte Projektzuordnungen, gespeicherte Warnungen und Aktualität anhand des hinterlegten Prüfintervalls. Kein Aufwecken von Compute und kein SQL-Funktionstest.
- Kontosicherheit, optional: dokumentierte Prüfpunkte und Selbstauskünfte; kein Nachweis tatsächlicher Anbieter-Einstellungen.

Zähler erfassen alle passenden eigenen Datensätze. Quellenlisten sind begrenzte Ausschnitte. Nicht verfügbare Quellen werden nicht als null offene Punkte ausgegeben. Persönliche Aufgaben und Projektaufgaben werden nicht vermischt.

Der Besuchsvergleich verwendet einen pro App-Start registrierten, benutzerbezogenen Besuch. Wiederholte Requests desselben Starts verschieben ihn nicht. Er zählt aktualisierte persönliche Aufgaben einschließlich erledigter, aktualisierte Projekte und Termine im angezeigten Zeitraum. Er ist keine vollständige Audit-Historie; gelöschte Einträge und separate Projektaufgaben-Historien sind nicht nachträglich rekonstruierbar. Besuchsbelege werden nach 30 Tagen bereinigt.

Die KI wählt höchstens drei vorhandene Quellen mit einem dort zulässigen Empfehlungsgrund aus. Zahlen und Formulierungen entstehen anschließend aus strukturierten Fakten. Unbekannte IDs, erfundene Gründe und freie Zusatzfelder werden verworfen. Empfehlungen führen keine Aktionen aus. Ohne priorisierte Quellen wird kein KI-Anbieter aufgerufen.

Identische Fakten können Empfehlungen bis zu 30 Minuten wiederverwenden. Ein serverseitiger benutzerbezogener Lock und zehn Minuten Wartezeit begrenzen neue Generierungen auch über mehrere Tabs; höchstens zwei konfigurierte Schlüssel mit jeweils acht Sekunden Anbieter-Timeout. Bei Fehlern oder Wartezeit erscheinen gekennzeichnete regelbasierte Vorschläge. Besuchszeit und reine Änderungszähler verursachen keine neue Generierung. Alle APIs verlangen Anmeldung und leiten den Besitzer aus der Sitzung ab. Einstellungen besitzen Versionsschutz gegen veraltete Tabs.

## Prüfung und Live-Abnahme

Lokal: PostgreSQL-Integrationstests für Besitzertrennung, SQL-Abfragen, Besuchsvergleich, Versionskonflikte und KI-Sperren; Tests für Zeitzonen, Quellenfehler, KI-Ausgabeprüfung und Routen; Browserprüfung mit Beispieldaten auf Desktop und Mobilgerät für Öffnen, Quellenlinks, Wiederöffnung ohne neue KI-Anfrage und gespeichertes Abschalten.

Nach Deployment mit dem eigenen Konto prüfen: angezeigte Zahlen mit den Modulen vergleichen, Quellen öffnen, Einstellungen speichern und App neu laden. Tatsächliche Produktionsdaten und der eingerichtete KI-Anbieter können erst dort gemeinsam abgenommen werden. Die lokale Browserprüfung verwendet Beispieldaten. Der Neon-Scheduler wird durch dieses Feature weder eingerichtet noch als erfolgreich bestätigt.
