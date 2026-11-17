// Zahl aktuell sichtbarer Militärflugzeuge weltweit (Evidenzklasse A, nur Aggregat).
// Quelle: adsb.lol Community-API, https://api.adsb.lol/docs, Endpunkt /v2/mil, kein Key.
// Lizenz: Daten unter ODbL (adsb.lol). Es wird ausschließlich die Anzahl gespeichert: keine Kennzeichen, keine Hex-Codes,
// keine Positionen, keine Einzelflüge.
// Gemessen: Feld `total` (sonst Länge von `ac`) des Live-Snapshots, Zeitstempel auf 15 Minuten abgerundet.
// Harmlose Ursachen: Übungen, Feeder-Abdeckung ändert sich (neue/ausgefallene Empfänger), Transponder aus, Tageszeit/Wochentag.
// Größe: /v2/mil liefert alle Militärflugzeuge mit Vollobjekten (in der Prüf-Umgebung Timeout, Antwort weit über 24 000 Zeichen); ein kleiner
// Zähl-Endpunkt ist nicht bekannt (die API kennt nur /mil, /pia, /ladd, /point, /hex, /callsign usw. mit Vollobjekten), daher Request unverändert.
// Szenario war: derselbe Zählwert wird zusätzlich als war.military.mil_aircraft_visible_global gemeldet (Katalog-Signale je Region wie
// mil_count_hormuz brauchen Positionen und sind hier ausgeschlossen; es gibt nur den Gesamtzähler). Kein zusätzlicher Request.
// Signal-IDs je Szenario: src/collectors/config/<szenario>.ts (Feld adsb); alle bekommen denselben Zählwert aus einem Request.
// VERIFIED: nein (Antwort zu groß für die Prüf-Umgebung; Antwortform { ac: [...], total, now, msg } nach Erinnerung)

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

interface Resp { ac?: unknown; total?: unknown }

/** Number of military aircraft currently listed. Never returns identifiers. */
export function parseMilCount(body: Resp): number {
  const total = num(body.total);
  if (total !== null && total >= 0) return total;
  return expect(Array.isArray(body.ac) ? body.ac.length : null, 'total/ac');
}

const STEP = 15 * 60_000;

/** Signal-IDs aller Szenarien für denselben Zählwert (src/collectors/config/<szenario>.ts, Feld adsb). */
const ENTRIES = scenarioEntries('adsb');
export const SIGNAL_IDS = ENTRIES.map((e) => e.signal.id);

const DEFAULTS = {
  evidenceClass: 'A' as const, kind: 'count' as const, manipulability: 'medium' as const, independenceGroup: 'adsb-lol',
  unit: 'Anzahl', intervalMinutes: 15, holdHours: 6,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
  thresholds: { relFloor: 0.1 },
  license: 'ODbL (adsb.lol), nur Aggregat',
};

const collector: Collector = {
  id: 'adsb-lol',
  title: 'adsb.lol (Militärflugzeuge, Aggregat)',
  sourceUrl: 'https://api.adsb.lol/docs',
  intervalMinutes: 15,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    if (SIGNAL_IDS.length === 0) return { observations: [] };
    const n = parseMilCount(await ctx.http.json<Resp>('https://api.adsb.lol/v2/mil', { fixture: 'adsb-lol/mil.json' }));
    const ts = Math.floor(ctx.now.getTime() / STEP) * STEP;
    return { observations: SIGNAL_IDS.map((id) => obs(id, ts, n)) };
  },
};

export default collector;
