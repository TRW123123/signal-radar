import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseNewModelsRate, SIG_RATE, URL_MODELS } from '../../src/collectors/ai-hf-hub.ts';

// nach Doku nachgebaut (Hub-API mit expand[]=createdAt): 40 Modelle im Abstand von 6 Sekunden
const mk = (n: number, stepS: number) => Array.from({ length: n }, (_, i) => ({ _id: `x${i}`, id: `a/m${i}`, createdAt: new Date(Date.UTC(2026, 10, 17, 0, 0, 0) - i * stepS * 1000).toISOString() }));

test('Rate aus Zeitspanne', () => {
  assert.equal(Math.round(parseNewModelsRate(mk(40, 6))), Math.round((39 / 234) * 3600));
});
test('zu wenige Einträge, fehlendes Feld, gleiche Zeitstempel werfen', () => {
  assert.throws(() => parseNewModelsRate(mk(5, 6)), /nur 5/);
  assert.throws(() => parseNewModelsRate({}), /Modellliste/);
  assert.throws(() => parseNewModelsRate(mk(20, 0)), /Zeitspanne/);
});
test('Collector meldet einen Wert je volle Stunde', async () => {
  const http = { json: async (u: string) => { assert.equal(u, URL_MODELS); return mk(40, 6); }, text: async () => '' } as never;
  const r = await collector.collect({ now: new Date('2026-11-17T00:16:00Z'), http, key: () => undefined, log: () => {} });
  assert.equal(r.observations.length, 1);
  assert.equal(r.observations[0].signalId, SIG_RATE);
  assert.equal(r.observations[0].ts, '2026-11-17T00:00:00.000Z');
});
