// Szenario blackout: Konfiguration der geteilten Collectors. Anleitung: docs/SCENARIO-CONFIG-GUIDE.md
// Stand 24.11.2026. IODA Deutschland: dieselbe Antwort (ioda/country-DE.json) wie cyber.outages.ioda_country_signals_de, kein weiterer Request.
// Nicht-konfigurierbare Quellen (Netzfrequenz, Netzlast, Kp-Index, Strompreis, Wetter) liefern die Collectors blackout-grid-bridge und blackout-open-meteo.
// VERIFIED: ja für ioda/country-DE.json (Aufzeichnung vorhanden).

import type { ScenarioCollectorConfig } from './_types.ts';

const iodaHourly = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };

export default {
  scenario: 'blackout',
  wikipedia: [],
  hackerNews: [],
  gdelt: [],
  polymarket: [],
  yahoo: [],
  iodaCountries: [
    {
      signal: {
        id: 'blackout.outages.ioda_country_internet', domain: 'outages', name: 'IODA: Deutsche Netze im Routing (Stromausfall-Folge)',
        plain: 'Wie viele deutsche Netzblöcke im Internet sichtbar sind; bricht der Wert ein, kann ein großflächiger Stromausfall dahinterstecken.',
        direction: 'down', kind: 'gauge', weight: 0.6, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: iodaHourly,
        geo: { lat: 51.2, lon: 10.4, label: 'Deutschland', kind: 'country', cc: 'DE' },
        banalCauses: ['Messausfall einzelner BGP-Quellen bei IODA', 'Umnummerierung großer Provider'],
      },
      countries: ['DE'],
    },
  ],
  iodaEvents: [],
  ooni: [],
  statuspage: [],
  adsb: [],
} satisfies ScenarioCollectorConfig;
