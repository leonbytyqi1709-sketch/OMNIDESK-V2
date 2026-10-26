# Verbesserungen aus dem Gesamttest · 26.10.2026

Der Nutzer hat die produktive V2-Umgebung vollständig durchgesehen und sieben Punkte mit
Änderungswunsch übergeben. Dieses Dokument hält fest, was umgesetzt wurde, was bewusst offen
bleibt und worüber gemeinsam entschieden werden muss.

## Umgesetzt

### 1 · Schreibweise des Produktnamens

Der Name erscheint in der Oberfläche durchgängig als **OMNIDESK** in Großbuchstaben: Sidebar,
mobiler Header und dessen Menü, Command-Palette, Anmeldeseite, öffentliche Buchungsseite,
Browser-Titel, Browser-Benachrichtigungen von Aufgaben und Pomodoro, der Markdown-Export der
Befehlsbibliothek sowie die Texte in den Einstellungen.

**Nicht erfasst:** Die Clerk-Anmeldemaske schreibt weiterhin „In OmniDesk einloggen“ und „weiter
zu OmniDesk“. Dieser Text stammt aus dem Anwendungsnamen in der Clerk-Instanz und lässt sich nur
dort ändern (Clerk-Dashboard → Application name). Kein Code der App erzeugt ihn.

### 2 · Omni-Briefing nur noch auf dem Dashboard

Der Auslöser lag in `AppLayout` über dem Modulinhalt und erzeugte dadurch auf **jeder** Seite eine
zusätzliche Leiste, die das Layout nach unten schob. Die Schaltfläche erscheint jetzt
ausschließlich auf dem Dashboard; in allen anderen Modulen entfällt die Leiste vollständig.

Unverändert bleiben: das automatische Öffnen beim App-Start, sämtliche Inhalte des Briefings,
seine Einstellungen und die Quellenangaben. Der Dialog ist weiterhin überall eingehängt, nur eben
ohne sichtbare Leiste. Die Module bringen ihre Abstände selbst mit, deshalb entsteht durch den
Wegfall keine Lücke und kein Versatz.

### 4 · Terminliste unter dem Kalender

Unter dem Monatsraster steht jetzt der Abschnitt **Anstehende Termine**: alle noch nicht beendeten
Termine, laufende zuerst, danach aufsteigend nach Beginn. Jede Zeile zeigt Titel, Zeitraum,
Ort und Priorität; laufende Termine sind als solche gekennzeichnet.

Ein Klick auf eine Zeile klappt die Details auf — Beschreibung im Originaltext, Ort und Zeitpunkt
der letzten Änderung. Das Bearbeiten bleibt ein bewusster zweiter Schritt über die Schaltfläche
**Termin bearbeiten**, damit Lesen nicht versehentlich zum Ändern führt. Ab neun Terminen wird die
Liste gekürzt und lässt sich vollständig aufklappen. Vergangene Termine bleiben wie bisher im
Monatsraster sichtbar.

### 7 · Ladezeiten

Vier Ursachen wurden gefunden und behoben. Alle Änderungen betreffen ausschließlich das
Ladeverhalten; keine Funktion und keine Anzeige wurde entfernt.

**Das Briefing lud nach jeder Änderung neu.** Die Faktenabfrage des Briefings hatte sich an die
Mutations-Verwaltung von React Query gehängt und wurde nach *jeder* erfolgreichen Änderung in der
gesamten Anwendung ungültig gemacht. Da sie Aufgaben, Projekte, Kalender, Uptime, Neon und
Kontosicherheit in einem Zug zusammenträgt, löste schon ein einzelner Notiz-Autosave diesen teuren
Sammelabruf aus — beim Tippen also laufend. Die Fakten werden jetzt beim Öffnen des Briefings
aktualisiert; die Schaltfläche lädt sie ab 60 Sekunden Alter neu.

**Die Command-Palette lud auf jeder Seite mit.** Befehle und Notizen wurden unabhängig davon
abgerufen, ob die Palette überhaupt geöffnet wird. Beides geschieht jetzt erst beim Öffnen.

**Die Überfälligkeits-Erinnerung lud die Aufgabenliste ohne Zweck.** Sie läuft höchstens einmal
pro Tag. Steht der Tagesmarker bereits, wird die Liste für diesen Zweck gar nicht mehr angefordert.

**Fehlerhafte Antworten wurden dreimal wiederholt.** Jede Abfrage versuchte es bei einem Fehler
dreimal mit steigender Wartezeit. Bei deterministischen Antworten — „nicht angemeldet“, „nicht
gefunden“, „noch nicht eingerichtet“ — verzögerte das die Meldung um mehrere Sekunden, ohne je ein
anderes Ergebnis zu bringen. Genau das war in den Modulen Neon, GitHub und Deployments zu spüren.
Diese Antworten werden nicht mehr wiederholt; echte Server- und Netzfehler weiterhin zweimal.

Zusätzlich zwei Verbesserungen beim Wechsel zwischen Modulen:

- Zwischengespeicherte Daten gelten fünf statt dreißig Sekunden als frisch und werden eine halbe
  Stunde vorgehalten. Ein Modul, das man erneut öffnet, zeigt seine Inhalte damit sofort.
  Änderungen machen ihre eigenen Abfragen weiterhin gezielt ungültig.
- Der Code eines Moduls wird bereits geladen, wenn der Mauszeiger den Sidebar-Eintrag berührt oder
  er den Tastaturfokus erhält. Beim Klick ist er dann meist schon da.

**Prüfgrenze:** Diese Ursachen sind im Code belegt und behoben. Eine Messung des tatsächlichen
Zeitgewinns in der angemeldeten Produktivumgebung steht noch aus und muss vom Nutzer beurteilt
werden.

## Zur gemeinsamen Entscheidung

### 3 · Dashboard-Widgets für die neuen Module

Der Nutzer möchte darüber sprechen, statt sie gesetzt zu bekommen. Sinnvolle Kandidaten wären ein
Widget für Mission Control mit den Projekten samt Ampelzustand, eines für die gemeinsamen Räume
mit laufenden Räumen und Ablaufdatum, eines für die Browser-Quellen der letzten Tage und eines für
die offenen Omni-Aktionen. Nicht jedes davon verdient einen Platz; das Dashboard lebt von wenigen
aussagekräftigen Kacheln. Offen.

### 5 · Browser-Kommandoebene mit echtem Nutzen

Der Nutzer empfindet das Modul als zu schwach. Gewünscht ist, die Kommandoebene aus OMNIDESK
heraus zu konfigurieren — etwa eine eigene Seitenleiste im Browser mit selbst gewählten Modulen,
Schnellzugriffen und eigenen Befehlen. Das ist ein eigenes Paket mit Entwurf, Abstimmung und
neuer Erweiterungsversion. Offen.

### 6 · Werkzeug für Proxmox VE — zurückgestellt

Der Nutzer hat das Thema am 26.10.2026 selbst zurückgestellt: Der Aufwand stünde in keinem
Verhältnis zum Nutzen, weil er nur wenige Server betreibt und das Werkzeug selten gebraucht
würde. Nicht erneut anbieten und nicht als offene Aufgabe führen. Eine spätere Wiederaufnahme
bleibt dem Nutzer überlassen.

## Offen aus der laufenden Arbeit

- Der fehlende Konflikthinweis in den Notizen ist weiterhin offen
  (siehe [GESAMTTEST-AUFFAELLIGKEITEN.md](GESAMTTEST-AUFFAELLIGKEITEN.md), Punkt 1).
- Das Neon-Monitoring ist nach wie vor nicht eingerichtet; ohne Einrichtung bleiben Historie und
  Diagramme leer.
