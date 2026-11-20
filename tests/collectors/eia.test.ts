import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseRows, hourly, weekly } from '../../src/collectors/eia.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import { createHttp } from '../../src/core/http.ts';
import type { HttpClient } from '../../src/core/types.ts';

// Echte Antworten (20.11.2026, öffentlicher DEMO_KEY, Abruf ca. 10:20 UTC)
const fx = (n: string) => JSON.parse(readFileSync(join(FIX, 'eia', n), 'utf8'));
const FIX = join(import.meta.dirname, '..', '..', 'fixtures');
const NOW = new Date('2026-11-20T10:30:00Z');

test('parseRows: echte PJM-Antwort', () => {
  const rows = parseRows(fx('pjm-demand.json'));
  assert.equal(rows.length, 28);
  assert.deepEqual(rows[0], { period: '2026-11-20T08', value: 85052 });
});
test('hourly: aufsteigend, jüngste 2 Stunden entfallen, laufende Stunde nie', () => {
  const o = hourly('x', parseRows(fx('us48-demand.json')), NOW);
  assert.equal(o.length, 26);
  assert.equal(o.at(-1)!.ts, '2026-11-20T06:00:00.000Z');
  assert.ok(o[0].ts < o.at(-1)!.ts);
  assert.equal(hourly('x', [{ period: '2026-11-20T10', value: 1 }], NOW, 0).length, 0);
});
test('weekly: echte SPR-Antwort', () => {
  const o = weekly('x', parseRows(fx('spr-weekly.json')));
  assert.equal(o.length, 24);
  assert.deepEqual([o.at(-1)!.ts, o.at(-1)!.value], ['2026-11-13T00:00:00.000Z', 276361]);
});
test('parseRows: leer, fehlendes Feld, echte Fehlerform', () => {
  assert.deepEqual(parseRows({ response: { total: '0', data: [] } }), []);
  assert.throws(() => parseRows({ response: {} }), /response.data/);
  assert.throws(() => parseRows({}), /response/);
  assert.throws(() => parseRows(fx('error-rate-limit.json')), /OVER_RATE_LIMIT/);
});
test('collect gegen Aufzeichnungen (replay)', async () => {
  const http = createHttp({ fixturesDir: FIX, mode: 'replay' });
  const res = await collector.collect({ now: NOW, http, key: () => 'K', log: () => {} });
  const ids = new Set(res.observations.map((o) => o.signalId));
  assert.deepEqual([...ids].sort(), ['ai.compute.datacenter_load_pjm', 'cyber.physical.us_demand_balancing_authorities', 'war.energy.us_spr_stocks']);
});
test('collect: Teilfehler toleriert, Key in Logs geschwärzt', async () => {
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, key: () => 'SECRETKEY', log: (m) => logs.push(m),
    http: { json: async (u: string) => { if (u.includes('petroleum')) throw new Error(`HTTP 403 ${u}`); return fx('pjm-demand.json'); }, text: async () => '' } });
  assert.ok(res.observations.length > 0);
  assert.ok(logs.length === 1 && logs[0].includes('REDACTED') && !logs[0].includes('SECRETKEY'));
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-eia-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_EIA_KEY)');
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
