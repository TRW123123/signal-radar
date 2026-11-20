import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseAbout, parseToken, toObservations, tokenRequest, aboutUrl, REDDIT_UA } from '../../src/collectors/reddit-json.ts';
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
  assert.equal(t.headers.authorization, `Basic ${Buffer.from('id:secret').toString('base64')}`);
  assert.equal(t.body, 'grant_type=client_credentials');
  assert.equal(aboutUrl('LocalLLaMA'), 'https://oauth.reddit.com/r/LocalLLaMA/about?raw_json=1');
});
test('User-Agent im Reddit-Format, ohne Platzhalter', () => {
  assert.match(REDDIT_UA, /^server:signal-radar:v[\d.]+ \(by [^<>]+\)$/);
  assert.ok(!REDDIT_UA.includes('<'));
});
test('parseToken: Token lesen, Fehler ohne Geheimnis', () => {
  assert.equal(parseToken('{"access_token":"tok-1","token_type":"bearer","expires_in":86400}'), 'tok-1');
  assert.throws(() => parseToken('{"error":"invalid_grant"}'), /invalid_grant/);
  assert.throws(() => parseToken('<html>'), /kein JSON/);
});
test('collect: Token per POST (geheim), dann about mit Bearer und eigenem UA', async () => {
  const calls: { url: string; init?: Record<string, any> }[] = [];
  const http = {
    request: async (url: string, init?: Record<string, any>) => { calls.push({ url, init }); return { status: 200, headers: {}, setCookie: [], cookie: '', body: '{"access_token":"tok-1","token_type":"bearer"}' }; },
    json: async (url: string, init?: Record<string, any>) => {
      calls.push({ url, init });
      if (url.includes('LocalLLaMA')) throw new Error('HTTP 503');
      return SAMPLE;
    },
    text: async () => '',
  } as unknown as HttpClient;
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, http, key: (n) => (n === 'SR_REDDIT_USER' ? 'cid' : 'csecret'), log: (m) => logs.push(m) });
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.secret, true);
  assert.equal(calls[0].init?.body, 'grant_type=client_credentials');
  assert.equal(calls[1].url, aboutUrl('sysadmin'));
  assert.equal(calls[1].init?.headers.authorization, 'bearer tok-1');
  assert.equal(calls[1].init?.headers['user-agent'], REDDIT_UA);
  assert.deepEqual(res.observations.map((o) => [o.signalId, o.value]), [['cyber.attention.reddit_sysadmin_activity', 2345]]);
  assert.match(logs[0], /LocalLLaMA/);
});
test('Key-Paar: ein Key fehlt -> Runner überspringt, Signale needs-key', async () => {
  assert.deepEqual(collector.needsKey, ['SR_REDDIT_USER', 'SR_REDDIT_PASS']);
  const env = { SR_REDDIT_USER: 'id' };
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-rd-'))), { now: NOW, http: {} as HttpClient, env });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_REDDIT_USER, SR_REDDIT_PASS)');
  assert.ok(activate({ signals: [] } as never, [collector], env).signals.every((s) => s.status === 'needs-key'));
});
