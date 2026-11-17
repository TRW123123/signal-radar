// Blackout und Energiekrise: Erdgaspreis Henry Hub und Brent-Ölpreis als Tagesreihen (Klasse A: Marktpreise, Daten der US-Energiebehörde EIA),
// über die GitHub-Spiegelrepos datasets/natural-gas und datasets/oil-prices. Eigener Collector, weil die bestehenden Collectors
// github-gas-henry-hub und github-oil-prices ihre Messwerte nur unter den Kriegs-IDs (war.markets.*) melden; hier dieselben Dateien
// unter den blackout-IDs. Dieselben Fixtures (natural-gas/daily.csv, oil-prices/brent-daily.csv), die Parser kommen aus github-oil-prices.ts.
// Quellen: https://github.com/datasets/natural-gas (data/daily.csv, Kopf `Date,Price`, USD je Million BTU) und
//   https://github.com/datasets/oil-prices (data/brent-daily.csv, Kopf `Date,Price`, USD je Barrel, Europe Brent FOB).
// Lizenz: ODC-PDDL-1.0 (gemeinfrei) laut Repos; Rohdaten der EIA sind öffentliche US-Regierungsdaten. Kein Key.
// Verzug: EIA veröffentlicht mit etwa einer Woche Verzug (Stand 17.11.2026: letzter Wert 11.11.2026), deshalb maxAgeHours 336.
//   Ist der letzte Wert älter als 14 Tage, wirft der Parser einen Fehler. Kein Echtzeitsignal, nur Kontext zum europäischen Gaspreis.
// Gemessen: je Handelstag der Spotpreis, letzte 90 Kalendertage bis gestern; Tage ohne Handel fehlen.
// Harmlose Ursachen für Ausschläge: US-Winterwetter, Lagerbericht der EIA (donnerstags), Fälligkeit der Terminkontrakte, Hurrikane im Golf von
//   Mexiko, OPEC+-Beschlüsse, Konjunkturdaten, Dollar-Schwankung.
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { obs } from './_helpers.ts';
import { parsePrices } from './github-oil-prices.ts';

const URL_GAS = 'https://raw.githubusercontent.com/datasets/natural-gas/main/data/daily.csv';
const URL_BRENT = 'https://raw.githubusercontent.com/datasets/oil-prices/main/data/brent-daily.csv';
const SIG_GAS = 'blackout.markets.henry_hub_gas';
const SIG_BRENT = 'blackout.markets.brent_oil';

const common = {
  scenarios: ['blackout'], domain: 'markets', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'gauge' as const,
  manipulability: 'low' as const, intervalMinutes: 1440, holdHours: 72, maxAgeHours: 336,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 }, thresholds: { z0: 3, z1: 8, relFloor: 0.05 },
  license: 'ODC-PDDL-1.0 (gemeinfrei)',
};

const collector: Collector = {
  id: 'blackout-energy-prices-github',
  title: 'Energiepreise Henry Hub und Brent (GitHub-Spiegel der EIA-Tagesreihen), Blackout-Sicht',
  sourceUrl: 'https://github.com/datasets/natural-gas',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_GAS, name: 'Erdgaspreis Henry Hub (USA, Tagesreihe, ca. 1 Woche Verzug)', weight: 0.3, unit: 'USD/MMBtu',
      independenceGroup: 'github-gas-henry-hub',
      plain: 'Der US-Gaspreis mit rund einer Woche Verzug, als Vergleich zum europäischen Gaspreis; ein Abstand zeigt, wie knapp Flüssiggas für Europa ist.',
      sourceName: 'datasets/natural-gas (GitHub, Daten der US-Energiebehörde EIA)', sourceUrl: 'https://github.com/datasets/natural-gas',
      banalCauses: ['US-Winterwetter und Hitzewellen', 'Lagerbericht der EIA', 'Fälligkeit der Terminkontrakte', 'Hurrikane im Golf von Mexiko'],
    },
    {
      ...common, id: SIG_BRENT, name: 'Brent-Rohölpreis (Tagesreihe, ca. 1 Woche Verzug)', weight: 0.3, unit: 'USD/Barrel',
      independenceGroup: 'github-oil-prices',
      plain: 'Der Preis für Nordsee-Rohöl mit rund einer Woche Verzug; steigt er stark, verteuern sich Energie und Heizöl insgesamt.',
      sourceName: 'datasets/oil-prices (GitHub, Daten der US-Energiebehörde EIA)', sourceUrl: 'https://github.com/datasets/oil-prices',
      banalCauses: ['OPEC+-Entscheidungen', 'Konjunkturdaten', 'Dollar-Schwankung', 'Raffinerie-Wartung'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const gas = parsePrices(await ctx.http.text(URL_GAS, { fixture: 'natural-gas/daily.csv' }), ctx.now);
    for (const p of gas) observations.push(obs(SIG_GAS, `${p.day}T00:00:00Z`, p.price));
    const brent = parsePrices(await ctx.http.text(URL_BRENT, { fixture: 'oil-prices/brent-daily.csv' }), ctx.now);
    for (const p of brent) observations.push(obs(SIG_BRENT, `${p.day}T00:00:00Z`, p.price));
    return { observations };
  },
};

export default collector;
