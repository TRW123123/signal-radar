import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurrent, parseChart } from '../../src/collectors/defillama.ts';

// nach Doku nachgebaut
const CUR = { coins: {
  'coingecko:tether': { price: 0.9995, timestamp: 1763337600 },
  'coingecko:usd-coin': { price: 1.0002, timestamp: 1763337590 },
  'coingecko:dai': { price: 0.998, timestamp: 1763337600 },
} };
const day = (d: number) => 1763251200 + d * 86400;
const CH = { coins: {
  'coingecko:tether': { prices: [{ timestamp: day(0), price: 1.001 }, { timestamp: day(1), price: 1.0 }] },
  'coingecko:usd-coin': { prices: [{ timestamp: day(0), price: 1.0 }] },
  'coingecko:dai': { prices: [{ timestamp: day(0), price: 0.997 }, { timestamp: day(1), price: 1 }] },
} };

test('aktuell: größte Abweichung', () => {
  const r = parseCurrent(CUR)!;
  assert.equal(r.value, 0.2);
  assert.equal(r.worst, 'coingecko:dai');
  assert.equal(r.ts, 1763337590);
});
test('Historie: nur vollständige Tage', () => {
  const m = parseChart(CH);
  assert.equal(m.size, 1);
  assert.equal([...m.values()][0], 0.3);
});
test('leer und fehlend', () => {
  assert.equal(parseCurrent({ coins: {} }), null);
  assert.throws(() => parseCurrent({}), /coins/);
  assert.equal(parseChart({ coins: {} }).size, 0);
});

// Echter Ausschnitt (17.11.2026): aktuelle Preise, USDT knapp unter 1 Dollar
const REAL_CUR = { coins: {
  'coingecko:tether': { price: 0.99919, symbol: 'USDT', timestamp: 1794875237, confidence: 0.999 },
  'coingecko:usd-coin': { price: 0.9999143416499999, symbol: 'USDC', timestamp: 1794875237, confidence: 0.999 },
  'coingecko:dai': { price: 1.0000809584597612, symbol: 'DAI', timestamp: 1794875220, confidence: 0.99 },
} };
test('parseCurrent echte Antwort: schlechtester Coin ist USDT, 0,081 %', () => {
  const c = parseCurrent(REAL_CUR)!;
  assert.equal(c.worst, 'coingecko:tether');
  assert.equal(c.value, 0.081);
});
