// CoinGecko API (Demo-Plan): Bitcoin gegen Gold-Token und Tether-Umlauf (Klasse A laut Katalog: Börsenpreise, von CoinGecko aggregiert).
// Quelle: https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily
//         https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=30&interval=daily
//         https://api.coingecko.com/api/v3/coins/tether/market_chart?vs_currency=usd&days=2
// Doku: https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart (gelesen 20.11.2026): Antwort { prices, market_caps, total_volumes }
//   je als [[ms, Wert], ...]; ohne interval 2-90 Tage stündlich, interval=daily Tageswerte um 00:00 UTC; der letzte Punkt ist der aktuelle Stand
//   (laufende Stunde/laufender Tag) und wird verworfen.
// Key: SR_COINGECKO_KEY (Demo-Key) im Header x-cg-demo-api-key (https://docs.coingecko.com/v3.0.1/reference/authentication).
//   Die Endpunkte antworten auch ohne Key (öffentliches Limit, 20.11.2026 geprüft); der Collector setzt trotzdem needsKey, damit das
//   Demo-Kontingent (rund 30 Aufrufe/Minute, 10 000/Monat) genutzt wird: 3 Aufrufe je Lauf, Lauf stündlich -> rund 2 200/Monat.
// Lizenz: CoinGecko API Terms (https://www.coingecko.com/en/api_terms); Attribution Pflicht laut Attribution Guide
//   (https://brand.coingecko.com/resources/attribution-guide): Text wie "Data provided by CoinGecko" mit Link auf https://www.coingecko.com.
//   Noch NICHT in src/core/attribution.ts (gemeinsame Datei, Übergabe).
// Gemessen:
//   cyber.markets.bitcoin_vs_gold_divergence  BTC-Preis in Unzen Gold: BTC/USD geteilt durch PAXG/USD (PAX Gold, je Token eine Feinunze,
//     folgt dem Goldpreis), Tageswerte 00:00 UTC, letzte 30 Tage. Fällt, wenn Bitcoin gegenüber Gold verliert.
//   war.markets.crypto_stablecoin_flows  Marktkapitalisierung Tether (USDT) in USD je volle Stunde, letzte 48 Stunden (≈ Umlauf, Preis ≈ 1 USD).
// Harmlose Ursachen: allgemeine Krypto-Volatilität, Goldrally aus Zinsgründen, große Emissionen/Rücknahmen von USDT durch Tether selbst,
//   PAXG-Abweichung vom Spotgold bei dünnem Handel, Datenkorrekturen von CoinGecko.
// Not built: cyber.finance.stablecoin_peg_deviation (bereits über defillama gespeist; zweite Quelle würde die Reihe vermischen).
// VERIFIED: ja (20.11.2026, echte Antworten ohne Key: fixtures/coingecko/bitcoin-30d.json, pax-gold-30d.json, tether-2d.json).
//   Mit Demo-Key-Header noch nicht gelaufen (gleicher Endpunkt, gleiche Form laut Doku).

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

const BASE = 'https://api.coingecko.com/api/v3/coins';
const KEY_ENV = 'SR_COINGECKO_KEY';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const SIG_BTC_GOLD = 'cyber.markets.bitcoin_vs_gold_divergence';
const SIG_USDT = 'war.markets.crypto_stablecoin_flows';

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "cyber.markets.bitcoin_vs_gold_divergence",scenarios: ["cyber"],domain: "markets",name: "Bitcoin gegen Gold (Divergenz)",plain: "Wie sich Bitcoin im Vergleich zu Gold bewegt.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.2,manipulability: "medium",independenceGroup: "yahoo-chart",unit: "Kurs",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "inoffiziell, ToS erlauben keine systematische Nutzung; Lizenz unklar",banalCauses: ["Krypto-Eigenereignisse"],sourceName: "Yahoo Finance Chart (inoffizielle API)",sourceUrl: "https://finance.yahoo.com"},
  {id: "war.markets.crypto_stablecoin_flows",scenarios: ["war"],domain: "markets",name: "Stablecoin-Umlauf und BTC-Preis",plain: "Misst Umlauf von Stablecoins (z. B. USDT) und Bitcoin-Kurs als Fluchtweg für Kapital.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.25,manipulability: "medium",independenceGroup: "defillama",unit: "USD",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 60,license: "oeffentlich, Attribution erwuenscht",banalCauses: ["Krypto-Zyklus"],sourceName: "DefiLlama Stablecoins API",sourceUrl: "https://defillama.com/docs/api"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

export type Field = 'prices' | 'market_caps' | 'total_volumes';

/** [[ms, Wert]] eines Felds; unlesbare Paare entfallen. Wirft bei fehlendem Feld oder CoinGecko-Fehlerobjekt. */
export function parseChart(body: unknown, field: Field): [number, number][] {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  if (b.error || b.status && typeof b.status === 'object' && (b.status as Record<string, unknown>).error_code) {
    const st = b.status as Record<string, unknown> | undefined;
    throw new Error(`CoinGecko-Fehler: ${String(b.error ?? st?.error_message ?? st?.error_code)}`);
  }
  const arr = expect(Array.isArray(b[field]) ? (b[field] as unknown[]) : null, field);
  const out: [number, number][] = [];
  for (const p of arr) {
    if (!Array.isArray(p)) continue;
    const t = num(p[0]);
    const v = num(p[1]);
    if (t !== null && v !== null) out.push([t, v]);
  }
  return out;
}

/** Nur Punkte genau auf dem Raster (volle Stunde/Tag) und vor `now`; der Live-Punkt am Ende fällt so heraus. */
export function onGrid(points: [number, number][], stepMs: number, now: Date): Map<number, number> {
  const m = new Map<number, number>();
  for (const [t, v] of points) if (t % stepMs === 0 && t < now.getTime()) m.set(t, v);
  return m;
}

export function btcInGold(btc: [number, number][], paxg: [number, number][], now: Date): Observation[] {
  const a = onGrid(btc, DAY, now);
  const b = onGrid(paxg, DAY, now);
  const out: Observation[] = [];
  for (const [t, v] of [...a.entries()].sort((x, y) => x[0] - y[0])) {
    const g = b.get(t);
    if (g) out.push(obs(SIG_BTC_GOLD, t, Math.round((v / g) * 1000) / 1000));
  }
  return out;
}

export function hourlySeries(signalId: string, points: [number, number][], now: Date): Observation[] {
  return [...onGrid(points, HOUR, now).entries()].sort((x, y) => x[0] - y[0]).map(([t, v]) => obs(signalId, t, Math.round(v)));
}

const SOURCE = { sourceName: 'CoinGecko', sourceUrl: 'https://www.coingecko.com/', license: 'CoinGecko API Terms; Attribution "Data provided by CoinGecko" Pflicht' };

const collector: Collector = {
  id: 'coingecko',
  title: 'CoinGecko API (Demo)',
  sourceUrl: 'https://www.coingecko.com/',
  needsKey: KEY_ENV,
  intervalMinutes: 60,
  signals: [
    { ...CATALOG[SIG_BTC_GOLD], ...SOURCE, collector: 'coingecko', id: SIG_BTC_GOLD, unit: 'Unzen Gold je BTC', maxAgeHours: 72,
      plain: 'Wie viele Unzen Gold ein Bitcoin wert ist; fällt, wenn Anleger Gold dem Bitcoin vorziehen.' },
    { ...CATALOG[SIG_USDT], ...SOURCE, collector: 'coingecko', id: SIG_USDT, name: 'Tether-Umlauf (Marktkapitalisierung USDT)',
      plain: 'Wie viele Tether-Dollar im Umlauf sind; sprunghaftes Wachstum zeigt Kapitalflucht in Stablecoins.' },
  ],
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const headers = { 'x-cg-demo-api-key': key };
    const get = (coin: string, q: string, fixture: string) =>
      ctx.http.json(`${BASE}/${coin}/market_chart?vs_currency=usd&${q}`, { headers, fixture });
    const observations: Observation[] = [];
    const errors: string[] = [];
    try {
      const btc = parseChart(await get('bitcoin', 'days=30&interval=daily', 'coingecko/bitcoin-30d.json'), 'prices');
      const paxg = parseChart(await get('pax-gold', 'days=30&interval=daily', 'coingecko/pax-gold-30d.json'), 'prices');
      observations.push(...btcInGold(btc, paxg, ctx.now));
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
      ctx.log(`coingecko: BTC/Gold fehlgeschlagen: ${errors.at(-1)}`);
    }
    try {
      const usdt = parseChart(await get('tether', 'days=2', 'coingecko/tether-2d.json'), 'market_caps');
      observations.push(...hourlySeries(SIG_USDT, usdt, ctx.now));
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
      ctx.log(`coingecko: USDT fehlgeschlagen: ${errors.at(-1)}`);
    }
    if (errors.length === 2) throw new Error(`CoinGecko: alle Abrufe fehlgeschlagen (${errors[0]})`);
    return { observations };
  },
};

export default collector;
