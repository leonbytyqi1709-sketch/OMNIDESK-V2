# Omni: kurz und natürlich antworten

Nutzerauftrag vom 21.10.2026: Omni soll standardmäßig knapp und natürlich wie ein normaler Gesprächspartner antworten. Ungefragte Hintergrundinformationen, Projektberichte und lange Erklärungen stören. Kürze hat für den Nutzer höchste Priorität.

## Verhalten

- Standard: meist 1–3 kurze Sätze, direkt zur aktuellen Frage. Keine regelmäßigen Einleitungen, Überschriften, Zusammenfassungen oder Zusatzangebote.
- Begrüßungen, Dank und einfacher Smalltalk: 1–2 kurze Sätze. Beispiel: „Hey Chat wie geht es dir so?“ → „Hey! Alles klar hier – und bei dir?“ Die konkrete Antwort formuliert weiterhin der konfigurierte Anbieter.
- Mehr Details, Schrittfolgen und vollständige Skripte sind bei entsprechendem aktuellem Auftrag möglich. Bestehende lange Antworten oder gespeicherte Vorlieben für ausführliche Texte bestimmen nicht mehr den Standard.
- Bei klar erkanntem, alleinstehendem Smalltalk werden dem Anbieter weder frühere Chatnachrichten noch gespeicherte Erinnerungen mitgegeben. Er erhält die allgemeine Verhaltensanweisung und die aktuelle Nachricht. Chatverlauf und Erinnerungen bleiben gespeichert. Automatische Erinnerungsextraktion wird für solche Nachrichten übersprungen; das Antwortbudget beträgt 160 Tokens.
- Gemischte Nachrichten wie „Hallo Omni, erkläre mir DNS“ bleiben normale Anfragen und behalten den begrenzten Gesprächsverlauf. Die Smalltalk-Erkennung ist bewusst eng; unbekannte Formulierungen fallen auf den normalen knappen Antwortstil zurück.
- Für sonstige Anfragen ist Erinnerungsrelevanz Voraussetzung. Pinning und Projektauswahl gewichten passende Treffer, erzwingen aber keine fachfremden Einträge mehr. Sprach-/Antwortstilpräferenzen dürfen passen; beliebige sonstige Vorlieben werden nicht pauschal angehängt. Ausdrückliche Erinnerungsfragen können weiterhin einen begrenzten eigenen Überblick erhalten. Projektgrenzen und Opt-out gelten weiterhin.
- Fachantworten und ausdrücklich angeforderter Code werden nicht mechanisch nach einer festen Zeichen-/Satzanzahl abgeschnitten. Die Kürze wird über die serverseitige Anweisung gesteuert; die tatsächliche Umsetzung bleibt modellabhängig.
- Fehlende KI-Konfiguration, Verbindungsfehler und Anbieterfehler erzeugen kurze Hinweise statt Einrichtungstutorials oder langer roher Anbieterdiagnosen im Chat. Der bestehende Schlüssel-Failover bleibt erhalten.

Die Chatoberfläche hat kürzere Einstiegsvorschläge und einen knappen Begrüßungstext. Leere oder ausgeschaltete Gedächtnisquellen werden nicht mehr unter jeder Antwort eingeblendet; mitgesendete Quellen bleiben unter **Erinnerungen** aufklappbar, fehlgeschlagener Kontext bleibt erkennbar. Der wiederholte Hilfstext unter **Merken** entfällt; die Schaltfläche öffnet weiterhin einen prüfbaren Entwurf.

## Grenzen und Prüfung

Keine neue KI-Konfiguration, keine Datenmigration und kein neues Modul. Aktionen benötigen weiterhin den getrennten Vorschau-/Bestätigungsweg. Der normale Chat behauptet weder ausgeführte Änderungen noch selbst geschriebene Erinnerungen. Der entfernte Arbeitsgedächtnis-/Archivbereich wird nicht wieder eingeführt.

Tests führen die tatsächliche Chat-Route gegen isoliertes PostgreSQL/WASM und einen kontrollierten Anbieter aus. Sie prüfen Smalltalk ohne Projekt-/Verlaufskontext, erhaltene Originalnachrichten, passende Erinnerungen, unveränderte vollständige Skripte, kurze Fehlerhinweise sowie vorhandene Aktions-/Gedächtnisgrenzen. Sie prüfen den tatsächlichen Anbieterauftrag und die Speicherung, nicht die Qualität eines live generierten Textes. Die produktive Antwortqualität wird nach Bereitstellung mit dem Nutzer und seinem konfigurierten Modell geprüft.

## Nutzerabnahme der kurzen Antworten

Der Nutzer hat die bereitgestellte Version am Abend des 21.10.2026 in seiner angemeldeten Sitzung mit seinem konfigurierten Modell ausprobiert und das Ergebnis ausdrücklich bestätigt: „Oke klappt er hat kurz geantwortet wie es mein Wunsch war“. Am 22.10.2026 hat er diese Bestätigung im Rahmen der Übergabe an die neue Entwicklungsumgebung erneut bekräftigt.

Der Smalltalk-Prüfschritt („Hey Omni, wie geht es dir so?“) ist damit erledigt und wird nicht erneut als offener nächster Schritt geführt. Die Bestätigung betrifft diesen Fall und die gewünschte Kürze, nicht die Qualität jeder möglichen Modellantwort. Die Kürze bleibt bei künftigen Änderungen erhalten; kein langer Persona-Prompt und keine ungefragten Statusberichte.

Offen bleiben der begonnene Rundgang (docs/V2-RUNDGANG.md) und danach der verbindliche vollständige App-Test.
