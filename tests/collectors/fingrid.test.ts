import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { buildUrl, frequencyHourly, nuclearHourly, parseRows, SIG_FREQ, SIG_NUCLEAR } from '../../src/collectors/fingrid.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`../../fixtures/fingrid/${n}`, import.meta.url), 'utf8'));

test('parseRows: echte Portal-Antwort (Datensätze 177 und 188, je 5 Zeilen, 20.11.2026)', () => {
  const f = parseRows(fx('portal-embedded-177.json'));
  const n = parseRows(fx('portal-embedded-188.json'));
  assert.equal(f.length, 5);
  assert.equal(n.length, 5);
  assert.ok(f.every((r) => r.datasetId === 177 && r.value > 49 && r.value < 51));
  assert.ok(n.every((r) => r.datasetId === 188 && r.value > 1000));
});

// Stundenwerte: Zeilen nach Doku-Form nachgebaut (3-min-Atomstrom, Minuten-Frequenz)
function rows(ds: number, from: string, n: number, stepMin: number, v: (i: number) => number) {
  const t0 = Date.parse(from);
  return Array.from({ length: n }, (_, i) => ({ datasetId: ds, startTime: new Date(t0 + i * stepMin * 60_000).toISOString(), endTime: '', value: v(i) }));
}
const NOW = new Date('2026-11-20T10:20:00Z');
const BODY = { data: [
  ...rows(188, '2026-11-20T08:00:00Z', 20, 3, () => 3800),
  ...rows(188, '2026-11-20T09:00:00Z', 10, 3, () => 3900), // unvollständige Stunde
  ...rows(188, '2026-11-20T10:00:00Z', 6, 3, () => 3900), // laufende Stunde
  ...rows(177, '2026-11-20T08:00:00Z', 60, 1, (i) => (i === 7 ? 49.912 : 50.01)),
  ...rows(177, '2026-11-20T09:00:00Z', 60, 1, () => 49.98),
] };

test('nuclearHourly: Mittelwert nur für vollständige, abgeschlossene Stunden', () => {
  const o = nuclearHourly(parseRows(BODY), NOW);
  assert.deepEqual(o.map((x) => [x.ts, x.value]), [['2026-11-20T08:00:00.000Z', 3800]]);
  assert.equal(o[0].signalId, SIG_NUCLEAR);
});

test('frequencyHourly: größte Abweichung in mHz', () => {
  const o = frequencyHourly(parseRows(BODY), NOW);
  assert.deepEqual(o.map((x) => x.value), [88, 20]);
  assert.equal(o[0].signalId, SIG_FREQ);
});

test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parseRows({ data: [] }), []);
  assert.deepEqual(nuclearHourly([], NOW), []);
  assert.throws(() => parseRows({} as never), /data/);
  assert.throws(() => parseRows({ data: 'x' }), /keine Liste/);
  // Zeile ohne value wird verworfen
  assert.equal(parseRows({ data: [{ datasetId: 188, startTime: '2026-11-20T08:00:00Z' }] }).length, 0);
});

test('buildUrl: beide Datensätze, 2-h-Fenster bis zur vollen Stunde, kein Key in der URL', () => {
  const u = new URL(buildUrl(NOW));
  assert.equal(u.searchParams.get('datasets'), '177,188');
  assert.equal(u.searchParams.get('startTime'), '2026-11-20T08:00:00.000Z');
  assert.equal(u.searchParams.get('endTime'), '2026-11-20T10:00:00.000Z');
  assert.ok(!u.toString().includes('key'));
});

test('collect: Key als Header x-api-key', async () => {
  let hdr: string | undefined;
  const res = await collector.collect({ now: NOW, key: () => 'K', log: () => {},
    http: { json: async (_u: string, init) => { hdr = init?.headers?.['x-api-key']; return BODY as never; }, text: async () => '' } });
  assert.equal(hdr, 'K');
  assert.equal(res.observations.length, 3);
});

test('Runner: ohne Key übersprungen, kein Fehler', async () => {
  assert.equal(collector.needsKey, 'SR_FINGRID_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-fingrid-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_FINGRID_KEY)');
});
