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

export const USER_AGENT = 'SignalRadar/0.1 (+open-source early warning dashboard; passive read-only)';

export interface HttpOptions {
  fixturesDir: string;
  mode: 'replay' | 'record' | 'network';
  minHostIntervalMs?: number;
  fetchImpl?: typeof fetch;
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
      if (!existsSync(file)) throw new Error(`fixture missing: ${file} (url ${url})`);
      return readFileSync(file, 'utf8');
    }
    const host = new URL(url).hostname;
    const wait = (lastHit.get(host) ?? 0) + (opts.minHostIntervalMs ?? 1000) - Date.now();
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
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} ${url}`);
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { fatal: true });
        const body = await res.text();
        if (opts.mode === 'record') {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, body);
        }
        return body;
      } catch (e) {
        lastErr = e;
        if ((e as { fatal?: boolean }).fatal) break;
        await new Promise((r) => setTimeout(r, 1500));
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
        throw new Error(`invalid JSON from ${url}: ${body.slice(0, 120)}`);
      }
    },
  };
}
