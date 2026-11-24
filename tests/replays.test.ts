import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSignal } from '../src/core/catalog.ts';
import type { Observation, ScenarioDef, SignalDef } from '../src/core/types.ts';
import { computeTimeline, type BacktestResult } from '../src/backtest/lib.ts';
import { buildReplay, fitReplay, judgeSawIt, LEVEL_DE, LEVEL_EN, MAX_BYTES, MAX_SIGNALS_PER_FRAME, type ReplayFrame, summarize } from '../src/backtest/replays.ts';
import { historyObservations } from '../src/backtest/history-adapters.ts';

const H = 3600_000;
const DAY = 24 * H;
const T0 = Date.parse('2026-03-01T00:00:00Z');
const DATA_START = T0 + 10 * DAY;
const EVENT = T0 + 30 * DAY;
const END = EVENT + 6 * DAY;

const scenario: ScenarioDef = {
  id: 'cyber', title: 'Test', question: '?', tagline: '', order: 1,
  domains: { routing: { title: 'R', weight: 1 }, outages: { title: 'O', weight: 1 }, finance: { title: 'F', weight: 1 } },
};
const geo = { lat: 50, lon: 8, label: 'Deutschland', kind: 'country' as const, cc: 'DE' };
function sig(id: string, withGeo = false): SignalDef {
  return normalizeSignal({
    id, name: `Name ${id}`, scenarios: ['cyber'], domain: id.split('.')[1], evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 1,
    manipulability: 'low', intervalMinutes: 60, status: 'active', holdHours: 6, ...(withGeo ? { geo } : {}),
    baseline: { method: 'rolling', windowDays: 7, minPoints: 48 },
  });
}
function hourly(id: string, spikeFrom = Infinity, spikeTo = Infinity): Observation[] {
  const out: Observation[] = [];
  for (let t = DATA_START, i = 0; t <= END; t += H, i++) {
    const noise = 1 + 0.03 * Math.sin(i * 1.7) + 0.02 * Math.cos(i * 0.37);
    out.push({ signalId: id, ts: new Date(t).toISOString(), value: 100 * noise * (t >= spikeFrom && t < spikeTo ? 3 : 1) });
  }
  return out;
}
const signals = [sig('cyber.routing.a', true), sig('cyber.outages.b'), sig('cyber.finance.c')];
const defs = new Map(signals.map((s) => [s.id, s]));

function timeline(spiking: string[]): BacktestResult {
  const raw = new Map(signals.map((s) => [s.id, spiking.includes(s.id) ? hourly(s.id, EVENT, EVENT + 6 * H) : hourly(s.id)]));
  return computeTimeline({ scenario, signals, raw, rules: [], from: EVENT - 6 * DAY, to: END, stepHours: 3, sensitivity: 'high', source: 'synthetic', details: true });
}
const opts = { id: 'x', from: EVENT - 5 * DAY, to: EVENT + 5 * DAY, stepHours: 6, eventStart: new Date(EVENT).toISOString() };

test('replay format: 6-hour frames over ±5 days, signals with data, geo from the definition', () => {
  const r = buildReplay(timeline(['cyber.routing.a', 'cyber.outages.b', 'cyber.finance.c']), defs, opts);
  assert.equal(r.stepHours, 6);
  assert.equal(r.frames.length, 41);
  assert.equal(r.eventStart, new Date(EVENT).toISOString());
  for (let i = 1; i < r.frames.length; i++) assert.equal(Date.parse(r.frames[i].t) - Date.parse(r.frames[i - 1].t), 6 * H);
  assert.ok(r.frames.some((f) => f.t === new Date(EVENT).toISOString()), 'grid anchored at the event start');
  for (const f of r.frames) {
    assert.deepEqual(Object.keys(f).sort(), ['activeDomains', 'attention', 'level', 'signals', 't']);
    assert.ok(f.signals.length <= MAX_SIGNALS_PER_FRAME);
    for (const s of f.signals) {
      assert.equal(typeof s.id, 'string');
      assert.equal(s.name, `Name ${s.id}`);
      assert.ok(s.anomaly >= 0 && s.anomaly <= 1);
      if (s.id === 'cyber.routing.a') assert.deepEqual(s.geo, geo);
      else assert.equal(s.geo, undefined);
    }
  }
  // strongest signal first
  const peak = r.frames.find((f) => f.level > 0)!;
  assert.ok(peak.signals[0].anomaly >= peak.signals[peak.signals.length - 1].anomaly);
});

test('size limit: fewer signals per frame until the file fits', () => {
  const res = timeline([]);
  const big = fitReplay(res, defs, opts);
  assert.ok(Buffer.byteLength(big.json) < MAX_BYTES);
  assert.equal(big.replay.maxSignalsPerFrame, MAX_SIGNALS_PER_FRAME);
  const limit = Buffer.byteLength(JSON.stringify(buildReplay(res, defs, { ...opts, maxSignals: 2 }))) + 1;
  const small = fitReplay(res, defs, opts, limit);
  assert.ok(Buffer.byteLength(small.json) < limit);
  assert.equal(small.replay.maxSignalsPerFrame, 2);
  assert.ok(small.replay.frames.every((f) => f.signals.length <= small.replay.maxSignalsPerFrame));
  assert.throws(() => fitReplay(res, defs, opts, 100));
});

test('sawIt "ja": level rises because measured domains deviate (engine output)', () => {
  const r = buildReplay(timeline(['cyber.routing.a', 'cyber.outages.b', 'cyber.finance.c']), defs, opts);
  const j = judgeSawIt({ frames: r.frames, eventStart: opts.eventStart, eventEnd: new Date(EVENT + 6 * H).toISOString(), expectedDomains: ['routing'] });
  assert.equal(j.sawIt, 'ja');
  assert.ok(j.maxLevel >= 2);
  assert.ok(j.firstLevelHours !== null && j.firstLevelHours >= 0);
  assert.match(summarize(j, { kind: 'event', measuredSignals: 3 }).de, /gestiegen/);
});

const frame = (h: number, over: Partial<ReplayFrame> = {}): ReplayFrame => ({
  t: new Date(EVENT + h * H).toISOString(), level: 0, attention: 0, activeDomains: [], signals: [], ...over,
});
const s = (id: string, domain: string, anomaly: number) => ({ id, name: id, domain, anomaly, z: anomaly ? 5 : 0.1, value: 1 });
const ev = { eventStart: new Date(EVENT).toISOString(), eventEnd: new Date(EVENT + 6 * H).toISOString() };

test('sawIt "teilweise": single measurement in an expected domain, or only attention', () => {
  const frames = [frame(-12, { signals: [s('a', 'routing', 0)] }), frame(0, { signals: [s('a', 'routing', 0.6)] }), frame(6, { signals: [s('a', 'routing', 0.3)] })];
  const j = judgeSawIt({ ...ev, frames, expectedDomains: ['routing'] });
  assert.equal(j.sawIt, 'teilweise');
  assert.equal(j.notable[0].firstHours, 0);
  assert.equal(j.notable[0].anomaly, 0.6);
  const sum = summarize(j, { kind: 'event', measuredSignals: 1 });
  assert.match(sum.de, /auffällig war nur „a“ zum Beginn/);
  assert.match(sum.en, /stood out/);
  // only attention
  const att = judgeSawIt({ ...ev, frames: [frame(0, { attention: 0.5 })] });
  assert.equal(att.sawIt, 'teilweise');
  assert.match(summarize(att, { kind: 'event', measuredSignals: 0 }).de, /Aufmerksamkeit/);
  // a level rise without any active domain is not "ja"
  assert.equal(judgeSawIt({ ...ev, frames: [frame(0, { level: 1, signals: [s('a', 'routing', 0.6)] })], expectedDomains: ['routing'] }).sawIt, 'teilweise');
});

test('sawIt "nein": quiet, wrong domain, weak, or an excursion that began before the window', () => {
  assert.equal(judgeSawIt({ ...ev, frames: [frame(0), frame(6)] }).sawIt, 'nein');
  assert.equal(judgeSawIt({ ...ev, frames: [frame(0, { signals: [s('m', 'markets', 0.9)] })], expectedDomains: ['routing'] }).sawIt, 'nein');
  assert.equal(judgeSawIt({ ...ev, frames: [frame(0, { signals: [s('a', 'routing', 0.2)] })], expectedDomains: ['routing'] }).sawIt, 'nein');
  // began 60 h before the start and is still held at the start: not a reaction to the event (default window 24 h before)
  const held = [frame(-60, { signals: [s('a', 'routing', 0.9)] }), frame(-30, { signals: [s('a', 'routing', 0.7)] }), frame(0, { signals: [s('a', 'routing', 0.5)] })];
  assert.equal(judgeSawIt({ ...ev, frames: held, expectedDomains: ['routing'] }).sawIt, 'nein');
  // with a 72 h window the same excursion counts
  assert.equal(judgeSawIt({ ...ev, frames: held, expectedDomains: ['routing'], preHours: 72, priorNoise: new Map() }).sawIt, 'teilweise');
  // a level rise outside the window does not count
  assert.equal(judgeSawIt({ ...ev, frames: [frame(-100, { level: 2, activeDomains: ['routing', 'outages'] }), frame(0)] }).sawIt, 'nein');
  const sum = summarize(judgeSawIt({ ...ev, frames: [frame(0)] }), { kind: 'control', measuredSignals: 4 });
  assert.match(sum.de, /ruhigen Zeit/);
});

test('level names and grammar', () => {
  assert.deepEqual(LEVEL_DE, ['Ruhig', 'Einzelne Auffälligkeit', 'Mehrere Auffälligkeiten', 'Deutliche Häufung', 'Starke Häufung']);
  assert.deepEqual(LEVEL_EN, ['Calm', 'Single anomaly', 'Several anomalies', 'Clear cluster', 'Strong cluster']);
  const j = judgeSawIt({ ...ev, frames: [frame(0), frame(1, { level: 1, activeDomains: ['routing'], signals: [s('a', 'routing', 0.6), s('b', 'routing', 0.6)] })], expectedDomains: ['routing'] });
  const t = summarize(j, { kind: 'event', measuredSignals: 2 });
  assert.match(t.de, /„Einzelne Auffälligkeit“.*1 Stunde nach Beginn/);
  assert.doesNotMatch(t.de, /1 Stunden/);
  assert.match(t.en, /“Single anomaly”.*1 hour after/);
  assert.equal(j.maxLevel, 1);
  assert.equal(j.firstSeenHours, 1);
});

test('swing before the start counts only if the measurement was quiet in the 4 weeks before', () => {
  const frames = [frame(-23, { signals: [s('a', 'routing', 0.9)] }), frame(0, { level: 1, activeDomains: ['outages'], signals: [s('b', 'outages', 0.6), s('c', 'outages', 0.6)] })];
  const noisy = judgeSawIt({ ...ev, frames, priorNoise: new Map([['a', 18]]) });
  assert.equal(noisy.notable.some((n) => n.id === 'a'), false);
  assert.equal(noisy.preNoise[0].id, 'a');
  assert.equal(noisy.sawIt, 'ja');
  assert.equal(noisy.firstSeenHours, 0);
  assert.match(summarize(noisy, { kind: 'event', measuredSignals: 3 }).de, /Ausschläge davor gab es auch an gewöhnlichen Tagen und zählen nicht als Vorwarnung/);
  const quiet = judgeSawIt({ ...ev, frames, priorNoise: new Map() });
  assert.equal(quiet.notable[0].firstHours, -23);
  assert.equal(quiet.preNoise.length, 0);
  // unknown history: treated as noise
  assert.equal(judgeSawIt({ ...ev, frames }).preNoise.length, 1);
  // a level that was already raised before the start is not "first seen" at the start
  const early = judgeSawIt({ ...ev, frames: [frame(-12, { level: 1, activeDomains: ['routing'] }), frame(0, { level: 1, activeDomains: ['routing'] })] });
  assert.equal(early.firstSeenHours, null);
  assert.equal(early.sawIt, 'nein');
});

test('control windows are never "teilweise": quiet or false alarm', () => {
  const swing = [frame(0, { signals: [s('a', 'routing', 0.6)] })];
  const q = judgeSawIt({ ...ev, frames: swing, control: true });
  assert.equal(q.sawIt, 'nein');
  assert.equal(q.control, 'quiet');
  const sq = summarize(q, { kind: 'control', measuredSignals: 1 });
  assert.match(sq.de, /ruhigen Zeit/);
  assert.doesNotMatch(sq.de, /war nur/);
  const f = judgeSawIt({ ...ev, frames: [frame(0, { level: 1, activeDomains: ['routing'], signals: [s('a', 'routing', 0.6)] })], control: true });
  assert.equal(f.sawIt, 'nein');
  assert.equal(f.control, 'false-alarm');
  assert.match(summarize(f, { kind: 'control', measuredSignals: 1 }).de, /Fehlalarm/);
  assert.match(summarize(f, { kind: 'control', measuredSignals: 1 }).en, /false alarm/);
  assert.equal(judgeSawIt({ ...ev, frames: swing }).control, null);
});

test('weak: a single measurement that also swung before is "teilweise" with a reason', () => {
  const frames = [frame(0, { level: 1, activeDomains: ['routing'], signals: [s('a', 'routing', 0.9)] })];
  const w = judgeSawIt({ ...ev, frames, priorNoise: new Map([['a', 5]]) });
  assert.equal(w.sawIt, 'teilweise');
  assert.equal(w.weak?.id, 'a');
  assert.match(summarize(w, { kind: 'event', measuredSignals: 1 }).de, /einzige Messung.*schwaches Signal/);
  assert.equal(judgeSawIt({ ...ev, frames, priorNoise: new Map() }).sawIt, 'ja');
  const two = [frame(0, { level: 1, activeDomains: ['routing'], signals: [s('a', 'routing', 0.9), s('b', 'routing', 0.9)] })];
  assert.equal(judgeSawIt({ ...ev, frames: two, priorNoise: new Map([['a', 5]]) }).sawIt, 'ja');
});

test('recent replays: whole span is the window, summary without event wording', () => {
  const j = judgeSawIt({ frames: [frame(-200, { signals: [s('a', 'routing', 0.5)] }), frame(0)], eventStart: null, eventEnd: null });
  const sum = summarize(j, { kind: 'recent', measuredSignals: 1, days: 14 });
  assert.equal(j.notable[0].firstHours, null);
  assert.match(sum.de, /letzten 14 Tagen blieb das Radar auf „Ruhig“\. Einzelne Messungen wichen kurz ab; das allein hebt die Stufe nicht\./);
  assert.doesNotMatch(sum.de, /Beginn/);
});

test('history adapters read old fixture names with the full window, only before the anchor day', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sr-adapter-'));
  mkdirSync(join(dir, 'ooni'));
  mkdirSync(join(dir, 'ripe-stat'));
  const days = Array.from({ length: 70 }, (_, i) => new Date(Date.parse('2024-05-01T00:00:00Z') + i * DAY).toISOString().slice(0, 10));
  writeFileSync(join(dir, 'ooni', 'web-connectivity-us-daily.json'), JSON.stringify({
    result: days.map((d) => ({ measurement_start_day: d, anomaly_count: 50, measurement_count: 1000 })),
  }));
  writeFileSync(join(dir, 'ripe-stat', 'country-routing-stats-DE.json'), JSON.stringify({
    data: { stats: days.map((d) => ({ stats_date: `${d}T00:00:00`, v4_prefixes_ris: 100, v6_prefixes_ris: 20 })) },
  }));
  const anchor = new Date('2024-07-01T00:00:00Z');
  const { observations, reports } = historyObservations(dir, anchor);
  const us = observations.filter((o) => o.signalId === 'cyber.outages.ooni_anomaly_share_us');
  assert.equal(us.length, 61, 'all days before the anchor, not only the live 30-day cut');
  assert.equal(us[0].value, 5);
  assert.ok(observations.every((o) => o.ts < '2024-07-01'));
  const ripe = observations.filter((o) => o.signalId === 'cyber.routing.country_prefix_visibility_de');
  assert.equal(ripe.length, 61);
  assert.equal(ripe[0].value, 120);
  assert.deepEqual(reports.find((r) => r.id === 'yahoo-chart')?.files, []);
});

test('exported index and replay files keep the contract (if present)', () => {
  let index: { id: string; kind: string; sawIt?: string; steps: number; control?: string; maxLevel: number; firstSeenHours: number | null; summary_de: string }[];
  try {
    index = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'frontend', 'data', 'replays', 'index.json'), 'utf8'));
  } catch {
    return; // not exported yet
  }
  for (const e of index) {
    if (e.kind === 'recent') assert.ok(!('sawIt' in e), `${e.id}: recent ohne Urteil`);
    else assert.ok(['ja', 'teilweise', 'nein'].includes(e.sawIt!));
    assert.ok(Number.isInteger(e.maxLevel) && e.maxLevel >= 0 && e.maxLevel <= 4, `${e.id}: maxLevel`);
    assert.ok(e.firstSeenHours === null || Number.isFinite(e.firstSeenHours), `${e.id}: firstSeenHours`);
    if (e.kind === 'control') {
      assert.equal(e.sawIt, 'nein', `${e.id}: Kontrolle nie teilweise`);
      assert.equal(e.control, e.maxLevel >= 1 ? 'false-alarm' : 'quiet');
    } else assert.equal(e.control, undefined);
    assert.doesNotMatch(e.summary_de, /Leicht erhöht|Erhöht|Akut|Elevated|\b1 Stunden/, e.id);
    for (const k of ['id', 'title_de', 'title_en', 'date', 'scenario', 'summary_de', 'summary_en', 'steps']) assert.ok(k in e, `${e.id}: ${k}`);
    const raw = readFileSync(join(import.meta.dirname, '..', 'frontend', 'data', 'replays', `${e.id}.json`), 'utf8');
    assert.ok(Buffer.byteLength(raw) < MAX_BYTES, `${e.id} zu groß`);
    const r = JSON.parse(raw);
    for (const k of ['id', 'start', 'end', 'eventStart', 'stepHours', 'frames']) assert.ok(k in r, `${e.id}: ${k}`);
    assert.equal(r.frames.length, e.steps);
    assert.doesNotMatch(raw, /Leicht erhöht|Stark erhöht|Erhöht|Akut|Elevated|Slightly raised/, `${e.id}: alter Stufenname`);
    assert.doesNotMatch(e.summary_en, /Elevated|Slightly raised|Acute/, e.id);
  }
});

test('probe adapter yahoo: close and absolute daily return from one symbol, cut before the anchor day', async () => {
  const { probeObservations } = await import('../src/backtest/history-adapters.ts');
  const dir = mkdtempSync(join(tmpdir(), 'probe-yahoo-'));
  mkdirSync(join(dir, 'yahoo'));
  const day = (d: string) => Date.parse(`${d}T14:30:00Z`) / 1000;
  writeFileSync(join(dir, 'yahoo', 'KRE-6mo-1d.json'), JSON.stringify({ chart: { result: [{ meta: { gmtoffset: -18000 }, timestamp: ['2023-03-07', '2023-03-08', '2023-03-09', '2023-03-10'].map(day), indicators: { quote: [{ close: [100, 102, 94, 90], volume: [1, 1, 1, 1] }] } }] } }));
  const probe = (id: string, metric?: string) => ({ id, template: 't', adapter: 'yahoo' as const, params: metric ? { metric } : {}, name: id, plain: '', sources: [{ fixture: 'yahoo/KRE-6mo-1d.json', url: 'x' }] });
  const { observations, reports } = probeObservations([probe('c'), probe('r', 'abs-return-mean')], dir, new Date('2023-03-10T00:00:00Z'));
  assert.deepEqual(observations.filter((o) => o.signalId === 'c').map((o) => o.value), [100, 102, 94]);
  const r = observations.filter((o) => o.signalId === 'r');
  assert.deepEqual(r.map((o) => o.ts.slice(0, 10)), ['2023-03-08', '2023-03-09']);
  assert.ok(Math.abs(r[1].value - (1 - 94 / 102) * 100) < 1e-9);
  assert.equal(reports[0].file, 'yahoo/KRE-6mo-1d.json');
});
