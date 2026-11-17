// US-Repo-Markt: SOFR-Spreizung und Nutzung der Standing Repo Facility (SRF) der New York Fed.
// Source: NY Fed Markets API, kein Key. Doku: https://markets.newyorkfed.org/static/docs/markets-api.html
// Lizenz: NY Fed Terms of Use (frei mit Quellenangabe).
// Gemessen: (1) SOFR-Tail = 99. Perzentil minus Median in Basispunkten, (2) SOFR-Volumen in Mrd. USD,
// (3) je Tag angenommener Betrag in der SRF (Repo-Operationen der Fed) in Mrd. USD.
// Harmlose Ursachen: Monats-/Quartalsende, Steuertermine (15. Jan/Apr/Jun/Sep), Treasury-Abwicklungstage.
// Nicht gebaut: Reverse-Repo-Nutzung (strukturell fallender Trend, keine Stress-Aussage, große Antwort).
// VERIFIED: nein (Pfade und Feldnamen nach Katalog/Gedächtnis; SOFR-Felder im Katalog als HTTP-200-geprüft vermerkt).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

interface SofrResp { refRates?: Record<string, unknown>[] }
interface RpResp { repo?: { operations?: Record<string, unknown>[] }; operations?: Record<string, unknown>[] }

export function parseSofr(body: SofrResp): Observation[] {
  const rows = expect(body.refRates, 'refRates');
  const out: Observation[] = [];
  for (const r of rows) {
    const day = String(r.effectiveDate ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const ts = `${day}T00:00:00Z`;
    const rate = num(r.percentRate);
    const p99 = num(r.percentPercentile99);
    const vol = num(r.volumeInBillions);
    if (rate !== null && p99 !== null) out.push(obs('cyber.finance.sofr_tail', ts, Math.round((p99 - rate) * 10000) / 100, { rate, p99 }));
    if (vol !== null) out.push(obs('cyber.finance.sofr_volume', ts, vol));
  }
  return out;
}

/** Sums accepted amounts of Repo operations per operation date (USD to billions). Reverse repos are ignored. */
export function parseSrf(body: RpResp, today: string): Observation[] {
  const ops = expect(body.repo?.operations ?? body.operations, 'repo.operations');
  const perDay = new Map<string, number>();
  for (const o of ops) {
    const day = String(o.operationDate ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= today) continue;
    if (/reverse/i.test(String(o.operationType ?? ''))) continue;
    const amt = num(o.totalAmtAccepted);
    if (amt === null) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + amt / 1e9);
  }
  return [...perDay.entries()].sort().map(([d, v]) => obs('cyber.finance.fed_repo_facility_usage', `${d}T00:00:00Z`, Math.round(v * 1000) / 1000));
}

const common = {
  scenarios: ['cyber'], domain: 'finance', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'nyfed-markets', collector: 'nyfed-markets', intervalMinutes: 1440,
  license: 'NY Fed Terms of Use (frei mit Quelle)', holdHours: 72,
};

const collector: Collector = {
  id: 'nyfed-markets',
  title: 'NY Fed Markets API (SOFR, Repo)',
  sourceUrl: 'https://markets.newyorkfed.org/static/docs/markets-api.html',
  intervalMinutes: 720,
  signals: [
    {
      ...common, id: 'cyber.finance.sofr_tail', name: 'SOFR: Spreizung 99. Perzentil minus Median',
      plain: 'Wie viel teurer sich die teuersten US-Repo-Geschäfte gegenüber dem Normalfall verzinsen; wächst bei Geldknappheit.',
      direction: 'up', kind: 'gauge', unit: 'Basispunkte', weight: 0.55,
      baseline: { method: 'rolling', windowDays: 60, minPoints: 20 }, thresholds: { absFloor: 1 },
    },
    {
      ...common, id: 'cyber.finance.sofr_volume', name: 'SOFR: Handelsvolumen',
      plain: 'Wie viel Geld im US-Repo-Markt über Nacht umgeschlagen wird; starke Abweichungen deuten auf Störungen.',
      direction: 'both', kind: 'gauge', unit: 'Mrd. USD', weight: 0.3,
      baseline: { method: 'rolling', windowDays: 60, minPoints: 20 },
    },
    {
      ...common, id: 'cyber.finance.fed_repo_facility_usage', name: 'Fed Standing Repo Facility: Nutzung',
      plain: 'Wie viel Geld sich Banken bei der Notfazilität der US-Notenbank leihen; fast immer nahe null, Ausschläge zeigen Engpässe.',
      direction: 'up', kind: 'gauge', unit: 'Mrd. USD', weight: 0.45,
      baseline: { method: 'rolling', windowDays: 60, minPoints: 20 }, thresholds: { absFloor: 2 },
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const sofr = await ctx.http.json<SofrResp>('https://markets.newyorkfed.org/api/rates/secured/sofr/last/60.json', { fixture: 'nyfed/sofr-last60.json' });
    observations.push(...parseSofr(sofr));
    try {
      const start = isoDay(daysAgo(ctx.now, 60));
      const end = isoDay(daysAgo(ctx.now, 1));
      const url = `https://markets.newyorkfed.org/api/rp/repo/all/results/search.json?startDate=${start}&endDate=${end}`;
      const rp = await ctx.http.json<RpResp>(url, { fixture: 'nyfed/srf-search.json' });
      observations.push(...parseSrf(rp, isoDay(ctx.now)));
    } catch (e) {
      ctx.log(`SRF übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
