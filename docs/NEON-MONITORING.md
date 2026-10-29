# Neon-Projektüberwachung einrichten

Stand: 19. Oktober 2026. Neon erscheint im Uptime-Modul und im jeweiligen OMNIDESK-Projekt. Der Ausbau enthält aktuelle Verwaltungsdaten, gespeicherte Messhistorie, Diagramme, Warnungsverlauf, getrennte SQL-Prüfungen und die gemeinsame Ansicht vorhandener Website-/API-/TCP-Monitore.

**Stand der Abnahme:** Die bisherige Neon-Anbindung wurde vom Betreiber live bestätigt. Der neue Ausbau ist lokal mit PostgreSQL-Integrationstests geprüft. Einrichtung der neuen Tabellen, externer Scheduler und echter SQL-Zugang müssen noch auf dem V2-Deployment abgenommen werden. Bis dahin ist die Funktion nicht als vollständig live abgeschlossen zu behandeln.

## 1. Bestehende Neon-Anbindung beibehalten

In Vercel → **OMNIDESK-V2 → Settings → Environment Variables → Production**:

- `NEON_API_KEY`: Verwaltungs-API-Schlüssel aus Neon, ausschließlich serverseitig.
- `NEON_MONITOR_LINKS`: bestehende JSON-Liste mit `userId`, OMNIDESK-`projectId`, `neonProjectId` und `branchId`. Die bereits funktionierende Zuordnung nicht ersetzen.
- `DATABASE_URL`: bestehende Anwendungsdatenbank für OMNIDESK. Dort werden die neuen Monitoring-Daten gespeichert. Sie ersetzt nicht den Neon-API-Schlüssel.

Alle Abrufe prüfen sowohl die serverseitige Zuordnung als auch den aktuellen Besitzer des OMNIDESK-Projekts. API-Schlüssel, SQL-Verbindungen und Tabelleninhalte gelangen nicht an den Browser. Ein Branch pro OMNIDESK-Projekt; unterschiedliche Projekte können unterschiedliche Neon-Ziele haben.

Für eine neue Zuordnung ist die Form:

```json
[{"userId":"user_DEINE_ID","projectId":"DEINE_OMNIDESK_PROJEKT_UUID","neonProjectId":"dein-neon-projekt","branchId":"br-dein-branch"}]
```

Ungültiges JSON meldet `NEON_CONFIG_INVALID`; Probleme beim Laden der eigenen OMNIDESK-Projekte melden `NEON_PROJECT_LOOKUP_FAILED`. Bestehende Projekte oder Monitore niemals zur Fehlerbehebung löschen.

## 2. Monitoring in der App einrichten

Nach dem Deployment **Uptime-Monitor → Neon-Datenbank → Projektüberwachung & Verlauf → Monitoring-Einstellungen** öffnen. Alternativ dieselbe Karte im Projektmanagement öffnen.

1. Prüfintervall wählen: 5, 15 oder 60 Minuten; Standard 15 Minuten.
2. Aufbewahrung wählen: 7, 30 oder 90 Tage; Standard 30 Tage.
3. Optional Warnschwellen für Projektspeicher (GiB), Compute-Verbrauch (CU-h) und Datenübertragung (GiB) setzen. Leere Schwelle bedeutet ausgeschaltet. Verbrauchswerte gelten für den Neon-Verbrauchszeitraum, nicht pro Tag.
4. Bis zu drei vorhandene eigene Uptime-Monitore auswählen, etwa Website, API und TCP-Port. Pausierte Monitore werden angezeigt, aber nicht automatisch geprüft.
5. **Monitoring einrichten und starten** anklicken.

Beim ersten Speichern werden ausschließlich `v2_neon_config`, `v2_neon_samples`, `v2_neon_alerts` und deren Indizes angelegt. Keine bestehende Tabelle wird verändert, keine vorhandenen Datensätze werden entfernt. Die Einrichtung ist transaktional und wiederholbar. Ein erster Prüflauf wird gestartet. Dafür benötigt die Rolle von DATABASE_URL einmalig CREATE-Rechte; später genügen passende Rechte auf den neuen Tabellen.

Falls die App-Rolle keine CREATE-Rechte besitzt, [das feste SQL-Skript](sql/NEON-MONITORING.sql) mit einer berechtigten Rolle in der **Anwendungsdatenbank** ausführen und danach die Einstellungen erneut speichern. Kein `db:push` gegen die laufende Datenbank erforderlich. Bei gemeinsam mit V1 genutzter DATABASE_URL liegen die zusätzlichen Tabellen in derselben Datenbank; V1-Code und V1-Tabellen werden nicht umgebaut.

Historie entsteht ab der ersten gespeicherten Prüfung. Frühere Zeiträume bleiben leer. Das aktuelle Übersichts-„Aktualisieren“ lädt Verwaltungsdaten; **Jetzt prüfen & speichern** erzeugt dagegen einen überwachten Messpunkt und aktualisiert auch die verknüpften aktiven Monitore. Manuelle Messungen sind auf einmal pro Minute begrenzt; parallele Läufe erhalten eine Datenbank-Lease.

## 3. Hintergrundbetrieb mit Vercel Hobby

Vercel Hobby führt die konfigurierten Cron-Jobs täglich aus. Für engere Intervalle einen externen Scheduler verwenden. Die App enthält einen täglichen Rückfall-Aufruf um 06:05 UTC; dieser ersetzt keinen Fünf-Minuten-Scheduler.

### Variablen in Vercel

- `CRON_SECRET`: langer zufälliger geheimer Wert. Wenn bereits für Uptime gesetzt, denselben bestehenden Wert verwenden; keine Rotation nötig.
- `NEON_SCHEDULER_INTERVAL_MINUTES=5`: erwartetes Aufrufintervall des externen Schedulers. **Diese Variable startet selbst keinen Scheduler.**

Danach neu deployen. Niemals `VITE_` vor diese Variablennamen setzen.

### Kostenloser externer Aufruf, zum Beispiel cron-job.org

Bei [cron-job.org](https://cron-job.org/) einen Job anlegen:

- URL: `https://omnidesk-work.vercel.app/api/cron/neon-refresh`
- Methode: **GET**
- Intervall: **alle 5 Minuten**
- Unter den erweiterten HTTP-Einstellungen einen Header hinzufügen: Name `Authorization`, Wert `Bearer ` gefolgt vom bestehenden geheimen CRON_SECRET.
- Keine Zugangsdaten als URL-Parameter eintragen. Automatische Deaktivierung/Fehlermeldungen des Scheduler-Dienstes beachten.

Den geheimen Header nur beim gewählten Scheduler hinterlegen, nicht im Chat oder Repository. Mit „Test run“ prüfen: Erwartet werden HTTP 200 und `ok: true`; `setupRequired` muss nach Einrichtung `false` sein. `processed: 0` ist normal, wenn noch keine Messung fällig ist. `failures > 0` bedeutet, dass einzelne fällige Prüfungen nicht vollständig erfolgreich waren. Ein HTTP-200-Aufruf allein beweist keine gesunde Datenbank.

In der App muss anschließend **Letzter Lauf empfangen** mit aktuellem Zeitpunkt erscheinen. Die Anzeige „Vollständig erfolgreich“ muss im gewählten Messintervall mitziehen. Der Scheduler prüft nur fällige konfigurierte Projekte und respektiert die getrennten SQL-Intervalle. Pro Aufruf werden bis zu drei Projekte parallel bearbeitet; `pending: true` zeigt weitere fällige Projekte. Bei vielen Projekten zusätzliche Jobs mit `?projectId=OMNIDESK_PROJEKT_UUID` verwenden, um jedes Projekt zuverlässig zu bedienen. Auch diese Aufrufe benötigen den geheimen Header.

Ohne explizite Intervallvariable erwartet die App den täglichen Rückfall (1440 Minuten) und weist auf den Unterschied zum eingestellten Messintervall hin. Bei ausbleibendem Scheduler beziehungsweise zu alten erfolgreichen Messungen erscheinen **Überfällig**, **Veraltet** oder **Unbekannt**. Ein ruhender Compute ist kein Ausfall.

## 4. Optional: tatsächlichen SQL-Funktionstest aktivieren

Die Verwaltungs-API beweist keine funktionierende SQL-Verbindung. Der optionale Test führt ausschließlich `SELECT 1` in einer **READ ONLY**-Transaktion aus, mit acht Sekunden Netzwerklimit. Er liest keine Anwendungstabellen. Er kann einen ruhenden Compute aufwecken und Verbrauch erzeugen; die gemessene Laufzeit enthält Verbindung und mögliche Startzeit.

Für das aktuelle Neon-Ziel in Vercel hinterlegen:

```text
NEON_SQL_TARGETS=[{"neonProjectId":"morning-base-84758366","branchId":"br-holy-mode-assppmv5","env":"NEON_SQL_OMNIDESK_URL"}]
NEON_SQL_OMNIDESK_URL=die passende geheime PostgreSQL-Verbindungsadresse
```

Die Verbindungsadresse ausschließlich im Secret-Feld bei Vercel eintragen, niemals im Chat. Sie muss auf einen Compute des zugeordneten Branches zeigen; dessen Endpoint-ID wird mit dem Hostnamen abgeglichen. Unterstützt werden direkte und `-pooler`-Hostnamen unter `.neon.tech`, mit `sslmode=require` oder `sslmode=verify-full`. Eine eigene Rolle ohne Schreibrechte wird empfohlen. Nicht blind DATABASE_URL übernehmen: Anwendungsdatenbank und überwachtes Ziel können unterschiedlich sein.

Nach neuem Deployment unter Monitoring-Einstellungen **SQL-Funktionstest einschalten**, Intervall 15/60/240 Minuten (mindestens das Neon-Prüfintervall) und optional die Laufzeitschwelle einstellen, dann speichern. Die nächste fällige Prüfung führt den Test aus. Zum sofortigen ersten Test **Jetzt prüfen & speichern** verwenden; das separate SQL-Intervall wird auch bei manuellen Aufrufen respektiert. Bei Branch-Wechsel muss die geheime Zielzuordnung ebenfalls angepasst werden. Fehlende oder mehrdeutige Zielzuordnungen lassen sich nicht einschalten.

Die Speicherung der Monitoring-Daten selbst greift unabhängig hiervon auf die OMNIDESK-Anwendungsdatenbank zu. Falls diese zugleich das überwachte Ziel ist, kann bereits die Speicherung dessen Compute aktiv halten; Verbrauch nicht mit einem rein passiven externen Monitor verwechseln.

## 5. Warnungen und Diagramme verstehen

- API-Ausfälle oder unvollständige Abrufe nach der eingestellten Zahl aufeinanderfolgender Fehlprüfungen (Standard zwei).
- Verbrauchs-/Speicherschwellen, deaktivierter Compute, SQL-Fehler und SQL-Laufzeitüberschreitung.
- Störungen zugeordneter Uptime-Monitore und nicht ausführbare Monitorprüfungen.
- Eine fortbestehende Bedingung erzeugt nicht bei jedem Lauf eine neue Warnung. **Als gelesen** bestätigt sie, löst sie aber nicht auf. Ein nachweislich gesunder Messwert löst sie automatisch auf. Unbekannte Werte lösen eine bestehende Warnung nicht auf. Pausieren allein erklärt keinen Vorfall für behoben.
- Warnungen erscheinen in der Neon-Karte in Uptime und Projektmanagement. Kein E-Mail-, Push- oder anderer externer Versand ist eingerichtet.
- 24-Stunden-/7-/30-/90-Tage-Ansichten aggregieren Messpunkte. Speicher/SQL-Laufzeit sind Mittelwerte, Compute-/Transferverbrauch höchste kumulative Werte je Zeitbereich. Wechsel des Verbrauchszeitraums werden im Diagramm getrennt. Es werden keine aktuellen CPU-/RAM-Metriken erfunden oder Neon-Konsolendiagramme pauschal kopiert.
- Fehlende Messungen sind Lücken, keine Nullwerte. Verwaltungs-API, SQL und Website/API-Monitore zeigen getrennte Zustände und Zeitstempel; eine gemeinsame Karte ist keine bewiesene Ursachenanalyse.
- Messungen und erledigte Warnungen außerhalb der Aufbewahrung werden beim Prüflauf beziehungsweise Scheduler-Aufruf gelöscht. Offene Warnungen bleiben erhalten. Die Bereinigung benötigt laufende Aufrufe.

## 6. Live-Abnahme vor Abschluss

1. Bisherige Uptime-Monitore, Aufgaben, Projekte und `/api/health` weiterhin prüfen.
2. Monitoring einrichten; erster Messpunkt und letzter erfolgreicher Abruf sichtbar. Speicher-/Verbrauchswerte mit Neon vergleichen; projektweite Werte nicht als Branch-Verbrauch interpretieren.
3. Eigenen Website-/API-Monitor zuordnen und nach gespeichertem Prüflauf mit dessen Uptime-Karte vergleichen.
4. Scheduler-Test ausführen, App schließen und nach mindestens zwei Messintervallen erneut öffnen. Neue Messungen müssen ohne offenen Browser entstanden sein.
5. Eine Speicherschwelle kurz unter den aktuellen Wert setzen, prüfen, anschließend dieselbe Prüfung wiederholen: genau eine offene Warnung. Gelesen markieren; sie bleibt offen. Schwelle erhöhen und erneut prüfen: Warnung wird behoben. Zwischen manuellen Prüfungen mindestens eine Minute warten.
6. SQL optional aktivieren und Laufzeit prüfen. Danach wahlweise wieder ausschalten, um Aufwecken/Verbrauch zu vermeiden.
7. Ein anderer angemeldeter Benutzer darf weder Konfiguration, Messwerte, Monitore noch Warnungen dieses Projekts lesen oder verändern.
8. Fehlende/beschädigte Konfiguration muss ausdrücklich unbekannte/veraltete Zustände ergeben. Ein ausbleibender Scheduler darf nicht als erfolgreiche Prüfung erscheinen.

## Technische Prüfung

GET-Verwaltungsendpunkte: `/projects/{project_id}`, `/projects/{project_id}/branches/{branch_id}`, `/projects/{project_id}/endpoints` unter `https://console.neon.tech/api/v2`. Umfang und Verzögerung einzelner Werte hängen von Neons API und Tarif ab. Es werden keine schreibenden Neon-Verwaltungsaktionen ausgeführt.

```bash
node --import tsx --test tests/*.test.ts
npm run lint
npm run build
```

Die zusätzlichen Tests führen die tatsächlichen parametrisierten Speicherabfragen des Neon-Treibers gegen PostgreSQL/WASM (PGlite, ausschließlich Entwicklungsabhängigkeit) aus. Geprüft werden unter anderem additive Einrichtung, Mess-/Warntransaktionen, Lease, Wiederholungen, Besitzgrenzen, Mapping-Wechsel, Aufbewahrung und Scheduler-Heartbeat. Der SQL-Test prüft zudem READ ONLY, feste Abfrage und Endpoint-Abgleich mit simuliertem Netzwerk. Das ersetzt keine Live-Abnahme mit produktiven Zugangsdaten.
