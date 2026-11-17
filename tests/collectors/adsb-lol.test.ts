import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseMilCount } from '../../src/collectors/adsb-lol.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
test('total wird bevorzugt', () => assert.equal(parseMilCount({ ac: [{}, {}], total: 7 }), 7));
test('Länge von ac als Ersatz, leere Liste ist 0', () => {
  assert.equal(parseMilCount({ ac: [{}, {}, {}] }), 3);
  assert.equal(parseMilCount({ ac: [], total: 0 }), 0);
});
test('fehlendes Feld wirft', () => assert.throws(() => parseMilCount({}), /fehlt/));

test('war: derselbe Zählwert wird unter Cyber- und Kriegs-ID gemeldet, ein Request', async () => {
  let n = 0;
  const ctx = { now: new Date('2026-11-17T00:07:00Z'), key: () => undefined, log: () => {}, http: { json: async () => { n++; return { ac: [{}, {}], total: 42 }; }, text: async () => '' } };
  const r = await collector.collect(ctx as never);
  assert.equal(n, 1);
  assert.deepEqual(r.observations.map((o) => [o.signalId, o.value, o.ts]), [
    ['cyber.physical.military_aircraft_visible', 42, '2026-11-17T00:00:00.000Z'],
    ['war.military.mil_aircraft_visible_global', 42, '2026-11-17T00:00:00.000Z']]);
  const w = collector.signals.find((s) => s.id === 'war.military.mil_aircraft_visible_global')!;
  assert.ok(w.domain === 'military' && w.scenarios!.join() === 'war' && w.plain && w.name);
});
