import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { decayUrl, loginBody, LOGIN_URL, parseDecay, SIG_DECAY } from '../../src/collectors/space-track.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// nach Doku nachgebaut (Klasse decay, Felder als Text)
const row = (id: string, type: string, msg: string) => ({ NORAD_CAT_ID: id, OBJECT_NUMBER: id, OBJECT_NAME: 'STARLINK-1', INTLDES: '2020-001A',
  OBJECT_ID: '2020-001A', RCS: '0', RCS_SIZE: 'LARGE', COUNTRY: 'US', MSG_EPOCH: msg, DECAY_EPOCH: '2026-11-19 04:12:00', SOURCE: '60day',
  MSG_TYPE: type, PRECEDENCE: '1' });
const SAMPLE = [
  row('44001', 'Historical', '2026-11-19 06:00:00'),
  row('44001', 'Historical', '2026-11-19 07:00:00'), // doppelt, zählt einmal
  row('44002', 'Historical', '2026-11-19 23:59:00'),
  row('44003', 'Prediction', '2026-11-19 10:00:00'),
  row('44004', 'Historical', '2026-11-20 01:00:00'), // heute
];
const NOW = new Date('2026-11-20T18:00:00Z');

test('parseDecay: Normalfall', () => {
  const o = parseDecay(SAMPLE, NOW);
  assert.deepEqual([o.signalId, o.ts, o.value], [SIG_DECAY, '2026-11-19T00:00:00.000Z', 2]);
});

test('leere Antwort = 0, fehlendes Feld wirft', () => {
  assert.equal(parseDecay([], NOW).value, 0);
  assert.throws(() => parseDecay({ error: 'login' }, NOW), /Liste/);
  assert.throws(() => parseDecay([{ NORAD_CAT_ID: '1', MSG_EPOCH: '2026-11-19 06:00:00' }], NOW), /MSG_TYPE/);
});

test('decayUrl: Vortag, 1 Abfrage/Tag', () => {
  assert.equal(decayUrl(NOW), 'https://www.space-track.org/basicspacedata/query/class/decay/MSG_EPOCH/2026-11-19--2026-11-20/orderby/DECAY_EPOCH%20desc/format/json');
  assert.equal(collector.intervalMinutes, 1440);
});

function fakeHttp(loginBody: string, setCookie: string[]) {
  const calls: { url: string; init: Record<string, unknown> | undefined }[] = [];
  const http = {
    request: async (url: string, init?: Record<string, unknown>) => {
      calls.push({ url, init });
      return { status: 200, headers: {}, setCookie, cookie: setCookie.map((c) => c.split(';')[0]).join('; '), body: loginBody };
    },
    json: async (url: string, init?: Record<string, unknown>) => { calls.push({ url, init }); return SAMPLE; },
    text: async () => '',
  } as unknown as HttpClient;
  return { http, calls };
}
const keys = (n: string) => ({ SR_SPACE_TRACK_USER: 'me@example.org', SR_SPACE_TRACK_PASS: 'p&ss=word' } as Record<string, string>)[n];

test('collect: POST-Login (geheim, nicht aufgezeichnet), dann Abfrage mit Cookie', async () => {
  const { http, calls } = fakeHttp('""', ['chocolatechip=abc123; path=/; secure; HttpOnly']);
  const res = await collector.collect({ now: NOW, key: keys, log: () => {}, http });
  assert.equal(res.observations[0].value, 2);
  assert.equal(calls[0].url, LOGIN_URL);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[0].init?.secret, true);
  assert.equal(calls[0].init?.body, 'identity=me%40example.org&password=p%26ss%3Dword');
  assert.equal(loginBody('a', 'b'), 'identity=a&password=b');
  assert.equal(calls[1].url, decayUrl(NOW));
  assert.deepEqual(calls[1].init?.headers, { cookie: 'chocolatechip=abc123' });
});

test('collect: Login fehlgeschlagen oder ohne Cookie -> Fehler ohne Passwort', async () => {
  await assert.rejects(collector.collect({ now: NOW, key: keys, log: () => {}, http: fakeHttp('{"Login":"Failed"}', []).http }), (e: Error) => /fehlgeschlagen/.test(e.message) && !e.message.includes('p&ss'));
  await assert.rejects(collector.collect({ now: NOW, key: keys, log: () => {}, http: fakeHttp('""', []).http }), /Cookie/);
});

test('Runner: ohne Keys übersprungen', async () => {
  assert.deepEqual(collector.needsKey, ['SR_SPACE_TRACK_USER', 'SR_SPACE_TRACK_PASS']);
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-st-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: { SR_SPACE_TRACK_PASS: 'p' } });
  assert.equal(r.skipped, 'kein Key (SR_SPACE_TRACK_USER, SR_SPACE_TRACK_PASS)');
});
