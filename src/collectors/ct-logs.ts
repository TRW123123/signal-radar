// Certificate Transparency log growth (evidence class A): issuance rate per log, derived by the engine from the raw counter.
// Source: RFC 6962 `get-sth` (signed tree head) of three active CT logs. No key, public.
// Docs: https://certificate.transparency.dev/  (API: RFC 6962 section 4.3, https://www.rfc-editor.org/rfc/rfc6962)
// License: public log data; no stated restrictions, query politely (1 request per log and run).
//
// Measured: `tree_size` (number of entries ever logged) per log. The collector reports the raw counter at the exact
// time ctx.now (not rounded); the signals are declared with `transform: 'rate'`, so the engine scores the growth per
// hour between consecutive observations (certificates per hour). A drop of the rate points to a CA/log outage; jumps
// point to mass renewals or phishing waves.
// Banal causes: log sharding (a new temporal shard starts with a small tree_size at the half-year change, the counter
// of that signal drops: ignore the difference at the rollover), log maintenance, renewal cycles.
// Logs (URLs derived from ctx.now so the shard rolls over by itself; real answers recorded 17.11.2026):
//   argon (Google):      https://ct.googleapis.com/logs/us1/argon<YYYY>h<1|2>/
//   xenon (Google):      https://ct.googleapis.com/logs/eu1/xenon<YYYY>h<1|2>/
//   nimbus (Cloudflare): https://ct.cloudflare.com/logs/nimbus<YYYY>/
// Removed: Let's Encrypt Oak (oak.ct.letsencrypt.org: DNS_FAILED, host does not exist). Static-CT (Sunlight) logs have no get-sth.
// VERIFIED: ja (17.11.2026, echte Antwort): tree_size in the billions (3.0 to 6.8 billion), STH timestamp matches the capture time.

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

export interface LogDef { key: string; name: string; url: (year: number, half: 1 | 2) => string }

export const LOGS: LogDef[] = [
  { key: 'argon', name: 'Google Argon', url: (y, h) => `https://ct.googleapis.com/logs/us1/argon${y}h${h}/ct/v1/get-sth` },
  { key: 'xenon', name: 'Google Xenon', url: (y, h) => `https://ct.googleapis.com/logs/eu1/xenon${y}h${h}/ct/v1/get-sth` },
  { key: 'nimbus', name: 'Cloudflare Nimbus', url: (y) => `https://ct.cloudflare.com/logs/nimbus${y}/ct/v1/get-sth` },
];

export function signalId(key: string): string { return `cyber.dns_core.ct_tree_size_${key}`; }

export function shard(now: Date): { year: number; half: 1 | 2 } {
  return { year: now.getUTCFullYear(), half: now.getUTCMonth() < 6 ? 1 : 2 };
}

export function logUrl(log: LogDef, now: Date): string {
  const s = shard(now);
  return log.url(s.year, s.half);
}

interface Sth { tree_size?: unknown; timestamp?: unknown }

export function parseSth(body: Sth): number {
  const n = num(expect(body.tree_size, 'tree_size'));
  if (n === null || n < 0) throw new Error('unerwartete Antwort: tree_size keine Zahl');
  return n;
}

const collector: Collector = {
  id: 'ct-logs',
  title: 'Certificate Transparency Logs (get-sth)',
  sourceUrl: 'https://certificate.transparency.dev/',
  intervalMinutes: 60,
  signals: LOGS.map((l) => ({
    id: signalId(l.key), collector: 'ct-logs', scenarios: ['cyber'], domain: 'dns_core',
    name: `Zertifikat-Ausstellungsrate ${l.name}`,
    plain: `Wie viele neue Zertifikate pro Stunde im Transparenz-Log ${l.name} eingetragen werden; ein Einbruch oder Sprung deutet auf Ausfälle bei Zertifizierungsstellen oder Massenausstellung.`,
    evidenceClass: 'A' as const, direction: 'both' as const, kind: 'gauge' as const, transform: 'rate' as const, weight: 0.5,
    manipulability: 'low' as const, independenceGroup: 'ct-logs', unit: 'Zertifikate pro Stunde', intervalMinutes: 60,
    baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
    license: 'öffentliche Log-Daten (RFC 6962)',
  })),
  async collect(ctx) {
    const ts = ctx.now; // Rohstand zum Zeitpunkt ctx.now, nicht gerundet
    const observations = [];
    for (const l of LOGS) {
      try {
        const sth = await ctx.http.json<Sth>(logUrl(l, ctx.now), { fixture: `ct-logs/${l.key}-sth.json` });
        observations.push(obs(signalId(l.key), ts, parseSth(sth)));
      } catch (e) {
        ctx.log(`CT-Log ${l.key} übersprungen: ${(e as Error).message}`);
      }
    }
    if (!observations.length) throw new Error('CT-Logs: kein Log erreichbar');
    return { observations };
  },
};

export default collector;
