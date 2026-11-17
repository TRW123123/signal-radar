import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseSignals, hourlyMeans, parseEventStarts } from '../../src/collectors/ioda.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const SAMPLE = { error: null, data: [[
  { entityType: 'country', entityCode: 'DE', datasource: 'bgp', from: 3600, until: 10800, step: 1800, nativeStep: 300, values: [10, 20, 30, 40] },
  { entityType: 'country', entityCode: 'DE', datasource: 'ping-slash24', from: 3600, until: 10800, step: 1800, nativeStep: 600, values: [1, null, 3, 5] },
]] };

test('Normalfall: Serien und Stundenmittel', () => {
  const s = parseSignals(SAMPLE);
  assert.equal(s.length, 2);
  const h = hourlyMeans(s[0], 10800);
  assert.deepEqual([...h], [[3600, 15], [7200, 35]]);
  // Stunde mit null-Punkt wird verworfen
  assert.deepEqual([...hourlyMeans(s[1], 10800)], [[7200, 4]]);
});
test('laufende Stunde wird nicht gemeldet', () => {
  assert.equal(hourlyMeans(parseSignals(SAMPLE)[0], 9000).size, 1);
});
test('leere Antwort', () => {
  assert.deepEqual(parseSignals({ data: [] }), []);
  assert.deepEqual(parseEventStarts({ data: [] }), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseSignals({}), /data/);
  assert.throws(() => parseEventStarts({}), /data/);
  assert.deepEqual(parseSignals({ data: [[{ datasource: 'bgp' }]] }), []);
});
test('Ereignisse', () => {
  assert.deepEqual(parseEventStarts({ data: [{ start: 100 }, { start: 'x' }, {}] }), [100]);
});
test('collect: Summe nur bei vollständiger Länderliste', async () => {
  const logs: string[] = [];
  const now = new Date('2026-11-17T00:00:00Z');
  const sec = now.getTime() / 1000;
  const ctx = {
    now, key: () => undefined, log: (m: string) => logs.push(m),
    http: {
      text: async () => '',
      json: async (url: string) => {
        if (url.includes('/outages/events')) return { data: [{ start: sec - 86400 * 2 + 5 }] };
        if (url.includes('/country/US')) throw new Error('boom');
        return { data: [[{ datasource: 'bgp', from: sec - 7200, step: 3600, values: [5, 6] }]] };
      },
    },
  };
  const r = await collector.collect(ctx as never);
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.outages.ioda_country_signals_de'));
  assert.ok(!r.observations.some((o) => o.signalId === 'cyber.outages.ioda_bgp_big_countries'));
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.outages.ioda_outage_events_global'));
  assert.ok(r.observations.every((o) => Number.isFinite(o.value)));
});
