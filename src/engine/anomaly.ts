// Per-signal anomaly detection: every observation is judged against the signal's OWN history.
// Robust (median/MAD) so that past incidents inside the baseline window do not hide new ones.

import type { Observation, SignalDef } from '../core/types.ts';
import { clamp01, mad, median, quantile, smoothstep } from './stats.ts';

export interface Sensitivity {
  /** z where an anomaly starts to count */
  z0: number;
  /** z where it saturates at 1 */
  z1: number;
  /** z from which a signal is listed as "Auffälligkeit" even if it does not count yet */
  flagZ: number;
}

export const SENSITIVITY: Record<'normal' | 'high', Sensitivity> = {
  normal: { z0: 3.5, z1: 8, flagZ: 3 },
  // Owner decision 2026-11-16: start sensitive, collect many data points, distil later.
  high: { z0: 2.5, z1: 7, flagZ: 2 },
};

export interface Baseline {
  center: number;
  /** typical spread for upward deviations */
  scale: number;
  /** typical spread for downward deviations (skewed series differ per side) */
  scaleDown: number;
  n: number;
  mature: boolean;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function bucket(method: SignalDef['baseline']['method'], t: number): number {
  const d = new Date(t);
  if (method === 'hour-of-week') return d.getUTCDay() * 24 + d.getUTCHours();
  if (method === 'day-of-week') return d.getUTCDay();
  return 0;
}

/** Baseline for the observation at time t, built only from observations strictly before t. */
export function baselineAt(def: SignalDef, series: Observation[], t: number): Baseline | null {
  const spec = def.baseline;
  if (spec.method === 'fixed' && spec.fixed) {
    return { center: spec.fixed.center, scale: spec.fixed.scale, scaleDown: spec.fixed.scale, n: Infinity, mature: true };
  }
  const from = t - spec.windowDays * DAY;
  const window: { t: number; v: number }[] = [];
  for (const o of series) {
    const ot = Date.parse(o.ts);
    if (ot >= from && ot < t && Number.isFinite(o.value)) window.push({ t: ot, v: o.value });
  }
  let values = window.map((p) => p.v);
  if (spec.method === 'hour-of-week' || spec.method === 'day-of-week') {
    const b = bucket(spec.method, t);
    const seasonal = window.filter((p) => bucket(spec.method, p.t) === b).map((p) => p.v);
    // only trust the seasonal bucket when it has enough points on its own
    if (seasonal.length >= Math.max(4, Math.ceil(spec.minPoints / 4))) values = seasonal;
  }
  if (values.length < 3) return null;
  const center = median(values);
  let scale = mad(values, center);
  const th = def.thresholds ?? {};
  const relFloor = th.relFloor ?? 0.05;
  // variance floors: avoid division by ~0 for flat series, and respect Poisson noise for counts
  scale = Math.max(scale, Math.abs(center) * relFloor, th.absFloor ?? 0);
  if (def.kind === 'count') scale = Math.max(scale, Math.sqrt(Math.max(center, 1)));
  if (def.kind === 'binary') scale = Math.max(scale, 0.25);
  if (!(scale > 0)) scale = 1e-9;
  // Heavy-tailed series (bursty counts, batch publications) routinely exceed median + k*MAD.
  // The spread a series shows in its own top and bottom decile widens the scale per side, so that
  // "unusual" means: beyond what this series regularly does, not beyond what a bell curve would do.
  const tailBase = values.length >= 20 ? values : window.length >= 20 ? window.map((p) => p.v) : null;
  let scaleUp = scale;
  let scaleDown = scale;
  if (tailBase) {
    const c = tailBase === values ? center : median(tailBase);
    scaleUp = Math.max(scale, (quantile(tailBase, 0.9) - c) / 1.2816);
    scaleDown = Math.max(scale, (c - quantile(tailBase, 0.1)) / 1.2816);
  }
  return { center, scale: scaleUp, scaleDown, n: values.length, mature: values.length >= spec.minPoints };
}

export function directionalZ(def: SignalDef, value: number, b: Baseline): number {
  const d = value - b.center;
  const z = d >= 0 ? d / b.scale : d / b.scaleDown;
  if (def.direction === 'up') return Math.max(z, 0);
  if (def.direction === 'down') return Math.max(-z, 0);
  return Math.abs(z);
}

export interface AnomalyResult {
  /** latest observation */
  value: number | null;
  ts: string | null;
  baseline: Baseline | null;
  /** signed-by-direction z of the observation that currently drives the anomaly */
  z: number | null;
  /** 0..1, max over the hold window with linear decay */
  anomaly: number;
  /** z of the latest point reached the flag threshold */
  flagged: boolean;
  fresh: boolean;
}

/**
 * Evaluate a signal at time `now`. An anomalous observation keeps counting for `holdHours`
 * (decaying to half) so that a spike is not forgotten by the next quiet reading.
 */
export function evaluate(def: SignalDef, series: Observation[], now: number, sens: Sensitivity): AnomalyResult {
  const sorted = [...series].filter((o) => Date.parse(o.ts) <= now).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const last = sorted[sorted.length - 1];
  if (!last) return { value: null, ts: null, baseline: null, z: null, anomaly: 0, flagged: false, fresh: false };
  const lastT = Date.parse(last.ts);
  const fresh = now - lastT <= Math.max(def.intervalMinutes * 3, 60) * 60_000;
  const z0 = def.thresholds?.z0 ?? sens.z0;
  const z1 = def.thresholds?.z1 ?? sens.z1;
  const hold = (def.holdHours ?? Math.max(6, (def.intervalMinutes / 60) * 2)) * HOUR;

  let best = 0;
  let bestZ: number | null = null;
  let lastBaseline: Baseline | null = null;
  let lastZ: number | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const o = sorted[i];
    const t = Date.parse(o.ts);
    const age = now - t;
    if (age > hold && i !== sorted.length - 1) break;
    const b = baselineAt(def, sorted, t);
    if (i === sorted.length - 1) lastBaseline = b;
    if (!b) continue;
    const z = directionalZ(def, o.value, b);
    if (i === sorted.length - 1) lastZ = z;
    if (age > hold) continue;
    const decay = 1 - 0.5 * clamp01(age / hold);
    const a = smoothstep(z0, z1, z) * decay;
    if (a > best) {
      best = a;
      bestZ = z;
    }
  }
  return {
    value: last.value,
    ts: last.ts,
    baseline: lastBaseline,
    z: bestZ ?? lastZ,
    anomaly: fresh ? best : 0,
    flagged: fresh && lastZ !== null && lastZ >= sens.flagZ,
    fresh,
  };
}
