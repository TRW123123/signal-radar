// Robust statistics helpers. No dependencies.

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** median absolute deviation, scaled to be comparable to a standard deviation for normal data */
export function mad(xs: number[], center = median(xs)): number {
  if (xs.length === 0) return NaN;
  return 1.4826 * median(xs.map((x) => Math.abs(x - center)));
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** smooth 0..1 ramp between a and b */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** noisy-OR: probability-style combination, never exceeds 1, order independent */
export function noisyOr(ps: number[]): number {
  let q = 1;
  for (const p of ps) q *= 1 - clamp01(p);
  return 1 - q;
}

export function round(x: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

/** linear-interpolated quantile, q in 0..1 */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
