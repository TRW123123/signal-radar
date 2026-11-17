// EZB Data Portal: Zinsstrukturkurve (10 Jahre minus 3 Monate) und Wechselkurs-Schwankung (USD, JPY, CHF je EUR) für das Szenario Finanzkrise.
// Quelle: EZB Data Portal SDMX API, im selben URL-Schema wie `ecb-data` (…/service/data/<Flow>/<Key>?lastNObservations=50&detail=dataonly&format=csvdata), kein Key.
//   Flows: YC (Euro-AAA-Zinsstrukturkurve, Schlüssel B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y und SR_3M) und EXR (Referenzkurse D.<Währung>.EUR.SP00.A).
// Lizenz: EZB Reuse Policy (Quelle: EZB). Doku: https://data.ecb.europa.eu/help/api/data
// Gemessen: (1) Zinsabstand 10 Jahre minus 3 Monate in Prozentpunkten je Tag (Inversion deutet auf Rezession, rasches Wiederansteigen begleitet oft Krisen);
//   (2) Mittel der Beträge der Tagesrenditen von EUR/USD, EUR/JPY und EUR/CHF in Prozent (nur Tage, an denen alle drei Kurse vorliegen).
// Harmlose Ursachen: Zinsentscheide der EZB und Fed, Konjunkturdaten, Feiertage (kein Kurs), Monats-/Quartalsende.
// Nicht gebaut: Renditeabstand Italien/Deutschland (Flow IRS ist monatlich, kein Tageswert).
// Annahmen laut Doku, nicht gegen eine echte Antwort geprüft: Spalten KEY, TIME_PERIOD, OBS_VALUE wie bei Flow EST (derselbe Parser wie in `ecb-data`).
// VERIFIED: ja (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel)

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';
import { parseEstCsv } from './ecb-data.ts';

const SIG_CURVE = 'finance.credit.ecb_yield_curve_spread';
const SIG_FX = 'finance.volatility.fx_vol';
const CCYS = ['USD', 'JPY', 'CHF'] as const;
const base = 'https://data-api.ecb.europa.eu/service/data';
const tail = 'lastNObservations=50&detail=dataonly&format=csvdata';
export const URL_10Y = `${base}/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?${tail}`;
export const URL_3M = `${base}/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M?${tail}`;
export const urlFx = (c: string) => `${base}/EXR/D.${c}.EUR.SP00.A?${tail}`;

/** Erste (einzige) Serie der Antwort als Datum -> Wert. */
export function firstSeries(text: string): Map<string, number> {
  const all = parseEstCsv(text);
  const first = all.values().next().value as Map<string, number> | undefined;
  return expect(first && first.size ? first : null, 'Serie');
}

export function curveSpread(y10: Map<string, number>, y3m: Map<string, number>): Observation[] {
  const out: Observation[] = [];
  for (const [d, v] of [...y10.entries()].sort()) {
    const s = y3m.get(d);
    if (s !== undefined) out.push(obs(SIG_CURVE, `${d}T00:00:00Z`, Math.round((v - s) * 1000) / 1000));
  }
  return out;
}

/** Mittel der Beträge der Tagesrenditen in Prozent, nur Tage, an denen jede Währung den Vorwert und den Tageswert hat. */
export function fxVol(series: Map<string, number>[]): Observation[] {
  const rets = series.map((m) => {
    const days = [...m.keys()].sort();
    const r = new Map<string, number>();
    for (let i = 1; i < days.length; i++) {
      const a = m.get(days[i - 1])!;
      const b = m.get(days[i])!;
      if (a > 0 && b > 0) r.set(days[i], Math.abs((b / a - 1) * 100));
    }
    return r;
  });
  const out: Observation[] = [];
  for (const d of [...(rets[0]?.keys() ?? [])].sort()) {
    if (!rets.every((r) => r.has(d))) continue;
    const mean = rets.reduce((s, r) => s + r.get(d)!, 0) / rets.length;
    out.push(obs(SIG_FX, `${d}T00:00:00Z`, Math.round(mean * 10000) / 10000));
  }
  return out;
}

const common = {
  scenarios: ['finance'], evidenceClass: 'A' as const, manipulability: 'low' as const, kind: 'gauge' as const, independenceGroup: 'ecb-data',
  collector: 'ecb-finance-rates', intervalMinutes: 1440, holdHours: 72, maxAgeHours: 120,
  baseline: { method: 'rolling' as const, windowDays: 90, minPoints: 30 },
  sourceName: 'EZB Data Portal SDMX API', sourceUrl: 'https://data.ecb.europa.eu/help/api/data', license: 'EZB Reuse Policy (Quelle: EZB)',
};

const collector: Collector = {
  id: 'ecb-finance-rates',
  title: 'EZB: Zinsstrukturkurve und Wechselkurs-Schwankung',
  sourceUrl: 'https://data.ecb.europa.eu/help/api/data',
  intervalMinutes: 720,
  signals: [
    {
      ...common, id: SIG_CURVE, domain: 'credit', name: 'EZB-Zinsstrukturkurve: 10 Jahre minus 3 Monate', direction: 'down', weight: 0.4, unit: 'Prozentpunkte',
      plain: 'Zinsabstand lang minus kurz im Euroraum; Inversion deutet auf Rezession, ein plötzliches Wiederansteigen begleitet oft Krisen.',
      thresholds: { absFloor: 0.05 }, banalCauses: ['Zinsentscheide', 'Konjunkturdaten'],
    },
    {
      ...common, id: SIG_FX, domain: 'volatility', name: 'Devisen: Schwankung von Euro gegen Dollar, Yen und Franken', direction: 'up', weight: 0.35, unit: '% (Tagesrendite, Betrag)',
      plain: 'Wie stark der Euro gegen Dollar, Yen und Franken (Fluchtwährungen) an einem Tag schwankt; Stress zeigt sich oft zuerst in Devisen.',
      thresholds: { absFloor: 0.1 }, banalCauses: ['Zentralbanktermine', 'Zinsentscheide', 'Konjunkturdaten'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    try {
      const y10 = firstSeries(await ctx.http.text(URL_10Y, { fixture: 'ecb/yc-sr-10y.csv' }));
      const y3m = firstSeries(await ctx.http.text(URL_3M, { fixture: 'ecb/yc-sr-3m.csv' }));
      observations.push(...curveSpread(y10, y3m));
    } catch (e) {
      ctx.log(`Zinsstrukturkurve übersprungen: ${(e as Error).message}`);
    }
    try {
      const series: Map<string, number>[] = [];
      for (const c of CCYS) series.push(firstSeries(await ctx.http.text(urlFx(c), { fixture: `ecb/exr-${c.toLowerCase()}.csv` })));
      observations.push(...fxVol(series)); // unvollständige Summen nie melden: ein Fehler bricht die Gruppe ab
    } catch (e) {
      ctx.log(`Devisen übersprungen: ${(e as Error).message}`);
    }
    if (!observations.length) throw new Error('keine Reihe der EZB-Abrufe verfügbar');
    return { observations };
  },
};

export default collector;
