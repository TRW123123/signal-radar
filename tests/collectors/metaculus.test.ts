import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parsePosts, dailyCounts, postsUrl } from '../../src/collectors/metaculus.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
// Nach OpenAPI-Spezifikation nachgebaut (docs/openapi.yml, Schema Post; aggregations bei Restricted-Konten null)
const post = (id: number, title: string, published_at: string) => ({ id, title, short_title: title, slug: `q-${id}`, published_at, status: 'open',
  nr_forecasters: 12, comment_count: 1, question: { id, title, type: 'binary', aggregations: { recency_weighted: { latest: null, history: null } } } });
const SAMPLE = { next: null, previous: null, results: [
  post(3, 'Will a major cyberattack hit a US utility before 2027?', '2026-11-19T15:00:00Z'),
  post(2, 'Will the EU sanction a ransomware group in 2026?', '2026-11-19T09:00:00Z'),
  post(1, 'Will inflation exceed 3%?', '2026-11-18T09:00:00Z'),
  post(0, 'Cyber incident at a G7 central bank?', '2026-11-16T09:00:00Z'),
] };

test('Normalfall: Titelfilter und Tageszählung ohne laufenden Tag', () => {
  const p = parsePosts(SAMPLE);
  assert.equal(p.published.length, 3);
  const o = dailyCounts(p, null, NOW);
  assert.equal(o.length, 7);
  assert.deepEqual(o.slice(-4).map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-16', 1], ['2026-11-17', 0], ['2026-11-18', 0], ['2026-11-19', 2]]);
});
test('abgeschnittene Liste: ältester Tag und älter entfallen', () => {
  const p = { ...parsePosts({ ...SAMPLE, next: 'https://www.metaculus.com/api/posts/?offset=4' }, 4) };
  assert.equal(p.truncated, true);
  const o = dailyCounts(p, '2026-11-16T09:00:00Z', NOW);
  assert.deepEqual(o.map((x) => x.ts.slice(0, 10)), ['2026-11-17', '2026-11-18', '2026-11-19']);
});
test('leer und fehlendes Feld', () => {
  assert.equal(dailyCounts(parsePosts({ next: null, results: [] }), null, NOW).every((o) => o.value === 0), true);
  assert.throws(() => parsePosts({ detail: 'x' }), /results/);
});
test('collect: Token-Header, URL mit Zeitfilter', async () => {
  let auth: string | undefined;
  let url = '';
  await collector.collect({ now: NOW, key: () => 'TOK', log: () => {}, http: { json: async (u: string, init) => { url = u; auth = init?.headers?.Authorization; return SAMPLE as never; }, text: async () => '' } });
  assert.equal(auth, 'Token TOK');
  assert.equal(url, postsUrl(NOW));
  assert.ok(url.includes('published_at__gt=2026-11-12'));
});
test('ohne Key: Runner überspringt, Signal needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-mc-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_METACULUS_KEY)');
  assert.equal(activate({ signals: [] } as never, [collector], {}).signals[0].status, 'needs-key');
});
