// History adapters: read the per-event fixtures (fixtures/backtest/<event>/) directly with the collectors' own
// parsers, without the collectors' look-back cut.
//
// Why: the live collectors keep only a short window per run (OONI 30 days, Yahoo 35 days, RIPEstat 20 days) and
// meanwhile ask for fixture names that carry the window (`-30d.json`, `-1mo-1d.json`, `-20d.json`). The history
// queue fetched longer windows under the older names. Running the collectors once at the anchor time therefore
// either finds no file or throws away most of the history the baselines need. Here the same parse functions are
// applied to the whole file; only days before the anchor day are kept (the anchor is the capture time of the replay).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Observation } from '../core/types.ts';
import * as ooni from '../collectors/ooni.ts';
import * as yahoo from '../collectors/yahoo-chart.ts';
import { parseCountryStats } from '../collectors/ripe-stat.ts';
import { DAY } from './lib.ts';

/** collectors whose fixtures are read here instead of running the collector */
export const ADAPTED_COLLECTORS = ['ooni', 'yahoo-chart', 'ripe-stat'];

export interface AdapterReport { id: string; files: string[]; observations: number; notes: string[] }

const dayIso = (t: number) => new Date(t).toISOString().slice(0, 10);

function readJson(dir: string, name: string): unknown | null {
  const f = join(dir, name);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** All observations the adapted collectors can derive from the event directory, strictly before the anchor day. */
export function historyObservations(evDir: string, anchor: Date): { observations: Observation[]; reports: AdapterReport[] } {
  const cut = dayIso(Math.floor(anchor.getTime() / DAY) * DAY);
  const out: Observation[] = [];
  const reports: AdapterReport[] = [];
  const push = (o: Observation) => { if (o.ts.slice(0, 10) < cut) out.push(o); };

  // OONI: one file per country, older name ooni/web-connectivity-<cc>-daily.json
  {
    const rep: AdapterReport = { id: 'ooni', files: [], observations: 0, notes: [] };
    const n0 = out.length;
    for (const cc of [...new Set(ooni.COUNTRIES.map((c) => c.cc))]) {
      const name = `ooni/web-connectivity-${cc.toLowerCase()}-daily.json`;
      const body = readJson(evDir, name);
      if (!body) continue;
      rep.files.push(name);
      const days = ooni.parse(body as Parameters<typeof ooni.parse>[0]);
      for (const c of ooni.COUNTRIES.filter((x) => x.cc === cc)) {
        for (const [day, v] of [...days.entries()].sort()) {
          if (v.n < ooni.MIN_MEASUREMENTS) continue;
          push({ signalId: c.signalId, ts: `${day}T00:00:00Z`, value: v.share, meta: { measurements: v.n } });
        }
      }
    }
    rep.observations = out.length - n0;
    reports.push(rep);
  }

  // Yahoo: older name yahoo/<SYM>-6mo-1d.json (fetched with period1/period2 around the event)
  {
    const rep: AdapterReport = { id: 'yahoo-chart', files: [], observations: 0, notes: [] };
    const n0 = out.length;
    const candles = new Map<string, yahoo.Candle[]>();
    for (const sym of [...new Set(yahoo.SPECS.flatMap((s) => s.symbols))]) {
      const name = `yahoo/${sym.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}-6mo-1d.json`;
      const body = readJson(evDir, name);
      if (!body) continue;
      rep.files.push(name);
      try {
        candles.set(sym, yahoo.parse(body as Parameters<typeof yahoo.parse>[0]));
      } catch (e) {
        rep.notes.push(`${sym}: ${(e as Error).message}`);
      }
    }
    for (const s of yahoo.SPECS) {
      const cs = s.symbols.map((x) => candles.get(x));
      if (cs.some((c) => !c)) continue;
      for (const [day, v] of yahoo.compute(s.metric, cs as yahoo.Candle[][])) push({ signalId: s.signalId, ts: `${day}T00:00:00Z`, value: v });
    }
    rep.observations = out.length - n0;
    reports.push(rep);
  }

  // RIPEstat country-routing-stats: older name ripe-stat/country-routing-stats-DE.json (66 days)
  {
    const rep: AdapterReport = { id: 'ripe-stat', files: [], observations: 0, notes: [] };
    const n0 = out.length;
    const name = 'ripe-stat/country-routing-stats-DE.json';
    const body = readJson(evDir, name);
    if (body) {
      rep.files.push(name);
      for (const p of parseCountryStats(body)) {
        if (p.ts === null) continue;
        push({ signalId: 'cyber.routing.country_prefix_visibility_de', ts: new Date(p.ts).toISOString(), value: p.value });
      }
    }
    rep.observations = out.length - n0;
    reports.push(rep);
  }
  return { observations: out, reports };
}

/**
 * Datasets that did not exist before a date. Their collectors still compute (zero) values for earlier days from
 * today's file; in a history run those zeros would look like real data, so they are dropped.
 */
export const SOURCE_SINCE: Record<string, string> = {
  'cisa-kev': '2021-11-03T00:00:00Z',
};
