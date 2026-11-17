// Marktdaten als Stress-Indikatoren (Evidenzklasse A: Börsenmessung, aber Aussagekraft für Cyberlagen gering, daher niedrige Gewichte).
// Quelle: Yahoo Finance Chart-Endpunkt (INOFFIZIELL, keine dokumentierte öffentliche API):
//   https://query1.finance.yahoo.com/v8/finance/chart/<SYMBOL>?range=1mo&interval=1d
// LIZENZ NOCH KLÄREN: Yahoos Nutzungsbedingungen erlauben keine systematische Nutzung; vor produktivem Betrieb prüfen
// oder auf eine lizenzierte Quelle (z. B. stooq, Alpha Vantage) wechseln. Endpunkt kann sich jederzeit ändern oder Anfragen blocken.
// Gemessen (Tageswerte, nur abgeschlossene Handelstage):
//   - Relatives Volumen: Summe der Volumina der Symbole eines Signals geteilt durch den Median dieser Summe der 10 Handelstage davor.
//   - Schlusskurs-Stand (VIX).
//   - Tagesrendite-Betrag: Mittel der Beträge der Tagesrenditen (in Prozent) der Symbole eines Signals.
// Je Signal werden nur Tage gemeldet, an denen ALLE Symbole des Signals einen Wert haben (sonst Scheineinbruch).
// Symbole und Signale je Szenario: src/collectors/config/<szenario>.ts (Feld yahoo); jedes Symbol wird je Lauf nur einmal geholt.
// Harmlose Ursachen für Ausschläge: Index-Rebalancing, Quartalsende, Verfallstermine (Hexensabbat), Feiertage mit dünnem Handel,
// Zinsentscheide/Makrodaten (VIX, Gold, Bitcoin), Krypto-Eigenereignisse.
// Antwortform: chart.result[0].{meta.gmtoffset, timestamp[], indicators.quote[0].{close[], volume[]}}; einzelne Werte können null sein.
// Echte Antworten (17.11.2026): Die Quelle liefert Daten (Beginn {"chart":{"result":[{"meta":{"currency":"USD","symbol":"CIBR",...),
// keine Fehlermeldung; mit range=6mo waren die Antworten 12,6 bis 17,7 kB und wurden von der Prüf-Umgebung bei 12 000 Zeichen
// abgeschnitten (nicht von der Quelle). range=3mo waren ca. 7 bis 9 kB; die Aufzeichnungs-Umgebung nimmt nur noch ca. 6 000 Zeichen,
// deshalb range=1mo (ca. 21 Handelstage, geschätzt 3 bis 4,5 kB). Längere Historie baut der Speicher Lauf für Lauf auf.
// Szenario war (Kriegseskalation): Signale in Domain markets für Brent (BZ=F), WTI (CL=F), Gold (GC=F), Öl-Volatilität (^OVX), Rüstungs-ETF (ITA),
// Rheinmetall (RHM.DE), Weizen (ZW=F) und VIX (^VIX). Gold und VIX sind schon für Cyber abgerufen: derselbe Messwert, hier unter eigener
// Signal-ID für war (kein zusätzlicher Request). Neue Requests: BZ=F, CL=F, ^OVX, ITA, RHM.DE, ZW=F (insgesamt 12 Symbole je Lauf statt 6,
// weil jedes Symbol nur einmal geholt wird; die Zahl folgt aus der Signalliste). Metrik für war: Schlusskurs-Stand (Preise/Indizes).
// Brent/WTI heißen hier war.markets.brent_futures/wti_futures, weil github-oil-prices die Katalog-IDs brent_price/wti_price (EIA-Tagesreihe) schon belegt.
// Harmlose Ursachen (war): OPEC+-Entscheidungen, Lagerdaten, Quartalszahlen (Rheinmetall), Ernte/Wetter (Weizen), Zinsentscheide (Gold, VIX), Kontraktwechsel bei Futures.
// VERIFIED: ja (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, isoDay, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';
import type { YahooMetric } from './config/_types.ts';

type Metric = YahooMetric;

export interface Spec { signalId: string; scenario: string; symbols: string[]; metric: Metric }

/** Symbol- und Signalliste aller Szenarien (src/collectors/config/<szenario>.ts, Feld yahoo). */
const ENTRIES = scenarioEntries('yahoo');
export const SPECS: Spec[] = ENTRIES.map((e) => ({ signalId: e.signal.id, scenario: e.scenario, symbols: e.symbols, metric: e.metric }));

const DEFAULTS = {
  domain: 'markets', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'gauge' as const, manipulability: 'low' as const,
  independenceGroup: 'yahoo-chart', intervalMinutes: 1440, holdHours: 48,
  license: 'inoffiziell, Lizenz unklar (ToS erlauben keine systematische Nutzung)',
};
const HISTORY_DAYS = 35; // range=1mo liefert rund 21 Handelstage; die ersten 10 gehen in die Volumen-Normierung
export const REL_WINDOW = 10;

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
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
}
export function fixtureName(symbol: string): string {
  return `yahoo/${symbol.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}-1mo-1d.json`;
}

const collector: Collector = {
  id: 'yahoo-chart',
  title: 'Yahoo Finance Chart (inoffiziell, Lizenz noch klären)',
  sourceUrl: 'https://finance.yahoo.com',
  intervalMinutes: 720,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    const specs = SPECS;
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
