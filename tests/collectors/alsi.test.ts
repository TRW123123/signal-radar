import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseGie, dailySeries, inventoryPct, gwh } from '../../src/collectors/alsi.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
// Nach Doku nachgebaut (GIE API-Dokumentation v007, Kapitel 2.4 ALSI): inventory/dtmi als { lng, gwh }, sendOut/dtrs in GWh/d.
const row = (day: string, inv: string, send: string, status = 'C') => ({ name: 'Germany', code: 'DE', url: 'DE', gasDayStart: day,
  inventory: { lng: '300.00', gwh: inv }, sendOut: send, dtmi: { lng: '600.00', gwh: '4000.00' }, dtrs: '500.0', status, info: [], children: [] });
const SAMPLE = { last_page: 1, total: 4, dataset: 'DE', gas_day: '2026-11-18', data: [
  row('2026-11-15', '2000.00', '210.5'), row('2026-11-16', '1800.00', '230.0'), row('2026-11-17', '1700.00', '90.0', 'E'), row('2026-11-18', '1500.00', '20.0', 'E') ] };
const NO_KEY = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'alsi', 'no-key-error.json'), 'utf8'));

test('inventoryPct/gwh: Objekt- und Zahlform', () => {
  assert.equal(inventoryPct(SAMPLE.data[0]), 50);
  assert.equal(gwh({ lng: '1', gwh: '2.5' }), 2.5);
  assert.equal(gwh('3'), 3);
  assert.equal(inventoryPct({ inventory: { gwh: '1' }, dtmi: { gwh: '0' } }), null);
});
test('dailySeries: jüngste 2 Gastage entfallen', () => {
  const o = dailySeries('x', parseGie(SAMPLE), (r) => gwh(r.inventory));
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-15', 2000], ['2026-11-16', 1800]]);
});
test('leer, fehlendes Feld, echte Key-Fehlerantwort', () => {
  assert.deepEqual(parseGie({ data: [] }), []);
  assert.throws(() => parseGie({}), /data/);
  assert.throws(() => parseGie(NO_KEY), /Invalid or missing API key/);
});
test('collect: vier Signale, Header x-key', async () => {
  const res = await collector.collect({ now: NOW, key: () => 'K', log: () => {},
    http: { json: async (_u: string, init) => { assert.equal(init?.headers?.['x-key'], 'K'); return SAMPLE as never; }, text: async () => '' } });
  assert.deepEqual([...new Set(res.observations.map((o) => o.signalId))].sort(),
    ['blackout.gas.lng_inventory_eu', 'blackout.gas.lng_terminal_sendout', 'cyber.physical.lng_sendout_anomaly', 'war.energy.lng_terminals']);
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-alsi-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_ALSI_KEY)');
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
