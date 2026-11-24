# Backtest-Bericht Cyber

Erzeugt 2026-11-24 01:45 UTC mit `src/backtest/evaluate.ts`. Diese Datei wird bei jedem Lauf überschrieben.

Ergebnis-Dateien:

- `backtest/results/history-change-healthcare-2024-02.json`: history:change-healthcare-2024-02 (anchor 2024-03-11T00:00:00.000Z), 2024-01-31 02:59 bis 2024-03-08 23:59 UTC, alle 3 h, 304 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-colonial-pipeline-2021-05.json`: history:colonial-pipeline-2021-05 (anchor 2021-05-19T00:00:00.000Z), 2021-04-16 02:59 bis 2021-05-16 23:59 UTC, alle 3 h, 248 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-2019-08.json`: history:control-2019-08 (anchor 2019-08-22T00:00:00.000Z), 2019-07-15 02:59 bis 2019-08-19 23:59 UTC, alle 3 h, 288 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-2023-08.json`: history:control-2023-08 (anchor 2023-08-31T00:00:00.000Z), 2023-07-24 02:59 bis 2023-08-28 23:59 UTC, alle 3 h, 288 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-iberia-2025-03.json`: history:control-iberia-2025-03 (anchor 2025-04-05T00:00:00.000Z), 2025-03-10 00:00 bis 2025-04-05 00:00 UTC, alle 3 h, 209 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-israel-iran-2025-05.json`: history:control-israel-iran-2025-05 (anchor 2025-05-21T00:00:00.000Z), 2025-04-25 00:00 bis 2025-05-21 00:00 UTC, alle 3 h, 209 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-crowdstrike-2024-07.json`: history:crowdstrike-2024-07 (anchor 2024-07-25T00:00:00.000Z), 2024-06-28 04:00 bis 2024-07-24 04:00 UTC, alle 3 h, 209 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-dyn-ddos-2016-10.json`: history:dyn-ddos-2016-10 (anchor 2016-10-25T00:00:00.000Z), 2016-09-30 12:00 bis 2016-10-25 00:00 UTC, alle 3 h, 197 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-facebook-bgp-2021-10.json`: history:facebook-bgp-2021-10 (anchor 2021-10-08T00:00:00.000Z), 2021-09-13 18:00 bis 2021-10-08 00:00 UTC, alle 3 h, 195 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-iberia-blackout-2025-04.json`: history:iberia-blackout-2025-04 (anchor 2025-05-03T00:00:00.000Z), 2025-04-07 12:00 bis 2025-05-03 00:00 UTC, alle 3 h, 205 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-israel-iran-2025-06.json`: history:israel-iran-2025-06 (anchor 2025-06-28T00:00:00.000Z), 2025-05-23 02:59 bis 2025-06-25 23:59 UTC, alle 3 h, 272 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-log4shell-2021-12.json`: history:log4shell-2021-12 (anchor 2021-12-24T00:00:00.000Z), 2021-11-19 02:59 bis 2021-12-21 23:59 UTC, alle 3 h, 264 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-moveit-2023-05.json`: history:moveit-2023-05 (anchor 2023-06-20T00:00:00.000Z), 2023-05-10 02:59 bis 2023-06-17 23:59 UTC, alle 3 h, 312 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-notpetya-2017-06.json`: history:notpetya-2017-06 (anchor 2017-07-08T00:00:00.000Z), 2017-06-06 11:59 bis 2017-07-05 23:59 UTC, alle 3 h, 237 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-rogers-2022-07.json`: history:rogers-2022-07 (anchor 2022-07-13T00:00:00.000Z), 2022-06-17 09:00 bis 2022-07-13 00:00 UTC, alle 3 h, 206 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar

Regeln: Zu jedem Zeitschritt wird der Wert so berechnet, wie ihn das System damals gezeigt hätte (nur Daten bis zu diesem Zeitpunkt, Engine unverändert). Ein Ereignis zählt im Fenster von 72 h vor Beginn bis 24 h nach Ende. Ein Fenster ist nur prüfbar, wenn im Median mindestens 3 Bereiche frische Daten mit Baseline hatten; sonst „nicht prüfbar“ (kein Fehlschlag). Vorlaufzeit: erster Zeitschritt ab Stufe 1 bzw. 2 relativ zum Ereignisbeginn, negative Werte = vorher. Die Auflösung ist die Schrittweite.

## Datengrundlage

**47 von 306 Signalen** des Szenarios (davon 86 mit Collector, Rest nur katalogisiert) hatten im Zeitraum mindestens einmal frische Daten. **9 von 9 Bereichen** hatten mindestens einmal frische Daten mit Baseline (nur Klassen A und B zählen). 3229 von 3643 Zeitschritten hatten mindestens 3 Bereiche mit Daten.

| Bereich | Signale im Katalog | davon mit Daten | davon Klasse D (nicht gewertet) | Zeitschritte mit Daten + Baseline |
|---|---:|---:|---:|---:|
| Internet-Routen (`routing`) | 17 | 1 | 0 | 2748 (75,4 %) |
| Gemessene Ausfälle (`outages`) | 34 | 3 | 0 | 3162 (86,8 %) |
| Kern-Dienste (`dns_core`) | 19 | 0 | 0 | 0 (0,0 %) |
| Angriffs-Telemetrie (`threat`) | 43 | 0 | 0 | 0 (0,0 %) |
| Schwachstellen (`vuln`) | 27 | 2 | 0 | 1583 (43,5 %) |
| Zahlungsverkehr (`finance`) | 25 | 2 | 0 | 2314 (63,5 %) |
| Dienste und Firmenmeldungen (`services`) | 23 | 1 | 0 | 513 (14,1 %) |
| Märkte und Insider (`markets`) | 30 | 3 | 0 | 2917 (80,1 %) |
| Strom, Verkehr, Funk (`physical`) | 45 | 0 | 0 | 0 (0,0 %) |
| `attention` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 35 | 0 | 0 | – |
| `context` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 8 | 0 | 0 | – |

<details><summary>Signale mit Daten im Zeitraum</summary>

| Signal | Bereich | Klasse | Werte im Zeitraum | Zeitschritte frisch |
|---|---|---|---:|---:|
| `cyber.finance.sofr_tail` | finance | A | 193 | 2314 von 3643 |
| `cyber.finance.sofr_volume` | finance | A | 193 | 2314 von 3643 |
| `cyber.markets.cyber_etf_abs_return` | markets | A | 61 | 708 von 3643 |
| `cyber.markets.cyber_etf_volume` | markets | A | 61 | 708 von 3643 |
| `cyber.markets.vix` | markets | A | 203 | 2436 von 3643 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 60 | 575 von 3643 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 335 | 2748 von 3643 |
| `cyber.outages.tor_advertised_bandwidth` | outages | A | 67 | 598 von 3643 |
| `cyber.routing.country_prefix_visibility_de` | routing | A | 310 | 2748 von 3643 |
| `cyber.services.sec_8k_item105_daily_count` | services | B | 63 | 513 von 3643 |
| `cyber.vuln.kev_additions_rate` | vuln | B | 193 | 1583 von 3643 |
| `cyber.vuln.kev_ransomware_flag` | vuln | B | 193 | 1583 von 3643 |

</details>

## Stufen-Verteilung

| Stufe | Zeitschritte | Anteil | zum Vergleich: wenn Schritte ohne abweichenden Bereich als Ruhig gälten |
|---|---:|---:|---:|
| 0 Ruhig | 3533 | 97,0 % | 3533 (97,0 %) |
| 1 Einzelne Auffälligkeit | 98 | 2,7 % | 98 (2,7 %) |
| 2 Mehrere Auffälligkeiten | 12 | 0,3 % | 12 (0,3 %) |
| 3 Deutliche Häufung | 0 | 0,0 % | 0 (0,0 %) |
| 4 Starke Häufung | 0 | 0,0 % | 0 (0,0 %) |

## Ereignisse

| Ereignis | Beginn (UTC) | prüfbar | Schritte im Fenster | Bereiche mit Daten (Median / Max) | höchste Stufe (Wert) | Vorlauf Stufe 1 | Vorlauf Stufe 2 | abweichende Bereiche | erwartete Bereiche mit Daten | erwartete Bereiche getroffen | Ergebnis |
|---|---|---|---:|---:|---|---:|---:|---|---|---:|---|
| CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm | 2024-07-19 04:00 | ja | 55 | 6,0 / 6 | 0 (0,01) | nie | nie | – | services, finance, markets | 0/4 | **verpasst** |
| Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar) | 2021-10-04 15:30 | ja | 34 | 4,0 / 4 | 1 (0,25) | -1 h | nie | routing | routing, outages | 1/4 | **schwach** |
| Stromausfall auf der Iberischen Halbinsel (Spanien und Portugal) | 2025-04-28 10:33 | nein | 78 | 2,5 / 3 | 1 (0,20) | +2 h | nie | outages | grid, outages | 1/2 | **nicht prüfbar** |
| Krieg zwischen Israel und Iran (zwölf Tage) | 2025-06-13 00:00 | ja | 128 | 3,0 / 3 | 2 (0,49) | +51 h | +135 h | conflict, connectivity | conflict, connectivity, markets | 2/3 | **erkannt** |
| Ransomware-Angriff auf Change Healthcare (UnitedHealth) | 2024-02-21 00:00 | ja | 160 | 6,0 / 6 | 0 (0,01) | nie | nie | – | services | 0/2 | **verpasst** |
| Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt | 2021-12-10 00:00 | ja | 120 | 5,0 / 5 | 0 (0,00) | nie | nie | – | vuln | 0/2 | **verpasst** |
| MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p | 2023-05-31 00:00 | ja | 168 | 4,0 / 4 | 0 (0,01) | nie | nie | – | vuln | 0/3 | **verpasst** |
| Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline | 2021-05-07 00:00 | ja | 104 | 4,0 / 4 | 0 (0,01) | nie | nie | – | keiner | 0/3 | **verpasst** |
| Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac) | 2022-07-08 08:00 | ja | 45 | 5,0 / 5 | 1 (0,28) | -26 h | nie | outages, routing | routing, outages, finance | 2/4 | **schwach** |
| DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn | 2016-10-21 11:00 | ja | 36 | 3,0 / 3 | 0 (0,01) | nie | nie | – | outages | 0/4 | **verpasst** |
| NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.) | 2017-06-27 09:00 | ja | 93 | 3,0 / 3 | 0 (0,00) | nie | nie | – | markets | 0/4 | **verpasst** |
| Microsoft-365-Ausfall (Outlook, Teams) laut Sekundärquelle ¹ | 2026-11-12 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/1 | **nicht prüfbar** |
| Landesweiter FAA-Ground-Stop in den USA laut Sekundärquelle ¹ | 2026-11-13 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/1 | **nicht prüfbar** |
| Störungen beim Online-Banking großer US-Banken laut Sekundärquelle ¹ | 2026-11-16 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/2 | **nicht prüfbar** |

¹ laut Sekundärquelle, nicht selbst verifiziert (siehe `backtest/events.json`).

Stärkste Signale je prüfbarem Ereignis (höchster Beitrag im Fenster):

- CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm: `cyber.markets.vix` 0,18, `cyber.outages.ooni_anomaly_share_us` 0,00
- Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar): `cyber.routing.bgp_updates_as32934` 0,85, `cyber.attention.wiki_en_facebook` 0,22, `cyber.outages.ooni_anomaly_share_de` 0,18, `cyber.markets.cyber_etf_abs_return` 0,03
- Krieg zwischen Israel und Iran (zwölf Tage): `war.connectivity.ioda_ir_ping` 0,85, `war.conflict.israel_oref` 0,64, `war.markets.oil_volatility_ovx` 0,24, `war.connectivity.ooni_anomaly_share_il` 0,20, `war.connectivity.ooni_anomaly_share_ir` 0,13
- Ransomware-Angriff auf Change Healthcare (UnitedHealth): `cyber.markets.cyber_etf_abs_return` 0,14, `cyber.markets.cyber_etf_volume` 0,03
- MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p: `cyber.finance.sofr_tail` 0,06
- Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline: `cyber.markets.vix` 0,16
- Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac): `cyber.routing.bgp_updates_as812` 0,85, `cyber.outages.ioda_as812_bgp` 0,80, `cyber.outages.ioda_as812_ping` 0,80, `cyber.outages.ioda_ca_ping` 0,24, `cyber.attention.wiki_en_rogers` 0,22
- DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn: `cyber.outages.ooni_anomaly_share_de` 0,05

## Kontroll-Zeiträume

| Zeitraum | von | bis | prüfbar | Schritte | Bereiche mit Daten (Median / Max) | Anteil ab Stufe 1 | Anteil ab Stufe 2 | höchste Stufe | Ergebnis |
|---|---|---|---|---:|---:|---:|---:|---|---|
| Vergleichszeitraum ohne kuratiertes Großereignis (Okt./Nov. 2026) | 2026-10-19 00:00 | 2026-11-04 23:59 | nein | 0 | 0,0 / 0 | n. v. | n. v. | – | **nicht prüfbar** |
| Historischer Vergleichszeitraum August 2019 | 2019-08-05 00:00 | 2019-08-18 23:59 | ja | 112 | 4,0 / 4 | 0,0 % | 0,0 % | 0 | **ruhig** |
| Historischer Vergleichszeitraum August 2023 | 2023-08-14 00:00 | 2023-08-27 23:59 | ja | 112 | 5,0 / 5 | 0,0 % | 0,0 % | 0 | **ruhig** |
| Vergleichszeitraum Spanien/Portugal, vier Wochen vor dem Stromausfall | 2025-03-31 00:00 | 2025-04-01 23:59 | nein | 16 | 2,0 / 2 | 0,0 % | 0,0 % | 0 | **nicht prüfbar** |
| Vergleichszeitraum Nahost, vier Wochen vor dem Israel-Iran-Krieg | 2025-05-16 00:00 | 2025-05-17 23:59 | ja | 16 | 3,0 / 3 | 0,0 % | 0,0 % | 0 | **ruhig** |

## Außerhalb von Ereignisfenstern

Alle Zeitschritte, die in keinem (erweiterten) Ereignisfenster liegen. Jeder Schritt ab Stufe 1 ist hier ein Fehlalarm, sofern es nicht ein Ereignis gab, das in der Liste fehlt.

| Menge | Zeitschritte | Anteil ab Stufe 1 | Anteil ab Stufe 2 |
|---|---:|---:|---:|
| alle | 2622 | 1,0 % | 0,0 % |
| nur Schritte mit mindestens 3 Bereichen mit Daten | 2247 | 1,2 % | 0,0 % |

Zusammenhängende Phasen ab Stufe 1 außerhalb von Ereignissen: 9.

## Laute Signale

Einzel-Ausschläge je Signal außerhalb von Ereignisfenstern: Zahl der Phasen, in denen das Signal einen Beitrag > 0 lieferte, hochgerechnet auf 30 Tage mit Daten. Signale mit weniger als 3 Tagen Daten erhalten keine Rate.

| Signal | Bereich | Klasse | Tage mit Daten | Ausschläge | je 30 Tage | Zeitschritte mit Beitrag |
|---|---|---|---:|---:|---:|---:|
| `cyber.routing.bgp_updates_as812` | routing | A | 20,1 | 13 | 19,4 | 38 |
| `cyber.routing.bgp_updates_as32934` | routing | A | 20,1 | 5 | 7,5 | 15 |
| `cyber.markets.cyber_etf_abs_return` | markets | A | 57,4 | 3 | 1,6 | 77 |
| `war.connectivity.ooni_anomaly_share_il` | connectivity | A | 39,3 | 2 | 1,5 | 28 |
| `war.connectivity.ooni_anomaly_share_ir` | connectivity | A | 39,3 | 2 | 1,5 | 17 |
| `blackout.outages.ioda_es_ping` | outages | A | 46,9 | 2 | 1,3 | 8 |
| `blackout.outages.ioda_pt_ping` | outages | A | 46,9 | 2 | 1,3 | 9 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 241,6 | 8 | 1,0 | 193 |
| `cyber.markets.vix` | markets | A | 223,6 | 6 | 0,8 | 224 |
| `war.markets.oil_volatility_ovx` | markets | A | 39,3 | 1 | 0,8 | 40 |
| `cyber.finance.sofr_tail` | finance | A | 203,5 | 4 | 0,6 | 124 |
| `blackout.attention.wiki_de_stromausfall` | attention | D | 46,9 | 1 | 0,6 | 31 |
| `blackout.attention.wiki_en_power_outage` | attention | D | 46,9 | 1 | 0,6 | 46 |
| `blackout.attention.wiki_es_apagon` | attention | D | 46,9 | 1 | 0,6 | 17 |
| `blackout.outages.ooni_anomaly_share_es` | outages | A | 46,9 | 1 | 0,6 | 32 |
| `cyber.markets.cyber_etf_volume` | markets | A | 57,4 | 1 | 0,5 | 32 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 57,5 | 1 | 0,5 | 4 |
| `cyber.vuln.kev_ransomware_flag` | vuln | B | 129,4 | 1 | 0,2 | 32 |
| `cyber.finance.sofr_volume` | finance | A | 203,5 | 1 | 0,1 | 48 |

28 Signale mit Daten schlugen außerhalb von Ereignissen nie aus.

## Was das Radar je Ereignis gezeigt hätte (Historien-Läufe)

Grundlage: echte historische Antworten der Quellen unter `fixtures/backtest/<ereignis>/`, je Ereignis zum Zeitpunkt „Ende + 4 Tage“ eingelesen; zu jedem Zeitschritt nur Daten bis zu diesem Zeitpunkt, Tageswerte erst ab Tagesende sichtbar, Engine unverändert. Allgemeine Reihen (alle Cyber-Zeiträume): NY Fed (SOFR), Yahoo (VIX, Cyber-ETFs CIBR/HACK/BUG), RIPEstat (sichtbare Netzblöcke Deutschland), OONI (Web-Messungen USA, teils Deutschland), Tor Metrics (Bandbreite), SEC EDGAR (8-K Item 1.05, ab 2024), CISA KEV (ab 11/2021) und CISA ICS. Dazu kommen je Ereignis eigene Messungen (Feld `probes` in `backtest/events.json`, eingelesen von `src/backtest/history-adapters.ts`): die Messungen, die das Ereignis physisch zeigen müssten, auch für Länder und Netze, die der Live-Betrieb nicht abfragt. Jede wird ein eigenes, benanntes Wiedergabe-Signal mit den Engine-Einstellungen einer Katalog-Vorlage (Grundlinie, Schwellen, Gewicht, Richtung, Beweisklasse). Iberischer Stromausfall: IODA Spanien/Portugal (Routing und Ping), Energy-Charts Netzlast Spanien/Portugal, OONI Spanien/Portugal, Wikipedia-Aufrufe. Israel–Iran: Luftalarme Israel (GitHub-Datensatz), IODA Iran/Israel, OONI Iran/Israel, Brent (GitHub-Datensatz und Yahoo), WTI, Gold, OVX, VIX, Wikipedia-Aufrufe. Rogers: IODA Kanada und AS812 (Routing und Ping), Wikipedia. Facebook: RIPEstat sichtbare Präfixe AS32934, Wikipedia. Kontroll-Zeiträume nutzen dieselben Messungen (Feld `probesFrom`), eingelesen zu ihrem eigenen, früheren Zeitpunkt.

„Auffällig“ heißt hier: Anomalie der Engine ≥ 0,25 (z deutlich über der Schwelle). Zeiten relativ zum Ereignisbeginn, gesucht von 3 Tagen davor bis 1 Tag nach dem Ende. „Gesehen?“ ist dieselbe Regel wie in den Wiedergaben (`src/backtest/replays.ts`): „ja“ nur bei Stufenanstieg ab Ereignisbeginn durch abweichende Bereiche (nicht, wenn nur eine einzige Messung anschlug, die auch in den 4 Wochen davor ausschlug: dann „teilweise“), „teilweise“ bei einzelnen auffälligen Messungen in einem erwarteten Bereich, sonst „nein“. Ausschläge vor Beginn zählen nur, wenn dieselbe Messung in den 4 Wochen davor ruhig war; sonst sind sie als Rauschen markiert. Kontroll-Zeiträume sind immer „nein“; Spalte „Kontrolle“ zeigt „ruhig geblieben“ oder „Fehlalarm“ (Stufe ≥ 1).

| Zeitraum | Art | Signale mit Daten | Bereiche mit Daten | erwartete Bereiche ohne Daten | höchste Stufe (Wert) | auffällige Messungen (Beginn, max. z) | Gesehen? |
|---|---|---:|---|---|---|---|---|
| Ransomware-Angriff auf Change Healthcare (UnitedHealth) (`change-healthcare-2024-02`) | Ereignis | 10 | finance, markets, outages, routing, services, vuln | threat | 0 Ruhig (0,009) | `markets.cyber_etf_abs_return` +27 h, z 5,3 (nicht erwarteter Bereich) | **nein** |
| Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline (`colonial-pipeline-2021-05`) | Ereignis | 5 | finance, markets, outages, routing | physical, services, threat | 0 Ruhig (0,010) | `markets.vix` +147 h, z 4,8 (nicht erwarteter Bereich) | **nein** |
| Historischer Vergleichszeitraum August 2019 (`control-2019-08`) | Kontrolle | 5 | finance, markets, outages, routing | – | 0 Ruhig (0,015) | `markets.vix` +27 h, z 5,6 | **nein** (ruhig geblieben) |
| Historischer Vergleichszeitraum August 2023 (`control-2023-08`) | Kontrolle | 7 | finance, markets, outages, routing, vuln | – | 0 Ruhig (0,002) | keine | **nein** (ruhig geblieben) |
| Vergleichszeitraum Spanien/Portugal, vier Wochen vor dem Stromausfall (`control-iberia-2025-03`) | Kontrolle | 11 | grid, outages | – | 0 Ruhig (0,000) | keine | **nein** (ruhig geblieben) |
| Vergleichszeitraum Nahost, vier Wochen vor dem Israel-Iran-Krieg (`control-israel-iran-2025-05`) | Kontrolle | 15 | conflict, connectivity, markets | – | 0 Ruhig (0,000) | keine | **nein** (ruhig geblieben) |
| CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm (`crowdstrike-2024-07`) | Ereignis | 10 | finance, markets, outages, routing, services, vuln | physical | 0 Ruhig (0,012) | `markets.vix` -3 h, z 5,0 | **teilweise** |
| DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn (`dyn-ddos-2016-10`) | Ereignis | 5 | markets, outages, routing | dns_core, services, threat | 0 Ruhig (0,006) | `outages.ooni_anomaly_share_de` -71 h (Rauschen: schlug auch in den 4 Wochen davor aus) | **nein** |
| Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar) (`facebook-bgp-2021-10`) | Ereignis | 12 | finance, markets, outages, routing | dns_core, services | 1 Einzelne Auffälligkeit (0,250) | `routing.bgp_updates_as32934` 0 h, z 40,9; `attention.wiki_en_facebook` +9 h, z 41,1 (nicht erwarteter Bereich); `outages.ooni_anomaly_share_de` -63 h, z 6,0 | **teilweise** (schwach: nur `BGP-Meldungen für Facebook (AS32934, RIPEstat)`, schlug auch vorher aus) |
| Stromausfall auf der Iberischen Halbinsel (Spanien und Portugal) (`iberia-blackout-2025-04`) | Ereignis | 11 | grid, outages | keine | 1 Einzelne Auffälligkeit (0,202) | `outages.ioda_pt_ping` +1 h, z 14,5; `outages.ioda_es_ping` +1 h, z 14,1; `attention.wiki_es_apagon` +13 h, z 120,5 (nicht erwarteter Bereich); `attention.wiki_de_stromausfall` +13 h, z 86,5 (nicht erwarteter Bereich); `attention.wiki_en_power_outage` +13 h, z 79,8 (nicht erwarteter Bereich); `grid.load_pt` +1 h, z 4,7 | **ja** |
| Krieg zwischen Israel und Iran (zwölf Tage) (`israel-iran-2025-06`) | Ereignis | 15 | conflict, connectivity, markets | keine | 2 Mehrere Auffälligkeiten (0,490) | `connectivity.ooni_anomaly_share_il` -45 h, z 9,7; `markets.oil_volatility_ovx` +27 h, z 7,4; `conflict.israel_oref` +27 h, z 12,8; `connectivity.ioda_ir_ping` +135 h, z 19,3; `connectivity.ooni_anomaly_share_ir` +27 h, z 5,2 | **ja** |
| Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt (`log4shell-2021-12`) | Ereignis | 7 | finance, markets, outages, routing, vuln | threat | 0 Ruhig (0,000) | keine | **nein** |
| MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p (`moveit-2023-05`) | Ereignis | 6 | finance, outages, routing, vuln | threat, services | 0 Ruhig (0,006) | keine | **nein** |
| NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.) (`notpetya-2017-06`) | Ereignis | 3 | markets, outages, routing | threat, services, physical | 0 Ruhig (0,000) | keine | **nein** |
| Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac) (`rogers-2022-07`) | Ereignis | 15 | finance, markets, outages, routing, vuln | services | 1 Einzelne Auffälligkeit (0,281) | `routing.bgp_updates_as812` -26 h (Rauschen: schlug auch in den 4 Wochen davor aus); `outages.ioda_as812_ping` +1 h, z 19,7; `outages.ioda_as812_bgp` +1 h, z 8,3; `attention.wiki_en_rogers` +16 h, z 124,1 (nicht erwarteter Bereich); `outages.ioda_ca_ping` +1 h, z 4,1 | **ja** |

<details><summary>Signale mit Daten je Zeitraum (3 Tage vor Beginn bis 1 Tag nach Ende)</summary>

- `change-healthcare-2024-02`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `services.sec_8k_item105_daily_count` (B), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A)
- `colonial-pipeline-2021-05`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `control-2019-08`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `control-2023-08`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `control-iberia-2025-03`: `outages.ioda_es_bgp` (A), `outages.ioda_es_ping` (A), `grid.load_es` (A), `outages.ooni_anomaly_share_es` (A), `outages.ioda_pt_bgp` (A), `outages.ioda_pt_ping` (A), `grid.load_pt` (A), `outages.ooni_anomaly_share_pt` (A), `attention.wiki_de_stromausfall` (D), `attention.wiki_en_power_outage` (D), `attention.wiki_es_apagon` (D)
- `control-israel-iran-2025-05`: `conflict.israel_oref` (B), `connectivity.ioda_ir` (A), `connectivity.ioda_il` (A), `markets.gold_price` (A), `markets.vix` (A), `connectivity.ooni_anomaly_share_ir` (A), `connectivity.ooni_anomaly_share_il` (A), `markets.brent_futures` (A), `markets.wti_futures` (A), `markets.oil_volatility_ovx` (A), `connectivity.ioda_ir_ping` (A), `markets.brent_spot_github` (A), `attention.wiki_en_iran` (D), `attention.wiki_de_iran` (D), `attention.wiki_en_world_ww3` (D)
- `crowdstrike-2024-07`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `services.sec_8k_item105_daily_count` (B), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A)
- `dyn-ddos-2016-10`: `routing.country_prefix_visibility_de` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.vix` (A)
- `facebook-bgp-2021-10`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A), `routing.visible_prefixes_as32934` (A), `routing.bgp_updates_as32934` (A), `attention.wiki_en_facebook` (D)
- `iberia-blackout-2025-04`: `outages.ioda_es_bgp` (A), `outages.ioda_es_ping` (A), `grid.load_es` (A), `outages.ooni_anomaly_share_es` (A), `outages.ioda_pt_bgp` (A), `outages.ioda_pt_ping` (A), `grid.load_pt` (A), `outages.ooni_anomaly_share_pt` (A), `attention.wiki_de_stromausfall` (D), `attention.wiki_en_power_outage` (D), `attention.wiki_es_apagon` (D)
- `israel-iran-2025-06`: `conflict.israel_oref` (B), `connectivity.ioda_ir` (A), `connectivity.ioda_il` (A), `markets.gold_price` (A), `markets.vix` (A), `connectivity.ooni_anomaly_share_ir` (A), `connectivity.ooni_anomaly_share_il` (A), `markets.brent_futures` (A), `markets.wti_futures` (A), `markets.oil_volatility_ovx` (A), `connectivity.ioda_ir_ping` (A), `markets.brent_spot_github` (A), `attention.wiki_en_iran` (D), `attention.wiki_de_iran` (D), `attention.wiki_en_world_ww3` (D)
- `log4shell-2021-12`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `moveit-2023-05`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A)
- `notpetya-2017-06`: `routing.country_prefix_visibility_de` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `rogers-2022-07`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.vix` (A), `outages.ioda_ca_bgp` (A), `outages.ioda_ca_ping` (A), `outages.ioda_as812_bgp` (A), `outages.ioda_as812_ping` (A), `routing.bgp_updates_as812` (A), `attention.wiki_en_rogers` (D)

</details>

**Kurz:** Von 11 historischen Ereignissen hätte das Radar mit diesen Daten 3 gesehen (Stufenanstieg), 2 nur über eine einzelne Messung angedeutet (crowdstrike-2024-07, facebook-bgp-2021-10) und 6 gar nicht gesehen. Kontroll-Zeiträume: control-2019-08: höchste Stufe 0 (ruhig geblieben); control-2023-08: höchste Stufe 0 (ruhig geblieben); control-iberia-2025-03: höchste Stufe 0 (ruhig geblieben); control-israel-iran-2025-05: höchste Stufe 0 (ruhig geblieben).

Einordnung (Stand 24.11.2026): Mit den gezielten Messungen sieht das Radar die Ereignisse, deren Folgen physisch messbar sind. **Iberischer Stromausfall:** IODA-Ping Spanien und Portugal (z 14 bis 16) ab dem ersten Zeitschritt nach Beginn (+1 h), Stufe 1; die Netzlast Portugals wich nur schwach ab (z 4,7, Bereich Netz nicht über der Schwelle), die Netzlast Spaniens fehlt in den Ausfallstunden (keine vollständigen Stunden), Wikipedia-Aufrufe sprangen erst mit dem Tageswert (+14 h). Kein Vorlauf. **Israel–Iran:** Luftalarme Israel ab dem Tageswert des 13.06. (+27 h), Stufe 1 ab +50 h, Stufe 2 ab 18.06. 14 Uhr UTC (+5,6 Tage) durch den Einbruch der anpingbaren Netze im Iran (z 19); Ölpreis-Volatilität (OVX) auffällig, aber nicht ausschlaggebend. Kein Vorlauf. **Rogers:** IODA AS812 (Routing und Ping) ab +1 h; die BGP-Meldungen (RIPEstat, Anzahl Announcements) schlugen schon 23 h vorher aus, aber auch 18 Tage vorher mehrfach (18 Zeitschritte Stufe 1 vor Beginn): Rauschen, kein Vorlauf. **Facebook:** Stufe 1 zum Beginn (Zeitschritt 15:00 UTC) durch die BGP-Meldungen für AS32934, die einzige auffällige Messung im betroffenen Bereich; dieselbe Reihe schlug auch am 26./27.09. ohne Ereignis aus (5 Zeitschritte). Sichtbare Präfixe gibt RIPEstat nur in 8-Stunden-Schritten (Rückgang 391 auf 369 ab 16 Uhr UTC, nach Verschiebung um ein Intervall gegen Vorausschau), unter der Schwelle. IODA hat für AS32934 im Jahr 2021 keine Daten (leere Antwort). **Kontrollen:** Spanien/Portugal vier Wochen vorher und Nahost vier Wochen vorher blieben mit denselben Messungen auf Stufe 0 („ruhig geblieben“). Facebook zählt wegen der einzigen, auch vorher auffälligen Messung nur als „teilweise“ (schwach).

Nicht prüfbar bzw. nicht gesehen: CrowdStrike, Change Healthcare, Log4Shell, MOVEit, Colonial, Dyn, NotPetya sind Firmen- oder Software-Vorfälle; für sie gibt es keine offene Messung mit Historie, die das Ereignis physisch zeigt (FAA-Flugausfälle nur live). Sie bleiben mit „nein“ bzw. „nein“ in der Liste (Ausschläge des VIX bei CrowdStrike lagen vor dem Beginn und schlugen auch in den 4 Wochen davor aus: Rauschen, keine Vorwarnung). RIPEstat liefert für eine ASN keine Rücknahmen (withdrawals = null), nur Announcements. Der Luftalarm-Datensatz (65 MB) wurde direkt von raw.githubusercontent.com geladen und als Ausschnitt gespeichert (März bis Juli 2025, Kategorien 1 und 2). Weiter fehlend: `moveit-2023-05/yahoo/VIX-6mo-1d.json` (HTTP 500); SOFR erst ab April 2018, KEV ab November 2021, SEC Item 1.05 ab Dezember 2023.

## Fazit

- Datenlage: 47 von 306 katalogisierten Signalen (86 mit Collector) und 9 von 9 Bereichen hatten im Zeitraum überhaupt Daten. Zeitschritte mit mindestens 3 Bereichen: 3229 von 3643.
- Ereignisse: 14 gelistet, 10 prüfbar, 4 nicht prüfbar (iberia-blackout-2025-04, ms365-outage-2026-11, faa-ground-stop-2026-11-13, us-banks-2026-11-16). Von den prüfbaren: 1 erkannt (ab Stufe 2), 2 nur Stufe 1, 7 verpasst.
- CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: finance: `cyber.finance.sofr_tail`, `cyber.finance.sofr_volume`; services: `cyber.services.sec_8k_item105_daily_count`; markets: `cyber.markets.cyber_etf_volume`, `cyber.markets.cyber_etf_abs_return`, `cyber.markets.vix`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche physical; dort konnte das System nichts sehen.
- Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar): höchste Stufe 1, erwartete Bereiche mit Ausschlag: routing; abweichende Bereiche im Fenster: routing. Frische Signale in den erwarteten Bereichen: routing: `cyber.routing.country_prefix_visibility_de`, `cyber.routing.visible_prefixes_as32934`, `cyber.routing.bgp_updates_as32934`; outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche dns_core, services; dort konnte das System nichts sehen.
- Krieg zwischen Israel und Iran (zwölf Tage): höchste Stufe 2, erwartete Bereiche mit Ausschlag: conflict, connectivity; abweichende Bereiche im Fenster: conflict, connectivity. Frische Signale in den erwarteten Bereichen: conflict: `war.conflict.israel_oref`; connectivity: `war.connectivity.ioda_ir`, `war.connectivity.ioda_il`, `war.connectivity.ooni_anomaly_share_ir`, `war.connectivity.ooni_anomaly_share_il`, `war.connectivity.ioda_ir_ping`; markets: `war.markets.gold_price`, `war.markets.vix`, `war.markets.brent_futures`, `war.markets.wti_futures`, `war.markets.oil_volatility_ovx`, `war.markets.brent_spot_github`.
- Ransomware-Angriff auf Change Healthcare (UnitedHealth): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: services: `cyber.services.sec_8k_item105_daily_count`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat; dort konnte das System nichts sehen.
- Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: vuln: `cyber.vuln.kev_additions_rate`, `cyber.vuln.kev_ransomware_flag`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat; dort konnte das System nichts sehen.
- MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: vuln: `cyber.vuln.kev_additions_rate`, `cyber.vuln.kev_ransomware_flag`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat, services; dort konnte das System nichts sehen.
- Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche physical, services, threat; dort konnte das System nichts sehen.
- Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac): höchste Stufe 1, erwartete Bereiche mit Ausschlag: routing, outages; abweichende Bereiche im Fenster: outages, routing. Frische Signale in den erwarteten Bereichen: routing: `cyber.routing.country_prefix_visibility_de`, `cyber.routing.bgp_updates_as812`; finance: `cyber.finance.sofr_tail`, `cyber.finance.sofr_volume`; outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`, `cyber.outages.ioda_ca_bgp`, `cyber.outages.ioda_ca_ping`, `cyber.outages.ioda_as812_bgp`, `cyber.outages.ioda_as812_ping`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche services; dort konnte das System nichts sehen.
- DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche dns_core, services, threat; dort konnte das System nichts sehen.
- NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: markets: `cyber.markets.vix`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat, services, physical; dort konnte das System nichts sehen.
- Außerhalb von Ereignissen stand das System in 1,0 % der Zeitschritte auf Stufe 1 oder höher und in 0,0 % auf Stufe 2 oder höher. Die Grundrate ist niedrig genug, um Ausschläge während Ereignissen als Abweichung vom Normalzustand lesen zu können.
- Lauteste Signale: `cyber.routing.bgp_updates_as812` (19,4 Ausschläge je 30 Tage), `cyber.routing.bgp_updates_as32934` (7,5 Ausschläge je 30 Tage), `cyber.markets.cyber_etf_abs_return` (1,6 Ausschläge je 30 Tage). Diese zuerst prüfen (Baseline, Schwellen, Saisonalität, Einheit).
- 1 Ereignis(se) erreichten Stufe 2. Bei 10 prüfbaren Ereignissen und der genannten Grundrate ist das statistisch kein Beleg; dafür braucht es die historischen Abrufe.

## Historische Abrufe (offen)

`backtest/history-queue.json` listet 112 Abrufe, die die alten Zeiträume prüfbar machen sollen. Bereits vorhanden sind nur die Einträge, deren Datei unter `fixtures/` liegt. CISA KEV (ab 11/2021) und CISA ICS (ab 2017) brauchen keine Abrufe, ihre aktuelle Datei enthält die datierte Historie.

| Zeitraum | Abrufe | vorhanden | Bereiche, die damit Daten bekämen |
|---|---:|---:|---|
| crowdstrike-2024-07 | 8 | 8 | finance, markets, routing, outages, services, vuln (KEV) |
| facebook-bgp-2021-10 | 18 | 18 | finance, markets, routing, outages, ?, vuln (ICS) |
| change-healthcare-2024-02 | 8 | 8 | finance, markets, routing, outages, services, vuln (KEV) |
| log4shell-2021-12 | 4 | 4 | finance, markets, routing, outages, vuln (KEV) |
| moveit-2023-05 | 4 | 3 | finance, markets, routing, outages, vuln (KEV) |
| colonial-pipeline-2021-05 | 4 | 4 | finance, markets, routing, outages, vuln (ICS) |
| rogers-2022-07 | 17 | 17 | finance, markets, routing, outages, ?, vuln (KEV) |
| dyn-ddos-2016-10 | 5 | 5 | markets, routing, outages |
| notpetya-2017-06 | 3 | 3 | markets, routing, outages, vuln (ICS) |
| control-2019-08 | 4 | 4 | finance, markets, routing, outages, vuln (ICS) |
| control-2023-08 | 4 | 4 | finance, markets, routing, outages, vuln (KEV) |
| iberia-blackout-2025-04 | 17 | 17 | ?, vuln (KEV) |
| israel-iran-2025-06 | 16 | 16 | ?, vuln (KEV) |

## Grenzen dieser Auswertung

- Die Ereignisliste ist klein und handverlesen. Die Fehlalarm-Rate außerhalb von Ereignissen ist eine Obergrenze: nicht gelistete echte Vorfälle zählen dort als Fehlalarm.
- Vorlaufzeiten sind auf die Schrittweite gerundet. Tägliche Quellen (die meisten mit Historie) stempeln ihren Tageswert auf 00:00 UTC. Standardmäßig wird ein solcher Wert erst am Tagesende sichtbar gemacht (sonst sähe das System um 03:00 schon den ganzen Tag). Echte Veröffentlichungsverzüge (SOFR am Folgetag, Tor Metrics mehrere Tage) sind nicht nachgebildet; Vorlaufzeiten täglicher Quellen sind deshalb eher zu früh.
- Signale, die nur einen aktuellen Zustand liefern (Statusseiten, Blocklisten, FAA, RIPE Atlas, Mempool), haben im Replay genau einen Wert und damit nie eine Baseline. Sie sind im Zeitraum faktisch blind.
- Die historischen Ereignisse (2016 bis 2024) brauchen eigene Abrufe (`backtest/history-queue.json`), danach `node src/backtest/run.ts --history <id>` je Ereignis und `node src/backtest/evaluate.ts backtest/results/*.json`.
- CISA KEV begann am 03.11.2021 mit mehreren hundert Einträgen in den ersten Tagen. Für Ereignisse kurz danach (Log4Shell) ist die KEV-Baseline deshalb verzerrt.
- Die Historien-Läufe nutzen nur Quellen mit abrufbarer Vergangenheit. Statusseiten, Blocklisten, CT-Logs, FAA, RIPE Atlas und IODA (Antworten zu groß) fehlen dort ganz; ein „verpasst“ in einem Historien-Lauf sagt nur etwas über diese Teilmenge.
- Klasse D (Aufmerksamkeit) fließt nicht in die Stufe, ihre Ausschläge sind in der Tabelle „Laute Signale“ trotzdem gezählt.
