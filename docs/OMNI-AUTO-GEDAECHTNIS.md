# Automatisches Merken durch Omni

Omni kann wichtige Angaben aus neuen eigenen Chatnachrichten automatisch als Vorliebe, Wissen oder Entscheidung speichern. Der Nutzer hat diesen Ausbau ausdrücklich beauftragt. Manuelles Merken bleibt zusätzlich erhalten.

## Benutzung

Unter dem Chat ist **Wichtige Angaben automatisch merken** standardmäßig eingeschaltet. Der Schalter wird pro Nutzer im aktuellen Browser gespeichert und bei jeder Nachricht ausdrücklich mitgesendet. **Gedächtnis für neue Antworten nutzen** ausschalten deaktiviert auch die automatische Aufnahme. Ohne neue Option nehmen ältere Clients nichts automatisch auf.

Beispiel: „Ich bevorzuge kurze Antworten mit konkreten Beispielen.“ Unter Omnis Antwort erscheint nach tatsächlicher Speicherung **Automatisch gemerkt** mit dem gespeicherten Wortlaut sowie **Bearbeiten** und **Vergessen**. Eine ausdrückliche Korrektur wie „Ich bevorzuge ab jetzt ausführliche Antworten“ kann einen vorhandenen Eintrag aktualisieren und erzeugt eine neue Gedächtnisversion.

Bei Unsicherheit, möglichem Widerspruch oder fehlender eindeutiger Korrektur bleibt der Punkt zunächst ein Vorschlag: **Soll Omni sich das merken?** mit **Ja, merken** und **Nicht merken**. Erst die Bestätigung schreibt ihn ins Gedächtnis. Die Zuordnung zum bestehenden Wissen ist modellgestützt und nicht fehlerfrei; bei unpassendem Ergebnis bearbeiten, vergessen oder die Automatik ausschalten.

**Bearbeiten** öffnet die bestehende Gedächtnisübersicht beim Eintrag. **Vergessen** löscht nach Bestätigung die aktuelle Erinnerung und ihre Gedächtnisversionen; zugehörige gespeicherte Hinweise werden ebenfalls entfernt. Bisherige Chattexte bleiben erhalten. Wird ein Eintrag nach dem Hinweis manuell verändert, zeigt der Hinweis dies an und verweist auf den aktuellen Stand. Er ist keine zusätzliche unveränderliche Inhaltskopie.

Das im Chat ausgewählte Projekt bestimmt den Speicherbereich. Ohne Auswahl entstehen persönliche Erinnerungen; mit Auswahl projektgebundene Erinnerungen. Die Automatik verschiebt kein fremdes oder persönliches Wissen still in ein anderes Projekt. Für die spätere Verwendung gelten weiterhin die ausdrückliche Projektauswahl und die bestehenden Kontextlimits.

## Was wird erkannt?

- Ausschließlich der aktuelle vom angemeldeten Nutzer geschriebene Nachrichtentext; keine KI-Antworten als Tatsachenquelle.
- Vorlieben, längerfristiges Wissen und Projektentscheidungen; keine automatische Übernahme kompletter Gespräche oder anderer Module.
- Gespeicherter Inhalt muss ein exakter zusammenhängender Ausschnitt dieser Nachricht sein. Erfundenes oder frei umformuliertes Modellwissen wird abgelehnt. Ein kurzer Titel wird vom Modell vorgeschlagen.
- Kurze Bestätigungen, normale Wissensfragen ohne eigene Angaben und erkannte Zugangsdaten lösen keinen Erkennungsaufruf aus. Die heuristische Vorauswahl ist bewusst begrenzt; nicht jede mögliche Formulierung wird erkannt.
- Höchstens drei Punkte pro Nachricht. Gleicher normalisierter Wortlaut im selben Bereich wird nicht erneut gespeichert; archivierter identischer Inhalt wird nicht wieder neu angelegt.
- Unsicherheitswörter und Fragen im Ausschnitt erzwingen eine Rückfrage. Automatische Änderungen verlangen zusätzlich ein Korrektursignal und einen unveränderten, aktiven Zieleintrag. Das Modell muss vollständige Aussagen einschließlich Unsicherheit auswählen; die Erkennung ersetzt keine menschliche Prüfung wichtiger Fakten.

Bestehende archivierte Einträge werden nicht automatisch überschrieben oder reaktiviert. Ein zwischenzeitlich geänderter Eintrag bleibt unangetastet; der Hinweis fordert zur Prüfung auf. Ein gelöschtes Projekt verhindert die Übernahme offener Vorschläge. Das bestehende Limit von 500 Erinnerungen einschließlich Archiv bleibt bestehen.

## Technik und Datenfluss

Nach erfolgreicher KI-Chatantwort wird die gespeicherte Nutzernachricht geprüft. Bei geeigneten Angaben folgt ein zusätzlicher, auf sechs Sekunden begrenzter Aufruf des vorhandenen KI-Anbieters, mit maximal 64 KB Antwort und ohne Tools oder Weiterleitungen. Aktuell wird dafür der erste konfigurierte Schlüssel aus OPENAI_API_KEY/AI_API_KEYS verwendet. Es werden keine neuen Schlüssel benötigt. Dieser zusätzliche Aufruf kann die Antwortzeit verlängern und nutzt das vorhandene Anbieter-Kontingent.

Für Zuordnung und Widerspruchserkennung erhält der Anbieter die aktuelle Nutzernachricht sowie maximal 80 aktive eigene Erinnerungen aus genau diesem Speicherbereich, jeweils mit ID, Titel, Art und einem Inhaltsausschnitt von bis zu 400 Zeichen. Projektübergreifender oder fremder Bestand und archivierte Erinnerungen sind ausgeschlossen. Die Auswahl enthält keine Vault-Daten; keine Geheimnisse in Chatnachrichten eingeben. Einfache Zugangsdatenmuster werden zusätzlich ausgeschlossen, was keine vollständige Geheimniserkennung garantiert.

Zwei additive Tabellen werden beim ersten automatischen Aufnahmeversuch eingerichtet:

- `v2_omni_memory_captures`: Besitzer, Quell-/Antwortnachricht und Bearbeitungsstatus; die eindeutige Quelle verhindert erneute Extraktion desselben Vorgangs.
- `v2_omni_memory_auto_events`: offene Vorschläge und Zuordnung zu tatsächlich gespeicherten Erinnerungen/Versionen. Nach Übernahme oder Ablehnung wird der gesonderte Vorschlagstext entfernt.

Einrichtungsskript: [OMNI-AUTO-GEDAECHTNIS.sql](sql/OMNI-AUTO-GEDAECHTNIS.sql). Die Datenbankrolle benötigt die bereits für das Gedächtnis erforderlichen CREATE-Rechte. Bestehende Tabellen werden nicht umgebaut. Aktualisierung, Versionssnapshot und Übernahme des Hinweises erfolgen gemeinsam in einer Datenbanktransaktion. Besitzer, Projektbereich und Zielversion werden beim Schreiben geprüft; wiederholte Bestätigung erzeugt keine zusätzliche Version. Gleichzeitige neue Einträge werden pro Besitzer serialisiert.

Ein Fehler der Erkennung darf die bereits gespeicherte Chatantwort nicht verwerfen. Der Chat zeigt eine nicht abgeschlossene Aufnahme an; er behauptet dann keine erfolgreiche Speicherung. Die normalen eigenen Chatnachrichten bleiben als Quelle vorhanden. Es gibt keine rückwirkende Durchsuchung früherer Chats und keinen automatischen Zugriff des Aktionsplaners oder Briefings auf dieses neue Verfahren.

## Prüfung

Lokale PostgreSQL- und Chat-Endpunkt-Tests prüfen tatsächliche Speicherung und Versionierung, Herkunft, Duplikate, Rückfragen, Bestätigung/Ablehnung, veraltete Änderungen, Archiv, Projekt-/Besitzergrenzen, Löschen und Anbieterfehler. Browserprüfungen mit Beispieldaten prüfen Hinweise, Bearbeiten, Abschalten, Bestätigen/Ablehnen, Vergessen und die mobile Darstellung.

Nach Deployment einen neuen Chat öffnen und die Beispielvorliebe schreiben. Den sichtbaren Hinweis mit der Gedächtnisübersicht vergleichen; danach die Automatik ausschalten und eine weitere eigene Angabe testen. Echte produktive Daten und das konfigurierte Modell werden erst damit live abgenommen.
