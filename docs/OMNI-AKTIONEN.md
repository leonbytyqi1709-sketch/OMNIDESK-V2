# Omni-Aktionen

Omni kann konkrete interne Änderungen vorschlagen und nach Bestätigung ausführen. Im Modul **Omni** befindet sich oben der Knopf **Aktionen**. Der normale Wissenschat bleibt separat und führt selbst keine Änderungen aus.

## Ablauf

1. Unter **Aktionen** einen vollständigen Auftrag eingeben und die passende Zeitzone wählen. Beispiel: „Erstelle die persönliche Aufgabe Backup prüfen für morgen mit hoher Priorität.“
2. **Vorschlag erstellen** lädt ausschließlich eigene Aufgaben und Projekte als Zuordnungskontext. Omni liefert einen Vorschlag oder eine Rückfrage. Eine Rückfrage wird durch einen ergänzten vollständigen Auftrag beantwortet; es wird kein verborgener Gesprächsverlauf gesendet.
3. Ziel, alte/neue Werte und konkrete Datumsangaben prüfen. Bis hierhin werden nur Vorschlag und Planungsbegrenzung gespeichert; Aufgaben, Projekte und Termine bleiben unverändert.
4. **Jetzt ausführen** bestätigt alle angezeigten Schritte gemeinsam. **Abbrechen** verwirft einen offenen Vorschlag. Vorschläge laufen nach 15 Minuten ab.
5. Das Ergebnis enthält Links zu den betroffenen Einträgen. Die letzten 20 Vorschläge erscheinen im Verlauf. Bei unterbrochener Antwort zuerst den Verlauf neu laden; derselbe Vorschlag kann ohne doppelte Ausführung erneut bestätigt werden.

## Unterstützter Umfang

- Persönliche Aufgaben anlegen und ändern: Titel, Beschreibung, Priorität, Status und Fälligkeit. Fälligkeiten sind Kalendertage, die serverseitig wie im bisherigen Aufgabenformular am Ende des jeweiligen Tages (23:59:59) in der gewählten Zeitzone gespeichert werden. Tags und Unteraufgaben werden nicht verändert.
- Projektaufgaben anlegen und ändern: Titel, Priorität und Board-Status. Sie gehören zum jeweiligen bestehenden Projekt. Das bisherige Projektboard besitzt kein Fälligkeits- oder Beschreibungsfeld. Omni ist deshalb angewiesen, bei solchen Wünschen zuerst eine Alternative zu erfragen; zusätzliche Felder werden vom Server abgelehnt.
- Interne Kalendertermine anlegen: Titel, Beschreibung, Ort, Priorität, Beginn und Ende. Beginn und Dauer/Ende müssen aus dem Auftrag hervorgehen. Keine Einladungen, externe Kalendersynchronisation oder garantierte Konfliktfreiheit. Eine mögliche Überschneidung wird in der Vorschau erwähnt.
- Projektnotizen ergänzen: Text wird mit einem Absatz unten an die vorhandene Projektbeschreibung angehängt. Keine separate Notizsammlung. Das bisherige Beschreibungslimit von 10.000 Zeichen bleibt erhalten.

Höchstens fünf Schritte pro Vorschlag. Mehrdeutige Aufträge sollen Rückfragen auslösen; die Vorschau bleibt entscheidend, weil eine KI einen Wunsch falsch verstehen kann. Keine Löschaktionen, externen Anbieteraktionen, Kontoänderungen, beliebigen URLs oder SQL-Anweisungen. Das ist die erste Ausführungsfunktion für Omni, kein allgemeiner Agent mit Zugriff auf alle Module.

## Einrichtung

Keine neuen Provider-Schlüssel erforderlich. Der vorhandene Omni-Anbieter wird über `OPENAI_API_KEY` oder `AI_API_KEYS` und optional `AI_BASE_URL`/`AI_MODEL` wiederverwendet. Ohne Anbieter lässt sich der Verlauf lesen, aber kein neuer KI-Vorschlag erstellen. Es gibt keine automatische Ersatz-Ausführung bei Anbieterfehlern.

Der erste Aufruf richtet additiv `public.v2_omni_action_plans`, `public.v2_omni_action_limits` und die Funktion `public.omnidesk_execute_actions_v2(text,uuid)` ein. Dafür benötigt die Datenbankrolle CREATE-Rechte. Die Funktion arbeitet als SECURITY INVOKER mit normalen Rechten der aufrufenden Datenbankrolle. Es werden keine bestehenden Tabellen oder Spalten umgebaut. Alternativ vorab [das Einrichtungsskript](sql/OMNI-AKTIONEN.sql) mit der passenden Datenbankrolle ausführen. Das Drizzle-Schema spiegelt die neuen Tabellen; die Ausführungsfunktion wird durch dieses Skript bzw. die automatische Einrichtung verwaltet.

## Datenfluss und Ausführung

Der ausdrückliche Aktionsauftrag übermittelt den eingegebenen Text sowie IDs, Titel/Namen, Status, Priorität und gegebenenfalls Fälligkeiten der letzten maximal 200 eigenen persönlichen Aufgaben, 100 Projekte und 200 Projektaufgaben an den bestehenden KI-Anbieter. Bestehende Beschreibungen, Vault-Inhalte, Wiederherstellungscodes, Anbieter-Tokens und fremde Kontodaten werden nicht als KI-Kontext geladen. Keine Geheimnisse in den Auftrag eingeben. Bei größerem Bestand ist der Kontext ein begrenzter Ausschnitt; nicht enthaltene Ziele können nicht geändert werden und erfordern einen anderen Auftrag bzw. die normale Moduloberfläche.

Pro Nutzer kann alle 20 Sekunden eine neue Planung gestartet werden. Höchstens zwei konfigurierte Schlüssel werden versucht, jeweils mit zwölf Sekunden Timeout, begrenzter Antwortgröße und ohne Weiterleitungen. Der Anbieter erhält keine ausführbaren Tools. Sein JSON muss einer festen erlaubten Form entsprechen. Unbekannte IDs, zusätzliche Felder und nicht unterstützte Aktionen werden abgelehnt. Relative Daten erhalten das aktuelle Ortsdatum vom Server. Termin-Ortszeiten werden auf dem Server aufgelöst; nicht existierende oder doppelte Uhrzeiten bei Zeitumstellungen werden abgelehnt.

Vorschläge werden serverseitig als unveränderliche Operationen mit Vorschau, Ziel-IDs und Zustandsfingerabdrücken gespeichert. Die Bestätigung enthält nur die Vorschlags-ID; der Browser kann dabei keine Operationen oder Nutzerkennung nachreichen. Die Nutzerkennung stammt immer aus der geprüften Sitzung. Aufträge, Vorschauen, nötige neue Feldwerte und Ergebnislinks bleiben für den benutzerbezogenen Verlauf gespeichert; es gibt bisher keine automatische Löschung dieses Verlaufs.

Die Ausführung läuft vollständig innerhalb einer PostgreSQL-Funktion und damit einer Datenbanktransaktion. Der Vorschlag und betroffene bestehende Zeilen werden gesperrt; Besitz und Zustand werden erneut geprüft. Bei einer zwischenzeitlichen Änderung oder einem entfernten Ziel wird die gesamte Ausführung zurückgerollt. Nicht angeforderte Felder bleiben bestehen. Der Vorschlag wird erst nach allen erfolgreichen Schritten als ausgeführt markiert. Wiederholte Bestätigungen desselben Vorschlags liefern das gespeicherte Ergebnis; ein neuer Vorschlag ist dagegen ein neuer Auftrag und kann erneut ähnliche Daten erzeugen. Abbrechen ist kein nachträgliches Rückgängigmachen einer bereits ausgeführten Änderung.

## Prüfung

Automatisierte Prüfungen verwenden die echten parametrisierten Neon-Abfragen gegen isoliertes PostgreSQL/WASM: alle sechs Operationsarten, Besitzertrennung einschließlich Projektzuordnung, spätere Änderungen, vollständiges Rollback, wiederholte und gleichzeitige Bestätigung, Abbruch, Ablauf, Planungsbegrenzung und idempotente Request-IDs. Weitere Tests prüfen Ortszeiten/Sommerzeit, exakte Vorschauwerte, strenge Modellausgabe, gefälschte API-Aufrufe und angemeldete Routen.

Die Browserprüfung mit Beispieldaten prüft Desktop und Mobilgerät: Vorschau ohne Ausführung, alte/neue Werte, Bestätigung und Ergebnis, erneutes Öffnen ohne weitere Ausführung, Abbrechen und Rückfragen. Echte produktive Daten und das konfigurierte KI-Modell bleiben nach dem Deployment live zu prüfen. Empfehlenswerter erster Test: eine eindeutig benannte Testaufgabe planen, Vorschau prüfen, einmal bestätigen und den Ergebnislink öffnen. Das Testobjekt kann anschließend über die normale Aufgabenoberfläche entfernt werden.
