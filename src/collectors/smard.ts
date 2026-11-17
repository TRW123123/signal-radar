// Netzlast Deutschland stündlich (Evidenzklasse A). Quelle: SMARD, Bundesnetzagentur, https://www.smard.de/ (Downloadcenter-Doku),
// Daten-Endpunkte der Chart-Oberfläche ohne Key. Lizenz: CC BY 4.0, Namensnennung "Bundesnetzagentur | SMARD.de".
// Ablauf: erst Index (index_hour.json: { timestamps: [ms, ...] } = Wochenanfänge), dann Wochendatei
// 410_DE_hour_<ms>.json ({ meta_data, series: [[ms, MW|null], ...] }); Filter 410 = Stromverbrauch Netzlast, Region DE.
// Harmlose Ursachen für Ausschläge: Feiertage, Brückentage, Wetter, Zeitumstellung; nicht veröffentlichte Stunden sind null.
// URL-Form: https://www.smard.de/app/chart_data/<filter>/<region>/index_<resolution>.json und .../<filter>_<region>_<resolution>_<timestamp>.json;
// <timestamp> muss ein Wert aus dem Index sein (Wochenanfang Montag 00:00 Ortszeit, also 22:00/23:00 UTC), geratene Werte ergeben 404.
// VERIFIED: teilweise (Index 17.11.2026 echt, 621 Wochen-Zeitstempel; Wochendateien noch nicht aufgezeichnet, Queue mit echten Zeitstempeln neu).

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const BASE = 'https://www.smard.de/app/chart_data/410/DE';
const HOUR = 3600_000;

interface IndexResp { timestamps?: unknown }
interface DataResp { series?: unknown }

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
    const index = parseIndex(await ctx.http.json<IndexResp>(`${BASE}/index_hour.json`, { fixture: 'smard/index_hour.json' }));
    const weeks = index.filter((t) => t <= before).slice(-4); // 4 Wochen = Baseline-Fenster (je Wochendatei ca. 5 kB)
    if (!weeks.length) throw new Error('unerwartete Antwort: kein Wochen-Zeitstempel im Index');
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
