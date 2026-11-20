import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseChart, btcInGold, hourlySeries } from '../../src/collectors/coingecko.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import { createHttp } from '../../src/core/http.ts';
import type { HttpClient } from '../../src/core/types.ts';

// Echte Antworten ohne Key (20.11.2026, Abruf 09:27 UTC)
const fx = (n: string) => JSON.parse(readFileSync(join(FIX, 'coingecko', n), 'utf8'));
const FIX = join(import.meta.dirname, '..', '..', 'fixtures');
const NOW = new Date('2026-11-20T10:30:00Z');

test('btcInGold: echte Tagesreihen, Live-Punkt entfällt', () => {
  const o = btcInGold(parseChart(fx('bitcoin-30d.json'), 'prices'), parseChart(fx('pax-gold-30d.json'), 'prices'), NOW);
  assert.equal(o.length, 30);
  assert.ok(o.every((x) => x.ts.endsWith('T00:00:00.000Z')));
  assert.ok(o.at(-1)!.value > 5 && o.at(-1)!.value < 50);
});
test('hourlySeries: echte Tether-Reihe, nur volle Stunden', () => {
  const o = hourlySeries('x', parseChart(fx('tether-2d.json'), 'market_caps'), NOW);
  assert.equal(o.length, 48);
  assert.equal(o.at(-1)!.ts, '2026-11-20T09:00:00.000Z');
  assert.ok(o.at(-1)!.value > 1e11);
});
test('parseChart: leer, fehlendes Feld, Fehlerobjekt', () => {
  assert.deepEqual(parseChart({ prices: [], market_caps: [], total_volumes: [] }, 'prices'), []);
  assert.throws(() => parseChart({ prices: [] }, 'market_caps'), /market_caps/);
  assert.throws(() => parseChart({ status: { error_code: 429, error_message: "You've exceeded the Rate Limit" } }, 'prices'), /Rate Limit/);
});
test('collect gegen Aufzeichnungen (replay), Demo-Header gesetzt', async () => {
  const real = createHttp({ fixturesDir: FIX, mode: 'replay' });
  const headers: (string | undefined)[] = [];
  const http: HttpClient = { json: async (u, init) => { headers.push(init?.headers?.['x-cg-demo-api-key']); return real.json(u, init); }, text: real.text };
  const res = await collector.collect({ now: NOW, http, key: () => 'K', log: () => {} });
  assert.ok(headers.length === 3 && headers.every((h) => h === 'K'));
  assert.deepEqual([...new Set(res.observations.map((o) => o.signalId))].sort(), ['cyber.markets.bitcoin_vs_gold_divergence', 'war.markets.crypto_stablecoin_flows']);
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-cg-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_COINGECKO_KEY)');
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
