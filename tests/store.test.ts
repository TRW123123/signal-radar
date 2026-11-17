import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from '../src/core/store.ts';

test('store appends, de-duplicates by timestamp and ignores invalid values', async () => {
  const s = fileStore(mkdtempSync(join(tmpdir(), 'sr-')));
  const a = { signalId: 'x.y.z', ts: '2026-11-17T00:00:00Z', value: 1 };
  assert.equal(await s.append([a, { ...a, value: 2 }, { signalId: 'x.y.z', ts: '2026-11-17T01:00:00Z', value: NaN }]), 1);
  assert.equal(await s.append([a, { signalId: 'x.y.z', ts: '2026-11-17T02:00:00+00:00', value: 3 }]), 1);
  const back = await s.read('x.y.z');
  assert.deepEqual(back.map((o) => o.value), [1, 3]);
  await s.setJson('k', { a: 1 });
  assert.deepEqual(await s.getJson('k'), { a: 1 });
  assert.equal(await s.getJson('missing'), null);
});

import { applyTransform } from '../src/pipeline/snapshot.ts';
import { normalizeSignal } from '../src/core/catalog.ts';

test('rate transform turns a counter into increase per hour and drops resets and long gaps', () => {
  const def = normalizeSignal({ id: 'x.y.counter', transform: 'rate' });
  const at = (h: number, v: number) => ({ signalId: def.id, ts: new Date(Date.parse('2026-11-17T00:00:00Z') + h * 3600_000).toISOString(), value: v });
  const out = applyTransform(def, [at(0, 100), at(1, 160), at(3, 280), at(4, 10), at(5, 40), at(40, 5000)]);
  assert.deepEqual(out.map((o) => o.value), [60, 60, 30]);
});

test('pruneAll cuts old values but keeps what a long baseline window needs', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { pruneAll, SeriesStore } = await import('../src/core/store.ts');
  const dir = mkdtempSync(join(tmpdir(), 'sr-prune-'));
  const series = new SeriesStore(join(dir, 'series'));
  const now = Date.parse('2026-11-17T00:00:00Z');
  const day = (n: number) => new Date(now - n * 86400_000).toISOString();
  series.append([
    { signalId: 'a.short', ts: day(10), value: 1 }, { signalId: 'a.short', ts: day(200), value: 2 },
    { signalId: 'a.long', ts: day(10), value: 1 }, { signalId: 'a.long', ts: day(200), value: 2 }, { signalId: 'a.long', ts: day(400), value: 3 },
  ]);
  const n = pruneAll(dir, 120, (id) => (id === 'a.long' ? 365 : 0), now);
  assert.equal(n, 2);
  assert.equal(series.read('a.short').length, 1);
  assert.equal(series.read('a.long').length, 2);
});
