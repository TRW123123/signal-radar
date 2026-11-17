// Helfer für die geteilten Collectors: setzt Signale und Requests aus allen Szenario-Konfigurationen (config/*.ts) zusammen.

import type { SignalDef } from '../core/types.ts';
import { SCENARIO_CONFIGS } from './config/index.ts';
import type { ScenarioCollectorConfig, SignalDecl } from './config/_types.ts';

export type { SignalDecl } from './config/_types.ts';

type ListKey = { [K in keyof ScenarioCollectorConfig]: ScenarioCollectorConfig[K] extends unknown[] ? K : never }[keyof ScenarioCollectorConfig];
export type EntryOf<K extends ListKey> = ScenarioCollectorConfig[K][number] & { scenario: string };

/** Alle Einträge einer Liste über alle Szenarien, in Reihenfolge der Konfigurationen, jeweils mit `scenario`. */
export function scenarioEntries<K extends ListKey>(key: K, configs: ScenarioCollectorConfig[] = SCENARIO_CONFIGS): EntryOf<K>[] {
  const out: EntryOf<K>[] = [];
  for (const c of configs) for (const e of c[key] as object[]) out.push({ ...(e as object), scenario: c.scenario } as EntryOf<K>);
  return out;
}

/** Signal-Deklaration mit Collector-Defaults; `scenarios` ist standardmäßig [scenario]. */
export function declare(defaults: Partial<SignalDef>, scenario: string, decl: SignalDecl): SignalDecl {
  return { ...defaults, scenarios: [scenario], ...decl };
}
