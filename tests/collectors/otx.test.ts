import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';
import collector, { dailyCounts, parsePulses, searchUrl } from '../../src/collectors/otx.ts';

// Nach Doku/SDK nachgebaut (https://otx.alienvault.com/assets/static/external_api.html), nicht gegen echte Antwort geprüft.
const SAMPLE = {
  count: 3, next: null, previous: null,
  results: [
    { id: '673c0001', name: 'New wiper targets energy sector', created: '2026-11-19T10:00:00.123000', modified: '2026-11-19T11:00:00', tags: ['wiper'] },
    { id: '673c0002', name: 'Wiper variant', created: '2026-11-19T22:59:00.000000', tags: [] },
    { id: '673c0003', name: 'Old wiper', created: '2026-11-10T03:00:00', tags: [] },
  ],
};
const NOW = new Date('2026-11-20T06:00:00Z');

test('Normalfall: Tageszählung über 14 volle Tage', () => {
  const o = dailyCounts('s', [parsePulses(SAMPLE)], NOW);
  assert.equal(o.length, 14);
  assert.equal(o.at(-1)!.ts, '2026-11-19T00:00:00.000Z');
  assert.equal(o.at(-1)!.value, 2);
  assert.equal(o.find((x) => x.ts.startsWith('2026-11-10'))!.value, 1);
  assert.equal(searchUrl('ICS'), 'https://otx.alienvault.com/api/v1/search/pulses?q=ICS&sort=-created&limit=50&page=1');
});

test('volle Seite: nur sicher vollständige Tage, Vereinigung entdoppelt', () => {
  const full = { results: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, created: `2026-11-${i < 30 ? '19' : '17'}T12:00:00` })) };
  const other = { results: [{ id: 'p0', created: '2026-11-19T12:00:00' }, { id: 'x', created: '2026-11-18T01:00:00' }] };
  const o = dailyCounts('s', [parsePulses(full), parsePulses(other)], NOW);
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-18', 1], ['2026-11-19', 30]]);
});

test('leere Antwort', () => {
  assert.deepEqual(parsePulses({ results: [] }).pulses, []);
  assert.equal(dailyCounts('s', [parsePulses({ results: [] })], NOW).every((x) => x.value === 0), true);
  assert.throws(() => parsePulses(null), /unerwartete Antwort/);
});

test('fehlendes Feld', () => {
  assert.throws(() => parsePulses({ count: 0 }), /results/);
  assert.equal(parsePulses({ results: [{ id: 'a' }, { created: '2026-11-19T00:00:00' }] }).pulses.length, 0);
});

test('ohne Key: Runner überspringt sauber', async () => {
  assert.equal(collector.needsKey, 'SR_OTX_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-otx-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_OTX_KEY)');
});

test('mit Key: Header gesetzt, Teilfehler beim ICS-Teil meldet nur Wiper', async () => {
  const seen: string[] = [];
  const http = {
    json: async (u: string, i?: { headers?: Record<string, string> }) => {
      assert.equal(i?.headers?.['X-OTX-API-KEY'], 'k');
      seen.push(u);
      if (u.includes('SCADA')) throw new Error('HTTP 500');
      return SAMPLE;
    },
    text: async () => '',
  } as unknown as HttpClient;
  const res = await collector.collect({ now: NOW, http, key: () => 'k', log: () => {} });
  assert.equal(seen.length, 3);
  assert.deepEqual([...new Set(res.observations.map((o) => o.signalId))], ['cyber.threat.otx_wiper_pulses']);
});
