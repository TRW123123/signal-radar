// Zahl aktuell sichtbarer Militärflugzeuge weltweit (Evidenzklasse A, nur Aggregat).
// Quelle: adsb.lol Community-API, https://api.adsb.lol/docs, Endpunkt /v2/mil, kein Key.
// Lizenz: Daten unter ODbL (adsb.lol). Es wird ausschließlich die Anzahl gespeichert: keine Kennzeichen, keine Hex-Codes,
// keine Positionen, keine Einzelflüge.
// Gemessen: Feld `total` (sonst Länge von `ac`) des Live-Snapshots, Zeitstempel auf 15 Minuten abgerundet.
// Harmlose Ursachen: Übungen, Feeder-Abdeckung ändert sich (neue/ausgefallene Empfänger), Transponder aus, Tageszeit/Wochentag.
// VERIFIED: nein (Antwortform { ac: [...], total, now, msg } nach Erinnerung; Doku war beim Bau nicht abrufbar).

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

interface Resp { ac?: unknown; total?: unknown }

/** Number of military aircraft currently listed. Never returns identifiers. */
export function parseMilCount(body: Resp): number {
  const total = num(body.total);
  if (total !== null && total >= 0) return total;
  return expect(Array.isArray(body.ac) ? body.ac.length : null, 'total/ac');
}

const STEP = 15 * 60_000;

const collector: Collector = {
  id: 'adsb-lol',
  title: 'adsb.lol (Militärflugzeuge, Aggregat)',
  sourceUrl: 'https://api.adsb.lol/docs',
  intervalMinutes: 15,
  signals: [
    {
      id: 'cyber.physical.military_aircraft_visible', scenarios: ['cyber'], domain: 'physical',
      name: 'Sichtbare Militärflugzeuge weltweit',
      plain: 'Wie viele Militärflugzeuge gerade auf öffentlichen Flugradaren zu sehen sind; ungewöhnlich viele oder plötzlich sehr wenige fallen auf.',
      evidenceClass: 'A', direction: 'both', kind: 'count', weight: 0.2, manipulability: 'medium', independenceGroup: 'adsb-lol',
      unit: 'Anzahl', intervalMinutes: 15, holdHours: 6,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { relFloor: 0.1 },
      license: 'ODbL (adsb.lol), nur Aggregat',
    },
  ],
  async collect(ctx) {
    const n = parseMilCount(await ctx.http.json<Resp>('https://api.adsb.lol/v2/mil', { fixture: 'adsb-lol/mil.json' }));
    const ts = Math.floor(ctx.now.getTime() / STEP) * STEP;
    return { observations: [obs('cyber.physical.military_aircraft_visible', ts, n)] };
  },
};

export default collector;
