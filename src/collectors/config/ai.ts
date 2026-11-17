// Szenario ai: Konfiguration der geteilten Collectors (noch leer). Anleitung: docs/SCENARIO-CONFIG-GUIDE.md

import type { ScenarioCollectorConfig } from './_types.ts';

export default {
  scenario: 'ai',
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
