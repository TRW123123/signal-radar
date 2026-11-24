// US Energy Information Administration, Open Data API v2: Stromnachfrage stündlich (EIA-930) und US-Ölreserve SPR wöchentlich.
// Quelle: https://api.eia.gov/v2/electricity/rto/region-data/data/?api_key=<KEY>&frequency=hourly&data[0]=value&facets[respondent][]=PJM
//           &facets[type][]=D&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=28   (PJM und US48)
//         https://api.eia.gov/v2/petroleum/stoc/wstk/data/?api_key=<KEY>&frequency=weekly&data[0]=value&facets[series][]=WCSSTUS1
//           &sort[0][column]=period&sort[0][direction]=desc&offset=0&length=24
// Doku: https://www.eia.gov/opendata/documentation.php (gelesen 20.11.2026: höchstens 5 000 Zeilen je JSON-Antwort, sort/offset/length).
//   Antwort: { response: { total, frequency, data: [ { period: "2026-11-20T08", respondent, type: "D", value: "85052", "value-units": "megawatthours" } ] } }
//   Fehler: { error: { code: "API_KEY_MISSING" | "OVER_RATE_LIMIT", message } }. "hourly" ist UTC (lokal wäre "local-hourly").
// Key: SR_EIA_KEY als Query-Parameter api_key. Der HTTP-Client schwärzt "api_key" nicht; dieser Collector ersetzt den Key in Fehlermeldungen.
// Lizenz: US-Regierungsdaten (gemeinfrei); Quelle "U.S. Energy Information Administration (EIA)" nennen, veränderte Daten nicht als EIA
//   ausgeben, kein Logo/keine Billigung, Rate-Limits einhalten (https://www.eia.gov/about/copyrights_reuse.php; Hinweis steht in src/core/attribution.ts).
// Gemessen (3 Requests je Lauf, stündlich):
//   ai.compute.datacenter_load_pjm  Stundenlast PJM (Regelzone mit Virginia, größtem Rechenzentrumsstandort), MW, letzte 28 Stunden
//   cyber.physical.us_demand_balancing_authorities  Stundenlast USA gesamt (Lower 48, respondent US48), MW, letzte 28 Stunden
//   war.energy.us_spr_stocks  Bestand der Strategischen Ölreserve (WCSSTUS1), Tsd. Barrel, letzte 24 Wochen
//   Die beiden jüngsten Stunden jeder Lastreihe entfallen: EIA-930 füllt sie oft erst nach (US48 ist eine Summe der meldenden Regelzonen,
//   fehlende Zonen sähen wie ein Lasteinbruch aus).
// Harmlose Ursachen: Wetter (Hitze, Kälte), Feiertage, Meldelücken einzelner Regelzonen, Revisionen; SPR: geplante Verkäufe/Rückkäufe des DOE.
// Not built: war.markets.brent_price (Katalog-Collector yahoo-chart, bereits über github-oil-prices aus EIA-Daten gespeist; zweite Quelle würde die
//   Reihe vermischen).
// VERIFIED: ja (Live-Lauf Actions 20.11.2026, Run 44717048752): 76 Werte mit dem eigenen Key; zuvor Fixtures mit DEMO_KEY (fixtures/eia/*.json, Fehlerform error-rate-limit.json).

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

const BASE = 'https://api.eia.gov/v2';
const KEY_ENV = 'SR_EIA_KEY';
const SIG_PJM = 'ai.compute.datacenter_load_pjm';
const SIG_US48 = 'cyber.physical.us_demand_balancing_authorities';
const SIG_SPR = 'war.energy.us_spr_stocks';
const HOURS = 28;
const DROP_NEWEST_HOURS = 2;

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "ai.compute.datacenter_load_pjm",scenarios: ["ai"],domain: "compute",name: "Stromlast Virginia/PJM",plain: "Stündliche Last in der Region mit den meisten Rechenzentren.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.4,manipulability: "high",independenceGroup: "eia",unit: "MW",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 60,license: "US-Regierungsdaten; Quelle \"U.S. Energy Information Administration (EIA)\" nennen, veränderte Daten nicht als EIA, kein Logo/Endorsement, Rate-Limits einhalten",banalCauses: ["Wetter"],sourceName: "EIA Open Data (Strom stündlich)",sourceUrl: "https://www.eia.gov/opendata/"},
  {id: "cyber.physical.us_demand_balancing_authorities",scenarios: ["cyber"],domain: "physical",name: "US Last je Balancing Authority",plain: "Stündliche Stromnachfrage und Erzeugung in US-Regionen.",evidenceClass: "B",direction: "down",kind: "count",weight: 0.4,manipulability: "low",independenceGroup: "eia",unit: "MW",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 60,license: "US-Regierungsdaten; Quelle \"U.S. Energy Information Administration (EIA)\" nennen, veränderte Daten nicht als EIA, kein Logo/Endorsement, Rate-Limits einhalten",banalCauses: ["Hurrikane","Kaltefront","EIA-Datenlücken","Wetter"],sourceName: "US EIA Hourly Electric Grid Monitor API",sourceUrl: "https://www.eia.gov/opendata/"},
  {id: "war.energy.us_spr_stocks",scenarios: ["war"],domain: "energy",name: "US-Strategische Ölreserve und Lager",plain: "Misst die Bestände der strategischen Ölreserve und der Öllager in den USA.",evidenceClass: "B",direction: "down",kind: "gauge",weight: 0.45,manipulability: "low",independenceGroup: "eia",unit: "Barrel",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "US-Regierungsdaten; Quelle \"U.S. Energy Information Administration (EIA)\" nennen, veränderte Daten nicht als EIA, kein Logo/Endorsement, Rate-Limits einhalten",banalCauses: ["Politik","Wartung"],sourceName: "EIA Open Data API v2",sourceUrl: "https://www.eia.gov/opendata/"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

export interface Row { period: string; value: number }

/** response.data[] -> {period, value}; wirft bei EIA-Fehlerobjekt oder fehlendem response.data. */
export function parseRows(body: unknown): Row[] {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  if (b.error) {
    const e = b.error as Record<string, unknown> | string;
    throw new Error(`EIA-Fehler: ${typeof e === 'string' ? e : `${String(e.code ?? '')} ${String(e.message ?? '')}`.trim()}`);
  }
  const resp = expect(b.response as Record<string, unknown> | undefined, 'response');
  const data = expect(Array.isArray(resp.data) ? (resp.data as unknown[]) : null, 'response.data');
  const out: Row[] = [];
  for (const d of data) {
    const r = d as Record<string, unknown>;
    const v = num(r.value);
    if (typeof r.period === 'string' && v !== null) out.push({ period: r.period, value: v });
  }
  return out;
}

/** Stundenreihe: Periode "YYYY-MM-DDTHH" (UTC) -> volle Stunde; die jüngsten `drop` Stunden der Reihe und Stunden ab der laufenden entfallen. */
export function hourly(signalId: string, rows: Row[], now: Date, drop = DROP_NEWEST_HOURS): Observation[] {
  const pts = rows
    .map((r) => ({ t: /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(r.period) ? Date.parse(`${r.period}:00:00Z`) : NaN, v: r.value }))
    .filter((p) => Number.isFinite(p.t) && p.t + 3600_000 <= now.getTime())
    .sort((a, b) => a.t - b.t);
  return pts.slice(0, Math.max(0, pts.length - drop)).map((p) => obs(signalId, p.t, p.v));
}

/** Wochenreihe: Periode "YYYY-MM-DD" -> T00:00:00Z. */
export function weekly(signalId: string, rows: Row[]): Observation[] {
  return rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.period))
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((r) => obs(signalId, `${r.period}T00:00:00Z`, r.value));
}

function demandUrl(respondent: string, key: string): string {
  return `${BASE}/electricity/rto/region-data/data/?api_key=${encodeURIComponent(key)}&frequency=hourly&data[0]=value`
    + `&facets[respondent][]=${respondent}&facets[type][]=D&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=${HOURS}`;
}
function sprUrl(key: string): string {
  return `${BASE}/petroleum/stoc/wstk/data/?api_key=${encodeURIComponent(key)}&frequency=weekly&data[0]=value`
    + '&facets[series][]=WCSSTUS1&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=24';
}

const SOURCE = { sourceName: 'U.S. Energy Information Administration (EIA)', license: 'US-Regierungsdaten; Quelle "U.S. Energy Information Administration (EIA)" nennen, keine Billigung' };

const collector: Collector = {
  id: 'eia',
  title: 'US EIA Open Data (Stromnachfrage stündlich, SPR)',
  sourceUrl: 'https://www.eia.gov/opendata/',
  needsKey: KEY_ENV,
  intervalMinutes: 60,
  signals: [
    // EIA-930 meldet mit 1 bis 2 Stunden Verzug, die 2 jüngsten Stunden entfallen zusätzlich (s. o.), Läufe kommen unregelmäßig:
    // der jüngste Wert ist deshalb meist 3 bis 6 Stunden alt; mit dem Standard (3 Stunden) galt die Reihe fast immer als veraltet.
    { ...CATALOG[SIG_PJM], ...SOURCE, sourceUrl: 'https://www.eia.gov/electricity/gridmonitor/', collector: 'eia', id: SIG_PJM, maxAgeHours: 8 },
    { ...CATALOG[SIG_US48], ...SOURCE, sourceUrl: 'https://www.eia.gov/electricity/gridmonitor/', collector: 'eia', id: SIG_US48,
      name: 'US-Stromlast gesamt (Lower 48)', plain: 'Stündlicher Stromverbrauch der USA ohne Alaska und Hawaii; ein plötzlicher Einbruch kann auf großflächige Ausfälle hindeuten.' },
    { ...CATALOG[SIG_SPR], ...SOURCE, sourceUrl: 'https://www.eia.gov/petroleum/supply/weekly/', collector: 'eia', id: SIG_SPR,
      unit: 'Tsd. Barrel', maxAgeHours: 24 * 14 },
  ],
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const jobs: [string, string, string, (rows: Row[]) => Observation[]][] = [
      [SIG_PJM, demandUrl('PJM', key), 'eia/pjm-demand.json', (r) => hourly(SIG_PJM, r, ctx.now)],
      [SIG_US48, demandUrl('US48', key), 'eia/us48-demand.json', (r) => hourly(SIG_US48, r, ctx.now)],
      [SIG_SPR, sprUrl(key), 'eia/spr-weekly.json', (r) => weekly(SIG_SPR, r)],
    ];
    const observations: Observation[] = [];
    let failed = 0;
    let firstErr = '';
    for (const [sig, url, fixture, build] of jobs) {
      try {
        observations.push(...build(parseRows(await ctx.http.json(url, { fixture }))));
      } catch (e) {
        failed++;
        const msg = (e instanceof Error ? e.message : String(e)).split(key).join('REDACTED').split(encodeURIComponent(key)).join('REDACTED');
        firstErr ||= msg;
        ctx.log(`eia: ${sig} fehlgeschlagen: ${msg}`);
      }
    }
    if (failed === jobs.length) throw new Error(`EIA: alle Abrufe fehlgeschlagen (${firstErr})`);
    return { observations };
  },
};

export default collector;
