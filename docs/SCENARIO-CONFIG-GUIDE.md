# Szenario-Konfiguration der geteilten Collectors

Mehrere Collectors bedienen alle Szenarien zugleich: `wikimedia-pageviews`, `hn-algolia`, `gdelt-doc`, `polymarket-gamma`,
`yahoo-chart`, `ioda`, `ooni`, `statuspage`, `adsb-lol`. Ihre Signale und Requests stehen nicht mehr im Collector, sondern je
Szenario in **einer** Datei:

```
src/collectors/config/_types.ts     Typen (ScenarioCollectorConfig und je Collector ein Eintragstyp)
src/collectors/config/<szenario>.ts cyber, war, blackout, ai, finance, nuclear, bio
src/collectors/config/index.ts      importiert alle sieben statisch (Reihenfolge = Reihenfolge der Signale)
```

Ein Szenario-Agent ändert **nur** `src/collectors/config/<sein-szenario>.ts` und trägt seine neuen Requests in
`fixtures/queue/<collector>.json` ein. Collector-Code, `_types.ts`, `index.ts` und die Dateien anderer Szenarien bleiben
unangetastet. Der Ordner `config/` wird von der Registry nicht als Collector geladen (sie liest nur Dateien direkt in
`src/collectors/`).

## Aufbau einer Szenario-Datei

```ts
import type { ScenarioCollectorConfig } from './_types.ts';

export default {
  scenario: 'blackout',
  wikipedia: [], hackerNews: [], gdelt: [], polymarket: [], yahoo: [],
  iodaCountries: [], iodaEvents: [], ooni: [], statuspage: [], adsb: [],
} satisfies ScenarioCollectorConfig;
```

Alle zehn Listen müssen vorhanden sein (leer ist erlaubt). Jeder Eintrag enthält eine Signal-Deklaration `signal`
(Teil einer `SignalDef`, siehe `src/core/types.ts`). Regeln:

- `id` nach Schema `<szenario>.<domain>.<snake_case>`; existiert das Signal schon in `catalog/signals/<szenario>.json`,
  dieselbe `id` verwenden. IDs müssen über alle Szenarien eindeutig sein.
- `scenarios` weglassen: der Collector setzt `[<szenario>]`.
- Pflicht sind `id`, `name`, `plain` (ein Satz für Laien, echte Umlaute) und, wo der Collector keinen Standard hat, `domain`.
  Alles, was in der Tabelle unten als Standard steht, darf fehlen; eigene Werte überschreiben den Standard.
- `banalCauses` angeben (harmlose Ursachen für Ausschläge).
- Kopfkommentar der Szenario-Datei: Quelle der Begriffs-/Artikelwahl, ob geprüft.

| Collector (Liste) | Standardwerte im Collector |
|---|---|
| wikimedia-pageviews (`wikipedia`) | domain attention, Klasse D, up, count, weight 0.5, manipulability medium, Aufrufe/Tag, 1440 min, hold 48 h, Baseline day-of-week 28/14 |
| hn-algolia (`hackerNews`) | domain attention, Klasse D, up, count, manipulability medium, Stories/Tag, 1440 min, hold 48 h, Baseline day-of-week 56/21 |
| gdelt-doc (`gdelt`) | domain attention, Klasse D, up, gauge, % der Artikel, 1440 min, hold 48 h, Baseline day-of-week 56/21 |
| polymarket-gamma (`polymarket`) | gauge, manipulability high, 360 min, hold 24 h, Baseline rolling 56/14 |
| yahoo-chart (`yahoo`) | domain markets, Klasse A, up, gauge, manipulability low, 1440 min, hold 48 h (Baseline und unit selbst setzen) |
| ioda (`iodaCountries`, `iodaEvents`) | Klasse A, manipulability low (domain, direction, kind, unit, Intervall, Baseline selbst setzen) |
| ooni (`ooni`) | Klasse A, up, rate, weight 0.25, % anomal, 1440 min, hold 48 h, Baseline rolling 56/21 |
| statuspage (`statuspage`) | Klasse B, up, rate, % der Anbieter, 15 min, hold 6 h, Baseline hour-of-week 28/48, absFloor 3 |
| adsb-lol (`adsb`) | Klasse A, count, manipulability medium, Anzahl, 15 min, hold 6 h, Baseline hour-of-week 28/48, relFloor 0.1 |

## Beispiele je Collector

**wikimedia-pageviews**: Summe der Tagesaufrufe über höchstens **6** Artikel eines Projekts (die mit den vermutlich meisten
Aufrufen; mehr werden abgeschnitten). Fenster 30 Tage, Fixture `wikimedia/<projekt>-<artikel>-30d.json`. Ab 2 von 6
fehlenden Artikeln (404) wird nichts gemeldet.

```ts
wikipedia: [{
  signal: { id: 'blackout.attention.wikipedia_de', name: 'Wikipedia-Aufrufe zu Stromausfall (deutsch)',
    plain: 'Wie oft deutschsprachige Wikipedia-Artikel zu Stromausfall und Notstrom aufgerufen werden.',
    banalCauses: ['Unwetter', 'Warntag'] },
  project: 'de.wikipedia',
  articles: ['Stromausfall', 'Notstromaggregat', 'Blackout_(Stromausfall)', 'Stromnetz', 'Notvorrat', 'Kurbelradio'],
}],
```

**hn-algolia**: Summe der Stories des Vortags (UTC) mit einem der Begriffe im Titel; ein Request je Begriff mit
`hitsPerPage=0` (nur `nbHits`, ca. 500 Zeichen). `fixturePrefix` muss je Szenario eindeutig sein (Fixture
`hn-algolia/<prefix><begriff>-24h.json`). Fällt ein Begriff aus, wird für die Gruppe nichts gemeldet.

```ts
hackerNews: [{
  signal: { id: 'ai.attention.hackernews_mentions', name: 'Hacker-News-Stories zu KI-Vorfällen',
    plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie jailbreak oder model leak im Titel haben.',
    weight: 0.35, banalCauses: ['Produktvorstellungen', 'Konferenzen'] },
  terms: ['jailbreak', '"model weights"', '"AI incident"'],
  fixturePrefix: 'ai-',
}],
```

**gdelt-doc**: ein Strom = eine Anfrage `mode=timelinevol&timespan=1m`. Kurze Suchausdrücke (lange liefen in Timeouts),
Sprachfilter `sourcelang:english` bzw. `sourcelang:german`. Fixture-Name frei, aber eindeutig.

```ts
gdelt: [{
  signal: { id: 'nuclear.attention.gdelt_nuclear_volume', name: 'Medienvolumen Atomwaffen (GDELT, englisch)',
    plain: 'Welcher Anteil der englischsprachigen Nachrichtenartikel von Atomwaffen handelt.',
    weight: 0.4, manipulability: 'medium', banalCauses: ['Jahrestage', 'Filme'] },
  query: '("nuclear weapon" OR "nuclear test") sourcelang:english',
  fixture: 'gdelt/nuclear-weapons-en-timelinevol-1m.json',
}],
```

**polymarket-gamma**: Textsuche je Begriff (ein Request je Begriff, Fixture `polymarket/search-<begriff>-open.json`;
derselbe Begriff in zwei Szenarien wird nur einmal abgefragt), Filter `match` auf den Fragetext, zwei Signale.
`domain`, `evidenceClass`, `direction`, `weight`, `unit` selbst setzen.

```ts
polymarket: [{
  terms: ['blackout', 'power grid'],
  match: /blackout|power (grid|outage)/i,
  yesSignal: { id: 'blackout.attention.prediction_markets_blackout', domain: 'attention', name: '…', plain: '…',
    evidenceClass: 'D', direction: 'up', weight: 0.3, unit: '%', banalCauses: ['Geringe Liquidität'] },
  volumeSignal: { id: 'blackout.attention.prediction_volume_blackout', domain: 'attention', name: '…', plain: '…',
    evidenceClass: 'D', direction: 'up', weight: 0.2, unit: 'USD/24h', banalCauses: ['Neuer Markt'] },
}],
```

**yahoo-chart**: ein Signal aus einem oder mehreren Symbolen (`range=1mo&interval=1d`, Fixture
`yahoo/<symbol>-1mo-1d.json`). Jedes Symbol wird je Lauf nur einmal geholt, auch wenn es mehrere Szenarien nutzen.
`metric`: `close` (Schlusskurs des ersten Symbols), `abs-return-mean` (Mittel der Beträge der Tagesrenditen in %),
`rel-volume-sum` (Volumensumme geteilt durch den Median der 10 Handelstage davor). Gemeldet werden nur Tage, an denen
alle Symbole Werte haben.

```ts
yahoo: [{
  signal: { id: 'finance.markets.bank_etf_abs_return', name: 'Tagesschwankung europäischer Banken (EUFN)',
    plain: 'Wie stark ein Fonds europäischer Bankaktien an einem Tag steigt oder fällt.',
    weight: 0.3, unit: '% (Betrag)', baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
    banalCauses: ['Zinsentscheide', 'Quartalszahlen'] },
  symbols: ['EUFN'], metric: 'abs-return-mean',
}],
```

**ioda**: `iodaCountries` = Einzelland oder Ländergruppe (Summe je Stunde, nur wenn alle Länder Werte haben).
`datasource` `bgp` (Standard, Fixture `ioda/country-<CC>.json`) oder `ping-slash24` (`ioda/country-<CC>-ping.json`).
Jede Kombination aus Land und Datenquelle wird je Lauf nur einmal geholt; gleiche Länder in mehreren Szenarien kosten
keinen weiteren Request. `iodaEvents`: weitere Signal-IDs für die Zahl der Länder-Ausfallereignisse des Vortags
(keine weiteren Requests).

```ts
iodaCountries: [{
  signal: { id: 'blackout.grid.ioda_iberia', domain: 'grid', name: 'IODA: Spanien und Portugal im Routing (Summe)',
    plain: 'Summe der im Routing sichtbaren Netzblöcke von Spanien und Portugal; ein Einbruch kann einen Stromausfall anzeigen.',
    direction: 'down', kind: 'gauge', weight: 0.6, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12,
    baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 }, banalCauses: ['Messausfall bei IODA'] },
  countries: ['ES', 'PT'],
}],
iodaEvents: [],
```

**ooni**: Anteil anomaler web_connectivity-Messungen je Land und Tag (Fenster 30 Tage, Fixture
`ooni/web-connectivity-<cc>-30d.json`). `windowDays` nur ändern, wenn nötig (ca. 145 Zeichen je Tag). Länder mit
weniger als 100 Messungen je Tag liefern Lücken.

```ts
ooni: [{
  signal: { id: 'blackout.connectivity.ooni_anomaly_share_es', domain: 'connectivity',
    name: 'Anteil anomaler Web-Messungen (Spanien)',
    plain: 'Welcher Anteil der OONI-Messungen zur Erreichbarkeit von Webseiten in Spanien auffällig ausfällt.' },
  cc: 'ES',
}],
```

**statuspage**: Signale aus den Abfragen der Hosts in `catalog/statuspage-hosts.json` (keine weiteren Requests).
`measure`: `disrupted-share` oder `major-share` (Prozent gestörter bzw. schwer gestörter Hosts), optional je
`category` (`cloud`, `payment`, `dev`, `saas`, `telecom`, `crypto`, `ai`; mindestens 3 antwortende Hosts), oder
`incident-starts` / `incident-major-starts` (Störungs-Beginne pro Tag über 8 Leitanbieter; dann `kind`, `unit`,
`intervalMinutes`, `baseline` selbst setzen, siehe `cyber.ts`). Neue Hosts gehören nicht in die Szenario-Datei, sondern
in `catalog/statuspage-hosts.json` (abgestimmt, weil alle Szenarien sie teilen).

```ts
statuspage: [{
  signal: { id: 'ai.services.statuspage_ai_disruption', domain: 'services', weight: 0.6,
    name: 'KI-Anbieter mit Störung', plain: 'Wie viel Prozent der beobachteten KI-Anbieter gerade eine Störung melden.' },
  measure: 'disrupted-share', category: 'ai',
}],
```

Hinweis: In `catalog/statuspage-hosts.json` hat `ai` heute nur 2 Hosts; unter 3 antwortenden Hosts wird nichts gemeldet.

**adsb-lol**: derselbe Zählwert (sichtbare Militärflugzeuge weltweit) unter einer weiteren Signal-ID; kein Request mehr.

```ts
adsb: [{
  signal: { id: 'nuclear.military.mil_aircraft_visible_global', domain: 'military', name: '…', plain: '…',
    direction: 'up', weight: 0.3, banalCauses: ['Übungen'] },
}],
```

**cvelist-delta** ist nicht konfigurierbar: die Einträge in `new[]` tragen nur `cveId`, Links und `dateUpdated`, keinen
Text, ein Stichwort-Filter je Szenario ist damit nicht möglich.

## Neue Requests in die Queue eintragen

Jeder neue Request braucht einen Eintrag in `fixtures/queue/<collector>.json`, damit der zentrale Agent die echte Antwort
aufzeichnet. Die URL muss exakt die sein, die der Collector für `now` = `capturedAt` aus `fixtures/META.json` baut.

1. Szenario-Datei füllen.
2. Fehlende Einträge anzeigen lassen (ruft nichts ab):
   ```
   node scripts/queue-requests.ts <collector-id>            # Vergleich: fehlt / überzählig
   node scripts/queue-requests.ts --missing <collector-id>  # fehlende Einträge als JSON
   ```
3. Die fehlenden Einträge ans Ende der Liste in `fixtures/queue/<collector>.json` anhängen
   (`{ "fixture": "...", "url": "...", "maxChars": ... }`), bestehende Einträge nicht ändern.
4. `maxChars` realistisch schätzen, **höchstens 8000**. Die Aufzeichnungs-Umgebung nimmt nur Antworten bis etwa
   6000 Zeichen vollständig auf. Richtwerte: wikimedia 30 Tage ca. 4 500, hn-algolia ca. 500, ooni 30 Tage ca. 4 500,
   ioda (bgp, 24 h) ca. 2 500 bis 3 500, yahoo 1 Monat ca. 3 000 bis 4 500, polymarket je Begriff 4 000 bis über 8 000
   (Ereignisse mit vielen offenen Märkten). Größere Antworten lieber durch kleinere Requests vermeiden.
5. `npm test` muss grün sein. `tests/collectors/scenario-config.test.ts` prüft unter anderem, dass die Queue genau den
   Requests der Collectors entspricht, dass Signal-IDs eindeutig sind und mit dem Szenario beginnen.
   Arbeiten mehrere Agents gleichzeitig im selben Verzeichnis, schlägt dieser Test vorübergehend fehl, solange ein
   anderer Agent Konfiguration, aber noch nicht seine Queue-Einträge eingetragen hat.
6. Replay prüfen (fehlende Fixtures sind bis zur Aufzeichnung normal):
   `SR_FIXTURES=replay node src/cli.ts run --now-from-fixtures --only <collector-id>`.
