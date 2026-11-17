import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFees, parsePool } from '../../src/collectors/mempool-space.ts';

// nach Doku nachgebaut
test('Normalfall', () => {
  assert.equal(parseFees({ fastestFee: 5, halfHourFee: 4 }), 5);
  assert.deepEqual(parsePool({ count: 12000, vsize: 25_500_000 }), { vMB: 25.5, count: 12000 });
});
test('leere Antwort', () => {
  assert.throws(() => parseFees({}), /fastestFee/);
  assert.throws(() => parsePool({}), /vsize/);
});
test('fehlendes Feld', () => {
  assert.equal(parsePool({ vsize: '1000000' }).count, null);
  assert.throws(() => parseFees({ fastestFee: 'x' }), /fastestFee/);
});

// Echter Ausschnitt (17.11.2026)
test('echte Antworten: Gebühr 2 sat/vB, Warteschlange 32,65 MvB', () => {
  assert.equal(parseFees({ fastestFee: 2, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 }), 2);
  assert.deepEqual(parsePool({ count: 76535, vsize: 32649492, total_fee: 4899615 }), { vMB: 32.65, count: 76535 });
});
