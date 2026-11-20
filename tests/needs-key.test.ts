import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from '../src/core/store.ts';
import { activate } from '../src/core/registry.ts';
import { runCollectors } from '../src/pipeline/collect.ts';
import type { Collector, HttpClient } from '../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
const http = {} as HttpClient;

function col(id: string, needsKey: Collector['needsKey']): Collector {
  return {
    id, title: id, sourceUrl: 'https://example.org', needsKey, intervalMinutes: 60,
    signals: [{ id: `x.${id}.s` }],
    collect: async () => ({ observations: [{ signalId: `x.${id}.s`, ts: NOW.toISOString(), value: 1 }] }),
  } as Collector;
}

async function run(c: Collector, env: Record<string, string | undefined>) {
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-key-')));
  const [r] = await runCollectors([c], store, { now: NOW, http, env });
  const status = activate({ signals: [] } as never, [c], env).signals[0].status;
  return { r, status };
}

test('needsKey array: all keys set runs the collector', async () => {
  const { r, status } = await run(col('arr', ['SR_A', 'SR_B']), { SR_A: 'a', SR_B: 'b' });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, undefined);
  assert.equal(r.observations, 1);
  assert.equal(status, 'active');
});

test('needsKey array: one key missing skips without error', async () => {
  const { r, status } = await run(col('arr', ['SR_A', 'SR_B']), { SR_A: 'a' });
  assert.equal(r.ok, true);
  assert.equal(r.error, undefined);
  assert.equal(r.skipped, 'kein Key (SR_A, SR_B)');
  assert.equal(r.observations, 0);
  assert.equal(status, 'needs-key');
});

test('needsKey string: unchanged behaviour', async () => {
  const missing = await run(col('str', 'SR_A'), {});
  assert.equal(missing.r.ok, true);
  assert.equal(missing.r.skipped, 'kein Key (SR_A)');
  assert.equal(missing.status, 'needs-key');
  const set = await run(col('str', 'SR_A'), { SR_A: 'a' });
  assert.equal(set.r.skipped, undefined);
  assert.equal(set.r.observations, 1);
  assert.equal(set.status, 'active');
});
