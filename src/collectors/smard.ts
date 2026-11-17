// Netzlast Deutschland stündlich (Evidenzklasse A). Quelle: SMARD, Bundesnetzagentur, https://www.smard.de/ (Downloadcenter-Doku),
// Daten-Endpunkte der Chart-Oberfläche ohne Key. Lizenz: CC BY 4.0, Namensnennung "Bundesnetzagentur | SMARD.de".
// Ablauf: erst Index (index_hour.json: { timestamps: [ms, ...] } = Wochenanfänge), dann Wochendatei
// 410_DE_hour_<ms>.json ({ meta_data, series: [[ms, MW|null], ...] }); Filter 410 = Stromverbrauch Netzlast, Region DE.
// Harmlose Ursachen für Ausschläge: Feiertage, Brückentage, Wetter, Zeitumstellung; nicht veröffentlichte Stunden sind null.
// URL-Form: https://www.smard.de/app/chart_data/<filter>/<region>/index_<resolution>.json und .../<filter>_<region>_<resolution>_<timestamp>.json;
// <timestamp> muss ein Wert aus dem Index sein (Wochenanfang Montag 00:00 Ortszeit, also 22:00/23:00 UTC), geratene Werte ergeben 404.
// Der Index (8 700 Zeichen, wächst jede Woche) wird nicht mehr abgerufen: die Wochenanfänge sind Montag 00:00 Europe/Berlin und werden
// lokal berechnet (weekStarts; Test gleicht sie mit dem echten Index ab). Je Wochendatei 168 Stunden, ca. 4 500 bis 5 000 Zeichen.
// Fehlt die Datei der laufenden Woche noch (404), fällt nur sie aus.
// VERIFIED: teilweise (Index 17.11.2026 echt, 621 Wochen-Zeitstempel, stimmen mit weekStarts überein; Wochendateien noch nicht aufgezeichnet).

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const BASE = 'https://www.smard.de/app/chart_data/410/DE';
const HOUR = 3600_000;

interface IndexResp { timestamps?: unknown }
interface DataResp { series?: unknown }

const BERLIN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
function berlinParts(ms: number): Record<string, string> {
  return Object.fromEntries(BERLIN.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Die letzten n Wochenanfänge (Montag 00:00 Europe/Berlin, in ms) bis einschließlich before, aufsteigend. Wie im SMARD-Index. */
export function weekStarts(before: number, n: number): number[] {
  const DAY = 86400_000;
  const p = berlinParts(before);
  // Kalendertag des Montags in Berliner Ortszeit; dessen Mitternacht liegt um 23:00 (MEZ) oder 22:00 UTC (MESZ) des Vortags.
  let day = Date.UTC(+p.year, +p.month - 1, +p.day) - WEEKDAYS.indexOf(p.weekday) * DAY;
  const out: number[] = [];
  while (out.length < n) {
    const t = [3600_000, 7200_000].map((off) => day - off).find((c) => {
      const q = berlinParts(c);
      return q.weekday === 'Mon' && q.hour === '00' && q.minute === '00';
    });
    if (t === undefined) throw new Error(`Wochenanfang für ${new Date(day).toISOString()} nicht bestimmbar`);
    if (t <= before) out.push(t);
    day -= 7 * DAY;
  }
  return out.reverse();
}

export function parseIndex(body: IndexResp): number[] {
  const ts = expect(Array.isArray(body.timestamps) ? body.timestamps : null, 'timestamps');
  return ts.map(num).filter((x): x is number => x !== null).sort((a, b) => a - b);
}

/** Hourly load points before `before` (ms); null values (not yet published) are dropped. */
export function parseSeries(body: DataResp, before: number): { ts: number; mw: number }[] {
  const series = expect(Array.isArray(body.series) ? body.series : null, 'series');
  const out: { ts: number; mw: number }[] = [];
  for (const p of series) {
    if (!Array.isArray(p)) continue;
    const t = num(p[0]);
    const v = num(p[1]);
    if (t === null || v === null || v <= 0) continue;
    if (t % HOUR !== 0 || t >= before) continue;
    out.push({ ts: t, mw: v });
  }
  return out;
}

const collector: Collector = {
  id: 'smard',
  title: 'SMARD (Bundesnetzagentur)',
  sourceUrl: 'https://www.smard.de/',
  intervalMinutes: 60,
  signals: [
    {
      id: 'cyber.physical.grid_load_germany', scenarios: ['cyber'], domain: 'physical', name: 'Netzlast Deutschland (SMARD)',
      plain: 'Wie viel Strom in Deutschland gerade verbraucht wird; ein abrupter Einbruch ohne Feiertag oder Wetter wäre auffällig.',
      evidenceClass: 'A', direction: 'down', kind: 'gauge', weight: 0.35, manipulability: 'low', independenceGroup: 'smard',
      unit: 'MW', intervalMinutes: 60, holdHours: 6,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { relFloor: 0.05 },
      license: 'CC BY 4.0 (Bundesnetzagentur | SMARD.de)',
    },
  ],
  async collect(ctx) {
    const before = floorHour(ctx.now).getTime();
    const weeks = weekStarts(before, 4); // 4 Wochen = Baseline-Fenster
    const observations: Observation[] = [];
    let ok = 0;
    for (const w of weeks) {
      try {
        const body = await ctx.http.json<DataResp>(`${BASE}/410_DE_hour_${w}.json`, { fixture: `smard/410_DE_hour_${w}.json` });
        for (const p of parseSeries(body, before)) observations.push(obs('cyber.physical.grid_load_germany', p.ts, p.mw));
        ok++;
      } catch (e) {
        ctx.log(`Woche ${w} übersprungen: ${(e as Error).message}`);
      }
    }
    if (!ok) throw new Error('SMARD: keine Wochendatei lesbar');
    return { observations };
  },
};

export default collector;
