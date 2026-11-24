// Schwere Atemwegsinfekte im Krankenhaus (SARI) in Deutschland: RKI-Hospitalisierungsinzidenz (Klasse B: Sentinel-Kliniken, ICD-Kodierung).
// Quelle: GitHub-Repo robert-koch-institut/SARI-Hospitalisierungsinzidenz, Datei SARI-Hospitalisierungsinzidenz.tsv (ca. 0,2 MB, seit Saison 2014/15, wöchentlich fortgeschrieben).
// https://github.com/robert-koch-institut/SARI-Hospitalisierungsinzidenz  (Rohdatei: raw.githubusercontent.com/.../main/SARI-Hospitalisierungsinzidenz.tsv)
// Lizenz: CC BY 4.0. Quellenangabe: Robert Koch-Institut, SARI-Hospitalisierungsinzidenz. Kein Key.
// Aufbau: tab-getrennt, Kopf `Saison Kalenderwoche Altersgruppe SARI Hospitalisierungsinzidenz`; Kalenderwoche als ISO-Woche `2026-W46`;
//   `SARI` = Gesamt (alle SARI-Fälle), COVID-19, Influenza, RSV (die drei Erreger erst seit 2020); Altersgruppen 00+, 0-4, 5-14, 15-34, 35-59, 60-79, 80+;
//   Wert = Krankenhausfälle je 100.000 Einwohner. Die Datei ist klein und wird komplett geladen (Spaltennamen fest im Code).
// Gemeldet (Zeitstempel = Donnerstag der Kalenderwoche, 00:00 UTC; letzte 110 Wochen):
//   bio.clinical.sari_total (Gesamt, 00+) und bio.clinical.sari_kids (Gesamt, 0-4) als Rohreihen mit Gewicht 0,2, dazu je das Verhältnis zum Mittel derselben
//   Kalenderwochen der bis zu 3 Vorjahre (ohne 2020 und 2021; nur mit mindestens 2 Vorjahren) mit Katalog-Gewicht;
//   bio.clinical.sari_unexplained: Anteil der SARI-Fälle (00+), die weder COVID-19 noch Influenza noch RSV zugeordnet sind = (Gesamt - COVID-19 - Influenza - RSV) / Gesamt,
//   in Prozent (0 bis 100). Das ist der Rest nach den drei überwachten Erregern, kein Nachweis eines unbekannten Erregers; Rohreihe mit Gewicht 0,2 und Verhältnis zum Vorjahresmittel.
// Aktualität: Die Woche erscheint etwa eine Woche nach ihrem Ende (Stand 24.11.2026: 2026-W46); maxAgeHours 360.
// Harmlose Ursachen für Ausschläge: frühe oder späte Saison, Feiertagswochen, Nachmeldungen, Änderung der Kodierung (Rest-Anteil schwankt im Sommer, wenn die Fallzahlen klein sind).
// VERIFIED: ja (24.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, parseCsv } from './_helpers.ts';
import { isoWeekThursday, parseKw, ratioObservations, rawAndRatio, rawObservations, weeklyBase, type WeekPoint } from './_rki-weekly.ts';

const URL_TSV = 'https://raw.githubusercontent.com/robert-koch-institut/SARI-Hospitalisierungsinzidenz/main/SARI-Hospitalisierungsinzidenz.tsv';
const SRC = { sourceName: 'RKI SARI-Hospitalisierungsinzidenz (GitHub)', sourceUrl: 'https://github.com/robert-koch-institut/SARI-Hospitalisierungsinzidenz' };
const SIG_TOTAL = 'bio.clinical.sari_total';
const SIG_KIDS = 'bio.clinical.sari_kids';
const SIG_UNEXPL = 'bio.clinical.sari_unexplained';

export interface SariResult { total: WeekPoint[]; kids: WeekPoint[]; unexplained: WeekPoint[]; lastWeek: string | null }

export function parseSari(text: string): SariResult {
  const body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  const rows = parseCsv(body, '\t');
  const head = rows[0] ?? [];
  const iKw = head.indexOf('Kalenderwoche'), iAge = head.indexOf('Altersgruppe'), iSari = head.indexOf('SARI'), iVal = head.indexOf('Hospitalisierungsinzidenz');
  if ([iKw, iAge, iSari, iVal].some((i) => i < 0)) throw new Error('unerwartete Antwort: Spalten von SARI-Hospitalisierungsinzidenz fehlen');
  const total: WeekPoint[] = [];
  const kids: WeekPoint[] = [];
  const parts = new Map<string, { y: number; w: number; g?: number; c?: number; f?: number; r?: number }>();
  let lastWeek: string | null = null;
  for (const r of rows.slice(1)) {
    const k = parseKw(r[iKw]);
    const v = num(r[iVal]);
    if (!k || v === null || v < 0) continue;
    if (!lastWeek || r[iKw] > lastWeek) lastWeek = r[iKw];
    const ts = isoWeekThursday(k.year, k.week);
    const kind = r[iSari];
    if (kind === 'Gesamt' && r[iAge] === '00+') total.push({ year: k.year, week: k.week, ts, value: v });
    if (kind === 'Gesamt' && r[iAge] === '0-4') kids.push({ year: k.year, week: k.week, ts, value: v });
    if (r[iAge] === '00+') {
      const e = parts.get(r[iKw]) ?? { y: k.year, w: k.week };
      if (kind === 'Gesamt') e.g = v; else if (kind === 'COVID-19') e.c = v; else if (kind === 'Influenza') e.f = v; else if (kind === 'RSV') e.r = v;
      parts.set(r[iKw], e);
    }
  }
  const unexplained: WeekPoint[] = [];
  for (const e of parts.values()) {
    if (e.g === undefined || e.c === undefined || e.f === undefined || e.r === undefined || e.g <= 0) continue; // nur Wochen mit allen vier Angaben
    const share = Math.min(100, Math.max(0, ((e.g - e.c - e.f - e.r) / e.g) * 100));
    unexplained.push({ year: e.y, week: e.w, ts: isoWeekThursday(e.y, e.w), value: Math.round(share * 10) / 10 });
  }
  return { total, kids, unexplained, lastWeek };
}

const base = weeklyBase({ group: 'rki-sari-github', domain: 'clinical', evidenceClass: 'B', ...SRC });
const collector: Collector = {
  id: 'rki-sari-github',
  title: 'RKI SARI-Hospitalisierungsinzidenz (GitHub)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 10080,
  signals: [
    ...rawAndRatio(base, {
      id: SIG_TOTAL, name: 'Schwere Atemwegsinfekte im Krankenhaus (SARI)', unit: 'Fälle pro 100.000', catalogWeight: 0.7,
      plain: 'Wie viele von 100.000 Menschen kommen pro Woche mit einer schweren Atemwegsinfektion ins Krankenhaus? Die Rohreihe schwankt stark mit der Jahreszeit.',
      ratioName: 'Schwere Atemwegsinfekte im Krankenhaus im Vergleich zu den Vorjahren',
      ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegen die Krankenhausfälle mit schwerer Atemwegsinfektion? 1 heißt: üblich für die Jahreszeit.',
      banalCauses: ['frühe oder späte Grippe- oder Corona-Welle', 'Feiertagswochen', 'Nachmeldungen'],
    }),
    ...rawAndRatio(base, {
      id: SIG_KIDS, name: 'Schwere Atemwegsinfekte bei Kleinkindern (0 bis 4 Jahre)', unit: 'Fälle pro 100.000', catalogWeight: 0.5,
      plain: 'Wie viele von 100.000 Kindern unter 5 Jahren kommen pro Woche mit einer schweren Atemwegsinfektion ins Krankenhaus? Die Rohreihe schwankt stark mit der Jahreszeit.',
      ratioName: 'Schwere Atemwegsinfekte bei Kleinkindern im Vergleich zu den Vorjahren',
      ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegen die Krankenhausfälle von Kindern unter 5 Jahren? 1 heißt: üblich für die Jahreszeit.',
      banalCauses: ['RSV-Welle', 'frühe oder späte Saison'],
    }),
    ...rawAndRatio(base, {
      id: SIG_UNEXPL, name: 'Schwere Atemwegsinfekte ohne Corona, Grippe oder RSV', unit: '% der SARI-Fälle', catalogWeight: 0.85,
      plain: 'Welcher Teil der schweren Atemwegsinfekte im Krankenhaus lässt sich weder Corona noch Grippe noch RSV zuordnen? Das ist der Rest nach den drei überwachten Erregern, die Rohreihe schwankt mit der Jahreszeit.',
      ratioName: 'Anteil schwerer Atemwegsinfekte ohne Corona, Grippe oder RSV im Vergleich zu den Vorjahren',
      ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegt der Anteil der schweren Atemwegsinfekte, die keinem der drei überwachten Erreger zugeordnet sind? 1 heißt: üblich für die Jahreszeit.',
      banalCauses: ['andere Erreger wie Rhinoviren oder Mykoplasmen', 'kleine Fallzahlen im Sommer', 'Änderung der Kodierung'],
    }),
  ].map((s) => (s.id.startsWith(SIG_UNEXPL) ? { ...s, thresholds: { z0: 3, z1: 8, absFloor: s.id.endsWith("_saison") ? 0.03 : 2 } } : s)),
  async collect(ctx) {
    const text = await ctx.http.text(URL_TSV, { fixture: 'rki-sari/SARI-Hospitalisierungsinzidenz.tsv' });
    const r = parseSari(text);
    ctx.log(`rki-sari-github: letzte Woche ${r.lastWeek ?? 'unbekannt'}`);
    const observations: Observation[] = [];
    for (const [id, pts] of [[SIG_TOTAL, r.total], [SIG_KIDS, r.kids], [SIG_UNEXPL, r.unexplained]] as const) {
      observations.push(...rawObservations(id, pts), ...ratioObservations(`${id}_saison`, pts));
    }
    return { observations };
  },
};

export default collector;
