// Szenario finance: Konfiguration der geteilten Collectors (noch leer). Anleitung: docs/SCENARIO-CONFIG-GUIDE.md

import type { ScenarioCollectorConfig } from './_types.ts';

export default {
  scenario: 'finance',
  wikipedia: [],
  hackerNews: [],
  gdelt: [],
  polymarket: [],
  yahoo: [],
  iodaCountries: [],
  iodaEvents: [],
  ooni: [],
  statuspage: [],
  adsb: [],
} satisfies ScenarioCollectorConfig;
