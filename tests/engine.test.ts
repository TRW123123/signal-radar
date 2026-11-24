import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSignal } from '../src/core/catalog.ts';
import type { BanalRule, Observation, ScenarioDef, SignalDef } from '../src/core/types.ts';
import { BASELINE_RULES, baselineAt, evaluate, SENSITIVITY } from '../src/engine/anomaly.ts';
import { banalDamp, globMatch } from '../src/engine/banal.ts';
import { levelOf, scoreScenario } from '../src/engine/score.ts';
import { mad, median, noisyOr } from '../src/engine/stats.ts';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const H = 3600_000;

function sig(id: string, over: Partial<SignalDef> = {}): SignalDef {
  return normalizeSignal({
    id, scenarios: ['cyber'], domain: id.split('.')[1], evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.9,
    manipulability: 'low', intervalMinutes: 60, status: 'active', baseline: { method: 'rolling', windowDays: 28, minPoints: 48 },
    ...over,
  });
}

/** hourly series: deterministic noise around `level`, last `spikeHours` hours multiplied by `spike` */
function series(id: string, level: number, spike = 1, spikeHours = 3, days = 20): Observation[] {
  const out: Observation[] = [];
  const n = days * 24;
  for (let i = n; i >= 0; i--) {
    const noise = 1 + 0.03 * Math.sin(i * 1.7) + 0.02 * Math.cos(i * 0.37);
    out.push({ signalId: id, ts: new Date(NOW - i * H).toISOString(), value: level * noise * (i < spikeHours ? spike : 1) });
  }
  return out;
}

const scenario: ScenarioDef = {
  id: 'cyber', order: 1, title: 'Cyber', question: '?', tagline: '',
  domains: { routing: { title: 'R', weight: 1 }, finance: { title: 'F', weight: 1 }, outages: { title: 'O', weight: 1 }, physical: { title: 'P', weight: 1 }, threat: { title: 'T', weight: 1 } },
};

function run(signals: SignalDef[], data: Observation[][], rules: BanalRule[] = [], now = NOW) {
  const map = new Map<string, Observation[]>();
  signals.forEach((s, i) => map.set(s.id, data[i]));
  return scoreScenario({ now, sensitivity: 'high', scenario, signals, series: map, rules });
}

test('stats basics', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.ok(Math.abs(mad([1, 2, 3, 4, 5]) - 1.4826) < 1e-9);
  assert.ok(Math.abs(noisyOr([0.5, 0.5]) - 0.75) < 1e-9);
});

test('baseline uses only the past and is robust against an old incident', () => {
  const s = sig('cyber.routing.x');
  const data = series(s.id, 100);
  data[100].value = 10_000; // old incident inside the window
  const b = baselineAt(s, data, NOW)!;
  assert.ok(Math.abs(b.center - 100) < 5, `center ${b.center}`);
  assert.ok(b.scale < 10, `scale ${b.scale}`);
});

test('a baseline needs at least 7 comparison values (calibration 2026-11-24)', () => {
  assert.equal(BASELINE_RULES.minValues, 7);
  const s = sig('war.conflict.x', { intervalMinutes: 1440, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 } });
  const daily = (n: number) => Array.from({ length: n }, (_, i) => ({ signalId: s.id, ts: new Date(NOW - (n - i) * 24 * H).toISOString(), value: 600 + (i % 3) * 20 }));
  assert.equal(baselineAt(s, daily(6), NOW), null, 'six values are not enough');
  assert.ok(baselineAt(s, daily(7), NOW), 'seven values are');
  // a jump after five days of history cannot raise anything yet
  const young = [...daily(5), { signalId: s.id, ts: new Date(NOW).toISOString(), value: 2000 }];
  assert.equal(evaluate(s, young, NOW, SENSITIVITY.high).anomaly, 0);
});

test('quiet series produces no anomaly', () => {
  const s = sig('cyber.routing.x');
  const r = evaluate(s, series(s.id, 100), NOW, SENSITIVITY.high);
  assert.equal(r.anomaly, 0);
  assert.equal(r.fresh, true);
});

test('spike produces an anomaly, direction is respected', () => {
  const up = sig('cyber.routing.x');
  assert.ok(evaluate(up, series(up.id, 100, 2), NOW, SENSITIVITY.high).anomaly > 0.9);
  // a drop is not an anomaly for an "up" signal, but is for a "down" signal
  assert.equal(evaluate(up, series(up.id, 100, 0.3), NOW, SENSITIVITY.high).anomaly, 0);
  const down = sig('cyber.routing.y', { direction: 'down' });
  assert.ok(evaluate(down, series(down.id, 100, 0.3), NOW, SENSITIVITY.high).anomaly > 0.9);
});

test('stale data never counts', () => {
  const s = sig('cyber.routing.x');
  const old = series(s.id, 100, 3).map((o) => ({ ...o, ts: new Date(Date.parse(o.ts) - 3 * 24 * H).toISOString() }));
  const r = evaluate(s, old, NOW, SENSITIVITY.high);
  assert.equal(r.fresh, false);
  assert.equal(r.anomaly, 0);
});

test('a spike keeps counting during the hold window and decays', () => {
  const s = sig('cyber.routing.x', { holdHours: 12 });
  const data = series(s.id, 100);
  data[data.length - 4].value = 400; // 3 hours ago
  const r = evaluate(s, data, NOW, SENSITIVITY.high);
  assert.ok(r.anomaly > 0.7 && r.anomaly < 1, `anomaly ${r.anomaly}`);
});

test('a single domain cannot push the scenario beyond level 1', () => {
  const a = sig('cyber.routing.a');
  const b = sig('cyber.routing.b', { independenceGroup: 'other' });
  const v = run([a, b], [series(a.id, 100, 5), series(b.id, 50, 5)]);
  assert.equal(v.activeDomains, 1);
  assert.ok(v.level <= 1, `level ${v.level} score ${v.score}`);
});

test('convergence of independent domains raises the level', () => {
  const sigs = [sig('cyber.routing.a'), sig('cyber.finance.a'), sig('cyber.outages.a'), sig('cyber.physical.a')];
  const two = run(sigs, [series(sigs[0].id, 100, 5), series(sigs[1].id, 10, 5), series(sigs[2].id, 7), series(sigs[3].id, 3)]);
  const four = run(sigs, sigs.map((s, i) => series(s.id, 10 * (i + 1), 5)));
  assert.equal(two.activeDomains, 2);
  assert.equal(four.activeDomains, 4);
  assert.ok(two.level >= 2 && two.level < four.level, `two ${two.level} four ${four.level}`);
  assert.equal(four.level, 4);
});

test('quiet world is level 0 with full confidence', () => {
  const sigs = [sig('cyber.routing.a'), sig('cyber.finance.a'), sig('cyber.outages.a')];
  const v = run(sigs, sigs.map((s) => series(s.id, 100)));
  assert.equal(v.level, 0);
  assert.equal(v.score, 0);
  assert.ok(v.confidence > 0.99);
  assert.equal(v.verdict, 'Messwerte im normalen Bereich.');
});

test('signals from the same source count once per domain', () => {
  const a = sig('cyber.routing.a', { independenceGroup: 'ripe', weight: 0.5 });
  const b = sig('cyber.routing.b', { independenceGroup: 'ripe', weight: 0.5 });
  const c = sig('cyber.routing.c', { independenceGroup: 'other', weight: 0.5 });
  const same = run([a, b], [series(a.id, 100, 5), series(b.id, 100, 5)]);
  const indep = run([a, c], [series(a.id, 100, 5), series(c.id, 100, 5)]);
  assert.ok(indep.domains[0].score > same.domains[0].score);
});

test('attention is separate: rumour without measurements is labelled as such', () => {
  const m = sig('cyber.routing.a');
  const d = sig('cyber.attention.wiki', { evidenceClass: 'D', domain: 'attention', weight: 0.7 });
  const m2 = sig('cyber.finance.a');
  const m3 = sig('cyber.outages.a');
  const v = run([m, m2, m3, d], [series(m.id, 100), series(m2.id, 5), series(m3.id, 9), series(d.id, 1000, 6)]);
  assert.equal(v.level, 0);
  assert.ok(v.attention > 0.35, `attention ${v.attention}`);
  assert.equal(v.rumorGap, 'talk-no-data');
  assert.match(v.verdict, /Aufmerksamkeit/);
});

test('official statements (class C) never contribute', () => {
  const c = sig('cyber.routing.statement', { evidenceClass: 'C' });
  const v = run([c], [series(c.id, 1, 50)]);
  assert.equal(v.score, 0);
});

test('banal rule damps and explains', () => {
  const rules: BanalRule[] = [{ id: 'pt', type: 'nth-weekday', appliesTo: ['cyber.vuln.*'], factor: 0.4, reason: 'Patch-Dienstag', params: { weekday: 2, n: 2, spillDays: 1 } }];
  const patchTuesday = Date.parse('2026-11-10T18:00:00Z'); // second Tuesday of November 2026
  assert.deepEqual(banalDamp(rules, 'cyber.vuln.kev', patchTuesday, { latest: () => null }), { factor: 0.4, reason: 'Patch-Dienstag' });
  assert.equal(banalDamp(rules, 'cyber.vuln.kev', patchTuesday + 5 * 24 * H, { latest: () => null }), null);
  assert.equal(banalDamp(rules, 'cyber.routing.x', patchTuesday, { latest: () => null }), null);
  assert.ok(globMatch('cyber.*.gps*', 'cyber.physical.gps_jam'));
  assert.ok(!globMatch('cyber.vuln.*', 'cyberXvuln.a'));
});

test('immature baseline counts half and lowers confidence', () => {
  const s = sig('cyber.routing.a');
  const short = series(s.id, 100, 5, 3, 1); // one day of history, minPoints 48
  const v = run([s], [short]);
  assert.ok(v.confidence <= 0.5);
  assert.ok(v.domains[0].signals[0].contribution < 0.5);
});

test('level thresholds', () => {
  assert.deepEqual([0, 0.12, 0.3, 0.55, 0.78, 1].map(levelOf), [0, 1, 2, 3, 4, 4]);
});

test('fewer than three fed domains means: not enough data to say anything', () => {
  const a = sig('cyber.routing.a');
  const v = run([a], [series(a.id, 100)]);
  assert.match(v.verdict, /zu wenig Messdaten/);
  assert.equal(v.coverage.domainsWithData, 1);
  assert.equal(v.coverage.domainsTotal, 5);
});

test('catalogued but unbuilt signals do not lower confidence', () => {
  const sigs = [sig('cyber.routing.a'), sig('cyber.finance.a'), sig('cyber.outages.a'), sig('cyber.physical.planned', { status: 'planned' })];
  const v = run(sigs, [series(sigs[0].id, 100), series(sigs[1].id, 5), series(sigs[2].id, 9), []]);
  assert.ok(v.confidence > 0.99);
  assert.equal(v.coverage.planned, 1);
});

test('without any deviating domain the scenario stays at level 0, however many small ripples exist', () => {
  // one weak signal per domain, each at full anomaly but below the domain threshold of 0.25
  const doms = ['routing', 'finance', 'outages', 'physical'];
  const sigs = doms.map((d) => sig(`cyber.${d}.w`, { weight: 0.2 }));
  const v = run(sigs, sigs.map((s) => series(s.id, 100, 5)));
  assert.equal(v.activeDomains, 0);
  assert.equal(v.level, 0);
});

test('bursty series: routine bursts widen the scale, only an exceptional burst counts', () => {
  const s = sig('cyber.routing.bursty', { kind: 'count' });
  // base 5 with a routine burst to 80 every 9 hours
  const mk = (last: number): Observation[] => {
    const out: Observation[] = [];
    for (let i = 20 * 24; i >= 0; i--) out.push({ signalId: s.id, ts: new Date(NOW - i * H).toISOString(), value: i % 9 === 4 ? 80 : 5 + (i % 3) });
    out[out.length - 1].value = last;
    return out;
  };
  assert.equal(evaluate(s, mk(80), NOW, SENSITIVITY.high).anomaly, 0, 'routine burst must not count');
  assert.ok(evaluate(s, mk(600), NOW, SENSITIVITY.high).anomaly > 0.9, 'exceptional burst must count');
});

test('a daily series published with a day of delay still counts as current', () => {
  const s = sig('cyber.routing.daily', { intervalMinutes: 60 }); // declared too short on purpose
  const D = 24 * H;
  const data: Observation[] = [];
  for (let i = 40; i >= 1; i--) data.push({ signalId: s.id, ts: new Date(NOW - 12 * H - i * D).toISOString(), value: 100 + (i % 5) });
  data[data.length - 1].value = 400; // latest value: yesterday's, 36 hours old
  const r = evaluate(s, data, NOW, SENSITIVITY.high);
  assert.equal(r.fresh, true);
  assert.ok(r.anomaly > 0.9, `anomaly ${r.anomaly}`);
  // but a daily series whose last value is a week old is stale
  const stale = data.map((o) => ({ ...o, ts: new Date(Date.parse(o.ts) - 7 * D).toISOString() }));
  assert.equal(evaluate(s, stale, NOW, SENSITIVITY.high).fresh, false);
  // unless the source is declared as lagging
  const lagging = sig('cyber.routing.lag', { intervalMinutes: 60, maxAgeHours: 24 * 10 });
  assert.equal(evaluate(lagging, stale.map((o) => ({ ...o, signalId: lagging.id })), NOW, SENSITIVITY.high).fresh, true);
});

test('one shared upstream cannot make two domains count as convergence', () => {
  const a = sig('cyber.routing.a', { upstream: 'bgp-ris' });
  const b = sig('cyber.outages.bgp', { upstream: 'bgp-ris' });
  const c = sig('cyber.finance.a');
  const shared = run([a, b, c], [series(a.id, 100, 5), series(b.id, 50, 5), series(c.id, 10)]);
  assert.equal(shared.activeDomains, 1, 'same upstream in two domains is one piece of evidence');
  const indep = run([a, sig('cyber.outages.ping'), c], [series(a.id, 100, 5), series('cyber.outages.ping', 50, 5), series(c.id, 10)]);
  assert.equal(indep.activeDomains, 2);
  assert.ok(indep.level > shared.level);
});

test('signals sharing an upstream count once inside a domain', () => {
  const a = sig('cyber.threat.list_a', { upstream: 'firehol', weight: 0.5, independenceGroup: 'a' });
  const b = sig('cyber.threat.list_b', { upstream: 'firehol', weight: 0.5, independenceGroup: 'b' });
  const v = run([a, b], [series(a.id, 100, 5), series(b.id, 100, 5)]);
  assert.ok(v.domains.find((d) => d.id === 'threat') === undefined || v.domains[0].score <= 0.5);
});
