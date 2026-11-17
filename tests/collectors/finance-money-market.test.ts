import test from 'node:test';
import assert from 'node:assert/strict';
import { rename } from '../../src/collectors/finance-money-market.ts';
import { parseSofr } from '../../src/collectors/nyfed-markets.ts';
import { buildObservations, parseEstCsv } from '../../src/collectors/ecb-data.ts';

// gekürzte Ausschnitte nach den echten Antworten vom 17.11.2026
const SOFR = { refRates: [
  { effectiveDate: '2026-11-13', type: 'SOFR', percentRate: 3.90, percentPercentile1: 3.85, percentPercentile25: 3.87, percentPercentile75: 3.95, percentPercentile99: 3.97, volumeInBillions: 3092, revisionIndicator: '' },
  { effectiveDate: '2026-11-12', type: 'SOFR', percentRate: 3.90, percentPercentile99: 3.98, volumeInBillions: 3138 },
] };
const hdr = 'KEY,FREQ,BENCHMARK_ITEM,DATA_TYPE_EST,TIME_PERIOD,OBS_VALUE\n';
const csv = (c: string, v: string) => hdr + `EST.B.EU000A2X2A25.${c},B,EU000A2X2A25,${c},2026-11-13,${v}\n`;

test('SOFR wird auf finance.*-IDs umbenannt', () => {
  const o = rename(parseSofr(SOFR));
  assert.deepEqual(o.map((x) => x.signalId).sort(), [
    'finance.money_market.sofr_tail', 'finance.money_market.sofr_tail', 'finance.money_market.sofr_volume', 'finance.money_market.sofr_volume']);
  assert.equal(o.find((x) => x.signalId.endsWith('sofr_tail') && x.ts.startsWith('2026-11-13'))?.value, 7);
});
test('€STR: Streuung und Volumen', () => {
  const m = new Map([...parseEstCsv(csv('R25', '1.90')), ...parseEstCsv(csv('R75', '1.95')), ...parseEstCsv(csv('VL', '40'))]);
  const o = rename(buildObservations(m));
  assert.equal(o.find((x) => x.signalId === 'finance.money_market.estr_spread')?.value, 5);
  assert.equal(o.find((x) => x.signalId === 'finance.money_market.estr_volume')?.value, 40);
});
test('leere Antwort und unbekannte IDs', () => {
  assert.deepEqual(rename([]), []);
  assert.deepEqual(rename([{ signalId: 'cyber.finance.other', ts: '2026-11-13T00:00:00.000Z', value: 1 }]), []);
});
