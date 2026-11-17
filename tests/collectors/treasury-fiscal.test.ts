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
