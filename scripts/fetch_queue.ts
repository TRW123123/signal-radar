#!/usr/bin/env node
// Fetches the historical responses listed in a queue file and stores them as fixtures.
// Runs in GitHub Actions (the build environment has no open internet).
//   node scripts/fetch_queue.ts [backtest/history-queue.json]
// Existing fixtures are kept. One failing URL never stops the rest; results go to fixtures/backtest/FETCH-LOG.json.
// Only https URLs on the host allowlist are fetched. Redirects stay on that host. Fixture paths stay under fixtures/backtest/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { USER_AGENT } from '../src/core/http.ts';

export const MAX_BYTES = 3_000_000;
export const MAX_REDIRECTS = 3;

/** Hosts that appear in backtest/history-queue.json. Anything else is refused. */
export const ALLOWED_HOSTS = new Set([
  'api.energy-charts.info',
  'api.ioda.inetintel.cc.gatech.edu',
  'api.ooni.io',
  'efts.sec.gov',
  'markets.newyorkfed.org',
  'metrics.torproject.org',
  'query1.finance.yahoo.com',
  'stat.ripe.net',
  'wikimedia.org',
]);

const inside = (base: string, file: string): boolean => {
  const rel = relative(base, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** Queue file must stay inside the repository root. */
export function queueFilePath(root: string, rel: string): string {
  const base = resolve(root);
  const file = resolve(base, rel);
  if (!inside(base, file)) throw new Error('queue path escapes repo');
  return file;
}

/** Fixture path must be backtest/<segments> and resolve under fixtures/backtest. */
export function fixtureFile(root: string, fixture: string): string | null {
  if (typeof fixture !== 'string' || fixture.length === 0 || fixture.length > 240) return null;
  if (!fixture.startsWith('backtest/') || fixture.includes('\\') || /[\u0000-\u001f]/.test(fixture)) return null;
  const parts = fixture.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  const base = resolve(root, 'fixtures', 'backtest');
  const file = resolve(root, 'fixtures', fixture);
  if (!inside(base, file)) return null;
  return file;
}

/** https URL whose hostname is on the allowlist, without userinfo. */
export function allowedRequestUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (!ALLOWED_HOSTS.has(u.hostname)) return null;
  return u;
}

async function readLimited(res: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return text.length > maxBytes ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

/** GET with manual redirects. Only same-host https is followed. Oversized bodies are discarded. */
export async function fetchAllowed(url: string, fetchImpl: typeof fetch, userAgent: string): Promise<{ status: string; body?: string }> {
  const start = allowedRequestUrl(url);
  if (!start) return { status: 'abgelehnt' };
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(current.href, {
      headers: { 'user-agent': userAgent, accept: 'application/json, text/plain;q=0.9, */*;q=0.5' },
      redirect: 'manual',
      signal: AbortSignal.timeout(45_000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location || hop === MAX_REDIRECTS) return { status: 'redirect abgelehnt' };
      let next: URL;
      try { next = new URL(location, current); } catch { return { status: 'redirect abgelehnt' }; }
      if (next.protocol !== 'https:' || next.hostname !== start.hostname || next.username || next.password) return { status: 'redirect abgelehnt' };
      current = next;
      continue;
    }
    if (!res.ok) return { status: `HTTP ${res.status}` };
    const body = await readLimited(res, MAX_BYTES);
    if (body === null) return { status: 'zu groß' };
    return { status: 'ok', body };
  }
  return { status: 'redirect abgelehnt' };
}

export async function runQueue(root: string, queueRel: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: number; vorhanden: number; failed: number }> {
  const queueFile = queueFilePath(root, queueRel);
  const queue = JSON.parse(readFileSync(queueFile, 'utf8')) as { fixture: string; url: string }[];
  const log: { fixture: string; status: string; bytes?: number }[] = [];
  const lastHit = new Map<string, number>();
  for (const q of queue) {
    const file = fixtureFile(root, q.fixture);
    if (!file) { log.push({ fixture: String(q.fixture), status: 'pfad abgelehnt' }); continue; }
    if (existsSync(file)) { log.push({ fixture: q.fixture, status: 'vorhanden' }); continue; }
    const allowed = allowedRequestUrl(q.url);
    if (!allowed) { log.push({ fixture: q.fixture, status: 'abgelehnt' }); continue; }
    const host = allowed.hostname;
    const wait = (lastHit.get(host) ?? 0) + 2500 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
    try {
      const ua = host.endsWith('sec.gov') && process.env.SR_SEC_USER_AGENT ? process.env.SR_SEC_USER_AGENT : USER_AGENT;
      const got = await fetchAllowed(q.url, fetchImpl, ua);
      if (got.status !== 'ok' || got.body === undefined) { log.push({ fixture: q.fixture, status: got.status }); continue; }
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, got.body);
      log.push({ fixture: q.fixture, status: 'ok', bytes: got.body.length });
    } catch (e) {
      log.push({ fixture: q.fixture, status: `Fehler: ${String((e as Error).message).slice(0, 120)}` });
    }
  }
  const logDir = join(root, 'fixtures', 'backtest');
  mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, 'FETCH-LOG.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
  const ok = log.filter((l) => l.status === 'ok').length;
  const vorhanden = log.filter((l) => l.status === 'vorhanden').length;
  return { ok, vorhanden, failed: log.length - ok - vorhanden };
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = await runQueue(root, process.argv[2] ?? 'backtest/history-queue.json');
  console.log(`${result.ok} geladen, ${result.vorhanden} vorhanden, ${result.failed} fehlgeschlagen`);
}
