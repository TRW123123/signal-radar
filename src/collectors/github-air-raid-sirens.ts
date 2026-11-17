// Ukraine: Luftalarme je Tag und Zahl der betroffenen Regionen (Klasse B: Betriebsdaten des Alarmsystems, von Freiwilligen gespiegelt).
// Quelle: GitHub-Datensatz Vadimkin/ukrainian-air-raid-sirens-dataset, Datei datasets/volunteer_data_en.csv (seit 2022-02-25, ca. 9,4 MB).
// https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset  Kein Key.
// Lizenz: unklar (Lizenzdatei nicht geprüft; Daten stammen aus den öffentlichen Alarmmeldungen).
// Gewählt wurde die Volunteer-Datei: official_data_en.csv endet im Test bei 2026-09-07 (veraltet) und führt seit Dez 2025 Raion-Ebene.
//   volunteer_data_en.csv hat durchgehend die 24 Regionen (Oblaste und Kyjiw-Stadt) und reicht bis zum Vortag (letzter Alarm 16.11.2026 05:07 UTC).
// Aufbau: Kopf `region,started_at,finished_at,naive`; je Zeile ein Alarm mit Beginn/Ende in UTC (`+00:00`). Nicht strikt nach Zeit sortiert.
// Abruf: nur das Dateiende per Range-Header (ab Byte 8 000 000, ca. 1,4 MB, rund 70 Tage); die angeschnittene erste Zeile entfällt.
// Gemessen: je UTC-Tag nach Alarmbeginn
//   war.conflict.ua_air_alerts: Zahl der Alarme (alle Regionen zusammen; im Normalzustand etwa 130 bis 230 pro Tag).
//   war.conflict.ua_air_alert_regions: Zahl verschiedener Regionen mit mindestens einem Alarm (höchstens 24).
//   Nur vollständige Tage: Tage ab dem Tag des jüngsten Alarmeintrags im Spiegel (Spiegel hinkt teils um Stunden) entfallen, ebenso der laufende Tag.
// Harmlose Ursachen für Ausschläge: einzelne Drohnen lösen Alarme in vielen Regionen aus, Änderungen der Alarmpraxis der Regionen,
//   Fehlalarme, Nachträge im Spiegel.
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, obs, parseCsv } from './_helpers.ts';

const URL_CSV = 'https://raw.githubusercontent.com/Vadimkin/ukrainian-air-raid-sirens-dataset/main/datasets/volunteer_data_en.csv';
const RANGE_FROM = 8_000_000;
const WINDOW_DAYS = 70;
const SIG_ALERTS = 'war.conflict.ua_air_alerts';
const SIG_REGIONS = 'war.conflict.ua_air_alert_regions';

export interface DayStat { day: string; alerts: number; regions: number }
export interface SirensResult { days: DayStat[]; lastStart: string | null }

export function parseSirens(text: string, now: Date, opts: { partial?: boolean } = {}): SirensResult {
  let body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  if (opts.partial) {
    const nl = body.indexOf('\n');
    body = nl >= 0 ? body.slice(nl + 1) : '';
  }
  const rows = parseCsv(body);
  let iReg = 0;
  let iStart = 1;
  let start = 0;
  if (rows[0] && rows[0][0] === 'region') {
    iReg = rows[0].indexOf('region');
    iStart = rows[0].indexOf('started_at');
    if (iStart < 0) throw new Error('unerwartete Antwort: Spalte started_at fehlt');
    start = 1;
  }
  const alerts = new Map<string, number>();
  const regions = new Map<string, Set<string>>();
  let first = '';
  let lastTs = -Infinity;
  for (let i = start; i < rows.length; i++) {
    const s = rows[i][iStart];
    const t = s ? Date.parse(s.replace(' ', 'T')) : NaN;
    if (!Number.isFinite(t) || !rows[i][iReg]) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    if (!first || day < first) first = day;
    lastTs = Math.max(lastTs, t);
    alerts.set(day, (alerts.get(day) ?? 0) + 1);
    if (!regions.has(day)) regions.set(day, new Set());
    regions.get(day)!.add(rows[i][iReg]);
  }
  if (!first) return { days: [], lastStart: null };
  const lastDay = new Date(lastTs).toISOString().slice(0, 10);
  const firstFull = new Date(`${first}T00:00:00Z`).getTime() + (opts.partial ? DAY_MS : 0);
  const windowFrom = new Date(`${isoDay(daysAgo(now, WINDOW_DAYS))}T00:00:00Z`).getTime();
  const yesterday = new Date(`${isoDay(daysAgo(now, 1))}T00:00:00Z`).getTime();
  const lastFull = Math.min(yesterday, new Date(`${lastDay}T00:00:00Z`).getTime() - DAY_MS);
  const days: DayStat[] = [];
  for (let t = Math.max(firstFull, windowFrom); t <= lastFull; t += DAY_MS) {
    const day = isoDay(new Date(t));
    days.push({ day, alerts: alerts.get(day) ?? 0, regions: regions.get(day)?.size ?? 0 });
  }
  return { days, lastStart: new Date(lastTs).toISOString() };
}

const common = {
  scenarios: ['war'], domain: 'conflict', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'github-air-raid-sirens', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  thresholds: { z0: 3, z1: 8, relFloor: 0.15 },
  sourceName: 'Vadimkin/ukrainian-air-raid-sirens-dataset (GitHub)', sourceUrl: 'https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset',
  license: 'unklar (Lizenzdatei nicht geprüft)',
};

const collector: Collector = {
  id: 'github-air-raid-sirens',
  title: 'Ukraine Luftalarme (GitHub-Datensatz, Volunteer-Datei)',
  sourceUrl: 'https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_ALERTS, name: 'Ukraine: Luftalarme pro Tag (alle Regionen)', weight: 0.75, unit: 'Alarme/Tag',
      plain: 'Zählt täglich die Luftalarme in allen ukrainischen Regionen zusammen; Sprünge zeigen größere Angriffswellen mit Raketen und Drohnen.',
      banalCauses: ['einzelne Drohnen lösen Alarme in vielen Regionen aus', 'Änderung der Alarmpraxis der Regionen', 'Fehlalarme'],
    },
    {
      ...common, id: SIG_REGIONS, name: 'Ukraine: Regionen mit Luftalarm pro Tag', weight: 0.5, unit: 'Regionen/Tag',
      thresholds: { z0: 3, z1: 8, absFloor: 1 },
      plain: 'Zählt, in wie vielen der 24 Regionen am Tag mindestens ein Luftalarm ausgelöst wurde; ein Anstieg zeigt, dass auch Westregionen betroffen sind.',
      banalCauses: ['einzelne Drohnen in Grenznähe', 'Änderung der Alarmpraxis'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_CSV, {
      fixture: 'air-raid-sirens/volunteer_data_en_tail.csv', headers: { range: `bytes=${RANGE_FROM}-` }, timeoutMs: 90_000,
    });
    const r = parseSirens(text, ctx.now, { partial: true });
    ctx.log(`github-air-raid-sirens: jüngster Alarmbeginn im Spiegel ${r.lastStart ?? 'unbekannt'}`);
    if (!r.days.length) throw new Error('keine vollständigen Tage im Spiegel (Datei veraltet oder leer)');
    const observations: Observation[] = [];
    for (const d of r.days) {
      observations.push(obs(SIG_ALERTS, `${d.day}T00:00:00Z`, d.alerts));
      observations.push(obs(SIG_REGIONS, `${d.day}T00:00:00Z`, d.regions));
    }
    return { observations };
  },
};

export default collector;
