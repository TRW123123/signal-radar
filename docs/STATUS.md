# Status

Automatisch erzeugt von `scripts/status_report.py` am 2026-11-17 10:10 UTC. Nicht von Hand ändern; neu erzeugen mit `python3 -I scripts/status_report.py`.

Quellen der Zahlen: `catalog/scenarios.json`, `catalog/signals/*.json`, die geladenen Collectors (`src/collectors/*.ts`) und deren Kopfkommentar (`VERIFIED:`). Aufgezeichnete echte Antworten unter `fixtures/` stammen vom 2026-11-17T00:16:13Z.

Signale eines Szenarios = Katalog-Einträge plus Signale, die ein Collector zusätzlich deklariert (so verfährt auch die Engine). Ein Signal, das mehreren Szenarien dient, zählt in jeder Szenario-Zeile, in den Gesamtsummen nur einmal.

## Szenarien

| Szenario | Titel | Bereiche | Signale | davon mit Collector | davon nur katalogisiert | davon Klasse D (Aufmerksamkeit, nie gewertet) |
|---|---|---:|---:|---:|---:|---:|
| `cyber` | Cyberangriff | 9 | 304 | 91 | 213 | 37 |
| `war` | Kriegseskalation | 7 | 176 | 40 | 136 | 30 |
| `blackout` | Blackout und Energiekrise | 7 | 74 | 5 | 69 | 3 |
| `ai` | KI-Vorfall | 6 | 72 | 4 | 68 | 15 |
| `finance` | Finanzkrise und Bankenstress | 7 | 77 | 10 | 67 | 6 |
| `nuclear` | Nuklearer Zwischenfall | 6 | 79 | 25 | 54 | 10 |
| `bio` | Pandemie und Ausbrüche | 8 | 75 | 0 | 75 | 10 |

Summe (je Signal einmal): **857 Signale**, davon **175 mit Collector**, 682 nur katalogisiert. Davon stehen 782 in den Katalog-Dateien und 75 nur im Collector.

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
| `markets` | Märkte und Wetten | 0.6 | 37 | 12 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 30 | 10 | 30 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 0 |

### Blackout und Energiekrise (`blackout`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `grid` | Stromnetz | 1 | 18 | 0 | 0 |
| `gas` | Gasversorgung | 1 | 14 | 3 | 0 |
| `prices` | Energiepreise | 0.8 | 7 | 0 | 0 |
| `weather` | Wetter | 0.9 | 10 | 0 | 0 |
| `plants` | Kraftwerke und Pegel | 0.9 | 9 | 0 | 0 |
| `outages` | Gemessene Stromausfälle | 1 | 8 | 0 | 0 |
| `markets` | Märkte | 0.6 | 4 | 2 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 3 | 0 | 3 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 0 |

### KI-Vorfall (`ai`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `platforms` | Modell-Plattformen | 1 | 13 | 0 | 0 |
| `supply_chain` | Software-Lieferkette | 1 | 15 | 4 | 0 |
| `agents` | Aktivität autonomer Agenten | 0.9 | 13 | 0 | 0 |
| `incidents` | Vorfall-Sammlungen | 0.6 | 4 | 0 | 0 |
| `compute` | Rechenleistung und Strom | 0.7 | 7 | 0 | 0 |
| `markets` | Märkte und Wetten | 0.6 | 5 | 0 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 14 | 0 | 14 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 1 |

### Finanzkrise und Bankenstress (`finance`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `money_market` | Geldmarkt | 1 | 15 | 5 | 0 |
| `credit` | Kreditaufschläge | 1 | 13 | 1 | 0 |
| `banks` | Banken | 1 | 15 | 1 | 0 |
| `volatility` | Schwankungen | 0.8 | 5 | 1 | 0 |
| `crypto` | Krypto | 0.5 | 6 | 1 | 0 |
| `real_economy` | Realwirtschaft | 0.6 | 10 | 1 | 0 |
| `markets` | Märkte | 0.5 | 6 | 0 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 6 | 0 | 6 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 0 |

### Nuklearer Zwischenfall (`nuclear`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `radiation` | Strahlung in der Umwelt | 1 | 19 | 2 | 0 |
| `seismic` | Erdbeben und Explosionen | 0.9 | 12 | 8 | 0 |
| `plants` | Kraftwerke | 0.7 | 11 | 0 | 0 |
| `alerts` | Amtliche Warnungen | 0.3 | 7 | 3 | 0 |
| `military` | Militär und Luftraum | 0.6 | 7 | 1 | 0 |
| `markets` | Märkte, Wetten und Vorsorgekäufe | 0.5 | 9 | 7 | 2 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 8 | 4 | 8 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 6 | 0 | 0 |

### Pandemie und Ausbrüche (`bio`)

| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |
|---|---|---:|---:|---:|---:|
| `wastewater` | Abwasser | 1 | 13 | 0 | 0 |
| `clinical` | Arztbesuche und Krankenhäuser | 1 | 22 | 0 | 0 |
| `outbreaks` | Ausbruchsmeldungen | 0.4 | 5 | 0 | 0 |
| `animal` | Tierseuchen | 0.9 | 9 | 0 | 0 |
| `genomic` | Erbgut-Überwachung | 0.8 | 4 | 0 | 0 |
| `mortality` | Sterbefälle | 0.8 | 4 | 0 | 0 |
| `behaviour` | Verhalten und Versorgung | 0.5 | 3 | 0 | 0 |
| `markets` | Märkte | 0.4 | 4 | 0 | 0 |
| `attention` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 10 | 0 | 10 |
| `context` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | 1 | 0 | 0 |

## Collectors

`VERIFIED` kommt aus dem Kopfkommentar der Datei: **ja** = Parser gegen eine echte aufgezeichnete Antwort geprüft, **teilweise** = nur ein Teil der Abrufe oder Felder geprüft, **nein** = nur nach Dokumentation oder Erinnerung gebaut. Der Grund steht so im Kopfkommentar (gekürzt).

| Collector | VERIFIED | Grund (aus dem Kopfkommentar) | Key nötig | Signale | Intervall (min) | Test |
|---|---|---|---|---:|---:|---|
| `adsb-lol` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 3 | 15 | ja |
| `bfs-odl` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 60 | nein |
| `bitnodes` | ja | (17.11.2026, echte Antwort; 100 Snapshots, 17 680 bis 20 385 Knoten, Zeitstempel unregelmäßig) | nein | 1 | 60 | ja |
| `blackout-energy-prices-github` | ja | (17.11.2026, echte Antwort) | nein | 2 | 1440 | ja |
| `chromiumdash` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 1 | 360 | ja |
| `cisa-ics` | ja | (17.11.2026, echte Antwort) | nein | 1 | 1440 | ja |
| `cisa-kev` | ja | (17.11.2026, echte Antwort) | nein | 2 | 1440 | ja |
| `cloudflare-radar` | nein | Response shape (result.serie_0.{timestamps,values}, result.annotations[], result.events[] with result_info.total_count) is reconstructed from the official docs/SDK types (the docs pages were only partly readable: query-parameter… | `SR_CLOUDFLARE_KEY` | 7 | 60 | ja |
| `ct-logs` | ja | (17.11.2026, echte Antwort): tree_size in the billions (3.0 to 6.8 billion), STH timestamp matches the capture time. | nein | 3 | 60 | ja |
| `cvelist-delta` | ja | (17.11.2026, echte Antwort) | nein | 2 | 360 | ja |
| `defillama` | ja | (17.11.2026, echte Antworten; 56 Tageswerte 0,03-0,08 %, aktueller Wert 0,081 % (USDT 0,99919), plausibel) | nein | 1 | 15 | ja |
| `ecb-data` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 720 | ja |
| `ecb-finance-rates` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 720 | ja |
| `energy-charts` | teilweise | (public_power: ja, 17.11.2026, echte Antwort { unix_seconds, production_types[{name,data}] }, 15-Minuten-Raster, Tag = lokaler Kalendertag; frequency: Form { unix_seconds, data } in Sekunden bestätigt, aber Fenster von 3 h war 20… | nein | 3 | 60 | ja |
| `faa-nas` | ja | (17.11.2026, echte Antwort; LGA Ground Stop, SFO Ground Delay, 4 gelistete Sperr-NOTAMs). Ändert sich das Schema, wirft der Parser bei fehlender Wurzel, liefert aber 0 bei leeren Listen. | nein | 3 | 15 | ja |
| `fdic-bankfind` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 1 | 720 | ja |
| `finance-money-market` | ja | (17.11.2026, Replay mit echten Antworten: SOFR-Streuung 7 bp, SOFR-Volumen 3092 Mrd. USD am 13.11., Stablecoin 0,081 %) | nein | 5 | 720 | ja |
| `firehol-blocklists` | ja | (17.11.2026) | nein | 7 | 360 | ja |
| `first-epss` | ja | (17.11.2026, echte Antwort; sieben Tage 10.–16.11. liefern 4382–4387, sehr stabil) | nein | 1 | 1440 | ja |
| `gdelt-doc` | teilweise | (17.11.2026, echte Antwort aus Node und curl): Form { timeline: [{ series, data: [{ date, value }] }] } stimmt, Sprachfilter sourcelang:english / sourcelang:german gilt. GDELT antwortet langsam (12 bis 23 s) und begrenzt auf eine… | nein | 7 | 720 | ja |
| `github-air-raid-sirens` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `github-deepstate` | ja | (17.11.2026) | nein | 1 | 1440 | ja |
| `github-gas-henry-hub` | ja | (17.11.2026) | nein | 1 | 1440 | ja |
| `github-gas-storage` | ja | (17.11.2026, echte Antwort) | nein | 3 | 1440 | ja |
| `github-oil-prices-finance` | ja | (17.11.2026, echte Antwort) | nein | 1 | 1440 | ja |
| `github-oil-prices` | ja | (17.11.2026) | nein | 3 | 1440 | ja |
| `github-ukraine-losses` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `grip` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 1 | 60 | ja |
| `hn-algolia` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 720 | ja |
| `ioda` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 10 | 60 | ja |
| `ipsum` | ja | (17.11.2026) | nein | 2 | 360 | ja |
| `malwarebazaar` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Spaltenlage nach Gedächtnis: first_seen_utc ist Spalte 0, Kopfzeile als #-Kommentar). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `mastodon-trends` | ja | (17.11.2026, echte Antwort): history[] mit day (Unix-Sekunden, String), uses, accounts bestätigt; ohne Login abrufbar. Replay: 6 vollständige Tage (laufender Tag verworfen), Summe 834 bis 2909/Tag, Wochenende niedriger. | nein | 1 | 720 | ja |
| `mempool-space` | ja | (17.11.2026, echte Antworten: fastestFee 2 sat/vB, Warteschlange 76 535 Transaktionen / 32,65 MvB; die Pool-Antwort enthält ein langes fee_histogram, die Werte sind plausibel). | nein | 2 | 15 | ja |
| `msrc-cvrf` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 1440 | ja |
| `nina-warnings` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 3 | 15 | nein |
| `noaa-swpc` | ja | (17.11.2026, echte Antwort: Array von Objekten { time_tag "2026-11-10T00:00:00" (UTC ohne Z), Kp, a_running, station_count }, 56 Einträge = 7 Tage, Kp 0-3,7). | nein | 1 | 180 | ja |
| `nyfed-markets` | teilweise | (SOFR: ja, 17.11.2026, echte Antwort; SRF-Suche lieferte 400 mit dem Pfad /rp/repo/all/results/search, neuer Pfad /rp/results/search?operationTypes=Repo nach Gedächtnis, Aufzeichnung steht aus; schlägt auch er fehl, wird der Teil… | nein | 3 | 720 | ja |
| `ooni` | ja | (17.11.2026, echte Antwort mit 75 Tagen): 2 bis 5 % anomal, über 60 000 Messungen je Tag; Antwort mit 30 Tagen steht zur Aufzeichnung aus. | nein | 10 | 720 | ja |
| `oref-github` | ja | (17.11.2026) | nein | 2 | 1440 | ja |
| `polymarket-gamma` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 6 | 360 | ja |
| `pypi` | ja | (17.11.2026, echte Antwort) | nein | 4 | 15 | nein |
| `ransomware-live` | ja | (17.11.2026, echte Antwort) | nein | 2 | 360 | ja |
| `ripe-atlas` | ja | (17.11.2026, echte Antwort): DE 2 038, weltweit 15 522 verbundene Probes; Antwort ca. 1 500 Zeichen. | nein | 2 | 60 | ja |
| `ripe-stat` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 2 | 60 | ja |
| `sans-isc` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 1 | 360 | ja |
| `sec-edgar` | ja | (17.11.2026, echte Antwort: hits.total.value, hits.hits[]._id/_source{adsh, form, file_date, items[]}) | nein (optional: `SR_SEC_USER_AGENT`) | 1 | 360 | ja |
| `smard` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 1 | 60 | ja |
| `statuspage` | teilweise | (status.json: ja, 17.11.2026, 44 echte Antworten, Replay liefert Werte; incidents.json: nein, Form nach Doku, Fixtures statuspage-incidents/<host>.json stehen in der Queue; Antwortgröße ungeprüft, die Prüf-Umgebung kappt bei 24 0… | nein | 6 | 15 | ja |
| `threatfox` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Form nach Gedächtnis: Objekt { "<ioc_id>": [ { first_seen_utc, ... } ] }; Array wird ebenfalls akzeptiert). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `tor-metrics` | ja | (17.11.2026, echte Antwort): 73 plausible Tageswerte je Signal, letzter Tag 14.11.2026. | nein | 2 | 720 | ja |
| `tor-relays-github` | ja | (17.11.2026) | nein | 1 | 360 | ja |
| `treasury-fiscal` | ja | (17.11.2026, echte Antwort) | nein | 1 | 720 | ja |
| `tweetfeed` | ja | (17.11.2026) | nein | 2 | 360 | ja |
| `urlhaus` | nein | (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Kopfzeile nach Gedächtnis: "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter"). | `SR_ABUSECH_KEY` | 1 | 60 | ja |
| `usgs-quakes` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 8 | 60 | nein |
| `wikimedia-pageviews` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 7 | 360 | ja |
| `yahoo-chart` | ja | (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel) | nein | 18 | 720 | ja |

## Summen

- Szenarien: 7 (cyber, war, blackout, ai, finance, nuclear, bio)
- Signale gesamt: 857, davon mit Collector 175, nur katalogisiert 682
- Collectors: 58, davon mit Pflicht-Key 4 (SR_ABUSECH_KEY, SR_CLOUDFLARE_KEY)
- Von Collectors deklarierte Signale (Summe über Collectors): 175

| VERIFIED | Collectors | Signale dieser Collectors |
|---|---:|---:|
| ja | 50 | 146 |
| teilweise | 4 | 19 |
| nein | 4 | 10 |

Collectors mit `VERIFIED: nein` oder `teilweise` sind die offenen Prüfaufgaben: Antwort aufzeichnen (`fixtures/queue/<collector>.json`), Parser dagegen testen, Vermerk ändern.
