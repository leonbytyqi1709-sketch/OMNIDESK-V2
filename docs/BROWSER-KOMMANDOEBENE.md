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
