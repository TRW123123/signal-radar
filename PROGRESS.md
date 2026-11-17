# PROGRESS — Signal Radar

Fortschrittsprotokoll für nahtloses Weiterarbeiten. Neuester Stand oben. Ein neuer Lauf liest diese Datei,
`docs/OPEN-QUESTIONS.md` und `git log` und macht beim ersten offenen Punkt weiter.

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
