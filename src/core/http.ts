// HTTP client for collectors: timeout, polite User-Agent, one retry, per-host spacing,
// and fixture record/replay so that every parser can be tested offline against a real response.
//
//   SR_FIXTURES=replay  read fixtures/<name> instead of the network (tests, offline development)
//   SR_FIXTURES=record  hit the network and save the raw body to fixtures/<name>
//   (unset)             network only

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HttpClient, HttpInit } from './types.ts';

export const USER_AGENT = 'SignalRadar/0.1 (+https://github.com/TRW123123/signal-radar; passive read-only)';

// Mindestabstand je Host in ms, wo die Quelle ihn ausdrücklich verlangt (sonst HTTP 429). Standard: minHostIntervalMs bzw. 1000.
const HOST_INTERVAL_MS: Record<string, number> = { 'api.gdeltproject.org': 5500 };

export interface HttpOptions {
  fixturesDir: string;
  mode: 'replay' | 'record' | 'network';
  minHostIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

const SECRET_PARAMS = ['auth-key', 'auth_key', 'api-key', 'apikey'];

/** URL for error messages: values of secret query parameters replaced with REDACTED. */
export function redactUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.replace(/([?&](?:auth-key|auth_key|api-key|apikey)=)[^&#]*/gi, '$1REDACTED');
  }
  let changed = false;
  for (const name of [...u.searchParams.keys()]) {
    if (SECRET_PARAMS.includes(name.toLowerCase())) {
      u.searchParams.set(name, 'REDACTED');
      changed = true;
    }
  }
  return changed ? u.toString() : url;
}

export function fixtureName(url: string, init?: HttpInit): string {
  if (init?.fixture) return init.fixture;
  const u = new URL(url);
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10);
  return `${u.hostname}/${hash}.txt`;
}

export function createHttp(opts: HttpOptions): HttpClient {
  const lastHit = new Map<string, number>();
  const doFetch = opts.fetchImpl ?? fetch;

  async function raw(url: string, init?: HttpInit): Promise<string> {
    const file = join(opts.fixturesDir, fixtureName(url, init));
    if (opts.mode === 'replay') {
      if (!existsSync(file)) throw new Error(`fixture missing: ${file} (url ${redactUrl(url)})`);
      return readFileSync(file, 'utf8');
    }
    const host = new URL(url).hostname;
    const wait = (lastHit.get(host) ?? 0) + Math.max(opts.minHostIntervalMs ?? 1000, HOST_INTERVAL_MS[host] ?? 0) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      lastHit.set(host, Date.now());
      try {
        const res = await doFetch(url, {
          headers: { 'user-agent': USER_AGENT, accept: 'application/json, text/plain;q=0.9, */*;q=0.5', ...(init?.headers ?? {}) },
          signal: AbortSignal.timeout(init?.timeoutMs ?? 20_000),
          redirect: 'follow',
        });
        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get('retry-after'));
          throw Object.assign(new Error(`HTTP ${res.status} ${redactUrl(url)}`), { retryAfterMs: res.status === 429 ? (Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 6000) : undefined });
        }
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${redactUrl(url)}`), { fatal: true });
        const body = await res.text();
        if (opts.mode === 'record') {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, body);
        }
        return body;
      } catch (e) {
        lastErr = e;
        if ((e as { fatal?: boolean }).fatal) break;
        await new Promise((r) => setTimeout(r, (e as { retryAfterMs?: number }).retryAfterMs ?? 1500));
      }
    }
    throw lastErr;
  }

  return {
    text: raw,
    async json<T>(url: string, init?: HttpInit): Promise<T> {
      const body = await raw(url, init);
      try {
        return JSON.parse(body) as T;
      } catch {
        throw new Error(`invalid JSON from ${redactUrl(url)}: ${body.slice(0, 120)}`);
      }
    },
  };
}
