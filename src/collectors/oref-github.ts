// Israel: Alarme des Heimatfrontkommandos (Pikud HaOref) als Tagesreihe (Klasse B: amtliche Betriebsdaten des Warnsystems).
// Quelle: GitHub-Spiegel dleshem/israel-alerts-data, Datei israel-alerts.csv (Historie seit 2014-07, ca. 65 MB, wird fortgeschrieben).
// https://github.com/dleshem/israel-alerts-data  (Rohdatei: raw.githubusercontent.com/dleshem/israel-alerts-data/main/israel-alerts.csv)
// Lizenz: unklar (Repo ohne ausgewiesene Lizenz; Daten stammen aus den öffentlichen Warnmeldungen der israelischen Behörde). Kein Key.
// Aufbau: Kopf `data,date,time,alertDate,category,category_desc,matrix_id,rid`; je Zeile eine Ortschaft (`data`) und ein Alarm.
//   Kategorien: 1 = Raketen/Flugkörper, 2 = Eindringen feindlicher Luftfahrzeuge (Drohnen), 10 und 14 = Vorwarnung, 13 = Entwarnung.
//   `date`/`time`/`alertDate` sind israelische Ortszeit; der Tag wird nach dem Ortsdatum zugeordnet (Abweichung zu UTC 2 bis 3 Stunden,
//   für Tageswerte unerheblich). Die Datei ist nach Zeit aufsteigend; die jüngsten Zeilen stehen am Ende.
// Abruf: nur das Dateiende per Range-Header (ab Byte 63 000 000, ca. 2,7 MB statt 65 MB). Die erste Zeile ist angeschnitten und wird verworfen.
//   Wächst die Datei nicht, bleibt das Fenster stabil; ist sie kürzer als der Offset, antwortet GitHub mit 416 und der Lauf schlägt sichtbar fehl.
// Gemessen (nur Kategorien 1 und 2, Entwarnungen und Vorwarnungen zählen nicht):
//   war.conflict.israel_oref: Zahl verschiedener Alarmzeitpunkte (Minuten-Zeitstempel alertDate) je Tag = Zahl der Alarmwellen.
//   war.conflict.israel_oref_localities: Zahl verschiedener alarmierter Ortschaften je Tag = räumliche Breite.
//   Tage ohne Alarm zählen 0. Gemeldet werden die letzten 90 vollständigen Tage bis gestern.
// Hinweis zur Aktualität: Der Spiegel wird unregelmäßig gepflegt, ruhige Phasen mit Lücken von mehreren Tagen sind normal (Stand 17.11.2026:
//   letzter Alarm 08.11.2026, davor 19.10.). Ein veralteter Spiegel würde als „ruhig“ erscheinen; das Signal richtet sich nur nach oben.
// Harmlose Ursachen für Ausschläge: Fehlalarme, Alarme durch einzelne Drohnen oder Fehlzündungen, Übungen sind nicht enthalten, Nachtragen
//   älterer Zeilen durch den Spiegel.
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, obs, parseCsv } from './_helpers.ts';

const URL_CSV = 'https://raw.githubusercontent.com/dleshem/israel-alerts-data/main/israel-alerts.csv';
const RANGE_FROM = 63_000_000;
const WINDOW_DAYS = 90;
const SIG_WAVES = 'war.conflict.israel_oref';
const SIG_PLACES = 'war.conflict.israel_oref_localities';
const ATTACK_CATEGORIES = new Set(['1', '2']);

export interface DayStat { day: string; waves: number; localities: number }
export interface OrefResult { days: DayStat[]; lastAlertDay: string | null }

/**
 * Wertet das Dateiende aus. `partial`: erste Zeile verwerfen (Range-Abruf).
 * Gibt je Tag von (erstem vollständigen Tag, spätestens now-90) bis gestern eine Zeile zurück, Tage ohne Alarm mit 0.
 */
export function parseOref(text: string, now: Date, opts: { partial?: boolean } = {}): OrefResult {
  let body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  if (opts.partial) {
    const nl = body.indexOf('\n');
    body = nl >= 0 ? body.slice(nl + 1) : '';
  }
  const rows = parseCsv(body);
  const head = rows[0];
  let startIdx = 0;
  let iAlert = 3;
  let iCat = 4;
  let iData = 0;
  if (head && head[0] === 'data') {
    iData = head.indexOf('data');
    iAlert = head.indexOf('alertDate');
    iCat = head.indexOf('category');
    if (iAlert < 0 || iCat < 0) throw new Error('unerwartete Antwort: Spalten alertDate/category fehlen');
    startIdx = 1;
  }
  const waves = new Map<string, Set<string>>();
  const places = new Map<string, Set<string>>();
  let firstDay = '';
  let lastAlertDay: string | null = null;
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const alertDate = r[iAlert];
    if (!alertDate || !/^\d{4}-\d{2}-\d{2}T/.test(alertDate)) continue;
    const day = alertDate.slice(0, 10);
    if (!firstDay || day < firstDay) firstDay = day;
    if (!ATTACK_CATEGORIES.has(r[iCat])) continue;
    if (!waves.has(day)) { waves.set(day, new Set()); places.set(day, new Set()); }
    waves.get(day)!.add(alertDate);
    for (const p of (r[iData] ?? '').split(',')) { const t = p.trim(); if (t) places.get(day)!.add(t); }
    if (!lastAlertDay || day > lastAlertDay) lastAlertDay = day;
  }
  if (!firstDay) return { days: [], lastAlertDay: null };
  const from = new Date(`${firstDay}T00:00:00Z`).getTime() + (opts.partial ? DAY_MS : 0); // erster Tag ist angeschnitten
  const windowFrom = new Date(`${isoDay(daysAgo(now, WINDOW_DAYS))}T00:00:00Z`).getTime();
  const to = new Date(`${isoDay(daysAgo(now, 1))}T00:00:00Z`).getTime(); // gestern, letzter vollständiger Tag
  const days: DayStat[] = [];
  for (let t = Math.max(from, windowFrom); t <= to; t += DAY_MS) {
    const day = isoDay(new Date(t));
    days.push({ day, waves: waves.get(day)?.size ?? 0, localities: places.get(day)?.size ?? 0 });
  }
  return { days, lastAlertDay };
}

const common = {
  scenarios: ['war'], domain: 'conflict', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'low' as const, independenceGroup: 'oref-github', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  sourceName: 'Israel Alerts (Heimatfront-Historie, GitHub-Spiegel)', sourceUrl: 'https://github.com/dleshem/israel-alerts-data',
  license: 'unklar (Repo ohne Lizenzangabe)',
};

const collector: Collector = {
  id: 'oref-github',
  title: 'Israel Alerts (Heimatfront-Historie, GitHub-Spiegel)',
  sourceUrl: 'https://github.com/dleshem/israel-alerts-data',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_WAVES, name: 'Israel: Alarmwellen pro Tag (Raketen und Drohnen)', weight: 0.8, unit: 'Alarmwellen/Tag',
      thresholds: { z0: 3, z1: 8, absFloor: 2 },
      plain: 'Zählt, wie oft pro Tag in Israel Raketen- oder Drohnenalarm ausgelöst wurde.',
      banalCauses: ['Fehlalarme', 'einzelne Drohnen oder Raketen aus Gaza oder dem Libanon', 'Nachtragen älterer Zeilen im Spiegel'],
    },
    {
      ...common, id: SIG_PLACES, name: 'Israel: alarmierte Ortschaften pro Tag', weight: 0.5, unit: 'Ortschaften/Tag',
      thresholds: { z0: 3, z1: 8, absFloor: 5 },
      plain: 'Zählt, in wie vielen verschiedenen Ortschaften pro Tag Raketen- oder Drohnenalarm ausgelöst wurde; viele Orte bedeuten einen breiten Angriff.',
      banalCauses: ['Fehlalarme in einer Region', 'ein einzelner Angriff, der viele Orte warnt'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_CSV, {
      fixture: 'oref-github/israel-alerts-tail.csv', headers: { range: `bytes=${RANGE_FROM}-` }, timeoutMs: 120_000,
    });
    const r = parseOref(text, ctx.now, { partial: true });
    ctx.log(`oref-github: letzter Alarmtag im Spiegel ${r.lastAlertDay ?? 'unbekannt'}`);
    const observations: Observation[] = [];
    for (const d of r.days) {
      observations.push(obs(SIG_WAVES, `${d.day}T00:00:00Z`, d.waves));
      observations.push(obs(SIG_PLACES, `${d.day}T00:00:00Z`, d.localities));
    }
    return { observations };
  },
};

export default collector;
