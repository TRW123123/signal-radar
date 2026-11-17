// Deutschland: Ortsdosisleistung (ODL) einer festen kleinen Stichprobe von 15 Messstellen des BfS (Evidenzklasse A: unabhängige Messung).
// Quelle: Bundesamt für Strahlenschutz, ODL-Info, offene WFS-Schnittstelle (GeoServer), Layer opendata:odlinfo_odl_1h_latest
// (alle Messstellen mit dem letzten Einstundenwert). Doku: https://odlinfo.bfs.de/ODL/EN/service/data-interface/data-interface.html
// Lizenz: DL-DE-BY-2.0 (Datenlizenz Deutschland, Namensnennung "Bundesamt für Strahlenschutz, ODL-Info"). Kein Key, nur passive Leseabfragen.
// Größe: Der volle Layer hat rund 1 700 Messstellen (mehrere hundert kB). Darum drei kleine Abfragen mit je 5 Messstellen, sortiert nach
// Kennung (sortBy=kenn, Blätter-Beginn startIndex 0, 600, 1200: grob Norden, Mitte, Süden) und nur den Feldern kenn, name, site_status,
// end_measure, value (propertyName; ohne Geometrie). Je Antwort ca. 1 500 Zeichen. Der Collector meldet nur Rohwerte, keine Normalwerte:
// die Baseline je Wochenstunde bildet die Engine.
// Gemessen (je Messstunde, Zeitstempel = Ende der Messstunde laut end_measure, auf die volle Stunde abgerundet):
//   (1) Median der Ortsdosisleistung der Stichprobe in µSv/h (üblich 0,05 bis 0,20);
//   (2) Zahl der Stichproben-Messstellen mit mehr als 0,3 µSv/h (feste Rohschwelle oberhalb des natürlichen Bereichs, normal 0).
// Es zählen nur Messstellen mit gültigem Wert und end_measure höchstens 3 Stunden vor der jüngsten; antworten weniger als 10 von 15 oder
// fehlt eine der drei Abfragen, wird ein Fehler geworfen (eine unvollständige Stichprobe wäre sonst ein Scheinsprung).
// Bekannte Schwäche: Der Blätter-Beginn verschiebt sich, wenn BfS Messstellen hinzufügt oder entfernt; die Stichprobe wechselt dann
// teilweise, der Median springt leicht (Baseline-Verunreinigung, kein Alarm wegen der relFloor-Schwelle).
// Harmlose Ursachen: Regen (Auswaschung von Radon-Folgeprodukten, +0,02 bis 0,05 µSv/h), Gewitter, Schneedecke (dämpft) und Schneeschmelze,
// Sondendefekt oder Wartung, Radon-Spitzen bei Inversionswetter, medizinische Strahlenquellen in der Nähe einer Sonde.
// Keine Bewertung von Orten oder Personen; es werden nur Zähler und der Median gespeichert.
// VERIFIED: nein (Endpunkt und Felder nach Doku der Datenschnittstelle; in der Bau-Umgebung nicht abrufbar; Zeitformat von end_measure
// ISO 8601 angenommen, ohne Zeitzone als UTC gelesen)

import type { Collector } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

export const BASE_URL = 'https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&typeName=opendata:odlinfo_odl_1h_latest';
/** Blätter-Beginn der drei Stichproben-Blöcke (nach kenn sortiert) und Messstellen je Block. */
export const START_INDEXES = [0, 600, 1200];
export const PER_BLOCK = 5;
/** Mindestzahl gültiger Messstellen (von 15). */
export const MIN_STATIONS = 10;
/** Rohschwelle in µSv/h für die Zählung (oberhalb des natürlichen Bereichs). */
export const ABOVE_USV_H = 0.3;
const HOUR = 3600_000;
const MAX_SPREAD_H = 3;
const MAX_AGE_H = 6;

const SIG_MEDIAN = 'nuclear.radiation.bfs_median_dose_rate';
const SIG_ABOVE = 'nuclear.radiation.bfs_stations_above_normal';

export interface Station { kenn: string; value: number; endMs: number }

export function buildUrl(startIndex: number): string {
  return `${BASE_URL}&sortBy=kenn&maxFeatures=${PER_BLOCK}&startIndex=${startIndex}&propertyName=kenn,name,site_status,end_measure,value`;
}

function parseTime(x: unknown): number | null {
  if (typeof x !== 'string' || x === '') return null;
  const t = Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(x) ? x : `${x}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Liest die Messstellen einer GeoJSON-Antwort; Einträge ohne gültigen Wert oder Zeitstempel entfallen. */
export function parseStations(body: unknown): Station[] {
  const features = expect(Array.isArray((body as { features?: unknown })?.features) ? (body as { features: unknown[] }).features : null, 'features');
  const out: Station[] = [];
  for (const f of features) {
    const p = (f as { properties?: Record<string, unknown> })?.properties;
    if (!p) continue;
    const value = num(p.value);
    const endMs = parseTime(p.end_measure);
    if (value === null || value < 0 || endMs === null) continue;
    out.push({ kenn: String(p.kenn ?? ''), value, endMs });
  }
  return out;
}

export function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  if (n === 0) throw new Error('Median ohne Werte');
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export interface Summary { hourMs: number; stations: number; median: number; above: number }

/** Fasst die Stichprobe zusammen; wirft bei zu wenigen oder zu alten Messstellen. */
export function summarize(all: Station[], now: Date): Summary {
  if (all.length === 0) throw new Error('keine gültigen Messstellen');
  const latest = Math.max(...all.map((s) => s.endMs));
  if (now.getTime() - latest > MAX_AGE_H * HOUR) throw new Error(`ODL-Daten veraltet: jüngste Messung ${new Date(latest).toISOString()}`);
  const cur = all.filter((s) => latest - s.endMs <= MAX_SPREAD_H * HOUR);
  if (cur.length < MIN_STATIONS) throw new Error(`nur ${cur.length} aktuelle Messstellen von ${START_INDEXES.length * PER_BLOCK}`);
  return {
    hourMs: floorHour(new Date(latest)).getTime(), stations: cur.length,
    median: median(cur.map((s) => s.value)), above: cur.filter((s) => s.value > ABOVE_USV_H).length,
  };
}

const common = {
  scenarios: ['nuclear'], domain: 'radiation', evidenceClass: 'A' as const, direction: 'up' as const, manipulability: 'low' as const,
  independenceGroup: 'bfs-imis', intervalMinutes: 60, holdHours: 12,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
  sourceName: 'BfS ODL-Info (WFS)', sourceUrl: 'https://odlinfo.bfs.de/', license: 'DL-DE-BY-2.0 (Bundesamt für Strahlenschutz, ODL-Info)',
};

const collector: Collector = {
  id: 'bfs-odl',
  title: 'BfS ODL-Info (Ortsdosisleistung, Stichprobe)',
  sourceUrl: 'https://odlinfo.bfs.de/',
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: SIG_MEDIAN, kind: 'gauge' as const, name: 'Mittlere Ortsdosisleistung Deutschland (Stichprobe)', weight: 0.8, unit: 'µSv/h',
      thresholds: { z0: 4, z1: 10, relFloor: 0.1 },
      plain: 'Der mittlere Wert von 15 festen deutschen Strahlungsmessstellen in Mikrosievert pro Stunde, ein sehr ruhiger Wert.',
      banalCauses: ['Regen (Auswaschung von Radon-Folgeprodukten)', 'Gewitter', 'Schneedecke und Schneeschmelze', 'Sondendefekt oder Wartung'],
    },
    {
      ...common, id: SIG_ABOVE, kind: 'count' as const, name: 'Messstellen deutlich über dem natürlichen Bereich (Stichprobe)', weight: 0.9, unit: 'Stationen (von 15)',
      thresholds: { z0: 3, z1: 6, absFloor: 1 },
      plain: 'Wie viele von 15 festen deutschen Strahlungsmessstellen gerade mehr als 0,3 Mikrosievert pro Stunde messen; normal ist keine.',
      banalCauses: ['Sondendefekt oder Wartung', 'Medizinische Strahlenquellen in der Nähe', 'Radon-Spitzen bei Inversionswetter'],
    },
  ],
  async collect(ctx) {
    const all: Station[] = [];
    for (const start of START_INDEXES) {
      const body = await ctx.http.json<unknown>(buildUrl(start), { fixture: `bfs-odl/odl-1h-latest-${start}.json` });
      all.push(...parseStations(body));
    }
    const s = summarize(all, ctx.now);
    return {
      observations: [
        obs(SIG_MEDIAN, s.hourMs, s.median, { stations: s.stations }),
        obs(SIG_ABOVE, s.hourMs, s.above, { stations: s.stations }),
      ],
    };
  },
};

export default collector;
