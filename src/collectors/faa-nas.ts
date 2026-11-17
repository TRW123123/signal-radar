// US-Flughäfen mit Ground Stop, Ground Delay Program und Schließung (Evidenzklasse B: Betriebsdaten der FAA).
// Quelle: FAA National Airspace System Status, https://nasstatus.faa.gov/api/airport-status-information (XML), kein Key.
// Lizenz: US-Regierungsdaten, gemeinfrei (typisch); keine ausdrückliche Lizenzangabe gefunden.
// Gemessen: Zahl verschiedener Flughäfen (<ARPT>) in den Blöcken Ground_Stop_List, Ground_Delay_List, Airport_Closure_List.
// Nur Live-Snapshot, Historie entsteht durch eigene Archivierung. XML ohne Bibliothek per Regex gezählt.
// Harmlose Ursachen: Gewitter, Nebel, Schnee, Tower-Personalmangel, Großveranstaltungen, Feiertagsverkehr.
// VERIFIED: nein (Elementnamen nach Erinnerung; Doku war beim Bau nicht abrufbar). Ändert sich das Schema, wirft der Parser
// bei fehlender Wurzel, liefert aber 0 bei leeren Listen.

import type { Collector } from '../core/types.ts';
import { obs } from './_helpers.ts';

export interface NasCounts { groundStops: number; groundDelays: number; closures: number }

function countAirports(xml: string, listTag: string): number {
  const airports = new Set<string>();
  const re = new RegExp(`<${listTag}\\b[^>]*>([\\s\\S]*?)</${listTag}>`, 'gi');
  for (const m of xml.matchAll(re)) {
    for (const a of m[1].matchAll(/<ARPT>\s*([^<\s]+)\s*<\/ARPT>/gi)) airports.add(a[1].toUpperCase());
  }
  return airports.size;
}

export function parseNas(xml: string): NasCounts {
  if (typeof xml !== 'string' || !/<AIRPORT_STATUS_INFORMATION\b|<Update_Time>|<Delay_type\b/i.test(xml)) {
    throw new Error('unerwartete Antwort: kein FAA-Status-XML');
  }
  return {
    groundStops: countAirports(xml, 'Ground_Stop_List'),
    groundDelays: countAirports(xml, 'Ground_Delay_List'),
    closures: countAirports(xml, 'Airport_Closure_List'),
  };
}

const STEP = 5 * 60_000;
const common = {
  scenarios: ['cyber'], domain: 'physical', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'low' as const, independenceGroup: 'faa-nas', unit: 'Flughäfen', intervalMinutes: 15, holdHours: 6,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
  license: 'US-Regierungsdaten, gemeinfrei (typisch)',
};

const collector: Collector = {
  id: 'faa-nas',
  title: 'FAA NAS Status',
  sourceUrl: 'https://nasstatus.faa.gov/',
  intervalMinutes: 15,
  signals: [
    {
      ...common, id: 'cyber.physical.us_ground_stops', name: 'US-Flughäfen mit Ground Stop',
      plain: 'Wie viele US-Flughäfen gerade keine Flüge starten lassen dürfen; viele gleichzeitig deuten auf einen landesweiten Systemausfall.',
      weight: 0.5, banalCauses: ['Gewitter', 'Nebel', 'Personalmangel Tower'],
    },
    {
      ...common, id: 'cyber.physical.us_ground_delay_programs', name: 'US-Flughäfen mit Ground Delay Program',
      plain: 'Wie viele US-Flughäfen gerade Flüge am Abflugort zurückhalten, meist wegen Wetter oder Überlastung.',
      weight: 0.25, banalCauses: ['Gewitter', 'Nebel', 'Feiertagsverkehr'],
    },
    {
      ...common, id: 'cyber.physical.us_airport_closures', name: 'Geschlossene US-Flughäfen',
      plain: 'Wie viele US-Flughäfen laut FAA derzeit geschlossen sind.',
      weight: 0.2, banalCauses: ['Schnee', 'Pistenarbeiten', 'Unwetter'],
    },
  ],
  async collect(ctx) {
    const xml = await ctx.http.text('https://nasstatus.faa.gov/api/airport-status-information', { fixture: 'faa-nas/airport-status-information.xml' });
    const c = parseNas(xml);
    const ts = Math.floor(ctx.now.getTime() / STEP) * STEP;
    return {
      observations: [
        obs('cyber.physical.us_ground_stops', ts, c.groundStops),
        obs('cyber.physical.us_ground_delay_programs', ts, c.groundDelays),
        obs('cyber.physical.us_airport_closures', ts, c.closures),
      ],
    };
  },
};

export default collector;
