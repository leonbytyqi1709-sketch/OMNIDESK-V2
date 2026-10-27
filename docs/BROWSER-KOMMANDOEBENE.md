# Browser-Kommandoebene

Die erste Version ergänzt OMNIDESK um das Modul **Browser-Kommandoebene** (`/browser-desk`) und ein Seitenpanel für Google Chrome ab Version 116. Aktuelle Chromium-basierte Edge-Versionen können dasselbe Paket verwenden. Der Nutzer hat Google Chrome als seinen Browser bestätigt. Es gibt keine Browser-Store-Veröffentlichung; die Erweiterung wird bewusst als entpacktes Paket installiert.

## Installation in Chrome

1. In der angemeldeten V2-App die **Browser-Kommandoebene** öffnen.
2. **Chrome-Erweiterung herunterladen** wählen und die ZIP-Datei in einen festen Ordner entpacken.
3. In Chrome `chrome://extensions` öffnen und **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** wählen und den Ordner auswählen, in dem `manifest.json` liegt.
5. Das OMNIDESK-Symbol über das Erweiterungsmenü anheften und öffnen.
6. Im Seitenpanel **Mit OMNIDESK verbinden** wählen. Die angemeldete App öffnet eine Freigabe. **Erweiterung ausdrücklich freigeben** bestätigen.
7. Zur Webseite wechseln, Text markieren und das OMNIDESK-Symbol oder **Alt+Umschalt+O** verwenden. Im Panel **Seitenkontext übernehmen** anklicken, Quelle und Text prüfen, eigene Anmerkung und optional ein Projekt ergänzen und speichern.

Ist der Shortcut belegt, kann er unter `chrome://extensions/shortcuts` angepasst werden. Nach einem Update die neuen Dateien in denselben Ordner entpacken und auf der Erweiterungsseite **Neu laden** wählen. Der Download wird beim App-Build aus einer festen Dateiliste reproduzierbar erzeugt; keine Umgebungsdateien oder Zugangsdaten werden eingepackt.

## Bedienung und Grenzen

- Die Seite wird nur nach einer bewussten Freigabe über Symbol/Shortcut gelesen und der Kontext nur über den Panel-Knopf übernommen. Es gibt weder `<all_urls>` noch eine permanente Inhaltsinjektion, Tab-Historie oder automatische Aufzeichnung von besuchten Webseiten.
- Übernommen werden Titel, HTTP-/HTTPS-Adresse und die aktuelle Textauswahl im Hauptdokument. Kein vollständiger Seiteninhalt, keine Cookies und keine Passwortfelder werden gelesen. Bei Seitenwechseln ist die neue Seite erneut über Symbol/Shortcut freizugeben. Ein offenes Panel allein gibt nicht automatisch weitere Webseiten frei.
- Chrome-interne Seiten, der Chrome Web Store und bestimmte PDF-/Frame-Inhalte sind gesperrt oder nicht lesbar. Das Panel zeigt einen verständlichen Hinweis. Bei fehlender Textauswahl kann eine eigene Anmerkung gespeichert werden.
- Die übernommene Quelle wird vor dem Speichern angezeigt. Fragmente und erkannte Zugangs-/Trackingparameter werden entfernt; andere Parameter bleiben erhalten. Hash-basierte Unterseiten werden dadurch derselben Quellenadresse zugeordnet. URLs mit eingebetteten Zugangsdaten und andere Protokolle werden abgewiesen. Der Server ruft die Quellenseite nie ab.
- Eine Auswahl kann bis zu 10.000, eine Anmerkung bis zu 20.000 Zeichen enthalten. Texte werden als Text dargestellt und nicht als HTML ausgeführt. Es gibt keine automatische KI-Auswertung oder Gedächtnisübernahme externer Seiteninhalte.
- Erneutes bewusstes Übernehmen derselben normalisierten Quelle lädt die dazu gespeicherten eigenen Anmerkungen. Positionstreue Textmarkierungen, Seiten-Snapshots und Vergleiche geänderter Webseiten sind keine Funktionen dieser Version. Bei geänderter URL wird kein Zusammenhang erfunden.
- Die App zeigt eigene Browser-Anmerkungen mit Quellenlinks, Suche im geladenen Ausschnitt, Projektfilter, Bearbeiten und Löschen. Antworten sind auf maximal 100 Einträge und eine begrenzte Datenmenge beschränkt; bei großen Texten können es weniger sein. Die Begrenzung wird angezeigt. Einzelne Texte werden nicht still abgeschnitten.
- Projektzuordnungen verwenden ausschließlich eigene OMNIDESK-Projekte. In Mission Control erscheint ein passender Quellenbereich mit bis zu fünf aktuellen Einträgen und einem Link zur gefilterten Browser-Kommandoebene.
- Nicht gespeicherte Panel-Entwürfe liegen nur im Sitzungsspeicher der Erweiterung, getrennt je Browserfenster. Sie werden nicht automatisch hochgeladen. Nach Browser-Neustart sind sie nicht garantiert vorhanden. Gespeicherte Einträge liegen im eigenen OMNIDESK-Konto.

## Anmeldung, Freigabe und Widerruf

Die App verwendet weiterhin Clerk. Es wird kein Clerk-Sessiontoken in die Erweiterung kopiert. Die Erweiterung startet eine Anfrage mit einem zufälligen, nur lokal gehaltenen Verifier und einem SHA-256-Challenge. Nach ausdrücklicher Freigabe gibt die angemeldete App einen einmaligen Verbindungscode über Chromes Nachrichtenkanal an die anfragende Erweiterung weiter. Der Code ist fünf Minuten gültig und an den Verifier gebunden. Die Einlösung konsumiert ihn atomar. Codes und Gerätezugänge werden auf dem Server nur als Hash gespeichert.

Der resultierende Gerätezugang gilt 30 Tage. Er berechtigt ausschließlich zu Browser-Anmerkungen und der eigenen Projektliste unter `/api/browser-extension/data`; er ist kein allgemeiner OMNIDESK-Zugang und funktioniert nicht für Vault, Aufgaben, Integrationen oder andere Clerk-APIs. Der Hintergrundprozess nimmt externe Verbindungsnachrichten nur vom exakten Produktionsursprung `https://omnidesk-v2-beta.vercel.app` an. Interne Aktionen stammen ausschließlich aus dem eigenen Panel. Authentifizierte API-Anfragen gehen nur an diesen festen App-Ursprung und folgen keinen Weiterleitungen. Für diesen ersten Download sind beliebige alternative App-/Preview-Domains nicht konfigurierbar.

Das Gerätegeheimnis liegt ausschließlich im vertrauenswürdigen lokalen Erweiterungsspeicher und wird weder an Webseiten noch an den App-Renderer zurückgegeben. Abgelaufene oder widerrufene Verbindungen und zugehörige Entwürfe werden beim nächsten Zugriff entfernt. Unter **Verbundene Erweiterungen** kann der Benutzer einen Zugang widerrufen, ohne Anmerkungen zu löschen. **Verbindung trennen** im Panel widerruft den aktuellen Zugang und entfernt die lokale Verbindung. Ist der Server dabei nicht erreichbar, weist das Panel auf den noch nötigen serverseitigen Widerruf in der App hin.

Bis zu 20 Verbindungsversuche pro Benutzer und Stunde sowie bis zu 20 bereits aktive Geräte werden bei der Code-Erstellung geprüft. Anfrage-/Antwortgrößen sind begrenzt. Projektbesitz, Eintragsbesitz, Idempotenz und Versionsstände werden serverseitig geprüft; Browser-Benutzerkennungen sind keine Berechtigungsquelle. Nach entfernten/übertragenen Projektbindungen werden keine fremden Projektdetails ausgegeben.

## Entwicklung und Datenbank

```sh
npm run build:extension
npx --no-install tsx --test tests/browser-desk.test.ts tests/browser-extension.test.ts
npm run lint
npm run build
```

`build:extension` erstellt `dist-browser-extension/` und `public/downloads/omnidesk-browser.zip`. Beide sind generiert und ignoriert. `npm run build` erzeugt das Paket vor Vite und bündelt wie bisher das versionierte `api/[[...route]].js`. Der Download wird als statische Datei mit bereitgestellt. Vercel-Rewrites bleiben unverändert.

Drei zusätzliche Tabellen speichern Browser-Anmerkungen, kurzlebige Verbindungsanfragen und widerrufbare Gerätezugänge. Die erste Schreib-/Verbindungsaktion initialisiert sie unter einer Datenbanksperre. Alternativ steht `docs/sql/BROWSER-KOMMANDOEBENE.sql` für berechtigte Administration bereit. Bestehende Tabellen werden nicht verändert und es wird keine Produktionsbereinigung oder `db:push` ausgeführt. Bestehende `DATABASE_URL`- und Clerk-Konfiguration werden wiederverwendet; neue Provider-Schlüssel werden nicht benötigt.

## Prüfstatus und echte Chrome-Abnahme

SQL-/API-Tests führen die tatsächlichen parameterisierten SQL-Anweisungen gegen PGlite aus. Sie prüfen Besitzertrennung, fremde Projektkennungen, doppelte Speicheranfragen, Versionskonflikte, Ablauf, einmalige Code-Einlösung und Widerruf. Zusätzliche Tests führen den tatsächlichen Hintergrundcode mit kontrollierten Chrome-Schnittstellen aus. App und Panel werden in einem Browser mit simulierten Konten/API-/Chrome-Antworten geprüft, einschließlich Einwilligung, Speichern, Bearbeiten, Wiederholung nach Antwortverlust und Erholung nach Widerruf.

Die Cloud-Testumgebung blockiert das Laden entpackter Erweiterungen durch eine Administratorrichtlinie (`Loading of unpacked extensions is disabled by the administrator`). Ein nativer Erweiterungsstart und die echte Chrome-/Clerk-Verbindung konnten deshalb hier nicht abgenommen werden. Diese Grenze wird nicht durch einen erfolgreichen Build oder Simulationstest ersetzt.

Für die Nutzerabnahme: Paket im eigenen Chrome laden, ausdrücklich verbinden, auf einer normalen Webseite einen Absatz markieren, mit Anmerkung einem eigenen Projekt zuordnen, in der App und Mission Control prüfen, dieselbe Quelle erneut übernehmen und die Anmerkung bearbeiten. Danach den Gerätezugang in der App widerrufen und prüfen, dass das Panel keine weiteren Daten laden kann. Damit werden Installation, tatsächliche Berechtigungsfreigabe, der Chrome-Nachrichtenkanal und die eigene produktive Sitzung geprüft.


### Rückmeldung des Nutzers · 21.10.2026

Der Nutzer bestätigt nach Installation und Verbindung in seinem eigenen Google Chrome: „Alles hat funktioniert machen wir weiter?“ Die produktive Nutzung ist damit vom Nutzer live bestätigt. Die oben dokumentierte Cloud-Richtlinie bleibt eine Grenze der hiesigen nativen Automatisierung; sie macht die Nutzerbestätigung nicht rückgängig. Die Rückmeldung belegt keine einzeln protokollierte Durchführung aller Sonderfälle der Prüfliste. Der vollständige App-Test folgt weiterhin nach Abschluss der weiteren vereinbarten Änderungen.


## Stufe 1 des Ausbaus · 26.10.2026

Der Nutzer empfand die erste Version als zu schwach und beauftragte einen Ausbau, der die
Kommandoebene aus OMNIDESK heraus konfigurierbar macht. Umgesetzt ist die lesende Stufe 1;
Erweiterungsversion **1.1.0**.

**Schnellzugriffe.** In der App legt der Nutzer unter *Panel im Browser einrichten* fest, welche
Module und welche eigenen Einträge aus dem Link-Manager im Seitenpanel als Schaltflächen
erscheinen, einschließlich Reihenfolge. Höchstens acht Einträge. Modulziele werden serverseitig
gegen die gemeinsame Liste in `src/lib/browser-panel.ts` geprüft, Linkziele gegen die eigenen
Einträge des Benutzers. Freie Adressen sind nicht konfigurierbar. Der Passwort-Manager steht
bewusst nicht zur Auswahl. Ein entfernter oder nicht mehr auflösbarer Eintrag verschwindet nicht
still, sondern bleibt als nicht verfügbar gekennzeichnet sichtbar.

**Befehle.** Die eigene Befehlsbibliothek erscheint im Panel mit Suchfeld und einer Schaltfläche
zum Kopieren, wahlweise auf eine Kategorie begrenzt oder ganz abgeschaltet. Es werden höchstens
200 Befehle geliefert und 50 gleichzeitig angezeigt; beide Begrenzungen werden im Panel benannt
statt still abzuschneiden. Befehle werden nicht ausgeführt und nicht verändert. Verweigert Chrome
den Zugriff auf die Zwischenablage, erscheint ein Hinweis statt einer stillen Fehlfunktion.

**Rechte.** `GET /api/browser/panel` liegt in der gemeinsamen Datenroute und steht damit der
angemeldeten App und dem Gerätezugang der Erweiterung offen. `PUT /api/browser/panel` liegt
ausschließlich in der Web-Route: Die Erweiterung kann die Konfiguration lesen, aber nicht ändern.
Der Gerätezugang erhält dadurch keine weiteren Rechte an Aufgaben, Notizen, Vault oder anderen
Modulen. Eine additive Tabelle `v2_browser_panel` mit Versionsschutz gegen paralleles
Überschreiben; bestehende Tabellen bleiben unverändert.

**Prüfgrenzen.** Drei zusätzliche Tests führen die tatsächliche API gegen isoliertes
PostgreSQL/WASM aus und prüfen Zielprüfung, Besitzgrenzen, Versionsschutz und die fehlende
Schreibmöglichkeit der Erweiterung. Die Erweiterung selbst wurde nicht in einem Browser
ausgeführt: Sie ist an den Produktionsursprung gebunden und lässt sich in der
Entwicklungsumgebung nicht laden. Installation, Panel-Darstellung und das Kopieren in die
Zwischenablage muss der Nutzer bestätigen; Anleitung dafür in `TESTANLEITUNG-CLAUDE-CODE.txt`.
Nach einem Update ist die Erweiterung in `chrome://extensions` neu zu laden.

Stufe 2 – Aufgaben oder Notizen aus der aktuellen Seite anlegen – ist nicht umgesetzt. Sie würde
der Erweiterung erstmals Schreibrechte geben und bleibt eine eigene Entscheidung des Nutzers.


## Erfassen statt Anmerken · 27.10.2026

Der Nutzer hat Stufe 1 ausprobiert und klargestellt, dass sein Ziel nicht getroffen war: Er will
im Browser eine schnelle Notiz schreiben und sie anschließend im **Notizen-Modul** wiederfinden,
nicht in einem eigenen Anmerkungsbereich. Nach gemeinsamer Abstimmung umgesetzt;
Erweiterungsversion **1.2.0**.

**Schnell erfassen.** Das Panel legt auf Wunsch eine Notiz, eine persönliche Aufgabe oder eine
Projektaufgabe an. Aufgaben entstehen offen mit mittlerer Priorität, Projektaufgaben im Backlog
des gewählten eigenen Projekts. Eine übernommene Seite wird bei Notiz und Aufgabe automatisch
unter den Text gesetzt; der eingegebene Text bleibt davor unverändert stehen. Projektaufgaben
haben in der Datenbank kein Textfeld, dort werden weder Text noch Quelle gespeichert – das Panel
weist darauf hin, statt es zu verschweigen.

Das Lesen der Seite bleibt eine bewusste Handlung: Titel, Adresse und Textauswahl werden erst auf
Klick übernommen, und bereits ausgefüllte Felder werden dabei nie überschrieben.

**Keine Doppelungen.** Die Kennung eines Eintrags entsteht im Panel. Ein zweiter Versuch mit
derselben Kennung legt nichts doppelt an, sondern meldet den vorhandenen Eintrag zurück. Gehört
die Kennung einem anderen Konto, wird die Erfassung abgelehnt, ohne etwas über den fremden
Eintrag preiszugeben.

**Rechte.** `POST /api/browser/capture` liegt in der gemeinsamen Datenroute; der Gerätezugang der
Erweiterung darf damit erstmals schreiben. Das ist bewusst und eng begrenzt: ausschließlich
Anlegen in Notizen, Aufgaben und Projektaufgaben. Kein Ändern, kein Löschen, kein Zugriff auf
Vault, Kontosicherheit oder andere Module, und weiterhin kein Schreibweg auf die
Panel-Konfiguration. Projektbesitz wird serverseitig geprüft. Der Zugang bleibt jederzeit
widerrufbar.

**Altbestand.** Der getrennte Anmerkungsbereich nimmt keine neuen Einträge mehr auf. Vorhandene
Einträge bleiben erhalten und in der App unter *Frühere Browser-Anmerkungen* lesbar, bearbeitbar
und löschbar. Es wurde nichts migriert und nichts gelöscht.

**Prüfgrenzen.** Zusätzliche Tests führen die tatsächliche API gegen isoliertes PostgreSQL/WASM
aus und prüfen Zieltabellen, Quellenanhang, Idempotenz, Besitzgrenzen, Projektprüfung und die
weiterhin fehlende Schreibmöglichkeit auf die Konfiguration. Die Erweiterung selbst wurde nicht
in einem Browser ausgeführt; Installation und Bedienung bestätigt der Nutzer anhand von
`TESTANLEITUNG-CLAUDE-CODE.txt`.


## Projektaufgaben mit Text · 27.10.2026

Auf Wunsch des Nutzers behalten auch Projektaufgaben den erfassten Text und die Quelle.
`project_tasks` hat dafür eine zusätzliche Spalte `description` bekommen. Der Zusatz erfolgt
additiv zur Laufzeit beim ersten Zugriff auf das Projektmodul oder beim ersten Erfassen – wie bei
den V2-Tabellen – und ist durch eine Sperre gegen gleichzeitige Ausführung geschützt. Bestehende
Aufgaben behalten ihren Inhalt und erhalten einen leeren Text; es wurde nichts migriert und nichts
gelöscht. Erweiterungsversion **1.3.0**.

Das Projekt-Board zeigt den Text unter dem Titel der Aufgabe. Ein Editor für Projektaufgaben
existiert dort weiterhin nicht: Der Text ist lesbar, aber in der App noch nicht änderbar. Das ist
bewusst offen und kein übersehener Fall.

