import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFailures, rollingCounts, toIsoDay } from '../../src/collectors/fdic-bankfind.ts';

// nach Doku nachgebaut (nicht gegen eine echte Antwort geprüft)
const SAMPLE = { meta: { total: 2 }, data: [
  { data: { NAME: 'Beispielbank A', FAILDATE: '10/17/2026', QBFASSET: 120000 }, score: 1 },
  { data: { NAME: 'Beispielbank B', FAILDATE: '2026-08-01', QBFASSET: 50000 }, score: 1 },
] };
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall', () => {
  const f = parseFailures(SAMPLE);
  assert.deepEqual(f.map((x) => x.day), ['2026-10-17', '2026-08-01']);
  const o = rollingCounts(f, NOW);
  assert.equal(o.length, 60);
  assert.equal(o.find((x) => x.ts.startsWith('2026-10-20'))?.value, 2); // beide in den letzten 90 Tagen
  assert.equal(o[o.length - 1].value, 1); // 16.11.: die vom 1.8. ist älter als 90 Tage
  assert.equal(o[0].value, 1); // 18.09.: Bank A liegt noch in der Zukunft
});
test('leere Antwort', () => {
  assert.deepEqual(parseFailures({ data: [] }), []);
  assert.ok(rollingCounts([], NOW).every((x) => x.value === 0));
});
test('fehlendes Feld', () => {
  assert.throws(() => parseFailures({}), /data/);
  assert.equal(toIsoDay('kaputt'), null);
});
