import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSignal } from '../src/core/catalog.ts';
import type { Observation, ScenarioDef, SignalDef } from '../src/core/types.ts';
import { type BacktestEvent, computeTimeline, evaluateResults, historyAnchor, shiftToAvailability } from '../src/backtest/lib.ts';

const H = 3600_000;
const DAY = 24 * H;
const T0 = Date.parse('2026-03-01T00:00:00Z');
/** data starts 40 days after T0; the event happens on day 60 at 12:00 */
const DATA_START = T0 + 40 * DAY;
const EVENT = T0 + 60 * DAY + 12 * H;
const END = T0 + 64 * DAY;

const scenario: ScenarioDef = {
  id: 'cyber', title: 'Test', question: '?', tagline: '', order: 1,
  domains: { routing: { title: 'R', weight: 1 }, outages: { title: 'O', weight: 1 }, finance: { title: 'F', weight: 1 }, services: { title: 'S', weight: 1 } },
};

function sig(id: string): SignalDef {
  return normalizeSignal({
    id, scenarios: ['cyber'], domain: id.split('.')[1], evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 1,
    manipulability: 'low', intervalMinutes: 60, status: 'active', holdHours: 6,
    baseline: { method: 'rolling', windowDays: 7, minPoints: 48 },
  });
}

/** hourly series with deterministic small noise; from `spikeFrom` to `spikeTo` the value is multiplied by 3 */
function hourly(id: string, spikeFrom = Infinity, spikeTo = Infinity): Observation[] {
  const out: Observation[] = [];
  for (let t = DATA_START, i = 0; t <= END; t += H, i++) {
    const noise = 1 + 0.03 * Math.sin(i * 1.7) + 0.02 * Math.cos(i * 0.37);
    out.push({ signalId: id, ts: new Date(t).toISOString(), value: 100 * noise * (t >= spikeFrom && t < spikeTo ? 3 : 1) });
  }
  return out;
}

const signals = ['cyber.routing.a', 'cyber.outages.b', 'cyber.finance.c', 'cyber.services.d'].map(sig);
// precursor: three domains jump 6 hours before the event start and stay up for 12 hours
const raw = new Map<string, Observation[]>([
  ['cyber.routing.a', hourly('cyber.routing.a', EVENT - 6 * H, EVENT + 6 * H)],
  ['cyber.outages.b', hourly('cyber.outages.b', EVENT - 6 * H, EVENT + 6 * H)],
  ['cyber.finance.c', hourly('cyber.finance.c', EVENT - 6 * H, EVENT + 6 * H)],
  ['cyber.services.d', hourly('cyber.services.d')],
]);

const result = computeTimeline({
  scenario, signals, raw, rules: [], from: T0, to: END, stepHours: 3, sensitivity: 'high', source: 'synthetic',
});

const events: BacktestEvent[] = [
  { id: 'ev', title: 'Konvergenz', start: new Date(EVENT).toISOString(), end: new Date(EVENT + 6 * H).toISOString(), kind: 'event', expectedDomains: ['routing', 'outages', 'finance'], sources: ['synthetisch'] },
  { id: 'ctl', title: 'Ruhe', start: new Date(DATA_START + 10 * DAY).toISOString(), end: new Date(DATA_START + 17 * DAY).toISOString(), kind: 'control', expectedDomains: [], sources: ['synthetisch'] },
  // inside the timeline, but before any data exists
  { id: 'nodata', title: 'Ohne Daten', start: new Date(T0 + 10 * DAY).toISOString(), end: new Date(T0 + 11 * DAY).toISOString(), kind: 'event', expectedDomains: ['routing'], sources: ['synthetisch'] },
];
const ev = evaluateResults([{ file: 'synthetic.json', result }], events);

test('timeline only uses data up to each step and reports coverage', () => {
  assert.equal(result.steps.length, 64 * 8 + 1);
  const before = result.steps.find((s) => Date.parse(s.t) === EVENT - 9 * H)!;
  assert.equal(before.level, 0, 'nothing visible before the spike starts');
  const early = result.steps.find((s) => Date.parse(s.t) === T0 + 10 * DAY)!;
  assert.equal(early.signalsWithData, 0);
  assert.deepEqual(early.dataDomains, []);
  const late = result.steps[result.steps.length - 1];
  assert.equal(late.signalsWithData, 4);
  assert.equal(late.dataDomains.length, 4);
});

test('an event with convergence in three domains is detected with the correct lead time', () => {
  const e = ev.events.find((x) => x.id === 'ev')!;
  assert.equal(e.covered, true);
  assert.equal(e.outcome, 'erkannt');
  assert.equal(e.maxLevel, 3, 'three converging domains cap at level 3');
  assert.equal(e.leadL1Hours, -6);
  assert.equal(e.leadL2Hours, -6);
  assert.deepEqual(e.firedDomains, ['finance', 'outages', 'routing']);
  assert.deepEqual(e.expectedHit, ['routing', 'outages', 'finance']);
  const step = result.steps.find((s) => Date.parse(s.t) === EVENT - 6 * H)!;
  assert.ok(step.triggers && step.triggers.length === 3, 'triggering signals are recorded from level 1 on');
});

test('a quiet control period stays calm', () => {
  const c = ev.controls.find((x) => x.id === 'ctl')!;
  assert.equal(c.covered, true);
  assert.equal(c.shareL1, 0);
  assert.equal(c.shareL2, 0);
  assert.equal(c.outcome, 'ruhig');
  assert.equal(ev.outside.shareL1Covered, 0);
  assert.ok(ev.noise.every((n) => n.excursions === 0), 'no signal is loud outside of the event');
});

test('an event without data is not testable instead of missed', () => {
  const e = ev.events.find((x) => x.id === 'nodata')!;
  assert.equal(e.covered, false);
  assert.equal(e.outcome, 'nicht prüfbar');
  assert.equal(e.domainsWithDataMax, 0);
});

test('daily values become visible at the end of their day; anchor lies after the event', () => {
  const daily = normalizeSignal({ id: 'cyber.finance.x', intervalMinutes: 1440, status: 'active' });
  const s = shiftToAvailability(daily, [
    { signalId: 'cyber.finance.x', ts: '2026-01-05T00:00:00.000Z', value: 1 },
    { signalId: 'cyber.finance.x', ts: '2026-01-05T13:00:00.000Z', value: 2 },
  ]);
  assert.equal(s[0].ts, '2026-01-06T00:00:00.000Z');
  assert.equal(s[1].ts, '2026-01-05T13:00:00.000Z');
  assert.equal(historyAnchor({ end: '2024-07-21T23:59:00Z' }).toISOString(), '2024-07-25T00:00:00.000Z');
});
