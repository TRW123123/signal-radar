import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, buildUrl, fixtureName, signalId, COUNTRIES } from '../../src/collectors/ooni.ts';

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
  assert.equal(r.observations.length, COUNTRIES.length - 1); // je Land nur der 14.11.
  assert.ok(r.observations.every((o) => o.ts === '2026-11-14T00:00:00.000Z' && o.value === 3));
  assert.equal(buildUrl('DE', new Date('2026-11-17T00:00:00Z')),
    'https://api.ooni.io/api/v1/aggregation?probe_cc=DE&test_name=web_connectivity&since=2026-09-03&until=2026-11-17&axis_x=measurement_start_day');
  assert.equal(fixtureName('DE'), 'ooni/web-connectivity-de-daily.json');
  assert.equal(signalId('DE'), 'cyber.outages.ooni_anomaly_share_de');
});
