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
