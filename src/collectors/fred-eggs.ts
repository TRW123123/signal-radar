// FRED: US-Durchschnittspreis für ein Dutzend Eier (Klasse A, BLS-Verbraucherpreiserhebung, monatlich), Serie APU0000708111.
// Quelle: https://api.stlouisfed.org/fred/series/observations?series_id=APU0000708111&api_key=<KEY>&file_type=json&observation_start=YYYY-MM-DD
// Doku: https://fred.stlouisfed.org/docs/api/fred/series_observations.html; Serie https://fred.stlouisfed.org/series/APU0000708111
//   Antwort laut Doku: { observations: [ { date: "YYYY-MM-DD", value: "2.320" } ] }, "." = fehlend; Fehler { error_code, error_message }.
//   Parser und Key-Schwärzung kommen aus src/collectors/fred.ts (gleiche API).
// Key: SR_FRED_KEY (Query api_key; derselbe Key wie fred). Eigener Collector, weil der Katalog die Quelle fred-eggs als eigene collector-id führt.
// Lizenz: FRED API Terms of Use (Pflichthinweis "not endorsed", src/core/attribution.ts listet fred-eggs bereits); die Reihe stammt vom
//   U.S. Bureau of Labor Statistics (gemeinfrei).
// Gemessen: bio.markets.poultry_stocks = Eierpreis USD je Dutzend, Monatswert (ts = Monatserster), letzte 3 Jahre. Der Katalog beschreibt das
//   Signal als Aktienkurs-Proxy (Cal-Maine über yahoo-chart) und nennt fred-eggs als Alternative mit dem echten Eierpreis; Name, Einheit,
//   Intervall und Baseline sind hier auf die Monatsreihe angepasst. Wird später zusätzlich CALM über yahoo-chart gebaut, muss eine der beiden
//   Quellen eine eigene id bekommen (sonst zwei Reihen in einem Signal).
// Harmlose Ursachen: Vogelgrippe-Keulungen (das ist hier gerade das gesuchte Signal, aber auch saisonale Nachfrage zu Ostern/Feiertagen),
//   Futterkosten, Revisionen der BLS-Werte. Veröffentlichung etwa Mitte des Folgemonats (maxAgeHours 75 Tage).
// VERIFIED: nein (ungeprüft bis Key). Serie am 20.11.2026 über fredgraph.csv ohne Key geprüft (2026-10-01 = 2.320 USD).

import type { Collector, CollectContext } from '../core/types.ts';
import { daysAgo, expect, isoDay } from './_helpers.ts';
import { parseObservations, seriesUrl, toObservations, type Spec } from './fred.ts';

const KEY_ENV = 'SR_FRED_KEY';
const SERIES = 'APU0000708111';
const SPEC: Spec = { id: 'bio.markets.poultry_stocks', series: [SERIES], freq: 'm' };

const collector: Collector = {
  id: 'fred-eggs',
  title: 'FRED: Eier-Verbraucherpreis (APU0000708111)',
  sourceUrl: `https://fred.stlouisfed.org/series/${SERIES}`,
  needsKey: KEY_ENV,
  intervalMinutes: 1440,
  signals: [
    {
      id: 'bio.markets.poultry_stocks', collector: 'fred-eggs', scenarios: ['bio'], domain: 'markets',
      name: 'Eierpreis USA (Dutzend, BLS)',
      plain: 'Durchschnittlicher US-Ladenpreis für ein Dutzend Eier; steigt stark, wenn Vogelgrippe viele Legehennen tötet.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.25, manipulability: 'low', independenceGroup: 'fred-eggs',
      unit: 'USD je Dutzend', intervalMinutes: 43200, maxAgeHours: 24 * 75,
      baseline: { method: 'rolling', windowDays: 1095, minPoints: 24 },
      sourceName: 'FRED, Federal Reserve Bank of St. Louis (BLS)', sourceUrl: `https://fred.stlouisfed.org/series/${SERIES}`,
      license: 'FRED API Terms of Use; Reihe BLS (gemeinfrei)',
      banalCauses: ['Saisonale Nachfrage (Ostern, Feiertage)', 'Futterkosten', 'BLS-Revisionen'],
    },
  ],
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    let body: unknown;
    try {
      body = await ctx.http.json(seriesUrl(SERIES, key, isoDay(daysAgo(ctx.now, 3 * 366))), { fixture: `fred/${SERIES}.json` });
    } catch (e) {
      throw new Error((e instanceof Error ? e.message : String(e)).split(key).join('REDACTED'));
    }
    return { observations: toObservations(SPEC, [parseObservations(body)]) };
  },
};

export default collector;
