// Loads the declarative catalog: scenarios, signal definitions, banal rules.
// The catalog is data, not code, so that it can be reviewed and extended without programming.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { BanalRule, ScenarioDef, SignalDef, UpstreamRule } from './types.ts';
import { globMatch } from '../engine/banal.ts';

export interface Catalog {
  scenarios: ScenarioDef[];
  signals: SignalDef[];
  rules: BanalRule[];
  upstreams: UpstreamRule[];
}

/** Assigns the shared upstream from catalog/upstreams.json to every matching signal. */
export function applyUpstreams(signals: SignalDef[], upstreams: UpstreamRule[]): SignalDef[] {
  return signals.map((s) => {
    const u = upstreams.find((r) => r.appliesTo.some((p) => globMatch(p, s.id)));
    return u ? { ...s, upstream: u.id } : s;
  });
}

const DEFAULT_BASELINE = { method: 'rolling', windowDays: 28, minPoints: 14 } as const;

export function normalizeSignal(raw: Partial<SignalDef> & { id: string }): SignalDef {
  return {
    scenarios: raw.scenarios ?? [raw.id.split('.')[0]],
    domain: raw.domain ?? raw.id.split('.')[1] ?? 'misc',
    name: raw.name ?? raw.id,
    plain: raw.plain ?? '',
    evidenceClass: raw.evidenceClass ?? 'A',
    direction: raw.direction ?? 'up',
    kind: raw.kind ?? 'gauge',
    weight: raw.weight ?? 0.5,
    manipulability: raw.manipulability ?? 'medium',
    independenceGroup: raw.independenceGroup ?? raw.collector ?? raw.id,
    collector: raw.collector ?? '',
    baseline: { ...DEFAULT_BASELINE, ...(raw.baseline ?? {}) },
    intervalMinutes: raw.intervalMinutes ?? 60,
    status: raw.status ?? 'planned',
    sourceName: raw.sourceName ?? '',
    sourceUrl: raw.sourceUrl ?? '',
    ...raw,
  } as SignalDef;
}

export function loadCatalog(root: string): Catalog {
  const dir = join(root, 'catalog');
  const scenarios = JSON.parse(readFileSync(join(dir, 'scenarios.json'), 'utf8')) as ScenarioDef[];
  const signals: SignalDef[] = [];
  const sigDir = join(dir, 'signals');
  for (const f of readdirSync(sigDir).filter((x) => x.endsWith('.json')).sort()) {
    const arr = JSON.parse(readFileSync(join(sigDir, f), 'utf8')) as (Partial<SignalDef> & { id: string })[];
    for (const raw of arr) signals.push(normalizeSignal(raw));
  }
  const seen = new Set<string>();
  for (const s of signals) {
    if (seen.has(s.id)) throw new Error(`duplicate signal id in catalog: ${s.id}`);
    seen.add(s.id);
  }
  const rulesFile = join(dir, 'banal-rules.json');
  const rules = existsSync(rulesFile) ? (JSON.parse(readFileSync(rulesFile, 'utf8')) as BanalRule[]) : [];
  const upFile = join(dir, 'upstreams.json');
  const upstreams = existsSync(upFile) ? (JSON.parse(readFileSync(upFile, 'utf8')) as UpstreamRule[]) : [];
  return { scenarios: scenarios.sort((a, b) => a.order - b.order), signals, rules, upstreams };
}
