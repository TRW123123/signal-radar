// Helfer für Kartenschicht-Collector (layer-*): nicht gewertete Punkte, höchstens MAX_POINTS je Schicht.

import type { MapPoint } from '../core/types.ts';

export const MAX_POINTS = 300;

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function validCoord(lat: unknown, lon: unknown): boolean {
  return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** ISO string for a date-like value, or null when unparseable. */
export function isoOrNull(x: unknown): string | null {
  if (typeof x !== 'string' && typeof x !== 'number') return null;
  const ms = typeof x === 'number' ? x : Date.parse(x);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Strongest first (ties: newest first), at most MAX_POINTS. */
export function topPoints(points: MapPoint[]): MapPoint[] {
  return [...points].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0) || (b.t ?? '').localeCompare(a.t ?? '')).slice(0, MAX_POINTS);
}

/** Newest `t` of the points, else the fallback. */
export function newestTs(points: MapPoint[], fallback: Date): string {
  const ts = points.map((p) => p.t).filter((t): t is string => !!t).sort();
  return ts.length ? ts[ts.length - 1] : fallback.toISOString();
}
