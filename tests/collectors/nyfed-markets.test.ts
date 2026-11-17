import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSofr, parseSrf } from '../../src/collectors/nyfed-markets.ts';

// nach Doku nachgebaut
const SOFR = { refRates: [
  { effectiveDate: '2026-11-13', type: 'SOFR', percentRate: 4.0, percentPercentile1: 3.95, percentPercentile25: 3.99, percentPercentile75: 4.02, percentPercentile99: 4.1, volumeInBillions: 2900 },
  { effectiveDate: '2026-11-12', type: 'SOFR', percentRate: 4.01, volumeInBillions: 2850 },
] };
const SRF = { repo: { operations: [
  { operationDate: '2026-11-13', operationType: 'Repo', totalAmtAccepted: 1500000000 },
  { operationDate: '2026-11-13', operationType: 'Repo', totalAmtAccepted: 500000000 },
  { operationDate: '2026-11-12', operationType: 'Repo', totalAmtAccepted: 0 },
  { operationDate: '2026-11-17', operationType: 'Repo', totalAmtAccepted: 9e9 },
] } };

test('SOFR Normalfall', () => {
  const o = parseSofr(SOFR);
  const tail = o.filter((x) => x.signalId.endsWith('sofr_tail'));
  assert.equal(tail.length, 1); // zweiter Tag ohne P99
  assert.equal(tail[0].value, 10);
  assert.equal(o.filter((x) => x.signalId.endsWith('sofr_volume')).length, 2);
});
test('SRF Summe je Tag, heutiger Tag ausgelassen', () => {
  const o = parseSrf(SRF, '2026-11-17');
  assert.deepEqual(o.map((x) => x.value), [0, 2]);
});
test('leere Antwort', () => {
  assert.deepEqual(parseSofr({ refRates: [] }), []);
  assert.deepEqual(parseSrf({ repo: { operations: [] } }, '2026-11-17'), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseSofr({}), /refRates/);
  assert.throws(() => parseSrf({}, '2026-11-17'), /operations/);
});

// Echter Ausschnitt (17.11.2026, sofr/last/60.json, gekürzt)
const REAL = { refRates: [
  { effectiveDate: '2026-11-13', type: 'SOFR', percentRate: 3.90, percentPercentile1: 3.85, percentPercentile25: 3.87, percentPercentile75: 3.95, percentPercentile99: 3.97, volumeInBillions: 3092, revisionIndicator: '' },
  { effectiveDate: '2026-11-12', type: 'SOFR', percentRate: 3.90, percentPercentile1: 3.84, percentPercentile25: 3.87, percentPercentile75: 3.95, percentPercentile99: 3.98, volumeInBillions: 3138, revisionIndicator: '' },
] };
test('SOFR echte Antwort: Tail 7-8 bp, Volumen rund 3 Billionen USD', () => {
  const o = parseSofr(REAL);
  assert.deepEqual(o.filter((x) => x.signalId.endsWith('sofr_tail')).map((x) => x.value), [7, 8]);
  assert.deepEqual(o.filter((x) => x.signalId.endsWith('sofr_volume')).map((x) => x.value), [3092, 3138]);
});
test('SRF: Geschäftstage ohne Operation werden als 0 gemeldet', () => {
  const o = parseSrf({ repo: { operations: [] } }, '2026-11-17', ['2026-11-13', '2026-11-12', '2026-11-17']);
  assert.deepEqual(o.map((x) => x.value), [0, 0]);
});
