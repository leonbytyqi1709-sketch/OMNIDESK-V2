# Code- und Systemprüfung · 28.10.2026

Nach der Nutzerabnahme des Gesamttests hat der Nutzer eine vollständige Prüfung von Anwendung,
Code und Anbindungen freigegeben, ohne Zeitdruck. Dieses Dokument hält fest, was tatsächlich
geprüft wurde, was behoben ist, was offen bleibt und wo die Grenzen dieser Prüfung liegen.

## Vorgehen und Umfang

Das Repository umfasst rund 42.000 Zeilen in 309 Dateien (ohne das erzeugte Backend-Bundle).

Vollständig gelesen wurden: die Anwendungs- und Routenverdrahtung (`server/app.ts`, Auth-Grenze),
sämtliche kleineren Servermodule, die sicherheitsrelevanten Speicher- und Routendateien
(Vault, öffentliche Buchung, gemeinsame Räume, Chat, GitHub, Uptime, OAuth für Google und
Microsoft, Browser-Kommandoebene), das Datenbankschema gegen die zur Laufzeit erzeugten Tabellen,
die Umgebungsvariablen gegen `.env.example` sowie die Reste entfernter Funktionen.

Stichprobenartig geprüft wurden die Frontend-Module; der Schwerpunkt lag dort auf dem
Notizmodul, weil der einzige offene Fehlerbericht es betraf.

Automatische Prüfungen zu Beginn und nach den Änderungen: Typprüfung ohne Fehler, Lint
unverändert bei den sieben bekannten Fast-Refresh-Warnungen, Testlauf vollständig grün,
Build erfolgreich.

**Gesamteindruck:** Die Anwendung ist sauber gebaut. Besitzprüfungen laufen durchgängig in SQL
und werden bei Änderungen innerhalb derselben Transaktion erneut geprüft; externe Abrufe sind
mit Zeitlimits, Größengrenzen und `redirect: 'error'` abgesichert; Fehlermeldungen geben keine
Anbieterinhalte, Hostnamen oder Zugangsdaten preis. Die Befunde unten sind Feinschliff, kein
struktureller Mangel.

## Behoben

### 1 · Uptime-Übersicht las die Messungen aller Monitore

`GET /api/uptime` lud sämtliche Messungen der letzten 30 Tage aus der Datenbank – ohne
Einschränkung auf die eigenen Monitore – und verwarf den Großteil anschließend beim Gruppieren.
Bei einem Prüfintervall von fünf Minuten sind das je Monitor rund 8.600 Zeilen pro Monat; bei
einem nötigen Refresh wurde dieselbe Menge ein zweites Mal geladen. In die Antwort gelangten
fremde Daten nicht, gelesen wurden sie trotzdem.

Die Abfrage ist jetzt auf die Monitore des angemeldeten Benutzers eingegrenzt. Ein neuer Test
(`tests/uptime-overview.test.ts`) prüft die tatsächlich ausgeführte SQL-Anweisung; er schlägt
ohne die Eingrenzung fehl und wurde in beide Richtungen verifiziert.

### 2 · Zusätzliche Datenbankabfrage bei jedem Notiz-, Aufgaben- und Projektzugriff

`retireWorkingHistory()` prüfte vor **jeder** Anfrage dieser drei Module, ob noch Trigger des
entfernten Arbeitsgedächtnisses existieren. Sind keine mehr vorhanden, ändert sich daran nichts
mehr. Das Ergebnis wird jetzt je Serverprozess gemerkt.

### 3 · Kein Zeitlimit für den KI-Anbieter im Chat

Der Chat rief den Anbieter ohne `AbortSignal` auf. Eine hängende Antwort blieb bis zum
Funktionslimit stehen, und der Chat wirkte eingefroren. Jetzt gilt ein Zeitlimit von 45 Sekunden;
der bestehende Schlüssel-Failover bleibt unverändert. Das Briefing hatte dieses Limit bereits.

### 4 · Offene Verbindungen beim Uptime-Check

Der HTTP-Check las den Statuscode, gab den Antwortkörper aber nie frei. Er wird jetzt verworfen,
damit die Verbindung sofort geschlossen wird.

### 5 · Konflikthinweis in den Notizen war nicht als Warnung erkennbar

Der am 22.10.2026 gemeldete Punkt. Der Hinweis existierte, bestand aber aus unformatiertem
Fließtext mit dünner Linie – ohne Farbe, ohne Symbol. Er wird jetzt als Warnung dargestellt und
sagt ausdrücklich, dass bis zur Auflösung nichts mehr gespeichert wird.

**Einschränkung:** Der gemeldete Ablauf ließ sich ohne angemeldete Sitzung nicht nachstellen. Die
Logik dahinter – Versionsprüfung, blockierte Folgespeicherungen, erhaltener Entwurf – ist beim
Lesen korrekt und setzt die Meldung zuverlässig. Dass der Hinweis übersehen wurde, ist die
plausibelste Erklärung; sollte er auch jetzt ausbleiben, ist die Ursache eine andere und wir
müssen gemeinsam nachstellen.

### 6 · Mehrfach vergebene Sperrnummern

Drei Einrichtungsvorgänge nutzten dieselbe Advisory-Lock-Nummer (184730023), zwei weitere eine
gemeinsame (184730021), obwohl sie unterschiedliche Tabellen anlegen. Sie hätten sich beim ersten
Lauf gegenseitig ausgebremst. Jeder Vorgang hat jetzt eine eigene Nummer.

### 7 · Rückleitung nach der Google-Anmeldung zeigte auf localhost

Der Google-Callback bildete die Zieladresse aus `APP_URL` oder `FRONTEND_URL` und fiel sonst auf
`http://localhost:5173` zurück. Keine der beiden Variablen ist in der produktiven Umgebung
gesetzt. Jetzt wird der Ursprung der tatsächlichen Anfrage verwendet; die Variablen bleiben als
Übersteuerung möglich.

### 8 · Produktname in der Systemanweisung von Omni

Die Anweisung an das Modell sprach weiterhin von „OmniDesk“. Angeglichen.

### 9 · Nicht dokumentierte Umgebungsvariablen

`AI_API_KEYS`, `APP_URL` und `API_PORT` werden verwendet, standen aber nicht in `.env.example`.
Ergänzt.

### 10 · Google-Anmeldung band den State nicht an die Sitzung · behoben am 28.10.2026

Der Microsoft-Weg macht es vorbildlich: Der OAuth-State ist an ein verschlüsseltes HttpOnly-Cookie
gebunden, ausdrücklich damit über den State kein anderer OMNIDESK-Benutzer gewählt werden kann.
Der Google-Weg stammte aus der Zeit davor und legte die Benutzerkennung unsigniert als Base64 in
den State; der Callback vertraute ihr. Wer eine gültige Google-Autorisierung und eine fremde
Benutzerkennung besaß, konnte ein Google-Konto an ein fremdes OMNIDESK-Konto hängen.

Der Nutzer hat die Umstellung freigegeben. Google läuft jetzt denselben Weg: verschlüsseltes
HttpOnly-Cookie je Browser, zehn Minuten gültig, nur für `/api/integrations/google`, zusätzlich
PKCE mit S256. Im State steht nur eine Zufallszahl, die Benutzerkennung verlässt den Server nicht
mehr, der Callback liest sie ausschließlich aus dem Cookie und löscht es danach. Rückleitungsziel
nur `/settings` oder `/cloud-monitor`. Der Startpunkt prüft, dass die App auf der in
`GOOGLE_REDIRECT_URI` konfigurierten Adresse läuft.

Mit behoben: Der Code-Austausch übernahm bei einem Fehler den Antworttext von Google in die
Fehlermeldung, und der Callback schrieb diese Meldung in die Rückleitungsadresse – damit konnten
Anbieterinhalte in der Adresszeile landen. Jetzt nur noch HTTP-Status intern und ein fester Text
nach außen, dazu ein Zeitlimit von 15 Sekunden sowie `Cache-Control: no-store` und
`Referrer-Policy: no-referrer` am Callback.

Neuer Test `tests/google-oauth.test.ts`; die Gegenprobe ohne Bindung schlägt fehl. **Noch nicht
live geprüft:** Das Verbinden eines Google-Kontos in der angemeldeten produktiven Sitzung.

## Offen – zur Entscheidung

### A · Google-Tokens liegen im Klartext in der Datenbank

Microsoft verschlüsselt Access- und Refresh-Token vor dem Speichern (`sealMicrosoftValue`), Google
speichert sie unverändert. Wer Leserecht auf die Tabelle `connected_accounts` hat, kann damit auf
Google Drive zugreifen. Die Umstellung ist machbar, betrifft aber bereits gespeicherte Zeilen und
braucht eine Live-Prüfung der Drive-Synchronisation; deshalb nicht nebenbei erledigt.

### B · Öffentliche Buchungsseite ohne Begrenzung

`POST /api/public/booking/:slug/book` ist bewusst ohne Anmeldung erreichbar. Es gibt keine
Begrenzung der Buchungen je Zeitraum: Wer den Slug kennt, kann alle freien Termine belegen.
Zusätzlich liegt zwischen Kollisionsprüfung und Einfügen ein kleines Zeitfenster, in dem zwei
gleichzeitige Buchungen denselben Termin belegen könnten.

Empfehlung bei Bedarf: eine einfache Obergrenze je Slug und Stunde sowie eine eindeutige
Bedingung auf Besitzer und Startzeit. Nur sinnvoll, wenn die Buchungsseite tatsächlich öffentlich
genutzt wird.

### C · Zertifikatsprüfung beim Uptime-Monitor

Der TLS-Handshake läuft mit `rejectUnauthorized: false`, um auch bei ungültigem Zertifikat die
Restlaufzeit zu lesen. Die Anzeige unterscheidet dadurch nicht zwischen „gültig und vertrauenswürdig“
und „läuft noch, aber Kette oder Hostname passen nicht“. Ein Monitor mit falschem Zertifikat kann
grün aussehen. Empfehlung: Gültigkeit getrennt prüfen und anzeigen.

### D · Fehlende Kennungsprüfung in einigen Routen

Links, Kontakte, Befehle, Termine, Vault-Einträge und Chat-Sitzungen prüfen ihre `:id` nicht auf
UUID-Form. Eine fehlerhafte Kennung führt zu einem Datenbankfehler und damit zu „500 Interner
Serverfehler“ statt zu „404 nicht gefunden“. Dasselbe gilt für `GET` und `DELETE` auf
`/api/shared-rooms/:roomId`: Die vorhandene Prüfung greift dort nicht, weil sie auf Pfade mit
weiterem Segment gemünzt ist. Kein Sicherheitsproblem – die Besitzprüfung bleibt in jedem Fall
wirksam –, aber eine unnötig unklare Fehlermeldung.

### E · Uptime-Monitore dürfen beliebige Ziele ansprechen

Das Modul prüft jede eingetragene Adresse und jeden Host samt Port, auch interne. Das ist der Sinn
eines Monitors und nur dem eigenen Konto möglich. Festgehalten als bewusste Eigenschaft, nicht als
Fehler: Von der Vercel-Umgebung aus sind damit auch Verbindungsversuche zu nicht-öffentlichen
Adressen möglich.

## Ausdrücklich nicht angefasst

Die Microsoft-/OneDrive-Anbindung bleibt im Code. Sie gehört ausschließlich zum Cloud-Monitor und
ist ohne `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` und `MICROSOFT_REDIRECT_URI` vollständig
untätig; keine dieser Variablen ist gesetzt. Die Planungsentscheidung gegen OneDrive ist kein
Auftrag zum Löschen vorhandenen Integrationscodes, und dieser Code war die Vorlage für die sichere
Google-Umstellung. Ob die Schaltfläche im Cloud-Monitor ausgeblendet wird, entscheidet der Nutzer.

Die API-Dateistruktur und die Rewrites in `vercel.json` blieben unberührt. Die Zuordnung
„`/api/(.*)` → `/api/index.js`“ bei einem Bundle unter `api/[[...route]].js` sieht widersprüchlich
aus, funktioniert produktiv aber nachweislich; eine frühere Änderung daran hat eine Regression
verursacht und wurde zurückgenommen.

## Grenzen dieser Prüfung

Gelesen und geprüft wurde der Code. Nicht geprüft wurden: das Verhalten in der angemeldeten
produktiven Sitzung, die Browser-Erweiterung im Betrieb, echte Abläufe bei Google, Microsoft,
Neon, Vercel und GitHub sowie die Qualität der Antworten des KI-Anbieters. Die Frontend-Module
wurden stichprobenartig und nicht Zeile für Zeile gelesen. Ein grüner Testlauf und eine erfolgreiche
Bereitstellung ersetzen diese Prüfungen nicht.
