// Runs collectors with bounded concurrency. One failing source never stops the others.

import type { CollectContext, Collector, ContextItem, HttpClient } from '../core/types.ts';
import type { Store } from '../core/store.ts';

export interface CollectReport {
  id: string;
  ok: boolean;
  skipped?: string;
  observations: number;
  added: number;
  ms: number;
  error?: string;
}

export interface CollectOptions {
  now: Date;
  http: HttpClient;
  env: Record<string, string | undefined>;
  concurrency?: number;
  /** only run collectors whose interval has elapsed since their last successful run */
  respectIntervals?: boolean;
  only?: string[];
  log?: (m: string) => void;
}

export async function runCollectors(collectors: Collector[], store: Store, opts: CollectOptions): Promise<CollectReport[]> {
  const log = opts.log ?? (() => {});
  const lastRun = (await store.getJson<Record<string, string>>('last-run')) ?? {};
  const queue = collectors.filter((c) => !opts.only || opts.only.includes(c.id));
  const reports: CollectReport[] = [];
  const newContext: ContextItem[] = [];
  let i = 0;

  async function worker(): Promise<void> {
    while (i < queue.length) {
      const c = queue[i++];
      const t0 = Date.now();
      if (c.needsKey && !opts.env[c.needsKey]) {
        reports.push({ id: c.id, ok: true, skipped: `kein Key (${c.needsKey})`, observations: 0, added: 0, ms: 0 });
        continue;
      }
      if (opts.respectIntervals && lastRun[c.id]) {
        const due = Date.parse(lastRun[c.id]) + c.intervalMinutes * 60_000 * 0.9;
        if (opts.now.getTime() < due) {
          reports.push({ id: c.id, ok: true, skipped: 'noch nicht fällig', observations: 0, added: 0, ms: 0 });
          continue;
        }
      }
      const ctx: CollectContext = { now: opts.now, http: opts.http, key: (n) => opts.env[n], log: (m) => log(`[${c.id}] ${m}`) };
      try {
        const res = await c.collect(ctx);
        const added = await store.append(res.observations);
        if (res.context?.length) newContext.push(...res.context);
        lastRun[c.id] = opts.now.toISOString();
        reports.push({ id: c.id, ok: true, observations: res.observations.length, added, ms: Date.now() - t0 });
      } catch (e) {
        reports.push({ id: c.id, ok: false, observations: 0, added: 0, ms: Date.now() - t0, error: String((e as Error).message ?? e).slice(0, 300) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 6) }, worker));

  await store.setJson('last-run', lastRun);
  if (newContext.length) {
    const old = (await store.getJson<ContextItem[]>('context')) ?? [];
    const seen = new Set<string>();
    const merged = [...newContext, ...old].filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
      .sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 200);
    await store.setJson('context', merged);
  }
  await store.setJson('last-report', { at: opts.now.toISOString(), reports });
  return reports.sort((a, b) => a.id.localeCompare(b.id));
}
