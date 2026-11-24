#!/usr/bin/env node
// Fetches the historical responses listed in a queue file and stores them as fixtures.
// Runs in GitHub Actions (the build environment has no open internet).
//   node scripts/fetch_queue.ts [backtest/history-queue.json]
// Existing fixtures are kept. One failing URL never stops the rest; results go to fixtures/backtest/FETCH-LOG.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_AGENT } from '../src/core/http.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const queueFile = resolve(root, process.argv[2] ?? 'backtest/history-queue.json');
const queue = JSON.parse(readFileSync(queueFile, 'utf8')) as { fixture: string; url: string }[];
const log: { fixture: string; status: string; bytes?: number }[] = [];
const lastHit = new Map<string, number>();

for (const q of queue) {
  const file = join(root, 'fixtures', q.fixture);
  if (existsSync(file)) { log.push({ fixture: q.fixture, status: 'vorhanden' }); continue; }
  const host = new URL(q.url).hostname;
  const wait = (lastHit.get(host) ?? 0) + 2500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  try {
    const ua = host.endsWith('sec.gov') && process.env.SR_SEC_USER_AGENT ? process.env.SR_SEC_USER_AGENT : USER_AGENT;
    const res = await fetch(q.url, { headers: { 'user-agent': ua, accept: 'application/json, text/plain;q=0.9, */*;q=0.5' }, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) { log.push({ fixture: q.fixture, status: `HTTP ${res.status}` }); continue; }
    const body = await res.text();
    if (body.length > 3_000_000) { log.push({ fixture: q.fixture, status: 'zu groß', bytes: body.length }); continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    log.push({ fixture: q.fixture, status: 'ok', bytes: body.length });
  } catch (e) {
    log.push({ fixture: q.fixture, status: `Fehler: ${String((e as Error).message).slice(0, 120)}` });
  }
}
mkdirSync(join(root, 'fixtures', 'backtest'), { recursive: true });
writeFileSync(join(root, 'fixtures', 'backtest', 'FETCH-LOG.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
const ok = log.filter((l) => l.status === 'ok').length;
console.log(`${ok} geladen, ${log.filter((l) => l.status === 'vorhanden').length} vorhanden, ${log.length - ok - log.filter((l) => l.status === 'vorhanden').length} fehlgeschlagen`);
