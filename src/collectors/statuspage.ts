// Atlassian-Statuspage-Anbieter (GitHub, Cloudflare, Twilio, Zahlungsdienste, Krypto-Börsen ...), ein Collector für viele Hosts.
// Quelle: <host>/api/v2/status.json (öffentliche Statuspage-API, ohne Key) und <host>/api/v2/incidents.json für 8 Leitanbieter.
// Doku: https://developer.statuspage.io/. Lizenz/Nutzung: je Anbieter unklar; pro Host und Lauf ein kleiner JSON-Request.
// Signalpaar 1 (aktueller Zustand): Anteil der antwortenden Anbieter mit Störung (indicator != none) und mit schwerer Störung
// (major|critical), getrennt auch für die Kategorien payment und cloud. Nicht antwortende Hosts zählen nicht mit; antworten
// weniger als 80 % der Liste (44 Hosts, alle am 17.11.2026 mit echter Statuspage-status.json und passendem page.name belegt),
// wird nichts gemeldet. Bereinigt: 15 Hosts ohne gültige Antwort (404/403/DNS/zu groß/Umleitung) und sendgrid (leitet auf die
// Twilio-Seite um) wurden aus der Liste entfernt.
// Signalpaar 2 (Historie): Störungs-Beginne pro UTC-Tag über 8 Leitanbieter (Cloud, Zahlung, Entwickler-Dienste) aus
// incidents.json (impact minor|major|critical, Tag = started_at bzw. created_at), getrennt "alle" und "major/critical".
// incidents.json liefert höchstens die letzten 50 Störungen je Host; der gemeldete Zeitraum beginnt deshalb erst nach dem
// ältesten Eintrag des Anbieters mit der kürzesten Historie. Es wird nur gemeldet, wenn alle 8 Antworten vollständig und
// parsebar sind (eine abgeschnittene Antwort ist kein JSON) und der Zeitraum mindestens 14 volle Tage umfasst.
// Harmlose Ursachen: ein einzelner großer Cloud-/CDN-Ausfall zieht viele Anbieter mit; Wartungsfenster werden als "none" gewertet;
// Anbieter mit Statuspage-Kompatibilitätsschicht (z. B. incident.io) können abweichend melden; "maintenance" kommt vor (Chargebee, Zoom).
// Liste: catalog/statuspage-hosts.json. Höchstens 52 Requests pro Lauf (44 Hosts + 8 incidents.json, begründet durch die Zahl der Hosts).
// VERIFIED: teilweise (status.json: ja, 17.11.2026, 44 echte Antworten, Replay liefert Werte; incidents.json: nein, Form nach Doku,
// Fixtures statuspage-incidents/<host>.json stehen in der Queue; Antwortgröße ungeprüft, die Prüf-Umgebung kappt bei 24 000 Zeichen)

import hosts from '../../catalog/statuspage-hosts.json' with { type: 'json' };
import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, obs } from './_helpers.ts';

export type Indicator = 'none' | 'minor' | 'major' | 'critical';
export interface HostDef { host: string; name: string; category: string }
export interface HostResult { host: string; category: string; indicator: Indicator }

interface StatusResp { status?: { indicator?: string } }

export const HOSTS: HostDef[] = hosts as HostDef[];
export const MIN_RESPONSE_SHARE = 0.8;

export function parseIndicator(body: StatusResp): Indicator {
  const raw = expect(expect(body?.status, 'status').indicator, 'status.indicator');
  if (raw === 'none' || raw === 'minor' || raw === 'major' || raw === 'critical') return raw;
  if (raw === 'maintenance') return 'none';
  throw new Error(`unerwartete Antwort: status.indicator "${String(raw)}"`);
}

export interface Aggregate {
  responders: number;
  disruptionPct: number;
  majorPct: number;
  disrupted: number;
  major: number;
  byCategory: Record<string, { n: number; disrupted: number; pct: number }>;
}

/** Returns null when fewer than 80 % of the listed hosts answered (a partial base would distort the share). */
export function aggregate(results: HostResult[], totalHosts: number): Aggregate | null {
  if (totalHosts <= 0 || results.length / totalHosts < MIN_RESPONSE_SHARE) return null;
  const n = results.length;
  const disrupted = results.filter((r) => r.indicator !== 'none').length;
  const major = results.filter((r) => r.indicator === 'major' || r.indicator === 'critical').length;
  const byCategory: Aggregate['byCategory'] = {};
  for (const r of results) {
    const c = (byCategory[r.category] ??= { n: 0, disrupted: 0, pct: 0 });
    c.n++;
    if (r.indicator !== 'none') c.disrupted++;
  }
  for (const c of Object.values(byCategory)) c.pct = (100 * c.disrupted) / c.n;
  return { responders: n, disruptionPct: (100 * disrupted) / n, majorPct: (100 * major) / n, disrupted, major, byCategory };
}

// ---------- Historie: Störungs-Beginne pro Tag aus incidents.json ----------

export const INCIDENT_HOSTS = [
  'www.cloudflarestatus.com', 'status.digitalocean.com', 'www.vercel-status.com', // Cloud
  'status.plaid.com', 'status.gocardless.com', 'status.recurly.com', // Zahlung
  'www.githubstatus.com', 'status.npmjs.org', // Entwickler-Dienste
];
export const INCIDENT_CAP = 50; // Statuspage liefert höchstens die letzten 50 Störungen
export const MIN_HISTORY_DAYS = 14;
export const MAX_HISTORY_DAYS = 60;

export interface IncidentStart { ts: number; major: boolean }
export interface IncidentList { starts: IncidentStart[]; full: boolean; oldest: number | null }

interface IncidentsResp { incidents?: { created_at?: string; started_at?: string; impact?: string }[] }

/** Parses incidents.json; maintenance-like entries (impact none) are ignored. Throws when the shape is wrong. */
export function parseIncidents(body: IncidentsResp): IncidentList {
  const list = expect(body?.incidents, 'incidents');
  if (!Array.isArray(list)) throw new Error('unerwartete Antwort: incidents ist keine Liste');
  const starts: IncidentStart[] = [];
  let oldest: number | null = null;
  for (const i of list) {
    const t = Date.parse(String(i.started_at ?? i.created_at ?? ''));
    if (!Number.isFinite(t)) continue;
    if (oldest === null || t < oldest) oldest = t;
    if (i.impact === 'minor' || i.impact === 'major' || i.impact === 'critical') starts.push({ ts: t, major: i.impact !== 'minor' });
  }
  return { starts, full: list.length >= INCIDENT_CAP, oldest };
}

/**
 * Counts incident starts per complete UTC day over all hosts. Returns null unless every host delivered a list and the
 * window (after the oldest entry of the host with the shortest history, up to yesterday) has at least MIN_HISTORY_DAYS days.
 */
export function incidentSeries(lists: (IncidentList | null)[], now: Date): { day: string; all: number; major: number }[] | null {
  if (lists.length === 0 || lists.some((l) => l === null)) return null;
  const today = floorDay(now).getTime();
  let from = today - MAX_HISTORY_DAYS * DAY_MS;
  for (const l of lists as IncidentList[]) {
    if (l.full && l.oldest !== null) from = Math.max(from, floorDay(new Date(l.oldest)).getTime() + DAY_MS);
  }
  if ((today - from) / DAY_MS < MIN_HISTORY_DAYS) return null;
  const days = new Map<string, { all: number; major: number }>();
  for (let t = from; t < today; t += DAY_MS) days.set(isoDay(new Date(t)), { all: 0, major: 0 });
  for (const l of lists as IncidentList[]) {
    for (const s of l.starts) {
      const d = days.get(isoDay(new Date(s.ts)));
      if (!d) continue;
      d.all++;
      if (s.major) d.major++;
    }
  }
  return [...days.entries()].sort().map(([day, v]) => ({ day, ...v }));
}

const COMMON = {
  evidenceClass: 'B' as const, direction: 'up' as const, kind: 'rate' as const, manipulability: 'medium' as const,
  independenceGroup: 'statuspage-hosts', unit: '% der Anbieter', intervalMinutes: 15, holdHours: 6,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
  thresholds: { absFloor: 3 },
  license: 'je Anbieter unklar (öffentliche Statuspage-API)',
  banalCauses: ['Ein einzelner CDN-/Cloud-Ausfall betrifft viele Anbieter', 'Geplante Wartung'],
};

const MIN_CATEGORY_RESPONDERS = 3;

const collector: Collector = {
  id: 'statuspage',
  title: 'Atlassian-Statuspage-Anbieter (Sammelabfrage)',
  sourceUrl: 'https://developer.statuspage.io/',
  intervalMinutes: 15,
  signals: [
    {
      ...COMMON, id: 'cyber.services.statuspage_incident_rate', scenarios: ['cyber'], domain: 'services', weight: 0.7,
      name: 'Anteil der Anbieter mit schwerer Störung',
      plain: 'Wie viel Prozent von rund 44 Cloud-, SaaS-, Zahlungs- und Krypto-Anbietern gerade eine schwere (major/critical) Störung melden.',
    },
    {
      ...COMMON, id: 'cyber.services.statuspage_disruption_share', scenarios: ['cyber'], domain: 'services', weight: 0.5,
      name: 'Anteil der Anbieter mit irgendeiner Störung',
      plain: 'Wie viel Prozent der beobachteten Anbieter gerade irgendeine Störung melden, auch eine leichte.',
    },
    {
      ...COMMON, id: 'cyber.finance.statuspage_payment_disruption', scenarios: ['cyber'], domain: 'finance', weight: 0.6,
      name: 'Zahlungsdienste mit Störung',
      plain: 'Wie viel Prozent der beobachteten Zahlungsdienste (Braintree, Mollie, Square u. a.) gerade eine Störung melden.',
    },
    {
      ...COMMON, id: 'cyber.services.statuspage_cloud_disruption', scenarios: ['cyber'], domain: 'services', weight: 0.7,
      name: 'Cloud- und CDN-Anbieter mit Störung',
      plain: 'Wie viel Prozent der beobachteten Cloud- und CDN-Anbieter (Cloudflare, Fastly, DigitalOcean u. a.) gerade eine Störung melden.',
    },
    {
      ...COMMON, id: 'cyber.services.statuspage_incident_starts_day', scenarios: ['cyber'], domain: 'services', weight: 0.4,
      kind: 'count' as const, unit: 'Störungen pro Tag', intervalMinutes: 1440, holdHours: 36,
      baseline: { method: 'rolling' as const, windowDays: 60, minPoints: 14 }, thresholds: { absFloor: 2 },
      name: 'Neue Störungen pro Tag (8 Leitanbieter)',
      plain: 'Wie viele neue Störungen (leicht bis kritisch) die acht großen Cloud-, Zahlungs- und Entwickler-Dienste gestern gemeldet haben.',
    },
    {
      ...COMMON, id: 'cyber.services.statuspage_major_starts_day', scenarios: ['cyber'], domain: 'services', weight: 0.5,
      kind: 'count' as const, unit: 'schwere Störungen pro Tag', intervalMinutes: 1440, holdHours: 36,
      baseline: { method: 'rolling' as const, windowDays: 60, minPoints: 14 }, thresholds: { absFloor: 1 },
      name: 'Neue schwere Störungen pro Tag (8 Leitanbieter)',
      plain: 'Wie viele neue schwere (major/critical) Störungen die acht großen Cloud-, Zahlungs- und Entwickler-Dienste gestern gemeldet haben.',
    },
  ],
  async collect(ctx) {
    const results: HostResult[] = [];
    const BATCH = 10;
    for (let i = 0; i < HOSTS.length; i += BATCH) {
      const slice = HOSTS.slice(i, i + BATCH);
      const settled = await Promise.all(slice.map(async (h) => {
        try {
          const body = await ctx.http.json<StatusResp>(`https://${h.host}/api/v2/status.json`, { fixture: `statuspage/${h.host}.json` });
          return { host: h.host, category: h.category, indicator: parseIndicator(body) } as HostResult;
        } catch (e) {
          ctx.log(`Host ${h.host} übersprungen: ${(e as Error).message}`);
          return null;
        }
      }));
      for (const r of settled) if (r) results.push(r);
    }
    const observations: Observation[] = [];
    const agg = aggregate(results, HOSTS.length);
    if (!agg) {
      ctx.log(`nur ${results.length} von ${HOSTS.length} Hosts antworten (< 80 %), kein Statuswert gemeldet`);
    } else {
      // 15-minute slot of the poll time
      const ts = new Date(Math.floor(ctx.now.getTime() / 900_000) * 900_000);
      const meta = { responders: agg.responders, hosts: HOSTS.length };
      observations.push(
        obs('cyber.services.statuspage_incident_rate', ts, agg.majorPct, { ...meta, major: agg.major }),
        obs('cyber.services.statuspage_disruption_share', ts, agg.disruptionPct, { ...meta, disrupted: agg.disrupted }),
      );
      for (const [cat, id] of [['payment', 'cyber.finance.statuspage_payment_disruption'], ['cloud', 'cyber.services.statuspage_cloud_disruption']] as const) {
        const c = agg.byCategory[cat];
        if (c && c.n >= MIN_CATEGORY_RESPONDERS) observations.push(obs(id, ts, c.pct, { responders: c.n, disrupted: c.disrupted }));
        else ctx.log(`Kategorie ${cat}: zu wenige antwortende Hosts (${c?.n ?? 0}), kein Wert`);
      }
    }
    const lists = await Promise.all(INCIDENT_HOSTS.map(async (h) => {
      try {
        return parseIncidents(await ctx.http.json<IncidentsResp>(`https://${h}/api/v2/incidents.json`, { fixture: `statuspage-incidents/${h}.json` }));
      } catch (e) {
        ctx.log(`incidents.json ${h} nicht nutzbar: ${(e as Error).message}`);
        return null;
      }
    }));
    const series = incidentSeries(lists, ctx.now);
    if (series) {
      for (const d of series) {
        const t = `${d.day}T00:00:00Z`;
        observations.push(obs('cyber.services.statuspage_incident_starts_day', t, d.all, { hosts: INCIDENT_HOSTS.length }));
        observations.push(obs('cyber.services.statuspage_major_starts_day', t, d.major, { hosts: INCIDENT_HOSTS.length }));
      }
    } else ctx.log('incidents.json unvollständig oder Zeitraum zu kurz, kein Tageswert gemeldet');
    return { observations };
  },
};

export default collector;
