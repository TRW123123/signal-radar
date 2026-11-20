import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { AREAS, areaUrl, dailyCounts, parseFirmsCsv, window } from '../../src/collectors/nasa-firms.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// echte keyfreie FIRMS-Datei (NOAA-20, 24 h, 20.11.2026), auf die Front-Box gefiltert: 8 Zeilen
const REAL = readFileSync(new URL('../../fixtures/nasa-firms/public-24h-noaa20-ukraine-front.csv', import.meta.url), 'utf8');
const FRONT = AREAS.find((a) => a.slug === 'ukraine-front')!;
const RUSSIA = AREAS.find((a) => a.slug === 'russia-refineries')!;

// nach Doku nachgebaut (Area API, VIIRS mit Spalte instrument)
const SAMPLE = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
48.1,37.8,330.1,0.4,0.4,2026-11-18,1012,N20,VIIRS,n,2.0NRT,290.2,12.5,D
48.2,37.9,310.0,0.4,0.4,2026-11-18,1012,N20,VIIRS,n,2.0NRT,285.0,3.1,D
48.3,37.7,301.0,0.4,0.4,2026-11-19,2301,N20,VIIRS,n,2.0NRT,280.0,1.0,N
55.0,20.0,301.0,0.4,0.4,2026-11-19,2301,N20,VIIRS,n,2.0NRT,280.0,1.0,N
`;
const NOW = new Date('2026-11-20T12:00:00Z');

test('parseFirmsCsv: echte Datei', () => {
  const p = parseFirmsCsv(REAL);
  assert.equal(p.length, 8);
  assert.ok(p.every((x) => x.day === '2026-11-20' && x.frp !== null));
});

test('window: nur sicher vollständige Tage (Bezug now - 6 h)', () => {
  assert.deepEqual(window(NOW), { start: '2026-11-18', days: ['2026-11-18', '2026-11-19'] });
  assert.deepEqual(window(new Date('2026-11-20T03:00:00Z')).days, ['2026-11-17', '2026-11-18']);
});

test('dailyCounts: Normalfall mit Box-Filter, Nullen und FRP-Schwelle', () => {
  const spots = parseFirmsCsv(SAMPLE);
  const o = dailyCounts(FRONT, spots, ['2026-11-18', '2026-11-19']);
  assert.deepEqual(o.map((x) => [x.ts, x.value]), [['2026-11-18T00:00:00.000Z', 2], ['2026-11-19T00:00:00.000Z', 1]]);
  assert.equal(o[0].meta?.frpSum, 15.6);
  const r = dailyCounts({ ...FRONT, minFrp: 10, signalId: RUSSIA.signalId }, spots, ['2026-11-18']);
  assert.equal(r[0].value, 1);
});

test('leere Antwort (nur Kopf) = 0, fehlende Spalte oder Fehlertext wirft', () => {
  const head = SAMPLE.split('\n')[0];
  assert.deepEqual(dailyCounts(FRONT, parseFirmsCsv(head), ['2026-11-18']).map((x) => x.value), [0]);
  assert.throws(() => parseFirmsCsv('Invalid MAP_KEY.'), /CSV-Kopf/);
  assert.throws(() => parseFirmsCsv('latitude,longitude\n1,2'), /acq_date/);
  assert.throws(() => parseFirmsCsv(''), /CSV-Text/);
});

test('areaUrl: Pfadaufbau laut Doku', () => {
  assert.equal(areaUrl('abc', FRONT, '2026-11-18'),
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/abc/VIIRS_NOAA20_NRT/34,46.5,40.3,50.5/2/2026-11-18');
});

test('collect: 5 Gebiete, Key wird in Fehlermeldungen geschwärzt', async () => {
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, key: () => 'SECRETKEY123', log: (m) => logs.push(m), http: {
    json: async () => ({}) as never,
    text: async (url: string) => { if (url.includes('125.5')) throw new Error(`HTTP 400 ${url}`); return SAMPLE; },
  } });
  assert.equal(res.observations.length, 8);
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes('SECRETKEY123') && logs[0].includes('REDACTED'));
});

test('Runner: ohne Key übersprungen', async () => {
  assert.equal(collector.needsKey, 'SR_FIRMS_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-firms-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_FIRMS_KEY)');
});
