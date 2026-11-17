import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrices } from '../../src/collectors/github-gas-henry-hub.ts';

// nach der echten Form von daily.csv nachgebaut
const CSV = 'Date,Price\n1997-01-07,3.82\n2026-11-10,3.0\n2026-11-11,3.04\n';
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall', () => {
  assert.deepEqual(parsePrices(CSV, NOW), [{ day: '2026-11-10', price: 3 }, { day: '2026-11-11', price: 3.04 }]);
});
test('leere Antwort', () => {
  assert.throws(() => parsePrices('', NOW), /Antworttext/);
  assert.deepEqual(parsePrices('Date,Price\n', NOW), []);
});
test('fehlendes Feld und veraltete Reihe', () => {
  assert.throws(() => parsePrices('Datum,Preis\n2026-11-11,1\n', NOW), /Spalten/);
  assert.throws(() => parsePrices('Date,Price\n2026-10-01,3\n', NOW), /veraltet/);
});
