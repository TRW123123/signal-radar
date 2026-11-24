// GrippeWeb: Selbstmeldung grippeähnlicher Erkrankungen (ILI) durch Teilnehmer aus der Bevölkerung, Wochenbericht des RKI (Klasse D: Selbstauskunft, keine Ärzte).
// Quelle: GitHub-Repo robert-koch-institut/GrippeWeb_Daten_des_Wochenberichts, Datei GrippeWeb_Daten_des_Wochenberichts.tsv (ca. 0,9 MB, seit 2011, wöchentlich fortgeschrieben).
// https://github.com/robert-koch-institut/GrippeWeb_Daten_des_Wochenberichts  (Rohdatei: raw.githubusercontent.com/.../main/GrippeWeb_Daten_des_Wochenberichts.tsv)
// Lizenz: CC BY 4.0. Quellenangabe: Robert Koch-Institut, GrippeWeb. Kein Key.
// Aufbau: tab-getrennt, Kopf `Meldungen Saison Erkrankung Altersgruppe Region Kalenderwoche Inzidenz`; Kalenderwoche als ISO-Woche `2026-W46`;
//   Erkrankung ARE (akute Atemwegserkrankung) oder ILI (grippeähnlich: Fieber plus Husten oder Halsschmerzen); Region Bundesweit und 4 Großregionen;
//   Inzidenz = Erkrankungen je 100.000 Einwohner (hochgerechnet aus den Meldungen der Teilnehmer, Spalte Meldungen = Zahl der Meldungen).
// Abruf: nur das Dateiende per Range-Header (ab Byte 600 000, d. h. ab 2022; Suffix-Range wie bytes=-N liefert bei GitHub raw HTTP 501). Die erste Zeile ist angeschnitten
//   und wird verworfen, ebenso die früheste (womöglich unvollständige) Woche im Abschnitt. Spaltennamen fest im Code.
// Gemeldet (Zeitstempel = Donnerstag der Kalenderwoche, 00:00 UTC; letzte 110 Wochen): bio.attention.grippeweb_ili (ILI, Bundesweit, 00+) als Rohreihe mit Gewicht 0,2
//   und das Verhältnis zum Mittel derselben Kalenderwochen der bis zu 3 Vorjahre (ohne 2020 und 2021; nur mit mindestens 2 Vorjahren) mit Katalog-Gewicht.
// Aktualität: Die Woche erscheint etwa eine Woche nach ihrem Ende (Stand 24.11.2026: 2026-W46); maxAgeHours 360.
// Harmlose Ursachen für Ausschläge: frühe oder späte Saison, Feiertags- und Ferienwochen (weniger Meldungen, Meldeverhalten), Nachmeldungen, Medienberichte, die mehr Teilnehmer zum Melden bringen.
// VERIFIED: ja (24.11.2026, echte Antwort)

import type { Collector } from '../core/types.ts';
import { expect, num, parseCsv } from './_helpers.ts';
import { dropPartialFirstLine, isoWeekThursday, parseKw, ratioObservations, rawAndRatio, rawObservations, weeklyBase, type WeekPoint } from './_rki-weekly.ts';

const URL_TSV = 'https://raw.githubusercontent.com/robert-koch-institut/GrippeWeb_Daten_des_Wochenberichts/main/GrippeWeb_Daten_des_Wochenberichts.tsv';
const RANGE = 'bytes=600000-';
const SRC = { sourceName: 'RKI GrippeWeb Wochenbericht (GitHub)', sourceUrl: 'https://github.com/robert-koch-institut/GrippeWeb_Daten_des_Wochenberichts' };
const SIG = 'bio.attention.grippeweb_ili';

export interface GrippeWebResult { ili: WeekPoint[]; lastWeek: string | null }

export function parseGrippeWeb(text: string, opts: { partial?: boolean } = {}): GrippeWebResult {
  let body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  if (opts.partial) body = dropPartialFirstLine(body);
  const rows = parseCsv(body, '\t');
  const head = rows[0];
  let start = 0;
  let iDis = 2, iAge = 3, iReg = 4, iKw = 5, iVal = 6;
  if (head && head[0] === 'Meldungen') {
    iDis = head.indexOf('Erkrankung'); iAge = head.indexOf('Altersgruppe'); iReg = head.indexOf('Region'); iKw = head.indexOf('Kalenderwoche'); iVal = head.indexOf('Inzidenz');
    if ([iDis, iAge, iReg, iKw, iVal].some((i) => i < 0)) throw new Error('unerwartete Antwort: Spalten von GrippeWeb fehlen');
    start = 1;
  }
  let firstKw = '';
  let lastWeek: string | null = null;
  const sel: { kw: string; y: number; w: number; v: number }[] = [];
  for (const r of rows.slice(start)) {
    const k = parseKw(r[iKw]);
    if (!k) continue;
    if (!firstKw || r[iKw] < firstKw) firstKw = r[iKw];
    if (r[iDis] !== 'ILI' || r[iReg] !== 'Bundesweit' || r[iAge] !== '00+') continue;
    const v = num(r[iVal]);
    if (v === null || v < 0) continue;
    if (!lastWeek || r[iKw] > lastWeek) lastWeek = r[iKw];
    sel.push({ kw: r[iKw], y: k.year, w: k.week, v });
  }
  const ili = sel.filter((p) => !(opts.partial && p.kw === firstKw)).map((p) => ({ year: p.y, week: p.w, ts: isoWeekThursday(p.y, p.w), value: p.v }));
  return { ili, lastWeek };
}

const base = weeklyBase({ group: 'rki-grippeweb-github', domain: 'attention', evidenceClass: 'D', ...SRC });
const collector: Collector = {
  id: 'rki-grippeweb-github',
  title: 'RKI GrippeWeb Wochenbericht (GitHub)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 10080,
  signals: rawAndRatio(base, {
    id: SIG, name: 'GrippeWeb: Selbstmeldung grippeähnlicher Erkrankungen', unit: 'Erkrankungen pro 100.000', catalogWeight: 0.5,
    plain: 'Wie viele von 100.000 Menschen melden in der Woche Fieber mit Husten oder Halsweh an das RKI-Portal GrippeWeb? Die Rohreihe schwankt stark mit der Jahreszeit.',
    ratioName: 'GrippeWeb: grippeähnliche Erkrankungen im Vergleich zu den Vorjahren',
    ratioPlain: 'Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegt die Selbstmeldung grippeähnlicher Erkrankungen? 1 heißt: üblich für die Jahreszeit.',
    banalCauses: ['frühe oder späte Grippewelle', 'Ferien und Feiertage (anderes Meldeverhalten)', 'Berichterstattung in den Medien'],
  }),
  async collect(ctx) {
    const text = await ctx.http.text(URL_TSV, { fixture: 'rki-grippeweb/GrippeWeb-tail.tsv', headers: { range: RANGE }, timeoutMs: 60_000 });
    const r = parseGrippeWeb(text, { partial: true });
    ctx.log(`rki-grippeweb-github: letzte Woche ${r.lastWeek ?? 'unbekannt'}`);
    return { observations: [...rawObservations(SIG, r.ili), ...ratioObservations(`${SIG}_saison`, r.ili)] };
  },
};

export default collector;
