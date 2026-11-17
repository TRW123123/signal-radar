import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex, parseSeries } from '../../src/collectors/smard.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
const H = 3600_000;
const T0 = Date.UTC(2026, 10, 16, 0);
test('Index sortiert', () => {
  assert.deepEqual(parseIndex({ timestamps: [3, 1, 2] }), [1, 2, 3]);
});
test('Serie: Normalfall, null und laufende Stunde entfallen', () => {
  const r = parseSeries({ series: [[T0, 50000], [T0 + H, null], [T0 + 2 * H, 52000], [T0 + 3 * H, 53000]] }, T0 + 3 * H);
  assert.deepEqual(r.map((x) => x.mw), [50000, 52000]);
});
test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parseSeries({ series: [] }, T0), []);
  assert.throws(() => parseSeries({}, T0), /series/);
  assert.throws(() => parseIndex({}), /timestamps/);
});
