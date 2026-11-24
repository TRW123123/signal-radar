// Arztbesuche wegen akuter Atemwegserkrankungen (ARE) in Deutschland: RKI-Konsultationsinzidenz (Klasse B: Sentinel-Meldungen der Arztpraxen).
// Quelle: GitHub-Repo robert-koch-institut/ARE-Konsultationsinzidenz, Datei ARE-Konsultationsinzidenz.tsv (ca. 1 MB, seit Saison 2012/13, wöchentlich fortgeschrieben).
// https://github.com/robert-koch-institut/ARE-Konsultationsinzidenz  (Rohdatei: raw.githubusercontent.com/.../main/ARE-Konsultationsinzidenz.tsv)
// Lizenz: CC BY 4.0. Quellenangabe: Robert Koch-Institut, ARE-Konsultationsinzidenz. Kein Key.
// Aufbau: tab-getrennt, Kopf `Saison Kalenderwoche Bundesland Bundesland_ID Altersgruppe ARE_Konsultationsinzidenz`; Kalenderwoche als ISO-Woche `2026-W46`;
//   Zeilen je Woche für Bundesweit (ID 0) und die 16 Bundesländer, Altersgruppen 00+, 0-4, 5-14, 15-34, 35-59, 60+; Wert = Arztbesuche je 100.000 Einwohner.
// Abruf: nur das Dateiende per Range-Header (ab Byte 118 000, d. h. ab 2022-W20, rund 230 Wochen (die Bundesländer erscheinen erst ab 2022-W40; 3 Vorjahre Vorlauf brauchen die Daten ab 2022); Suffix-Range wie bytes=-N liefert HTTP 501); die erste Zeile ist angeschnitten und wird verworfen,
//   ebenso die früheste (womöglich unvollständige) Woche im Abschnitt. Spaltennamen fest im Code.
// Gemeldet (Zeitstempel = Donnerstag der Kalenderwoche, 00:00 UTC; letzte 110 Wochen):
//   bio.clinical.are_konsultation (Bundesweit, 00+) und bio.clinical.are_kids (0-4) als Rohreihen mit Gewicht 0,2,
//   dazu je das Verhältnis zum Mittel derselben Kalenderwochen der bis zu 3 Vorjahre (ohne 2020 und 2021; nur mit mindestens 2 Vorjahren) mit Katalog-Gewicht;
//   bio.clinical.are_bl_spread: Zahl der Bundesländer (0 bis 16), in denen die Rate über dem Mittel derselben Kalenderwochen der Vorjahre liegt
//   (nur Wochen, in denen alle 16 Länder ein Verhältnis haben).
// Aktualität: Die Woche wird etwa eine Woche nach ihrem Ende veröffentlicht (Stand 24.11.2026: 2026-W46); maxAgeHours 360.
// Harmlose Ursachen für Ausschläge: frühe oder späte Grippe- und RSV-Saison, Schulferien, Feiertagswochen (weniger Praxisbesuche), Nachmeldungen.
// VERIFIED: ja (24.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs, parseCsv } from './_helpers.ts';
import {
  dropPartialFirstLine, HISTORY_WEEKS, isoWeekThursday, parseKw, ratioObservations, rawAndRatio, rawObservations, seasonalRatios, weeklyBase, type WeekPoint,
} from './_rki-weekly.ts';

const URL_TSV = 'https://raw.githubusercontent.com/robert-koch-institut/ARE-Konsultationsinzidenz/main/ARE-Konsultationsinzidenz.tsv';
const RANGE = 'bytes=118000-'; // Dateiende ab Byte 118 000 (Beginn 2022) (Suffix-Range liefert bei GitHub raw HTTP 501)
const SRC = { sourceName: 'RKI ARE-Konsultationsinzidenz (GitHub)', sourceUrl: 'https://github.com/robert-koch-institut/ARE-Konsultationsinzidenz' };
const SIG_ALL = 'bio.clinical.are_konsultation';
const SIG_KIDS = 'bio.clinical.are_kids';
const SIG_SPREAD = 'bio.clinical.are_bl_spread';

export interface AreResult { all: WeekPoint[]; kids: WeekPoint[]; laender: Map<string, WeekPoint[]>; lastWeek: string | null }

export function parseAre(text: string, opts: { partial?: boolean } = {}): AreResult {
  let body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  if (opts.partial) body = dropPartialFirstLine(body);
  const rows = parseCsv(body, '\t');
  const head = rows[0];
  let start = 0;
  let iKw = 1, iBl = 2, iId = 3, iAge = 4, iVal = 5;
  if (head && head[0] === 'Saison') {
    iKw = head.indexOf('Kalenderwoche'); iBl = head.indexOf('Bundesland'); iId = head.indexOf('Bundesland_ID');
    iAge = head.indexOf('Altersgruppe'); iVal = head.indexOf('ARE_Konsultationsinzidenz');
    if ([iKw, iBl, iId, iAge, iVal].some((i) => i < 0)) throw new Error('unerwartete Antwort: Spalten von ARE-Konsultationsinzidenz fehlen');
    start = 1;
  }
  const all: WeekPoint[] = [];
  const kids: WeekPoint[] = [];
  const laender = new Map<string, WeekPoint[]>();
  let firstKw = '';
  let lastKw: string | null = null;
  const parsed: { kw: string; y: number; w: number; bl: string; id: string; age: string; v: number }[] = [];
  for (const r of rows.slice(start)) {
    const k = parseKw(r[iKw]);
    const v = num(r[iVal]);
    if (!k || v === null || v < 0) continue;
    const kw = r[iKw];
    if (!firstKw || kw < firstKw) firstKw = kw;
    if (!lastKw || kw > lastKw) lastKw = kw;
    parsed.push({ kw, y: k.year, w: k.week, bl: r[iBl], id: r[iId], age: r[iAge], v });
  }
  for (const p of parsed) {
    if (opts.partial && p.kw === firstKw) continue; // früheste Woche im Abschnitt kann unvollständig sein
    const pt: WeekPoint = { year: p.y, week: p.w, ts: isoWeekThursday(p.y, p.w), value: p.v };
    if (p.id === '0' && p.age === '00+') all.push(pt);
    else if (p.id === '0' && p.age === '0-4') kids.push(pt);
    else if (p.id !== '0' && p.age === '00+') { if (!laender.has(p.bl)) laender.set(p.bl, []); laender.get(p.bl)!.push(pt); }
  }
  return { all, kids, laender, lastWeek: lastKw };
}

/** Zahl der Bundesländer mit Verhältnis über 1 je Woche; nur Wochen mit Verhältnis in allen Ländern (mindestens 16 Länder in den Daten). */
export function spreadPerWeek(laender: Map<string, WeekPoint[]>): Map<number, number> {
  const out = new Map<number, number>();
  if (laender.size < 16) return out;
  const counts = new Map<number, { n: number; above: number }>();
  for (const pts of laender.values()) {
    for (const [ts, ratio] of seasonalRatios(pts)) {
      const c = counts.get(ts) ?? { n: 0, above: 0 };
      c.n += 1; if (ratio > 1) c.above += 1;
      counts.set(ts, c);
    }
  }
  for (const [ts, c] of counts) if (c.n === laender.size) out.set(ts, c.above);
  return out;
}

const base = weeklyBase({ group: 'rki-are-github', domain: 'clinical', evidenceClass: 'B', ...SRC });
const collector: Collector = {
  id: 'rki-are-github',
  title: 'RKI ARE-Konsultationsinzidenz (GitHub)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 10080,
  signals: [
    ...rawAndRatio(base, {
      id: SIG_ALL, name: 'Arztbesuche wegen Atemwegsinfekten', unit: 'Arztbesuche pro 100.000', catalogWeight: 0.6,
      plain: 'Wie viele von 100.000 Menschen gehen pro Woche wegen einer akuten Atemwegserkrankung zum Arzt? Die Rohreihe schwankt stark mit der Jahreszeit.',
      ratioName: 'Arztbesuche wegen Atemwegsinfekten im Vergleich zu den Vorjahren',
      ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegen die Arztbesuche wegen Atemwegsinfekten? 1 heißt: üblich für die Jahreszeit.',
      banalCauses: ['frühe oder späte Grippewelle', 'Schulferien', 'Feiertagswochen'],
    }),
    ...rawAndRatio(base, {
      id: SIG_KIDS, name: 'Arztbesuche Kleinkinder 0 bis 4 Jahre', unit: 'Arztbesuche pro 100.000', catalogWeight: 0.5,
      plain: 'Wie viele von 100.000 Kindern unter 5 Jahren gehen pro Woche wegen einer Atemwegserkrankung zum Arzt? Die Rohreihe schwankt stark mit der Jahreszeit.',
      ratioName: 'Arztbesuche Kleinkinder im Vergleich zu den Vorjahren',
      ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegen die Arztbesuche von Kindern unter 5 Jahren? 1 heißt: üblich für die Jahreszeit.',
      banalCauses: ['RSV-Welle', 'Schulferien und Kita-Schließzeiten'],
    }),
    {
      ...base, id: SIG_SPREAD, kind: 'count', unit: 'Bundesländer', weight: 0.55, thresholds: { z0: 2.5, z1: 6, absFloor: 1.5 }, holdHours: 240,
      name: 'Atemwegsinfekte: Zahl der Bundesländer über dem Vorjahresmittel',
      plain: 'In wie vielen der 16 Bundesländer liegen die Arztbesuche wegen Atemwegsinfekten über dem Mittel derselben Kalenderwochen der Vorjahre?',
      banalCauses: ['früher Saisonstart', 'Ferienzeiten, die in den Ländern versetzt liegen'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_TSV, { fixture: 'rki-are/ARE-Konsultationsinzidenz-tail.tsv', headers: { range: RANGE }, timeoutMs: 60_000 });
    const r = parseAre(text, { partial: true });
    ctx.log(`rki-are-github: letzte Woche ${r.lastWeek ?? 'unbekannt'}`);
    const observations: Observation[] = [
      ...rawObservations(SIG_ALL, r.all), ...ratioObservations(`${SIG_ALL}_saison`, r.all),
      ...rawObservations(SIG_KIDS, r.kids), ...ratioObservations(`${SIG_KIDS}_saison`, r.kids),
    ];
    const spread = spreadPerWeek(r.laender);
    const weeks = [...r.all].sort((a, b) => a.ts.getTime() - b.ts.getTime()).slice(-HISTORY_WEEKS);
    for (const p of weeks) { const n = spread.get(p.ts.getTime()); if (n !== undefined) observations.push(obs(SIG_SPREAD, p.ts, n)); }
    return { observations };
  },
};

export default collector;
