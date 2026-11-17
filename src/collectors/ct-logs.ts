// Certificate Transparency log size (evidence class A, context only: raw counters, weight 0).
// Source: RFC 6962 `get-sth` (signed tree head) of a few active CT logs. No key, public.
// Docs: https://certificate.transparency.dev/  (API: RFC 6962 section 4.3, https://www.rfc-editor.org/rfc/rfc6962)
// License: public log data; no stated restrictions, query politely (1 request per log and run).
//
// Measured: `tree_size` (number of entries ever logged) per log. The value grows monotonically; a single request gives
// only the current state. Collectors are stateless, so the raw counter is reported with the full-hour timestamp of
// ctx.now and weight 0 in domain `context`.
// ORCHESTRATOR HINT: the issuance rate (entries per hour = difference of consecutive tree_size values) must be derived
// in the engine from the stored series as a derived signal (e.g. cyber.dns_core.issuance_volume, catalog entry exists).
// A drop of the rate points to a CA/log outage; jumps point to mass renewals or phishing waves.
// Banal causes: log sharding (a new temporal shard starts with a small tree_size at the half-year change, the counter
// of that signal then drops: ignore the difference at the rollover), log maintenance, renewal cycles.
// Log choice: the official list https://www.gstatic.com/ct/log_list/v3/log_list.json is very large and could not be
// opened in this session (host blocked), so the URLs follow the known naming scheme of the operators and are
// UNVERIFIED. Four operators, derived from ctx.now so the shard rolls over by itself:
//   argon (Google):      https://ct.googleapis.com/logs/us1/argon<YYYY>h<1|2>/
//   xenon (Google):      https://ct.googleapis.com/logs/eu1/xenon<YYYY>h<1|2>/
//   oak (Let's Encrypt): https://oak.ct.letsencrypt.org/<YYYY>h<1|2>/
//   nimbus (Cloudflare): https://ct.cloudflare.com/logs/nimbus<YYYY>/
// The shard is a calendar year/half-year of certificate expiry, so a shard may only be usable from some time before.
// Check against the log list when the first recordings exist. Static-CT (Sunlight) logs have no get-sth and are left out.
// VERIFIED: nein.

import type { Collector } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

export interface LogDef { key: string; name: string; url: (year: number, half: 1 | 2) => string }

export const LOGS: LogDef[] = [
  { key: 'argon', name: 'Google Argon', url: (y, h) => `https://ct.googleapis.com/logs/us1/argon${y}h${h}/ct/v1/get-sth` },
  { key: 'xenon', name: 'Google Xenon', url: (y, h) => `https://ct.googleapis.com/logs/eu1/xenon${y}h${h}/ct/v1/get-sth` },
  { key: 'oak', name: "Let's Encrypt Oak", url: (y, h) => `https://oak.ct.letsencrypt.org/${y}h${h}/ct/v1/get-sth` },
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
    id: signalId(l.key), collector: 'ct-logs', scenarios: ['cyber'], domain: 'context',
    name: `CT-Log-Größe ${l.name}`,
    plain: `Wie viele Zertifikatseinträge im Transparenz-Log ${l.name} insgesamt stehen (Rohzähler, Ausstellungsrate wird daraus abgeleitet).`,
    evidenceClass: 'A' as const, direction: 'both' as const, kind: 'gauge' as const, weight: 0, manipulability: 'low' as const,
    independenceGroup: 'ct-logs', unit: 'Einträge', intervalMinutes: 60,
    baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 48 },
    license: 'öffentliche Log-Daten (RFC 6962)',
  })),
  async collect(ctx) {
    const ts = floorHour(ctx.now);
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
