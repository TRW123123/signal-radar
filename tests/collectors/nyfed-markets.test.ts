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
