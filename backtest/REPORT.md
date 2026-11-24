# Backtest-Bericht Cyber

Erzeugt 2026-11-24 01:23 UTC mit `src/backtest/evaluate.ts`. Diese Datei wird bei jedem Lauf überschrieben.

Ergebnis-Dateien:

- `backtest/results/history-change-healthcare-2024-02.json`: history:change-healthcare-2024-02 (anchor 2024-03-11T00:00:00.000Z), 2024-01-31 02:59 bis 2024-03-08 23:59 UTC, alle 3 h, 304 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-colonial-pipeline-2021-05.json`: history:colonial-pipeline-2021-05 (anchor 2021-05-19T00:00:00.000Z), 2021-04-16 02:59 bis 2021-05-16 23:59 UTC, alle 3 h, 248 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-2019-08.json`: history:control-2019-08 (anchor 2019-08-22T00:00:00.000Z), 2019-07-15 02:59 bis 2019-08-19 23:59 UTC, alle 3 h, 288 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-control-2023-08.json`: history:control-2023-08 (anchor 2023-08-31T00:00:00.000Z), 2023-07-24 02:59 bis 2023-08-28 23:59 UTC, alle 3 h, 288 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-crowdstrike-2024-07.json`: history:crowdstrike-2024-07 (anchor 2024-07-25T00:00:00.000Z), 2024-06-28 04:00 bis 2024-07-24 04:00 UTC, alle 3 h, 209 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-dyn-ddos-2016-10.json`: history:dyn-ddos-2016-10 (anchor 2016-10-25T00:00:00.000Z), 2016-09-30 12:00 bis 2016-10-25 00:00 UTC, alle 3 h, 197 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-facebook-bgp-2021-10.json`: history:facebook-bgp-2021-10 (anchor 2021-10-08T00:00:00.000Z), 2021-09-13 18:00 bis 2021-10-08 00:00 UTC, alle 3 h, 195 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-log4shell-2021-12.json`: history:log4shell-2021-12 (anchor 2021-12-24T00:00:00.000Z), 2021-11-19 02:59 bis 2021-12-21 23:59 UTC, alle 3 h, 264 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-moveit-2023-05.json`: history:moveit-2023-05 (anchor 2023-06-20T00:00:00.000Z), 2023-05-10 02:59 bis 2023-06-17 23:59 UTC, alle 3 h, 312 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-notpetya-2017-06.json`: history:notpetya-2017-06 (anchor 2017-07-08T00:00:00.000Z), 2017-06-06 11:59 bis 2017-07-05 23:59 UTC, alle 3 h, 237 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar
- `backtest/results/history-rogers-2022-07.json`: history:rogers-2022-07 (anchor 2022-07-13T00:00:00.000Z), 2022-06-17 09:00 bis 2022-07-13 00:00 UTC, alle 3 h, 206 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar

Regeln: Zu jedem Zeitschritt wird der Wert so berechnet, wie ihn das System damals gezeigt hätte (nur Daten bis zu diesem Zeitpunkt, Engine unverändert). Ein Ereignis zählt im Fenster von 72 h vor Beginn bis 24 h nach Ende. Ein Fenster ist nur prüfbar, wenn im Median mindestens 3 Bereiche frische Daten mit Baseline hatten; sonst „nicht prüfbar“ (kein Fehlschlag). Vorlaufzeit: erster Zeitschritt ab Stufe 1 bzw. 2 relativ zum Ereignisbeginn, negative Werte = vorher. Die Auflösung ist die Schrittweite.

## Datengrundlage

**12 von 306 Signalen** des Szenarios (davon 86 mit Collector, Rest nur katalogisiert) hatten im Zeitraum mindestens einmal frische Daten. **6 von 9 Bereichen** hatten mindestens einmal frische Daten mit Baseline (nur Klassen A und B zählen). 2748 von 2748 Zeitschritten hatten mindestens 3 Bereiche mit Daten.

| Bereich | Signale im Katalog | davon mit Daten | davon Klasse D (nicht gewertet) | Zeitschritte mit Daten + Baseline |
|---|---:|---:|---:|---:|
| Internet-Routen (`routing`) | 17 | 1 | 0 | 2748 (100,0 %) |
| Gemessene Ausfälle (`outages`) | 34 | 3 | 0 | 2748 (100,0 %) |
| Kern-Dienste (`dns_core`) | 19 | 0 | 0 | 0 (0,0 %) |
| Angriffs-Telemetrie (`threat`) | 43 | 0 | 0 | 0 (0,0 %) |
| Schwachstellen (`vuln`) | 27 | 2 | 0 | 1583 (57,6 %) |
| Zahlungsverkehr (`finance`) | 25 | 2 | 0 | 2314 (84,2 %) |
| Dienste und Firmenmeldungen (`services`) | 23 | 1 | 0 | 513 (18,7 %) |
| Märkte und Insider (`markets`) | 30 | 3 | 0 | 2436 (88,6 %) |
| Strom, Verkehr, Funk (`physical`) | 45 | 0 | 0 | 0 (0,0 %) |
| `attention` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 35 | 0 | 0 | – |
| `context` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 8 | 0 | 0 | – |

<details><summary>Signale mit Daten im Zeitraum</summary>

| Signal | Bereich | Klasse | Werte im Zeitraum | Zeitschritte frisch |
|---|---|---|---:|---:|
| `cyber.finance.sofr_tail` | finance | A | 193 | 2314 von 2748 |
| `cyber.finance.sofr_volume` | finance | A | 193 | 2314 von 2748 |
| `cyber.markets.cyber_etf_abs_return` | markets | A | 61 | 708 von 2748 |
| `cyber.markets.cyber_etf_volume` | markets | A | 61 | 708 von 2748 |
| `cyber.markets.vix` | markets | A | 203 | 2436 von 2748 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 60 | 575 von 2748 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 335 | 2748 von 2748 |
| `cyber.outages.tor_advertised_bandwidth` | outages | A | 67 | 598 von 2748 |
| `cyber.routing.country_prefix_visibility_de` | routing | A | 310 | 2748 von 2748 |
| `cyber.services.sec_8k_item105_daily_count` | services | B | 63 | 513 von 2748 |
| `cyber.vuln.kev_additions_rate` | vuln | B | 193 | 1583 von 2748 |
| `cyber.vuln.kev_ransomware_flag` | vuln | B | 193 | 1583 von 2748 |

</details>

## Stufen-Verteilung

| Stufe | Zeitschritte | Anteil | zum Vergleich: wenn Schritte ohne abweichenden Bereich als Ruhig gälten |
|---|---:|---:|---:|
| 0 Ruhig | 2748 | 100,0 % | 2748 (100,0 %) |
| 1 Leicht erhöht | 0 | 0,0 % | 0 (0,0 %) |
| 2 Erhöht | 0 | 0,0 % | 0 (0,0 %) |
| 3 Hoch | 0 | 0,0 % | 0 (0,0 %) |
| 4 Akut | 0 | 0,0 % | 0 (0,0 %) |

## Ereignisse

| Ereignis | Beginn (UTC) | prüfbar | Schritte im Fenster | Bereiche mit Daten (Median / Max) | höchste Stufe (Wert) | Vorlauf Stufe 1 | Vorlauf Stufe 2 | abweichende Bereiche | erwartete Bereiche mit Daten | erwartete Bereiche getroffen | Ergebnis |
|---|---|---|---:|---:|---|---:|---:|---|---|---:|---|
| CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm | 2024-07-19 04:00 | ja | 55 | 6,0 / 6 | 0 (0,01) | nie | nie | – | services, finance, markets | 0/4 | **verpasst** |
| Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar) | 2021-10-04 15:30 | ja | 34 | 4,0 / 4 | 0 (0,02) | nie | nie | – | routing, outages | 0/4 | **verpasst** |
| Ransomware-Angriff auf Change Healthcare (UnitedHealth) | 2024-02-21 00:00 | ja | 160 | 6,0 / 6 | 0 (0,01) | nie | nie | – | services | 0/2 | **verpasst** |
| Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt | 2021-12-10 00:00 | ja | 120 | 5,0 / 5 | 0 (0,00) | nie | nie | – | vuln | 0/2 | **verpasst** |
| MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p | 2023-05-31 00:00 | ja | 168 | 4,0 / 4 | 0 (0,01) | nie | nie | – | vuln | 0/3 | **verpasst** |
| Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline | 2021-05-07 00:00 | ja | 104 | 4,0 / 4 | 0 (0,01) | nie | nie | – | keiner | 0/3 | **verpasst** |
| Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac) | 2022-07-08 08:00 | ja | 45 | 5,0 / 5 | 0 (0,00) | nie | nie | – | routing, outages, finance | 0/4 | **verpasst** |
| DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn | 2016-10-21 11:00 | ja | 36 | 3,0 / 3 | 0 (0,01) | nie | nie | – | outages | 0/4 | **verpasst** |
| NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.) | 2017-06-27 09:00 | ja | 93 | 3,0 / 3 | 0 (0,00) | nie | nie | – | markets | 0/4 | **verpasst** |
| Microsoft-365-Ausfall (Outlook, Teams) laut Sekundärquelle ¹ | 2026-11-12 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/1 | **nicht prüfbar** |
| Landesweiter FAA-Ground-Stop in den USA laut Sekundärquelle ¹ | 2026-11-13 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/1 | **nicht prüfbar** |
| Störungen beim Online-Banking großer US-Banken laut Sekundärquelle ¹ | 2026-11-16 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/2 | **nicht prüfbar** |

¹ laut Sekundärquelle, nicht selbst verifiziert (siehe `backtest/events.json`).

Stärkste Signale je prüfbarem Ereignis (höchster Beitrag im Fenster):

- CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm: `cyber.markets.vix` 0,18, `cyber.outages.ooni_anomaly_share_us` 0,00
- Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar): `cyber.outages.ooni_anomaly_share_de` 0,18, `cyber.markets.cyber_etf_abs_return` 0,03
- Ransomware-Angriff auf Change Healthcare (UnitedHealth): `cyber.markets.cyber_etf_abs_return` 0,14, `cyber.markets.cyber_etf_volume` 0,03
- MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p: `cyber.finance.sofr_tail` 0,06
- Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline: `cyber.markets.vix` 0,16
- DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn: `cyber.outages.ooni_anomaly_share_de` 0,05

## Kontroll-Zeiträume

| Zeitraum | von | bis | prüfbar | Schritte | Bereiche mit Daten (Median / Max) | Anteil ab Stufe 1 | Anteil ab Stufe 2 | höchste Stufe | Ergebnis |
|---|---|---|---|---:|---:|---:|---:|---|---|
| Vergleichszeitraum ohne kuratiertes Großereignis (Okt./Nov. 2026) | 2026-10-19 00:00 | 2026-11-04 23:59 | nein | 0 | 0,0 / 0 | n. v. | n. v. | – | **nicht prüfbar** |
| Historischer Vergleichszeitraum August 2019 | 2019-08-05 00:00 | 2019-08-18 23:59 | ja | 112 | 4,0 / 4 | 0,0 % | 0,0 % | 0 | **ruhig** |
| Historischer Vergleichszeitraum August 2023 | 2023-08-14 00:00 | 2023-08-27 23:59 | ja | 112 | 5,0 / 5 | 0,0 % | 0,0 % | 0 | **ruhig** |

## Außerhalb von Ereignisfenstern

Alle Zeitschritte, die in keinem (erweiterten) Ereignisfenster liegen. Jeder Schritt ab Stufe 1 ist hier ein Fehlalarm, sofern es nicht ein Ereignis gab, das in der Liste fehlt.

| Menge | Zeitschritte | Anteil ab Stufe 1 | Anteil ab Stufe 2 |
|---|---:|---:|---:|
| alle | 1933 | 0,0 % | 0,0 % |
| nur Schritte mit mindestens 3 Bereichen mit Daten | 1933 | 0,0 % | 0,0 % |

Zusammenhängende Phasen ab Stufe 1 außerhalb von Ereignissen: 0.

## Laute Signale

Einzel-Ausschläge je Signal außerhalb von Ereignisfenstern: Zahl der Phasen, in denen das Signal einen Beitrag > 0 lieferte, hochgerechnet auf 30 Tage mit Daten. Signale mit weniger als 3 Tagen Daten erhalten keine Rate.

| Signal | Bereich | Klasse | Tage mit Daten | Ausschläge | je 30 Tage | Zeitschritte mit Beitrag |
|---|---|---|---:|---:|---:|---:|
| `cyber.markets.cyber_etf_abs_return` | markets | A | 57,4 | 3 | 1,6 | 77 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 241,6 | 8 | 1,0 | 193 |
| `cyber.markets.vix` | markets | A | 223,6 | 6 | 0,8 | 224 |
| `cyber.finance.sofr_tail` | finance | A | 203,5 | 4 | 0,6 | 124 |
| `cyber.markets.cyber_etf_volume` | markets | A | 57,4 | 1 | 0,5 | 32 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 57,5 | 1 | 0,5 | 4 |
| `cyber.vuln.kev_ransomware_flag` | vuln | B | 129,4 | 1 | 0,2 | 32 |
| `cyber.finance.sofr_volume` | finance | A | 203,5 | 1 | 0,1 | 48 |

4 Signale mit Daten schlugen außerhalb von Ereignissen nie aus.

## Was das Radar je Ereignis gezeigt hätte (Historien-Läufe)

Grundlage: echte historische Antworten der Quellen unter `fixtures/backtest/<ereignis>/`, je Ereignis zum Zeitpunkt „Ende + 4 Tage“ eingelesen; zu jedem Zeitschritt nur Daten bis zu diesem Zeitpunkt, Tageswerte erst ab Tagesende sichtbar, Engine unverändert. Verfügbar waren nur: NY Fed (SOFR), Yahoo (VIX, Cyber-ETFs CIBR/HACK/BUG), RIPEstat (sichtbare Netzblöcke Deutschland), OONI (Web-Messungen USA, teils Deutschland), Tor Metrics (Bandbreite), SEC EDGAR (8-K Item 1.05, ab 2024), CISA KEV (ab 11/2021) und CISA ICS. **Nicht** abgerufen und damit in keinem Historien-Lauf enthalten: Wikipedia-Seitenaufrufe und alle anderen Aufmerksamkeits-Quellen (Klasse D), IODA, EPSS, Cloudflare Radar, Statusseiten, Blocklisten, CT-Logs, FAA. Der Aufmerksamkeits-Wert ist deshalb in allen Historien-Läufen 0, ein „Gerede ohne Daten“ konnte gar nicht entstehen.

„Auffällig“ heißt hier: Anomalie der Engine ≥ 0,25 (z deutlich über der Schwelle). Zeiten relativ zum Ereignisbeginn, gesucht von 3 Tagen davor bis 1 Tag nach dem Ende. „Gesehen?“ ist dieselbe Regel wie in den Wiedergaben (`src/backtest/replays.ts`): „ja“ nur bei Stufenanstieg durch abweichende Bereiche, „teilweise“ bei einzelnen auffälligen Messungen in einem erwarteten Bereich, sonst „nein“.

| Zeitraum | Art | Signale mit Daten | Bereiche mit Daten | erwartete Bereiche ohne Daten | höchste Stufe (Wert) | auffällige Messungen (Beginn, max. z) | Gesehen? |
|---|---|---:|---|---|---|---|---|
| Ransomware-Angriff auf Change Healthcare (UnitedHealth) (`change-healthcare-2024-02`) | Ereignis | 10 | finance, markets, outages, routing, services, vuln | threat | 0 Ruhig (0,009) | `markets.cyber_etf_abs_return` +27 h, z 5,3 (nicht erwarteter Bereich) | **nein** |
| Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline (`colonial-pipeline-2021-05`) | Ereignis | 5 | finance, markets, outages, routing | physical, services, threat | 0 Ruhig (0,010) | `markets.vix` +147 h, z 4,8 (nicht erwarteter Bereich) | **nein** |
| Historischer Vergleichszeitraum August 2019 (`control-2019-08`) | Kontrolle | 5 | finance, markets, outages, routing | – | 0 Ruhig (0,015) | `markets.vix` +27 h, z 5,6 | **teilweise** |
| Historischer Vergleichszeitraum August 2023 (`control-2023-08`) | Kontrolle | 7 | finance, markets, outages, routing, vuln | – | 0 Ruhig (0,002) | keine | **nein** |
| CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm (`crowdstrike-2024-07`) | Ereignis | 10 | finance, markets, outages, routing, services, vuln | physical | 0 Ruhig (0,012) | `markets.vix` -3 h, z 5,0 | **teilweise** |
| DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn (`dyn-ddos-2016-10`) | Ereignis | 5 | markets, outages, routing | dns_core, services, threat | 0 Ruhig (0,006) | `outages.ooni_anomaly_share_de` -71 h, z 4,0 | **nein** |
| Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar) (`facebook-bgp-2021-10`) | Ereignis | 9 | finance, markets, outages, routing | dns_core, services | 0 Ruhig (0,019) | `outages.ooni_anomaly_share_de` -63 h, z 6,0 | **nein** |
| Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt (`log4shell-2021-12`) | Ereignis | 7 | finance, markets, outages, routing, vuln | threat | 0 Ruhig (0,000) | keine | **nein** |
| MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p (`moveit-2023-05`) | Ereignis | 6 | finance, outages, routing, vuln | threat, services | 0 Ruhig (0,006) | keine | **nein** |
| NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.) (`notpetya-2017-06`) | Ereignis | 3 | markets, outages, routing | threat, services, physical | 0 Ruhig (0,000) | keine | **nein** |
| Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac) (`rogers-2022-07`) | Ereignis | 9 | finance, markets, outages, routing, vuln | services | 0 Ruhig (0,000) | keine | **nein** |

<details><summary>Signale mit Daten je Zeitraum (3 Tage vor Beginn bis 1 Tag nach Ende)</summary>

- `change-healthcare-2024-02`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `services.sec_8k_item105_daily_count` (B), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A)
- `colonial-pipeline-2021-05`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `control-2019-08`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `control-2023-08`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `crowdstrike-2024-07`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `services.sec_8k_item105_daily_count` (B), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A)
- `dyn-ddos-2016-10`: `routing.country_prefix_visibility_de` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.vix` (A)
- `facebook-bgp-2021-10`: `routing.country_prefix_visibility_de` (A), `finance.sofr_tail` (A), `markets.cyber_etf_volume` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.cyber_etf_abs_return` (A), `markets.vix` (A)
- `log4shell-2021-12`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `moveit-2023-05`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_us` (A)
- `notpetya-2017-06`: `routing.country_prefix_visibility_de` (A), `outages.ooni_anomaly_share_us` (A), `markets.vix` (A)
- `rogers-2022-07`: `routing.country_prefix_visibility_de` (A), `vuln.kev_additions_rate` (B), `vuln.kev_ransomware_flag` (B), `finance.sofr_tail` (A), `finance.sofr_volume` (A), `outages.ooni_anomaly_share_de` (A), `outages.ooni_anomaly_share_us` (A), `outages.tor_advertised_bandwidth` (A), `markets.vix` (A)

</details>

**Kurz:** Von 9 historischen Ereignissen hätte das Radar mit diesen Daten 0 gesehen (Stufenanstieg), 1 nur über eine einzelne Messung angedeutet (crowdstrike-2024-07) und 8 gar nicht gesehen. Kontroll-Zeiträume: control-2019-08: höchste Stufe 0, eine einzelne Messung auffällig; control-2023-08: höchste Stufe 0.

Einordnung: Die verfügbaren Reihen messen fast alle etwas Allgemeines (Routing Deutschlands, Web-Messungen in den USA, US-Börse, US-Geldmarkt), nicht die betroffenen Systeme (Windows-Clients, Facebook-DNS, Rogers in Kanada, Dyn). Kein Bereich erreichte in irgendeinem Zeitschritt die Schwelle „weicht ab“, deshalb blieb die Stufe überall bei 0. Dass die Kontroll-Zeiträume ruhig blieben, ist unter diesen Umständen kein Qualitätsbeleg: Das Radar blieb bei den echten Ereignissen genauso ruhig. Die einzelnen Ausschläge (VIX, Cyber-ETFs, OONI Deutschland) liegen entweder vor dem Ereignis oder in Bereichen, die das Ereignis nicht direkt messen, und kommen in den Kontroll-Zeiträumen ebenso vor (VIX August 2019). Mit diesen Daten ist weder Erkennung noch Vorlauf belegt.

Fehlende Abrufe: `moveit-2023-05/yahoo/VIX-6mo-1d.json` schlug beim Nachladen mit HTTP 500 fehl (`fixtures/backtest/FETCH-LOG.json`); für MOVEit fehlt deshalb der Bereich Märkte. Für 2016 und 2017 gibt es keine SOFR-Reihe (erst ab April 2018), KEV erst ab November 2021, SEC Item 1.05 erst ab Dezember 2023.

## Fazit

- Datenlage: 12 von 306 katalogisierten Signalen (86 mit Collector) und 6 von 9 Bereichen hatten im Zeitraum überhaupt Daten. Zeitschritte mit mindestens 3 Bereichen: 2748 von 2748.
- Ereignisse: 12 gelistet, 9 prüfbar, 3 nicht prüfbar (ms365-outage-2026-11, faa-ground-stop-2026-11-13, us-banks-2026-11-16). Von den prüfbaren: 0 erkannt (ab Stufe 2), 0 nur Stufe 1, 9 verpasst.
- CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: finance: `cyber.finance.sofr_tail`, `cyber.finance.sofr_volume`; services: `cyber.services.sec_8k_item105_daily_count`; markets: `cyber.markets.cyber_etf_volume`, `cyber.markets.cyber_etf_abs_return`, `cyber.markets.vix`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche physical; dort konnte das System nichts sehen.
- Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: routing: `cyber.routing.country_prefix_visibility_de`; outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche dns_core, services; dort konnte das System nichts sehen.
- Ransomware-Angriff auf Change Healthcare (UnitedHealth): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: services: `cyber.services.sec_8k_item105_daily_count`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat; dort konnte das System nichts sehen.
- Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: vuln: `cyber.vuln.kev_additions_rate`, `cyber.vuln.kev_ransomware_flag`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat; dort konnte das System nichts sehen.
- MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: vuln: `cyber.vuln.kev_additions_rate`, `cyber.vuln.kev_ransomware_flag`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat, services; dort konnte das System nichts sehen.
- Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche physical, services, threat; dort konnte das System nichts sehen.
- Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: routing: `cyber.routing.country_prefix_visibility_de`; finance: `cyber.finance.sofr_tail`, `cyber.finance.sofr_volume`; outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche services; dort konnte das System nichts sehen.
- DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn: höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: outages: `cyber.outages.ooni_anomaly_share_de`, `cyber.outages.ooni_anomaly_share_us`, `cyber.outages.tor_advertised_bandwidth`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche dns_core, services, threat; dort konnte das System nichts sehen.
- NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.): höchste Stufe 0, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: markets: `cyber.markets.vix`. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche threat, services, physical; dort konnte das System nichts sehen.
- Außerhalb von Ereignissen stand das System in 0,0 % der Zeitschritte auf Stufe 1 oder höher und in 0,0 % auf Stufe 2 oder höher. Die Grundrate ist niedrig genug, um Ausschläge während Ereignissen als Abweichung vom Normalzustand lesen zu können.
- Lauteste Signale: `cyber.markets.cyber_etf_abs_return` (1,6 Ausschläge je 30 Tage), `cyber.outages.ooni_anomaly_share_us` (1,0 Ausschläge je 30 Tage), `cyber.markets.vix` (0,8 Ausschläge je 30 Tage). Diese zuerst prüfen (Baseline, Schwellen, Saisonalität, Einheit).
- **Eine Vorhersage- oder auch nur Erkennungskraft ist mit den heutigen Daten nicht belegt.** Kein prüfbares Ereignis erreichte Stufe 2.

## Historische Abrufe (offen)

`backtest/history-queue.json` listet 59 Abrufe, die die alten Zeiträume prüfbar machen sollen. Bereits vorhanden sind nur die Einträge, deren Datei unter `fixtures/` liegt. CISA KEV (ab 11/2021) und CISA ICS (ab 2017) brauchen keine Abrufe, ihre aktuelle Datei enthält die datierte Historie.

| Zeitraum | Abrufe | vorhanden | Bereiche, die damit Daten bekämen |
|---|---:|---:|---|
| crowdstrike-2024-07 | 8 | 8 | finance, markets, routing, outages, services, vuln (KEV) |
| facebook-bgp-2021-10 | 9 | 9 | finance, markets, routing, outages, vuln (ICS) |
| change-healthcare-2024-02 | 8 | 8 | finance, markets, routing, outages, services, vuln (KEV) |
| log4shell-2021-12 | 4 | 4 | finance, markets, routing, outages, vuln (KEV) |
| moveit-2023-05 | 4 | 3 | finance, markets, routing, outages, vuln (KEV) |
| colonial-pipeline-2021-05 | 4 | 4 | finance, markets, routing, outages, vuln (ICS) |
| rogers-2022-07 | 6 | 6 | finance, markets, routing, outages, vuln (KEV) |
| dyn-ddos-2016-10 | 5 | 5 | markets, routing, outages |
| notpetya-2017-06 | 3 | 3 | markets, routing, outages, vuln (ICS) |
| control-2019-08 | 4 | 4 | finance, markets, routing, outages, vuln (ICS) |
| control-2023-08 | 4 | 4 | finance, markets, routing, outages, vuln (KEV) |

## Grenzen dieser Auswertung

- Die Ereignisliste ist klein und handverlesen. Die Fehlalarm-Rate außerhalb von Ereignissen ist eine Obergrenze: nicht gelistete echte Vorfälle zählen dort als Fehlalarm.
- Vorlaufzeiten sind auf die Schrittweite gerundet. Tägliche Quellen (die meisten mit Historie) stempeln ihren Tageswert auf 00:00 UTC. Standardmäßig wird ein solcher Wert erst am Tagesende sichtbar gemacht (sonst sähe das System um 03:00 schon den ganzen Tag). Echte Veröffentlichungsverzüge (SOFR am Folgetag, Tor Metrics mehrere Tage) sind nicht nachgebildet; Vorlaufzeiten täglicher Quellen sind deshalb eher zu früh.
- Signale, die nur einen aktuellen Zustand liefern (Statusseiten, Blocklisten, FAA, RIPE Atlas, Mempool), haben im Replay genau einen Wert und damit nie eine Baseline. Sie sind im Zeitraum faktisch blind.
- Die historischen Ereignisse (2016 bis 2024) brauchen eigene Abrufe (`backtest/history-queue.json`), danach `node src/backtest/run.ts --history <id>` je Ereignis und `node src/backtest/evaluate.ts backtest/results/*.json`.
- CISA KEV begann am 03.11.2021 mit mehreren hundert Einträgen in den ersten Tagen. Für Ereignisse kurz danach (Log4Shell) ist die KEV-Baseline deshalb verzerrt.
- Die Historien-Läufe nutzen nur Quellen mit abrufbarer Vergangenheit. Statusseiten, Blocklisten, CT-Logs, FAA, RIPE Atlas und IODA (Antworten zu groß) fehlen dort ganz; ein „verpasst“ in einem Historien-Lauf sagt nur etwas über diese Teilmenge.
- Klasse D (Aufmerksamkeit) fließt nicht in die Stufe, ihre Ausschläge sind in der Tabelle „Laute Signale“ trotzdem gezählt.
