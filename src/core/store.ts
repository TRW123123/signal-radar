// Append-only time series store: one JSONL file per signal under data/series/.
// Plain files on purpose: every data point is auditable in git history ("git scraping"),
// anyone can fork the repository and re-run the scoring on the same raw data.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Observation } from './types.ts';

interface Line { t: string; v: number; m?: Record<string, unknown> }

/** Storage contract. The file store is the default; other backends (e.g. Netlify Blobs) implement the same interface. */
export interface Store {
  read(signalId: string): Promise<Observation[]>;
  append(observations: Observation[]): Promise<number>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown): Promise<void>;
}

/** Async wrapper around the synchronous file store. */
export function fileStore(dir: string): Store {
  const series = new SeriesStore(join(dir, 'series'));
  const kv = join(dir, 'state');
  mkdirSync(kv, { recursive: true });
  return {
    async read(id) { return series.read(id); },
    async append(obs) { return series.append(obs); },
    async getJson<T>(key: string) {
      const f = join(kv, key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json');
      return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
    },
    async setJson(key, value) {
      writeFileSync(join(kv, key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json'), JSON.stringify(value));
    },
  };
}

export class SeriesStore {
  dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  private file(signalId: string): string {
    return join(this.dir, signalId.replace(/[^a-zA-Z0-9._-]/g, '_') + '.jsonl');
  }

  read(signalId: string): Observation[] {
    const f = this.file(signalId);
    if (!existsSync(f)) return [];
    const out: Observation[] = [];
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const l = JSON.parse(line) as Line;
        if (typeof l.v === 'number' && Number.isFinite(l.v) && !Number.isNaN(Date.parse(l.t))) {
          out.push({ signalId, ts: l.t, value: l.v, meta: l.m });
        }
      } catch { /* skip corrupt line, never fail the whole run */ }
    }
    return out;
  }

  /** Appends new observations; an observation with an already stored timestamp is ignored. Returns number added. */
  append(observations: Observation[]): number {
    const byId = new Map<string, Observation[]>();
    for (const o of observations) {
      if (typeof o.value !== 'number' || !Number.isFinite(o.value)) continue;
      const t = Date.parse(o.ts);
      if (Number.isNaN(t)) continue;
      const norm = { ...o, ts: new Date(t).toISOString() };
      byId.set(o.signalId, [...(byId.get(o.signalId) ?? []), norm]);
    }
    let added = 0;
    for (const [id, obs] of byId) {
      const seen = new Set(this.read(id).map((o) => o.ts));
      const lines: string[] = [];
      for (const o of obs.sort((a, b) => a.ts.localeCompare(b.ts))) {
        if (seen.has(o.ts)) continue;
        seen.add(o.ts);
        const l: Line = { t: o.ts, v: o.value };
        if (o.meta && Object.keys(o.meta).length) l.m = o.meta;
        lines.push(JSON.stringify(l));
      }
      if (lines.length) {
        appendFileSync(this.file(id), lines.join('\n') + '\n');
        added += lines.length;
      }
    }
    return added;
  }

  ids(): string[] {
    return readdirSync(this.dir).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, -6));
  }

  /** Drop observations older than keepDays (history-bearing sources can always be re-fetched). */
  prune(signalId: string, keepDays: number, now = Date.now()): void {
    const keep = this.read(signalId).filter((o) => now - Date.parse(o.ts) <= keepDays * 86400_000);
    writeFileSync(this.file(signalId), keep.map((o) => JSON.stringify({ t: o.ts, v: o.value, ...(o.meta ? { m: o.meta } : {}) })).join('\n') + (keep.length ? '\n' : ''));
  }
}

/**
 * Prunes every stored series to `keepDays`, but never below what the signal's baseline needs (`minDays(id)`, e.g. its windowDays),
 * so a long baseline is not cut by a short retention. Returns the number of series that actually shrank.
 */
export function pruneAll(dir: string, keepDays: number, minDays: (signalId: string) => number = () => 0, now = Date.now()): number {
  const series = new SeriesStore(join(dir, 'series'));
  let changed = 0;
  for (const id of series.ids()) {
    const before = series.read(id).length;
    series.prune(id, Math.max(keepDays, minDays(id)), now);
    if (series.read(id).length < before) changed++;
  }
  return changed;
}
