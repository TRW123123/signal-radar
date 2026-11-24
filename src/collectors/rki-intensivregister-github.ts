// Intensivstationen Deutschland: DIVI-Intensivregister, vom RKI als Tagesdatei gespiegelt (Klasse B: verpflichtende Meldungen der Kliniken).
// Quelle: GitHub-Repo robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland, Datei Intensivregister_Deutschland_Kapazitaeten.csv
// (ca. 0,7 MB, seit 2020-03, täglich fortgeschrieben). Daten des DIVI-Intensivregisters, bereitgestellt vom Robert Koch-Institut.
// https://github.com/robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland
// Lizenz: im Repo nicht ausdrücklich geprüft (RKI-Daten, Quellenangabe in der Regel CC BY 4.0; unklar). Quelle immer nennen: Robert Koch-Institut / DIVI-Intensivregister. Kein Key.
// Aufbau: Komma-getrennt, Kopf u. a. `datum,bundesland_id,bundesland_name,behandlungsgruppe,behandlungsgruppe_level_2,anzahl_meldebereiche,faelle_covid_aktuell,...,
//   intensivbetten_belegt,intensivbetten_frei,...,kapazitaeten_frei_invasive_beatmung_gesamt,...`; je Tag drei Zeilen (ERWACHSENE, NICU, PICU); fehlende Werte als `NA`.
// Abruf: nur das Dateiende per Range-Header (ab Byte 650 000, rund 240 Tage; Suffix-Range liefert bei GitHub raw HTTP 501). Die erste Zeile ist angeschnitten
//   und wird verworfen, ebenso der früheste (womöglich unvollständige) Tag. Spaltennamen fest im Code.
// Gemeldet (Zeitstempel = Tag 00:00 UTC, letzte 120 Tage mit allen drei Behandlungsgruppen):
//   bio.clinical.icu_picu: Auslastung der Kinderintensivbetten (PICU) = belegt / (belegt + frei) in Prozent,
//   bio.clinical.icu_covid_current: COVID-19-Patienten auf Intensivstation (Erwachsene + NICU + PICU),
//   bio.clinical.icu_free_vent: freie invasive Beatmungsplätze (Erwachsene + NICU + PICU), fällt der Wert, ist die Lage kritisch (direction down).
//   Keine Saisonverhältnis-Reihe: Tagesreihe mit Wochentags-Baseline (56 Tage) laut Katalog.
// Harmlose Ursachen für Ausschläge: RSV-Saison bei PICU, Personalausfälle und Meldelücken einzelner Kliniken, Wochenenden und Feiertage, Meldeverzug.
// VERIFIED: ja (24.11.2026, echte Antwort: letzter Tag 2026-11-23)

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs, parseCsv } from './_helpers.ts';
import { dropPartialFirstLine, GEO_DE, RKI_LICENSE } from './_rki-weekly.ts';

const URL_CSV = 'https://raw.githubusercontent.com/robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland/main/Intensivregister_Deutschland_Kapazitaeten.csv';
const RANGE = 'bytes=650000-';
const DAYS = 120;
const SRC = {
  sourceName: 'DIVI-Intensivregister (RKI, GitHub)',
  sourceUrl: 'https://github.com/robert-koch-institut/Intensivkapazitaeten_und_COVID-19-Intensivbettenbelegung_in_Deutschland',
};
const SIG_PICU = 'bio.clinical.icu_picu';
const SIG_COVID = 'bio.clinical.icu_covid_current';
const SIG_VENT = 'bio.clinical.icu_free_vent';

export interface IcuDay { day: string; picuPct: number | null; covid: number | null; freeVent: number | null }
export interface IcuResult { days: IcuDay[]; lastDay: string | null }

export function parseIcu(text: string, opts: { partial?: boolean } = {}): IcuResult {
  let body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  if (opts.partial) body = dropPartialFirstLine(body);
  const rows = parseCsv(body);
  const head = rows[0];
  let start = 0;
  let iDay = 0, iGrp = 4, iCovid = 6, iOcc = 8, iFree = 9, iVent = 11;
  if (head && head[0] === 'datum') {
    iDay = head.indexOf('datum'); iGrp = head.indexOf('behandlungsgruppe_level_2'); iCovid = head.indexOf('faelle_covid_aktuell');
    iOcc = head.indexOf('intensivbetten_belegt'); iFree = head.indexOf('intensivbetten_frei'); iVent = head.indexOf('kapazitaeten_frei_invasive_beatmung_gesamt');
    if ([iDay, iGrp, iCovid, iOcc, iFree, iVent].some((i) => i < 0)) throw new Error('unerwartete Antwort: Spalten des Intensivregisters fehlen');
    start = 1;
  }
  const byDay = new Map<string, Map<string, string[]>>();
  for (const r of rows.slice(start)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r[iDay] ?? '')) continue;
    if (!byDay.has(r[iDay])) byDay.set(r[iDay], new Map());
    byDay.get(r[iDay])!.set(r[iGrp], r);
  }
  const keys = [...byDay.keys()].sort();
  if (opts.partial) keys.shift(); // frühester Tag im Abschnitt kann unvollständig sein
  const days: IcuDay[] = [];
  for (const day of keys) {
    const g = byDay.get(day)!;
    const groups = ['ERWACHSENE', 'NICU', 'PICU'].map((k) => g.get(k));
    if (groups.some((x) => !x)) continue; // unvollständiger Tag
    const sum = (i: number): number | null => {
      const vals = groups.map((x) => num(x![i]));
      return vals.some((v) => v === null) ? null : vals.reduce((a, b) => a! + b!, 0);
    };
    const occ = num(g.get('PICU')![iOcc]);
    const free = num(g.get('PICU')![iFree]);
    days.push({
      day, picuPct: occ !== null && free !== null && occ + free > 0 ? Math.round((occ / (occ + free)) * 1000) / 10 : null,
      covid: sum(iCovid), freeVent: sum(iVent),
    });
  }
  return { days, lastDay: days.length ? days[days.length - 1].day : null };
}

const base = {
  scenarios: ['bio'], domain: 'clinical', evidenceClass: 'B' as const, manipulability: 'low' as const, independenceGroup: 'rki-intensivregister-github',
  intervalMinutes: 1440, maxAgeHours: 96, holdHours: 72, baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  geo: GEO_DE, license: RKI_LICENSE + '; Lizenz im Repo nicht ausdrücklich geprüft', ...SRC,
};

const collector: Collector = {
  id: 'rki-intensivregister-github',
  title: 'DIVI-Intensivregister (RKI, GitHub)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 1440,
  signals: [
    {
      ...base, id: SIG_PICU, kind: 'gauge', direction: 'up', weight: 0.55, unit: '% belegt', thresholds: { z0: 3, z1: 7, absFloor: 2 },
      name: 'Kinder-Intensivbetten belegt (PICU)', plain: 'Wie viel Prozent der Kinder-Intensivbetten sind belegt? Hohe Werte treten in der RSV-Saison im Winter auf.',
      banalCauses: ['RSV-Saison', 'Personalmangel senkt die Zahl betreibbarer Betten', 'Meldelücken einzelner Kliniken'],
    },
    {
      ...base, id: SIG_COVID, kind: 'count', direction: 'up', weight: 0.5, unit: 'Patienten', thresholds: { z0: 3, z1: 7, relFloor: 0.1, absFloor: 5 },
      name: 'Intensivstationen: Corona-Patienten aktuell', plain: 'Wie viele Corona-Patienten liegen aktuell auf Intensivstationen in Deutschland?',
      banalCauses: ['Altersstruktur der Welle', 'Meldeverzug', 'Patienten mit Corona-Nachweis, die wegen etwas anderem behandelt werden'],
    },
    {
      ...base, id: SIG_VENT, kind: 'gauge', direction: 'down', weight: 0.5, unit: 'Plätze', thresholds: { z0: 3, z1: 7, relFloor: 0.05 },
      name: 'Intensivstationen: freie Beatmungsplätze', plain: 'Wie viele Beatmungsplätze sind auf Intensivstationen in Deutschland noch frei? Sinkt die Zahl stark, wird es eng.',
      banalCauses: ['Personalausfälle', 'Saison', 'Meldelücken einzelner Kliniken'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_CSV, { fixture: 'rki-intensivregister/Kapazitaeten-tail.csv', headers: { range: RANGE }, timeoutMs: 60_000 });
    const r = parseIcu(text, { partial: true });
    ctx.log(`rki-intensivregister-github: letzter Tag ${r.lastDay ?? 'unbekannt'}`);
    const observations: Observation[] = [];
    for (const d of r.days.slice(-DAYS)) {
      const ts = `${d.day}T00:00:00Z`;
      if (d.picuPct !== null) observations.push(obs(SIG_PICU, ts, d.picuPct));
      if (d.covid !== null) observations.push(obs(SIG_COVID, ts, d.covid));
      if (d.freeVent !== null) observations.push(obs(SIG_VENT, ts, d.freeVent));
    }
    return { observations };
  },
};

export default collector;
