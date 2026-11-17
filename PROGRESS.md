# PROGRESS — Signal Radar

Fortschrittsprotokoll für nahtloses Weiterarbeiten. Neuester Stand oben. Ein neuer Lauf liest diese Datei,
`docs/OPEN-QUESTIONS.md` und `git log` und macht beim ersten offenen Punkt weiter.

## Stand (17.11.2026, 02:40)

| Welle | Inhalt | Status |
|---|---|---|
| 0 | Fundament: Schema, Engine, Speicher, CLI, Tests | fertig |
| 1 | Cyber: Katalog 304 Signale, Quellen-Matrix, Bau-Reihenfolge | fertig |
| 2 | Cyber: 41 Collectors, gegen echte Antworten geprüft bzw. gekennzeichnet (docs/STATUS.md) | fertig, Rest wartet auf Live-Lauf |
| 3 | Frontend nach elite-ui-ux (Konvergenz-Streifen, hell/dunkel), Einzeldatei-Vorschau | fertig; Netlify-Deploy aus der Umgebung blockiert |
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
- **Umgebungs-Grenze:** Die Bau-Umgebung hat keinen freien Internetzugang. Echte Antworten der Quellen werden über ein
  Abruf-Werkzeug einzeln aufgezeichnet (`fixtures/`), Collectors laufen dagegen im Replay. Live-Betrieb braucht einen Deploy.

## Offene Punkte für den Auftraggeber

Siehe `docs/OPEN-QUESTIONS.md`.

## Protokoll

- 2026-11-17 00:45 Start. Netlify-Deploy wurde um 00:46 freigegeben.
- 2026-11-17 00:50 Welle 1 gestartet: 5 Recherche-Agents Cyber, Prior Art, Szenario-Relevanz.
- 2026-11-17 01:00 Welle 0 fertig: Engine mit 16 Tests grün, committet.
- 2026-11-17 01:05 Konsolidierung Cyber-Katalog und Frontend-Skizzen gestartet.
- 2026-11-17 Backtest-Gerüst: `src/backtest/{lib,run,evaluate,history-queue}.ts`, `backtest/events.json` (9 historische Ereignisse, 3 aus Sekundärquelle für Nov. 2026, 3 Kontrollen), `backtest/history-queue.json` (59 Abrufe), Tests `tests/backtest.test.ts`. 30-Tage-Replay: 95 % der Zeit außerhalb von Ereignissen Stufe ≥ 1, alles ohne abweichenden Bereich. Engine-Befund: `CONVERGENCE_GATE[0] = 1` lässt unterschwellige Bereiche ungedeckelt durch (nicht geändert, Entscheidung offen).
- 2026-11-17 01:30 Cyber-Collectors gebaut (aus dem Gedächtnis), erste Aufzeichnung echter Antworten, Fix-Welle: 26 Collectors gegen echte Antworten geprüft.
- 2026-11-17 01:50 Frontend fertig (Skizzen H1–H3, Auswahl H3, Umsetzung, 90 automatische Prüfungen).
- 2026-11-17 02:00 Erster Backtest deckt Fehler in der Konvergenz-Schranke auf (95 % der ruhigen Zeit auf Stufe 1). Behoben, dazu schiefe Reihen und Rhythmus-Erkennung.
- 2026-11-17 02:35 Erste Vorschau mit echten Daten übergeben (dist/signal-radar.html). Cyber: Ruhig, Vertrauen 26 %.
