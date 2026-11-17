// Geldmarkt- und Stablecoin-Stress für das Szenario Finanzkrise (Klasse A). Dünne Hülle um vorhandene Collectors:
//   stellt dieselben Requests mit denselben Fixture-Namen wie `nyfed-markets`, `ecb-data` und `defillama` (diese sind nicht
//   konfigurationsgesteuert und bleiben unverändert), nutzt deren exportierte Parser und meldet die Werte unter finance.*-IDs.
// Quellen: NY Fed Markets API (SOFR, Lizenz: NY Fed Terms of Use), EZB Data Portal (€STR, Quelle: EZB), DefiLlama (Stablecoin-Preise, Quellenangabe DefiLlama). Kein Key.
// Gemessen: SOFR-Streuung (99. Perzentil minus Satz, Basispunkte) und SOFR-Volumen; €STR-Streuung (75. minus 25. Perzentil) und €STR-Volumen;
//   größte Abweichung von USDT, USDC und DAI vom Dollar (Prozent).
// Harmlose Ursachen: Monats-/Quartalsende, Steuertermine, Treasury-Abwicklung (SOFR); Mindestreserve-Perioden und EZB-Zinsentscheide (€STR);
//   dünne Börsenpreise einzelner Coins (Stablecoins).
// Nicht übernommen: Standing Repo Facility (Fixture nyfed/srf-search.json fehlt noch).
// VERIFIED: ja (17.11.2026, Replay mit echten Antworten: SOFR-Streuung 7 bp, SOFR-Volumen 3092 Mrd. USD am 13.11., Stablecoin 0,081 %)

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, floorDay } from './_helpers.ts';
import { obs } from './_helpers.ts';
import { parseSofr } from './nyfed-markets.ts';
import { buildObservations, parseEstCsv } from './ecb-data.ts';
import { COINS, parseChart, parseCurrent } from './defillama.ts';

const ID = {
  sofrTail: 'finance.money_market.sofr_tail',
  sofrVolume: 'finance.money_market.sofr_volume',
  estrSpread: 'finance.money_market.estr_spread',
  estrVolume: 'finance.money_market.estr_volume',
  depeg: 'finance.crypto.stablecoin_depeg',
};
const RENAME: Record<string, string> = {
  'cyber.finance.sofr_tail': ID.sofrTail,
  'cyber.finance.sofr_volume': ID.sofrVolume,
  'cyber.finance.estr_percentile_spread': ID.estrSpread,
  'cyber.finance.estr_volume': ID.estrVolume,
};
const ESTR_SERIES = ['VL', 'R25', 'R75'] as const;

/** Benennt Beobachtungen der Quell-Collectors auf finance.*-IDs um; unbekannte IDs entfallen. */
export function rename(list: Observation[]): Observation[] {
  const out: Observation[] = [];
  for (const o of list) {
    const id = RENAME[o.signalId];
    if (id) out.push({ ...o, signalId: id });
  }
  return out;
}

const common = {
  scenarios: ['finance'], evidenceClass: 'A' as const, manipulability: 'low' as const, kind: 'gauge' as const, holdHours: 72,
};
const nyfed = { ...common, domain: 'money_market', independenceGroup: 'nyfed-markets', collector: 'finance-money-market', intervalMinutes: 1440,
  sourceName: 'NY Fed Markets API', sourceUrl: 'https://markets.newyorkfed.org/static/docs/markets-api.html', license: 'NY Fed Terms of Use (frei mit Quelle)' };
const ecb = { ...common, domain: 'money_market', independenceGroup: 'ecb-data', collector: 'finance-money-market', intervalMinutes: 1440,
  sourceName: 'EZB Data Portal SDMX API', sourceUrl: 'https://data.ecb.europa.eu/help/api/data', license: 'EZB-Datenpolitik, Quellenangabe' };

const collector: Collector = {
  id: 'finance-money-market',
  title: 'Geldmarkt-Stress (SOFR, €STR) und Stablecoin-Peg für Finanzkrise',
  sourceUrl: 'https://markets.newyorkfed.org/static/docs/markets-api.html',
  intervalMinutes: 720,
  signals: [
    {
      ...nyfed, id: ID.sofrTail, name: 'SOFR: Streuung nach oben', direction: 'up', weight: 0.85, unit: 'Basispunkte',
      plain: 'Wie weit die teuersten Tagesgeld-Abschlüsse in den USA vom Durchschnitt abweichen; Stress zeigt sich zuerst am Rand.',
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 }, thresholds: { absFloor: 1 },
      banalCauses: ['Monatsende/Quartalsende', 'Steuertermine', 'Treasury-Auktionen und -Abwicklung'],
    },
    {
      ...nyfed, id: ID.sofrVolume, name: 'SOFR: Handelsvolumen', direction: 'both', weight: 0.3, unit: 'Mrd. USD',
      plain: 'Wie viel Geld im US-Repo-Markt über Nacht umgeschlagen wird; starke Abweichungen deuten auf Störungen.',
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 }, banalCauses: ['Monatsende/Quartalsende', 'Treasury-Abwicklung'],
    },
    {
      ...ecb, id: ID.estrSpread, name: '€STR: Streuung der Zinssätze', direction: 'up', weight: 0.8, unit: 'Basispunkte',
      plain: 'Wie weit die Euro-Tagesgeldsätze auseinanderlaufen.',
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 }, thresholds: { absFloor: 0.5 },
      banalCauses: ['Reserveperioden-Ende', 'Quartalsende', 'EZB-Zinsentscheide'],
    },
    {
      ...ecb, id: ID.estrVolume, name: '€STR: Handelsvolumen', direction: 'both', weight: 0.35, unit: 'Mrd. EUR',
      plain: 'Wie viel Geld sich Banken im Euroraum über Nacht leihen; Einbrüche oder Sprünge deuten auf Störungen im Geldmarkt.',
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 }, banalCauses: ['Reserveperioden-Ende', 'Jahresende'],
    },
    {
      ...common, id: ID.depeg, domain: 'crypto', independenceGroup: 'defillama', collector: 'finance-money-market',
      name: 'Stablecoin-Abweichungen', direction: 'up', weight: 0.6, unit: '%', intervalMinutes: 15, holdHours: 24,
      plain: 'Wie weit die größten Stablecoins (USDT, USDC, DAI) vom 1-Dollar-Preis abweichen; Entkopplung ist ein Panikzeichen.',
      baseline: { method: 'rolling', windowDays: 30, minPoints: 30 }, thresholds: { absFloor: 0.05 },
      sourceName: 'DefiLlama API', sourceUrl: 'https://defillama.com/docs/api', license: 'frei, Quellenangabe DefiLlama',
      banalCauses: ['Kurzzeitige Börsen-Illiquidität', 'Fehler eines Preisfeeds'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    // SOFR (Fixture wie nyfed-markets)
    const sofr = await ctx.http.json<Parameters<typeof parseSofr>[0]>('https://markets.newyorkfed.org/api/rates/secured/sofr/last/60.json', { fixture: 'nyfed/sofr-last60.json' });
    observations.push(...rename(parseSofr(sofr)));
    // €STR (Fixtures wie ecb-data), Teilausfall melden und weitermachen
    try {
      const merged = new Map<string, Map<string, number>>();
      for (const code of ESTR_SERIES) {
        const url = `https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.${code}?lastNObservations=90&detail=dataonly&format=csvdata`;
        const text = await ctx.http.text(url, { fixture: `ecb/est-${code.toLowerCase()}.csv` });
        for (const [k, v] of parseEstCsv(text)) merged.set(k, v);
      }
      observations.push(...rename(buildObservations(merged)));
    } catch (e) {
      ctx.log(`€STR übersprungen: ${(e as Error).message}`);
    }
    // Stablecoin-Peg (Fixtures wie defillama)
    const ids = COINS.join(',');
    try {
      const start = Math.floor(floorDay(daysAgo(ctx.now, 60)).getTime() / 1000);
      const chart = await ctx.http.json<Parameters<typeof parseChart>[0]>(`https://coins.llama.fi/chart/${ids}?start=${start}&span=60&period=1d`, { fixture: 'defillama/peg-chart.json' });
      const today = ctx.now.toISOString().slice(0, 10);
      for (const [day, v] of parseChart(chart)) if (day < today) observations.push(obs(ID.depeg, `${day}T00:00:00Z`, v));
    } catch (e) {
      ctx.log(`Peg-Historie übersprungen: ${(e as Error).message}`);
    }
    try {
      const cur = parseCurrent(await ctx.http.json<Parameters<typeof parseCurrent>[0]>(`https://coins.llama.fi/prices/current/${ids}`, { fixture: 'defillama/peg-current.json' }));
      if (cur) {
        const base = cur.ts !== null ? cur.ts * 1000 : ctx.now.getTime();
        observations.push(obs(ID.depeg, Math.floor(base / 900_000) * 900_000, cur.value, { worst: cur.worst }));
      }
    } catch (e) {
      ctx.log(`Peg aktuell übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
