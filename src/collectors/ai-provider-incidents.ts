// KI-Plattformen: Störungs-Beginne pro Tag bei den großen KI-Anbietern (OpenAI, Anthropic) aus deren öffentlichen Statusseiten.
// Quelle: <host>/api/v2/incidents.json (Atlassian-Statuspage-API, ohne Key; OpenAI nutzt incident.io mit Statuspage-kompatibler API,
// status.json beider Hosts ist seit 17.11.2026 als echte Antwort aufgezeichnet: fixtures/statuspage/status.{openai,anthropic}.com.json).
// Doku: https://developer.statuspage.io/ (Abschnitt "Incidents"). Lizenz/Nutzung: je Anbieter unklar; zwei kleine Leseabfragen je Lauf.
// Gemessen: Zahl der neu begonnenen Störungen (impact minor|major|critical, bzw. ohne impact-Feld) je vollem UTC-Tag, je Anbieter und
// als Summe. incidents.json liefert höchstens die letzten 50 Störungen; ist die Liste voll, beginnt der gemeldete Zeitraum erst am Tag
// nach dem ältesten Eintrag (davor wären Tage unvollständig). Gemeldet wird nur bei mindestens 7 vollen Tagen; die Summe nur, wenn beide
// Anbieter eine gültige Liste geliefert haben (ein fehlender Summand sähe wie ein Rückgang aus). So entsteht sofort eine Baseline.
// Ort: beide Anbieter haben ihren Sitz in San Francisco (catalog/geo.json).
// Harmlose Ursachen: Modellstarts mit Lastspitzen, Ausfälle der Cloud-Anbieter darunter, Wartung mit Fehlerbildern, sehr feine
// Störungsmeldungen einzelner Teildienste (ein Anbieter meldet mehr Kleinigkeiten als ein anderer).
// Unterschied zu src/collectors/statuspage.ts: dort 8 Leitanbieter aus Cloud/Zahlung/Entwicklung und mindestens 14 Tage Historie;
// hier nur KI-Anbieter, 7 Tage Mindesthistorie und Einträge ohne impact-Feld (incident.io) zählen mit.
// VERIFIED: ja (Live-Lauf 24.11.2026, 135 Beobachtungen)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, obs } from './_helpers.ts';
import { isStatusHost } from './statuspage.ts';

export const PROVIDERS = [
  { key: 'openai', host: 'status.openai.com', name: 'OpenAI', signal: 'ai.platforms.openai_incident_starts' },
  { key: 'anthropic', host: 'status.anthropic.com', name: 'Anthropic', signal: 'ai.platforms.anthropic_incident_starts' },
] as const;
export const SIG_SUM = 'ai.platforms.ai_provider_incident_starts';
export const INCIDENT_CAP = 50;
export const MIN_DAYS = 7;
export const MAX_DAYS = 45;

export const incidentsUrl = (host: string): string => {
  if (!isStatusHost(host)) throw new Error('ai-provider-incidents: ungueltiger Host');
  return `https://${host}/api/v2/incidents.json`;
};
export const fixtureName = (host: string) => `ai-provider-incidents/${host}.json`;

export interface StartList { starts: number[]; full: boolean; oldest: number | null }
interface IncidentsResp { incidents?: { created_at?: string; started_at?: string; impact?: string | null }[] }

/** incidents.json -> Beginn-Zeitpunkte. impact "none" (Hinweise ohne Auswirkung) zählt nicht; fehlendes impact zählt (incident.io). */
export function parseStarts(body: IncidentsResp): StartList {
  const list = expect(body?.incidents, 'incidents');
  if (!Array.isArray(list)) throw new Error('unerwartete Antwort: incidents ist keine Liste');
  const starts: number[] = [];
  let oldest: number | null = null;
  for (const i of list) {
    const t = Date.parse(String(i?.started_at ?? i?.created_at ?? ''));
    if (!Number.isFinite(t)) continue;
    if (oldest === null || t < oldest) oldest = t;
    if (i.impact === 'none') continue;
    starts.push(t);
  }
  return { starts, full: list.length >= INCIDENT_CAP, oldest };
}

/** Tageszählung über volle UTC-Tage bis gestern; null, wenn eine Liste fehlt oder weniger als MIN_DAYS Tage sicher abgedeckt sind. */
export function dailyCounts(lists: (StartList | null)[], now: Date): { day: string; n: number }[] | null {
  if (lists.length === 0 || lists.some((l) => l === null)) return null;
  const today = floorDay(now).getTime();
  let from = today - MAX_DAYS * DAY_MS;
  for (const l of lists as StartList[]) {
    if (l.full && l.oldest !== null) from = Math.max(from, floorDay(new Date(l.oldest)).getTime() + DAY_MS);
  }
  if ((today - from) / DAY_MS < MIN_DAYS) return null;
  const days = new Map<string, number>();
  for (let t = from; t < today; t += DAY_MS) days.set(isoDay(new Date(t)), 0);
  for (const l of lists as StartList[]) {
    for (const s of l.starts) {
      const d = isoDay(new Date(s));
      if (days.has(d)) days.set(d, days.get(d)! + 1);
    }
  }
  return [...days.entries()].sort().map(([day, n]) => ({ day, n }));
}

const COMMON = {
  scenarios: ['ai'], domain: 'platforms', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'low' as const, independenceGroup: 'ai-provider-status', unit: 'Störungen/Tag', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  license: 'je Anbieter unklar (öffentliche Statuspage-API)', sourceUrl: 'https://developer.statuspage.io/',
  banalCauses: ['Start neuer Modelle mit Lastspitzen', 'Ausfall eines Cloud-Anbieters darunter', 'Feine Meldungen zu einzelnen Teildiensten'],
};

const collector: Collector = {
  id: 'ai-provider-incidents',
  title: 'KI-Anbieter: Störungs-Beginne pro Tag (Statusseiten OpenAI, Anthropic)',
  sourceUrl: 'https://developer.statuspage.io/',
  intervalMinutes: 360,
  signals: [
    {
      ...COMMON, id: SIG_SUM, weight: 0.5, name: 'Neue Störungen bei OpenAI und Anthropic pro Tag',
      plain: 'Wie viele neue Störungen die beiden großen KI-Anbieter OpenAI und Anthropic pro Tag auf ihren Statusseiten melden.',
      sourceName: 'Statusseiten OpenAI und Anthropic (incidents.json)',
    },
    ...PROVIDERS.map((p) => ({
      ...COMMON, id: p.signal, weight: 0.3, name: `Neue Störungen bei ${p.name} pro Tag`,
      plain: `Wie viele neue Störungen ${p.name} pro Tag auf seiner öffentlichen Statusseite meldet.`,
      sourceName: `Statusseite ${p.name} (${p.host})`, sourceUrl: `https://${p.host}/`,
    })),
  ],
  async collect(ctx) {
    const lists = await Promise.all(PROVIDERS.map(async (p) => {
      try {
        return parseStarts(await ctx.http.json<IncidentsResp>(incidentsUrl(p.host), { fixture: fixtureName(p.host) }));
      } catch (e) {
        ctx.log(`incidents.json ${p.host} nicht nutzbar: ${(e as Error).message}`);
        return null;
      }
    }));
    if (lists.every((l) => l === null)) throw new Error('keine Statusseite der KI-Anbieter lieferte eine gültige Störungsliste');
    const observations: Observation[] = [];
    PROVIDERS.forEach((p, i) => {
      const s = dailyCounts([lists[i]], ctx.now);
      if (!s) { ctx.log(`${p.name}: weniger als ${MIN_DAYS} volle Tage oder keine Liste, kein Wert`); return; }
      for (const d of s) observations.push(obs(p.signal, `${d.day}T00:00:00Z`, d.n));
    });
    const sum = dailyCounts(lists, ctx.now);
    if (sum) for (const d of sum) observations.push(obs(SIG_SUM, `${d.day}T00:00:00Z`, d.n, { providers: PROVIDERS.length }));
    else ctx.log('Summe nicht gemeldet: nicht alle Anbieter lieferten eine nutzbare Liste');
    return { observations };
  },
};

export default collector;
