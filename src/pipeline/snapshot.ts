// Turns stored series into the snapshot the frontend reads. Pure function of (catalog, store, now).

import type { Catalog } from '../core/catalog.ts';
import type { ContextItem, Observation, ScenarioView, SignalDef, Snapshot } from '../core/types.ts';
import type { Store } from '../core/store.ts';
import { scoreScenario } from '../engine/score.ts';

/** Turns a cumulative counter into "increase per hour". Counter resets (negative steps) are dropped. */
export function applyTransform(def: SignalDef, series: Observation[]): Observation[] {
  if (def.transform !== 'rate') return series;
  const sorted = [...series].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const out: Observation[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const hours = (Date.parse(sorted[i].ts) - Date.parse(sorted[i - 1].ts)) / 3600_000;
    const delta = sorted[i].value - sorted[i - 1].value;
    // gaps longer than a day would average an incident away; skip them
    if (hours > 0 && hours <= 24 && delta >= 0) out.push({ signalId: def.id, ts: sorted[i].ts, value: delta / hours });
  }
  return out;
}

export interface SnapshotOptions {
  now: Date;
  sensitivity: 'normal' | 'high';
  mode: Snapshot['mode'];
  note?: string;
  /** days of score history to recompute for the timeline (0 = only now) */
  historyDays?: number;
  /** step of the recomputed history in hours */
  historyStepHours?: number;
}

export async function buildSnapshot(catalog: Catalog, store: Store, opts: SnapshotOptions): Promise<Snapshot> {
  const series = new Map<string, Observation[]>();
  for (const s of catalog.signals) {
    if (s.status === 'active') series.set(s.id, applyTransform(s, await store.read(s.id)));
  }
  const context = (await store.getJson<ContextItem[]>('context')) ?? [];
  const now = opts.now.getTime();
  const scenarios: ScenarioView[] = [];
  for (const scenario of catalog.scenarios) {
    const base = { sensitivity: opts.sensitivity, scenario, signals: catalog.signals, series, rules: catalog.rules };
    const view = scoreScenario({ ...base, now, context });
    // Recompute the score at past points in time from the same raw data: the timeline is reproducible, not stored opinion.
    const history: ScenarioView['history'] = [];
    const point = (t: number, h: Omit<ScenarioView, 'history'>) => ({
      t: new Date(t).toISOString(), score: h.score, level: h.level, attention: h.attention, activeDomains: h.activeDomains,
      d: Object.fromEntries(h.domains.map((x) => [x.id, x.score])),
    });
    const days = opts.historyDays ?? 14;
    const step = (opts.historyStepHours ?? 3) * 3600_000;
    for (let t = now - days * 86400_000; t < now; t += step) {
      const h = scoreScenario({ ...base, now: t });
      if (h.coverage.fresh > 0) history.push(point(t, h));
    }
    history.push(point(now, view));
    scenarios.push({ ...view, history });
  }
  return { schema: 1, generatedAt: opts.now.toISOString(), mode: opts.mode, sensitivity: opts.sensitivity, note: opts.note, scenarios };
}
