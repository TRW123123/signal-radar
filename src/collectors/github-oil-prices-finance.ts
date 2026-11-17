// Ölpreis Brent als Finanzkrisen-Signal (Klasse A: Spotpreis, Zahlen der US-Energiebehörde EIA), über das GitHub-Spiegelrepo datasets/oil-prices.
// Szenario finance: Ölschock als Treiber von Inflation, Zinsen und Kreditstress. Dieselbe Quelle und derselbe Request wie `github-oil-prices`
//   (Szenario war, Fixture `oil-prices/brent-daily.csv`), aber unter der Signal-ID finance.real_economy.oil_price und mit 365 Tagen Historie.
// Quelle: https://github.com/datasets/oil-prices, Datei data/brent-daily.csv (seit 1987-05-20, ca. 165 kB), Kopf `Date,Price`, USD je Barrel.
// Lizenz: ODC-PDDL-1.0 (gemeinfrei); Rohdaten der EIA sind öffentliche US-Regierungsdaten. Kein Key.
// EIA-Bedingungen (gelesen 17.11.2026): Quelle "U.S. Energy Information Administration (EIA)" nennen, keine Endorsement-Andeutung, kein EIA-Logo,
//   veränderte/abgeleitete Werte nicht als offizielle EIA-Daten ausgeben (src/core/attribution.ts, docs/DATA-TERMS.md).
// Verzug: ca. eine Woche (Stand 17.11.2026: letzter Wert 11.11.2026), daher maxAgeHours 336. Ist der letzte Wert älter als 14 Tage, wird ein Fehler
//   geworfen (Spiegel veraltet). Handelsfreie Tage fehlen und werden nicht aufgefüllt.
// Harmlose Ursachen für Ausschläge: OPEC+-Beschlüsse, Konjunkturdaten, Dollar-Schwankung, US-Lagerdaten, Feiertage (Preis fortgeschrieben).
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs, parseCsv } from './_helpers.ts';

const URL_BRENT = 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/brent-daily.csv';
const SIG = 'finance.real_economy.oil_price';
const WINDOW_DAYS = 365;
const MAX_AGE_DAYS = 14;

export interface PricePoint { day: string; price: number }

/** Liest `Date,Price`; wirft bei fehlenden Spalten oder veralteter Reihe; gibt die letzten 365 Tage aufsteigend zurück. */
export function parseBrent(text: string, now: Date): PricePoint[] {
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

const collector: Collector = {
  id: 'github-oil-prices-finance',
  title: 'Ölpreis Brent für Szenario Finanzkrise (GitHub-Spiegel der EIA-Reihe)',
  sourceUrl: 'https://github.com/datasets/oil-prices',
  intervalMinutes: 1440,
  signals: [{
    id: SIG, scenarios: ['finance'], domain: 'real_economy', collector: 'github-oil-prices-finance',
    name: 'Ölpreis Brent (Tagesreihe, ca. 1 Woche Verzug)',
    plain: 'Misst den Brent-Ölpreis pro Barrel mit rund einer Woche Verzug; ein Ölschock treibt Inflation, Zinsen und damit Kreditstress.',
    evidenceClass: 'A', direction: 'both', kind: 'gauge', weight: 0.2, manipulability: 'low', independenceGroup: 'github-oil-prices',
    unit: 'USD je Barrel', intervalMinutes: 1440, maxAgeHours: 336, holdHours: 72,
    baseline: { method: 'rolling', windowDays: 365, minPoints: 26 }, thresholds: { z0: 3, z1: 8, relFloor: 0.03 },
    sourceName: 'datasets/oil-prices (GitHub, Daten der US-Energiebehörde EIA)', sourceUrl: 'https://github.com/datasets/oil-prices',
    license: 'ODC-PDDL-1.0 (Spiegel); EIA-Daten: Quelle "U.S. Energy Information Administration (EIA)" nennen, kein Logo/Endorsement, veränderte Daten nicht als offizielle EIA-Daten', banalCauses: ['OPEC+-Entscheidungen', 'Konjunkturdaten', 'Dollar-Schwankung', 'Geopolitik'],
  }],
  async collect(ctx) {
    const text = await ctx.http.text(URL_BRENT, { fixture: 'oil-prices/brent-daily.csv' });
    return { observations: parseBrent(text, ctx.now).map((p) => obs(SIG, `${p.day}T00:00:00Z`, p.price)) };
  },
};

export default collector;
