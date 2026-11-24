// Szenario blackout: Konfiguration der geteilten Collectors. Anleitung: docs/SCENARIO-CONFIG-GUIDE.md
// Stand 24.11.2026. IODA Deutschland: dieselbe Antwort (ioda/country-DE.json) wie cyber.outages.ioda_country_signals_de, kein weiterer Request.
// Nicht-konfigurierbare Quellen (Netzfrequenz, Netzlast, Kp-Index, Strompreis, Wetter) liefern die Collectors blackout-grid-bridge und blackout-open-meteo.
// VERIFIED: ja für ioda/country-DE.json (Aufzeichnung vorhanden).
// Neu 24.11.2026: erreichbare Netze (IODA ping-slash24, aktive Messung) je Land für ES, PT, FR, IT, PL, GB, UA, TR, US, IN (10 neue Requests,
// je ca. 2 500 bis 3 500 Zeichen, 24 Stunden = sofort 24 Stundenwerte als Vergleichsbasis) und DE (Antwort ioda/country-DE-ping.json wie
// cyber.outages.ioda_ping_de, kein weiterer Request). Grund: Rücktest Stromausfall Spanien/Portugal 28.04.2025, dort zeigte die Zahl erreichbarer
// Netze den Ausfall am klarsten. BGP-Reihen je Land bewusst nicht ergänzt (Ping reagiert bei Stromausfall stärker; Request- und Übersetzungsbudget).
// VERIFIED: nein für die neuen Ping-Länder (Form wie ioda/country-DE-ping.json angenommen).

import type { ScenarioCollectorConfig } from './_types.ts';

const iodaHourly = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };
/** Länder für erreichbare Netze (Ping). inName = Ortsangabe im Satz ("in Spanien", "in den USA"). */
const PING_COUNTRIES: { cc: string; label: string; inName: string; lat: number; lon: number }[] = [
  { cc: 'DE', label: 'Deutschland', inName: 'Deutschland', lat: 51.2, lon: 10.4 },
  { cc: 'ES', label: 'Spanien', inName: 'Spanien', lat: 40.2, lon: -3.7 },
  { cc: 'PT', label: 'Portugal', inName: 'Portugal', lat: 39.6, lon: -8.0 },
  { cc: 'FR', label: 'Frankreich', inName: 'Frankreich', lat: 46.6, lon: 2.4 },
  { cc: 'IT', label: 'Italien', inName: 'Italien', lat: 42.8, lon: 12.6 },
  { cc: 'PL', label: 'Polen', inName: 'Polen', lat: 52.1, lon: 19.4 },
  { cc: 'GB', label: 'Großbritannien', inName: 'Großbritannien', lat: 54.0, lon: -2.5 },
  { cc: 'UA', label: 'Ukraine', inName: 'der Ukraine', lat: 49.0, lon: 31.4 },
  { cc: 'TR', label: 'Türkei', inName: 'der Türkei', lat: 39.0, lon: 35.2 },
  { cc: 'US', label: 'USA', inName: 'den USA', lat: 39.8, lon: -98.6 },
  { cc: 'IN', label: 'Indien', inName: 'Indien', lat: 22.0, lon: 79.0 },
];

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
    ...PING_COUNTRIES.map((c) => ({
      signal: {
        id: `blackout.outages.ioda_ping_${c.cc.toLowerCase()}`, domain: 'outages', name: `IODA: Erreichbare Netze ${c.label} (Ping)`,
        plain: `Wie viele Netze in ${c.inName} von außen erreichbar sind. Bei einem großen Stromausfall bricht das ein.`,
        direction: 'down' as const, kind: 'gauge' as const, weight: 0.7, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: iodaHourly,
        geo: { lat: c.lat, lon: c.lon, label: c.label, kind: 'country' as const, cc: c.cc },
        banalCauses: ['Ausfall einzelner IODA-Messpunkte', 'Wartung großer Provider', 'Geänderte Firewall-Regeln großer Netze'],
      },
      countries: [c.cc], datasource: 'ping-slash24' as const,
    })),
  ],
  iodaEvents: [],
  ooni: [],
  statuspage: [],
  adsb: [],
} satisfies ScenarioCollectorConfig;
