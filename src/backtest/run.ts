#!/usr/bin/env node
// Backtest runner: recomputes the scenario value at past points in time, using at every step only data up to
// that step (same rule as the history in buildSnapshot), and writes a result file for evaluate.ts.
//
//   node src/backtest/run.ts [--scenario cyber] [--data <dir>] [--from ISO] [--to ISO] [--step-hours 3]
//                            [--out backtest/results/<name>.json] [--history <event-id>] [--as-stamped]
//
// Data:
//   --data <dir>          use an existing data directory (series/*.jsonl), e.g. data/ from live operation
//   (default)             fresh replay of all collectors against fixtures/ into a temporary directory,
//                         now = capture time from fixtures/META.json
//   --history <event-id>  run only the history-capable collectors at the event's anchor time against
//                         fixtures/backtest/<event-id>/ (filled from backtest/history-queue.json), plus the
//                         datasets whose current file carries their full history (CISA KEV, CISA ICS)
// Defaults: --to = capture time (replay) or max(event end + 1 day, start + 5 days), capped at the anchor (history)
//           or latest observation (--data);
//           --from = to - 30 days (replay/data) or event start - 21 days (history).
// --as-stamped: use stored timestamps as they are (like the dashboard history). Default: daily values stamped
//   00:00 UTC become visible only at the end of their day (no look-ahead into a day that has not ended yet).
// --details: store value, z and anomaly per fresh signal and step (always on with --history; needed by export-replays.ts)
// History runs read OONI, Yahoo and RIPEstat through history-adapters.ts (old fixture names, full window) and drop
// values of datasets from before they existed (CISA KEV before 2021-11-03).
// Env: SR_SENSITIVITY=normal|high (default high, as cli.ts)

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../core/catalog.ts';
import { createHttp, fixtureName } from '../core/http.ts';
import { activate, discoverCollectors } from '../core/registry.ts';
import { fileStore } from '../core/store.ts';
import type { HttpClient, HttpInit, Observation } from '../core/types.ts';
import { runCollectors } from '../pipeline/collect.ts';
import { ADAPTED_COLLECTORS, historyObservations, probeObservations, probeSignalDefs, probesOf, SOURCE_SINCE } from './history-adapters.ts';
import { type BacktestEvent, computeTimeline, DAY, FULL_HISTORY_COLLECTORS, historyAnchor } from './lib.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** read-only HTTP client that serves fixtures from the first directory that has them */
function layeredReplay(dirs: string[]): HttpClient {
  const raw = async (url: string, init?: HttpInit) => {
    const name = fixtureName(url, init);
    for (const d of dirs) {
      const f = join(d, name);
      if (existsSync(f)) return readFileSync(f, 'utf8');
    }
    throw new Error(`fixture missing: ${name} (url ${url})`);
  };
  return {
    text: raw,
    async json<T>(url: string, init?: HttpInit) {
      return JSON.parse(await raw(url, init)) as T;
    },
  };
}

const historyId = opt('history');
const fixturesDirEarly = join(root, 'fixtures');
const allEvents = JSON.parse(readFileSync(join(root, 'backtest', 'events.json'), 'utf8')) as BacktestEvent[];
const historyEvent = historyId ? allEvents.find((e) => e.id === historyId) : undefined;
if (historyId && !historyEvent) throw new Error(`Ereignis ${historyId} nicht in backtest/events.json`);
const scenarioId = opt('scenario') ?? historyEvent?.scenario ?? 'cyber';
const stepHours = Number(opt('step-hours') ?? 3);
const sensitivity = process.env.SR_SENSITIVITY === 'normal' ? 'normal' : 'high';

const collectors = await discoverCollectors(root);
const catalog = activate(loadCatalog(root), collectors, process.env);
const scenario = catalog.scenarios.find((s) => s.id === scenarioId);
if (!scenario) throw new Error(`Szenario ${scenarioId} nicht im Katalog`);

const fixturesDir = join(root, 'fixtures');
const capturedAt = (() => {
  const meta = join(fixturesDir, 'META.json');
  return existsSync(meta) ? new Date(JSON.parse(readFileSync(meta, 'utf8')).capturedAt) : null;
})();

let dataDir: string;
let source: string;
let defaultTo: number | null = null;
let defaultFrom: number | null = null;

if (opt('data')) {
  dataDir = resolve(opt('data')!);
  source = `data:${relative(root, dataDir) || dataDir}`;
} else if (historyId) {
  const ev = historyEvent!;
  // event-specific probes (also borrowed by controls via probesFrom); their signals join the catalog for this run
  const { probes, dir: probeDir } = probesOf(ev, allEvents, fixturesDirEarly);
  const probeIds = new Set(probes.map((p) => p.id));
  catalog.signals.push(...probeSignalDefs(probes, catalog.signals));
  const queueFile = join(root, 'backtest', 'history-queue.json');
  const queue = existsSync(queueFile) ? (JSON.parse(readFileSync(queueFile, 'utf8')) as { event: string; signal: string }[]) : [];
  const sigToCollector = new Map(catalog.signals.map((s) => [s.id, s.collector]));
  const only = [...new Set([...queue.filter((q) => q.event === historyId && !probeIds.has(q.signal)).map((q) => sigToCollector.get(q.signal) ?? ''), ...FULL_HISTORY_COLLECTORS])].filter(Boolean);
  // controls with probesFrom read the fixtures of their event (cut at their own, earlier anchor)
  const evDir = ev.probesFrom ? probeDir : join(fixturesDir, 'backtest', historyId);
  const anchor = historyAnchor(ev);
  dataDir = mkdtempSync(join(tmpdir(), `sr-backtest-${historyId}-`));
  // per-event fixtures first; the main fixtures only for datasets that carry their full history
  const http = layeredReplay([evDir]);
  const httpFull = layeredReplay([evDir, fixturesDir]);
  const store = fileStore(dataDir);
  // OONI, Yahoo and RIPEstat are read by history-adapters.ts (old fixture names, full window instead of the live cut)
  const adapted = historyObservations(evDir, anchor);
  await store.append(adapted.observations);
  const probed = probeObservations(probes, probeDir, anchor);
  await store.append(probed.observations);
  for (const r of probed.reports) console.error(`${('Probe ' + r.id).padEnd(52)} ${r.file ? `ok, ${r.observations} Werte aus ${r.file}` : 'keine Daten'}${r.notes.length && !r.file ? `; ${r.notes.join('; ')}` : ''}`);
  for (const r of adapted.reports) console.error(`${(r.id + ' (Adapter)').padEnd(28)} ${r.files.length ? `ok, ${r.observations} Werte aus ${r.files.length} Datei(en)` : 'keine Datei'}${r.notes.length ? `; ${r.notes.join('; ')}` : ''}`);
  const reports = [
    ...await runCollectors(collectors.filter((c) => !FULL_HISTORY_COLLECTORS.includes(c.id) && !ADAPTED_COLLECTORS.includes(c.id)), store, { now: anchor, http, env: process.env, only, log: () => {} }),
    ...await runCollectors(collectors.filter((c) => FULL_HISTORY_COLLECTORS.includes(c.id)), store, { now: anchor, http: httpFull, env: process.env, only, log: () => {} }),
  ];
  for (const r of reports) console.error(`${r.id.padEnd(28)} ${r.ok ? `ok, ${r.observations} Werte` : `FEHLER ${r.error}`}`);
  if (!existsSync(evDir)) console.error(`Hinweis: ${relative(root, evDir)} fehlt noch; nur Datensätze mit voller Historie im Fixture verfügbar.`);
  source = `history:${historyId} (anchor ${anchor.toISOString()})`;
  // at least 5 days after the start (replay window of export-replays.ts), never past the anchor (no data after it)
  defaultTo = Math.min(Math.max(Date.parse(ev.end) + DAY, Date.parse(ev.start) + 5 * DAY), anchor.getTime());
  defaultFrom = Date.parse(ev.start) - 21 * DAY;
} else {
  if (!capturedAt) throw new Error('fixtures/META.json fehlt; ohne Aufzeichnungszeitpunkt kein Replay');
  dataDir = mkdtempSync(join(tmpdir(), 'sr-backtest-replay-'));
  const store = fileStore(dataDir);
  // same seeding as cli.ts, so that the replay sees what the dashboard sees
  const seedDir = join(root, 'data-seed');
  if (existsSync(seedDir)) {
    for (const f of readdirSync(seedDir).filter((x) => x.endsWith('.jsonl'))) {
      const id = f.slice(0, -6);
      const obs = readFileSync(join(seedDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { t: string; v: number })
        .map((l) => ({ signalId: id, ts: l.t, value: l.v }));
      await store.append(obs);
    }
  }
  const http = createHttp({ fixturesDir, mode: 'replay', minHostIntervalMs: 0 });
  const reports = await runCollectors(collectors, store, { now: capturedAt, http, env: process.env, log: () => {} });
  const failed = reports.filter((r) => !r.ok);
  console.error(`Replay: ${reports.length} Collectors, ${failed.length} Fehler, ${reports.filter((r) => r.skipped).length} übersprungen (Daten: ${dataDir})`);
  source = `replay:fixtures@${capturedAt.toISOString()}`;
  defaultTo = capturedAt.getTime();
}

const store = fileStore(dataDir);
const raw = new Map<string, Observation[]>();
let latest = 0;
for (const s of catalog.signals) {
  if (s.status !== 'active') continue;
  let obs = await store.read(s.id);
  const since = historyId ? SOURCE_SINCE[s.collector] : undefined;
  if (since) obs = obs.filter((o) => o.ts >= since);
  raw.set(s.id, obs);
  for (const o of obs) latest = Math.max(latest, Date.parse(o.ts));
}

const to = opt('to') ? Date.parse(opt('to')!) : defaultTo ?? latest;
const from = opt('from') ? Date.parse(opt('from')!) : defaultFrom ?? to - 30 * DAY;
if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error(`ungültiger Zeitraum ${opt('from')} bis ${opt('to')}`);
// align steps to the step grid ending at `to`, so that the last step is exactly `to`
const step = stepHours * 3600_000;
const alignedFrom = to - Math.floor((to - from) / step) * step;

const result = computeTimeline({
  scenario, signals: catalog.signals, raw, rules: catalog.rules, from: alignedFrom, to, stepHours, sensitivity, source,
  availability: args.includes('--as-stamped') ? 'as-stamped' : 'end-of-day',
  // per-signal values for the frontend replays (export-replays.ts); small for history runs, opt-in otherwise
  details: Boolean(historyId) || args.includes('--details'),
});

const name = historyId ? `history-${historyId}` : `${scenarioId}-${new Date(alignedFrom).toISOString().slice(0, 10)}_${new Date(to).toISOString().slice(0, 10)}`;
const out = resolve(opt('out') ?? join(root, 'backtest', 'results', `${name}.json`));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result));
const lc = result.summary.levelCounts;
console.log(`${result.steps.length} Zeitschritte ${result.from} bis ${result.to} (alle ${stepHours} h), Quelle ${source}`);
console.log(`Signale mit Daten: ${result.summary.signalsWithDataEver}/${result.signals.length}, Bereiche mit Daten: ${result.summary.domainsWithDataEver}/${result.domains.length}, Schritte mit >= 3 Bereichen: ${result.summary.stepsWithMinDomains}`);
console.log(`Stufen 0-4: ${lc.join(' / ')}`);
console.log(`Ergebnis: ${relative(root, out)}`);
