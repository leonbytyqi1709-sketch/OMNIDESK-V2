# Omnis persönliches Gedächtnis

Das Gedächtnis speichert ausdrücklich ausgewählte Vorlieben, Wissen und Entscheidungen. Omni kann passende aktive Einträge in späteren Chatantworten berücksichtigen. Dies ist der erste Ausbau des größeren V2-Arbeitsgedächtnisses; eine automatische Aufgabenhistorie, Mission Control, ein vollständiges Missionsarchiv oder allgemeines Undo sind damit noch nicht umgesetzt.

## Bedienung

Im Modul **Omni** öffnet **Gedächtnis** (mobil **Wissen**) die private Übersicht. **Neue Erinnerung** erstellt einen Entwurf mit Titel, Inhalt, Art, optionaler Projektbindung und bevorzugter Berücksichtigung. Erst **Erinnerung speichern** schreibt den Eintrag. Die drei Arten sind persönliche Vorliebe, Wissen und Entscheidung. Es gibt keine automatische Extraktion aus allen Chats oder anderen Modulen.

Der Knopf **Merken** unter einer Chatnachricht übernimmt deren Inhalt in einen prüfbaren, bearbeitbaren Entwurf. Überlange Texte werden sichtbar auf die ersten 4.000 Zeichen begrenzt. Aus KI-Antworten übernommene Inhalte sind als abgeleitet gekennzeichnet. Die ursprüngliche Nachricht bleibt über einen Quellenlink erreichbar; ein gelöschter Quellchat wird als fehlend markiert. Eine bewusst separat gespeicherte Erinnerung bleibt beim Löschen ihres Quellchats erhalten.

Suche und Projektfilter durchsuchen den eigenen Bestand. **Bearbeiten** erzeugt beim Speichern eine neue Version. Unter **Versionen** sind die letzten 50 Stände einsehbar; **Als Entwurf übernehmen** lädt einen früheren Stand in das Formular. Erst erneutes Speichern legt ihn als neue aktuelle Version ab. Veraltete Tabs können Änderungen nicht still überschreiben.

**Archivieren** behält Inhalt und Versionen, schließt den Eintrag aber von neu geladenem KI-Kontext aus. **Wieder aktivieren** nimmt ihn wieder auf. **Löschen → Endgültig löschen** entfernt Eintrag und sämtliche zugehörigen Gedächtnisversionen. Bereits gespeicherte Chatnachrichten/-antworten bleiben bestehen und können den alten Inhalt noch enthalten. Für Antworten ohne bisherigen Gesprächskontext einen neuen Chat starten; das Gedächtnis bei Bedarf zusätzlich ausschalten. Bereits laufende KI-Anfragen oder bereits an einen Anbieter übermittelte Inhalte lassen sich dadurch nicht nachträglich zurückrufen.

## Chat und Projektgrenzen

Unter dem Chat lässt sich **Gedächtnis für neue Antworten nutzen** ausschalten. Diese Präferenz wird pro Nutzer im aktuellen Browser gespeichert und bei jeder Nachricht ausdrücklich an den Server gesendet. Ältere Clients ohne Gedächtnisoptionen verwenden es standardmäßig nicht.

**Projektkontext** wählt ausdrücklich das Projektwissen für das jeweilige Gespräch. Ohne Auswahl kommen ausschließlich persönliche, nicht projektgebundene Erinnerungen infrage. Andere Projekte und fremde Nutzer bleiben ausgeschlossen. Wird ein Projekt gelöscht, werden seine Erinnerungen nicht zu persönlichen Erinnerungen umgewandelt. Sie bleiben in der Übersicht als nicht mehr zugeordnet sichtbar und sind vom Chatkontext ausgeschlossen. Sie lassen sich archivieren, löschen oder ausdrücklich neu zuordnen.

Unter neuen KI-Antworten zeigt eine aufklappbare Angabe, welche Eintrags-IDs und Versionen als Gedächtniskontext mitgesendet wurden. Das ist kein Beweis, dass das Modell jeden dieser Einträge tatsächlich verwendet hat. Wurde ein Eintrag später verändert, archiviert oder gelöscht, wird dies beim erneuten Abruf erkennbar. Der Nachweis speichert keine zusätzliche Kopie des Erinnerungsinhalts. Bei älteren Antworten oder fehlender Speicherung gibt es keinen nachträglich erfundenen Nachweis.

Die Auswahl erfolgt ohne zusätzliche KI-Anfrage oder Embeddings: Stichwortübereinstimmung in Titel/Inhalt, persönliche Vorlieben, bevorzugte Einträge und ausdrücklich gewählter Projektkontext. Fragen nach dem Gedächtnis bzw. gemerktem Wissen können einen allgemeinen Ausschnitt anzeigen. Höchstens acht vollständige Einträge und circa 9.000 serialisierte Zeichen werden mitgesendet; diese Auswahl ist keine vollständige Bestandsauskunft. Für alle Einträge die Gedächtnisübersicht öffnen. Die Suche ist bewusst eine begrenzte Stichwortsuche, keine garantierte semantische Erinnerung an jeden ähnlichen Begriff.

Der normale Chat erhält weiterhin den jüngsten Gesprächsverlauf: der bisherige Fehler, die ersten statt der letzten 20 Nachrichten zu laden, ist korrigiert. Erinnerungen sind zusätzlicher Kontext. Sie sind keine aktuellen Live-Daten und keine ausführbaren Aufträge. Aktionen bleiben weiterhin an den separaten Vorschlags- und Bestätigungsablauf gebunden. Briefing und Aktionsplaner erhalten in diesem Schritt keinen zusätzlichen Gedächtniskontext.

## Einrichtung und Daten

Keine neuen Provider-Variablen: Der bestehende Omni-KI-Anbieter wird verwendet. Beim Erstellen oder Bearbeiten eines Eintrags gibt es keinen KI-Aufruf. Bei aktivem Gedächtnis werden ausgewählte gespeicherte Inhalte mit der nächsten Chatfrage an diesen Anbieter übermittelt. Keine Passwörter, Tokens, Wiederherstellungscodes oder Vault-Klartexte speichern. Aus anderen Modulen wird nichts heimlich übernommen.

Beim ersten Öffnen der Übersicht werden additiv eingerichtet:

- `v2_omni_memories`: aktuelle eigene Erinnerungen und Quellenbezug.
- `v2_omni_memory_versions`: gespeicherte frühere Stände; Löschen des Eintrags entfernt sie per Kaskade.
- `v2_omni_memory_receipts`: Gedächtnis-IDs/Versionen pro Antwort; Löschen des Chats entfernt diese Nachweise per Kaskade.

Die Datenbankrolle benötigt CREATE-Rechte. Alternativ [das Einrichtungsskript](sql/OMNI-GEDAECHTNIS.sql) vorab ausführen. Bestehende Tabellen/Spalten werden nicht verändert. Das Original-Repository wird nicht bearbeitet. Die Tabellen liegen in der konfigurierten OMNIDESK-Datenbank und sind keine lokale Browserablage; sie besitzen die üblichen Zugriffs- und Backup-Eigenschaften dieser Datenbank.

Höchstens 500 Erinnerungen je Nutzer einschließlich Archiv, Titel bis 160 Zeichen, Inhalt bis 4.000 Zeichen. Versionen bleiben bis zum Löschen des zugehörigen Eintrags erhalten; die Oberfläche zeigt davon die letzten 50. Alle API-Abfragen und Schreibaktionen prüfen den aus der Sitzung abgeleiteten Besitzer. Projekt- und Chatquellen müssen beim Speichern zugänglich sein. Quellenlinks und Suchergebnisse können keine fremden Chats oder Projektinformationen freigeben. Neue Einträge verwenden eine Request-ID für wiederholbare Speicherung ohne Duplikate. Updates und Löschen verlangen die angezeigte Version.

Fällt das Gedächtnis aus, kann der normale Chat ohne zusätzliches Gedächtnis fortgesetzt werden; die Antwort wird entsprechend gekennzeichnet. Ein Ausfall bedeutet nicht, dass keine Erinnerungen gespeichert sind. Das Modell erhält klare Regeln, gespeicherte Inhalte als Daten zu behandeln und keine dauerhafte Speicherung, Löschung oder ausgeführten Aktionen vorzutäuschen. Die eigentliche Speicherung erfolgt ausschließlich über die geprüften APIs und Formulare.

## Prüfung nach Deployment

Lokal geprüft werden echte parametrisierte Datenbankabfragen gegen PostgreSQL/WASM, Besitzer- und Projekttrennung, Quellen, Versionen, Archiv, Löschkaskaden, Kontextlimits, API-Authentifizierung und der tatsächliche Chat-Endpunkt mit aufgezeichnetem Test-Anbieteraufruf. Die Browserprüfung mit Beispieldaten deckt Entwurf/Speichern, Chat-Nachweise, Bearbeiten, Versionsentwurf, Archiv, Abschalten, Quellen-Navigation, Löschen sowie Desktop und Mobilgerät ab.

Live-Test: Eine persönliche Vorliebe „Bitte kurz auf Deutsch mit konkreten Beispielen antworten“ speichern, einen neuen Chat öffnen und eine Frage stellen. Den mitgesendeten Gedächtniskontext unter der Antwort öffnen. Danach mit einer projektspezifischen Erinnerung die ausdrückliche Projektauswahl prüfen. Archivieren/Abschalten in einem neuen Chat kontrollieren, damit frühere Chattexte den Test nicht verfälschen. Der echte Anbieter und produktive Kontodaten müssen nach dem Deployment gemeinsam abgenommen werden.
