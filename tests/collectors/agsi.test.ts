import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseGie, dailySeries } from '../../src/collectors/agsi.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
// Nach Doku nachgebaut (GIE API-Dokumentation v007, Kapitel 2.3 AGSI): Zahlen teils als Text, Status E/C/N.
const row = (day: string, full: string, nw: string, status = 'C') => ({ name: 'EU', code: 'eu', url: 'eu', gasDayStart: day, gasInStorage: '900.1',
  injection: '10.00', withdrawal: '0', netWithdrawal: nw, workingGasVolume: '1100.0', status, trend: '-0.3', full, info: [], children: [] });
const SAMPLE = { last_page: 1, total: 5, dataset: 'EU', gas_day: '2026-11-18', data: [
  row('2026-11-18', '82.10', '2900.00', 'E'), row('2026-11-17', '82.40', '2800.00', 'E'), row('2026-11-16', '82.70', '2600.50'),
  row('2026-11-15', '82.95', '2500.00', 'N'), row('2026-11-14', '83.20', '2400.00') ] };
// Echte Antwort ohne Key (20.11.2026)
const NO_KEY = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'agsi', 'no-key-error.json'), 'utf8'));

test('parseGie/dailySeries: aufsteigend, jüngste 2 Tage und Status N entfallen', () => {
  const rows = parseGie(SAMPLE);
  assert.equal(rows[0].day, '2026-11-14');
  const o = dailySeries('x', rows, (r) => Number(r.full));
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-14', 83.2], ['2026-11-16', 82.7]]);
});
test('leer, fehlendes Feld, echte Key-Fehlerantwort (HTTP 200 mit error)', () => {
  assert.deepEqual(parseGie({ last_page: 0, total: 0, data: [] }), []);
  assert.throws(() => parseGie({ total: 0 }), /data/);
  assert.throws(() => parseGie(NO_KEY), /access denied.*Invalid or missing API key/);
});
test('collect: Header x-key, beide Abrufe, drei Signale', async () => {
  const seen: [string, string | undefined][] = [];
  const res = await collector.collect({ now: NOW, key: () => 'K', log: () => {},
    http: { json: async (u: string, init) => { seen.push([u, init?.headers?.['x-key']]); return SAMPLE as never; }, text: async () => '' } });
  assert.equal(seen.length, 2);
  assert.ok(seen[1][0].includes('company=37X0000000002964&facility=21Z000000000271O'));
  assert.ok(seen.every(([u, h]) => h === 'K' && !u.includes('K&') && u.includes('to=2026-11-19')));
  assert.deepEqual([...new Set(res.observations.map((o) => o.signalId))].sort(),
    ['blackout.gas.storage_by_site_critical', 'cyber.physical.storage_level_anomaly_eu', 'war.energy.eu_gas_storage']);
  assert.equal(res.observations.find((o) => o.signalId === 'cyber.physical.storage_level_anomaly_eu')!.value, 2400);
});
test('collect: Key-Fehler aller Abrufe -> Fehler', async () => {
  await assert.rejects(collector.collect({ now: NOW, key: () => 'K', log: () => {}, http: { json: async () => NO_KEY, text: async () => '' } }), /alle Abrufe/);
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-agsi-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_AGSI_KEY)');
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
