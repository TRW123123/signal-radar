import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector from '../../src/collectors/blackout-energy-prices-github.ts';

// gekürzte echte Ausschnitte (daily.csv / brent-daily.csv, Stand 17.11.2026)
const GAS = 'Date,Price\n1997-01-07,3.82\n2026-11-09,2.89\n2026-11-10,3.0\n2026-11-11,3.0\n';
const BRENT = 'Date,Price\n1987-05-20,18.63\n2026-11-09,91.03\n2026-11-10,90.16\n2026-11-11,92.14\n';

test('beide Reihen unter blackout-IDs', async () => {
  const bodies: Record<string, string> = { 'natural-gas/daily.csv': GAS, 'oil-prices/brent-daily.csv': BRENT };
  const http = { json: async () => ({}), text: async (_u: string, i?: { fixture?: string }) => bodies[i!.fixture!] } as never;
  const r = await collector.collect({ now: new Date('2026-11-17T00:16:00Z'), http, key: () => undefined, log: () => {} });
  assert.equal(r.observations.length, 6);
  assert.deepEqual(r.observations.filter((o) => o.signalId === 'blackout.markets.brent_oil').map((o) => o.value), [91.03, 90.16, 92.14]);
  assert.equal(r.observations.find((o) => o.signalId === 'blackout.markets.henry_hub_gas' && o.ts === '2026-11-11T00:00:00.000Z')?.value, 3);
});
test('veraltete Reihe wirft', async () => {
  const http = { json: async () => ({}), text: async () => 'Date,Price\n2026-10-01,80\n' } as never;
  await assert.rejects(collector.collect({ now: new Date('2026-11-17T00:16:00Z'), http, key: () => undefined, log: () => {} }), /veraltet/);
});
test('Signale haben maxAgeHours', () => {
  for (const s of collector.signals) assert.equal(s.maxAgeHours, 336);
});
