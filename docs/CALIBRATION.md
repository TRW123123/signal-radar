# Kalibrierung der Schwellen

Erzeugt 2026-11-24 01:23 UTC mit `node src/backtest/calibrate.ts --before backtest/results/calibration.before.json`. Diese Datei wird bei jedem Lauf überschrieben; der begründende Text steht in `docs/SCORING.md`.

Daten: `data/series`, 254 Signale mit Collector und gespeicherten Werten, davon 220 mit mindestens 10 Vergleichspunkten (14157 Vergleichspunkte über die ganze Historie, 8824 in den letzten 30 Tagen). Bereiche und Stufen: jedes Szenario alle 1 h von 2026-10-24 21:29 bis 2026-11-23 21:29 UTC neu berechnet. Profil `high`, z-Schwelle 2,5, Zeitstempel wie gespeichert (wie der Verlauf im Dashboard). 65 Signale brauchen im Live-Betrieb einen Schlüssel; ihre gespeicherten Werte sind mitgemessen.

Regeln: Jeder Wert wird mit einer Baseline verglichen, die nur aus Werten **vor** ihm gebildet wird (Engine-Funktion `baselineAt`, dieselbe Umrechnung wie Dashboard und Backtest). Bereiche und Stufen kommen aus `computeTimeline` (Engine unverändert). „Ruhige Zeit" = außerhalb der Ereignisfenster aus `backtest/events.json` (72 h vorher bis 24 h nachher).

## Zielvorgabe

- **Einzelne Messung:** höchstens etwa **1 von 50** Vergleichszeitpunkten über der Schwelle (2 %), im Mittel über die eingeschwungenen Signale (mindestens 60 Vergleichspunkte). Einzelne Signale dürfen darüber liegen, solange sie keinen Bereich dauerhaft ungewöhnlich machen.
- **Bereich:** höchstens etwa **5 % der Zeit** „ungewöhnlich" (Bereichswert ≥ 0,25), und zwar jeder einzelne Bereich mit Daten.
- **Stufe 2 oder höher** in ruhigen Zeiten höchstens etwa **1 % der Zeit**, in jedem Szenario. Stufe 1 höchstens etwa 15 %.

Begründung: Ein Radar ist nur so viel wert wie sein Ruhezustand. Prüft man zu jeder Stunde rund 150 Messungen, erzeugt eine Schwelle mit 1 von 50 schon drei auffällige Einzelwerte pro Stunde; das ist als „Auffälligkeit" in der Liste vertretbar, weil eine einzelne Messung nie allein eine Stufe hebt. Ein Bereich bündelt mehrere unabhängige Quellen; wenn er öfter als etwa eine Stunde von zwanzig abweicht, verliert die Aussage „dieser Bereich ist ungewöhnlich" ihren Sinn. Stufe 2 heißt „zwei unabhängige Bereiche gleichzeitig"; wäre das in ruhigen Zeiten öfter als etwa 1 % der Zeit (rund 7 Stunden im Monat) der Fall, würde der Leser lernen, die Stufe zu ignorieren. Die Ziele sind bewusst als Größenordnung gesetzt, nicht als exakte Zahl: Bei der heutigen Datenmenge kann die Messung 1 % nicht von 2 % sicher unterscheiden.

## Ergebnis

| Größe | vorher | jetzt | Ziel | erfüllt |
|---|---:|---:|---:|---|
| Einzelmessung über Schwelle (Mittel der eingeschwungenen Signale) | 2,1 % | 1,8 % | ≤ 2 % | ja |
| Einzelmessung über Schwelle (Mittel aller Signale, auch junge) | 4,1 % | 3,9 % | – | – |
| Einzelmessung über Schwelle (Mittel aller Signale, letzte 30 Tage) | 3,9 % | 3,8 % | – | – |
| Signale mit mehr als doppeltem Ziel | 78 | 64 | – | – |
| Bereich ungewöhnlich (Mittel der Bereiche mit Daten) | 0,7 % | 0,2 % | – | – |
| Bereich ungewöhnlich, lautester Bereich (jetzt `cyber.threat`) | 16,6 % | 4,7 % | ≤ 5 % | ja |
| Stufe ≥ 1, ruhige Zeit, Mittel der Szenarien | 2,7 % | 0,2 % | – | ja |
| Stufe ≥ 1, ruhige Zeit, schlechtestes Szenario | 9,1 % | 1,2 % | ≤ 15 % | ja |
| Stufe ≥ 2, ruhige Zeit, Mittel der Szenarien | 0,0 % | 0,0 % | – | ja |
| Stufe ≥ 2, ruhige Zeit, schlechtestes Szenario | 0,0 % | 0,0 % | ≤ 1 % | ja |
| Stufe ≥ 3, ruhige Zeit, Mittel der Szenarien | 0,0 % | 0,0 % | – | ja |
| Stufe ≥ 3, ruhige Zeit, schlechtestes Szenario | 0,0 % | 0,0 % | – | ja |

## Änderungen gegenüber „vorher"

- Mindestzahl Vergleichswerte einer Baseline: 3 → 7 (`BASELINE_RULES.minValues` in `src/engine/anomaly.ts`).
- `cyber.threat.urlhaus_volume`: eigene Schwelle 2,5 → 10,0 (über Schwelle 5,1 % → 2,2 %).
- `cyber.threat.threatfox_ioc_volume`: eigene Schwelle 2,5 → 10,0 (über Schwelle 11,2 % → 2,1 %).

## Herleitung der Schwellen

**z-Schwelle 2,5 (Einzelmessung).** Maßgeblich sind die 68 eingeschwungenen Signale (mindestens 60 Vergleichspunkte), weil bei kürzerer Historie die Baseline selbst noch wackelt. Bei einer einheitlichen Schwelle von 2,5 lagen sie im Mittel 2,3 % der Zeit darüber, bei 3 1,8 %, bei 2 3,8 %. Mit den signal-eigenen Schwellen sind es 1,8 %. Das Ziel 1 von 50 (2 %) liegt zwischen 2,5 und 3; die Schwelle bleibt bei 2,5, weil die Abweichung vom Ziel kleiner ist als die Messunsicherheit und eine höhere Schwelle echte Ausschläge später zeigen würde.

| z-Schwelle | eingeschwungene Signale (Mittel) | alle Signale (gepoolt) | alle Signale (Median) |
|---:|---:|---:|---:|
| 2,0 | 3,8 % | 4,9 % | 1,8 % |
| 2,5 | 2,3 % | 3,3 % | 0,0 % |
| 3,0 | 1,8 % | 2,5 % | 0,0 % |
| 3,5 | 1,4 % | 2,0 % | 0,0 % |
| 4,0 | 1,2 % | 1,6 % | 0,0 % |
| 5,0 | 0,8 % | 1,1 % | 0,0 % |

**Mindestens 7 Vergleichswerte.** Anteil der Vergleiche über der Schwelle nach Größe der Baseline zum jeweiligen Zeitpunkt. Kurze Baselines sind deutlich lauter; unter 7 Werten wird ein Signal deshalb gar nicht bewertet, darunter nur angezeigt. Zwischen 7 Werten und `minPoints` zählt es wie bisher nur halb.

| Werte in der Baseline | Vergleiche (jetzt) | über Schwelle (jetzt) | über Schwelle (vorher) |
|---|---:|---:|---:|
| 3 bis 6 | 0 | – | 5,3 % (1109) |
| 7 bis 13 | 2029 | 5,6 % | 5,7 % (2029) |
| 14 bis 27 | 3193 | 4,3 % | 4,4 % (3193) |
| 28 bis 55 | 3831 | 0,5 % | 0,5 % (3831) |
| 56 bis ∞ | 5104 | 1,1 % | 3,0 % (5104) |

**Bereich ab 0,25.** Anteil aller Zeitschritte mit Daten (alle Bereiche gepoolt), an denen der Bereichswert die Grenze erreicht. Das Ziel (höchstens 5 % je Bereich) wäre auch mit 0,15 noch knapp einzuhalten, mit 0,1 nicht mehr. Die Grenze bleibt bei 0,25: Eine Quelle mit mittlerem Gewicht (Beitrag 0,5 bei vollem Ausschlag) erreicht sie erst bei halbem Ausschlag, also deutlich jenseits der Einzelschwelle, und der lauteste Bereich (`cyber.threat`, 4,7 %) liegt damit im Ziel. Eine niedrigere Grenze ist erst sinnvoll, wenn mehr Bereiche dauerhaft Daten haben und die Messung pro Bereich belastbar ist.

| Grenze | 0,10 | 0,15 | 0,20 | 0,25 | 0,30 | 0,40 | 0,50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Anteil der Zeit ungewöhnlich | 7,1 % | 3,1 % | 1,4 % | 0,2 % | 0,1 % | 0,0 % | 0,0 % |

**Stufen 0,12 / 0,30 / 0,55 / 0,78 und Konvergenz-Schranke 0,11 / 0,29 / 0,54 / 0,77 / 1,00.** Diese Grenzen sind aus der Konstruktion abgeleitet, nicht aus der Häufigkeit: Die Schranke für n abweichende Bereiche liegt jeweils knapp unter der Grenze der Stufe n + 1, sodass n Bereiche höchstens Stufe n erreichen. Die Messung prüft nur, ob das im Ruhezustand hält. Höchster Szenario-Wert außerhalb von Ereignissen: cyber 0,153, war 0,017, blackout 0,016, ai 0,001, finance 0,000, nuclear 0,006, bio 0,008. Stufe 2 kam in 30 Tagen nie vor; die Stufen 2 bis 4 lassen sich mit diesen Daten deshalb nicht feiner kalibrieren.

Signale mit eigener Schwelle (70 insgesamt, hier die 15 lautesten mit mindestens 10 Vergleichspunkten):

| Signal | eigene Schwelle | über Schwelle | über 2,5 | Vergleichspunkte |
|---|---:|---:|---:|---:|
| `war.markets.brent_wti_spread` | 3,0 | 17,9 % | 19,6 % | 56 |
| `nuclear.seismic.explosion_type_global_count` | 4,0 | 11,1 % | 16,7 % | 18 |
| `bio.wastewater.amelag_flu` | 3,0 | 9,7 % | 10,7 % | 103 |
| `bio.context.amelag_covered_pop` | 3,0 | 8,7 % | 9,7 % | 103 |
| `bio.clinical.icu_covid_current` | 3,0 | 8,5 % | 13,2 % | 106 |
| `cyber.vuln.cve_published_daily` | 3,0 | 7,1 % | 7,1 % | 28 |
| `bio.wastewater.amelag_flub` | 3,0 | 6,8 % | 7,8 % | 103 |
| `bio.clinical.sari_kids` | 3,0 | 6,8 % | 9,7 % | 103 |
| `bio.attention.grippeweb_ili` | 3,0 | 5,8 % | 5,8 % | 103 |
| `war.markets.wti_price` | 3,0 | 5,3 % | 10,5 % | 57 |
| `bio.clinical.sari_total` | 3,0 | 4,9 % | 6,8 % | 103 |
| `bio.clinical.are_konsultation` | 3,0 | 4,9 % | 4,9 % | 103 |
| `bio.clinical.sari_kids_saison` | 2,5 | 4,9 % | 4,9 % | 103 |
| `finance.real_economy.oil_price` | 3,0 | 4,1 % | 6,2 % | 242 |
| `bio.wastewater.amelag_rsv` | 3,0 | 3,9 % | 4,9 % | 103 |

## Szenarien

| Szenario | Schritte | davon ≥ 3 Bereiche mit Daten | Stufe ≥ 1 | ≥ 2 | ≥ 3 | ruhig ≥ 1 | ruhig ≥ 2 | Episoden ≥ 1 | höchste Stufe | wann | Bereiche |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| Cyberangriff (`cyber`) | 721 | 721 | 1,4 % (vorher 6,1 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 1,2 % | 0,0 % | 5 | 1 Leicht erhöht | 2026-11-23 19:29 | threat |
| Kriegseskalation (`war`) | 721 | 721 | 0,0 % (vorher 6,4 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |
| Blackout und Energiekrise (`blackout`) | 721 | 0 | 0,0 % (vorher 0,0 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |
| KI-Vorfall (`ai`) | 721 | 0 | 0,0 % (vorher 0,0 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |
| Finanzkrise und Bankenstress (`finance`) | 721 | 721 | 0,0 % (vorher 0,0 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |
| Nuklearer Zwischenfall (`nuclear`) | 721 | 115 | 0,0 % (vorher 0,0 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |
| Pandemie und Ausbrüche (`bio`) | 721 | 721 | 0,0 % (vorher 0,0 %) | 0,0 % (vorher 0,0 %) | 0,0 % | 0,0 % | 0,0 % | 0 | 0 Ruhig | – | – |

Höchste erreichte Stufe und auslösende Signale:

- **Cyberangriff:** Stufe 1 am 2026-11-23 19:29 UTC (Wert 0,153), Bereiche `threat`; `cyber.threat.threatfox_ioc_volume` (z 101,5), `cyber.finance.statuspage_payment_disruption` (z 6,7), `cyber.vuln.msrc_out_of_band` (z 4,0), `cyber.markets.cyber_etf_volume` (z 7,7), `cyber.markets.vix` (z 3,4)
- **Kriegseskalation:** nie über „Ruhig".
- **Blackout und Energiekrise:** nie über „Ruhig".
- **KI-Vorfall:** nie über „Ruhig".
- **Finanzkrise und Bankenstress:** nie über „Ruhig".
- **Nuklearer Zwischenfall:** nie über „Ruhig".
- **Pandemie und Ausbrüche:** nie über „Ruhig".

## Bereiche

Anteil der Zeitschritte mit Daten, an denen der Bereichswert ≥ 0,25 war. Nur Bereiche mit mindestens 24 Schritten mit Daten.

| Szenario | Bereich | Schritte mit Daten | ungewöhnlich | davon ruhige Zeit | höchster Wert | getragen von (Schritte) |
|---|---|---:|---:|---:|---:|---|
| cyber | Angriffs-Telemetrie (`threat`) | 721 | 4,7 % | 3,6 % | 0,49 | `cyber.threat.threatfox_ioc_volume` (27), `cyber.threat.urlhaus_volume` (6), `cyber.threat.malwarebazaar_volume` (1) |
| cyber | Internet-Routen (`routing`) | 478 | 0,6 % | 1,1 % | 0,28 | `cyber.routing.hijack_events` (3) |
| cyber | Gemessene Ausfälle (`outages`) | 721 | 0,0 % | 0,0 % | 0,20 | – |
| cyber | Kern-Dienste (`dns_core`) | 107 | 0,0 % | 0,0 % | 0,00 | – |
| cyber | Schwachstellen (`vuln`) | 721 | 0,0 % | 0,0 % | 0,16 | – |
| cyber | Zahlungsverkehr (`finance`) | 721 | 0,0 % | 0,0 % | 0,19 | – |
| cyber | Dienste und Firmenmeldungen (`services`) | 721 | 0,0 % | 0,0 % | 0,04 | – |
| cyber | Märkte und Insider (`markets`) | 721 | 0,0 % | 0,0 % | 0,15 | – |
| cyber | Strom, Verkehr, Funk (`physical`) | 688 | 0,0 % | 0,0 % | 0,09 | – |
| war | Militär in Luft, See und All (`military`) | 115 | 0,0 % | 0,0 % | 0,00 | – |
| war | Gemessene Kampfhandlungen (`conflict`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| war | Internet und Strom in Konfliktgebieten (`connectivity`) | 718 | 0,0 % | 0,0 % | 0,10 | – |
| war | Energieversorgung (`energy`) | 721 | 0,0 % | 0,0 % | 0,05 | – |
| war | Märkte und Wetten (`markets`) | 721 | 0,0 % | 0,0 % | 0,21 | – |
| blackout | Gasversorgung (`gas`) | 721 | 0,0 % | 0,0 % | 0,15 | – |
| blackout | Märkte (`markets`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| ai | Software-Lieferkette (`supply_chain`) | 478 | 0,0 % | 0,0 % | 0,00 | – |
| ai | Rechenleistung und Strom (`compute`) | 104 | 0,0 % | 0,0 % | 0,01 | – |
| finance | Geldmarkt (`money_market`) | 721 | 0,0 % | 0,0 % | 0,21 | – |
| finance | Kreditaufschläge (`credit`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| finance | Banken (`banks`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| finance | Schwankungen (`volatility`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| finance | Krypto (`crypto`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| finance | Realwirtschaft (`real_economy`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| finance | Märkte (`markets`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| nuclear | Strahlung in der Umwelt (`radiation`) | 108 | 0,0 % | 0,0 % | 0,00 | – |
| nuclear | Erdbeben und Explosionen (`seismic`) | 116 | 0,0 % | 0,0 % | 0,00 | – |
| nuclear | Militär und Luftraum (`military`) | 115 | 0,0 % | 0,0 % | 0,00 | – |
| nuclear | Märkte, Wetten und Vorsorgekäufe (`markets`) | 721 | 0,0 % | 0,0 % | 0,10 | – |
| bio | Abwasser (`wastewater`) | 721 | 0,0 % | 0,0 % | 0,00 | – |
| bio | Arztbesuche und Krankenhäuser (`clinical`) | 721 | 0,0 % | 0,0 % | 0,07 | – |
| bio | Märkte (`markets`) | 721 | 0,0 % | 0,0 % | 0,00 | – |

## Einzelsignale

Lauteste Signale (mindestens 10 Vergleichspunkte), sortiert nach Anteil über der eigenen Schwelle. Ursache ist eine grobe Einordnung aus den Daten: *stoßweise* (viele Nullen oder lange Spitzen), *Wochenrhythmus* (Treffer fast nur an ein, zwei Wochentagen), *Trend/Niveauwechsel* (Treffer gehäuft am Ende der Historie), *kurze Historie* (unter 30 Vergleichspunkte).

| Signal | Szenario | Klasse | Vergleichspunkte | Historie (Tage) | Schwelle | über Schwelle | Episoden / 30 T | z für 1 von 50 | Ursache |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `nuclear.markets.polymarket_nuclear_volume` | nuclear | D | 11 | 4 | 2,5 | 54,5 % | 7,8 | – | kurze Historie |
| `finance.real_economy.cre_delinq` | finance | B | 11 | 913 | 2,5 | 36,4 % | 0,0 | – | kurze Historie |
| `nuclear.markets.vix_gold` | nuclear | A | 15 | 18 | 2,5 | 33,3 % | 5,0 | – | kurze Historie |
| `cyber.attention.gdelt_cyber_volume` | cyber | D | 17 | 17 | 2,5 | 29,4 % | 7,1 | – | kurze Historie |
| `war.attention.prediction_volume_spike` | war | D | 11 | 4 | 2,5 | 27,3 % | 7,8 | – | kurze Historie |
| `war.attention.gdelt_hotspot_iran_hormuz` | war | D | 20 | 26 | 2,5 | 25,0 % | 2,3 | 8,1 | kurze Historie |
| `bio.markets.poultry_stocks` | bio | A | 27 | 822 | 2,5 | 22,2 % | 0,1 | 5,7 | kurze Historie |
| `cyber.physical.frequency_deviation_de` | cyber | A | 15 | 4 | 2,5 | 20,0 % | 22,0 | – | kurze Historie |
| `war.energy.lng_terminals` | war | B | 15 | 14 | 2,5 | 20,0 % | 2,1 | – | kurze Historie |
| `nuclear.attention.wiki_nuclear_en` | nuclear | D | 21 | 20 | 2,5 | 19,1 % | 1,5 | 10,9 | kurze Historie |
| `cyber.markets.vix_spike` | cyber | A | 33 | 51 | 2,5 | 18,2 % | 2,4 | 4,4 | Einzelereignisse |
| `war.markets.brent_wti_spread` | war | A | 56 | 81 | 3,0 (eigen) | 17,9 % | 1,1 | 6,7 | Einzelereignisse |
| `cyber.markets.gold_abs_return` | cyber | A | 17 | 23 | 2,5 | 17,6 % | 3,9 | – | kurze Historie |
| `war.markets.vix` | war | A | 18 | 23 | 2,5 | 16,7 % | 2,6 | – | kurze Historie |
| `war.attention.gdelt_coverage_share` | war | D | 18 | 18 | 2,5 | 16,7 % | 1,7 | – | kurze Historie |
| `cyber.markets.vix` | cyber | A | 18 | 23 | 2,5 | 16,7 % | 2,6 | – | kurze Historie |
| `war.markets.gas_henry_vs_ttf` | war | A | 27 | 792 | 2,5 | 14,8 % | 0,1 | 3,6 | kurze Historie |
| `nuclear.attention.wiki_nuclear_de` | nuclear | D | 21 | 20 | 2,5 | 14,3 % | 4,5 | 3,5 | kurze Historie |
| `war.markets.fertilizer_prices` | war | A | 28 | 822 | 2,5 | 14,3 % | 0,1 | 3,3 | kurze Historie |
| `war.attention.wikipedia_en` | war | D | 21 | 20 | 2,5 | 14,3 % | 3,0 | 3,5 | kurze Historie |
| `cyber.outages.users_de` | cyber | A | 64 | 70 | 2,5 | 12,5 % | 1,3 | 203,9 | stoßweise |
| `nuclear.seismic.explosion_type_global_count` | nuclear | A | 18 | 5 | 4,0 (eigen) | 11,1 % | 6,3 | – | kurze Historie |
| `cyber.finance.statuspage_payment_disruption` | cyber | B | 18 | 5 | 2,5 | 11,1 % | 12,6 | – | kurze Historie |
| `cyber.services.statuspage_cloud_disruption` | cyber | B | 18 | 5 | 2,5 | 11,1 % | 6,3 | – | kurze Historie |
| `finance.credit.eur_hy_oas` | finance | A | 38 | 51 | 2,5 | 10,5 % | 1,8 | 3,0 | Einzelereignisse |
| `war.connectivity.ooni_anomaly_share_ir` | war | A | 29 | 28 | 2,5 | 10,3 % | 2,1 | 7,8 | kurze Historie |
| `war.connectivity.ooni_anomaly_share_il` | war | A | 29 | 28 | 2,5 | 10,3 % | 2,1 | 7,2 | kurze Historie |
| `war.connectivity.ooni_anomaly_share_ru` | war | A | 29 | 28 | 2,5 | 10,3 % | 1,1 | 5,3 | kurze Historie |
| `cyber.markets.btc_abs_return` | cyber | A | 29 | 28 | 2,5 | 10,3 % | 2,1 | 5,5 | kurze Historie |
| `cyber.markets.polymarket_cyber` | cyber | A | 10 | 4 | 2,5 | 10,0 % | 8,5 | – | kurze Historie |
| `nuclear.attention.gdelt_nuclear_volume` | nuclear | D | 20 | 26 | 2,5 | 10,0 % | 1,1 | 3,0 | kurze Historie |
| `cyber.services.statuspage_major_starts_day` | cyber | B | 20 | 19 | 2,5 | 10,0 % | 3,2 | 3,6 | kurze Historie |
| `bio.wastewater.amelag_flu` | bio | A | 103 | 714 | 3,0 (eigen) | 9,7 % | 0,0 | 16,6 | stoßweise |
| `nuclear.markets.polymarket_nuclear` | nuclear | D | 11 | 4 | 2,5 | 9,1 % | 7,8 | – | kurze Historie |
| `war.attention.prediction_markets_war` | war | D | 11 | 4 | 2,5 | 9,1 % | 7,8 | – | kurze Historie |
| `bio.context.amelag_covered_pop` | bio | A | 103 | 714 | 3,0 (eigen) | 8,7 % | 0,0 | 4,8 | Einzelereignisse |
| `bio.clinical.icu_covid_current` | bio | B | 106 | 112 | 3,0 (eigen) | 8,5 % | 0,5 | 3,6 | stoßweise |
| `war.markets.gvz_and_move` | war | A | 38 | 51 | 2,5 | 7,9 % | 1,2 | 3,8 | Einzelereignisse |
| `nuclear.markets.fred_uranium_price` | nuclear | A | 27 | 792 | 2,5 | 7,4 % | 0,0 | 2,8 | kurze Historie |
| `cyber.vuln.cve_published_daily` | cyber | B | 28 | 27 | 3,0 (eigen) | 7,1 % | 2,2 | 4,8 | kurze Historie |

134 von 220 gemessenen Signalen liegen bei höchstens 2 %. 34 Signale haben weniger als 10 Vergleichspunkte und sind nicht bewertet.

## Belastbarkeit

- **Kurze Basis.** Der 15-Minuten-Betrieb läuft seit dem 17.11.2026. Die Historie der Signale reicht von wenigen Tagen bis zu Jahren (Median 28 Tage, nur 112 von 220 Signalen mit mindestens 28 Tagen). Viele Baselines sind noch unreif (Anteil reifer Vergleichspunkte im Mittel 51 %).
- **Wenige unabhängige Episoden.** Die Stufen-Anteile beruhen auf 30 Tagen mit 1-h-Schritten; aufeinanderfolgende Schritte sind nicht unabhängig. Stufe 1 trat über alle Szenarien in 5 getrennten Episoden auf, Stufe 2 in 0. Bei so wenigen Episoden ist ein gemessener Anteil von 1 % nicht von 0,3 % oder 3 % zu unterscheiden; dass Stufe 2 nie vorkam, belegt nur, dass das Ziel nicht grob verfehlt wird.
- **Frühe Zeitschritte sind dünn.** Am Anfang des Fensters hatten viele Signale noch keine Daten; dort ist „Ruhig" auch eine Folge fehlender Messungen. Die Spalte „≥ 3 Bereiche mit Daten" zeigt, wie viel der Zeit überhaupt prüfbar war.
- **Ereignisse im Fenster.** Drei Ereignisse aus `backtest/events.json` fallen in den Zeitraum (12. bis 16.11.). Die „ruhige Zeit" schließt ihre Fenster aus; ob das Radar sie erkennt, ist Aufgabe des Backtests, nicht dieser Kalibrierung.
- **Was sich mit mehr Daten ändern kann:** Mit wachsender Historie werden die Baselines reif, die Streuungs-Untergrenzen greifen seltener und Wochenrhythmen werden über die saisonale Baseline erfasst. Das senkt den Anteil eher. Signale, die heute nur wegen kurzer Historie laut sind, sollten in vier Wochen erneut gemessen werden, bevor ihre Schwelle dauerhaft angehoben wird. Die Kalibrierung ist deshalb monatlich neu zu fahren (`node src/backtest/calibrate.ts --before backtest/results/calibration.json`).

Maschinenlesbar: `backtest/results/calibration.json`, Alltagssprache fürs Frontend: `frontend/data/explain.json`.
