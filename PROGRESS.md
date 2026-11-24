# PROGRESS — Signal Radar

Fortschrittsprotokoll für nahtloses Weiterarbeiten. Neuester Stand oben. Ein neuer Lauf liest diese Datei,
`docs/OPEN-QUESTIONS.md` und `git log` und macht beim ersten offenen Punkt weiter.

## Stand (24.11.2026, Verbesserungsschleife nach docs/PLAN-V2.md)

**Live:** https://signal-radar.safak-t.workers.dev/ (Cloudflare, Deploy bei jedem Push auf `master`, der `frontend/**` berührt).
Arbeitsweise: Runden aus Messen, drei Lücken wählen, bauen, unabhängig prüfen, ausliefern. Jede Runde endet gepusht.

| Runde | Inhalt | Stand |
|---|---|---|
| 1 | Globus-Frontend (V2), Orte je Messung (`catalog/geo.json`), `rarity` je Messung, RKI-Collectors, Kalibrierung der Schwellen aus Live-Daten (`docs/CALIBRATION.md`, `frontend/data/explain.json`), englische Datentexte, Gerüchte-Register | ausgeliefert |
| 2 | Unabhängige Kritik mit 5-Sekunden-Test (`frontend/design/KRITIK-RUNDE-2.md`: 2 von 5 verstehen den Zweck, Globus Note 2); Frontend danach: Ja/Nein-Antwort oben, Gerüchte-Zeile, belebter Globus, „Warum ungewöhnlich", Zeitmaschine, DE/EN, Teilen. Ungewertete Kartenschichten (`MapLayer`, Collectors `layer-usgs-quakes`, `layer-eonet`, `layer-gdacs`). Zeitmaschine mit passenden Ereignissen (Stromausfall Iberien 2025, Israel–Iran 2025, Rogers 2022, Facebook 2021). `collect` startet zusätzlich nach Pushes auf `src/**`/`catalog/**`, Push mit Wiederholung | ausgeliefert |
| 3 | Globus als dunkle Bühne, Schichten schaltbar, Handy-Erstbildschirm, Zeitmaschinen-Texte ohne falschen Vorlauf | läuft |

**Ehrliche Befunde, die offen bleiben:**
- Zeitmaschine: Das Radar bestätigt Ereignisse nach Stunden (Stufe 1 bis 2), es warnte in keinem Fall vorher. Firmen-Vorfälle (Log4Shell, MOVEit, Colonial …) sind mit offenen Daten nicht sichtbar. Siehe `backtest/REPORT.md`.
- Der geplante 15-Minuten-Takt von `collect` wurde von GitHub nur alle 6 bis 12 Stunden ausgeführt (Commits vom 22./23.11.). Ursache ungeprüft (Actions-Protokolle von der Bau-Umgebung aus nicht lesbar). Abhilfe bisher: Start nach Code-Push. Dauerhafte Lösung offen (externer Zeitgeber, z. B. Cloudflare-Cron, der `workflow_dispatch` auslöst; braucht ein Token vom Betreiber).
- `layer-gdacs` lieferte im ersten Live-Lauf keine Schicht (USGS und EONET ja); `blackout-open-meteo`, `ai-hf-hub`, alle `layer-*`: `VERIFIED: nein`.
- Orte: KI 1 von 11, Cyber 38 von 97 Messungen mit Daten haben einen Ort; viele Cyber-Messungen sind weltweite Zählungen und haben zu Recht keinen.
- `scripts/build_single.py` wurde entfernt (Einzeldatei-Fassung passt nicht zu den Modulen); ältere Abschnitte unten nennen es noch.

**Arbeitsverzeichnis:** Push nur über die alte Repo-Adresse (`…/TRW123123/autohaus-eckenberger-website`, leitet weiter). Nie eine lokal gebaute `frontend/data/snapshot.json` committen.

## Stand (20.11.2026)

**Collector-Welle 1 und 2.** 79 Collectors (STATUS.md: 56 VERIFIED ja, 4 teilweise, 19 nein). Welle 1 (Gruppen A, B, C) hat 21 Collectors mit
Key gebaut; die meisten sind ungeprüft bis zum ersten Lauf mit Key. Welle 2: `ctx.http` kann POST (`method`, `body`) und liefert über
`request()` Status, Header und Cookies; Login-/Token-Antworten werden nie aufgezeichnet. `redactUrl` schwärzt Key-Parameter in jeder
Schreibweise und Key-artige Pfadsegmente (FIRMS MAP_KEY), der Runner schwärzt zusätzlich alle Key-Werte in Fehlern und Logs.
`space-track` (POST-Login + Cookie) und `reddit-json` (client_credentials + Bearer, eigener User-Agent) sind damit lauffähig.
Workflow reicht alle neuen Secrets durch (`SR_GITHUB_KEY` fällt auf `github.token` zurück), Zeitlimit 15 min. Attribution für 14 neue
Quellen in `src/core/attribution.ts` und `docs/DATA-TERMS.md`. Offen: `docs/OPEN-QUESTIONS.md` Punkt 8 (Lizenzen Shadowserver, Metaculus,
Reddit, ICE BofA; SAM-Kontingent; ID-Kollisionen; aisstream-Kompression; GFW regionIds). Nächster Schritt: Secrets anlegen, Live-Lauf, VERIFIED nachziehen.

## Stand (17.11.2026, 11:30)

**Live.** Frontend: https://signal-radar.netlify.app (noindex). Collectors: GitHub Actions `collect` alle 15 Minuten, Daten als Commits auf `master`, Snapshot wird von `raw.githubusercontent.com` geladen. 58 Collectors: 54 liefern echte Daten, 4 übersprungen (Key fehlt: cloudflare-radar, threatfox, urlhaus, malwarebazaar), 0 Fehler im ersten Handlauf. Offen: `docs/OPEN-QUESTIONS.md`.

| Welle | Inhalt | Status |
|---|---|---|
| 0 | Fundament: Schema, Engine, Speicher, CLI, Tests | fertig |
| 1 | Cyber: Katalog 304 Signale, Quellen-Matrix, Bau-Reihenfolge | fertig |
| 2 | Cyber: 41 Collectors, gegen echte Antworten geprüft bzw. gekennzeichnet (docs/STATUS.md) | fertig, Live-Lauf 17.11. bestanden |
| 3 | Frontend nach elite-ui-ux (Konvergenz-Streifen, hell/dunkel), Einzeldatei-Vorschau | fertig, live auf Netlify |
| 4 | Backtesting: Gerüst, Ereignisliste, erster 30-Tage-Lauf, Engine-Korrekturen daraus | Gerüst fertig; historische Daten fehlen |
| 5 | Krieg: Katalog 176 Signale, 6 live geprüfte GitHub-Collectors, 8 erweiterte Collectors | läuft |
| 6 | Blackout, KI, Finanz, Nuklear, Pandemie: Recherche fertig, Konsolidierung läuft | läuft |

Nächste Schritte in dieser Reihenfolge:
1. Konsolidierte Kataloge der fünf weiteren Szenarien prüfen, Szenario-Einträge in `catalog/scenarios.json` übernehmen.
2. Je Szenario: live prüfbare GitHub-Collectors bauen und die eigene Datei `src/collectors/config/<szenario>.ts` füllen.
3. Kleine Antworten aufzeichnen (`docs/CAPTURE-AGENT-PROMPT.md`), Replay, Snapshot, `python3 -I scripts/build_single.py`.
4. Signal-Audit (Evidenzklassen, Gewichte, Rhythmus, Laien-Texte) über alle Collector-Deklarationen.
5. Backtest neu laufen lassen (`node src/backtest/run.ts`, `node src/backtest/evaluate.ts`), `backtest/REPORT.md` aktualisieren.
6. Gesamtprüfung, `docs/STATUS.md` neu erzeugen, Archiv bauen, übergeben.

## Entscheidungen

- **Stack:** TypeScript auf Node ≥ 22.18 ohne Build und ohne Abhängigkeiten (natives Type-Stripping, `fetch`, `node:test`).
  Frontend statisch ohne Build. Grund: läuft überall, jeder kann es prüfen und forken.
- **Speicher:** JSONL-Dateien pro Signal (`data/series/`), Schnittstelle `Store` für andere Backends.
- **Scoring:** robuste Abweichung vom eigenen Normalwert (Median/MAD), Dämpfung bekannter harmloser Ursachen,
  Konvergenz-Schranke über unabhängige Bereiche. Stufe ist durch die Zahl gleichzeitig abweichender Bereiche gedeckelt.
  Aufmerksamkeit (Klasse D) getrennt von Messung (Klassen A, B). Details: `docs/SCORING.md`.
- **Empfindlichkeit:** `high` (z ab 2,5 zählt, ab 2 wird gelistet), laut Vorgabe „erst viel sammeln, später destillieren“.
- **Szenario-Reihenfolge:** Cyber zuerst (Vorgabe), danach nach aktueller Relevanz (Recherche 17.11.2026):
  Kriegseskalation, Blackout/Energie, KI-Vorfall, Finanzkrise, Nuklear, Pandemie.
- **Umgebungs-Grenze (überholt 17.11.):** Die Bau-Umgebung hatte keinen Internetzugang; Fixtures stammen daher teils aus Einzelabrufen. Seit dem Live-Betrieb gilt `SR_FIXTURES=record` lokal.
- **Snapshot-Auslieferung:** Die Seite lädt den Snapshot von `raw.githubusercontent.com` (Repo öffentlich), Fallback ist die mitgelieferte Kopie. Grund: 96 Daten-Commits am Tag sollen keine 96 Netlify-Deploys auslösen. Dazu `ignore`-Regel in `netlify.toml`.
- **Rohdaten kürzen:** `--prune-days 120` im Workflow, nie unter das Baseline-Fenster eines Signals.

## Offene Punkte für den Auftraggeber

Siehe `docs/OPEN-QUESTIONS.md`.

## Protokoll

- 2026-11-20 Welle 3: Live-Lauf Actions (Run 44717048752): agsi ok (36, Einzelspeicher-Signal fehlte: EIC ungültig -> auf SEFE Storage/Rehden aus dem Verzeichnis umgestellt), alsi ok (72), eia ok (76), fred ok (1326), fred-eggs ok (35), nasa-firms ok (10), nvd-cve-api ok (4): VERIFIED gesetzt. shadowserver: 3x „fetch failed“ auf dem Runner (lokal ok), Ursache jetzt in der Meldung (http.ts, alle Collectors), dritter Versuch, Hinweis in OPEN-QUESTIONS. aisstream: Replay nutzt Fixture statt WebSocket. Tests grün (450).
- 2026-11-20 Welle 2 (zentral): http.ts POST/request/Cookies + Redaction (Query, Pfad, Runner), space-track und reddit-json lauffähig, status_report.py mit needsKey-Listen, Workflow-Secrets und Timeout 15 min, Attributionen (GFW, Fingrid, FIRMS, NVD, GHSA, CoinGecko, Metaculus, Reddit, Shadowserver, OTX, aisstream, FAA, Space-Track, alerts.in.ua), sources.json fred-csv → fred, Test gegen doppelte Signal-ids, KEYS-NEEDED/OPEN-QUESTIONS aktualisiert. Nicht committet.
- 2026-11-17 10:00 Live-Schaltung: Tests grün (300), erster echter Lauf, Parser repariert (ransomware-live, polymarket-gamma, sans-isc, treasury-fiscal), Wikimedia-User-Agent, GDELT-Abstand. Workflow grün (58 Collectors, 0 Fehler). Netlify-Projekt `signal-radar` angelegt, mit GitHub verbunden, Plakette abgeschaltet, Seite geprüft (Desktop und 390 px, keine Konsolenfehler, einzige Fremd-Anfrage raw.githubusercontent.com).

- 2026-11-17 00:45 Start. Netlify-Deploy wurde um 00:46 freigegeben.
- 2026-11-17 00:50 Welle 1 gestartet: 5 Recherche-Agents Cyber, Prior Art, Szenario-Relevanz.
- 2026-11-17 01:00 Welle 0 fertig: Engine mit 16 Tests grün, committet.
- 2026-11-17 01:05 Konsolidierung Cyber-Katalog und Frontend-Skizzen gestartet.
- 2026-11-17 Backtest-Gerüst: `src/backtest/{lib,run,evaluate,history-queue}.ts`, `backtest/events.json` (9 historische Ereignisse, 3 aus Sekundärquelle für Nov. 2026, 3 Kontrollen), `backtest/history-queue.json` (59 Abrufe), Tests `tests/backtest.test.ts`. 30-Tage-Replay: 95 % der Zeit außerhalb von Ereignissen Stufe ≥ 1, alles ohne abweichenden Bereich. Engine-Befund: `CONVERGENCE_GATE[0] = 1` lässt unterschwellige Bereiche ungedeckelt durch (nicht geändert, Entscheidung offen).
- 2026-11-17 01:30 Cyber-Collectors gebaut (aus dem Gedächtnis), erste Aufzeichnung echter Antworten, Fix-Welle: 26 Collectors gegen echte Antworten geprüft.
- 2026-11-17 01:50 Frontend fertig (Skizzen H1–H3, Auswahl H3, Umsetzung, 90 automatische Prüfungen).
- 2026-11-17 02:00 Erster Backtest deckt Fehler in der Konvergenz-Schranke auf (95 % der ruhigen Zeit auf Stufe 1). Behoben, dazu schiefe Reihen und Rhythmus-Erkennung.
- 2026-11-17 02:35 Erste Vorschau mit echten Daten übergeben (dist/signal-radar.html). Cyber: Ruhig, Vertrauen 26 %.
