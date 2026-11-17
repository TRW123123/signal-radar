import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrices, spread } from '../../src/collectors/github-oil-prices.ts';

// nach der echten Form von brent-daily.csv nachgebaut
const CSV = 'Date,Price\n1987-05-20,18.63\n2026-11-09,89.5\n2026-11-10,90.16\n2026-11-11,92.14\n';
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall: nur das 90-Tage-Fenster', () => {
  assert.deepEqual(parsePrices(CSV, NOW), [{ day: '2026-11-09', price: 89.5 }, { day: '2026-11-10', price: 90.16 }, { day: '2026-11-11', price: 92.14 }]);
  assert.deepEqual(spread(parsePrices(CSV, NOW), [{ day: '2026-11-10', price: 89.62 }]), [{ day: '2026-11-10', price: 0.54 }]);
});
test('leere Antwort', () => {
  assert.throws(() => parsePrices('', NOW), /Antworttext/);
  assert.deepEqual(parsePrices('Date,Price\n', NOW), []);
});
test('fehlendes Feld und veraltete Reihe', () => {
  assert.throws(() => parsePrices('Date,Wert\n2026-11-11,1\n', NOW), /Spalten/);
  assert.throws(() => parsePrices('Date,Price\n2026-10-01,80\n', NOW), /veraltet/);
});
