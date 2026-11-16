// Shared helpers for collectors. Collectors must stay small: fetch, parse defensively, return observations.

import type { Observation } from '../core/types.ts';

export const DAY_MS = 86400_000;

/** YYYYMMDD in UTC */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** YYYY-MM-DD in UTC */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}

/** start of the UTC hour / day containing d */
export function floorHour(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 3600_000) * 3600_000);
}
export function floorDay(d: Date): Date {
  return new Date(Math.floor(d.getTime() / DAY_MS) * DAY_MS);
}

export function obs(signalId: string, ts: Date | string | number, value: number, meta?: Record<string, unknown>): Observation {
  const t = ts instanceof Date ? ts : new Date(ts);
  return { signalId, ts: t.toISOString(), value, ...(meta ? { meta } : {}) };
}

/** Number() that returns null instead of NaN for missing or malformed input. */
export function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Throws a clear error when an API response does not have the expected shape (source changed or is down). */
export function expect<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`unerwartete Antwort: ${what} fehlt`);
  return value;
}

/** Minimal CSV parser (quoted fields, commas, CRLF). Returns rows of strings. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/** Count items per UTC day from a list of timestamps; returns one observation per day (complete days only if requested). */
export function countPerDay(signalId: string, timestamps: (string | number | Date)[], now: Date, opts: { days: number; includeToday?: boolean }): Observation[] {
  const counts = new Map<string, number>();
  for (let i = opts.includeToday ? 0 : 1; i <= opts.days; i++) counts.set(isoDay(daysAgo(now, i)), 0);
  for (const t of timestamps) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) continue;
    const k = isoDay(d);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return [...counts.entries()].sort().map(([day, n]) => obs(signalId, `${day}T00:00:00Z`, n));
}
