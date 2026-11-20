// AlienVault OTX (LevelBlue Open Threat Exchange), Pulse-Suche (Klasse B: Berichte von Community und Anbietern).
// Quelle: https://otx.alienvault.com/api/v1/search/pulses?q=<begriff>&sort=-created&limit=50
// Doku: https://otx.alienvault.com/assets/static/external_api.html (search/pulses: Parameter q, sort [modified, created,
//   subscriber_count], limit, page) und SDK https://github.com/AlienVault-OTX/OTX-Python-SDK (OTXv2.py, search_pulses).
// Key: SR_OTX_KEY im Header X-OTX-API-KEY. Ohne Key HTTP 403 {"detail": "Authentication required"} (geprüft 20.11.2026).
// Lizenz/Bedingungen: OTX-Nutzungsbedingungen (https://otx.alienvault.com/terms, Seite nur per JavaScript lesbar, nicht
//   geprüft). Pulses sind Beiträge Dritter; Quelle "AlienVault OTX" nennen. Rate-Limit nicht dokumentiert: 3 Anfragen/Lauf.
// Gemessen (neue Pulses je voller UTC-Tag nach `created`, letzte 14 Tage, entdoppelt nach Pulse-id):
//   - cyber.threat.otx_wiper_pulses: Suche "wiper"
//   - cyber.threat.otx_ics_pulses: Suche "ICS" und "SCADA" (Vereinigung)
//   Sortierung -created, limit 50: Ist die Seite voll, gelten nur Tage nach dem Tag des ältesten Treffers als vollständig.
// Neue IDs statt der Katalog-IDs: cyber.threat.wiper_reports (malwarebazaar), cyber.threat.ics_malware (cisa-ics) und
//   cyber.threat.threatfox_ioc_volume (threatfox) haben schon eigene Collectors; dieselbe ID würde zwei Quellen in eine Reihe
//   mischen. OTX ist im Katalog dort nur "Alternative Quelle".
// Not built: cyber.threat.threatfox_ioc_volume (gehört zum Collector threatfox; OTX-Pulse-Zahl ist keine IOC-Zahl).
// Harmlose Ursachen: einzelne Vielschreiber-Konten, Nachträge alter Berichte, Medienwelle nach großem Vorfall, Treffer
//   auf "ICS" in anderer Bedeutung, Spam-Pulses.
// VERIFIED: nein (ungeprüft bis Key). Antwortform laut Doku/SDK: { count, next, previous, results: [ { id, name,
//   created: "2026-11-19T12:34:56.123000", modified, tags[], ... } ] }.

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, obs } from './_helpers.ts';

const API = 'https://otx.alienvault.com/api/v1/search/pulses';
const LIMIT = 50;
const DAYS = 14;
const S_WIPER = 'cyber.threat.otx_wiper_pulses';
const S_ICS = 'cyber.threat.otx_ics_pulses';

export const QUERIES: { signal: string; q: string; slug: string }[] = [
  { signal: S_WIPER, q: 'wiper', slug: 'wiper' },
  { signal: S_ICS, q: 'ICS', slug: 'ics' },
  { signal: S_ICS, q: 'SCADA', slug: 'scada' },
];

export const searchUrl = (q: string) => `${API}?q=${encodeURIComponent(q)}&sort=-created&limit=${LIMIT}&page=1`;

export interface PulsePage { pulses: { id: string; t: number }[]; full: boolean }

function utc(s: unknown): number | null {
  if (typeof s !== 'string' || !s) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? t : null;
}

export function parsePulses(body: unknown): PulsePage {
  const b = expect(body as { results?: unknown } | null, 'JSON-Körper');
  const results = expect(Array.isArray(b.results) ? (b.results as Record<string, unknown>[]) : null, 'results');
  const pulses: { id: string; t: number }[] = [];
  for (const r of results) {
    const t = utc(r?.created);
    if (r?.id === undefined || r?.id === null || t === null) continue;
    pulses.push({ id: String(r.id), t });
  }
  return { pulses, full: results.length >= LIMIT };
}

/** Pulses je voller UTC-Tag; bei vollen Seiten nur Tage, die sicher vollständig abgedeckt sind. */
export function dailyCounts(signalId: string, pages: PulsePage[], now: Date, days = DAYS): Observation[] {
  const end = floorDay(now).getTime();
  let start = end - days * DAY_MS;
  for (const p of pages) {
    if (!p.full) continue;
    const oldest = Math.min(...p.pulses.map((x) => x.t));
    if (Number.isFinite(oldest)) start = Math.max(start, floorDay(new Date(oldest)).getTime() + DAY_MS);
    else return [];
  }
  const seen = new Map<string, number>();
  for (const p of pages) for (const x of p.pulses) seen.set(x.id, x.t);
  const out: Observation[] = [];
  for (let d = start; d < end; d += DAY_MS) {
    let n = 0;
    for (const t of seen.values()) if (t >= d && t < d + DAY_MS) n++;
    out.push(obs(signalId, d, n));
  }
  return out;
}

const base = {
  scenarios: ['cyber'], domain: 'threat', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'high' as const, independenceGroup: 'otx', unit: 'Pulses/Tag', intervalMinutes: 1440,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  sourceName: 'AlienVault OTX (Pulse-Suche)', sourceUrl: 'https://otx.alienvault.com/',
  license: 'OTX-Nutzungsbedingungen (nicht geprüft); Quelle AlienVault OTX nennen',
};

const collector: Collector = {
  id: 'otx',
  title: 'AlienVault OTX (Pulse-Suche)',
  sourceUrl: 'https://otx.alienvault.com/',
  needsKey: 'SR_OTX_KEY',
  intervalMinutes: 1440,
  signals: [
    { ...base, id: S_WIPER, name: 'OTX-Berichte zu Wiper-Malware', weight: 0.6,
      plain: 'Wie viele neue Berichte über datenzerstörende Schadsoftware (Wiper) in der OTX-Community erscheinen.' },
    { ...base, id: S_ICS, name: 'OTX-Berichte zu Industrieanlagen (ICS/SCADA)', weight: 0.55,
      plain: 'Wie viele neue Berichte über Angriffe auf Industriesteuerungen in der OTX-Community erscheinen.' },
  ],
  async collect(ctx) {
    const key = expect(ctx.key('SR_OTX_KEY'), 'SR_OTX_KEY');
    const pages = new Map<string, PulsePage[]>();
    const failed = new Set<string>();
    for (const q of QUERIES) {
      if (failed.has(q.signal)) continue;
      try {
        const body = await ctx.http.json(searchUrl(q.q), { headers: { 'X-OTX-API-KEY': key }, fixture: `otx/search-${q.slug}.json`, timeoutMs: 30_000 });
        pages.set(q.signal, [...(pages.get(q.signal) ?? []), parsePulses(body)]);
      } catch (e) {
        failed.add(q.signal); // unvollständige Vereinigung nie melden
        ctx.log(`${q.signal} (${q.q}): ${(e as Error).message}`);
      }
    }
    const observations: Observation[] = [];
    for (const s of new Set(QUERIES.map((q) => q.signal))) if (!failed.has(s)) observations.push(...dailyCounts(s, pages.get(s) ?? [], ctx.now));
    if (observations.length === 0 && failed.size) throw new Error('OTX: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
