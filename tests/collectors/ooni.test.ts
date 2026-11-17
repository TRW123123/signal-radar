import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, buildUrl, fixtureName, COUNTRIES as ALL_COUNTRIES, DEFAULT_WINDOW_DAYS } from '../../src/collectors/ooni.ts';
const COUNTRIES = ALL_COUNTRIES.filter((c) => c.signalId.startsWith('cyber.'));
const WAR_COUNTRIES = ALL_COUNTRIES.filter((c) => c.signalId.startsWith('war.'));

// SAMPLE: nach Doku nachgebaut (aggregation, axis_x=measurement_start_day), keine echte Aufzeichnung.
const SAMPLE = { v: 0, dimension_count: 1, result: [
  { measurement_start_day: '2026-11-14', anomaly_count: 30, confirmed_count: 0, failure_count: 5, ok_count: 965, measurement_count: 1000 },
  { measurement_start_day: '2026-11-15', anomaly_count: 5, ok_count: 20, measurement_count: 30 },
  { measurement_start_day: '2026-11-17', anomaly_count: 1, ok_count: 999, measurement_count: 1000 },
] };

test('Normalfall: Anteil in Prozent', () => {
  const m = parse(SAMPLE);
  assert.equal(m.get('2026-11-14')?.share, 3);
  assert.equal(m.get('2026-11-14')?.n, 1000);
});

test('leere Antwort, fehlendes Feld, kaputte Zeilen', () => {
  assert.equal(parse({ result: [] }).size, 0);
  assert.throws(() => parse({}), /result fehlt/);
  assert.equal(parse({ result: [{ measurement_start_day: '2026-11-14', anomaly_count: 1 }, { anomaly_count: 1, measurement_count: 5 }, { measurement_start_day: '2026-11-14', anomaly_count: 'x', measurement_count: 0 }] }).size, 0);
  assert.equal(parse({ result: [{ measurement_start_day: '2026-11-14T00:00:00Z', anomaly_count: 1, measurement_count: 4 }] }).get('2026-11-14')?.share, 25);
});

test('collect: dünne Tage und laufender Tag fehlen, ein Land darf ausfallen', async () => {
  let n = 0;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async () => { if (++n === 2) throw new Error('500'); return SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  const cyber = r.observations.filter((o) => o.signalId.startsWith('cyber.'));
  assert.equal(cyber.length, COUNTRIES.length - 1); // je Land nur der 14.11.
  assert.ok(cyber.every((o) => o.ts === '2026-11-14T00:00:00.000Z' && o.value === 3));
  assert.equal(DEFAULT_WINDOW_DAYS, 30);
  assert.ok(ALL_COUNTRIES.every((c) => c.windowDays === 30));
  assert.equal(buildUrl('DE', new Date('2026-11-17T00:00:00Z')),
    'https://api.ooni.io/api/v1/aggregation?probe_cc=DE&test_name=web_connectivity&since=2026-10-18&until=2026-11-17&axis_x=measurement_start_day');
  assert.equal(fixtureName('DE'), 'ooni/web-connectivity-de-30d.json');
  assert.equal(COUNTRIES.find((c) => c.cc === 'DE')!.signalId, 'cyber.outages.ooni_anomaly_share_de');
});

// --- Szenario war ---

test('war: Konfliktländer mit eigenen Signal-IDs und Fixture-Namen, Domain connectivity', async () => {
  assert.deepEqual(WAR_COUNTRIES.map((c) => c.cc), ['IR', 'IL', 'UA', 'RU', 'TW']);
  assert.equal(WAR_COUNTRIES[0].signalId, 'war.connectivity.ooni_anomaly_share_ir');
  assert.ok(WAR_COUNTRIES.every((c) => !COUNTRIES.some((d) => d.cc === c.cc)));
  const sigs = collector.signals.filter((s) => s.id.startsWith('war.'));
  assert.equal(sigs.length, 5);
  assert.ok(sigs.every((s) => s.domain === 'connectivity' && s.scenarios!.join() === 'war' && s.evidenceClass === 'A'));
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { if (u.includes('probe_cc=UA')) throw new Error('500'); return SAMPLE; }, text: async () => '' },
  };
  const ids = new Set((await collector.collect(ctx as never)).observations.map((o) => o.signalId));
  assert.ok(ids.has('war.connectivity.ooni_anomaly_share_ir') && ids.has('cyber.outages.ooni_anomaly_share_de'));
  assert.ok(!ids.has('war.connectivity.ooni_anomaly_share_ua'));
  assert.equal(fixtureName('IR'), 'ooni/web-connectivity-ir-30d.json');
});

test('collect: Tage vor dem Fenster werden nicht gemeldet', async () => {
  const old = { result: [{ measurement_start_day: '2026-10-01', anomaly_count: 10, measurement_count: 1000 }, ...SAMPLE.result] };
  const ctx = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {}, http: { json: async () => old, text: async () => '' } };
  const r = await collector.collect(ctx as never);
  assert.ok(r.observations.every((o) => o.ts >= '2026-10-18'));
  assert.equal(r.observations.length, ALL_COUNTRIES.length);
});
