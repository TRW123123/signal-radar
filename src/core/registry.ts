// Collector discovery and catalog activation.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Catalog } from './catalog.ts';
import { applyGeo, applyUpstreams, normalizeSignal } from './catalog.ts';
import type { Collector, SignalDef } from './types.ts';

/** Loads every src/collectors/*.ts that default-exports a Collector (files starting with _ are helpers). */
export async function discoverCollectors(root: string): Promise<Collector[]> {
  const dir = join(root, 'src', 'collectors');
  const out: Collector[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.startsWith('_')).sort()) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const c = mod.default as Collector | undefined;
    if (!c || typeof c.collect !== 'function' || !c.id) throw new Error(`collector file ${f} has no valid default export`);
    out.push(c);
  }
  const ids = new Set<string>();
  for (const c of out) {
    if (ids.has(c.id)) throw new Error(`duplicate collector id ${c.id}`);
    ids.add(c.id);
  }
  return out;
}

/**
 * Merges collector-declared signal definitions over the catalog and marks them active.
 * Signals whose collector needs a key that is not configured stay "needs-key".
 */
export function activate(catalog: Catalog, collectors: Collector[], env: Record<string, string | undefined>): Catalog {
  const byId = new Map<string, SignalDef>(catalog.signals.map((s) => [s.id, s]));
  for (const c of collectors) {
    const keys = ([] as string[]).concat(c.needsKey ?? []).filter(Boolean);
    const hasKey = keys.every((k) => Boolean(env[k]));
    for (const decl of c.signals) {
      const base = byId.get(decl.id);
      const merged = normalizeSignal({
        ...(base ?? {}),
        ...decl,
        collector: c.id,
        intervalMinutes: decl.intervalMinutes ?? base?.intervalMinutes ?? c.intervalMinutes,
        sourceUrl: decl.sourceUrl ?? base?.sourceUrl ?? c.sourceUrl,
        sourceName: decl.sourceName ?? base?.sourceName ?? c.title,
        status: hasKey ? 'active' : 'needs-key',
      });
      byId.set(decl.id, merged);
    }
  }
  return { ...catalog, signals: applyGeo(applyUpstreams([...byId.values()], catalog.upstreams ?? []), catalog.geo ?? []) };
}
