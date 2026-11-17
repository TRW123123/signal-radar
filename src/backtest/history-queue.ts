#!/usr/bin/env node
// Builds backtest/history-queue.json: the concrete historical fetches that would make the old events in
// backtest/events.json testable. Each entry is fetched once by the central capture agent and saved under
// fixtures/<fixture>; `node src/backtest/run.ts --history <event>` then replays the collectors at the event's
// anchor time against exactly these files.
//
//   node src/backtest/history-queue.ts [--max 60]
//
// How URL and parser are kept in step: every collector is run once at the anchor time with a recording HTTP
// client. Only fixture names the collector really asks for are queued, so the replay finds them. Where the
// collector's own URL cannot address the past (Yahoo range=6mo, NY Fed last/60) or would exceed the size limit
// (RIPEstat 75 days), the URL is rewritten to an equivalent past-capable form of the same API with the same
// response schema; the collector still reads it under its own fixture name.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureName } from '../core/http.ts';
import { discoverCollectors } from '../core/registry.ts';
import type { Collector, HttpClient, HttpInit } from '../core/types.ts';
import { type BacktestEvent, DAY, historyAnchor } from './lib.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 60;

interface QueueEntry { fixture: string; url: string; maxChars: number; signal: string; event: string }

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const unix = (t: number) => Math.floor(t / 1000);

async function recordedRequests(c: Collector, now: Date): Promise<{ url: string; fixture: string }[]> {
  const seen: { url: string; fixture: string }[] = [];
  const raw = async (url: string, init?: HttpInit): Promise<never> => {
    seen.push({ url, fixture: fixtureName(url, init) });
    throw new Error('recording only');
  };
  const http: HttpClient = { text: raw, json: raw };
  try {
    await c.collect({ now, http, key: () => 'recording', log: () => {} });
  } catch { /* expected: every request fails */ }
  return seen;
}

interface Spec {
  tier: number;
  collector: string;
  /** fixture name the collector asks for */
  fixture: string;
  signal: string;
  maxChars: number;
  /** entries of one group are only useful together (all or none) */
  group?: string;
  /** earliest event start for which the source has the needed history (look-back included) */
  minStart?: string;
  /** only for events whose expected domains intersect these (empty = all) */
  forDomains?: string[];
  url: (anchor: number, recorded: string) => string;
}

const SPECS: Spec[] = [
  {
    // only scored finance source with deep history; SOFR is published since 2018-04-02
    tier: 1, collector: 'nyfed-markets', fixture: 'nyfed/sofr-last60.json', signal: 'cyber.finance.sofr_tail', maxChars: 20000, minStart: '2018-07-01',
    url: (a) => `https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=${isoDay(a - 80 * DAY)}&endDate=${isoDay(a - DAY)}`,
  },
  {
    tier: 1, collector: 'yahoo-chart', fixture: 'yahoo/VIX-6mo-1d.json', signal: 'cyber.markets.vix', maxChars: 20000,
    url: (a) => `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?period1=${unix(a - 100 * DAY)}&period2=${unix(a)}&interval=1d`,
  },
  {
    // 75 days came to ~19 000 characters in 2026; 66 days stay safely below 20 000 and still cover the 56-day baseline
    tier: 1, collector: 'ripe-stat', fixture: 'ripe-stat/country-routing-stats-DE.json', signal: 'cyber.routing.country_prefix_visibility_de', maxChars: 20000,
    url: (a, rec) => rec.replace(/starttime=\d{4}-\d{2}-\d{2}/, `starttime=${isoDay(a - 66 * DAY)}`),
  },
  {
    tier: 1, collector: 'ooni', fixture: 'ooni/web-connectivity-us-daily.json', signal: 'cyber.outages.ooni_anomaly_share_us', maxChars: 20000, minStart: '2016-06-01',
    url: (_a, rec) => rec,
  },
  {
    // Item 1.05 exists since 2023-12-18; earlier windows would only show zeros
    tier: 2, collector: 'sec-edgar', fixture: 'sec-edgar/item105-0.json', signal: 'cyber.services.sec_8k_item105_daily_count', maxChars: 20000, minStart: '2024-01-15',
    url: (_a, rec) => rec,
  },
  {
    tier: 3, collector: 'tor-metrics', fixture: 'tor-metrics/bandwidth.csv', signal: 'cyber.outages.tor_advertised_bandwidth', maxChars: 8000,
    forDomains: ['outages', 'routing', 'dns_core'], url: (_a, rec) => rec,
  },
  {
    tier: 3, collector: 'ooni', fixture: 'ooni/web-connectivity-de-daily.json', signal: 'cyber.outages.ooni_anomaly_share_de', maxChars: 20000, minStart: '2016-06-01',
    forDomains: ['outages', 'routing', 'dns_core'], url: (_a, rec) => rec,
  },
  // the cyber-ETF signals need all three funds; BUG trades since October 2019
  ...['CIBR', 'HACK', 'BUG'].map((sym): Spec => ({
    tier: 4, group: 'cyber-etf', collector: 'yahoo-chart', fixture: `yahoo/${sym}-6mo-1d.json`, signal: 'cyber.markets.cyber_etf_volume', maxChars: 20000, minStart: '2020-03-01',
    url: (a) => `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${unix(a - 100 * DAY)}&period2=${unix(a)}&interval=1d`,
  })),
];

const events = JSON.parse(readFileSync(join(root, 'backtest', 'events.json'), 'utf8')) as BacktestEvent[];
// recent events are covered by the normal fixtures; only the past needs extra fetches
const capturedAt = Date.parse(JSON.parse(readFileSync(join(root, 'fixtures', 'META.json'), 'utf8')).capturedAt);
const past = events.filter((e) => Date.parse(e.start) < capturedAt - 60 * DAY);
const collectors = new Map((await discoverCollectors(root)).map((c) => [c.id, c]));

const candidates: (QueueEntry & { tier: number; order: number; group?: string })[] = [];
for (const [order, ev] of past.entries()) {
  const anchor = historyAnchor(ev).getTime();
  const recorded = new Map<string, { url: string; fixture: string }[]>();
  for (const spec of SPECS) {
    if (spec.minStart && Date.parse(ev.start) < Date.parse(spec.minStart)) continue;
    if (spec.forDomains && ev.kind === 'event' && !ev.expectedDomains.some((d) => spec.forDomains!.includes(d))) continue;
    if (spec.forDomains && ev.kind === 'control') continue;
    const c = collectors.get(spec.collector);
    if (!c) continue;
    if (!recorded.has(c.id)) recorded.set(c.id, await recordedRequests(c, new Date(anchor)));
    const rec = recorded.get(c.id)!.find((r) => r.fixture === spec.fixture);
    if (!rec) throw new Error(`${c.id} fragt ${spec.fixture} nicht an; Queue und Collector passen nicht zusammen`);
    candidates.push({
      fixture: `backtest/${ev.id}/${spec.fixture}`, url: spec.url(anchor, rec.url), maxChars: spec.maxChars, signal: spec.signal, event: ev.id,
      // events before controls inside a tier; events keep the curated order (most valuable first)
      tier: spec.tier * 10 + (ev.kind === 'control' ? 5 : 0), order, group: spec.group ? `${ev.id}:${spec.group}` : undefined,
    });
  }
}
candidates.sort((a, b) => a.tier - b.tier || a.order - b.order);
// take entries in priority order; a group is taken only as a whole
const picked: typeof candidates = [];
const skipped: typeof candidates = [];
const done = new Set<string>();
for (const c of candidates) {
  if (c.group) {
    if (done.has(c.group)) continue;
    done.add(c.group);
    const members = candidates.filter((x) => x.group === c.group);
    if (picked.length + members.length <= MAX) picked.push(...members);
    else skipped.push(...members);
  } else if (picked.length < MAX) picked.push(c);
  else skipped.push(c);
}
const queue: QueueEntry[] = picked.map(({ tier: _t, order: _o, group: _g, ...q }) => q);
writeFileSync(join(root, 'backtest', 'history-queue.json'), JSON.stringify(queue, null, 2) + '\n');
console.log(`${queue.length} Abrufe (von ${candidates.length} möglichen) für ${new Set(queue.map((q) => q.event)).size} Zeiträume -> backtest/history-queue.json`);
if (skipped.length) console.log(`weggelassen: ${skipped.map((c) => `${c.event}:${c.fixture.split('/').slice(2).join('/')}`).join(', ')}`);
