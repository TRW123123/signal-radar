import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { activeCount, closuresYesterday, isClosure, isGps, isTfr, parseNotams, SIG_CLOSURES, SIG_GPS, SIG_TFR } from '../../src/collectors/faa-notam.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// nach öffentlicher Client-Doku nachgebaut (geoJson: items[].properties.coreNOTAMData.notam, totalCount)
const item = (n: Record<string, unknown>) => ({ type: 'Feature', properties: { coreNOTAMData: { notam: n, notamTranslation: [] } }, geometry: null });
const SAMPLE = { pageSize: 1000, pageNum: 1, totalCount: 4, totalPages: 1, items: [
  item({ id: 'A1', issued: '2026-11-19T08:00:00.000Z', selectionCode: 'QRTCA', effectiveStart: '2026-11-19T09:00:00.000Z', effectiveEnd: '2026-11-25T00:00:00.000Z', text: 'TEMPO RESTRICTED AREA ACT' }),
  item({ id: 'A2', issued: '2026-11-19T12:00:00.000Z', selectionCode: 'QMRLC', effectiveStart: '2026-11-19T12:00:00.000Z', effectiveEnd: 'PERM', text: 'RWY 18/36 CLSD' }),
  item({ id: 'A3', issued: '2026-11-19T13:00:00.000Z', selectionCode: 'QOBCE', effectiveStart: '2026-11-19T13:00:00.000Z', effectiveEnd: '2026-12-01T00:00:00.000Z', text: 'CRANE ERECTED' }),
  item({ id: 'A4', issued: '2026-11-18T13:00:00.000Z', selectionCode: 'QARLC', effectiveStart: '2026-11-18T13:00:00.000Z', effectiveEnd: '2026-12-01T00:00:00.000Z', text: 'ATS RTE CLSD' }),
] };
const US = { totalCount: 3, items: [
  item({ id: 'F1', effectiveStart: '2026-11-20T00:00:00.000Z', effectiveEnd: '2026-11-21T00:00:00.000Z', text: '!FDC 6/1234 ZDC DC..AIRSPACE TEMPORARY FLIGHT RESTRICTIONS ... PURSUANT TO 14 CFR SECTION 91.141' }),
  item({ id: 'F2', effectiveStart: '2026-11-21T00:00:00.000Z', effectiveEnd: '2026-11-22T00:00:00.000Z', text: 'TEMPORARY FLIGHT RESTRICTIONS FUTURE' }),
  item({ id: 'F3', effectiveStart: '2026-11-19T00:00:00.000Z', effectiveEnd: 'PERM', text: 'GPS NAV GPS (WSMR GPS 26-11) MAY NOT BE AVBL' }),
] };
const NOW = new Date('2026-11-20T10:30:00Z');

test('parseNotams + Klassifikation: Normalfall', () => {
  const p = parseNotams(SAMPLE);
  assert.equal(p.total, 4);
  assert.deepEqual(p.notams.map(isClosure), [true, true, false, true]);
  assert.equal(p.notams[1].end, null); // PERM
  assert.deepEqual(closuresYesterday(p.notams, NOW), { day: '2026-11-19', count: 2 });
  const us = parseNotams(US).notams;
  assert.equal(activeCount(us, NOW, isTfr), 1);
  assert.equal(activeCount(us, NOW, isGps), 1);
});

test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parseNotams({ items: [], totalCount: 0 }), { notams: [], total: 0 });
  assert.throws(() => parseNotams({ message: 'Unauthorized' }), /items/);
  assert.equal(parseNotams({ items: [{ properties: {} }] }).notams.length, 0);
});

test('collect: Header-Paar, Summe nur bei allen vier FIR, Momentaufnahmen je Stunde', async () => {
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, key: (n) => (n === 'SR_FAA_NOTAM_USER' ? 'ID' : 'SEC'), log: (m) => logs.push(m), http: {
    text: async () => '',
    json: async (url: string, init) => {
      assert.equal(init?.headers?.client_id, 'ID');
      assert.equal(init?.headers?.client_secret, 'SEC');
      return (url.includes('icaoLocation') ? SAMPLE : US) as never;
    },
  } });
  const by = Object.fromEntries(res.observations.map((o) => [o.signalId, o]));
  assert.equal(by[SIG_CLOSURES].value, 8);
  assert.equal(by[SIG_CLOSURES].ts, '2026-11-19T00:00:00.000Z');
  assert.equal(by[SIG_TFR].ts, '2026-11-20T10:00:00.000Z');
  assert.equal(by[SIG_GPS].value, 1);

  const part = await collector.collect({ now: NOW, key: () => 'K', log: (m) => logs.push(m), http: {
    text: async () => '', json: async (url: string) => { if (url.includes('OIIX')) throw new Error('HTTP 500'); return (url.includes('icaoLocation') ? SAMPLE : US) as never; } } });
  assert.ok(!part.observations.some((o) => o.signalId === SIG_CLOSURES));
});

test('unvollständige Seite wird verworfen', async () => {
  const logs: string[] = [];
  await assert.rejects(collector.collect({ now: NOW, key: () => 'K', log: (m) => logs.push(m), http: {
    text: async () => '', json: async () => ({ totalCount: 5000, items: [] }) as never } }), /keine Abfrage/);
  assert.match(logs[0], /verworfen/);
});

test('Runner: ohne eines der beiden Keys übersprungen', async () => {
  assert.deepEqual(collector.needsKey, ['SR_FAA_NOTAM_USER', 'SR_FAA_NOTAM_PASS']);
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-faa-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: { SR_FAA_NOTAM_USER: 'x' } });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_FAA_NOTAM_USER, SR_FAA_NOTAM_PASS)');
});
