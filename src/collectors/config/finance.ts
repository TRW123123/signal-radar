// Szenario finance: Konfiguration der geteilten Collectors. Anleitung: docs/SCENARIO-CONFIG-GUIDE.md
// Yahoo: Katalog-IDs aus catalog/signals/finance.json. ^VIX und GC=F werden schon für cyber/war geholt (kein zusätzlicher Request),
// neu ist nur KRE (Regionalbanken-ETF), zweimal genutzt (Tagesbewegung, Volumen). Nicht messbar mit den vorhandenen Metriken
// (close, abs-return-mean, rel-volume-sum): vix_term_structure (Verhältnis ^VIX9D/^VIX3M), corp_bond_etf_discount (NAV fehlt bei Yahoo).

import type { ScenarioCollectorConfig } from './_types.ts';

const yahooBaseline = { method: 'rolling' as const, windowDays: 28, minPoints: 14 };

export default {
  scenario: 'finance',
  wikipedia: [],
  hackerNews: [],
  gdelt: [],
  polymarket: [],
  yahoo: [
    {
      signal: {
        id: 'finance.volatility.vix', domain: 'volatility', name: 'VIX',
        plain: 'Erwartete Schwankung des US-Aktienmarkts in den nächsten 30 Tagen; steigt, wenn Anleger Angst bekommen.',
        weight: 0.3, unit: 'Indexpunkte', baseline: yahooBaseline,
        banalCauses: ['Verfallstermine', 'Wahlen', 'Geopolitik'],
      },
      symbols: ['^VIX'], metric: 'close',
    },
    {
      signal: {
        id: 'finance.banks.regional_bank_etf_return', domain: 'banks', name: 'Regionalbanken-ETF: Tagesbewegung',
        plain: 'Wie stark US-Regionalbankaktien (Fonds KRE) an einem Tag steigen oder fallen (Betrag der Tagesrendite).',
        weight: 0.8, unit: '% (Betrag)', baseline: yahooBaseline,
        banalCauses: ['Quartalszahlen', 'Zinsentscheide'],
      },
      symbols: ['KRE'], metric: 'abs-return-mean',
    },
    {
      signal: {
        id: 'finance.banks.regional_bank_volume', domain: 'banks', name: 'Regionalbanken-ETF: Handelsvolumen',
        plain: 'Wie stark der Regionalbanken-Fonds KRE gerade gehandelt wird, verglichen mit den 10 Handelstagen davor.',
        weight: 0.7, unit: 'x Median 10 Tage', baseline: yahooBaseline,
        banalCauses: ['Index-Umschichtung', 'Verfallstermine'],
      },
      symbols: ['KRE'], metric: 'rel-volume-sum',
    },
    {
      signal: {
        id: 'finance.markets.gold', domain: 'markets', name: 'Goldpreis',
        plain: 'Der Goldpreis; Anleger flüchten bei Vertrauensverlust in Gold.',
        weight: 0.3, unit: 'USD je Unze', baseline: yahooBaseline,
        banalCauses: ['Dollarschwäche', 'Zinserwartungen'],
      },
      symbols: ['GC=F'], metric: 'close',
    },
  ],
  iodaCountries: [],
  iodaEvents: [],
  ooni: [],
  statuspage: [],
  adsb: [],
} satisfies ScenarioCollectorConfig;
