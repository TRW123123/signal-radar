// Turns stored series into the snapshot the frontend reads. Pure function of (catalog, store, now).

import type { Catalog } from '../core/catalog.ts';
import type { ContextItem, Observation, ScenarioView, Snapshot } from '../core/types.ts';
import type { Store } from '../core/store.ts';
import { scoreScenario } from '../engine/score.ts';

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
    if (s.status === 'active') series.set(s.id, await store.read(s.id));
  }
  const context = (await store.getJson<ContextItem[]>('context')) ?? [];
  const now = opts.now.getTime();
  const scenarios: ScenarioView[] = [];
  for (const scenario of catalog.scenarios) {
    const base = { sensitivity: opts.sensitivity, scenario, signals: catalog.signals, series, rules: catalog.rules };
    const view = scoreScenario({ ...base, now, context });
    // Recompute the score at past points in time from the same raw data: the timeline is reproducible, not stored opinion.
    const history: ScenarioView['history'] = [];
    const days = opts.historyDays ?? 14;
    const step = (opts.historyStepHours ?? 6) * 3600_000;
    for (let t = now - days * 86400_000; t < now; t += step) {
      const h = scoreScenario({ ...base, now: t });
      if (h.coverage.fresh > 0) history.push({ t: new Date(t).toISOString(), score: h.score, attention: h.attention });
    }
    history.push({ t: opts.now.toISOString(), score: view.score, attention: view.attention });
    scenarios.push({ ...view, history });
  }
  return { schema: 1, generatedAt: opts.now.toISOString(), mode: opts.mode, sensitivity: opts.sensitivity, note: opts.note, scenarios };
}
