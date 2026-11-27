import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowedRequestUrl, fixtureFile, queueFilePath, runQueue } from '../scripts/fetch_queue.ts';
import { fileURLToPath } from 'node:url';

const tmp = () => mkdtempSync(join(tmpdir(), 'sr-queue-'));

test('allowedRequestUrl: nur https und bekannte Hosts', () => {
  assert.ok(allowedRequestUrl('https://stat.ripe.net/data/x'));
  assert.equal(allowedRequestUrl('http://stat.ripe.net/data/x'), null);
  assert.equal(allowedRequestUrl('https://user:pw@stat.ripe.net/data/x'), null);
  assert.equal(allowedRequestUrl('https://evil.example/data'), null);
  assert.equal(allowedRequestUrl('https://stat.ripe.net.evil.example/data'), null);
});

test('fixtureFile: nur unter fixtures/backtest', () => {
  const root = '/repo';
  assert.ok(fixtureFile(root, 'backtest/event/nyfed/sofr.json')?.endsWith('/fixtures/backtest/event/nyfed/sofr.json'));
  assert.equal(fixtureFile(root, 'backtest/../../etc/passwd'), null);
  assert.equal(fixtureFile(root, '../backtest/x.json'), null);
  assert.equal(fixtureFile(root, 'secrets/key.json'), null);
});

test('history-queue.json bleibt in der Allowlist', () => {
  const queue = JSON.parse(readFileSync(fileURLToPath(new URL('../backtest/history-queue.json', import.meta.url)), 'utf8')) as { fixture: string; url: string }[];
  assert.ok(queue.length > 0);
  for (const q of queue) {
    assert.ok(allowedRequestUrl(q.url), q.url);
    assert.ok(fixtureFile('/repo', q.fixture), q.fixture);
  }
});

test('queueFilePath bleibt im Repo', () => {
  const root = tmp();
  assert.ok(queueFilePath(root, 'backtest/history-queue.json').startsWith(root));
  assert.throws(() => queueFilePath(root, '../etc/passwd'), /escapes/);
});

test('runQueue speichert erlaubte Antworten und verwirft den Rest', async () => {
  const root = tmp();
  const seen: string[] = [];
  writeFileSync(join(root, 'queue.json'), JSON.stringify([
    { fixture: 'backtest/ok/a.json', url: 'https://stat.ripe.net/data/a' },
    { fixture: 'backtest/../../outside.json', url: 'https://stat.ripe.net/data/a' },
    { fixture: 'backtest/bad/b.json', url: 'https://evil.example/secret' },
    { fixture: 'backtest/redir/c.json', url: 'https://wikimedia.org/api/rest_v1/x' },
  ]));
  const fetchImpl = (async (url: string) => {
    seen.push(url);
    if (String(url).includes('wikimedia.org/api')) return new Response('', { status: 302, headers: { location: 'https://evil.example/landed' } });
    return new Response('{"ok":true}');
  }) as unknown as typeof fetch;
  const result = await runQueue(root, 'queue.json', fetchImpl);
  assert.equal(result.ok, 1);
  assert.equal(existsSync(join(root, 'fixtures/backtest/ok/a.json')), true);
  assert.equal(readFileSync(join(root, 'fixtures/backtest/ok/a.json'), 'utf8'), '{"ok":true}');
  assert.equal(existsSync(join(root, 'outside.json')), false);
  assert.ok(seen.every((u) => !u.includes('evil.example')));
  const log = JSON.parse(readFileSync(join(root, 'fixtures/backtest/FETCH-LOG.json'), 'utf8')) as { log: { status: string }[] };
  assert.ok(log.log.some((l) => l.status === 'pfad abgelehnt'));
  assert.ok(log.log.some((l) => l.status === 'abgelehnt'));
  assert.ok(log.log.some((l) => l.status === 'redirect abgelehnt'));
});
