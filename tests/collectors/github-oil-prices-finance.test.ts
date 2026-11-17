import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrent } from '../../src/collectors/github-oil-prices-finance.ts';

// Ausschnitt der echten brent-daily.csv (Stand 17.11.2026)
const CSV = 'Date,Price\n1987-05-20,18.63\n2025-12-01,62.1\n2026-11-09,91.03\n2026-11-10,90.16\n2026-11-11,92.14\n';
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall: nur das 365-Tage-Fenster', () => {
  assert.deepEqual(parseBrent(CSV, NOW).map((p) => p.day), ['2025-12-01', '2026-11-09', '2026-11-10', '2026-11-11']);
});
test('leere Antwort', () => {
  assert.throws(() => parseBrent('', NOW), /Antworttext/);
  assert.deepEqual(parseBrent('Date,Price\n', NOW), []);
});
test('fehlendes Feld und veraltete Reihe', () => {
  assert.throws(() => parseBrent('Date,Wert\n2026-11-11,1\n', NOW), /Spalten/);
  assert.throws(() => parseBrent('Date,Price\n2026-10-01,80\n', NOW), /veraltet/);
});
