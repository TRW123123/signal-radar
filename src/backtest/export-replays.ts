#!/usr/bin/env node
// Writes the time-machine replays for the frontend from backtest results.
//
//   node src/backtest/export-replays.ts [--results backtest/results] [--out frontend/data/replays] [--data data]
//                                       [--recent-days 14] [--no-recent]
//
// Events and controls: every backtest/results/history-<id>.json (run.ts --history <id>, which stores per-signal
// values) becomes <out>/<id>.json with frames every 6 h from 5 days before to 5 days after the start.
// Recent: the live data in data/series/ is scored for the last 14 days, one file per scenario (recent-<scenario>.json).
// Index: <out>/index.json. Names and places come from the activated catalog (geo is set there).
// Every file stays below MAX_BYTES; if needed, fewer signals per frame are kept (strongest first).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../core/catalog.ts';
import { activate, discoverCollectors } from '../core/registry.ts';
import { fileStore } from '../core/store.ts';
import type { Observation, SignalDef } from '../core/types.ts';
import { type BacktestEvent, type BacktestResult, computeTimeline, DAY, HOUR } from './lib.ts';
import { fitReplay, judgeSawIt, type ReplayIndexEntry, summarize } from './replays.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const resultsDir = resolve(opt('results') ?? join(root, 'backtest', 'results'));
const outDir = resolve(opt('out') ?? join(root, 'frontend', 'data', 'replays'));
const dataDir = resolve(opt('data') ?? join(root, 'data'));
const recentDays = Number(opt('recent-days') ?? 14);
const STEP_HOURS = 6;
const SPAN = 5 * DAY;

/** English titles of the curated events (backtest/events.json carries German titles only) */
const TITLE_EN: Record<string, string> = {
  'crowdstrike-2024-07': 'CrowdStrike Falcon update crashes Windows machines worldwide',
  'facebook-bgp-2021-10': 'Facebook/Meta disappears from the internet (BGP withdrawal, DNS unreachable)',
  'change-healthcare-2024-02': 'Ransomware attack on Change Healthcare (UnitedHealth)',
  'log4shell-2021-12': 'Log4Shell (CVE-2021-44228) goes public and is mass-exploited',
  'moveit-2023-05': 'MOVEit Transfer flaw (CVE-2023-34362), mass exploitation by Cl0p',
  'colonial-pipeline-2021-05': 'Ransomware attack on Colonial Pipeline, pipeline shut down',
  'rogers-2022-07': 'Nationwide Rogers network outage in Canada (incl. Interac)',
  'dyn-ddos-2016-10': 'DDoS attack (Mirai) on DNS provider Dyn',
  'notpetya-2017-06': 'NotPetya wiper attack',
  'control-2019-08': 'Control period August 2019 (no known major event)',
  'control-2023-08': 'Control period August 2023 (no known major event)',
};

/**
 * Hand-written second sentence where a mechanical „teilweise“ would overstate what the data shows. Only facts that
 * hold regardless of the run: what the notable measurement measures, not a guess about the cause.
 */
const NOTE: Record<string, { de: string; en: string }> = {
  'crowdstrike-2024-07': {
    de: 'Der VIX misst die Unruhe an der ganzen US-Börse und war schon am Vortag gestiegen; einen Bezug zum Ausfall belegt er nicht.',
    en: 'The VIX measures unrest across the whole US stock market and had already risen the day before; it does not show a link to the outage.',
  },
  'control-2019-08': {
    de: 'In einer Vergleichszeit ohne bekanntes Cyber-Ereignis ist das ein Ausschlag ohne Bezug, die Stufe blieb trotzdem ruhig.',
    en: 'In a comparison period without a known cyber event this is an unrelated swing; the level still stayed calm.',
  },
};

const collectors = await discoverCollectors(root);
const catalog = activate(loadCatalog(root), collectors, process.env);
const defs = new Map<string, SignalDef>(catalog.signals.map((s) => [s.id, s]));
const events = JSON.parse(readFileSync(join(root, 'backtest', 'events.json'), 'utf8')) as BacktestEvent[];
mkdirSync(outDir, { recursive: true });
const index: ReplayIndexEntry[] = [];
const written: string[] = [];

// ---------------------------------------------------------------- events and controls
for (const f of readdirSync(resultsDir).filter((x) => /^history-.+\.json$/.test(x) && !x.endsWith('.eval.json')).sort()) {
  const res = JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as BacktestResult;
  if (res.schema !== 'backtest-result/1') continue;
  const id = f.slice('history-'.length, -'.json'.length);
  const ev = events.find((e) => e.id === id);
  if (!ev) { console.error(`${f}: Ereignis ${id} nicht in backtest/events.json, übersprungen`); continue; }
  if (!res.steps.some((s) => s.v)) { console.error(`${f}: ohne Signalwerte (run.ts --history ${id} neu laufen lassen), übersprungen`); continue; }
  const start = Date.parse(ev.start);
  const { replay, json } = fitReplay(res, defs, { id, from: start - SPAN, to: start + SPAN, stepHours: STEP_HOURS, eventStart: ev.start });
  writeFileSync(join(outDir, `${id}.json`), json);
  written.push(`${id}.json`);
  const j = judgeSawIt({ frames: replay.frames, eventStart: ev.start, eventEnd: ev.end, expectedDomains: ev.kind === 'event' ? ev.expectedDomains : [] });
  const measured = new Set(replay.frames.flatMap((fr) => fr.signals.map((s) => s.id))).size;
  const s = summarize(j, { kind: ev.kind, measuredSignals: measured, note: NOTE[id] });
  index.push({
    id, kind: ev.kind, title_de: ev.title, title_en: TITLE_EN[id] ?? ev.title, date: ev.start, scenario: res.scenario,
    summary_de: s.de, summary_en: s.en, sawIt: j.sawIt, steps: replay.frames.length,
  });
  console.log(`${id.padEnd(28)} ${j.sawIt.padEnd(10)} ${replay.frames.length} Frames, ${measured} Signale, ${(json.length / 1000).toFixed(1)} kB`);
}

// ---------------------------------------------------------------- recent live data
if (!args.includes('--no-recent')) {
  if (!existsSync(join(dataDir, 'series'))) {
    console.error(`${relative(root, dataDir)}/series fehlt, keine recent-Wiedergaben`);
  } else {
    const store = fileStore(dataDir);
    const raw = new Map<string, Observation[]>();
    let latest = 0;
    for (const s of catalog.signals) {
      if (s.status !== 'active') continue;
      const obs = await store.read(s.id);
      raw.set(s.id, obs);
      for (const o of obs) latest = Math.max(latest, Date.parse(o.ts));
    }
    const to = Math.floor(latest / HOUR) * HOUR;
    const step = STEP_HOURS * HOUR;
    const from = to - Math.floor((recentDays * DAY) / step) * step;
    const sensitivity = process.env.SR_SENSITIVITY === 'normal' ? 'normal' : 'high';
    for (const scenario of catalog.scenarios) {
      const res = computeTimeline({
        scenario, signals: catalog.signals, raw, rules: catalog.rules, from, to, stepHours: STEP_HOURS, sensitivity,
        source: `data:${relative(root, dataDir) || dataDir}`, details: true,
      });
      const id = `recent-${scenario.id}`;
      const { replay, json } = fitReplay(res, defs, { id, from, to, stepHours: STEP_HOURS, eventStart: null });
      writeFileSync(join(outDir, `${id}.json`), json);
      written.push(`${id}.json`);
      const j = judgeSawIt({ frames: replay.frames, eventStart: null, eventEnd: null });
      const measured = new Set(replay.frames.flatMap((fr) => fr.signals.map((x) => x.id))).size;
      const s = summarize(j, { kind: 'recent', measuredSignals: measured, days: recentDays });
      index.push({
        id, kind: 'recent', title_de: `Letzte ${recentDays} Tage: ${scenario.title}`, title_en: `Last ${recentDays} days: ${scenario.id}`,
        date: new Date(to).toISOString(), scenario: scenario.id, summary_de: s.de, summary_en: s.en, sawIt: j.sawIt, steps: replay.frames.length,
      });
      console.log(`${id.padEnd(28)} ${j.sawIt.padEnd(10)} ${replay.frames.length} Frames, ${measured} Signale, max ${replay.maxSignalsPerFrame}/Frame, ${(json.length / 1000).toFixed(1)} kB`);
    }
  }
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`${written.length} Wiedergaben und index.json -> ${relative(root, outDir)}`);
