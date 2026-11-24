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
import { hourlyMeans, parseSignals } from '../collectors/ioda.ts';
import { parse as parseWiki } from '../collectors/wikimedia-pageviews.ts';
import { parseOref } from '../collectors/oref-github.ts';
import { parseCsv } from '../collectors/_helpers.ts';
import type { SignalDef } from '../core/types.ts';
import type { BacktestEvent, Probe } from './lib.ts';

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

// ---------------------------------------------------------------- per-event probes
//
// A probe (backtest/events.json, field `probes`) names a measurement that should show the event physically, for a
// place or network the live collectors may not ask for (IODA Spain, AS32934, Energy-Charts Portugal ...). Each probe
// becomes one clearly named replay signal: the engine settings come unchanged from a catalog template signal, only
// id, name, plain text, place and the listed overrides differ. The engine scores it exactly like a live signal.


const HOUR_MS = 3600_000;

/** The probes of an event and the directory their fixtures live in (controls borrow those of another event). */
export function probesOf(ev: BacktestEvent, events: BacktestEvent[], fixturesDir: string): { probes: Probe[]; dir: string } {
  const owner = ev.probesFrom ? events.find((e) => e.id === ev.probesFrom) : ev;
  if (!owner) throw new Error(`${ev.id}: probesFrom ${ev.probesFrom} nicht in backtest/events.json`);
  return { probes: owner.probes ?? [], dir: join(fixturesDir, 'backtest', owner.id) };
}

/** Signal definitions for probes whose id is not in the catalog: the template with id, texts, place and overrides replaced. */
export function probeSignalDefs(probes: Probe[], catalog: SignalDef[]): SignalDef[] {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const out: SignalDef[] = [];
  for (const p of probes) {
    if (byId.has(p.id) || out.some((s) => s.id === p.id)) continue;
    const t = byId.get(p.template);
    if (!t) throw new Error(`Probe ${p.id}: Vorlage ${p.template} nicht im Katalog`);
    const { geo: _g, ...rest } = t;
    out.push({
      ...rest, ...(p.override ?? {}), id: p.id, name: p.name, plain: p.plain, status: 'active', collector: `replay:${p.adapter}`,
      ...(p.geo ? { geo: p.geo } : {}),
    } as SignalDef);
  }
  return out;
}

/** hourly values (UTC hour start, ms) from a regular series; steps above one hour are used as they are */
function hourlyFrom(ts: number[], values: (number | null)[], untilMs: number): [number, number][] {
  const sums = new Map<number, { s: number; n: number; total: number }>();
  for (let i = 0; i < ts.length; i++) {
    const h = Math.floor(ts[i] / HOUR_MS) * HOUR_MS;
    const a = sums.get(h) ?? { s: 0, n: 0, total: 0 };
    a.total++;
    const v = values[i];
    if (v !== null && Number.isFinite(v)) { a.s += v; a.n++; }
    sums.set(h, a);
  }
  return [...sums.entries()].filter(([h, a]) => h + HOUR_MS <= untilMs && a.n > 0 && a.n === a.total).map(([h, a]) => [h, a.s / a.n] as [number, number]).sort((x, y) => x[0] - y[0]);
}

const isoMs = (t: number) => new Date(t).toISOString();
/** RIPEstat times come without zone and are UTC */
const ripeMs = (s: unknown) => (typeof s === 'string' ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : NaN);

type ProbeParser = (body: string, p: Probe, anchor: Date) => Observation[];

const PARSERS: Record<Probe['adapter'], ProbeParser> = {
  // IODA v2 signals/raw: one series of the requested datasource; 5-minute steps become hourly means of complete hours
  ioda(body, p, anchor) {
    const ds = p.params?.datasource ?? 'bgp';
    const s = parseSignals(JSON.parse(body)).find((x) => x.datasource === ds);
    if (!s) throw new Error(`Datenquelle ${ds} fehlt`);
    const until = Math.floor(anchor.getTime() / 1000);
    if (s.step <= 3600 && 3600 % s.step === 0) {
      return [...hourlyMeans(s, until)].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ signalId: p.id, ts: isoMs(h * 1000), value: v, meta: { step: s.step } }));
    }
    return s.values.flatMap((v, i) => (v === null || s.from + (i + 1) * s.step > until ? [] : [{ signalId: p.id, ts: isoMs((s.from + i * s.step) * 1000), value: v, meta: { step: s.step } }]));
  },
  // Energy-Charts /public_power: the series "Load" (grid load) if present, else the sum of all generation series
  'energy-charts'(body, p, anchor) {
    const b = JSON.parse(body) as { unix_seconds?: number[]; production_types?: { name?: string; data?: (number | null)[] }[] };
    if (!Array.isArray(b.unix_seconds) || !Array.isArray(b.production_types)) throw new Error('unerwartete Antwort: unix_seconds/production_types fehlen');
    const ts = b.unix_seconds.map((x) => x * 1000);
    const load = b.production_types.find((x) => /^load$/i.test((x.name ?? '').trim()));
    let values: (number | null)[];
    let what: string;
    if (load?.data) { values = load.data; what = 'Load'; } else {
      const gen = b.production_types.filter((x) => x.data && !/load|consumption|cross border|import|export|renewable share/i.test(x.name ?? ''));
      values = ts.map((_t, i) => { let s = 0; let any = false; for (const g of gen) { const v = g.data![i]; if (typeof v === 'number') { s += v; any = true; } } return any ? s : null; });
      what = `Summe aus ${gen.length} Erzeugungsarten`;
    }
    return hourlyFrom(ts, values, anchor.getTime()).map(([h, v]) => ({ signalId: p.id, ts: isoMs(h), value: v, meta: { series: what } }));
  },
  wikipedia(body, p) {
    return [...parseWiki(JSON.parse(body))].sort().map(([d, v]) => ({ signalId: p.id, ts: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`, value: v }));
  },
  ooni(body, p) {
    return [...ooni.parse(JSON.parse(body))].sort().filter(([, v]) => v.n >= ooni.MIN_MEASUREMENTS)
      .map(([d, v]) => ({ signalId: p.id, ts: `${d}T00:00:00Z`, value: v.share, meta: { measurements: v.n } }));
  },
  // the collector's own parser over the stored slice (header included, so not partial)
  oref(body, p, anchor) {
    const r = parseOref(body, anchor);
    return r.days.map((d) => ({ signalId: p.id, ts: `${d.day}T00:00:00Z`, value: d.waves }));
  },
  // two columns Date,Price (datasets/oil-prices)
  'csv-daily'(body, p) {
    const rows = parseCsv(body);
    return rows.slice(1).flatMap((r) => {
      const v = Number(r[1]);
      return /^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? '') && Number.isFinite(v) && r[1] !== '' ? [{ signalId: p.id, ts: `${r[0]}T00:00:00Z`, value: v }] : [];
    });
  },
  // RIPEstat bgp-update-activity: BGP updates per sampling period. For an ASN only announcements carry a number
  // (withdrawals have no origin AS and come back as null), so the count of announcements (route churn) is used.
  'ripe-updates'(body, p, anchor) {
    const d = (JSON.parse(body) as { data?: { updates?: { starttime?: string; announcements?: number }[]; sampling_period?: number } }).data;
    if (!Array.isArray(d?.updates)) throw new Error('unerwartete Antwort: data.updates fehlt');
    const period = (d.sampling_period ?? 3600) * 1000;
    return d.updates.flatMap((u) => {
      const t = ripeMs(u.starttime);
      return Number.isFinite(t) && typeof u.announcements === 'number' && t + period <= anchor.getTime() && period <= 3600_000 ? [{ signalId: p.id, ts: isoMs(t), value: u.announcements, meta: { periodS: period / 1000 } }] : [];
    });
  },
  // RIPEstat announced-prefixes / routing-history: number of prefixes whose timeline covers the hour
  'ripe-prefixes'(body, p, anchor) {
    const d = (JSON.parse(body) as { data?: Record<string, unknown> }).data ?? {};
    const lists: { timelines?: { starttime?: string; endtime?: string }[] }[] = [];
    if (Array.isArray(d.prefixes)) lists.push(...(d.prefixes as typeof lists));
    if (Array.isArray(d.by_origin)) for (const o of d.by_origin as { prefixes?: typeof lists }[]) lists.push(...(o.prefixes ?? []));
    if (!lists.length) throw new Error('unerwartete Antwort: keine prefixes');
    // RIS dumps every 8 h: a timeline ending at e means "last seen at e"; that it is gone is only known at the next
    // dump, so the end is moved forward by one dump interval (no look-ahead)
    const lag = 8 * HOUR_MS;
    const iv = lists.map((x) => (x.timelines ?? []).map((t) => [ripeMs(t.starttime), ripeMs(t.endtime) + lag] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)));
    const all = iv.flat();
    if (!all.length) throw new Error('keine Zeitachsen');
    const from = Math.ceil(Math.min(...all.map((x) => x[0])) / HOUR_MS) * HOUR_MS;
    const to = Math.min(Math.max(...all.map((x) => x[1])) - lag, anchor.getTime());
    const out: Observation[] = [];
    for (let h = from; h < to; h += HOUR_MS) {
      const n = iv.filter((ints) => ints.some(([a, b]) => a <= h && h < b)).length;
      out.push({ signalId: p.id, ts: isoMs(h), value: n });
    }
    return out;
  },
};

export interface ProbeReport { id: string; file: string | null; observations: number; notes: string[] }

/**
 * Observations of all probes of an event, strictly before the anchor day (same cut as above). For each probe the
 * first source variant that exists and parses is used; when several parse, the one with the most observations wins.
 */
export function probeObservations(probes: Probe[], dir: string, anchor: Date): { observations: Observation[]; reports: ProbeReport[] } {
  const cut = dayIso(Math.floor(anchor.getTime() / DAY) * DAY);
  const out: Observation[] = [];
  const reports: ProbeReport[] = [];
  for (const p of probes) {
    const rep: ProbeReport = { id: p.id, file: null, observations: 0, notes: [] };
    let best: Observation[] = [];
    for (const s of p.sources) {
      const f = join(dir, s.fixture);
      if (!existsSync(f)) { rep.notes.push(`${s.fixture} fehlt`); continue; }
      try {
        const obs = PARSERS[p.adapter](readFileSync(f, 'utf8'), p, anchor).filter((o) => o.ts.slice(0, 10) < cut || p.adapter === 'ioda' || p.adapter.startsWith('ripe') || p.adapter === 'energy-charts');
        // sub-daily series are cut at the anchor itself (done in the parsers), daily ones before the anchor day
        if (obs.length > best.length) { best = obs; rep.file = s.fixture; }
      } catch (e) {
        rep.notes.push(`${s.fixture}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
    rep.observations = best.length;
    out.push(...best);
    reports.push(rep);
  }
  return { observations: out, reports };
}
