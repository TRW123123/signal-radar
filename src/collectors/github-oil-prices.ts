// Ölpreise Brent und WTI als Tagesreihe (Klasse A: Marktpreis, Zahlen der US-Energiebehörde EIA), über das GitHub-Spiegelrepo datasets/oil-prices.
// Quelle: https://github.com/datasets/oil-prices, Dateien data/brent-daily.csv (seit 1987-05-20) und data/wti-daily.csv (seit 1986-01-02),
//   je ca. 165 kB, Kopf `Date,Price`, Preis in US-Dollar je Barrel (Spotpreis, Europe Brent FOB bzw. Cushing WTI FOB, Quelle EIA).
// Lizenz: Datensatz laut Repo ODC-PDDL-1.0 (gemeinfrei); Rohdaten der EIA sind öffentliche US-Regierungsdaten. Kein Key.
// Verzug: Die EIA veröffentlicht mit etwa einer Woche Verzug (Stand 17.11.2026: letzter Wert 11.11.2026), der Spiegel zieht nach. Das Signal zeigt
//   also Preisbewegungen der Vorwoche und ist kein Echtzeitsignal. Ist der letzte Wert älter als 14 Tage, wird ein Fehler geworfen.
// Gemessen: je Handelstag der Spotpreis (die letzten 90 Kalendertage); zusätzlich der Preisabstand Brent minus WTI (nur an Tagen mit beiden Werten).
//   Handelsfreie Tage fehlen in der Datei und werden nicht aufgefüllt.
// Harmlose Ursachen für Ausschläge: OPEC+-Beschlüsse, Konjunkturdaten, Dollar-Schwankung, US-Lagerdaten, Pipeline-Engpässe, Wartung von Raffinerien,
//   Feiertage (Preise tagesweise unverändert fortgeschrieben).
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs, parseCsv } from './_helpers.ts';

const BASE = 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/';
const WINDOW_DAYS = 90;
const MAX_AGE_DAYS = 14;
const SIG_BRENT = 'war.markets.brent_price';
const SIG_WTI = 'war.markets.wti_price';
const SIG_SPREAD = 'war.markets.brent_wti_spread';

export interface PricePoint { day: string; price: number }

/** Liest `Date,Price`. Wirft bei fehlenden Spalten oder veralteter Reihe; gibt die letzten 90 Tage aufsteigend zurück. */
export function parsePrices(text: string, now: Date): PricePoint[] {
  const body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  const rows = parseCsv(body);
  const head = rows[0] ?? [];
  const iD = head.indexOf('Date');
  const iP = head.indexOf('Price');
  if (iD < 0 || iP < 0) throw new Error('unerwartete Antwort: Spalten Date/Price fehlen');
  const pts: PricePoint[] = [];
  for (const r of rows.slice(1)) {
    const price = num(r[iP]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r[iD] ?? '') || price === null) continue;
    pts.push({ day: r[iD], price });
  }
  if (!pts.length) return [];
  const last = Date.parse(`${pts[pts.length - 1].day}T00:00:00Z`);
  if (now.getTime() - last > MAX_AGE_DAYS * DAY_MS) throw new Error(`Preisreihe veraltet: letzter Wert ${pts[pts.length - 1].day}`);
  const from = isoDay(daysAgo(now, WINDOW_DAYS));
  return pts.filter((p) => p.day >= from && p.day < isoDay(now));
}

/** Brent minus WTI an Tagen mit beiden Werten. */
export function spread(brent: PricePoint[], wti: PricePoint[]): PricePoint[] {
  const w = new Map(wti.map((p) => [p.day, p.price]));
  return brent.filter((p) => w.has(p.day)).map((p) => ({ day: p.day, price: Math.round((p.price - w.get(p.day)!) * 100) / 100 }));
}

const common = {
  scenarios: ['war'], domain: 'markets', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'gauge' as const,
  manipulability: 'medium' as const, independenceGroup: 'github-oil-prices', intervalMinutes: 1440, holdHours: 72,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 }, thresholds: { z0: 3, z1: 8, relFloor: 0.03 },
  sourceName: 'datasets/oil-prices (GitHub, Daten der US-Energiebehörde EIA)', sourceUrl: 'https://github.com/datasets/oil-prices',
  license: 'ODC-PDDL-1.0 (gemeinfrei)',
};

const collector: Collector = {
  id: 'github-oil-prices',
  title: 'Ölpreise Brent und WTI (GitHub-Spiegel der EIA-Tagesreihen)',
  sourceUrl: 'https://github.com/datasets/oil-prices',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_BRENT, name: 'Brent-Rohölpreis (Tagesreihe, ca. 1 Woche Verzug)', weight: 0.5, unit: 'USD/Barrel',
      plain: 'Misst den Ölpreis (Brent) pro Barrel mit rund einer Woche Verzug; Kriegsangst in Förderregionen und Sperrungen von Seewegen treiben ihn nach oben.',
      banalCauses: ['OPEC+-Entscheidungen', 'Konjunkturdaten', 'Dollar-Schwankung', 'Raffinerie-Wartung'],
    },
    {
      ...common, id: SIG_WTI, name: 'WTI-Rohölpreis (Tagesreihe, ca. 1 Woche Verzug)', weight: 0.4, unit: 'USD/Barrel',
      plain: 'Misst den US-Ölpreis (WTI) pro Barrel mit rund einer Woche Verzug.',
      banalCauses: ['US-Lagerdaten', 'Pipeline-Engpässe', 'Konjunkturdaten'],
    },
    {
      ...common, id: SIG_SPREAD, name: 'Preisabstand Brent minus WTI (Tagesreihe)', weight: 0.35, unit: 'USD/Barrel', direction: 'both',
      thresholds: { z0: 3, z1: 8, absFloor: 0.5 },
      plain: 'Misst, um wie viel Dollar Brent teurer ist als WTI; der Abstand weitet sich, wenn Schiffsrouten im Nahen Osten gestört sind.',
      banalCauses: ['US-Lagerdaten', 'Transportengpässe in den USA', 'Fälligkeitstermine der Terminkontrakte'],
    },
  ],
  async collect(ctx) {
    const brentBody = await ctx.http.text(`${BASE}brent-daily.csv`, { fixture: 'oil-prices/brent-daily.csv' });
    const brent = parsePrices(brentBody, ctx.now);
    const observations: Observation[] = brent.map((p) => obs(SIG_BRENT, `${p.day}T00:00:00Z`, p.price));
    try {
      const wti = parsePrices(await ctx.http.text(`${BASE}wti-daily.csv`, { fixture: 'oil-prices/wti-daily.csv' }), ctx.now);
      for (const p of wti) observations.push(obs(SIG_WTI, `${p.day}T00:00:00Z`, p.price));
      for (const p of spread(brent, wti)) observations.push(obs(SIG_SPREAD, `${p.day}T00:00:00Z`, p.price));
    } catch (e) {
      ctx.log(`WTI übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
