// Erdgaspreis Henry Hub (USA) als Tagesreihe (Klasse A: Marktpreis, Zahlen der US-Energiebehörde EIA), über das GitHub-Spiegelrepo datasets/natural-gas.
// Quelle: https://github.com/datasets/natural-gas, Datei data/daily.csv (seit 1997-01-07, ca. 97 kB), Kopf `Date,Price`, US-Dollar je Million BTU.
// Lizenz: ODC-PDDL-1.0 (gemeinfrei) laut datapackage.json des Repos; Rohdaten der EIA sind öffentliche US-Regierungsdaten. Kein Key.
// EIA-Bedingungen (gelesen 17.11.2026): Quelle "U.S. Energy Information Administration (EIA)" nennen, keine Endorsement-Andeutung, kein EIA-Logo,
//   veränderte/abgeleitete Werte nicht als offizielle EIA-Daten ausgeben (src/core/attribution.ts, docs/DATA-TERMS.md).
// Verzug: EIA-Veröffentlichung mit etwa einer Woche Verzug (Stand 17.11.2026: letzter Wert 11.11.2026). Kein Echtzeitsignal.
//   Ist der letzte Wert älter als 14 Tage, wird ein Fehler geworfen.
// Einordnung: Der US-Preis zeigt vor allem US-Wetter und -Lager. Für Kriegseskalation dient er als Gegenstück zum europäischen Gaspreis
//   (Abstand weitet sich bei LNG-Knappheit); der TTF-Preis selbst ist hier nicht enthalten. Deshalb niedriges Gewicht.
// Gemessen: je Handelstag der Spotpreis (letzte 90 Kalendertage), Tage ohne Handel fehlen.
// Harmlose Ursachen für Ausschläge: Kälteeinbrüche und Hitze in den USA, Lagerbericht der EIA (donnerstags), Fälligkeit der Terminkontrakte,
//   Ausfall von LNG-Anlagen in den USA, Hurrikane im Golf von Mexiko.
// VERIFIED: ja (17.11.2026)

import type { Collector } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs, parseCsv } from './_helpers.ts';

const URL_CSV = 'https://raw.githubusercontent.com/datasets/natural-gas/main/data/daily.csv';
const WINDOW_DAYS = 90;
const MAX_AGE_DAYS = 14;
const SIG = 'war.markets.gas_henry_hub';

export interface PricePoint { day: string; price: number }

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

const collector: Collector = {
  id: 'github-gas-henry-hub',
  title: 'Erdgaspreis Henry Hub (GitHub-Spiegel der EIA-Tagesreihe)',
  sourceUrl: 'https://github.com/datasets/natural-gas',
  intervalMinutes: 1440,
  signals: [
    {
      id: SIG, scenarios: ['war'], domain: 'markets', evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.25, manipulability: 'medium',
      independenceGroup: 'github-gas-henry-hub', unit: 'USD/MMBtu', intervalMinutes: 1440, holdHours: 72,
      name: 'Erdgaspreis Henry Hub USA (Tagesreihe, ca. 1 Woche Verzug)',
      plain: 'Misst den US-Erdgaspreis mit rund einer Woche Verzug; steigt er stark, ist meist Wetter oder LNG-Export der Grund, bei Kriegen in Förderregionen zieht er mit.',
      baseline: { method: 'rolling', windowDays: 28, minPoints: 14 }, thresholds: { z0: 3, z1: 8, relFloor: 0.05 },
      sourceName: 'datasets/natural-gas (GitHub, Daten der US-Energiebehörde EIA)', sourceUrl: 'https://github.com/datasets/natural-gas',
      license: 'ODC-PDDL-1.0 (Spiegel); EIA-Daten: Quelle "U.S. Energy Information Administration (EIA)" nennen, kein Logo/Endorsement, veränderte Daten nicht als offizielle EIA-Daten',
      banalCauses: ['US-Winterwetter und Hitzewellen', 'Lagerbericht der EIA', 'Fälligkeit der Terminkontrakte', 'Hurrikane im Golf von Mexiko'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_CSV, { fixture: 'natural-gas/daily.csv' });
    return { observations: parsePrices(text, ctx.now).map((p) => obs(SIG, `${p.day}T00:00:00Z`, p.price)) };
  },
};

export default collector;
