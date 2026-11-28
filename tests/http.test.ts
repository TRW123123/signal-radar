import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cookieHeader, createHttp, fixtureName, redactText, redactUrl } from '../src/core/http.ts';
import { runCollectors, secretValues } from '../src/pipeline/collect.ts';
import { fileStore } from '../src/core/store.ts';
import type { Collector, HttpClient } from '../src/core/types.ts';

type Call = { url: string; method?: string; body?: unknown; headers: Record<string, string> };
function fakeFetch(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const c = { url, method: init.method, body: init.body, headers: init.headers as Record<string, string> };
    calls.push(c);
    return respond(c);
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const tmp = () => mkdtempSync(join(tmpdir(), 'sr-http-'));

test('POST: method, body, headers gehen raus; Status, Header und Cookie kommen zurück', async () => {
  const { impl, calls } = fakeFetch(() => {
    const h = new Headers({ 'content-type': 'application/json' });
    h.append('set-cookie', 'chocolatechip=abc; path=/; HttpOnly');
    h.append('set-cookie', 'other=1; Secure');
    return new Response('""', { status: 200, headers: h });
  });
  const http = createHttp({ fixturesDir: tmp(), mode: 'network', minHostIntervalMs: 0, fetchImpl: impl });
  const r = await http.request('https://example.org/login', { method: 'POST', body: 'a=1&b=2', fixture: 'x/login.json', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].body, 'a=1&b=2');
  assert.equal(calls[0].headers['content-type'], 'application/x-www-form-urlencoded');
  assert.match(calls[0].headers['user-agent'], /SignalRadar/);
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'application/json');
  assert.deepEqual(r.setCookie, ['chocolatechip=abc; path=/; HttpOnly', 'other=1; Secure']);
  assert.equal(r.cookie, 'chocolatechip=abc; other=1');
  assert.equal(cookieHeader(['a=1; Path=/', 'junk']), 'a=1');
});

test('GET ohne method bleibt GET ohne Body (Abwärtskompatibilität)', async () => {
  const { impl, calls } = fakeFetch(() => new Response('{"ok":1}'));
  const http = createHttp({ fixturesDir: tmp(), mode: 'network', minHostIntervalMs: 0, fetchImpl: impl });
  assert.deepEqual(await http.json('https://example.org/a'), { ok: 1 });
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].body, undefined);
});

test('POST braucht fixture-Namen', () => {
  assert.throws(() => fixtureName('https://example.org/login?key=secret', { method: 'POST' }), (e: Error) => /fixture/.test(e.message) && !e.message.includes('secret'));
  assert.equal(fixtureName('https://example.org/q', { method: 'POST', fixture: 'x/q.json' }), 'x/q.json');
});

test('record: POST-Antwort mit fixture-Namen wird gespeichert, replay liest sie wieder', async () => {
  const dir = tmp();
  const { impl } = fakeFetch(() => new Response('{"rows":[1,2]}'));
  const rec = createHttp({ fixturesDir: dir, mode: 'record', minHostIntervalMs: 0, fetchImpl: impl });
  await rec.json('https://example.org/query', { method: 'POST', body: 'q=1', fixture: 'x/query.json' });
  assert.equal(readFileSync(join(dir, 'x/query.json'), 'utf8'), '{"rows":[1,2]}');
  const rep = createHttp({ fixturesDir: dir, mode: 'replay' });
  const r = await rep.request('https://example.org/query', { method: 'POST', body: 'q=1', fixture: 'x/query.json' });
  assert.deepEqual([r.status, r.body, r.cookie], [200, '{"rows":[1,2]}', '']);
});

test('record: Login-Antworten mit Token oder Cookie werden nie aufgezeichnet', async () => {
  const dir = tmp();
  const { impl } = fakeFetch((c) => {
    if (c.url.endsWith('/cookie')) return new Response('""', { headers: { 'set-cookie': 'sid=s3cr3t' } });
    if (c.url.endsWith('/token')) return new Response('{"access_token":"tok","expires_in":1}');
    return new Response('{"plain":true}');
  });
  const rec = createHttp({ fixturesDir: dir, mode: 'record', minHostIntervalMs: 0, fetchImpl: impl });
  await rec.request('https://example.org/cookie', { method: 'POST', body: 'u=p', fixture: 'x/cookie.json' });
  await rec.request('https://example.org/token', { method: 'POST', body: 'g=c', fixture: 'x/token.json' });
  await rec.request('https://example.org/secret', { method: 'POST', body: 'g=c', fixture: 'x/secret.json', secret: true });
  await rec.request('https://example.org/plain', { fixture: 'x/plain.json' });
  assert.equal(existsSync(join(dir, 'x/cookie.json')), false);
  assert.equal(existsSync(join(dir, 'x/token.json')), false);
  assert.equal(existsSync(join(dir, 'x/secret.json')), false);
  assert.equal(existsSync(join(dir, 'x/plain.json')), true);
  // replay: fehlende Login-Fixture ist ein klarer Fehler, eine handgemachte wird gelesen
  const rep = createHttp({ fixturesDir: dir, mode: 'replay' });
  await assert.rejects(rep.request('https://example.org/token', { method: 'POST', fixture: 'x/token.json', secret: true }), /fixture missing/);
  mkdirSync(join(dir, 'x'), { recursive: true });
  writeFileSync(join(dir, 'x/token.json'), '{"access_token":"dummy"}');
  assert.equal((await rep.request('https://example.org/token', { method: 'POST', fixture: 'x/token.json', secret: true })).body, '{"access_token":"dummy"}');
});

test('HTTP-Fehler: Fehlermeldung ohne Key in Query und Pfad', async () => {
  const { impl } = fakeFetch(() => new Response('nope', { status: 403 }));
  const http = createHttp({ fixturesDir: tmp(), mode: 'network', minHostIntervalMs: 0, fetchImpl: impl });
  const key = '0123456789abcdef0123456789abcdef';
  await assert.rejects(http.text(`https://firms.example/api/area/csv/${key}/VIIRS/1,2,3,4/2?api_key=abc123`),
    (e: Error) => e.message.startsWith('HTTP 403') && !e.message.includes(key) && !e.message.includes('abc123'));
});

test('redactUrl: Query-Parameter (alle Schreibweisen), Pfad-Keys, Userinfo', () => {
  for (const p of ['api_key', 'apiKey', 'api-key', 'apikey', 'key', 'token', 'access_token', 'auth_key', 'MAP_KEY', 'client_secret', 'password', 'securityToken', 'security_token']) {
    const r = redactUrl(`https://x.example/a?${p}=S3CRETvalue&series_id=DGS10`);
    assert.ok(!r.includes('S3CRETvalue'), p);
    assert.ok(r.includes('series_id=DGS10'), p);
  }
  assert.equal(redactUrl('https://firms.modaps.eosdis.nasa.gov/api/area/csv/0123456789abcdef0123456789ABCDEF/VIIRS_NOAA20_NRT/22,44,40,52/2'),
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/REDACTED/VIIRS_NOAA20_NRT/22,44,40,52/2');
  assert.ok(!redactUrl('https://x.example/v1/aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY3z/data').includes('aB3dE5'));
  assert.ok(!redactUrl('https://user:pw123@x.example/a').includes('pw123'));
  // harmlose URLs bleiben unverändert
  const plain = 'https://api.example.org/r/LocalLLaMA/about?raw_json=1&limit=10';
  assert.equal(redactUrl(plain), plain);
  assert.equal(redactUrl('not a url ?api_key=abc&x=1'), 'not a url ?api_key=REDACTED&x=1');
});

test('redactText: URLs im Text und bekannte Geheimnisse (auch URL- und Base64-kodiert)', () => {
  const t = redactText('fail https://a.example/x?token=zzz9 and p@ss/word and cDBzcw and p%40ss%2Fword', ['p@ss/word']);
  assert.ok(!t.includes('zzz9'));
  assert.ok(!t.includes('p@ss/word'));
  assert.ok(!t.includes('p%40ss%2Fword'));
  assert.equal(redactText('x', ['ab']), 'x');
});

test('Runner: Fehlermeldungen und Logs enthalten keine Keys', async () => {
  const secret = 'Zx9-very-secret-value';
  const c: Collector = {
    id: 'leaky', title: 'leaky', sourceUrl: 'https://x.example', needsKey: 'SR_LEAKY_KEY', intervalMinutes: 60, signals: [],
    async collect(ctx) {
      ctx.log(`calling https://x.example/q?key=${ctx.key('SR_LEAKY_KEY')}`);
      throw new Error(`HTTP 401 https://x.example/${ctx.key('SR_LEAKY_KEY')}/data (pass ${ctx.key('SR_OTHER_PASS')})`);
    },
  };
  const logs: string[] = [];
  const env = { SR_LEAKY_KEY: secret, SR_OTHER_PASS: 'hunter2hunter2' };
  const [r] = await runCollectors([c], fileStore(tmp()), { now: new Date(), http: {} as HttpClient, env, log: (m) => logs.push(m) });
  assert.equal(r.ok, false);
  assert.ok(!r.error!.includes(secret) && !r.error!.includes('hunter2'), r.error);
  assert.match(r.error!, /REDACTED/);
  assert.ok(logs.every((l) => !l.includes(secret)));
  assert.deepEqual(secretValues({ SR_FIXTURES: 'replay', SR_X_KEY: 'k1', SR_Y_USER: 'u1' }).sort(), ['k1', 'u1']);
});

test('redirect: gleiche https-Origin wird gefolgt, fremde Origin nicht', async () => {
  const { impl, calls } = fakeFetch((c) => {
    if (c.url === 'https://example.org/a') return new Response('', { status: 302, headers: { location: '/b' } });
    if (c.url === 'https://example.org/b') return new Response('{"ok":1}');
    if (c.url === 'https://example.org/out') return new Response('', { status: 302, headers: { location: 'https://evil.example/x' } });
    return new Response('no', { status: 500 });
  });
  const http = createHttp({ fixturesDir: tmp(), mode: 'network', minHostIntervalMs: 0, fetchImpl: impl });
  assert.deepEqual(await http.json('https://example.org/a'), { ok: 1 });
  assert.deepEqual(calls.map((c) => c.url), ['https://example.org/a', 'https://example.org/b']);
  await assert.rejects(http.text('https://example.org/out', { headers: { authorization: 'Bearer SECRETVALUE' } }), (e: Error) =>
    /redirect abgelehnt/.test(e.message) && !e.message.includes('SECRETVALUE'));
  assert.ok(calls.every((c) => !c.url.includes('evil.example')));
});

test('Body über dem Limit wird abgebrochen', async () => {
  const { impl } = fakeFetch(() => new Response('hello world'));
  const http = createHttp({ fixturesDir: tmp(), mode: 'network', minHostIntervalMs: 0, fetchImpl: impl, maxBodyBytes: 4 });
  await assert.rejects(http.text('https://example.org/big'), (e: Error) => /too large/.test(e.message) && !e.message.includes('hello'));
});

test('Netzwerkfehler: Ursache (cause) in der Meldung, Key geschwärzt', async () => {
  const { createHttp } = await import('../src/core/http.ts');
  const fetchImpl = (async () => { throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET', syscall: 'read' }) }); }) as unknown as typeof fetch;
  const h = createHttp({ fixturesDir: '/nonexistent', mode: 'network', minHostIntervalMs: 0, fetchImpl });
  await assert.rejects(h.text('https://example.test/x?api_key=SECRET1234'), (e: Error) =>
    /fetch failed \(Ursache: ECONNRESET read read ECONNRESET\)/.test(e.message) && !e.message.includes('SECRET1234'));
});
