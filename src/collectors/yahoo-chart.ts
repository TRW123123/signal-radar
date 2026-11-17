// Marktdaten als Stress-Indikatoren (Evidenzklasse A: Börsenmessung, aber Aussagekraft für Cyberlagen gering, daher niedrige Gewichte).
// Quelle: Yahoo Finance Chart-Endpunkt (INOFFIZIELL, keine dokumentierte öffentliche API):
//   https://query1.finance.yahoo.com/v8/finance/chart/<SYMBOL>?range=6mo&interval=1d
// LIZENZ NOCH KLÄREN: Yahoos Nutzungsbedingungen erlauben keine systematische Nutzung; vor produktivem Betrieb prüfen
// oder auf eine lizenzierte Quelle (z. B. stooq, Alpha Vantage) wechseln. Endpunkt kann sich jederzeit ändern oder Anfragen blocken.
// Gemessen (Tageswerte, nur abgeschlossene Handelstage):
//   - Relatives Volumen: Summe der Volumina der Symbole eines Signals geteilt durch den Median dieser Summe der 20 Handelstage davor.
//   - Schlusskurs-Stand (VIX).
//   - Tagesrendite-Betrag: Mittel der Beträge der Tagesrenditen (in Prozent) der Symbole eines Signals.
// Je Signal werden nur Tage gemeldet, an denen ALLE Symbole des Signals einen Wert haben (sonst Scheineinbruch).
// Symbole und Signale sind je Szenario in SPECS erweiterbar (ein Eintrag mehr genügt).
// Harmlose Ursachen für Ausschläge: Index-Rebalancing, Quartalsende, Verfallstermine (Hexensabbat), Feiertage mit dünnem Handel,
// Zinsentscheide/Makrodaten (VIX, Gold, Bitcoin), Krypto-Eigenereignisse.
// Antwortform: chart.result[0].{meta.gmtoffset, timestamp[], indicators.quote[0].{close[], volume[]}}; einzelne Werte können null sein.
// VERIFIED: nein (Form nach Kenntnis der inoffiziellen API; keine Doku vorhanden, Suche lieferte keine Inhalte).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, isoDay, num, obs } from './_helpers.ts';

type Metric = 'rel-volume-sum' | 'close' | 'abs-return-mean';

interface Spec {
  signalId: string; scenario: string; symbols: string[]; metric: Metric;
  name: string; plain: string; weight: number; unit: string; kind: 'gauge' | 'count';
  baseline: { method: 'rolling' | 'day-of-week'; windowDays: number; minPoints: number };
  banalCauses: string[];
}

/** Symbol- und Signalliste. Weitere Symbole oder Szenarien: Eintrag ergänzen. */
export const SPECS: Spec[] = [
  {
    signalId: 'cyber.markets.cyber_etf_volume', scenario: 'cyber', symbols: ['CIBR', 'HACK', 'BUG'], metric: 'rel-volume-sum',
    name: 'Relatives Handelsvolumen der Cyber-ETFs (CIBR, HACK, BUG)',
    plain: 'Wie stark Cyber-Sicherheits-ETFs gerade gehandelt werden, verglichen mit den 20 Tagen davor.',
    weight: 0.3, unit: 'x Median 20 Tage', kind: 'gauge', baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
    banalCauses: ['Index-Rebalancing', 'Quartalsende', 'Verfallstermine', 'Nachrichten über einzelne Hacks'],
  },
  {
    signalId: 'cyber.markets.cyber_etf_abs_return', scenario: 'cyber', symbols: ['CIBR', 'HACK', 'BUG'], metric: 'abs-return-mean',
    name: 'Tagesschwankung der Cyber-ETFs',
    plain: 'Wie stark die Cyber-Sicherheits-ETFs an einem Tag steigen oder fallen (Betrag der Tagesrendite).',
    weight: 0.2, unit: '% (Betrag)', kind: 'gauge', baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
    banalCauses: ['Marktweite Kursbewegung', 'Quartalszahlen großer Mitglieder', 'Zinsentscheide'],
  },
  {
    signalId: 'cyber.markets.vix', scenario: 'cyber', symbols: ['^VIX'], metric: 'close',
    name: 'VIX (Angstindex der US-Börse)',
    plain: 'Wie nervös die US-Börse insgesamt ist; steigt bei jeder Art von Krise.',
    weight: 0.3, unit: 'Punkte', kind: 'gauge', baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
    banalCauses: ['Zinsentscheide', 'Wahlen', 'Quartalszahlen', 'Verfallstermine'],
  },
  {
    signalId: 'cyber.markets.gold_abs_return', scenario: 'cyber', symbols: ['GC=F'], metric: 'abs-return-mean',
    name: 'Tagesschwankung des Goldpreises',
    plain: 'Wie stark der Goldpreis an einem Tag springt, klassisches Zeichen für Fluchtbewegungen.',
    weight: 0.2, unit: '% (Betrag)', kind: 'gauge', baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
    banalCauses: ['Zinserwartungen', 'Dollar', 'Geopolitik'],
  },
  {
    signalId: 'cyber.markets.btc_abs_return', scenario: 'cyber', symbols: ['BTC-USD'], metric: 'abs-return-mean',
    name: 'Tagesschwankung von Bitcoin',
    plain: 'Wie stark Bitcoin an einem Tag springt; Bitcoin hängt am Netz und reagiert auf Ausfälle und Risikoscheu.',
    weight: 0.2, unit: '% (Betrag)', kind: 'gauge', baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
    banalCauses: ['Krypto-Eigenereignisse', 'Börsenpleiten', 'ETF-Nachrichten'],
  },
];

export const SCENARIO = 'cyber';
const HISTORY_DAYS = 90;
const REL_WINDOW = 20;

export interface Candle { day: string; close: number | null; volume: number | null }

interface Resp {
  chart?: { result?: {
    meta?: { gmtoffset?: unknown };
    timestamp?: unknown[];
    indicators?: { quote?: { close?: unknown[]; volume?: unknown[] }[] };
  }[] | null; error?: { description?: string } | null };
}

/** Antwort -> Kerzen je Handelstag (Börsen-Ortsdatum, über gmtoffset). Werte null, wenn Yahoo null liefert. */
export function parse(body: Resp): Candle[] {
  if (body.chart?.error) throw new Error(`Yahoo-Fehler: ${body.chart.error.description ?? 'unbekannt'}`);
  const r = expect(body.chart?.result?.[0], 'chart.result[0]');
  const ts = expect(r.timestamp, 'timestamp');
  const q = expect(r.indicators?.quote?.[0], 'indicators.quote[0]');
  const close = expect(q.close, 'quote.close');
  const volume = q.volume ?? [];
  const off = num(r.meta?.gmtoffset) ?? 0;
  const out = new Map<string, Candle>();
  for (let i = 0; i < ts.length; i++) {
    const t = num(ts[i]);
    if (t === null) continue;
    const day = isoDay(new Date((t + off) * 1000));
    out.set(day, { day, close: num(close[i]), volume: num(volume[i]) });
  }
  return [...out.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Berechnet die Zeitreihe eines Signals aus den Kerzen aller seiner Symbole. Nur Tage, an denen alle Symbole Werte haben. */
export function compute(metric: Metric, candles: Candle[][]): Map<string, number> {
  const out = new Map<string, number>();
  if (candles.length === 0) return out;
  if (metric === 'close') {
    for (const c of candles[0]) if (c.close !== null) out.set(c.day, c.close);
    return out;
  }
  const byDay = candles.map((cs) => new Map(cs.map((c) => [c.day, c])));
  const days = [...byDay[0].keys()].filter((d) => byDay.every((m) => m.has(d))).sort();
  if (metric === 'abs-return-mean') {
    for (let i = 1; i < days.length; i++) {
      const rets: number[] = [];
      for (const m of byDay) {
        const a = m.get(days[i - 1])!.close; const b = m.get(days[i])!.close;
        if (a !== null && b !== null && a > 0) rets.push(Math.abs((b / a - 1) * 100));
      }
      if (rets.length === byDay.length) out.set(days[i], rets.reduce((s, x) => s + x, 0) / rets.length);
    }
    return out;
  }
  // rel-volume-sum
  const sums: { day: string; sum: number }[] = [];
  for (const d of days) {
    const vs = byDay.map((m) => m.get(d)!.volume);
    if (vs.every((v): v is number => v !== null && v > 0)) sums.push({ day: d, sum: vs.reduce((s, x) => s + x, 0) });
  }
  for (let i = REL_WINDOW; i < sums.length; i++) {
    const med = median(sums.slice(i - REL_WINDOW, i).map((s) => s.sum));
    if (med > 0) out.set(sums[i].day, sums[i].sum / med);
  }
  return out;
}

export function buildUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
}
export function fixtureName(symbol: string): string {
  return `yahoo/${symbol.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}-6mo-1d.json`;
}

const collector: Collector = {
  id: 'yahoo-chart',
  title: 'Yahoo Finance Chart (inoffiziell, Lizenz noch klären)',
  sourceUrl: 'https://finance.yahoo.com',
  intervalMinutes: 720,
  signals: SPECS.filter((s) => s.scenario === SCENARIO).map((s) => ({
    id: s.signalId, scenarios: [s.scenario], domain: 'markets', name: s.name, plain: s.plain,
    evidenceClass: 'A' as const, direction: 'up' as const, kind: s.kind, weight: s.weight, manipulability: 'low' as const,
    independenceGroup: 'yahoo-chart', unit: s.unit, intervalMinutes: 1440, holdHours: 48, baseline: s.baseline,
    license: 'inoffiziell, Lizenz unklar (ToS erlauben keine systematische Nutzung)', banalCauses: s.banalCauses,
  })),
  async collect(ctx) {
    const specs = SPECS.filter((s) => s.scenario === SCENARIO);
    const symbols = [...new Set(specs.flatMap((s) => s.symbols))];
    const data = new Map<string, Candle[]>();
    for (const sym of symbols) {
      try {
        data.set(sym, parse(await ctx.http.json<Resp>(buildUrl(sym), { fixture: fixtureName(sym) })));
      } catch (e) {
        ctx.log(`Symbol ${sym} übersprungen: ${(e as Error).message}`);
      }
    }
    if (data.size === 0) throw new Error('yahoo-chart: kein Symbol abrufbar');
    const today = isoDay(ctx.now);
    const minDay = isoDay(new Date(ctx.now.getTime() - HISTORY_DAYS * DAY_MS));
    const observations: Observation[] = [];
    for (const s of specs) {
      const cs = s.symbols.map((sym) => data.get(sym));
      if (cs.some((c) => !c)) { ctx.log(`Signal ${s.signalId} ausgelassen: Symbol fehlt`); continue; }
      for (const [day, v] of compute(s.metric, cs as Candle[][])) {
        if (day >= today || day < minDay) continue; // laufender Handelstag unvollständig
        observations.push(obs(s.signalId, `${day}T00:00:00Z`, v, { symbols: s.symbols.length }));
      }
    }
    return { observations };
  },
};

export default collector;
