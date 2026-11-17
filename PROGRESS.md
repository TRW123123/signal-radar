# PROGRESS — Signal Radar

Fortschrittsprotokoll für nahtloses Weiterarbeiten. Neuester Stand oben. Ein neuer Lauf liest diese Datei,
`docs/OPEN-QUESTIONS.md` und `git log` und macht beim ersten offenen Punkt weiter.

## Stand

| Welle | Inhalt | Status |
|---|---|---|
| 0 | Fundament: Schema, Engine, Speicher, CLI, Tests | fertig |
| 1 | Cyber: Signal-Recherche (5 Teil-Domänen, 286 Kandidaten), Prior Art, Szenario-Relevanz | Recherche fertig, Konsolidierung läuft |
| 2 | Cyber: Collectors mit echten Aufzeichnungen | offen |
| 3 | Frontend nach elite-ui-ux, Deploy | Skizzen laufen |
| 4 | Backtesting Cyber | Gerüst fertig (`src/backtest/`, `backtest/REPORT.md`); historische Abrufe offen (`backtest/history-queue.json`) |
| 5+ | Weitere Szenarien: Krieg, Blackout, KI, Finanz, Nuklear, Bio | offen |

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
- **Umgebungs-Grenze:** Die Bau-Umgebung hat keinen freien Internetzugang. Echte Antworten der Quellen werden über ein
  Abruf-Werkzeug einzeln aufgezeichnet (`fixtures/`), Collectors laufen dagegen im Replay. Live-Betrieb braucht einen Deploy.

## Offene Punkte für den Auftraggeber

Siehe `docs/OPEN-QUESTIONS.md`.

## Protokoll

- 2026-11-17 00:45 Start. Kontext aus Supabase (claw.activity_log, hard-rules) gelesen: kein Push und kein Deploy ohne Freigabe; Netlify-Deploy wurde um 00:46 freigegeben.
- 2026-11-17 00:50 Welle 1 gestartet: 5 Recherche-Agents Cyber, Prior Art, Szenario-Relevanz.
- 2026-11-17 01:00 Welle 0 fertig: Engine mit 16 Tests grün, committet.
- 2026-11-17 01:05 Konsolidierung Cyber-Katalog und Frontend-Skizzen gestartet.
- 2026-11-17 Backtest-Gerüst: `src/backtest/{lib,run,evaluate,history-queue}.ts`, `backtest/events.json` (9 historische Ereignisse, 3 aus Sekundärquelle für Nov. 2026, 3 Kontrollen), `backtest/history-queue.json` (59 Abrufe), Tests `tests/backtest.test.ts`. 30-Tage-Replay: 95 % der Zeit außerhalb von Ereignissen Stufe ≥ 1, alles ohne abweichenden Bereich. Engine-Befund: `CONVERGENCE_GATE[0] = 1` lässt unterschwellige Bereiche ungedeckelt durch (nicht geändert, Entscheidung offen).
