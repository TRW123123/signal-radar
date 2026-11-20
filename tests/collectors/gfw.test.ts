import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { dailyCounts, days, eventsUrl, PAGE, parsePage, REGIONS } from '../../src/collectors/gfw.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// nach Doku nachgebaut (OpenAPI-Beispiel GET /v3/events: entries[], limit, offset, nextOffset, total, metadata)
const entry = (start: string) => ({ id: start, type: 'gap', start, end: '2026-11-15T10:00:00.000Z',
  position: { lat: '26.1', lon: '52.3' }, vessel: { id: 'v', flag: 'PAN', type: 'OTHER' } });
const SAMPLE = { entries: [entry('2026-11-10T03:00:00.000Z'), entry('2026-11-10T22:00:00.000Z'), entry('2026-11-14T01:00:00.000Z'),
  entry('2026-11-08T05:00:00.000Z')], limit: 500, offset: 0, nextOffset: null, total: 4, metadata: {} };
const NOW = new Date('2026-11-20T12:00:00Z');

test('days: now-10 bis now-4', () => {
  assert.deepEqual(days(NOW), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
});

test('parsePage + dailyCounts: Normalfall, Tage außerhalb ignoriert, Nullen gemeldet', () => {
  const p = parsePage(SAMPLE);
  assert.equal(p.total, 4);
  const o = dailyCounts('s', p.starts, NOW);
  assert.equal(o.length, 7);
  assert.deepEqual(o.map((x) => x.value), [2, 0, 0, 0, 1, 0, 0]);
  assert.equal(o[0].ts, '2026-11-10T00:00:00.000Z');
});

test('leere Antwort und fehlende Felder', () => {
  assert.deepEqual(parsePage({ entries: [], total: 0 }), { starts: [], total: 0, count: 0 });
  assert.throws(() => parsePage({ total: 0 }), /entries/);
  assert.throws(() => parsePage({ entries: [] }), /total/);
  assert.throws(() => parsePage({ error: 'invalid token' }), /entries/);
});

test('eventsUrl: Gap-Datensatz, EEZ-Liste, Fenster mit exklusivem Enddatum', () => {
  const u = eventsUrl(REGIONS[1], NOW, 0);
  assert.ok(u.includes('datasets[0]=public-global-gaps-events%3Alatest'));
  assert.ok(u.includes('regionDatasets[0]=public-eez-areas&regionIds[0]=5675&regionIds[1]=5683'));
  assert.ok(u.includes('start-date=2026-11-10&end-date=2026-11-17'));
  assert.ok(u.includes('gap-intentional-disabling=true'));
});

test('collect: Bearer, Seitenwechsel, unvollständige Region wird verworfen', async () => {
  const urls: string[] = [];
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, key: () => 'G', log: (m) => logs.push(m), http: {
    text: async () => '',
    json: async (url: string, init) => {
      assert.equal(init?.headers?.Authorization, 'Bearer G');
      urls.push(url);
      if (url.includes('8469')) return SAMPLE as never; // Golf: vollständig
      // Ostsee: mehr Einträge als 2 Seiten
      return { entries: Array.from({ length: PAGE }, () => entry('2026-11-12T00:00:00.000Z')), total: 5000 } as never;
    },
  } });
  assert.equal(urls.length, 3);
  assert.ok(res.observations.every((o) => o.signalId === 'war.shipping.ais_gaps_gulf'));
  assert.match(logs[0], /unvollständige/);
});

test('Runner: ohne Key übersprungen', async () => {
  assert.equal(collector.needsKey, 'SR_GFW_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-gfw-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_GFW_KEY)');
});
