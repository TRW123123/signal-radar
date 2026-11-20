import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import eggs from '../../src/collectors/fred-eggs.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
// Nach Doku nachgebaut (FRED series/observations, file_type=json); 2026-10-01 = 2.320 laut echter fredgraph.csv vom 20.11.2026.
const SAMPLE = { count: 3, observations: [
  { realtime_start: '2026-11-20', realtime_end: '2026-11-20', date: '2026-08-01', value: '.' },
  { realtime_start: '2026-11-20', realtime_end: '2026-11-20', date: '2026-09-01', value: '2.530' },
  { realtime_start: '2026-11-20', realtime_end: '2026-11-20', date: '2026-10-01', value: '2.320' },
] };
const http = (body: unknown, seen: string[] = []): HttpClient => ({ json: async (u: string) => { seen.push(u); return body as never; }, text: async () => '' });

test('Normalfall: Monatswerte, "." entfällt', async () => {
  const seen: string[] = [];
  const res = await eggs.collect({ now: NOW, key: () => 'K', log: () => {}, http: http(SAMPLE, seen) });
  assert.ok(seen[0].includes('series_id=APU0000708111') && seen[0].includes('api_key=K'));
  assert.deepEqual(res.observations.map((o) => [o.signalId, o.ts, o.value]), [
    ['bio.markets.poultry_stocks', '2026-09-01T00:00:00.000Z', 2.53], ['bio.markets.poultry_stocks', '2026-10-01T00:00:00.000Z', 2.32]]);
});
test('leere Antwort und fehlendes Feld', async () => {
  assert.deepEqual((await eggs.collect({ now: NOW, key: () => 'K', log: () => {}, http: http({ observations: [] }) })).observations, []);
  await assert.rejects(eggs.collect({ now: NOW, key: () => 'K', log: () => {}, http: http({}) }), /observations/);
});
test('Fehlermeldung ohne Key', async () => {
  const h: HttpClient = { json: async (u: string) => { throw new Error(`HTTP 400 ${u}`); }, text: async () => '' };
  await assert.rejects(eggs.collect({ now: NOW, key: () => 'SECRETKEY', log: () => {}, http: h }), (e: Error) => !e.message.includes('SECRETKEY') && e.message.includes('REDACTED'));
});
test('ohne Key: Runner überspringt, Signal needs-key', async () => {
  const [r] = await runCollectors([eggs], fileStore(mkdtempSync(join(tmpdir(), 'sr-eggs-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_FRED_KEY)');
  assert.equal(r.observations, 0);
  assert.equal(activate({ signals: [] } as never, [eggs], {}).signals[0].status, 'needs-key');
});
