# Status

Automatisch erzeugt von `scripts/status_report.py` am 2026-11-17 01:17 UTC. Nicht von Hand ändern; neu erzeugen mit `python3 -I scripts/status_report.py`.

Quellen der Zahlen: `catalog/scenarios.json`, `catalog/signals/*.json`, die geladenen Collectors (`src/collectors/*.ts`) und deren Kopfkommentar (`VERIFIED:`). Aufgezeichnete echte Antworten unter `fixtures/` stammen vom 2026-11-17T00:16:13Z.

Signale eines Szenarios = Katalog-Einträge plus Signale, die ein Collector zusätzlich deklariert (so verfährt auch die Engine). Ein Signal, das mehreren Szenarien dient, zählt in jeder Szenario-Zeile, in den Gesamtsummen nur einmal.

## Szenarien

| Szenario | Titel | Bereiche | Signale | davon mit Collector | davon nur katalogisiert | davon Klasse D (Aufmerksamkeit, nie gewertet) |
|---|---|---:|---:|---:|---:|---:|
| `cyber` | Cyberangriff | 9 | 304 | 91 | 213 | 37 |
| `war` | Kriegseskalation | 7 | 174 | 38 | 136 | 30 |

Summe (je Signal einmal): **478 Signale**, davon **129 mit Collector**, 349 nur katalogisiert. Davon stehen 411 in den Katalog-Dateien und 67 nur im Collector.

## Signale je Szenario und Bereich

### Cyberangriff (`cyber`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `routing` | Internet-Routen | 1 | 17 | 5 | 0 |
| `outages` | Gemessene Ausfälle | 1 | 34 | 17 | 0 |
| `dns_core` | Kern-Dienste | 0.9 | 19 | 3 | 0 |
| `threat` | Angriffs-Telemetrie | 0.9 | 41 | 19 | 2 |
| `vuln` | Schwachstellen | 0.7 | 27 | 9 | 0 |
| `finance` | Zahlungsverkehr | 1 | 25 | 10 | 0 |
| `services` | Dienste und Firmenmeldungen | 0.8 | 23 | 6 | 0 |
| `markets` | Märkte und Insider | 0.6 | 30 | 7 | 0 |
| `physical` | Strom, Verkehr, Funk | 0.9 | 45 | 8 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 35 | 6 | 35 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 8 | 1 | 0 |

### Kriegseskalation (`war`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `military` | Militär in Luft, See und All | 1 | 32 | 1 | 0 |
| `conflict` | Gemessene Kampfhandlungen | 1 | 22 | 6 | 0 |
| `shipping` | Schifffahrt und Meerengen | 0.9 | 14 | 0 | 0 |
| `connectivity` | Internet und Strom in Konfliktgebieten | 0.9 | 14 | 11 | 0 |
| `government` | Verhalten von Staaten | 0.8 | 21 | 0 | 0 |
| `energy` | Energieversorgung | 0.6 | 5 | 0 | 0 |
| `markets` | Märkte und Wetten | 0.6 | 35 | 10 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 30 | 10 | 30 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 0 |

## Collectors

`VERIFIED` kommt aus dem Kopfkommentar der Datei: **ja** = Parser gegen eine echte aufgezeichnete Antwort geprüft, **teilweise** = nur ein Teil der Abrufe oder Felder geprüft, **nein** = nur nach Dokumentation oder Erinnerung gebaut. Der Grund steht so im Kopfkommentar (gekürzt).

| Collector | VERIFIED | Grund (aus dem Kopfkommentar) | Key nötig | Signale | Intervall (min) | Test |
|---|---|---|---|---:|---:|---|
| `adsb-lol` | nein | (Antwort zu groß für die Prüf-Umgebung; Antwortform { ac: [...], total, now, msg } nach Erinnerung) | nein | 2 | 15 | ja |
| `bitnodes` | ja | (17.11.2026, echte Antwort; 100 Snapshots, 17 680 bis 20 385 Knoten, Zeitstempel unregelmäßig) | nein | 1 | 60 | ja |
| `chromiumdash` | teilweise | (17.11.2026, Form an echtem Ausschnitt geprüft; Antwort mit num=25 wartet auf neue Aufzeichnung). | nein | 1 | 360 | ja |
| `cisa-ics` | ja | (17.11.2026, echte Antwort) | nein | 1 | 1440 | ja |
| `cisa-kev` | ja | (17.11.2026, echte Antwort) | nein | 2 | 1440 | ja |
| `cloudflare-radar` | nein | Response shape (result.serie_0.{timestamps,values}, result.annotations[], result.events[] with result_info.total_count) is reconstructed from the official docs/SDK types (the docs pages were only partly readable: query-parameter… | `SR_CLOUDFLARE_KEY` | 7 | 60 | ja |
| `ct-logs` | ja | (17.11.2026, echte Antwort): tree_size in the billions (3.0 to 6.8 billion), STH timestamp matches the capture time. | nein | 3 | 60 | ja |
| `cvelist-delta` | ja | (17.11.2026, echte Antwort) | nein | 2 | 360 | ja |
| `defillama` | ja | (17.11.2026, echte Antworten; 56 Tageswerte 0,03-0,08 %, aktueller Wert 0,081 % (USDT 0,99919), plausibel) | nein | 1 | 15 | ja |
| `ecb-data` | nein | (Aufzeichnung der drei Einzelabrufe steht aus; Schlüssel EST.B.EU000A2X2A25.{VL,R25,R75} aus der Dataset-Übersicht des Portals, Antwort nicht gesehen). | nein | 2 | 720 | ja |
| `energy-charts` | teilweise | (public_power: ja, 17.11.2026, echte Antwort { unix_seconds, production_types[{name,data}] }, 15-Minuten-Raster, Tag = lokaler Kalendertag; frequency: Form { unix_seconds, data } in Sekunden bestätigt, aber Fenster von 3 h war 20… | nein | 3 | 60 | ja |
| `faa-nas` | ja | (17.11.2026, echte Antwort; LGA Ground Stop, SFO Ground Delay, 4 gelistete Sperr-NOTAMs). Ändert sich das Schema, wirft der Parser bei fehlender Wurzel, liefert aber 0 bei leeren Listen. | nein | 3 | 15 | ja |
| `firehol-blocklists` | ja | (17.11.2026) | nein | 7 | 360 | ja |
| `first-epss` | ja | (17.11.2026, echte Antwort; sieben Tage 10.–16.11. liefern 4382–4387, sehr stabil) | nein | 1 | 1440 | ja |
| `gdelt-doc` | nein | (noch keine echte Antwort: beide Abrufe liefen in TIMEOUT, neue leichtere Anfrage steht zur Aufzeichnung aus; Form {timeline:[{series, data:[{date:"YYYYMMDDTHHMMSSZ", value}]}]} nach Kenntnis). Unsicher: Sprachfilter-Schreibweise… | nein | 6 | 720 | ja |
| `github-air-raid-sirens` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `github-deepstate` | ja | (17.11.2026) | nein | 1 | 1440 | ja |
| `github-gas-henry-hub` | ja | (17.11.2026) | nein | 1 | 1440 | ja |
| `github-oil-prices` | ja | (17.11.2026) | nein | 3 | 1440 | ja |
| `github-ukraine-losses` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `grip` | teilweise | (17.11.2026, echte Antwort): Parameter und Form stimmen; ob recordsTotal bei mehreren Treffern und length=1 die volle Trefferzahl liefert, ist mit den Aufzeichnungen (höchstens 1 Treffer) nicht prüfbar. | nein | 1 | 60 | ja |
| `hn-algolia` | ja | (17.11.2026, echte Antwort): Form hits[].created_at_i/nbHits bestätigt, alle 5 Begriffe vollständig (nbHits 24 bis 171 < 400), Replay liefert 60 Tageswerte (zuletzt 27, 9, 8, 25 Stories/Tag, Wochenende ruhiger). | nein | 2 | 720 | ja |
| `ioda` | nein | (Antwort zu groß für die Prüf-Umgebung; Formen aus dem abgeschnittenen Anfang bestätigt, die verkleinerten Requests und ob extendWindow=0 gilt sind noch nicht aufgezeichnet). | nein | 10 | 60 | ja |
| `ipsum` | ja | (17.11.2026) | nein | 2 | 360 | ja |
| `malwarebazaar` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Spaltenlage nach Gedächtnis: first_seen_utc ist Spalte 0, Kopfzeile als #-Kommentar). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `mastodon-trends` | ja | (17.11.2026, echte Antwort): history[] mit day (Unix-Sekunden, String), uses, accounts bestätigt; ohne Login abrufbar. Replay: 6 vollständige Tage (laufender Tag verworfen), Summe 834 bis 2909/Tag, Wochenende niedriger. | nein | 1 | 720 | ja |
| `mempool-space` | ja | (17.11.2026, echte Antworten: fastestFee 2 sat/vB, Warteschlange 76 535 Transaktionen / 32,65 MvB; die Pool-Antwort enthält ein langes fee_histogram, die Werte sind plausibel). | nein | 2 | 15 | ja |
| `msrc-cvrf` | teilweise | (17.11.2026, Feldnamen am echten Ausschnitt geprüft; Antwort mit neuem Filter wartet auf neue Aufzeichnung). | nein | 2 | 1440 | ja |
| `noaa-swpc` | ja | (17.11.2026, echte Antwort: Array von Objekten { time_tag "2026-11-10T00:00:00" (UTC ohne Z), Kp, a_running, station_count }, 56 Einträge = 7 Tage, Kp 0-3,7). | nein | 1 | 180 | ja |
| `nyfed-markets` | teilweise | (SOFR: ja, 17.11.2026, echte Antwort; SRF-Suche lieferte 400 mit dem Pfad /rp/repo/all/results/search, neuer Pfad /rp/results/search?operationTypes=Repo nach Gedächtnis, Aufzeichnung steht aus; schlägt auch er fehl, wird der Teil… | nein | 3 | 720 | ja |
| `ooni` | ja | (17.11.2026, echte Antwort): 75 Tageswerte je Land, 2 bis 5 % anomal, über 60 000 Messungen je Tag. | nein | 10 | 720 | ja |
| `oref-github` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `polymarket-gamma` | teilweise | (17.11.2026: Parser gegen echte, vollständige Antwort geprüft; die Antworten mit limit_per_type=1 stehen noch zur Aufzeichnung aus, nur "cyber attack" (1 irrelevanter, archivierter Treffer) und "cyberattack" (0 Treffer) liegen vo… | nein | 4 | 360 | ja |
| `ransomware-live` | nein | (Antwort zu groß für die Prüf-Umgebung; Feldnamen am echten Ausschnitt bestätigt). | nein | 2 | 360 | ja |
| `ripe-atlas` | ja | (17.11.2026, echte Antwort): DE 2 038, weltweit 15 522 verbundene Probes; Antwort ca. 1 500 Zeichen. | nein | 2 | 60 | ja |
| `ripe-stat` | teilweise | (17.11.2026): Form von routing-status mit 4 von 5 echten Antworten bestätigt; country-routing-stats-Form aus dem abgeschnittenen Anfang bestätigt, vollständige Antwort (45 Tage) steht noch aus. | nein | 2 | 60 | ja |
| `sans-isc` | nein | (17.11.2026: Abruf-Werkzeug der Prüf-Umgebung blockiert den Inhaltstyp (MIME_BLOCKED), egress-Proxy blockiert isc.sans.edu; nicht verifiziert. Form nach Gedächtnis: Array von { date, records/reports, sources, targets }; topports:… | nein | 1 | 360 | ja |
| `sec-edgar` | ja | (17.11.2026, echte Antwort: hits.total.value, hits.hits[]._id/_source{adsh, form, file_date, items[]}) | nein (optional: `SR_SEC_USER_AGENT`) | 1 | 360 | ja |
| `smard` | teilweise | (Index 17.11.2026 echt, 621 Wochen-Zeitstempel; Wochendateien noch nicht aufgezeichnet, Queue mit echten Zeitstempeln neu). | nein | 1 | 60 | ja |
| `statuspage` | teilweise | (status.json: ja, 17.11.2026, 44 echte Antworten, Replay liefert Werte; incidents.json: nein, Form nach Doku, Fixtures statuspage-incidents/<host>.json stehen in der Queue; Antwortgröße ungeprüft, die Prüf-Umgebung kappt bei 24 0… | nein | 6 | 15 | ja |
| `threatfox` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Form nach Gedächtnis: Objekt { "<ioc_id>": [ { first_seen_utc, ... } ] }; Array wird ebenfalls akzeptiert). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `tor-metrics` | ja | (17.11.2026, echte Antwort): 73 plausible Tageswerte je Signal, letzter Tag 14.11.2026. | nein | 2 | 720 | ja |
| `tor-relays-github` | ja | (17.11.2026) | nein | 1 | 360 | ja |
| `tweetfeed` | ja | (17.11.2026) | nein | 2 | 360 | ja |
| `urlhaus` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Kopfzeile nach Gedächtnis: "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter"). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `wikimedia-pageviews` | nein | (neue Artikelliste noch nicht aufgezeichnet; Form {"items":[{"timestamp":"2026090300","views":1}]} laut Auftrag). | nein | 4 | 360 | ja |
| `yahoo-chart` | teilweise | (Form bestätigt, aber noch keine vollständige echte Antwort für den Replay; Aufzeichnung mit range=3mo steht aus). | nein | 13 | 720 | ja |

## Summen

- Szenarien: 2 (cyber, war)
- Signale gesamt: 478, davon mit Collector 129, nur katalogisiert 349
- Collectors: 47, davon mit Pflicht-Key 4 (SR_ABUSECH_KEY, SR_CLOUDFLARE_KEY)
- Von Collectors deklarierte Signale (Summe über Collectors): 131

| VERIFIED | Collectors | Signale dieser Collectors |
|---|---:|---:|
| ja | 26 | 58 |
| teilweise | 10 | 36 |
| nein | 11 | 37 |

Collectors mit `VERIFIED: nein` oder `teilweise` sind die offenen Prüfaufgaben: Antwort aufzeichnen (`fixtures/queue/<collector>.json`), Parser dagegen testen, Vermerk ändern.
