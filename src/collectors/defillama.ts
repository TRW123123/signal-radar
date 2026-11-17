// Stablecoin-Peg: Abweichung von USDT, USDC und DAI vom Dollar (Vertrauensverlust im Krypto-Zahlungsverkehr).
// Source: DefiLlama Preis-API (coins.llama.fi), kein Key. Doku: https://defillama.com/docs/api
// Lizenz: frei nutzbar, Quellenangabe DefiLlama.
// Gemessen: größte Einzelabweichung der drei Coins von 1,00 USD in Prozent (aktueller Preis plus Tages-Historie).
// Harmlose Ursachen: kurzzeitige Börsen-Illiquidität, Datenfehler eines Preisfeeds, Emittenten-Meldungen ohne Systembezug.
// Nicht gebaut: Gesamtumlauf (stablecoincharts/all ist mehrere hundert KB), DeFi-TVL (historicalChainTvl komplette Historie, groß),
// Börsenbestände (kein API-Pfad belegt).
// VERIFIED: nein (Antwortformen nach Gedächtnis: {coins:{id:{price,timestamp}}} bzw. {coins:{id:{prices:[{timestamp,price}]}}}).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, floorDay, num, obs } from './_helpers.ts';

export const COINS = ['coingecko:tether', 'coingecko:usd-coin', 'coingecko:dai'];
const SIGNAL = 'cyber.finance.stablecoin_peg_deviation';

interface PriceResp { coins?: Record<string, { price?: unknown; timestamp?: unknown }> }
interface ChartResp { coins?: Record<string, { prices?: { timestamp?: unknown; price?: unknown }[] }> }

/** Current peg deviation in percent: the worst coin. Returns null when any coin is missing (incomplete data looks like calm). */
export function parseCurrent(body: PriceResp, ids = COINS): { value: number; ts: number | null; worst: string } | null {
  const coins = expect(body.coins, 'coins');
  let value = -1, worst = '', ts: number | null = null;
  for (const id of ids) {
    const p = num(coins[id]?.price);
    if (p === null || p <= 0) return null;
    const dev = Math.abs(p - 1) * 100;
    if (dev > value) { value = dev; worst = id; }
    const t = num(coins[id]?.timestamp);
    if (t !== null && (ts === null || t < ts)) ts = t;
  }
  return { value: Math.round(value * 10000) / 10000, ts, worst };
}

/** Daily worst deviation (percent) per UTC day, only days where all coins have a price. */
export function parseChart(body: ChartResp, ids = COINS): Map<string, number> {
  const coins = expect(body.coins, 'coins');
  const perDay = new Map<string, Map<string, number>>();
  for (const id of ids) {
    for (const pt of coins[id]?.prices ?? []) {
      const t = num(pt.timestamp), p = num(pt.price);
      if (t === null || p === null || p <= 0) continue;
      const day = new Date(t * 1000).toISOString().slice(0, 10);
      if (!perDay.has(day)) perDay.set(day, new Map());
      perDay.get(day)!.set(id, Math.abs(p - 1) * 100);
    }
  }
  const out = new Map<string, number>();
  for (const [day, m] of perDay) {
    if (ids.every((i) => m.has(i))) out.set(day, Math.round(Math.max(...m.values()) * 10000) / 10000);
  }
  return out;
}

const collector: Collector = {
  id: 'defillama',
  title: 'DefiLlama (Stablecoin-Peg)',
  sourceUrl: 'https://defillama.com/docs/api',
  intervalMinutes: 15,
  signals: [{
    id: SIGNAL, scenarios: ['cyber'], domain: 'finance', collector: 'defillama',
    name: 'Stablecoin-Abweichung vom Dollar-Peg',
    plain: 'Wie weit die größten Stablecoins (USDT, USDC, DAI) vom Kurs von einem Dollar abweichen; wächst, wenn Vertrauen oder Zugang zu Krypto-Zahlungswegen gestört sind.',
    evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.5, manipulability: 'medium', independenceGroup: 'defillama',
    unit: '%', intervalMinutes: 15, holdHours: 24, license: 'frei, Quellenangabe DefiLlama',
    baseline: { method: 'rolling', windowDays: 30, minPoints: 30 }, thresholds: { absFloor: 0.05 },
  }],
  async collect(ctx) {
    const observations: Observation[] = [];
    const ids = COINS.join(',');
    const start = Math.floor(floorDay(daysAgo(ctx.now, 60)).getTime() / 1000);
    try {
      const chart = await ctx.http.json<ChartResp>(`https://coins.llama.fi/chart/${ids}?start=${start}&span=60&period=1d`, { fixture: 'defillama/peg-chart.json' });
      const today = ctx.now.toISOString().slice(0, 10);
      for (const [day, v] of parseChart(chart)) if (day < today) observations.push(obs(SIGNAL, `${day}T00:00:00Z`, v));
    } catch (e) {
      ctx.log(`Peg-Historie übersprungen: ${(e as Error).message}`);
    }
    const cur = parseCurrent(await ctx.http.json<PriceResp>(`https://coins.llama.fi/prices/current/${ids}`, { fixture: 'defillama/peg-current.json' }));
    if (cur) {
      const base = cur.ts !== null ? cur.ts * 1000 : ctx.now.getTime();
      const ts = Math.floor(base / 900_000) * 900_000;
      observations.push(obs(SIGNAL, ts, cur.value, { worst: cur.worst }));
    } else {
      ctx.log('Peg: mindestens ein Coin ohne Preis, aktueller Wert ausgelassen');
    }
    return { observations };
  },
};

export default collector;
