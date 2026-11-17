import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseTimeseries, dailyObservations, hourlyObservations, parseOutages, parseTotalCount } from '../../src/collectors/cloudflare-radar.ts';

// nach Doku nachgebaut (Cloudflare Radar: result.serie_0 mit Textwerten, annotations, result_info)
const TS = { success: true, result: { meta: {}, serie_0: { timestamps: ['2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z', '2026-11-16T00:00:00Z', '2026-11-17T00:00:00Z'], values: ['0.2', '0.4', 'x', '0.9'] } } };
const NOW = new Date('2026-11-17T00:00:00Z');

test('parseTimeseries: Normalfall, unlesbarer Wert entfällt', () => {
  const s = parseTimeseries(TS);
  assert.deepEqual(s.values, [0.2, 0.4, 0.9]);
});
test('dailyObservations: laufender Tag entfällt', () => {
  const o = dailyObservations('x', parseTimeseries(TS), NOW);
  assert.deepEqual(o.map((x) => x.ts), ['2026-11-14T00:00:00.000Z', '2026-11-15T00:00:00.000Z']);
});
test('hourlyObservations: laufende Stunde entfällt', () => {
  const s = { timestamps: ['2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z'], values: [1, 2] };
  assert.equal(hourlyObservations('x', s, new Date('2026-11-17T09:30:00Z')).length, 1);
});
test('parseTimeseries: leer / fehlendes Feld', () => {
  assert.deepEqual(parseTimeseries({ result: { serie_0: { timestamps: [], values: [] } } }), { timestamps: [], values: [] });
  assert.throws(() => parseTimeseries({ result: {} }), /serie_0/);
  assert.throws(() => parseTimeseries({}), /serie_0/);
});
test('parseOutages: zählt pro Tag, Nullen mitgeliefert', () => {
  const body = { result: { annotations: [{ startDate: '2026-11-15T03:00:00Z' }, { startDate: '2026-11-15T20:00:00Z' }, { startDate: '2026-11-16T01:00:00Z' }] } };
  const o = parseOutages(body, 'o', NOW, { days: 3, limit: 100 });
  assert.deepEqual(o.map((x) => x.value), [0, 2, 1]);
});
test('parseOutages: bei Abschneiden am Limit älteste Tage verworfen', () => {
  const body = { result: { annotations: [{ startDate: '2026-11-15T03:00:00Z' }, { startDate: '2026-11-16T01:00:00Z' }] } };
  const o = parseOutages(body, 'o', NOW, { days: 3, limit: 2 });
  assert.deepEqual(o.map((x) => x.ts.slice(0, 10)), ['2026-11-16']);
});
test('parseOutages: leer und fehlendes Feld', () => {
  assert.equal(parseOutages({ result: { annotations: [] } }, 'o', NOW, { days: 2, limit: 100 }).every((x) => x.value === 0), true);
  assert.throws(() => parseOutages({}, 'o', NOW, { days: 2, limit: 100 }), /annotations/);
});
test('parseTotalCount', () => {
  assert.equal(parseTotalCount({ result: {}, result_info: { total_count: 17 } }), 17);
  assert.throws(() => parseTotalCount({ result: {} }), /total_count/);
});
test('collect: ohne Key Fehler, Key-Name gesetzt', async () => {
  assert.equal(collector.needsKey, 'SR_CLOUDFLARE_KEY');
  await assert.rejects(collector.collect({ now: NOW, key: () => undefined, log: () => {}, http: { json: async () => ({}) as never, text: async () => '' } }));
});
test('collect: sendet Bearer-Header, Teilfehler tolerant', async () => {
  const seen: (string | undefined)[] = [];
  const res = await collector.collect({
    now: new Date('2026-11-17T10:30:00Z'), key: () => 'K', log: () => {},
    http: { json: async (url: string, init) => { seen.push(init?.headers?.Authorization); if (url.includes('hijacks')) throw new Error('x'); return (url.includes('events') ? { result_info: { total_count: 3 } } : url.includes('outages') ? { result: { annotations: [] } } : TS) as never; }, text: async () => '' },
  });
  assert.ok(seen.every((h) => h === 'Bearer K'));
  assert.ok(res.observations.some((o) => o.signalId === 'cyber.routing.cf_route_leaks_24h' && o.value === 3));
  assert.ok(!res.observations.some((o) => o.signalId === 'cyber.routing.cf_bgp_hijacks_24h'));
});
