// Cloudflare Radar API (evidence class A: independent third-party measurement from Cloudflare's network).
// Source: https://api.cloudflare.com/client/v4/radar/...  Docs: https://developers.cloudflare.com/api/resources/radar/
// Key: API token with permission "Radar Read" (free), sent as `Authorization: Bearer <key>`; env var SR_CLOUDFLARE_KEY.
// License: CC BY-NC 4.0 (Radar data). Non-commercial use only; commercial use needs a check/permission from Cloudflare.
//
// Measured:
//   - DDoS attack volume Layer 3/4 and Layer 7 as daily time series (attacks/layer3|layer7/timeseries, 12 weeks)
//   - outage annotations per day (annotations/outages, last 7 days, per startDate)
//   - traffic index (netflows/timeseries) per hour for DE and US (7 days)
//   - BGP hijack and route-leak events in the last 24 h (total_count of bgp/hijacks|leaks/events, one value per run)
// Normalisation: attack and traffic series are requested with normalization=MIN0_MAX (0..1 relative to the maximum of
// the requested window). The scale therefore shifts when a large peak enters or leaves the window; the baseline copes
// with this only approximately. Values are index values, not absolute counts.
// Banal causes: Radar-side reclassification of attack traffic, holiday traffic dips, scheduled maintenance,
// government-ordered shutdowns (exams) in single countries, large but harmless BGP leaks by small ISPs.
// VERIFIED: nein. Response shape (result.serie_0.{timestamps,values}, result.annotations[], result.events[] with
// result_info.total_count) is reconstructed from the official docs/SDK types (the docs pages were only partly readable:
// query-parameter lists and the serie_0 definition were not visible); parsers are defensive and throw on a changed shape.
// Hint for the orchestrator: the catalog entry lists this source as `cf-radar`; the file/collector id is `cloudflare-radar`.
// Not built: DNS signals (servfail_rate, dnssec_failures), rankings, IQI; they need further endpoint checks.

import type { Collector, CollectContext, Observation } from '../core/types.ts';
import { floorHour, daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const BASE = 'https://api.cloudflare.com/client/v4/radar';
const KEY_ENV = 'SR_CLOUDFLARE_KEY';

export interface Series { timestamps: string[]; values: number[] }

interface TsResp { result?: { serie_0?: { timestamps?: unknown[]; values?: unknown[] } } }
interface OutageResp { result?: { annotations?: { startDate?: string; endDate?: string }[] } }
interface EventsResp { result?: unknown; result_info?: { total_count?: unknown } }

/** Time series with result.serie_0 (values are often strings). Points with unusable values are dropped. */
export function parseTimeseries(body: TsResp): Series {
  const s = expect(body.result?.serie_0, 'result.serie_0');
  const ts = expect(s.timestamps, 'serie_0.timestamps');
  const vs = expect(s.values, 'serie_0.values');
  const out: Series = { timestamps: [], values: [] };
  const n = Math.min(ts.length, vs.length);
  for (let i = 0; i < n; i++) {
    const v = num(vs[i]);
    const t = typeof ts[i] === 'string' ? (ts[i] as string) : '';
    if (v !== null && !Number.isNaN(new Date(t).getTime())) { out.timestamps.push(t); out.values.push(v); }
  }
  return out;
}

/** Daily series: only complete UTC days (the current day is dropped). */
export function dailyObservations(signalId: string, s: Series, now: Date): Observation[] {
  const today = isoDay(now);
  const res: Observation[] = [];
  for (let i = 0; i < s.timestamps.length; i++) {
    const day = isoDay(new Date(s.timestamps[i]));
    if (day >= today) continue;
    res.push(obs(signalId, `${day}T00:00:00Z`, s.values[i]));
  }
  return res;
}

/** Hourly series: only completed hours. */
export function hourlyObservations(signalId: string, s: Series, now: Date): Observation[] {
  const res: Observation[] = [];
  for (let i = 0; i < s.timestamps.length; i++) {
    const t = floorHour(new Date(s.timestamps[i]));
    if (t.getTime() + 3600_000 > now.getTime()) continue;
    res.push(obs(signalId, t, s.values[i]));
  }
  return res;
}

/**
 * Outage annotations per UTC day of startDate. Complete days only. When the response is as long as the limit it may be
 * cut off: days up to and including the oldest returned day are then incomplete and dropped.
 */
export function parseOutages(body: OutageResp, signalId: string, now: Date, opts: { days: number; limit: number }): Observation[] {
  const list = expect(body.result?.annotations, 'result.annotations');
  const days = list
    .map((a) => (a.startDate ? new Date(a.startDate) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()))
    .map((d) => isoDay(d));
  const truncated = list.length >= opts.limit;
  const oldest = days.length ? [...days].sort()[0] : null;
  const counts = new Map<string, number>();
  for (let i = 1; i <= opts.days; i++) counts.set(isoDay(daysAgo(now, i)), 0);
  for (const d of days) if (counts.has(d)) counts.set(d, counts.get(d)! + 1);
  return [...counts.entries()].sort()
    .filter(([d]) => !(truncated && oldest !== null && d <= oldest))
    .map(([d, n]) => obs(signalId, `${d}T00:00:00Z`, n));
}

/** total_count of an events endpoint requested with per_page=1. */
export function parseTotalCount(body: EventsResp): number {
  const n = num(expect(body.result_info?.total_count, 'result_info.total_count'));
  return expect(n, 'result_info.total_count (Zahl)');
}

interface Ts { signalId: string; fixture: string; url: string }
const NORM = 'normalization=MIN0_MAX&format=json';
export const DAILY: Ts[] = [
  { signalId: 'cyber.threat.cloudflare_l3_attacks', fixture: 'cloudflare-radar/attacks-l3-timeseries.json', url: `${BASE}/attacks/layer3/timeseries?dateRange=12w&aggInterval=1d&${NORM}` },
  { signalId: 'cyber.threat.cloudflare_l7_attacks', fixture: 'cloudflare-radar/attacks-l7-timeseries.json', url: `${BASE}/attacks/layer7/timeseries?dateRange=12w&aggInterval=1d&${NORM}` },
];
export const HOURLY: Ts[] = [
  { signalId: 'cyber.outages.cf_traffic_de', fixture: 'cloudflare-radar/netflows-de.json', url: `${BASE}/netflows/timeseries?location=DE&dateRange=7d&aggInterval=1h&${NORM}` },
  { signalId: 'cyber.outages.cf_traffic_us', fixture: 'cloudflare-radar/netflows-us.json', url: `${BASE}/netflows/timeseries?location=US&dateRange=7d&aggInterval=1h&${NORM}` },
];
export const OUTAGE_LIMIT = 100;
export const OUTAGES = { signalId: 'cyber.outages.cf_radar_outages', fixture: 'cloudflare-radar/outages.json', url: `${BASE}/annotations/outages?dateRange=7d&limit=${OUTAGE_LIMIT}&format=json` };
export const EVENTS: Ts[] = [
  { signalId: 'cyber.routing.cf_bgp_hijacks_24h', fixture: 'cloudflare-radar/bgp-hijacks-24h.json', url: `${BASE}/bgp/hijacks/events?dateRange=1d&per_page=1&format=json` },
  { signalId: 'cyber.routing.cf_route_leaks_24h', fixture: 'cloudflare-radar/bgp-leaks-24h.json', url: `${BASE}/bgp/leaks/events?dateRange=1d&per_page=1&format=json` },
];

const CC = 'CC BY-NC 4.0 (Cloudflare Radar, nur nicht-kommerziell)';
const baseline = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };
const dayBaseline = { method: 'rolling' as const, windowDays: 56, minPoints: 21 };

const collector: Collector = {
  id: 'cloudflare-radar',
  title: 'Cloudflare Radar API',
  sourceUrl: 'https://developers.cloudflare.com/radar/',
  needsKey: KEY_ENV,
  intervalMinutes: 60,
  signals: [
    { id: 'cyber.threat.cloudflare_l3_attacks', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'threat', name: 'DDoS Layer 3/4 Aufkommen',
      plain: 'Wie stark der Angriffsverkehr auf Netzwerkebene (Layer 3/4) im Cloudflare-Netz im Vergleich zum Spitzenwert der letzten Wochen ist.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.65, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Index 0-1', intervalMinutes: 1440, holdHours: 48, baseline: dayBaseline, license: CC,
      banalCauses: ['Einzelne Großangriffe auf Kunden', 'Skalenwechsel durch Spitzen im Fenster'] },
    { id: 'cyber.threat.cloudflare_l7_attacks', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'threat', name: 'DDoS Layer 7 HTTP-Angriffe',
      plain: 'Wie stark der Angriffsverkehr auf Webanwendungen (HTTP) im Cloudflare-Netz im Vergleich zum Spitzenwert der letzten Wochen ist.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.6, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Index 0-1', intervalMinutes: 1440, holdHours: 48, baseline: dayBaseline, license: CC,
      banalCauses: ['Einzelne Großangriffe auf Kunden', 'Skalenwechsel durch Spitzen im Fenster'] },
    { id: 'cyber.outages.cf_radar_outages', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'outages', name: 'Cloudflare Radar Ausfallmeldungen',
      plain: 'Wie viele neue Internet-Ausfälle (Länder, Netze, Kabel) Cloudflare Radar pro Tag verzeichnet.',
      evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.8, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Meldungen/Tag', intervalMinutes: 1440, holdHours: 48, baseline: dayBaseline, license: CC,
      banalCauses: ['Schulprüfungs-Abschaltungen', 'Unwetter', 'Stromausfälle'] },
    { id: 'cyber.outages.cf_traffic_de', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'outages', name: 'Cloudflare Verkehr Deutschland',
      plain: 'Wie viel Internetverkehr aus Deutschland im Cloudflare-Netz ankommt (Index, stündlich).',
      evidenceClass: 'A', direction: 'down', kind: 'gauge', weight: 0.65, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Index 0-1', intervalMinutes: 60, holdHours: 6, baseline, license: CC,
      banalCauses: ['Feiertage', 'Skalenwechsel im 7-Tage-Fenster'] },
    { id: 'cyber.outages.cf_traffic_us', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'outages', name: 'Cloudflare Verkehr USA',
      plain: 'Wie viel Internetverkehr aus den USA im Cloudflare-Netz ankommt (Index, stündlich).',
      evidenceClass: 'A', direction: 'down', kind: 'gauge', weight: 0.55, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Index 0-1', intervalMinutes: 60, holdHours: 6, baseline, license: CC,
      banalCauses: ['Feiertage', 'Skalenwechsel im 7-Tage-Fenster'] },
    { id: 'cyber.routing.cf_bgp_hijacks_24h', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'routing', name: 'BGP-Hijack-Ereignisse (24 h, Radar)',
      plain: 'Wie viele mutmaßliche Umleitungen von Internet-Adressbereichen Cloudflare Radar in den letzten 24 Stunden erkannt hat.',
      evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.5, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Ereignisse/24 h', intervalMinutes: 60, holdHours: 12, baseline, license: CC,
      banalCauses: ['Fehlkonfigurationen kleiner Netze', 'Legitime Anycast-/DDoS-Schutz-Umleitungen'] },
    { id: 'cyber.routing.cf_route_leaks_24h', collector: 'cloudflare-radar', scenarios: ['cyber'], domain: 'routing', name: 'BGP-Route-Leaks (24 h, Radar)',
      plain: 'Wie viele fehlgeleitete Routing-Ankündigungen (Route Leaks) Cloudflare Radar in den letzten 24 Stunden erkannt hat.',
      evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.5, manipulability: 'low', independenceGroup: 'cf-radar',
      unit: 'Ereignisse/24 h', intervalMinutes: 60, holdHours: 12, baseline, license: CC,
      banalCauses: ['Fehlkonfigurationen kleiner Netze'] },
  ],
  async collect(ctx: CollectContext) {
    const key = ctx.key(KEY_ENV);
    if (!key) throw new Error(`${KEY_ENV} fehlt`);
    const headers = { Authorization: `Bearer ${key}` };
    const observations: Observation[] = [];
    let ok = 0;
    const attempt = async (label: string, fn: () => Promise<Observation[]>) => {
      try { observations.push(...(await fn())); ok++; } catch (e) { ctx.log(`${label} übersprungen: ${(e as Error).message}`); }
    };
    for (const t of DAILY) {
      await attempt(t.signalId, async () => dailyObservations(t.signalId, parseTimeseries(await ctx.http.json<TsResp>(t.url, { fixture: t.fixture, headers })), ctx.now));
    }
    for (const t of HOURLY) {
      await attempt(t.signalId, async () => hourlyObservations(t.signalId, parseTimeseries(await ctx.http.json<TsResp>(t.url, { fixture: t.fixture, headers })), ctx.now));
    }
    await attempt(OUTAGES.signalId, async () =>
      parseOutages(await ctx.http.json<OutageResp>(OUTAGES.url, { fixture: OUTAGES.fixture, headers }), OUTAGES.signalId, ctx.now, { days: 7, limit: OUTAGE_LIMIT }));
    for (const t of EVENTS) {
      await attempt(t.signalId, async () => [obs(t.signalId, floorHour(ctx.now), parseTotalCount(await ctx.http.json<EventsResp>(t.url, { fixture: t.fixture, headers })))]);
    }
    if (ok === 0) throw new Error('Cloudflare Radar: kein Request erfolgreich');
    return { observations };
  },
};

export default collector;
