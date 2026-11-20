// HTTP client for collectors: timeout, polite User-Agent, one retry, per-host spacing,
// and fixture record/replay so that every parser can be tested offline against a real response.
//
//   SR_FIXTURES=replay  read fixtures/<name> instead of the network (tests, offline development)
//   SR_FIXTURES=record  hit the network and save the raw body to fixtures/<name>
//   (unset)             network only
// POST (method/body) needs an explicit fixture name. Responses that carry credentials (init.secret, Set-Cookie on a POST,
// access_token in the body) are never recorded.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HttpClient, HttpInit, HttpResponse } from './types.ts';

export const USER_AGENT = 'SignalRadar/0.1 (+https://github.com/TRW123123/signal-radar; passive read-only)';

// Mindestabstand je Host in ms, wo die Quelle ihn ausdrücklich verlangt (sonst HTTP 429). Standard: minHostIntervalMs bzw. 1000.
const HOST_INTERVAL_MS: Record<string, number> = { 'api.gdeltproject.org': 5500 };

export interface HttpOptions {
  fixturesDir: string;
  mode: 'replay' | 'record' | 'network';
  minHostIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

// Query parameters whose values are credentials (compared case-insensitively, '-' and '_' ignored: apiKey = api_key = api-key).
const SECRET_PARAMS = new Set(['authkey', 'apikey', 'key', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'mapkey', 'apitoken',
  'clientsecret', 'secret', 'password', 'pass', 'passwd', 'pwd', 'sig', 'signature', 'subscriptionkey', 'appkey', 'appid', 'sessionid', 'session']);
const isSecretParam = (name: string): boolean => SECRET_PARAMS.has(name.toLowerCase().replace(/[-_]/g, ''));

/** Path segment that looks like a credential: >= 32 hex chars (e.g. FIRMS MAP_KEY) or a long mixed letter/digit token. */
export function looksLikeKey(seg: string): boolean {
  if (/^[0-9a-f]{32,}$/i.test(seg)) return true;
  return seg.length >= 32 && /^[A-Za-z0-9_-]+$/.test(seg) && /[0-9]/.test(seg) && /[A-Za-z]/.test(seg);
}

/** URL for error messages: credentials in query parameters, path segments and userinfo replaced with REDACTED. */
export function redactUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.replace(/([?&;]([A-Za-z_-]+)=)[^&#\s]*/g, (m, pre: string, name: string) => (isSecretParam(name) ? `${pre}REDACTED` : m));
  }
  let changed = false;
  for (const name of [...new Set(u.searchParams.keys())]) {
    if (isSecretParam(name)) {
      u.searchParams.set(name, 'REDACTED');
      changed = true;
    }
  }
  const segs = u.pathname.split('/');
  const clean = segs.map((s) => {
    let dec = s;
    try { dec = decodeURIComponent(s); } catch { /* keep raw */ }
    return looksLikeKey(dec) ? 'REDACTED' : s;
  });
  if (clean.some((s, i) => s !== segs[i])) {
    u.pathname = clean.join('/');
    changed = true;
  }
  if (u.password || u.username) {
    u.username = u.username ? 'REDACTED' : '';
    u.password = u.password ? 'REDACTED' : '';
    changed = true;
  }
  return changed ? u.toString() : url;
}

/**
 * Text for logs and reports: every URL in it passed through redactUrl, every given secret value (and its
 * URL-encoded form) replaced with REDACTED. Values shorter than 4 characters are ignored.
 */
export function redactText(text: string, secrets: (string | undefined)[] = []): string {
  let out = text;
  for (const v of [...new Set(secrets.filter((x): x is string => !!x && x.length >= 4))].sort((a, b) => b.length - a.length)) {
    for (const form of new Set([v, encodeURIComponent(v), Buffer.from(v).toString('base64')])) out = out.split(form).join('REDACTED');
  }
  return out.replace(/\bhttps?:\/\/[^\s"'<>()]+/g, (m) => redactUrl(m));
}

/** Cookie request header from Set-Cookie lines (name=value pairs only, attributes dropped). */
export function cookieHeader(setCookie: string[]): string {
  return setCookie.map((c) => c.split(';')[0].trim()).filter((c) => c.includes('=')).join('; ');
}

const SECRET_BODY = /"(access_token|refresh_token|id_token|session_token|client_secret)"\s*:/i;

/** Network-level failures (fetch failed, timeout) with their cause (code, syscall, host); no keys: URL and text go through redaction. */
export function describeFetchError(e: unknown, url: string, method = 'GET'): unknown {
  if (!(e instanceof Error) || /^HTTP \d{3}/.test(e.message)) return e;
  const parts: string[] = [];
  let c: unknown = (e as { cause?: unknown }).cause;
  for (let i = 0; c && i < 3; i++, c = (c as { cause?: unknown }).cause) {
    const x = c as { code?: unknown; syscall?: unknown; hostname?: unknown; address?: unknown; message?: unknown };
    parts.push([x.code, x.syscall, x.hostname ?? x.address, x.message].filter((v) => v !== undefined && v !== '').map(String).join(' '));
  }
  const cause = parts.filter(Boolean).join(' <- ');
  const msg = redactText(`${e.name === 'TimeoutError' ? 'timeout' : e.message}${cause ? ` (Ursache: ${cause})` : ''} ${method === 'GET' ? '' : `${method} `}${url}`);
  return Object.assign(new Error(msg), { retryAfterMs: (e as { retryAfterMs?: number }).retryAfterMs, fatal: (e as { fatal?: boolean }).fatal });
}

export function fixtureName(url: string, init?: HttpInit): string {
  if (init?.fixture) return init.fixture;
  if ((init?.method ?? 'GET') !== 'GET') throw new Error(`${init?.method} braucht einen fixture-Namen (${redactUrl(url)})`);
  const u = new URL(url);
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10);
  return `${u.hostname}/${hash}.txt`;
}

export function createHttp(opts: HttpOptions): HttpClient {
  const lastHit = new Map<string, number>();
  const doFetch = opts.fetchImpl ?? fetch;

  async function request(url: string, init?: HttpInit): Promise<HttpResponse> {
    const method = init?.method ?? 'GET';
    const file = join(opts.fixturesDir, fixtureName(url, init));
    if (opts.mode === 'replay') {
      if (!existsSync(file)) throw new Error(`fixture missing: ${file} (url ${redactUrl(url)})`);
      return { status: 200, headers: {}, setCookie: [], cookie: '', body: readFileSync(file, 'utf8') };
    }
    const host = new URL(url).hostname;
    const wait = (lastHit.get(host) ?? 0) + Math.max(opts.minHostIntervalMs ?? 1000, HOST_INTERVAL_MS[host] ?? 0) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      lastHit.set(host, Date.now());
      try {
        const res = await doFetch(url, {
          method,
          body: method === 'GET' ? undefined : init?.body,
          headers: { 'user-agent': USER_AGENT, accept: 'application/json, text/plain;q=0.9, */*;q=0.5', ...(init?.headers ?? {}) },
          signal: AbortSignal.timeout(init?.timeoutMs ?? 20_000),
          redirect: 'follow',
        });
        if (res.status === 429 || res.status >= 500) {
          const ra = Number(res.headers.get('retry-after'));
          throw Object.assign(new Error(`HTTP ${res.status} ${method === 'GET' ? '' : `${method} `}${redactUrl(url)}`), { retryAfterMs: res.status === 429 ? (Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 6000) : undefined });
        }
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${method === 'GET' ? '' : `${method} `}${redactUrl(url)}`), { fatal: true });
        const body = await res.text();
        const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        const secret = init?.secret || (method !== 'GET' && setCookie.length > 0) || SECRET_BODY.test(body.slice(0, 4000));
        if (opts.mode === 'record' && !secret) {
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, body);
        }
        return { status: res.status, headers, setCookie, cookie: cookieHeader(setCookie), body };
      } catch (e0) {
        const e = describeFetchError(e0, url, method);
        lastErr = e;
        if ((e as { fatal?: boolean }).fatal) break;
        await new Promise((r) => setTimeout(r, (e as { retryAfterMs?: number }).retryAfterMs ?? 1500));
      }
    }
    throw lastErr;
  }

  return {
    request,
    async text(url: string, init?: HttpInit): Promise<string> {
      return (await request(url, init)).body;
    },
    async json<T>(url: string, init?: HttpInit): Promise<T> {
      const { body } = await request(url, init);
      try {
        return JSON.parse(body) as T;
      } catch {
        throw new Error(`invalid JSON from ${redactUrl(url)}: ${body.slice(0, 120)}`);
      }
    },
  };
}
