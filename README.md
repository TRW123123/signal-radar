# Signal Radar

Signal Radar ist ein Open-Source-Anomalie-Radar für große, koordinierte Ereignisse (zunächst Cyberangriffe, danach Kriegseskalation und weitere Szenarien). Es holt öffentlich abrufbare Rohdaten (Messnetze, Register, Pflichtmeldungen, Marktdaten), vergleicht jeden Messwert mit seinem eigenen Normalzustand und zeigt pro Szenario, **wie ungewöhnlich die Messwerte gerade sind und in wie vielen unabhängigen Bereichen gleichzeitig**. Das Ergebnis ist eine Stufe von 0 (Ruhig) bis 4 (Akut) mit Aufschlüsselung bis zum einzelnen Messwert. Es ist ein Messinstrument, keine Vorhersage.

## Prinzipien

- **Zero Trust in beide Richtungen.** Aussagen von Behörden, Presse und Anbietern sind kein Beleg (Evidenzklasse C, nur als Kontext, nie gewertet). Gewertet werden unabhängige Messungen (Klasse A) und selbstgemeldete Betriebsdaten oder Pflichtmeldungen (Klasse B, Faktor 0,8). Genauso misstraut das System den eigenen Mustern: Jede Abweichung braucht eine Baseline, eine Prüfung auf harmlose Ursachen und Konvergenz.
- **Nur passive, öffentliche Daten.** Kein Scannen, Proben oder Testen fremder Systeme, keine Umgehung von Logins, keine Überwachung von Personen. Lizenz und Nutzungsbedingungen jeder Quelle stehen im Kopfkommentar des Collectors; geprüfte Bedingungen und Pflicht-Quellenangaben in [docs/DATA-TERMS.md](docs/DATA-TERMS.md) und `src/core/attribution.ts`.
- **Konvergenz statt Einzelsignal.** Die erreichbare Stufe ist durch die Zahl gleichzeitig abweichender Bereiche gedeckelt: ein Bereich höchstens Stufe 1, zwei höchstens 2, drei höchstens 3, erst ab vier ist Stufe 4 möglich.
- **Gerede getrennt von Messung.** Aufmerksamkeit (Suchtrends, Seitenaufrufe, Foren; Klasse D) fließt nicht in die Stufe, sondern in einen getrennten Wert. Die Lücke zwischen beiden wird benannt (`rumorGap`).
- **Der Normalzustand ist ruhig.** Das System soll im Normalfall „Ruhig“ zeigen. Ein Radar, das dauernd Alarm schlägt, ist wertlos. Ob das System diesen Anspruch einlöst, ist noch nicht belegt (siehe Stand).

## Was die Stufe bedeutet

Die Stufe sagt: Messwerte weichen gerade verglichen mit ihrem eigenen Normalwert (Median und robuste Streuung der letzten Wochen) so stark und in so vielen unabhängigen Bereichen ab. Bekannte harmlose Ursachen (z. B. Patch-Dienstag, Monatswechsel, geomagnetische Stürme) dämpfen den Ausschlag, und der Grund wird angezeigt. Details: [docs/SCORING.md](docs/SCORING.md).

Was die Stufe **nicht** bedeutet:

- Keine Wahrscheinlichkeit und keine Vorhersage eines Ereignisses.
- Kein Beleg für Absicht oder Urheber. „Erhöht“ kann ein Ausfall, eine Wartung oder eine Datenpanne der Quelle sein.
- Keine Aussage über Bereiche ohne Daten. Fehlen Signale, sinkt das Vertrauen; unter 0,15 lautet die Aussage „Noch zu wenig Messdaten“.
- Keine Alarmierung. Für den Ernstfall gilt allgemeine Vorsorge nach Empfehlung des BBK.

## Aktueller Stand (17.11.2026)

Zahlen werden per Skript aus dem Repo ermittelt und stehen in [docs/STATUS.md](docs/STATUS.md) (`python3 -I scripts/status_report.py`). Zum Zeitpunkt dieser Fassung: 2 Szenarien (`cyber`, `war`), 478 Signale, davon 129 mit gebautem Collector, 47 Collectors. Die Zahlen ändern sich mit jeder Arbeitswelle; maßgeblich ist immer die neu erzeugte `docs/STATUS.md`.

**Keine freie Netzverbindung beim Bau.** Die Bau-Umgebung hatte keinen freien Internetzugang. Collectors laufen deshalb bisher nie live, sondern nur gegen **einzeln aufgezeichnete echte Antworten** der Quellen (`fixtures/`, Stand 17.11.2026 00:16 UTC). Ein Live-Betrieb und ein Deploy des Frontends haben nicht stattgefunden (siehe [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md), [docs/DEPLOY.md](docs/DEPLOY.md)). Das Dashboard zeigt bis dahin höchstens eine Momentaufnahme aus diesen Aufzeichnungen.

**Collectors gegen echte Antworten geprüft?** Jeder Collector trägt im Kopfkommentar einen `VERIFIED:`-Vermerk.

- ja (26 Collectors): Parser gegen eine echte aufgezeichnete Antwort geprüft.
- teilweise (10): `chromiumdash`, `energy-charts`, `grip`, `msrc-cvrf`, `nyfed-markets`, `polymarket-gamma`, `ripe-stat`, `smard`, `statuspage`, `yahoo-chart`.
- **nein (11), nur nach Dokumentation oder Erinnerung gebaut:** `adsb-lol`, `cloudflare-radar`, `ecb-data`, `gdelt-doc`, `ioda`, `malwarebazaar`, `ransomware-live`, `sans-isc`, `threatfox`, `urlhaus`, `wikimedia-pageviews`. Die Gründe stehen je Collector in `docs/STATUS.md`.
- Vier Collectors brauchen einen Key und werden ohne ihn übersprungen (`cloudflare-radar`, `threatfox`, `urlhaus`, `malwarebazaar`); siehe [docs/KEYS-NEEDED.md](docs/KEYS-NEEDED.md).
- Bei einem Replay gegen die Aufzeichnungen (Lauf am 17.11.2026, Zahlen ändern sich) laufen 33 von 47 Collectors ohne Fehler durch (einzelne davon mit 0 Werten), 10 melden einen Fehler (fehlende Aufzeichnung oder nicht lesbare Antwort), 4 werden mangels Key übersprungen. Das Szenario `cyber` meldet dort „Noch zu wenig Messdaten“ (Vertrauen 0,14).
- Die meisten Signale sind nur katalogisiert, nicht gebaut. Für Kriegseskalation haben bei dieser Fassung Schifffahrt, Staatsverhalten und Energie noch keinen Collector (siehe STATUS.md).

**Backtest: keine belegte Vorhersagekraft.** Der erste Backtest (`backtest/REPORT.md`) ist ein Gerüst mit Replay über 30 Tage:

- 12 Ereignisse gelistet, nur 3 prüfbar (alle drei im November 2026 und laut Sekundärquelle, nicht selbst verifiziert). Die 9 historischen Ereignisse (2016 bis 2024) sind nicht prüfbar, weil die dafür nötigen historischen Abrufe fehlen (`backtest/history-queue.json`).
- Von den 3 prüfbaren erreichte keines Stufe 2, alle blieben bei Stufe 1. Der Bericht bewertet sie als „schwach“, praktisch „nicht erkannt“.
- Der Bericht fand außerhalb von Ereignissen in 95,5 % der Zeitschritte Stufe 1 oder höher. Das widerspricht dem Anspruch „Normalzustand ruhig“. Ursache war laut Bericht eine Lücke in der Konvergenz-Schranke für null abweichende Bereiche. Im Code ist diese Schranke inzwischen auf 0,11 gesetzt (`src/engine/score.ts`); der Bericht wurde seither **nicht neu erzeugt**, die Fehlalarm-Rate mit der geänderten Engine ist also nicht gemessen.
- Ein Teil der Signale (`cve_published_hourly`, `cve_updated_hourly`) schlägt auch außerhalb von Ereignissen etwa 18-mal je 30 Tage aus und ist der erste Prüfkandidat.

Tests: 244 Tests, alle grün (`npm test`, Stand dieser Fassung). Sie prüfen Engine, Speicher und Parser, nicht die Vorhersagequalität.

## Schnellstart

Voraussetzung: Node.js ab 22.18. Es gibt keinen Build und keine Abhängigkeiten, `npm install` ist nicht nötig.

```
npm test                          # Tests (node:test)
npm run replay                    # Collectors gegen fixtures/ abspielen, Snapshot nach frontend/data/snapshot.json
node scripts/serve.ts             # Frontend auf http://localhost:4173
node src/cli.ts run               # Live: Collectors abrufen und Snapshot bauen (braucht Internetzugang)
python3 -I scripts/status_report.py   # docs/STATUS.md neu erzeugen
```

Das Frontend lädt `data/snapshot.json`. Mit `?demo=calm|rumor|single|elevated|acute|multi|sparse` zeigt es erfundene Beispieldaten (`frontend/data/demo-*.json`). Optionen und Umgebungsvariablen von `src/cli.ts`: `--only <id,..>`, `--now <ISO>`, `--data <dir>`, `--out <Datei>`, `SR_SENSITIVITY=normal|high`, `SR_FIXTURES=replay|record`. Betrieb mit GitHub Actions oder Netlify: [docs/DEPLOY.md](docs/DEPLOY.md).

## Ordnerstruktur

| Pfad | Inhalt |
|---|---|
| `src/core/` | Datenverträge (`types.ts`), Katalog-Lader, HTTP-Client mit Aufzeichnung/Replay, Speicher, Collector-Registry |
| `src/collectors/` | ein Collector pro Quelle (`<id>.ts`), Helfer in `_helpers.ts` |
| `src/engine/` | Abweichung, harmlose Ursachen, Szenario-Wert (`anomaly.ts`, `banal.ts`, `score.ts`, `stats.ts`) |
| `src/pipeline/` | Collectors ausführen (`collect.ts`), Snapshot bauen (`snapshot.ts`) |
| `src/backtest/` | Backtest-Gerüst |
| `src/cli.ts` | Kommandozeile (`run`, `collect`, `snapshot`) |
| `catalog/` | Szenarien, Signale, Quellen, Regeln für harmlose Ursachen, Recherche (alles Daten, kein Code) |
| `data/` | Rohdaten als JSONL (entsteht im Betrieb) |
| `fixtures/` | aufgezeichnete echte Antworten der Quellen |
| `frontend/` | statisches Dashboard ohne Build, Schriften lokal; `design/` enthält Entwurfsunterlagen |
| `tests/` | Tests, Collector-Tests unter `tests/collectors/` |
| `backtest/` | Ereignisliste, Ergebnisse, Bericht |
| `scripts/` | Dev-Server, Demo-Snapshot, Aufzeichnungs- und Katalog-Hilfen, `status_report.py` |
| `docs/` | Dokumentation (siehe unten) |
| `.github/workflows/collect.yml` | Sammeln und Bewerten alle 15 Minuten |

Dokumentation: [Architektur](docs/ARCHITECTURE.md), [Scoring](docs/SCORING.md), [Collector-Guide](docs/COLLECTOR-GUIDE.md), [Deploy](docs/DEPLOY.md), [Status](docs/STATUS.md), [Offene Fragen](docs/OPEN-QUESTIONS.md), [Keys](docs/KEYS-NEEDED.md), [Lizenzen der Quellen](docs/LICENSE-TODO.md), [Nutzungsbedingungen der Datenquellen](docs/DATA-TERMS.md), [Beitragen](CONTRIBUTING.md), [Fortschrittsprotokoll](PROGRESS.md).

## Collector oder Szenario ergänzen

- **Collector:** Eine Datei `src/collectors/<id>.ts` nach Vorlage `wikimedia-pageviews.ts`, dazu Test unter `tests/collectors/`. Regeln, Fixture-Aufzeichnung und Test: [docs/COLLECTOR-GUIDE.md](docs/COLLECTOR-GUIDE.md). Spielregeln für Quellen: [CONTRIBUTING.md](CONTRIBUTING.md).
- **Szenario:** Eintrag in `catalog/scenarios.json` (Titel, Frage, Bereiche mit Gewicht), Signale in `catalog/signals/<szenario>.json`, Collectors wie oben. Die Engine braucht keinen Code für ein neues Szenario. Bekannte harmlose Ursachen kommen als Daten nach `catalog/banal-rules.json`. Das Szenario `war` ist das Beispiel, wie es aufgebaut ist.

## Lizenz

Eine Projekt-Lizenz ist **noch nicht festgelegt**; ohne Lizenz sind keine Nutzungsrechte eingeräumt. Die Schriften unter `frontend/assets/fonts/` stehen unter der SIL Open Font License 1.1 (Lizenztexte liegen daneben). Die Lizenzen der Datenquellen sind teilweise ungeklärt: [docs/LICENSE-TODO.md](docs/LICENSE-TODO.md). Geprüfte Nutzungsbedingungen und Pflicht-Quellenangaben stehen in [docs/DATA-TERMS.md](docs/DATA-TERMS.md) und `src/core/attribution.ts`; sie erscheinen im Fuß des Dashboards, sobald Daten dieser Quellen im Snapshot sind.

## Grenzen

- Ohne Historie gibt es keine Baseline. Viele Quellen brauchen Tage bis Wochen Sammelzeit.
- Langsame Entwicklungen über Wochen verschieben die Baseline mit und bleiben unsichtbar.
- Bereiche sind nicht vollständig unabhängig (z. B. Routing und gemessene Ausfälle), die Konvergenz-Schranke behandelt sie trotzdem als getrennt.
- Wer die Quellen kennt, kann einzelne Signale fälschen. Dagegen helfen nur der Manipulationsfaktor und die Konvergenz.
- Eine Erkennungs- oder Vorhersagekraft ist nicht belegt (siehe Backtest). Die Gewichte sind bisher nicht anhand eines Backtests angepasst, weil noch kein belastbarer vorliegt.
- Das Dashboard zeigt Messwerte, keine Handlungsempfehlungen und keine Schlagzeilen.
