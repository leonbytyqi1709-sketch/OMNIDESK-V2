# Gesamttest der App

**Stand: 30. Oktober 2026 · https://omnidesk-work.vercel.app**

Alle vereinbarten Änderungen liegen vor. Dieser Plan ist der abschließende
Durchgang durch die gesamte Anwendung: jedes Modul, die Verbindungen zwischen
ihnen und die zentralen Abläufe.

**So gehen wir vor.** Ein Block nach dem anderen, und zwar gemeinsam: Du
machst immer genau einen Schritt und sagst mir, was passiert ist. Erst danach
kommt der nächste. Was auffällt, halte ich in `docs/` fest; am Ende
priorisieren wir die Auffälligkeiten zusammen.

**Vorab einmal prüfen:** Einstellungen → Allgemein, Karte „Fassung". Dort muss
die Fassung dieses Browsers mit der des Servers übereinstimmen. Steht da ein
Hinweis auf eine veraltete Fassung, erst die Seite neu laden — sonst testen wir
alten Code.

---

## 1 · Grundlage

- [ ] **Anmeldung** – abmelden, neu anmelden, Seite landet auf dem Dashboard.
- [ ] **Dashboard** – Kacheln erscheinen, Omni-Briefing begrüßt dich, eine
      Kachel hinzufügen und wieder entfernen.
- [ ] **Seitenleiste** – jedes Modul öffnet sich, nichts bleibt leer.
- [ ] **Einstellungen** – ein Modul abschalten, prüfen, dass es aus der
      Seitenleiste verschwindet, danach wieder einschalten.

## 2 · Produktivität

- [ ] **Notizen** – anlegen, Markdown schreiben, Vorschau ansehen, umbenennen,
      löschen.
- [ ] **Aufgaben** – anlegen mit Frist, Priorität, Schlagwort und Teilaufgabe;
      Status ändern; zwischen Liste und Board wechseln; löschen.
- [ ] **Kalender** – Termin anlegen, im Monat und in der Liste sehen,
      bearbeiten (Dialog scrollt und „Speichern" ist erreichbar), löschen.
- [ ] **Serientermin** – wöchentlich anlegen, einen einzelnen Termin ändern,
      danach die ganze Reihe ändern, Reihe löschen.
- [ ] **Buchungsseite** – öffentliche Adresse in einem Fenster ohne Anmeldung
      öffnen, einen Termin buchen, im Kalender wiederfinden.
- [ ] **Pomodoro** – Fokus auf eine Aufgabe starten, Tab wechseln und
      zurückkommen (Zeit läuft weiter), beenden, Wochenrückblick ansehen, Zeit
      an der Aufgabe prüfen.
- [ ] **Kontakte** – anlegen, bearbeiten, löschen.
- [ ] **Gemeinsame Räume** – Raum anlegen, Einladungslink erzeugen, in einem
      zweiten Fenster beitreten, Liste und Pinnwand nutzen, Raum schließen.

## 3 · Omni

- [ ] **Chat** – eine normale Frage stellen: Antwort ist kurz und natürlich.
- [ ] **Auftrag im Chat** – „Omni, lege eine Aufgabe … bis morgen an":
      Vorschlagskarte erscheint, bestätigen, Eintrag prüfen.
- [ ] **Ablehnen** – einen Vorschlag nicht bestätigen: es passiert nichts.
- [ ] **Aktionen-Knopf** – derselbe Weg über den Knopf, Verlauf der letzten
      Vorschläge sichtbar.
- [ ] **Gedächtnis und Projektbezug** – zuschalten, Wirkung in einer Antwort
      prüfen.

## 4 · IT-Werkzeuge

- [ ] **Projektmanagement** – Projekt anlegen, Board-Spalten nutzen,
      Meilenstein setzen, Projektaufgabe anlegen und verschieben.
- [ ] **Mission Control** – Lagebild über die Projekte stimmt mit den Projekten
      überein.
- [ ] **Browser-Kommandoebene** – im eigenen Chrome: Seitenpanel öffnen,
      Notiz und Aufgabe von einer Webseite anlegen, Quelle wird übernommen.
- [ ] **Befehlsbibliothek** – eigenen Befehl anlegen, über `Strg+K` finden,
      Cheat-Sheet öffnen.
- [ ] **Link-Manager** – Link mit Kategorie anlegen, öffnen, löschen.
- [ ] **Uptime-Monitor** – Dienst anlegen, Prüfung abwarten, Verlauf,
      Antwortzeit und Zertifikatslaufzeit ansehen.
- [ ] **Deployments** – Vercel-Projekte werden geladen und stimmen.
- [ ] **GitHub** – verknüpfte Repositories werden geladen und stimmen.

## 5 · Sicherheit

- [ ] **Passwort-Manager** – Hauptpasswort eingeben, Eintrag anlegen, kopieren,
      sperren, wieder entsperren.
- [ ] **Kontenkarte** – Konto und Verbindung dokumentieren, Karte ansehen.
- [ ] **Kontosicherheit** – Merkmal je Konto setzen, Übersicht prüfen.

## 6 · Cloud

- [ ] **Cloud-Monitoring** – Google Drive verbunden, Auslastung erscheint; MEGA
      prüfen; Microsoft wird nicht mehr angeboten.

## 7 · Was durch alle Module geht

Hier zeigt sich, ob die App zusammenhängt. Dieser Teil ist der wichtigste.

- [ ] **Verknüpfungen** – Notiz mit Projekt verknüpfen; prüfen, dass die
      Verknüpfung an **beiden** Enden steht; Klick springt hin; einen der
      beiden Einträge löschen und prüfen, dass die Verknüpfung verschwindet.
- [ ] **Suche** – `Strg+K`, ein Wort suchen, das in Notiz, Aufgabe und Projekt
      vorkommt: Treffer aus mehreren Modulen, Suchbegriff hervorgehoben,
      Treffer öffnet den Eintrag.
- [ ] **Anhänge** – Datei an eine Notiz hängen (Knopf und Hineinziehen); Bild
      oder Textdatei anklicken: Vorschau öffnet sich im Fenster;
      Herunterladen; Eintrag löschen und prüfen, dass der belegte Platz in den
      Einstellungen zurückgeht.
- [ ] **Fokuszeiten** – Zeit auf eine Projektaufgabe schreiben und am Projekt
      wiederfinden.
- [ ] **Omni über die Module** – Omni eine Notiz **und** einen Termin in einem
      Auftrag anlegen lassen.

## 8 · Abläufe über mehrere Module

- [ ] **Ein Arbeitstag:** Briefing lesen → Aufgabe aus dem Briefing öffnen →
      Fokuszeit darauf starten → Notiz dazu anlegen → beide verknüpfen →
      Aufgabe abschließen.
- [ ] **Ein Projekt:** Projekt anlegen → Projektaufgaben → Kontakt verknüpfen →
      Datei anhängen → Termin dazu anlegen → in Mission Control wiederfinden.
- [ ] **Mobil** – dieselben Wege einmal am Handy: Seitenleiste, ein Dialog, die
      Suche.

---

## Auffälligkeiten

Hier tragen wir ein, was auffällt — mit Modul, was du gemacht hast und was
passiert ist. Am Ende priorisieren wir gemeinsam.

| Modul | Beobachtung | Bewertung |
|---|---|---|
| | | |
