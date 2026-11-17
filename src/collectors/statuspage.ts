// Atlassian-Statuspage-Anbieter (GitHub, Cloudflare, Twilio, Stripe-Konkurrenz, Krypto-Börsen ...), ein Collector für viele Hosts.
// Quelle: <host>/api/v2/status.json (öffentliche Statuspage-API, ohne Key). Doku: https://developer.statuspage.io/
// Lizenz/Nutzung: je Anbieter unklar; es wird nur der Gesamtstatus (ein kleiner JSON-Request pro Host und Lauf) gelesen.
// Gemessen: Anteil der antwortenden Anbieter mit Störung (indicator != none) und mit schwerer Störung (major|critical),
// getrennt auch für die Kategorien payment und cloud. Nicht antwortende Hosts zählen nicht mit; antworten weniger als 60 %
// der Liste, wird nichts gemeldet (ein Teil der Liste ist kein Atlassian-System oder nicht erreichbar).
// Harmlose Ursachen: ein einzelner großer Cloud-/CDN-Ausfall zieht viele Anbieter mit; Wartungsfenster werden als "none" gewertet;
// Anbieter mit Statuspage-Kompatibilitätsschicht (z. B. incident.io) können abweichend melden.
// Liste: catalog/statuspage-hosts.json. Höchstens 60 Requests pro Lauf (begründet durch die Zahl der Hosts).
// VERIFIED: nein (Form nach Doku: { page: {...}, status: { indicator: none|minor|major|critical, description } }; GitHub laut Katalog geprüft)

import hosts from '../../catalog/statuspage-hosts.json' with { type: 'json' };
import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

export type Indicator = 'none' | 'minor' | 'major' | 'critical';
export interface HostDef { host: string; name: string; category: string }
export interface HostResult { host: string; category: string; indicator: Indicator }

interface StatusResp { status?: { indicator?: string } }

export const HOSTS: HostDef[] = hosts as HostDef[];
export const MIN_RESPONSE_SHARE = 0.6;

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

/** Returns null when fewer than 60 % of the listed hosts answered (a partial base would distort the share). */
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
      plain: 'Wie viel Prozent von rund 60 Cloud-, SaaS-, Zahlungs- und Krypto-Anbietern gerade eine schwere (major/critical) Störung melden.',
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
    const agg = aggregate(results, HOSTS.length);
    if (!agg) {
      ctx.log(`nur ${results.length} von ${HOSTS.length} Hosts antworten (< 60 %), kein Wert gemeldet`);
      return { observations: [] };
    }
    // 15-minute slot of the poll time
    const ts = new Date(Math.floor(ctx.now.getTime() / 900_000) * 900_000);
    const meta = { responders: agg.responders, hosts: HOSTS.length };
    const observations: Observation[] = [
      obs('cyber.services.statuspage_incident_rate', ts, agg.majorPct, { ...meta, major: agg.major }),
      obs('cyber.services.statuspage_disruption_share', ts, agg.disruptionPct, { ...meta, disrupted: agg.disrupted }),
    ];
    for (const [cat, id] of [['payment', 'cyber.finance.statuspage_payment_disruption'], ['cloud', 'cyber.services.statuspage_cloud_disruption']] as const) {
      const c = agg.byCategory[cat];
      if (c && c.n >= MIN_CATEGORY_RESPONDERS) observations.push(obs(id, ts, c.pct, { responders: c.n, disrupted: c.disrupted }));
      else ctx.log(`Kategorie ${cat}: zu wenige antwortende Hosts (${c?.n ?? 0}), kein Wert`);
    }
    return { observations };
  },
};

export default collector;
