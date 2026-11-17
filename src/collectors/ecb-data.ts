// Euro short-term rate (EUR STR / €STR) from the ECB Data Portal: money-market stress in the euro area.
// Source: ECB Data Portal SDMX API, flow EST, no key. Doku: https://data.ecb.europa.eu/help/api/data
// Lizenz: ECB Reuse Policy (Quellenangabe: "Quelle: EZB").
// Gemessen: Streuung der Zinssätze (75. minus 25. Perzentil, Basispunkte) und Handelsvolumen des €STR, je TARGET-Tag.
// Harmlose Ursachen: Mindestreserve-Perioden, EZB-Zinsentscheide, Monats-/Quartals-/Jahresende (Volumen und Streuung springen).
// Nicht gebaut: TARGET-Zahlungsstatistik (Flow TGT; Tagesreihe nicht belegt), Banknotenumlauf (wöchentlich, saisonal).
// VERIFIED: nein (Schlüssel EST.B.EU000A2X2A25.{WT,VL,R25,R75} aus der Dataset-Übersicht des Portals, Antwort nicht gesehen).

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs, parseCsv } from './_helpers.ts';

const SERIES = ['VL', 'R25', 'R75'] as const;

/** series code (last key segment, e.g. VL) -> date (YYYY-MM-DD) -> value */
export function parseEstCsv(text: string): Map<string, Map<string, number>> {
  const rows = parseCsv(text);
  const out = new Map<string, Map<string, number>>();
  if (rows.length === 0) return out;
  const head = rows[0];
  const iKey = head.indexOf('KEY');
  const iTime = head.indexOf('TIME_PERIOD');
  const iVal = head.indexOf('OBS_VALUE');
  if (iKey < 0 || iTime < 0 || iVal < 0) throw new Error('unerwartete Antwort: Spalten KEY/TIME_PERIOD/OBS_VALUE fehlen');
  for (const r of rows.slice(1)) {
    const code = (r[iKey] ?? '').split('.').pop() ?? '';
    const t = r[iTime] ?? '';
    const v = num(r[iVal]);
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(t) || v === null) continue;
    if (!out.has(code)) out.set(code, new Map());
    out.get(code)!.set(t, v);
  }
  return out;
}

/** Observations for both signals from the parsed series. Only days where every needed series exists. */
export function buildObservations(series: Map<string, Map<string, number>>): Observation[] {
  const r25 = expect(series.get('R25'), 'Serie R25');
  const r75 = expect(series.get('R75'), 'Serie R75');
  const vl = expect(series.get('VL'), 'Serie VL');
  const out: Observation[] = [];
  for (const [day, hi] of r75) {
    const lo = r25.get(day);
    if (lo !== undefined) out.push(obs('cyber.finance.estr_percentile_spread', `${day}T00:00:00Z`, Math.round((hi - lo) * 10000) / 100));
  }
  for (const [day, v] of vl) out.push(obs('cyber.finance.estr_volume', `${day}T00:00:00Z`, v));
  return out;
}

const common = {
  scenarios: ['cyber'], domain: 'finance', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'ecb-data', collector: 'ecb-data', intervalMinutes: 1440, license: 'ECB Reuse Policy (Quelle: EZB)',
};

const collector: Collector = {
  id: 'ecb-data',
  title: 'EZB Data Portal (€STR)',
  sourceUrl: 'https://data.ecb.europa.eu/help/api/overview',
  intervalMinutes: 720,
  signals: [
    {
      ...common, id: 'cyber.finance.estr_percentile_spread', name: '€STR: Streuung der Zinssätze',
      plain: 'Wie weit die Zinssätze im Euro-Interbankenhandel auseinanderlaufen; wächst bei Geldmarktstress.',
      direction: 'up', kind: 'gauge', unit: 'Basispunkte', holdHours: 72,
      baseline: { method: 'rolling', windowDays: 60, minPoints: 20 },
      thresholds: { absFloor: 0.5 },
    },
    {
      ...common, id: 'cyber.finance.estr_volume', name: '€STR: Handelsvolumen',
      plain: 'Wie viel Geld sich Banken im Euroraum über Nacht leihen; Einbrüche oder Sprünge deuten auf Störungen im Geldmarkt.',
      direction: 'both', kind: 'gauge', unit: 'Mio. EUR', holdHours: 72, weight: 0.35,
      baseline: { method: 'rolling', windowDays: 60, minPoints: 20 },
    },
  ].map((s) => ({ weight: 0.5, ...s })),
  async collect(ctx) {
    // lastNObservations gilt je Serie; detail=dataonly lässt die vielen Attributspalten weg (kleine Antwort).
    const url = `https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.${SERIES.join('+')}?lastNObservations=45&detail=dataonly&format=csvdata`;
    const text = await ctx.http.text(url, { fixture: 'ecb/est.csv' });
    return { observations: buildObservations(parseEstCsv(text)) };
  },
};

export default collector;
