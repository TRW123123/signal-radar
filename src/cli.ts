#!/usr/bin/env node
// Command line entry.
//   node src/cli.ts run        collect + snapshot
//   node src/cli.ts collect    only collect
//   node src/cli.ts snapshot   only rebuild the snapshot from stored series
// Options: --only id1,id2   --now 2026-11-17T01:00:00Z   --now-from-fixtures   --out path   --data dir
// Env: SR_FIXTURES=replay|record   SR_SENSITIVITY=normal|high   SR_<SERVICE>_KEY=...

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './core/catalog.ts';
import { createHttp } from './core/http.ts';
import { activate, discoverCollectors } from './core/registry.ts';
import { fileStore } from './core/store.ts';
import { runCollectors } from './pipeline/collect.ts';
import { buildSnapshot } from './pipeline/snapshot.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cmd = args[0] ?? 'run';
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const fixturesDir = join(root, 'fixtures');
const fx = process.env.SR_FIXTURES;
const mode = fx === 'replay' ? 'replay' : fx === 'record' ? 'record' : 'network';
let now = opt('now') ? new Date(opt('now')!) : new Date();
if (flag('now-from-fixtures')) {
  const meta = join(fixturesDir, 'META.json');
  if (existsSync(meta)) now = new Date(JSON.parse(readFileSync(meta, 'utf8')).capturedAt);
}
const dataDir = resolve(opt('data') ?? join(root, mode === 'replay' ? 'data-replay' : 'data'));
const out = resolve(opt('out') ?? join(root, 'frontend', 'data', 'snapshot.json'));
const sensitivity = process.env.SR_SENSITIVITY === 'normal' ? 'normal' : 'high';

const store = fileStore(dataDir);
const collectors = await discoverCollectors(root);
const catalog = activate(loadCatalog(root), collectors, process.env);

if (cmd === 'run' || cmd === 'collect') {
  const http = createHttp({ fixturesDir, mode, minHostIntervalMs: mode === 'replay' ? 0 : 1000 });
  const reports = await runCollectors(collectors, store, {
    now, http, env: process.env, only: opt('only')?.split(','), respectIntervals: flag('respect-intervals'), log: (m) => console.error(m),
  });
  for (const r of reports) {
    const state = r.skipped ? `übersprungen (${r.skipped})` : r.ok ? `ok, ${r.observations} Werte, ${r.added} neu` : `FEHLER ${r.error}`;
    console.log(`${r.id.padEnd(34)} ${state}`);
  }
  const failed = reports.filter((r) => !r.ok).length;
  console.log(`\n${reports.length} Collectors, ${failed} Fehler`);
}

if (cmd === 'run' || cmd === 'snapshot') {
  const snap = await buildSnapshot(catalog, store, {
    now, sensitivity, mode: mode === 'replay' ? 'snapshot' : 'live',
    note: mode === 'replay' ? 'Momentaufnahme aus aufgezeichneten echten Antworten der Quellen. Kein Live-Betrieb.' : undefined,
    historyDays: Number(opt('history-days') ?? 14),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snap));
  for (const s of snap.scenarios) {
    console.log(`${s.id.padEnd(10)} Stufe ${s.level} (${s.levelLabel}) score ${s.score} Aufmerksamkeit ${s.attention} Vertrauen ${s.confidence} | ${s.coverage.fresh}/${s.coverage.active} aktiv, ${s.coverage.total} im Katalog | ${s.verdict}`);
  }
  console.log(`Snapshot: ${out}`);
}
