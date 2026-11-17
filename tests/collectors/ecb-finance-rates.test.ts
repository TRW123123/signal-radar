import test from 'node:test';
import assert from 'node:assert/strict';
import { curveSpread, firstSeries, fxVol } from '../../src/collectors/ecb-finance-rates.ts';

// nach Doku nachgebaut (Spalten wie bei Flow EST; nicht gegen eine echte Antwort geprüft)
const hdr = 'KEY,FREQ,TIME_PERIOD,OBS_VALUE\n';
const mk = (key: string, rows: [string, number][]) => hdr + rows.map(([d, v]) => `${key},B,${d},${v}`).join('\n') + '\n';

test('Zinsabstand 10J minus 3M', () => {
  const a = firstSeries(mk('YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y', [['2026-11-12', 2.9], ['2026-11-13', 3.0]]));
  const b = firstSeries(mk('YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M', [['2026-11-13', 2.1]]));
  const o = curveSpread(a, b);
  assert.equal(o.length, 1);
  assert.equal(o[0].value, 0.9);
});
test('Devisen-Schwankung nur mit allen Währungen', () => {
  const s = (v: number[]) => firstSeries(mk('EXR.D.USD.EUR.SP00.A', v.map((x, i): [string, number] => [`2026-11-1${i}`, x])));
  const o = fxVol([s([1.0, 1.01]), s([100, 99]), s([0.9, 0.9])]);
  assert.equal(o.length, 1);
  assert.equal(o[0].value, 0.6667);
  assert.deepEqual(fxVol([s([1.0, 1.01]), s([100])]), []);
});
test('leere Antwort', () => {
  assert.throws(() => firstSeries(hdr), /Serie/);
});
