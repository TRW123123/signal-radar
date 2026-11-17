// Ukraine-Krieg: vom ukrainischen Generalstab veröffentlichte Angaben zu russischen Verlusten, als Tageswerte (Klasse C: Angabe einer Kriegspartei).
// WICHTIG: Es sind Selbstangaben einer Kriegspartei. Sie sind nicht unabhängig überprüfbar, Zählmethode und Veröffentlichung können
//   sich ändern. Das Signal misst nur den Verlauf der veröffentlichten Intensität, nicht die tatsächliche Lage. Gewicht deshalb höchstens 0,2.
// Quelle: GitHub-Datensatz PetroIvaniuk/2022-Ukraine-Russia-War-Dataset (strukturiert aus Angaben von Generalstab und Verteidigungsministerium der Ukraine),
//   Dateien data/russia_losses_personnel.json (ca. 210 kB) und data/russia_losses_equipment.json (ca. 750 kB), kumulative Zähler je Tag seit 2022-02-24.
// https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset  Kein Key.
// Lizenz: unklar (im Repo ist eine LICENSE-Datei vorhanden, Inhalt nicht geprüft).
// Aufbau: Liste je Tag { date: "JJJJ-MM-TT", day, personnel, ... } bzw. { date, ..., drone, "cruise missiles", ... }; Zähler wachsen monoton.
// Gemessen (Differenz des kumulativen Zählers zum Vortag; nur bei unmittelbar aufeinanderfolgenden Datumseinträgen; letzte 90 Tage, Tage ab heute entfallen):
//   war.conflict.ua_losses_reported: Zuwachs der gemeldeten Personalverluste je Tag (üblich ca. 800 bis 1 500, aktuell ca. 1 700 bis 2 500).
//   war.conflict.ukraine_drone_missile_daily: Zuwachs der gemeldeten Drohnen plus Marschflugkörper je Tag.
// Aktualität: Letzter Eintrag 16.11.2026 (Tag 1727). Ist der letzte Eintrag älter als 4 Tage, wird ein Fehler geworfen.
// Harmlose Ursachen für Ausschläge: Nachmeldungen und Sammelkorrekturen, geänderte Zählkategorien (z. B. Drohnen), Pausen mit späterer Nachlieferung,
//   Wochenend- und Feiertagsrhythmus der Veröffentlichung.
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const BASE = 'https://raw.githubusercontent.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset/main/data/';
const WINDOW_DAYS = 90;
const MAX_AGE_DAYS = 4;
const SIG_PERS = 'war.conflict.ua_losses_reported';
const SIG_DRONE = 'war.conflict.ukraine_drone_missile_daily';

export interface DayValue { day: string; value: number }

/** Tageszuwachs eines kumulativen Zählers. `fields`: Summe dieser Felder; Einträge ohne alle Felder oder mit Datumslücke ergeben keine Differenz. */
export function dailyIncrease(body: unknown, fields: string[], now: Date): DayValue[] {
  const list = expect(Array.isArray(body) ? (body as Record<string, unknown>[]) : null, 'Liste der Tageseinträge');
  const byDay = new Map<string, number>();
  for (const e of list) {
    const day = typeof e?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
    if (!day) continue;
    let sum = 0;
    let ok = true;
    for (const f of fields) {
      const v = num(e[f]);
      if (v === null) { ok = false; break; }
      sum += v;
    }
    if (ok) byDay.set(day, sum);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return [];
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);
  if (now.getTime() - last > MAX_AGE_DAYS * DAY_MS) throw new Error(`Datensatz veraltet: letzter Eintrag ${days[days.length - 1]}`);
  const from = isoDay(daysAgo(now, WINDOW_DAYS));
  const today = isoDay(now);
  const out: DayValue[] = [];
  for (const day of days) {
    if (day < from || day >= today) continue;
    const prev = isoDay(new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS));
    const a = byDay.get(prev);
    const b = byDay.get(day)!;
    if (a === undefined || b < a) continue; // Lücke oder rückläufiger Zähler (Korrektur): keine Differenz
    out.push({ day, value: b - a });
  }
  return out;
}

const common = {
  scenarios: ['war'], domain: 'conflict', evidenceClass: 'C' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'high' as const, independenceGroup: 'github-ukraine-losses', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  thresholds: { z0: 3, z1: 8, relFloor: 0.2 },
  sourceName: 'PetroIvaniuk/2022-Ukraine-Russia-War-Dataset (GitHub), Angaben des ukrainischen Generalstabs',
  sourceUrl: 'https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset',
  license: 'unklar (LICENSE-Datei nicht geprüft)',
};

const collector: Collector = {
  id: 'github-ukraine-losses',
  title: 'Ukraine-Krieg: Verlustangaben des ukrainischen Generalstabs (GitHub-Spiegel)',
  sourceUrl: 'https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_PERS, weight: 0.15, unit: 'Personen/Tag',
      name: 'Ukraine: vom Generalstab gemeldete russische Personalverluste pro Tag (Angabe einer Kriegspartei)',
      plain: 'Tageszahl der russischen Personalverluste, wie sie der ukrainische Generalstab meldet; Angabe einer Kriegspartei, nicht unabhängig überprüfbar, zeigt nur die veröffentlichte Intensität.',
      banalCauses: ['Nachmeldungen und Sammelkorrekturen', 'Änderung der Zählmethode', 'Veröffentlichungspausen mit späterer Nachlieferung'],
    },
    {
      ...common, id: SIG_DRONE, weight: 0.2, unit: 'Drohnen und Marschflugkörper/Tag',
      name: 'Ukraine: vom Generalstab gemeldete abgeschossene Drohnen und Marschflugkörper pro Tag (Angabe einer Kriegspartei)',
      plain: 'Tageszahl der laut ukrainischem Generalstab abgeschossenen Drohnen und Marschflugkörper; Angabe einer Kriegspartei, nicht unabhängig überprüfbar.',
      banalCauses: ['Nachmeldungen', 'Änderung der Zählkategorien für Drohnen', 'Veröffentlichungspausen'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    let ok = 0;
    try {
      const body = await ctx.http.json<unknown>(`${BASE}russia_losses_personnel.json`, { fixture: 'ukraine-losses/russia_losses_personnel.json', timeoutMs: 60_000 });
      for (const d of dailyIncrease(body, ['personnel'], ctx.now)) observations.push(obs(SIG_PERS, `${d.day}T00:00:00Z`, d.value));
      ok++;
    } catch (e) {
      ctx.log(`Personalverluste übersprungen: ${(e as Error).message}`);
    }
    try {
      const body = await ctx.http.json<unknown>(`${BASE}russia_losses_equipment.json`, { fixture: 'ukraine-losses/russia_losses_equipment.json', timeoutMs: 60_000 });
      for (const d of dailyIncrease(body, ['drone', 'cruise missiles'], ctx.now)) observations.push(obs(SIG_DRONE, `${d.day}T00:00:00Z`, d.value));
      ok++;
    } catch (e) {
      ctx.log(`Drohnen und Marschflugkörper übersprungen: ${(e as Error).message}`);
    }
    if (ok === 0) throw new Error('keine der beiden Dateien lesbar');
    return { observations };
  },
};

export default collector;
