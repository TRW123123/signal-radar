# Backtest-Bericht Cyber

Erzeugt 2026-11-17 01:00 UTC mit `src/backtest/evaluate.ts`. Diese Datei wird bei jedem Lauf überschrieben.

Ergebnis-Dateien:

- `backtest/results/replay-30d.json`: replay:fixtures@2026-11-17T00:16:13.000Z, 2026-10-18 00:16 bis 2026-11-17 00:16 UTC, alle 3 h, 241 Zeitschritte, Zeitstempel: Tageswerte erst ab Tagesende sichtbar

Regeln: Zu jedem Zeitschritt wird der Wert so berechnet, wie ihn das System damals gezeigt hätte (nur Daten bis zu diesem Zeitpunkt, Engine unverändert). Ein Ereignis zählt im Fenster von 72 h vor Beginn bis 24 h nach Ende. Ein Fenster ist nur prüfbar, wenn im Median mindestens 3 Bereiche frische Daten mit Baseline hatten; sonst „nicht prüfbar“ (kein Fehlschlag). Vorlaufzeit: erster Zeitschritt ab Stufe 1 bzw. 2 relativ zum Ereignisbeginn, negative Werte = vorher. Die Auflösung ist die Schrittweite.

## Datengrundlage

**44 von 303 Signalen** des Szenarios (davon 80 mit Collector, Rest nur katalogisiert) hatten im Zeitraum mindestens einmal frische Daten. **6 von 9 Bereichen** hatten mindestens einmal frische Daten mit Baseline (nur Klassen A und B zählen). 241 von 241 Zeitschritten hatten mindestens 3 Bereiche mit Daten.

| Bereich | Signale im Katalog | davon mit Daten | davon Klasse D (nicht gewertet) | Zeitschritte mit Daten + Baseline |
|---|---:|---:|---:|---:|
| Internet-Routen (`routing`) | 17 | 1 | 0 | 2 (0,8 %) |
| Gemessene Ausfälle (`outages`) | 34 | 10 | 0 | 241 (100,0 %) |
| Kern-Dienste (`dns_core`) | 16 | 0 | 0 | 0 (0,0 %) |
| Angriffs-Telemetrie (`threat`) | 41 | 11 | 2 | 0 (0,0 %) |
| Schwachstellen (`vuln`) | 27 | 5 | 0 | 241 (100,0 %) |
| Zahlungsverkehr (`finance`) | 25 | 7 | 0 | 241 (100,0 %) |
| Dienste und Firmenmeldungen (`services`) | 21 | 4 | 0 | 241 (100,0 %) |
| Märkte und Insider (`markets`) | 30 | 0 | 0 | 0 (0,0 %) |
| Strom, Verkehr, Funk (`physical`) | 45 | 4 | 0 | 7 (2,9 %) |
| `attention` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 35 | 2 | 2 | – |
| `context` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | 12 | 0 | 0 | – |

<details><summary>Signale mit Daten im Zeitraum</summary>

| Signal | Bereich | Klasse | Werte im Zeitraum | Zeitschritte frisch |
|---|---|---|---:|---:|
| `cyber.attention.bluesky_mastodon_keywords` | attention | D | 6 | 41 von 241 |
| `cyber.attention.hackernews_volume` | attention | D | 29 | 241 von 241 |
| `cyber.finance.bitcoin_network_nodes` | finance | A | 100 | 34 von 241 |
| `cyber.finance.mempool_fee_spike` | finance | A | 1 | 1 von 241 |
| `cyber.finance.mempool_size` | finance | A | 1 | 1 von 241 |
| `cyber.finance.sofr_tail` | finance | A | 19 | 240 von 241 |
| `cyber.finance.sofr_volume` | finance | A | 19 | 240 von 241 |
| `cyber.finance.stablecoin_peg_deviation` | finance | A | 26 | 27 von 241 |
| `cyber.finance.statuspage_payment_disruption` | finance | B | 1 | 1 von 241 |
| `cyber.outages.atlas_probe_connectivity` | outages | A | 1 | 1 von 241 |
| `cyber.outages.atlas_probes_connected_global` | outages | A | 1 | 1 von 241 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 29 | 241 von 241 |
| `cyber.outages.ooni_anomaly_share_fr` | outages | A | 29 | 241 von 241 |
| `cyber.outages.ooni_anomaly_share_gb` | outages | A | 29 | 241 von 241 |
| `cyber.outages.ooni_anomaly_share_nl` | outages | A | 29 | 241 von 241 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 29 | 241 von 241 |
| `cyber.outages.tor_advertised_bandwidth` | outages | A | 27 | 241 von 241 |
| `cyber.outages.tor_exit_nodes` | outages | A | 1 | 1 von 241 |
| `cyber.outages.users_de` | outages | A | 27 | 241 von 241 |
| `cyber.physical.solar_wind_feedin_sudden_drop` | physical | A | 23 | 8 von 241 |
| `cyber.physical.us_airport_closures` | physical | B | 1 | 1 von 241 |
| `cyber.physical.us_ground_delay_programs` | physical | B | 1 | 1 von 241 |
| `cyber.physical.us_ground_stops` | physical | B | 1 | 1 von 241 |
| `cyber.routing.hijack_events` | routing | A | 6 | 3 von 241 |
| `cyber.services.sec_8k_item105_daily_count` | services | B | 29 | 241 von 241 |
| `cyber.services.statuspage_cloud_disruption` | services | B | 1 | 1 von 241 |
| `cyber.services.statuspage_disruption_share` | services | B | 1 | 1 von 241 |
| `cyber.services.statuspage_incident_rate` | services | B | 1 | 1 von 241 |
| `cyber.threat.firehol_abusers_1d_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_blocklist_de_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_bruteforceblocker_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_cybercrime_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_greensnow_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_level2_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.firehol_tor_exits_entries` | threat | A | 1 | 6 von 241 |
| `cyber.threat.ipsum_ips_ge3` | threat | A | 1 | 8 von 241 |
| `cyber.threat.ipsum_ips_ge5` | threat | A | 1 | 8 von 241 |
| `cyber.threat.tweetfeed_iocs_daily` | threat | D | 28 | 225 von 241 |
| `cyber.threat.tweetfeed_malware_iocs_daily` | threat | D | 28 | 225 von 241 |
| `cyber.vuln.cve_published_hourly` | vuln | B | 718 | 241 von 241 |
| `cyber.vuln.cve_updated_hourly` | vuln | B | 718 | 241 von 241 |
| `cyber.vuln.epss_high_count` | vuln | A | 7 | 49 von 241 |
| `cyber.vuln.kev_additions_rate` | vuln | B | 29 | 241 von 241 |
| `cyber.vuln.kev_ransomware_flag` | vuln | B | 29 | 241 von 241 |

</details>

## Stufen-Verteilung

| Stufe | Zeitschritte | Anteil | zum Vergleich: wenn Schritte ohne abweichenden Bereich als Ruhig gälten |
|---|---:|---:|---:|
| 0 Ruhig | 55 | 22,8 % | 241 (100,0 %) |
| 1 Leicht erhöht | 185 | 76,8 % | 0 (0,0 %) |
| 2 Erhöht | 1 | 0,4 % | 0 (0,0 %) |
| 3 Hoch | 0 | 0,0 % | 0 (0,0 %) |
| 4 Akut | 0 | 0,0 % | 0 (0,0 %) |

**Engine-Befund:** 186 Zeitschritte ab Stufe 1 (davon 1 ab Stufe 2) hatten **keinen einzigen** Bereich über der Schwelle „weicht ab“ (0,25). Ursache: `CONVERGENCE_GATE[0]` in `src/engine/score.ts` ist 1, die Konvergenz-Schranke greift also nur, wenn mindestens ein Bereich abweicht. Mehrere knapp unterschwellige Bereiche addieren sich per Noisy-OR ungedeckelt. Das widerspricht `docs/SCORING.md` („Ein einzelner Bereich kann nie mehr als Leicht erhöht auslösen“, erst recht nicht null Bereiche). Vorschlag für die Engine (hier nicht geändert): Schranke für 0 Bereiche auf 0 oder höchstens 0,29 setzen.

## Ereignisse

| Ereignis | Beginn (UTC) | prüfbar | Schritte im Fenster | Bereiche mit Daten (Median / Max) | höchste Stufe (Wert) | Vorlauf Stufe 1 | Vorlauf Stufe 2 | abweichende Bereiche | erwartete Bereiche mit Daten | erwartete Bereiche getroffen | Ergebnis |
|---|---|---|---:|---:|---|---:|---:|---|---|---:|---|
| CrowdStrike-Falcon-Update legt weltweit Windows-Rechner lahm | 2024-07-19 04:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/4 | **nicht prüfbar** |
| Facebook/Meta verschwindet aus dem Internet (BGP-Rücknahme, DNS unerreichbar) | 2021-10-04 15:30 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/4 | **nicht prüfbar** |
| Ransomware-Angriff auf Change Healthcare (UnitedHealth) | 2024-02-21 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/2 | **nicht prüfbar** |
| Log4Shell (CVE-2021-44228) wird öffentlich und massenhaft ausgenutzt | 2021-12-10 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/2 | **nicht prüfbar** |
| MOVEit-Transfer-Lücke (CVE-2023-34362), Massenausnutzung durch Cl0p | 2023-05-31 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/3 | **nicht prüfbar** |
| Ransomware-Angriff auf Colonial Pipeline, Abschaltung der Pipeline | 2021-05-07 00:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/3 | **nicht prüfbar** |
| Landesweiter Ausfall des Rogers-Netzes in Kanada (inkl. Interac) | 2022-07-08 08:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/4 | **nicht prüfbar** |
| DDoS-Angriff (Mirai) auf den DNS-Anbieter Dyn | 2016-10-21 11:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/4 | **nicht prüfbar** |
| NotPetya-Wiper verbreitet sich weltweit (Maersk, Merck u. a.) | 2017-06-27 09:00 | nein | 0 | 0,0 / 0 | – | – | – | – | keiner | 0/4 | **nicht prüfbar** |
| Microsoft-365-Ausfall (Outlook, Teams) laut Sekundärquelle ¹ | 2026-11-12 00:00 | ja | 56 | 4,0 / 4 | 1 (0,23) | -51 h | nie | – | services | 0/1 | **schwach** |
| Landesweiter FAA-Ground-Stop in den USA laut Sekundärquelle ¹ | 2026-11-13 00:00 | ja | 40 | 4,0 / 4 | 1 (0,23) | -72 h | nie | – | keiner | 0/1 | **schwach** |
| Störungen beim Online-Banking großer US-Banken laut Sekundärquelle ¹ | 2026-11-16 00:00 | ja | 33 | 4,0 / 6 | 1 (0,14) | -63 h | nie | – | finance, services | 0/2 | **schwach** |

¹ laut Sekundärquelle, nicht selbst verifiziert (siehe `backtest/events.json`).

Stärkste Signale je prüfbarem Ereignis (höchster Beitrag im Fenster):

- Microsoft-365-Ausfall (Outlook, Teams) laut Sekundärquelle: `cyber.vuln.cve_published_hourly` 0,19, `cyber.outages.ooni_anomaly_share_fr` 0,18, `cyber.attention.hackernews_volume` 0,16, `cyber.vuln.cve_updated_hourly` 0,13, `cyber.finance.bitcoin_network_nodes` 0,06
- Landesweiter FAA-Ground-Stop in den USA laut Sekundärquelle: `cyber.vuln.cve_published_hourly` 0,19, `cyber.outages.ooni_anomaly_share_fr` 0,18, `cyber.attention.hackernews_volume` 0,16, `cyber.vuln.cve_updated_hourly` 0,13, `cyber.finance.bitcoin_network_nodes` 0,06
- Störungen beim Online-Banking großer US-Banken laut Sekundärquelle: `cyber.vuln.cve_published_hourly` 0,19, `cyber.attention.hackernews_volume` 0,16, `cyber.vuln.cve_updated_hourly` 0,13, `cyber.finance.bitcoin_network_nodes` 0,04, `cyber.outages.users_de` 0,01

## Kontroll-Zeiträume

| Zeitraum | von | bis | prüfbar | Schritte | Bereiche mit Daten (Median / Max) | Anteil ab Stufe 1 | Anteil ab Stufe 2 | höchste Stufe | Ergebnis |
|---|---|---|---|---:|---:|---:|---:|---|---|
| Vergleichszeitraum ohne kuratiertes Großereignis (Okt./Nov. 2026) | 2026-10-19 00:00 | 2026-11-04 23:59 | ja | 136 | 4,0 / 4 | 99,3 % | 0,7 % | 2 | **Fehlalarm** |
| Historischer Vergleichszeitraum August 2019 | 2019-08-05 00:00 | 2019-08-18 23:59 | nein | 0 | 0,0 / 0 | n. v. | n. v. | – | **nicht prüfbar** |
| Historischer Vergleichszeitraum August 2023 | 2023-08-14 00:00 | 2023-08-27 23:59 | nein | 0 | 0,0 / 0 | n. v. | n. v. | – | **nicht prüfbar** |

## Außerhalb von Ereignisfenstern

Alle Zeitschritte, die in keinem (erweiterten) Ereignisfenster liegen. Jeder Schritt ab Stufe 1 ist hier ein Fehlalarm, sofern es nicht ein Ereignis gab, das in der Liste fehlt.

| Menge | Zeitschritte | Anteil ab Stufe 1 | Anteil ab Stufe 2 |
|---|---:|---:|---:|
| alle | 176 | 95,5 % | 0,6 % |
| nur Schritte mit mindestens 3 Bereichen mit Daten | 176 | 95,5 % | 0,6 % |

Zusammenhängende Phasen ab Stufe 1 außerhalb von Ereignissen: 3.

## Laute Signale

Einzel-Ausschläge je Signal außerhalb von Ereignisfenstern: Zahl der Phasen, in denen das Signal einen Beitrag > 0 lieferte, hochgerechnet auf 30 Tage mit Daten. Signale mit weniger als 3 Tagen Daten erhalten keine Rate.

| Signal | Bereich | Klasse | Tage mit Daten | Ausschläge | je 30 Tage | Zeitschritte mit Beitrag |
|---|---|---|---:|---:|---:|---:|
| `cyber.vuln.cve_published_hourly` | vuln | B | 22,0 | 13 | 17,7 | 129 |
| `cyber.vuln.cve_updated_hourly` | vuln | B | 22,0 | 13 | 17,7 | 142 |
| `cyber.attention.hackernews_volume` | attention | D | 22,0 | 2 | 2,7 | 56 |
| `cyber.threat.tweetfeed_malware_iocs_daily` | threat | D | 20,0 | 1 | 1,5 | 24 |
| `cyber.outages.ooni_anomaly_share_de` | outages | A | 22,0 | 1 | 1,4 | 32 |
| `cyber.outages.ooni_anomaly_share_fr` | outages | A | 22,0 | 1 | 1,4 | 88 |
| `cyber.outages.ooni_anomaly_share_gb` | outages | A | 22,0 | 1 | 1,4 | 152 |
| `cyber.outages.ooni_anomaly_share_us` | outages | A | 22,0 | 1 | 1,4 | 136 |
| `cyber.outages.users_de` | outages | A | 22,0 | 1 | 1,4 | 80 |
| `cyber.vuln.kev_additions_rate` | vuln | B | 22,0 | 1 | 1,4 | 24 |

34 Signale mit Daten schlugen außerhalb von Ereignissen nie aus.

## Fazit

- Datenlage: 44 von 303 katalogisierten Signalen (80 mit Collector) und 6 von 9 Bereichen hatten im Zeitraum überhaupt Daten. Zeitschritte mit mindestens 3 Bereichen: 241 von 241.
- Ereignisse: 12 gelistet, 3 prüfbar, 9 nicht prüfbar (crowdstrike-2024-07, facebook-bgp-2021-10, change-healthcare-2024-02, log4shell-2021-12, moveit-2023-05, colonial-pipeline-2021-05, rogers-2022-07, dyn-ddos-2016-10, notpetya-2017-06). Von den prüfbaren: 0 erkannt (ab Stufe 2), 3 nur Stufe 1, 0 verpasst.
- Stufe 1 in einem Ereignisfenster ist bei dieser Grundrate nicht von Normalbetrieb zu unterscheiden; „schwach“ heißt hier praktisch „nicht erkannt“.
- Microsoft-365-Ausfall (Outlook, Teams) laut Sekundärquelle: höchste Stufe 1, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: services: `cyber.services.sec_8k_item105_daily_count`.
- Landesweiter FAA-Ground-Stop in den USA laut Sekundärquelle: höchste Stufe 1, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche physical; dort konnte das System nichts sehen.
- Störungen beim Online-Banking großer US-Banken laut Sekundärquelle: höchste Stufe 1, keiner der erwarteten Bereiche schlug aus; abweichende Bereiche im Fenster: keine. Frische Signale in den erwarteten Bereichen: finance: `cyber.finance.sofr_tail`, `cyber.finance.stablecoin_peg_deviation`, `cyber.finance.bitcoin_network_nodes`, `cyber.finance.sofr_volume`, `cyber.finance.mempool_fee_spike`, `cyber.finance.mempool_size`, `cyber.finance.statuspage_payment_disruption`; services: `cyber.services.sec_8k_item105_daily_count`, `cyber.services.statuspage_incident_rate`, `cyber.services.statuspage_disruption_share`, `cyber.services.statuspage_cloud_disruption`.
- Außerhalb von Ereignissen stand das System in 95,5 % der Zeitschritte auf Stufe 1 oder höher und in 0,6 % auf Stufe 2 oder höher. Das ist weit entfernt vom Anspruch „Der Normalfall ist Ruhig“; mit dieser Grundrate ist ein Ausschlag während eines Ereignisses kein Beleg für Erkennung.
- 186 der Schritte ab Stufe 1 entstehen ohne einen einzigen abweichenden Bereich (Schranken-Lücke, siehe Engine-Befund). Ohne diese Lücke blieben 0 Schritte ab Stufe 1.
- Lauteste Signale: `cyber.vuln.cve_published_hourly` (17,7 Ausschläge je 30 Tage), `cyber.vuln.cve_updated_hourly` (17,7 Ausschläge je 30 Tage), `cyber.attention.hackernews_volume` (2,7 Ausschläge je 30 Tage). Diese zuerst prüfen (Baseline, Schwellen, Saisonalität, Einheit).
- **Eine Vorhersage- oder auch nur Erkennungskraft ist mit den heutigen Daten nicht belegt.** Kein prüfbares Ereignis erreichte Stufe 2.

## Historische Abrufe (offen)

`backtest/history-queue.json` listet 59 Abrufe, die die alten Zeiträume prüfbar machen sollen. Bereits vorhanden sind nur die Einträge, deren Datei unter `fixtures/` liegt. CISA KEV (ab 11/2021) und CISA ICS (ab 2017) brauchen keine Abrufe, ihre aktuelle Datei enthält die datierte Historie.

| Zeitraum | Abrufe | vorhanden | Bereiche, die damit Daten bekämen |
|---|---:|---:|---|
| crowdstrike-2024-07 | 8 | 0 | finance, markets, routing, outages, services, vuln (KEV) |
| facebook-bgp-2021-10 | 9 | 0 | finance, markets, routing, outages, vuln (ICS) |
| change-healthcare-2024-02 | 8 | 0 | finance, markets, routing, outages, services, vuln (KEV) |
| log4shell-2021-12 | 4 | 0 | finance, markets, routing, outages, vuln (KEV) |
| moveit-2023-05 | 4 | 0 | finance, markets, routing, outages, vuln (KEV) |
| colonial-pipeline-2021-05 | 4 | 0 | finance, markets, routing, outages, vuln (ICS) |
| rogers-2022-07 | 6 | 0 | finance, markets, routing, outages, vuln (KEV) |
| dyn-ddos-2016-10 | 5 | 0 | markets, routing, outages |
| notpetya-2017-06 | 3 | 0 | markets, routing, outages, vuln (ICS) |
| control-2019-08 | 4 | 0 | finance, markets, routing, outages, vuln (ICS) |
| control-2023-08 | 4 | 0 | finance, markets, routing, outages, vuln (KEV) |

## Grenzen dieser Auswertung

- Die Ereignisliste ist klein und handverlesen. Die Fehlalarm-Rate außerhalb von Ereignissen ist eine Obergrenze: nicht gelistete echte Vorfälle zählen dort als Fehlalarm.
- Vorlaufzeiten sind auf die Schrittweite gerundet. Tägliche Quellen (die meisten mit Historie) stempeln ihren Tageswert auf 00:00 UTC. Standardmäßig wird ein solcher Wert erst am Tagesende sichtbar gemacht (sonst sähe das System um 03:00 schon den ganzen Tag). Echte Veröffentlichungsverzüge (SOFR am Folgetag, Tor Metrics mehrere Tage) sind nicht nachgebildet; Vorlaufzeiten täglicher Quellen sind deshalb eher zu früh.
- Signale, die nur einen aktuellen Zustand liefern (Statusseiten, Blocklisten, FAA, RIPE Atlas, Mempool), haben im Replay genau einen Wert und damit nie eine Baseline. Sie sind im Zeitraum faktisch blind.
- Die historischen Ereignisse (2016 bis 2024) brauchen eigene Abrufe (`backtest/history-queue.json`), danach `node src/backtest/run.ts --history <id>` je Ereignis und `node src/backtest/evaluate.ts backtest/results/*.json`.
- CISA KEV begann am 03.11.2021 mit mehreren hundert Einträgen in den ersten Tagen. Für Ereignisse kurz danach (Log4Shell) ist die KEV-Baseline deshalb verzerrt.
- Die Historien-Läufe nutzen nur Quellen mit abrufbarer Vergangenheit. Statusseiten, Blocklisten, CT-Logs, FAA, RIPE Atlas und IODA (Antworten zu groß) fehlen dort ganz; ein „verpasst“ in einem Historien-Lauf sagt nur etwas über diese Teilmenge.
- Klasse D (Aufmerksamkeit) fließt nicht in die Stufe, ihre Ausschläge sind in der Tabelle „Laute Signale“ trotzdem gezählt.
