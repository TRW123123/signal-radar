import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUpdates, buildObservations, isPatchTuesday, urlFor } from '../../src/collectors/msrc-cvrf.ts';

// nach Doku nachgebaut (Feldnamen aus Gedächtnis)
const SAMPLE = { value: [
  { ID: '2026-Nov', Alias: '2026-Nov', InitialReleaseDate: '2026-11-10T08:00:00Z', CurrentReleaseDate: '2026-11-13T08:00:00Z' },
  { ID: '2026-Oct', InitialReleaseDate: '2026-10-13T08:00:00Z', CurrentReleaseDate: '2026-11-10T08:00:00Z' },
  { ID: 'CVE-2026-1111', InitialReleaseDate: '2026-11-10T08:00:00Z', CurrentReleaseDate: '2026-11-10T08:00:00Z' },
  { ID: 'CVE-2026-1112', InitialReleaseDate: '2026-11-10T08:00:00Z', CurrentReleaseDate: '2026-11-11T08:00:00Z' },
  { ID: 'CVE-2026-1113', InitialReleaseDate: '2026-11-16T08:00:00Z', CurrentReleaseDate: '2026-11-16T08:00:00Z' },
  { ID: 'Sonstiges' }, {},
] };
const now = new Date('2026-11-17T00:00:00Z');

test('Patch-Dienstag', () => {
  assert.ok(isPatchTuesday('2026-11-10'));
  assert.ok(!isPatchTuesday('2026-11-13'));
  assert.ok(!isPatchTuesday('2026-11-17'));
});
test('Normalfall', () => {
  const docs = parseUpdates(SAMPLE);
  assert.equal(docs.length, 5);
  const o = buildObservations(docs, now, 10);
  const oob = o.filter((x) => x.signalId === 'cyber.vuln.msrc_out_of_band');
  const cve = o.filter((x) => x.signalId === 'cyber.vuln.msrc_cve_publications');
  assert.equal(oob.length, 10);
  assert.equal(oob.find((x) => x.ts.startsWith('2026-11-13'))!.value, 1);
  assert.equal(oob.find((x) => x.ts.startsWith('2026-11-10'))!.value, 0);
  assert.equal(cve.find((x) => x.ts.startsWith('2026-11-10'))!.value, 2);
  assert.equal(cve.find((x) => x.ts.startsWith('2026-11-16'))!.value, 1);
});
test('leere Antwort', () => {
  assert.deepEqual(parseUpdates({ value: [] }), []);
});
test('fehlendes Feld wirft', () => {
  assert.throws(() => parseUpdates({}), /value/);
});
test('URL', () => {
  assert.equal(urlFor(now, 90), 'https://api.msrc.microsoft.com/cvrf/v3.0/updates?$filter=CurrentReleaseDate%20gt%202026-08-17T00:00:00Z');
});
