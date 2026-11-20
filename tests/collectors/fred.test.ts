import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { SPECS, parseObservations, toObservations, seriesUrl } from '../../src/collectors/fred.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');

// Nach Doku nachgebaut (https://fred.stlouisfed.org/docs/api/fred/series_observations.html, file_type=json);
// Werte aus der echten keyfreien fredgraph.csv vom 20.11.2026 (DGS10, VIXCLS, VXVCLS), "." = fehlender Wert (Feiertag).
const obsBody = (rows: [string, string][]) => ({
  realtime_start: '2026-11-20', realtime_end: '2026-11-20', observation_start: '2026-09-21', observation_end: '9999-12-31',
  units: 'lin', output_type: 1, file_type: 'json', order_by: 'observation_date', sort_order: 'asc', count: rows.length, offset: 0, limit: 100000,
  observations: rows.map(([date, value]) => ({ realtime_start: '2026-11-20', realtime_end: '2026-11-20', date, value })),
});
const DGS10 = obsBody([['2026-11-11', '.'], ['2026-11-17', '5.05'], ['2026-11-18', '5.07']]);
const VIX = obsBody([['2026-11-17', '25.10'], ['2026-11-18', '24.56']]);
const VIX3M = obsBody([['2026-11-18', '24.29']]);

test('parseObservations: Normalfall, "." entfällt', () => {
  const m = parseObservations(DGS10);
  assert.deepEqual([...m.entries()], [['2026-11-17', 5.05], ['2026-11-18', 5.07]]);
});
test('parseObservations: leer, fehlendes Feld, FRED-Fehler (echte Form ohne Key)', () => {
  assert.equal(parseObservations(obsBody([])).size, 0);
  assert.throws(() => parseObservations({ count: 0 }), /observations/);
  assert.throws(() => parseObservations({ error_code: 400, error_message: 'Bad Request.  Variable api_key is not set.' }), /api_key is not set/);
});
test('toObservations: Tageswert auf T00:00Z, kombinierte Reihe nur an gemeinsamen Tagen', () => {
  const s = SPECS.find((x) => x.id === 'war.markets.us_10y_yield')!;
  assert.deepEqual(toObservations(s, [parseObservations(DGS10)]).map((o) => [o.ts, o.value]), [['2026-11-17T00:00:00.000Z', 5.05], ['2026-11-18T00:00:00.000Z', 5.07]]);
  const t = SPECS.find((x) => x.id === 'cyber.markets.vix_term_structure')!;
  const o = toObservations(t, [parseObservations(VIX), parseObservations(VIX3M)]);
  assert.equal(o.length, 1);
  assert.ok(Math.abs(o[0].value - 24.56 / 24.29) < 1e-9);
  const hy = SPECS.find((x) => x.id === 'war.markets.hy_credit_spread')!;
  assert.equal(toObservations(hy, [parseObservations(obsBody([['2026-11-18', '3.47']]))])[0].value, 347);
  const fx = SPECS.find((x) => x.id === 'cyber.markets.safe_haven_fx')!;
  assert.ok(Math.abs(toObservations(fx, [parseObservations(obsBody([['2026-11-13', '0.8389']]))])[0].value - 1 / 0.8389) < 1e-12);
});
test('Signale: Katalog-ids, keine doppelten, Key-Name', () => {
  assert.equal(collector.needsKey, 'SR_FRED_KEY');
  const ids = collector.signals.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 31);
  for (const s of collector.signals) {
    assert.ok(s.evidenceClass && s.direction && s.kind && s.baseline && s.independenceGroup, s.id);
    assert.equal(s.collector, 'fred');
  }
  assert.ok(!ids.includes('war.markets.brent_price'));
});
test('collect: ein Request je Serie, Teilfehler toleriert, Key in Fehlern geschwärzt', async () => {
  const urls: string[] = [];
  const logs: string[] = [];
  const res = await collector.collect({
    now: NOW, key: () => 'SECRETKEY', log: (m) => logs.push(m),
    http: {
      json: async (url: string) => {
        urls.push(url);
        if (url.includes('series_id=OVXCLS')) throw new Error(`HTTP 500 ${url}`);
        return (url.includes('series_id=DGS10') ? DGS10 : obsBody([])) as never;
      },
      text: async () => '',
    },
  });
  assert.equal(urls.length, new Set(SPECS.flatMap((s) => s.series)).size);
  assert.ok(urls[0].includes('file_type=json') && urls[0].includes('observation_start='));
  assert.ok(res.observations.some((o) => o.signalId === 'finance.markets.us_10y_yield' && o.value === 5.07));
  assert.ok(logs.some((l) => l.includes('OVXCLS') && l.includes('REDACTED') && !l.includes('SECRETKEY')));
});
test('collect: alle Serien fehlgeschlagen -> Fehler ohne Key im Text', async () => {
  await assert.rejects(
    collector.collect({ now: NOW, key: () => 'SECRETKEY', log: () => {}, http: { json: async (u: string) => { throw new Error(`HTTP 400 ${u}`); }, text: async () => '' } }),
    (e: Error) => /alle Serien/.test(e.message) && !e.message.includes('SECRETKEY'),
  );
});
test('seriesUrl: Key nur als api_key', () => {
  assert.equal(seriesUrl('DGS10', 'K', '2026-01-01'), 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=K&file_type=json&observation_start=2026-01-01&sort_order=asc');
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-fred-')));
  const reports = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  for (const r of reports) { assert.equal(r.ok, true); assert.equal(r.skipped, 'kein Key (SR_FRED_KEY)'); assert.equal(r.observations, 0); }
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
