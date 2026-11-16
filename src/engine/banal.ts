// Known harmless explanations. A matching rule damps an anomaly and the reason is shown to the user.
// Rules are data (catalog/banal-rules.json) so that non-programmers can add them.

import type { BanalRule } from '../core/types.ts';

export function globMatch(pattern: string, id: string): boolean {
  const re = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(id);
}

function nthWeekdayOfMonth(d: Date): number {
  return Math.floor((d.getUTCDate() - 1) / 7) + 1;
}

export interface BanalContext {
  /** latest value of other signals, for signal-condition rules (e.g. geomagnetic storm) */
  latest(signalId: string): number | null;
}

/** Returns the strongest (lowest factor) matching rule for this signal at time t. */
export function banalDamp(
  rules: BanalRule[],
  signalId: string,
  t: number,
  ctx: BanalContext,
): { factor: number; reason: string } | null {
  const d = new Date(t);
  let best: { factor: number; reason: string } | null = null;
  for (const r of rules) {
    if (!r.appliesTo.some((p) => globMatch(p, signalId))) continue;
    let hit = false;
    const p = r.params as Record<string, any>;
    switch (r.type) {
      case 'date-range':
        hit = t >= Date.parse(p.from) && t <= Date.parse(p.to);
        break;
      case 'nth-weekday': {
        // e.g. Patch Tuesday: weekday 2, n 2, plus spillDays following days
        const spill = Number(p.spillDays ?? 0);
        for (let k = 0; k <= spill && !hit; k++) {
          const x = new Date(t - k * 86400_000);
          hit = x.getUTCDay() === Number(p.weekday) && nthWeekdayOfMonth(x) === Number(p.n);
        }
        break;
      }
      case 'weekday':
        hit = (p.days as number[]).includes(d.getUTCDay());
        break;
      case 'day-of-month':
        hit = (p.days as number[]).includes(d.getUTCDate());
        break;
      case 'signal-condition': {
        const v = ctx.latest(String(p.signal));
        hit = v !== null && (p.gte === undefined || v >= Number(p.gte)) && (p.lte === undefined || v <= Number(p.lte));
        break;
      }
    }
    if (hit && (!best || r.factor < best.factor)) best = { factor: r.factor, reason: r.reason };
  }
  return best;
}
