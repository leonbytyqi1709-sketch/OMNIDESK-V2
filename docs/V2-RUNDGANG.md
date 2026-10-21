# Gemeinsamer Rundgang durch OMNIDESK V2

Der Nutzer wünscht nach Umsetzung der vereinbarten Pakete eine Einführung in alle neuen Module und Verbesserungen. Im Gespräch jeweils nur einen nächsten Bedienungsschritt geben und dessen Ergebnis abwarten. Diese Übersicht dient als Leitfaden; sie ist keine bereits durchgeführte Nutzerabnahme.

| Bereich | Was hinzugekommen ist | Beispiel für die gemeinsame Vorstellung |
|---|---|---|
| Mission Control | Projekt-Cockpit mit expliziten Verbindungen, Lagebericht, Änderungen seit letztem Besuch, Messwertansichten und Quellen | Eigenes Projekt öffnen und Herkunft sowie Frische einer Meldung nachvollziehen |
| Uptime und Neon | Projektzuordnung, gespeicherte Messungen, Warnungen und Monitoring-Einstellungen; angepasste Uptime-Abstände | Einen aktuellen Messwert von einer alten oder fehlenden Messung unterscheiden |
| Deployments | Zugeordnete Vercel-Bereitstellungen, Status und verfügbare Logs | Letzte Produktionsbereitstellung und zugehörigen Commit ansehen |
| GitHub-Zentrale | Eigene Repositories mit Issues, Pull Requests und Actions im Projektkontext | Einen offenen Punkt und einen Workflow nachvollziehen |
| Kontosicherheit | Dokumentierter Kontenbestand, Anmelde- und Wiederherstellungsangaben | Prüfen, welche Informationen bewusst dokumentiert und welche unbekannt sind |
| Kontenkarte | Gerichtete Beziehungen für Anmeldung/Wiederherstellung und Betrachtung von Abhängigkeiten | Den dokumentierten Anmeldeweg eines Kontos verfolgen |
| Omni-Briefing | Datierter Überblick über Aufgaben, Termine und Projekte beim Öffnen | Eine Aussage über den Link zu ihrem Original prüfen |
| Omni-Chat | Kurze natürliche Antworten, gezielter Kontext und knapper Smalltalk | Eine einfache Begrüßung senden und die echte Antwort prüfen |
| Omni-Aktionen | Vorschläge für unterstützte interne Änderungen mit Vorschau und ausdrücklicher Bestätigung | Eine kleine Testaufgabe vorschlagen, Vorschau lesen und gezielt bestätigen |
| Persönliches Omni-Gedächtnis | Eigene gespeicherte Erinnerungen, Herkunft, Versionen, Projektbezug sowie steuerbare automatische Aufnahme | Einen Eintrag ansehen und entscheiden, ob er für eine Antwort verwendet werden soll |
| Browser-Kommandoebene | Chrome-/Edge-Seitenpanel, bewusste Textauswahl, Quellenanmerkungen, Projektzuordnung und widerrufbare Verbindung | Einen ausgewählten Absatz speichern und in App sowie Projekt wiederfinden |
| Gemeinsame Räume | Eingeladene angemeldete Konten, Rollen, Checkliste/Pinnwand, ausgewählte Projektkopien, Ablauf und Widerruf | Einen Testinhalt teilen und den Unterschied zum privaten Original erklären |
| Notizen und Aufgaben | Versionsprüfung beim Bearbeiten, nacheinander gesendete Notiz-Autosaves, sichtbare Konflikte | Zwei Tabs verwenden und einen veralteten Entwurf erkennen, ohne ihn zu verlieren |

Mail und Internet-Radar wurden auf Nutzerwunsch entfernt. OneDrive bleibt aus der weiteren V2-Planung gestrichen; vorhandener Integrationscode ist dadurch kein neuer Einrichtungsauftrag. Optionaler Neon-SQL-Test bleibt aus. Der Nutzer hat bestätigt, dass kein Radar-Cronjob existiert. Keine erneute Nachfrage dazu.

## Anschließender vollständiger App-Test

Nach der Vorstellung gemeinsam alle vorhandenen Module prüfen, auch Dashboard, Kalender/Booking, Projekte, Kontakte, Befehlsbibliothek, Link-Manager, Fokus/Pomodoro, Cloud-Verbindungen, Einstellungen und Vault. Erst reine Testdaten verwenden. Erstellen/Bearbeiten/Löschen, Navigation und Suche, Modulverbindungen, Rollen, mehrere Tabs, Mobilansicht sowie relevante Anbieterabläufe prüfen. Änderungen an echten Anbieter- oder Infrastrukturzuständen werden dadurch nicht automatisch beauftragt.

Beobachtungen mit Bereich, konkretem Ablauf, erwartetem/tatsächlichem Verhalten und Auswirkung dokumentieren. Erst priorisieren, dann gezielt verbessern. Bereits bestätigte Räume, Chrome und Mission Control müssen nicht ohne Anlass wieder vollständig isoliert abgenommen werden; ihre Verbindungen gehören zum Gesamttest.

Offene Prüfgrenzen ehrlich behandeln: die vollständige App-Abnahme steht noch aus. Ein erfolgreicher Build ersetzt diese Prüfungen nicht. Die früher separat unbestätigte Neon-Scheduler-Abnahme wird durch eine allgemeine Funktionsrückmeldung nicht nachträglich als nachgewiesen erklärt.


Stand des Rundgangs am 21.10.2026: Mission Control wurde vom Nutzer für verstanden erklärt und erneut anhand des OMNIDESK-V2-Cockpits bestätigt. Das danach vorgestellte Arbeitsgedächtnis einschließlich Verlauf, Arbeitsständen und Missionsarchiv wurde vom Nutzer als unnötig zurückgenommen und wird entfernt. Diesen Bereich künftig überspringen; persönliche Omni-Erinnerungen und Omni-Briefing bleiben separate Funktionen. Den Rundgang mit den übrigen Bereichen fortsetzen, jeweils ein Bedienungsschritt pro Antwort.


Weitere Rückmeldung im Rundgang: Deployments und GitHub kennt der Nutzer bereits; die Kontenkarte ist verstanden, Kontosicherheit ist bekannt und positiv bewertet. Omni-Aktionen sind ebenfalls bekannt. Aktueller Prüfschritt ist die ausdrücklich gewünschte Kürzung und natürlichere Gesprächsführung im Omni-Chat (docs/OMNI-CHAT.md). Diese Bereiche nicht erneut ohne Anlass erklären.
