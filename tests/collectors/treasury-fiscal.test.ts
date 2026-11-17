import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTga } from '../../src/collectors/treasury-fiscal.ts';

// nach Doku nachgebaut (nicht gegen eine echte Antwort geprüft)
const SAMPLE = { data: [
  { record_date: '2026-11-16', account_type: 'Treasury General Account (TGA) Closing Balance', close_today_bal: '850123' },
  { record_date: '2026-11-13', account_type: 'Treasury General Account (TGA) Closing Balance', close_today_bal: '845000' },
  { record_date: '2026-11-13', account_type: 'Anderes Konto', close_today_bal: '1' },
  { record_date: '2026-11-17', account_type: 'Treasury General Account (TGA) Closing Balance', close_today_bal: '1' },
] };

test('Normalfall: aufsteigend, heutiger Tag und fremde Konten entfallen', () => {
  const o = parseTga(SAMPLE, '2026-11-17');
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-13', 845000], ['2026-11-16', 850123]]);
});
test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parseTga({ data: [] }, '2026-11-17'), []);
  assert.throws(() => parseTga({}, '2026-11-17'), /data/);
  assert.deepEqual(parseTga({ data: [{ record_date: '2026-11-13', account_type: 'Treasury General Account (TGA)', close_today_bal: 'null' }] }, '2026-11-17'), []);
});

// echte Form (17.11.2026): neues Schema, Schlusstand steht in open_today_bal, close_today_bal ist der Text "null"
test('echte Form: Schlusstand aus open_today_bal', () => {
  const real = [
    { record_date: '2026-11-13', account_type: 'Treasury General Account (TGA) Closing Balance', open_today_bal: '924618', close_today_bal: 'null' },
    { record_date: '2026-11-13', account_type: 'Treasury General Account (TGA) Opening Balance', open_today_bal: '933127', close_today_bal: 'null' },
  ];
  const o = parseTga({ data: real }, '2026-11-17');
  assert.equal(o.length, 1);
  assert.equal(o[0].value, 924618);
});
