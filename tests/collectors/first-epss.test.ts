import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHighCount, urlFor } from '../../src/collectors/first-epss.ts';

// nach Doku nachgebaut
const SAMPLE = { status: 'OK', 'status-code': 200, total: 2113, offset: 0, limit: 1, data: [{ cve: 'CVE-2024-3400', epss: '0.97', percentile: '1.0', date: '2026-11-16' }] };

test('Normalfall', () => {
  assert.deepEqual(parseHighCount(SAMPLE, '2026-11-16'), { day: '2026-11-16', total: 2113 });
  assert.equal(urlFor('2026-11-16'), 'https://api.first.org/data/v1/epss?epss-gt=0.5&limit=1&date=2026-11-16');
});
test('total als String', () => {
  assert.equal(parseHighCount({ total: '2,113', data: [] }, '2026-11-16')!.total, 2113);
});
test('leere Antwort = kein Messwert', () => {
  assert.equal(parseHighCount({ total: 0, data: [] }, '2026-11-16'), null);
});
test('fehlendes Feld wirft', () => {
  assert.throws(() => parseHighCount({ data: [] }, '2026-11-16'), /total/);
});

// gekürzte echte Antwort (17.11.2026, limit=1)
const REAL = { status: 'OK', 'status-code': 200, version: '1.0', access: 'public', total: 4384, offset: 0, limit: 1, data: [{ cve: 'CVE-2026-97229', epss: '0.692890000', percentile: '0.993690000', date: '2026-11-16' }] };
test('echte Antwort: total und Datum', () => {
  assert.deepEqual(parseHighCount(REAL, '2026-11-16'), { day: '2026-11-16', total: 4384 });
});
