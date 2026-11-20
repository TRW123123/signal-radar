import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseAbout, toObservations, tokenRequest, aboutUrl } from '../../src/collectors/reddit-json.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:03:00Z');
// Nach Doku nachgebaut (GET /r/{subreddit}/about, Listing-Objekt kind t5; Werte erfunden)
const SAMPLE = { kind: 't5', data: { display_name: 'sysadmin', subscribers: 1012345, active_user_count: 2345, accounts_active: 2345, over18: false } };

test('parseAbout: Normalfall und Fallback accounts_active', () => {
  assert.deepEqual(parseAbout(SAMPLE), { active: 2345, subscribers: 1012345 });
  assert.equal(parseAbout({ kind: 't5', data: { active_user_count: null, accounts_active: 17 } }).active, 17);
});
test('parseAbout: leere Daten und fehlendes Feld', () => {
  assert.throws(() => parseAbout({ kind: 't5', data: {} }), /active_user_count/);
  assert.throws(() => parseAbout({ kind: 't5' }), /data/);
});
test('toObservations: Zeitstempel auf 5 Minuten', () => {
  const o = toObservations(NOW, [['cyber.attention.reddit_sysadmin_activity', SAMPLE]]);
  assert.deepEqual([o[0].ts, o[0].value], ['2026-11-20T12:00:00.000Z', 2345]);
});
test('tokenRequest/aboutUrl: App-only-OAuth laut Doku', () => {
  const t = tokenRequest('id', 'secret');
  assert.equal(t.url, 'https://www.reddit.com/api/v1/access_token');
  assert.equal(t.headers.Authorization, `Basic ${Buffer.from('id:secret').toString('base64')}`);
  assert.equal(t.body, 'grant_type=client_credentials');
  assert.equal(aboutUrl('LocalLLaMA'), 'https://oauth.reddit.com/r/LocalLLaMA/about?raw_json=1');
});
test('collect mit Keys: klarer Fehler (ctx.http ohne POST), kein Netzwerkzugriff', async () => {
  let called = false;
  const http: HttpClient = { json: async () => { called = true; return {} as never; }, text: async () => '' };
  await assert.rejects(collector.collect({ now: NOW, http, key: () => 'x', log: () => {} }), /POST/);
  assert.equal(called, false);
});
test('Key-Paar: ein Key fehlt -> Runner überspringt, Signale needs-key', async () => {
  assert.deepEqual(collector.needsKey, ['SR_REDDIT_USER', 'SR_REDDIT_PASS']);
  const env = { SR_REDDIT_USER: 'id' };
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-rd-'))), { now: NOW, http: {} as HttpClient, env });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_REDDIT_USER, SR_REDDIT_PASS)');
  assert.ok(activate({ signals: [] } as never, [collector], env).signals.every((s) => s.status === 'needs-key'));
});
