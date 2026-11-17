# Collector-Guide

Ein Collector holt Rohdaten **einer** öffentlichen Quelle und gibt Beobachtungen zurück. Mehr nicht: keine Bewertung,
keine Schwellen, keine Interpretation. Vorlage: `src/collectors/wikimedia-pageviews.ts`. Typen: `src/core/types.ts`.
Helfer: `src/collectors/_helpers.ts` (`obs`, `num`, `expect`, `parseCsv`, `countPerDay`, `daysAgo`, `ymd`, `isoDay`).

## Regeln

1. **Eine Datei pro Collector:** `src/collectors/<id>.ts`, Default-Export vom Typ `Collector`, `id` = Dateiname, kebab-case.
   Dateien mit `_` am Anfang sind Helfer. Keine anderen Dateien im Ordner anfassen (parallele Agents).
2. **Nur `ctx.http`** für Netzwerk (`ctx.http.json(url, { fixture })`, `ctx.http.text(...)`). Kein eigenes `fetch`,
   keine npm-Abhängigkeiten, kein Zugriff aufs Dateisystem. Code muss in Node 22 und in Serverless-Funktionen laufen.
3. **Jeder Request bekommt einen stabilen `fixture`-Namen** (`<quelle>/<name>.json|csv|txt`), damit echte Antworten
   aufgezeichnet und offline wieder abgespielt werden können.
4. **Parser als reine, exportierte Funktionen** (`export function parse...(body)`), defensiv: fehlende Felder mit
   `expect(...)` klar melden, Zahlen mit `num(...)` lesen, nie `NaN` zurückgeben.
5. **Kleine Antworten anfordern:** `limit`, Zeitfenster, Feldauswahl nutzen. Ziel unter 20 000 Zeichen pro Antwort.
   Höchstens 8 Requests pro Lauf, außer es ist begründet.
6. **Historie mitnehmen:** Liefert die API Vergangenheitswerte, gib alle Punkte im Fenster zurück (60–90 Tage bei
   Tagesreihen). Der Speicher ignoriert bereits bekannte Zeitstempel. So gibt es sofort eine Baseline.
7. **Zeitstempel in UTC.** Tageswerte auf `T00:00:00Z` des Tages, Stundenwerte auf die volle Stunde. **Unvollständige
   Zeiträume nicht melden** (laufender Tag bzw. laufende Stunde bei Zählreihen), sie sehen sonst wie ein Einbruch aus.
8. **Signale vollständig deklarieren** (`signals: [...]`): `id`, `scenarios`, `domain`, `name`, `plain` (ein Satz für
   Laien, deutsch, echte Umlaute), `evidenceClass`, `direction`, `kind`, `weight`, `manipulability`,
   `independenceGroup`, `unit`, `intervalMinutes`, `baseline`, optional `holdHours`, `thresholds`, `license`.
   Existiert das Signal schon in `catalog/signals/<szenario>.json`, **dieselbe `id` verwenden**; sonst neue `id`
   nach Schema `<szenario>.<domain>.<snake_case>`.
9. **Fehlerverhalten:** Teilfehler (ein Artikel, ein Host von vielen) mit `ctx.log` melden und weitermachen. Ist die
   ganze Quelle unbrauchbar, Fehler werfen; der Runner protokolliert ihn, andere Collectors laufen weiter.
   Unvollständige Summen nie als Messwert ausgeben (ein fehlender Summand sieht wie ein Einbruch aus).
10. **Keys:** nie im Code. `needsKey: 'SR_<DIENST>_KEY'` setzen und mit `ctx.key('SR_<DIENST>_KEY')` lesen. Ohne Key wird
    der Collector übersprungen, nicht als Fehler gezählt.
11. **Nur passiv und öffentlich.** Kein Scannen, kein Login-Umgehen, keine Personen. Nutzungsbedingungen und Lizenz
    im Kopfkommentar nennen. User-Agent setzt der HTTP-Client.
12. **Kopfkommentar:** Quelle, Doku-URL, Lizenz, was gemessen wird, bekannte harmlose Ursachen für Ausschläge,
    und ob der Endpunkt gegen eine echte Antwort geprüft ist (`VERIFIED: ja/nein`).

## Aktualität und Verzug

`intervalMinutes` ist der **Abstand der Messwerte** (Tagesreihe: 1440), nicht das Abruf-Intervall. Die Engine
erkennt den Rhythmus zusätzlich aus den Daten selbst und hält den letzten Wert für das Dreifache dieses Abstands für
aktuell. Veröffentlicht eine Quelle mit Verzug (z. B. Wochenstatistik eine Woche später), setze `maxAgeHours`
am Signal, sonst gilt die Reihe als veraltet und zählt nicht.

## Fixtures und Tests

- Aufzeichnungs-Wunsch: `fixtures/queue/<collector>.json` mit `[{ "fixture": "<quelle>/<name>.json", "url": "<exakte URL>", "maxChars": 12000 }]`.
  Die URL so wählen, wie der Collector sie für `now = 2026-11-17T00:00:00Z` bauen würde. Ein zentraler Agent holt die
  echten Antworten und legt sie unter `fixtures/` ab. **Collector-Agents rufen die Quellen nicht selbst ab.**
- Test: `tests/collectors/<id>.test.ts` mit `node:test`. Solange keine echte Antwort vorliegt, ein kleines Beispiel
  nach Doku als Konstante im Test (`SAMPLE`, klar als „nach Doku nachgebaut“ kommentiert) und die `parse`-Funktionen
  dagegen prüfen: Normalfall, leere Antwort, fehlendes Feld.
- Lauf gegen echte Aufzeichnungen: `SR_FIXTURES=replay node src/cli.ts run --now-from-fixtures --only <id>`.

## Was ein gutes Signal ausmacht

- Der Messwert hat einen stabilen Normalzustand (sonst gibt es keine Baseline).
- Ein Ausschlag ist in einem Satz erklärbar.
- Die Quelle ist von den anderen Quellen der Domain unabhängig (`independenceGroup`).
- Harmlose Ursachen sind bekannt und stehen im Kopfkommentar.
