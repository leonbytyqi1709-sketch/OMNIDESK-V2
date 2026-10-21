# Gemeinsame Räume

Erste Version vom 21.10.2026, Modul `/shared-rooms`. Der Nutzer hat ausdrücklich **OMNIDESK-Anmeldung für alle Teilnehmer** gewählt. Räume enthalten eine gemeinsame Checkliste und eine Pinnwand mit Texten. Es werden keine privaten Modulbereiche freigegeben.

## Bedienung und Freigabe

1. **Neuer Raum**: Name, ausdrücklich geteilte Beschreibung und Ablaufdatum angeben. Vorgabe sieben Tage, höchstens ein Jahr. Die Vorschau prüfen und den Raum mit genau diesen Inhalten erstellen.
2. Alternativ in Mission Control **Ausschnitt im Raum teilen** öffnen. Die Auswahl ist zunächst leer. Eigene Projektbeschreibung und einzelne Aufgaben auswählen; die Vorschau zeigt die Texte vor dem Erstellen. Der Raumname wird bewusst selbst vergeben.
3. **Einladungslink erstellen**: Lesen oder Bearbeiten und Gültigkeit wählen. Die Einladung endet spätestens mit dem Raum. Link gezielt weitergeben; es wird keine E-Mail versendet. Der rohe Link wird nur jetzt angezeigt, später kann ein neuer erstellt werden.
4. Empfänger öffnet den Link, meldet sich an und nimmt ihn mit einem selbst gewählten Anzeigenamen ausdrücklich an. Dieser Name ist kein geprüfter Identitätsnachweis. Bis zur ersten Einlösung kann jede angemeldete Person mit dem Link beitreten; danach ist er an dieses Konto gebunden.
5. Leser sehen Inhalte, Bearbeiter können Einträge hinzufügen, bearbeiten, abhaken und löschen. Die Raumleitung verwaltet Einladungen, Rollen und Zugänge. Teilnehmer können den Raum verlassen. Eine neue Einladung ist erforderlich, um einen entzogenen oder verlassenen Zugang wiederherzustellen.

Projekttexte werden als **unabhängige Kopien** gespeichert. Es gibt weder automatische Aktualisierung noch Rückschreiben, private Projektkennungen oder Zugriffsrechte auf die Originalmodule. Nur die in der Vorschau gezeigten Texte werden übertragen. Der Quellenabruf prüft Projekt- und Aufgabenbesitz serverseitig. Keine Anhänge, Dateien, Abstimmungen, Gastzugänge ohne Anmeldung oder automatische Übernahme in Omni/Gedächtnis.

## Ablauf, Schließen und Löschen

Das verpflichtende Ablaufdatum beendet weiteren Teilnehmerzugriff ohne Scheduler; jede API-Abfrage prüft die Zeit. Die Raumleitung kann vorher unwiderruflich schließen. Danach bleibt nur ihr die schreibgeschützte Nachsicht erhalten. Inhalte werden nicht automatisch gelöscht. **Raum endgültig löschen** entfernt nach Bestätigung den Raum einschließlich Einträgen, Mitgliedschaften und Einladungen. Private Originale bleiben erhalten. Bereits angefertigte Kopien oder Screenshots lassen sich nicht zurückrufen.

Einladungswiderruf verhindert neue Einlösungen; bereits beigetretenen Personen wird der Zugang separat unter Teilnehmer entzogen. Rechteentzug und Raumänderungen werden serverseitig bei jeder Anfrage durchgesetzt. Die Oberfläche lädt alle 15 Sekunden sowie beim Fensterfokus neu; bei einem Zugriffsfehler werden keine zwischengespeicherten Inhalte weiter angezeigt. Bereits zuvor geladene Inhalte lassen sich technisch nicht aus fremden Geräten zurückholen. Es gibt keine Offline-Schreibfunktion oder Echtzeit-Sockets. Versionskonflikte fordern zum Neuladen auf und überschreiben nichts still.

## Einrichtung und Datenfluss

Vorhandene `DATABASE_URL` und Clerk-Konfiguration werden verwendet; keine neuen Anbieter-Schlüssel. Alle `/api/shared-rooms`-Routen liegen hinter Clerk. Benutzerkennungen kommen ausschließlich aus der geprüften Sitzung. Raum- und Objektberechtigungen stehen in den jeweiligen SQL-Anweisungen. Schreibaktionen, Beitritt, Schließen und Rechteentzug laufen unter derselben Datenbanksperre je Raum in einer Transaktion, auch bei mehreren Serverinstanzen. Ein Detailabruf prüft Zugriff und liefert Inhalte in einem einzigen SQL-Snapshot.

Einladungsgeheimnisse sind zufällige 256-Bit-Werte; die Datenbank speichert nur SHA-256-Hashes. Das Geheimnis steht im URL-Fragment, nicht in Query oder Pfad und wird nicht beim normalen Seitenabruf an den Server gesendet. Vor Clerks Hash-Anmeldung wird es für höchstens eine Stunde im Sitzungsspeicher des Tabs gehalten und aus der Adresse entfernt. Erst die authentifizierte Vorschau bzw. Annahme sendet es als POST-Inhalt an die Raum-API. Annahme oder Verwerfen entfernt den lokalen Zwischenspeicher. Gültigkeit und Widerruf bleiben unabhängig davon serverseitig wirksam. Sitzungsspeicher muss im Browser verfügbar sein, um den Link über eine erneute Anmeldung zuverlässig zu behalten.

Vier neue Tabellen werden beim ersten Erstellen additiv unter Sperre eingerichtet: `v2_shared_rooms`, `v2_room_members`, `v2_room_invites`, `v2_room_items`. Optional steht `docs/sql/GEMEINSAME-RAEUME.sql` zur Verfügung. Kein `db:push`, keine Änderung oder Bereinigung vorhandener Tabellen. Grenzen: 100 eigene Räume inklusive geschlossener Nachsicht, 50 aktive Teilnehmer je Raum, 20 gleichzeitig offene Einladungen, 200 Einträge je Raum, 5.000 Zeichen je Text, 100 auswählbare Projektaufgaben. Grenzen werden serverseitig geprüft; Einträge werden nicht still abgeschnitten. Entfernte Teilnehmer-/Einladungsdatensätze bleiben bis zur Raumlöschung zur Abwehr alter Links bestehen.

## Prüfung und produktive Abnahme

Automatisierte Tests führen die tatsächlichen parameterisierten SQL-Anweisungen gegen isoliertes PostgreSQL/WASM aus. Sie prüfen Besitzertrennung, Kopien, wiederholte Anfragen, gehashte Einladungen, Ablauf, Einmaligkeit, Rollen, entzogene Zugänge, alte Linkwiederholungen nach Herabstufung, Versionskonflikte, fremde Objektkennungen, Schließen und kaskadierende Löschung. API-Tests prüfen zusätzlich Clerk-Grenze und Eingaben. Browserprüfungen verwenden simulierte Konten/API-Antworten und decken Freigabevorschau, Liste/Pinnwand, Einladungen, Leseransicht, Zugriffsfehler sowie Desktop/Mobil ab.

Lokaler Prüfstand am 21.10.2026: 159 automatisierte Tests erfolgreich, Produktionsbuild erfolgreich, Lint ohne Fehler mit den sieben bestehenden Fast-Refresh-Warnungen. Die Desktop-/Mobilprüfung (1440 bzw. 390 Pixel) besteht einschließlich Hash-Linköffnung im bereits geöffneten Modul und dem Ausblenden zuvor geladener Inhalte nach Zugriffsfehler.

Prüfablauf für die produktive Mehrkonto-Abnahme (Nutzerrückmeldung siehe unten): Mit Konto A Raum erstellen, ein einzelnes Projekt-To-do bewusst kopieren und Konto B mit Leserecht einladen. Mit B anmelden, ausdrücklich annehmen, private Inhalte von A dürfen nirgends zugänglich sein. A stellt auf Bearbeiten um; B ändert einen Eintrag. A entzieht B den Zugang; B darf weder neu laden noch schreiben, und der alte Link darf den Zugang nicht wiederherstellen. Zusätzlich eine offene Einladung widerrufen, einen zweiten Raum kurz ablaufen lassen, einen Raum schließen und schließlich einen Testraum endgültig löschen. Originalprojekt prüfen: unverändert.

Dies ersetzt nicht den vom Nutzer verbindlich beauftragten vollständigen App-Test nach den übrigen vereinbarten Änderungen. Das übergreifende Arbeitsgedächtnis/Missionsarchiv bleibt ein eigenes offenes Paket.


### Nutzerrückmeldung · 21.10.2026

Der Nutzer bestätigt das Speichern eines Listeneintrags sowie Einladungslink und Beitritt mit einem Testkonto. Nach weiteren eigenen Tests bestätigt er: „alles getestet und funktioniert alles gut“. Die produktive erste Version ist damit vom Nutzer live abgenommen. Die Rückmeldung ist kein einzeln protokolliertes Ergebnis jedes oben genannten Sonderfalls. Der vollständige App-Test nach den restlichen Änderungen bleibt separat eingeplant.
