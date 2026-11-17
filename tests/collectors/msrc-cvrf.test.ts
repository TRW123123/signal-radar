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
  assert.equal(urlFor(now, 90), 'https://api.msrc.microsoft.com/cvrf/v3.0/updates?$filter=InitialReleaseDate%20gt%202026-07-20T00:00:00Z');
});

// gekürzter echter Ausschnitt (17.11.2026): Mariner-Dokumente werden täglich neu datiert und sind keine Patch-Bulletins
const REAL = { '@odata.context': 'https://api.msrc.microsoft.com/$metadata#Updates', value: [
  { ID: '2000-Feb', Alias: '2000-Feb', DocumentTitle: 'Mariner Release Notes', Severity: null, InitialReleaseDate: '2000-02-02T00:00:00Z', CurrentReleaseDate: '2026-11-14T01:04:30Z', CvrfUrl: 'https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/2000-Feb' },
  { ID: '2000-Jan', Alias: '2000-Jan', DocumentTitle: 'Mariner Release Notes', Severity: null, InitialReleaseDate: '2000-01-02T00:00:00Z', CurrentReleaseDate: '2026-11-14T01:04:55Z', CvrfUrl: 'https://api.msrc.microsoft.com/cvrf/v3.0/cvrf/2000-Jan' },
] };
test('echter Ausschnitt: Mariner-Dokumente zählen nicht als Out-of-band', () => {
  assert.equal(parseUpdates(REAL as never).length, 0);
});
