import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseSth, logUrl, LOGS, shard } from '../../src/collectors/ct-logs.ts';

// gekürzter echter Ausschnitt (Google Argon, 17.11.2026)
const SAMPLE = { tree_size: 3501950757, timestamp: 1794871750602, sha256_root_hash: 'y/1N4/rB/Ziykeo4ouNW+YI1fByDVKL8XmJXZNTerzU=' };

test('parseSth: Normalfall', () => assert.equal(parseSth(SAMPLE), 3501950757));
test('parseSth: leere Antwort', () => assert.throws(() => parseSth({}), /tree_size/));
test('parseSth: Feld keine Zahl', () => assert.throws(() => parseSth({ tree_size: 'x' }), /Zahl/));
test('Shard und URLs für 2026-11-17', () => {
  const now = new Date('2026-11-17T00:00:00Z');
  assert.deepEqual(shard(now), { year: 2026, half: 2 });
  assert.equal(logUrl(LOGS[0], now), 'https://ct.googleapis.com/logs/us1/argon2026h2/ct/v1/get-sth');
  assert.equal(LOGS.length, 3);
  assert.equal(logUrl(LOGS[2], now), 'https://ct.cloudflare.com/logs/nimbus2026/ct/v1/get-sth');
});
test('collect: Rohstand zu ctx.now, Rate-Signale, Teilfehler tolerant', async () => {
  const logs: string[] = [];
  let n = 0;
  const res = await collector.collect({
    now: new Date('2026-11-17T10:25:00Z'), key: () => undefined, log: (m) => logs.push(m),
    http: { json: async () => { if (n++ === 1) throw new Error('down'); return SAMPLE as never; }, text: async () => '' },
  });
  assert.equal(res.observations.length, 2);
  assert.equal(res.observations[0].ts, '2026-11-17T10:25:00.000Z');
  assert.equal(res.observations[0].value, 3501950757);
  assert.equal(logs.length, 1);
  assert.ok(collector.signals.every((s) => s.weight === 0.5 && s.domain === 'dns_core' && s.transform === 'rate' && s.kind === 'gauge'));
});
