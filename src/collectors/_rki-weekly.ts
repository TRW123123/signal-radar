// Gemeinsame Helfer der Wochenreihen-Collectors des RKI und ECDC (Szenario bio): ISO-Kalenderwochen, Saisonverhältnis, Signal-Vorlagen.
// Keine eigene Quelle, kein Netzwerk.

import type { Collector, GeoRef, Observation } from '../core/types.ts';
import { DAY_MS, obs } from './_helpers.ts';

export const GEO_DE: GeoRef = { lat: 51.2, lon: 10.4, label: 'Deutschland', kind: 'country', cc: 'DE' };
export const GEO_EU: GeoRef = { lat: 50.8, lon: 4.4, label: 'EU/EWR', kind: 'region' };
/** Zahl der gemeldeten Wochen Historie je Reihe */
export const HISTORY_WEEKS = 110;
/** Meldeverzug der Wochenstatistiken: 15 Tage */
export const WEEKLY_MAX_AGE_HOURS = 360;
export const RKI_LICENSE = 'CC BY 4.0 (Robert Koch-Institut)';

export interface WeekPoint { year: number; week: number; ts: Date; value: number }

/** "2026-W46" -> { year, week }, sonst null. */
export function parseKw(kw: string | undefined): { year: number; week: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec((kw ?? '').trim());
  if (!m) return null;
  const week = Number(m[2]);
  return week >= 1 && week <= 53 ? { year: Number(m[1]), week } : null;
}

/** Donnerstag (UTC, 00:00) der ISO-Woche; er liegt immer in der Woche und im ISO-Jahr. */
export function isoWeekThursday(year: number, week: number): Date {
  const jan4 = Date.UTC(year, 0, 4);
  const dow = new Date(jan4).getUTCDay() || 7;
  const mondayWeek1 = jan4 - (dow - 1) * DAY_MS;
  return new Date(mondayWeek1 + ((week - 1) * 7 + 3) * DAY_MS);
}

/** ISO-Jahr und -Woche eines Datums. */
export function isoWeekOf(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return { year, week };
}

export interface SeasonalOpts {
  /** Vorjahre, die in den Mittelwert eingehen (die jüngsten zulässigen), Standard 3 */
  maxPrior?: number;
  /** Mindestzahl Vorjahre, sonst kein Wert, Standard 2 */
  minPrior?: number;
  /** Pandemiejahre ohne normale Atemwegssaison, Standard 2020 und 2021 */
  excludeYears?: number[];
}

/**
 * Verhältnis jedes Wochenwerts zum Mittel derselben Kalenderwoche der Vorjahre (die jüngsten bis zu `maxPrior`, ohne `excludeYears`).
 * Gibt nur Werte zurück, wenn mindestens `minPrior` Vorjahre einen Wert haben und der Mittelwert über 0 liegt.
 */
export function seasonalRatios(points: WeekPoint[], opts: SeasonalOpts = {}): Map<number, number> {
  const maxPrior = opts.maxPrior ?? 3;
  const minPrior = opts.minPrior ?? 2;
  const excl = new Set(opts.excludeYears ?? [2020, 2021]);
  const byKey = new Map<string, number>();
  for (const p of points) byKey.set(`${p.year}-${p.week}`, p.value);
  const lookup = (y: number, w: number): number | undefined => byKey.get(`${y}-${w}`) ?? (w === 53 ? byKey.get(`${y}-52`) : undefined);
  const out = new Map<number, number>();
  for (const p of points) {
    const prior: number[] = [];
    for (let y = p.year - 1; y >= p.year - 8 && prior.length < maxPrior; y--) {
      if (excl.has(y)) continue;
      const v = lookup(y, p.week);
      if (v !== undefined) prior.push(v);
    }
    if (prior.length < minPrior) continue;
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (mean > 0) out.set(p.ts.getTime(), p.value / mean);
  }
  return out;
}

/** Verhältnis-Observationen für die letzten `weeks` Wochen. */
export function ratioObservations(signalId: string, points: WeekPoint[], weeks = HISTORY_WEEKS, opts?: SeasonalOpts): Observation[] {
  const ratios = seasonalRatios(points, opts);
  const sorted = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime()).slice(-weeks);
  const out: Observation[] = [];
  for (const p of sorted) { const r = ratios.get(p.ts.getTime()); if (r !== undefined) out.push(obs(signalId, p.ts, Math.round(r * 1000) / 1000)); }
  return out;
}

export function rawObservations(signalId: string, points: WeekPoint[], weeks = HISTORY_WEEKS): Observation[] {
  return [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime()).slice(-weeks).map((p) => obs(signalId, p.ts, p.value));
}

/** Entfernt die erste (angeschnittene) Zeile eines Range-Abrufs vom Dateiende. */
export function dropPartialFirstLine(text: string): string {
  const nl = text.indexOf('\n');
  return nl >= 0 ? text.slice(nl + 1) : '';
}

/** Gemeinsame Felder einer Wochenreihe. */
export function weeklyBase(o: { group: string; domain: string; evidenceClass?: 'A' | 'B' | 'C' | 'D'; geo?: GeoRef; sourceName: string; sourceUrl: string; license?: string }) {
  return {
    scenarios: ['bio'], domain: o.domain, evidenceClass: o.evidenceClass ?? ('B' as const), direction: 'up' as const, kind: 'gauge' as const,
    manipulability: 'low' as const, independenceGroup: o.group, intervalMinutes: 10080, maxAgeHours: WEEKLY_MAX_AGE_HOURS,
    baseline: { method: 'rolling' as const, windowDays: 364, minPoints: 20 }, geo: o.geo ?? GEO_DE,
    sourceName: o.sourceName, sourceUrl: o.sourceUrl, license: o.license ?? RKI_LICENSE,
  };
}

/** Rohreihe (Gewicht 0,2) und zugehöriges Saisonverhältnis (Katalog-Gewicht) als zwei Signal-Deklarationen. */
export function rawAndRatio(base: ReturnType<typeof weeklyBase>, s: { id: string; name: string; plain: string; unit: string; catalogWeight: number; banalCauses: string[]; ratioName: string; ratioPlain: string }): Collector['signals'] {
  const raw = { ...base, id: s.id, name: s.name, plain: s.plain, unit: s.unit, weight: 0.2, thresholds: { z0: 3, z1: 7, relFloor: 0.1 }, holdHours: 240, banalCauses: s.banalCauses };
  const ratio = {
    ...base, id: `${s.id}_saison`, name: s.ratioName, plain: s.ratioPlain, unit: 'x Vorjahresmittel', weight: s.catalogWeight,
    thresholds: { z0: 2.5, z1: 6, absFloor: 0.1 }, holdHours: 240,
    banalCauses: [...s.banalCauses, 'frühere oder spätere Saison als in den Vorjahren'],
  };
  return [raw, ratio];
}
