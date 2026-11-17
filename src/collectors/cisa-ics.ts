// CISA ICS-Advisories: Zahl der Advisories pro Woche (Klasse C/B: amtliche Aussagen, nur schwaches Zählsignal).
// Quelle: https://raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/changes.csv
// Doku: https://github.com/cisagov/CSAF (CSAF-2.0-Verteilung, changes.csv: Pfad und Zeitstempel je Advisory)
// Lizenz: Public Domain (US-Regierung). Nur Zeitstempel werden gelesen, keine Inhalte.
// Gemessen: Zeilen je UTC-Woche (Montag 00:00) nach Zeitstempel der letzten Änderung. Das ist eine Aussage-Zählreihe,
//           keine Messung von Angriffen. Der Zeitstempel springt bei Revisionen: eine überarbeitete alte Advisory zählt
//           in der Woche der Überarbeitung. Unvollständige Wochen (älteste der Antwort, laufende) werden nicht gemeldet.
// Harmlose Ursachen: Veröffentlichungs-Rhythmus (meist Dienstag/Donnerstag), Feiertage, Sammelrevisionen, Hersteller-Patchtage.
// Hinweis zur Gewichtung: cyber.vuln.cisa_ics_advisories ist Klasse C (nur Kontext, wird nicht gewertet); das Signal
//           cyber.threat.ics_malware aus dem Katalog wird NICHT bedient (Advisories sind keine Malware-Berichte).
// VERIFIED: nein (changes.csv laut CSAF-Spezifikation: Zeilen "pfad,zeitstempel", neueste zuerst, ohne Kopfzeile;
//           Pfad csaf_files/OT/white/changes.csv nicht gegen eine echte Antwort geprüft).

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs, parseCsv } from './_helpers.ts';

const SIGNAL = 'cyber.vuln.cisa_ics_advisories';
const DAY = 86400_000;
const WEEK = 7 * DAY;
// 1970-01-01 war ein Donnerstag; der Montag davor liegt bei -3 Tagen
const MONDAY_OFFSET = 3 * DAY;

function weekStart(ms: number): number {
  return Math.floor((ms + MONDAY_OFFSET) / WEEK) * WEEK - MONDAY_OFFSET;
}

/** Zeitstempel (ms) aus der jeweils letzten Spalte, die wie ein ISO-Datum aussieht. */
export function parseTimestamps(body: string): number[] {
  const out: number[] = [];
  for (const row of parseCsv(body)) {
    const cell = [...row].reverse().map((c) => c.trim()).find((c) => /^\d{4}-\d{2}-\d{2}T/.test(c));
    if (!cell) continue;
    const t = Date.parse(cell);
    if (Number.isFinite(t)) out.push(t);
  }
  return out;
}

export function weeklyCounts(timestamps: number[], now: Date): Observation[] {
  if (timestamps.length < 2) return [];
  const first = weekStart(Math.min(...timestamps)) + WEEK; // älteste Woche unvollständig
  const last = weekStart(now.getTime()); // laufende Woche exklusiv
  const counts = new Map<number, number>();
  for (let w = first; w < last; w += WEEK) counts.set(w, 0);
  for (const t of timestamps) {
    const w = weekStart(t);
    if (counts.has(w)) counts.set(w, counts.get(w)! + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([w, n]) => obs(SIGNAL, w, n));
}

export function parse(body: string, now: Date): Observation[] {
  const ts = parseTimestamps(body);
  expect(ts.length > 0 ? ts : null, 'Zeilen mit Zeitstempel');
  return weeklyCounts(ts, now);
}

const collector: Collector = {
  id: 'cisa-ics',
  title: 'CISA ICS-Advisories (CSAF changes.csv)',
  sourceUrl: 'https://github.com/cisagov/CSAF',
  intervalMinutes: 1440,
  signals: [{
    id: SIGNAL, scenarios: ['cyber'], domain: 'vuln', name: 'ICS-Advisories pro Woche',
    plain: 'Wie viele neue oder überarbeitete Sicherheitshinweise die US-Behörde CISA pro Woche zu Industrie-Steuerungen veröffentlicht.',
    evidenceClass: 'C', direction: 'up', kind: 'count', weight: 0.25, manipulability: 'low',
    independenceGroup: 'cisa-ics', unit: 'Advisories/Woche', intervalMinutes: 10080, holdHours: 336,
    baseline: { method: 'rolling', windowDays: 365, minPoints: 26 },
    license: 'Public Domain (US-Regierung)',
  }],
  async collect(ctx) {
    const body = await ctx.http.text(
      'https://raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/changes.csv',
      { fixture: 'cisa-ics/changes.csv' });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
