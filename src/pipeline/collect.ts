// Runs collectors with bounded concurrency. One failing source never stops the others.

import type { CollectContext, Collector, ContextItem, HttpClient, MapLayer } from '../core/types.ts';
import type { Store } from '../core/store.ts';
import { redactText } from '../core/http.ts';

/** Values of credential env vars (needsKey of any collector plus SR_*_KEY/_PASS/_USER/_TOKEN/_SECRET); never shown in reports. */
export function secretValues(env: Record<string, string | undefined>, collectors: Collector[] = []): string[] {
  const names = new Set(collectors.flatMap((c) => ([] as string[]).concat(c.needsKey ?? [])));
  for (const n of Object.keys(env)) if (/^SR_.*(KEY|PASS|PASSWORD|USER|TOKEN|SECRET)$/.test(n)) names.add(n);
  return [...names].map((n) => env[n]).filter((v): v is string => !!v);
}

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
  const secrets = secretValues(opts.env, collectors);
  const rawLog = opts.log ?? (() => {});
  const log = (m: string) => rawLog(redactText(m, secrets));
  const lastRun = (await store.getJson<Record<string, string>>('last-run')) ?? {};
  const queue = collectors.filter((c) => !opts.only || opts.only.includes(c.id));
  const reports: CollectReport[] = [];
  const newContext: ContextItem[] = [];
  const newLayers: MapLayer[] = [];
  let i = 0;

  async function worker(): Promise<void> {
    while (i < queue.length) {
      const c = queue[i++];
      const t0 = Date.now();
      const keys = ([] as string[]).concat(c.needsKey ?? []).filter(Boolean);
      if (keys.some((k) => !opts.env[k])) {
        reports.push({ id: c.id, ok: true, skipped: `kein Key (${keys.join(', ')})`, observations: 0, added: 0, ms: 0 });
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
        for (const layer of res.layers ?? []) {
          const points = layer.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180).slice(0, 400);
          newLayers.push({ ...layer, points });
        }
        lastRun[c.id] = opts.now.toISOString();
        reports.push({ id: c.id, ok: true, observations: res.observations.length, added, ms: Date.now() - t0 });
      } catch (e) {
        reports.push({ id: c.id, ok: false, observations: 0, added: 0, ms: Date.now() - t0, error: redactText(String((e as Error).message ?? e), secrets).slice(0, 300) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 6) }, worker));

  await store.setJson('last-run', lastRun);
  if (newLayers.length) {
    const all = (await store.getJson<Record<string, MapLayer>>('layers')) ?? {};
    for (const l of newLayers) all[l.id] = l;
    await store.setJson('layers', all);
  }
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
