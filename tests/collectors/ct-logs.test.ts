import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseSth, logUrl, LOGS, shard } from '../../src/collectors/ct-logs.ts';

// nach Doku (RFC 6962 get-sth) nachgebaut
const SAMPLE = { tree_size: 5160834212, timestamp: 1763337600000, sha256_root_hash: 'AAAA', tree_head_signature: 'BBBB' };

test('parseSth: Normalfall', () => assert.equal(parseSth(SAMPLE), 5160834212));
test('parseSth: leere Antwort', () => assert.throws(() => parseSth({}), /tree_size/));
test('parseSth: Feld keine Zahl', () => assert.throws(() => parseSth({ tree_size: 'x' }), /Zahl/));
test('Shard und URLs für 2026-11-17', () => {
  const now = new Date('2026-11-17T00:00:00Z');
  assert.deepEqual(shard(now), { year: 2026, half: 2 });
  assert.equal(logUrl(LOGS[0], now), 'https://ct.googleapis.com/logs/us1/argon2026h2/ct/v1/get-sth');
  assert.equal(logUrl(LOGS[3], now), 'https://ct.cloudflare.com/logs/nimbus2026/ct/v1/get-sth');
});
test('collect: Gewicht 0, Stundenzeitstempel, Teilfehler tolerant', async () => {
  const logs: string[] = [];
  let n = 0;
  const res = await collector.collect({
    now: new Date('2026-11-17T10:25:00Z'), key: () => undefined, log: (m) => logs.push(m),
    http: { json: async () => { if (n++ === 1) throw new Error('down'); return SAMPLE as never; }, text: async () => '' },
  });
  assert.equal(res.observations.length, 3);
  assert.equal(res.observations[0].ts, '2026-11-17T10:00:00.000Z');
  assert.equal(logs.length, 1);
  assert.ok(collector.signals.every((s) => s.weight === 0 && s.domain === 'context'));
});
