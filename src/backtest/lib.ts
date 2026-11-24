// Backtesting core: recompute what the radar would have shown at past points in time, and judge it against
// a curated list of known events. Pure functions; the CLIs (run.ts, evaluate.ts) only do I/O.
//
// Rule of the game: at every step t only data with timestamp <= t is used (same as buildSnapshot's history).
// The engine is imported unchanged; nothing here re-implements scoring.

import type { BanalRule, GeoRef, Observation, ScenarioDef, SignalDef } from '../core/types.ts';
import { applyTransform } from '../pipeline/snapshot.ts';
import { scoreScenario } from '../engine/score.ts';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
/** below this many domains with fresh data and a baseline, an event window is "nicht prüfbar" */
export const MIN_DOMAINS = 3;
/** collectors whose current fixture holds the complete dated history (entries carry their publication date) */
export const FULL_HISTORY_COLLECTORS = ['cisa-kev', 'cisa-ics'];

// ---------------------------------------------------------------- result file

export interface HotSignal {
  id: string;
  /** anomaly 0..1 after hold/decay, before damping */
  a: number;
  /** contribution to its domain (A/B) or to attention (D) */
  c: number;
  z: number | null;
  damp?: string;
}

export interface StepRecord {
  t: string;
  level: number;
  score: number;
  attention: number;
  /** domains at or above the "weicht ab" threshold */
  activeDomains: string[];
  /** domains with at least one fresh A/B signal that has a baseline */
  dataDomains: string[];
  /** number of signals of the scenario with fresh data (all classes) */
  signalsWithData: number;
  /** domain scores > 0 */
  d: Record<string, number>;
  /** every signal with anomaly > 0 at this step (also below level 1, needed for noise statistics) */
  hot: HotSignal[];
  /** from level 1 on: the signals that carry the score, strongest first */
  triggers?: { id: string; domain: string; c: number; z: number | null }[];
  /** indices into BacktestResult.signals of the signals with fresh data */
  fresh: number[];
  /** only with TimelineInput.details: per fresh signal [index into signals, value, z, anomaly] (for replays) */
  v?: [number, number | null, number | null, number][];
}

export interface SignalSummary {
  id: string;
  name: string;
  domain: string;
  evidenceClass: string;
  collector: string;
  status: string;
  /** observations stored in total / inside [from, to] */
  nObs: number;
  nInRange: number;
  first: string | null;
  last: string | null;
  /** steps at which the signal had fresh data */
  stepsFresh: number;
}

export interface BacktestResult {
  schema: 'backtest-result/1';
  scenario: string;
  generatedAt: string;
  source: string;
  sensitivity: 'normal' | 'high';
  from: string;
  to: string;
  stepHours: number;
  availability: 'as-stamped' | 'end-of-day';
  domains: { id: string; title: string; stepsWithData: number }[];
  signals: SignalSummary[];
  summary: {
    steps: number;
    levelCounts: number[];
    signalsWithDataEver: number;
    domainsWithDataEver: number;
    stepsWithMinDomains: number;
  };
  steps: StepRecord[];
}

export interface TimelineInput {
  scenario: ScenarioDef;
  /** all signal definitions (activated catalog); only status active + matching scenario are scored */
  signals: SignalDef[];
  /** raw observations per signal id (transform is applied here, as in buildSnapshot) */
  raw: Map<string, Observation[]>;
  rules: BanalRule[];
  from: number;
  to: number;
  stepHours: number;
  sensitivity: 'normal' | 'high';
  source: string;
  /**
   * as-stamped: use timestamps as stored (what the dashboard history does).
   * end-of-day (default): daily values stamped 00:00 UTC describe the whole day and could not have been known
   * before the day ended; they become visible 24 h later. Avoids look-ahead in lead times.
   */
  availability?: 'as-stamped' | 'end-of-day';
  /** record value, z and anomaly of every fresh signal per step (StepRecord.v), needed by export-replays.ts */
  details?: boolean;
}

/** rounds to 4 significant digits (values of very different magnitude: shares, counts, prices) */
export const sig4 = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : Number(x.toPrecision(4)));

/** Moves daily aggregates (signal interval >= 12 h, stamped exactly 00:00 UTC) to the end of their day. */
export function shiftToAvailability(def: SignalDef, series: Observation[]): Observation[] {
  if (def.intervalMinutes < 720) return series;
  return series.map((o) => {
    const t = Date.parse(o.ts);
    return t % DAY === 0 ? { ...o, ts: new Date(t + DAY).toISOString() } : o;
  });
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function computeTimeline(input: TimelineInput): BacktestResult {
  const { scenario } = input;
  const mine = input.signals.filter((s) => s.scenarios.includes(scenario.id));
  const series = new Map<string, Observation[]>();
  const availability = input.availability ?? 'end-of-day';
  for (const s of input.signals) {
    if (s.status !== 'active') continue;
    const tr = applyTransform(s, input.raw.get(s.id) ?? []);
    series.set(s.id, availability === 'end-of-day' ? shiftToAvailability(s, tr) : tr);
  }

  const idx = new Map(mine.map((s, i) => [s.id, i]));
  const stepsFresh = new Array(mine.length).fill(0);
  const domainSteps = new Map<string, number>();
  const steps: StepRecord[] = [];
  const step = input.stepHours * HOUR;
  if (!(step > 0)) throw new Error('stepHours muss > 0 sein');

  for (let t = input.from; t <= input.to; t += step) {
    const v = scoreScenario({ now: t, sensitivity: input.sensitivity, scenario, signals: input.signals, series, rules: input.rules });
    const all = [...v.domains.flatMap((d) => d.signals), ...v.attentionSignals];
    const fresh: number[] = [];
    for (const s of all) if (s.fresh && idx.has(s.id)) fresh.push(idx.get(s.id)!);
    fresh.sort((a, b) => a - b);
    for (const i of fresh) stepsFresh[i]++;
    const dataDomains = v.domains.filter((d) => d.signals.some((s) => s.fresh && s.baseline)).map((d) => d.id).sort();
    for (const d of dataDomains) domainSteps.set(d, (domainSteps.get(d) ?? 0) + 1);
    const hot: HotSignal[] = all.filter((s) => s.anomaly > 0)
      .map((s) => ({ id: s.id, a: r3(s.anomaly), c: r3(s.contribution), z: s.z, ...(s.damp ? { damp: s.damp.reason } : {}) }))
      .sort((a, b) => b.c - a.c || b.a - a.a);
    const rec: StepRecord = {
      t: new Date(t).toISOString(), level: v.level, score: v.score, attention: v.attention,
      activeDomains: v.domains.filter((d) => d.active).map((d) => d.id).sort(),
      dataDomains, signalsWithData: fresh.length,
      d: Object.fromEntries(v.domains.filter((d) => d.score > 0).map((d) => [d.id, d.score])),
      hot, fresh,
    };
    if (input.details) {
      rec.v = all.filter((s) => s.fresh && idx.has(s.id)).map((s) => [idx.get(s.id)!, sig4(s.value), s.z === null ? null : r3(s.z), r3(s.anomaly)] as [number, number | null, number | null, number])
        .sort((a, b) => a[0] - b[0]);
    }
    if (v.level >= 1) {
      rec.triggers = v.domains.flatMap((d) => d.signals.filter((s) => s.contribution > 0).map((s) => ({ id: s.id, domain: d.id, c: s.contribution, z: s.z })))
        .sort((a, b) => b.c - a.c);
    }
    steps.push(rec);
  }

  const signals: SignalSummary[] = mine.map((s, i) => {
    const obs = (input.raw.get(s.id) ?? []).map((o) => Date.parse(o.ts)).filter(Number.isFinite).sort((a, b) => a - b);
    return {
      id: s.id, name: s.name, domain: s.domain, evidenceClass: s.evidenceClass, collector: s.collector, status: s.status,
      nObs: obs.length, nInRange: obs.filter((x) => x >= input.from && x <= input.to).length,
      first: obs.length ? new Date(obs[0]).toISOString() : null, last: obs.length ? new Date(obs[obs.length - 1]).toISOString() : null,
      stepsFresh: stepsFresh[i],
    };
  });
  const levelCounts = [0, 0, 0, 0, 0];
  for (const s of steps) levelCounts[s.level]++;
  return {
    schema: 'backtest-result/1', scenario: scenario.id, generatedAt: new Date().toISOString(), source: input.source,
    sensitivity: input.sensitivity, from: new Date(input.from).toISOString(), to: new Date(input.to).toISOString(), stepHours: input.stepHours, availability,
    domains: Object.entries(scenario.domains).map(([id, d]) => ({ id, title: d.title, stepsWithData: domainSteps.get(id) ?? 0 })),
    signals,
    summary: {
      steps: steps.length, levelCounts,
      signalsWithDataEver: stepsFresh.filter((n) => n > 0).length,
      domainsWithDataEver: [...domainSteps.values()].filter((n) => n > 0).length,
      stepsWithMinDomains: steps.filter((s) => s.dataDomains.length >= MIN_DOMAINS).length,
    },
    steps,
  };
}

// ---------------------------------------------------------------- events

export interface BacktestEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: 'event' | 'control';
  expectedDomains: string[];
  sources: string[];
  notes?: string;
  verified?: boolean;
  /** scenario the event belongs to (default cyber) */
  scenario?: string;
  /** event-specific historical measurements (history-adapters.ts), also for places the live collectors do not ask for */
  probes?: Probe[];
  /** controls: reuse the probes and fixtures of this event (read at the control's own, earlier anchor) */
  probesFrom?: string;
  /** English title for the time machine (else TITLE_EN in export-replays.ts, else the German title) */
  title_en?: string;
  /** additional queue fetches under names the standard adapters already read (Yahoo, OONI) */
  extraFetches?: { fixture: string; url: string }[];
}

/** One replay signal of an event: where its history comes from and how it is turned into observations. */
export interface Probe {
  /** signal id in the replay; may equal an existing catalog signal measuring the same thing */
  id: string;
  /** catalog signal whose engine settings (domain, baseline, thresholds, weight, direction, class) are reused */
  template: string;
  adapter: 'ioda' | 'energy-charts' | 'wikipedia' | 'ooni' | 'oref' | 'csv-daily' | 'ripe-updates' | 'ripe-prefixes' | 'yahoo';
  params?: Record<string, string>;
  name: string;
  /** one sentence for laypeople */
  plain: string;
  geo?: GeoRef | null;
  /** fields that differ from the template (e.g. scenarios, domain) */
  override?: Partial<SignalDef>;
  /** variants in order of preference; fixture is relative to fixtures/backtest/<event>/ */
  sources: { fixture: string; url: string; local?: string }[];
}

/**
 * Point in time at which history collectors are run for an event (ctx.now). Late enough that sources with a
 * publication lag (Tor Metrics: 3 days) cover the event, early enough that their look-back windows still reach
 * about two months before the event, which the baselines need.
 */
export function historyAnchor(ev: Pick<BacktestEvent, 'end'>): Date {
  const end = Date.parse(ev.end);
  return new Date(Math.floor(end / DAY) * DAY + 4 * DAY);
}

// ---------------------------------------------------------------- evaluation

export interface EvalOptions {
  /** hours before an event start that still count for it (precursors) */
  preHours: number;
  /** hours after an event end that still count for it */
  postHours: number;
}

export const DEFAULT_EVAL: EvalOptions = { preHours: 72, postHours: 24 };

export interface EventEval {
  id: string;
  title: string;
  kind: 'event' | 'control';
  start: string;
  end: string;
  steps: number;
  covered: boolean;
  /** median / max number of domains with data inside the window */
  domainsWithDataMedian: number;
  domainsWithDataMax: number;
  signalsWithDataMax: number;
  maxLevel: number | null;
  maxScore: number | null;
  /** hours from event start to the first step with level >= 1 / >= 2 (negative = before the start) */
  leadL1Hours: number | null;
  leadL2Hours: number | null;
  firedDomains: string[];
  expectedDomains: string[];
  expectedHit: string[];
  /** expected domains that had fresh data with a baseline at least once in the window */
  expectedWithData: string[];
  /** A/B signals with fresh data in the window, per expected domain */
  expectedSignals: Record<string, string[]>;
  /** share of steps at level >= 1 / >= 2 (meaningful for controls) */
  shareL1: number | null;
  shareL2: number | null;
  outcome: 'nicht prüfbar' | 'erkannt' | 'schwach' | 'verpasst' | 'ruhig' | 'Fehlalarm';
  topSignals: { id: string; maxC: number }[];
}

export interface NoiseRow {
  id: string;
  domain: string;
  evidenceClass: string;
  /** days with fresh data outside of event windows */
  daysWithData: number;
  /** separate excursions (rising edges of contribution > 0) */
  excursions: number;
  per30d: number | null;
  /** steps (outside events) at which the signal contributed */
  hotSteps: number;
}

export interface Evaluation {
  schema: 'backtest-eval/1';
  generatedAt: string;
  results: { file: string; source: string; from: string; to: string; stepHours: number; steps: number; availability: string }[];
  options: EvalOptions & { minDomains: number };
  coverage: {
    signalsInScenario: number;
    signalsActive: number;
    signalsWithDataEver: number;
    domainsInScenario: number;
    domainsWithDataEver: number;
    stepsTotal: number;
    stepsWithMinDomains: number;
    perDomain: { id: string; title: string; stepsWithData: number; share: number }[];
  };
  levelDistribution: { level: number; steps: number; share: number }[];
  events: EventEval[];
  controls: EventEval[];
  outside: {
    steps: number;
    coveredSteps: number;
    shareL1: number | null;
    shareL2: number | null;
    shareL1Covered: number | null;
    shareL2Covered: number | null;
    episodesL1: number;
  };
  noise: NoiseRow[];
  /**
   * Engine check: CONVERGENCE_GATE[0] is 1, so with zero domains above the "weicht ab" threshold the summed
   * sub-threshold domain scores pass unclamped. These numbers show how much of the level distribution depends on it.
   */
  diagnostics: {
    stepsL1WithoutActiveDomain: number;
    stepsL2WithoutActiveDomain: number;
    /** level distribution if steps without any active domain were shown as calm */
    levelDistributionIfNoDomainIsCalm: { level: number; steps: number; share: number }[];
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const share = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 10000 : null);

interface TaggedStep { s: StepRecord; t: number; res: BacktestResult }

function windowOf(ev: BacktestEvent, o: EvalOptions): [number, number] {
  if (ev.kind === 'control') return [Date.parse(ev.start), Date.parse(ev.end)];
  return [Date.parse(ev.start) - o.preHours * HOUR, Date.parse(ev.end) + o.postHours * HOUR];
}

function judge(ev: BacktestEvent, steps: TaggedStep[]): EventEval {
  const start = Date.parse(ev.start);
  const dd = steps.map((x) => x.s.dataDomains.length);
  const covered = steps.length > 0 && median(dd) >= MIN_DOMAINS;
  const firstAt = (lvl: number) => {
    const hit = steps.find((x) => x.s.level >= lvl);
    return hit ? Math.round(((hit.t - start) / HOUR) * 10) / 10 : null;
  };
  const fired = new Set<string>();
  const withData = new Set(steps.flatMap((x) => x.s.dataDomains));
  const expectedSignals: Record<string, string[]> = {};
  for (const x of steps) {
    for (const i of x.s.fresh) {
      const sig = x.res.signals[i];
      if (!sig || !ev.expectedDomains.includes(sig.domain) || (sig.evidenceClass !== 'A' && sig.evidenceClass !== 'B')) continue;
      const arr = (expectedSignals[sig.domain] ??= []);
      if (!arr.includes(sig.id)) arr.push(sig.id);
    }
  }
  const top = new Map<string, number>();
  for (const x of steps) {
    for (const d of x.s.activeDomains) fired.add(d);
    for (const h of x.s.hot) if (h.c > 0) top.set(h.id, Math.max(top.get(h.id) ?? 0, h.c));
  }
  const maxLevel = steps.length ? Math.max(...steps.map((x) => x.s.level)) : null;
  const maxScore = steps.length ? Math.max(...steps.map((x) => x.s.score)) : null;
  const nL1 = steps.filter((x) => x.s.level >= 1).length;
  const nL2 = steps.filter((x) => x.s.level >= 2).length;
  let outcome: EventEval['outcome'];
  if (!covered) outcome = 'nicht prüfbar';
  else if (ev.kind === 'control') outcome = nL1 > 0 ? 'Fehlalarm' : 'ruhig';
  else outcome = (maxLevel ?? 0) >= 2 ? 'erkannt' : (maxLevel ?? 0) >= 1 ? 'schwach' : 'verpasst';
  return {
    id: ev.id, title: ev.title, kind: ev.kind, start: ev.start, end: ev.end, steps: steps.length, covered,
    domainsWithDataMedian: median(dd), domainsWithDataMax: dd.length ? Math.max(...dd) : 0,
    signalsWithDataMax: steps.length ? Math.max(...steps.map((x) => x.s.signalsWithData)) : 0,
    maxLevel, maxScore, leadL1Hours: firstAt(1), leadL2Hours: firstAt(2),
    firedDomains: [...fired].sort(), expectedDomains: ev.expectedDomains,
    expectedHit: ev.expectedDomains.filter((d) => fired.has(d)),
    expectedWithData: ev.expectedDomains.filter((d) => withData.has(d)),
    expectedSignals,
    shareL1: share(nL1, steps.length), shareL2: share(nL2, steps.length), outcome,
    topSignals: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, maxC]) => ({ id, maxC })),
  };
}

export function evaluateResults(results: { file: string; result: BacktestResult }[], events: BacktestEvent[], o: EvalOptions = DEFAULT_EVAL): Evaluation {
  // merge all steps; if two result files overlap, both are kept (they are different data sources)
  const tagged: TaggedStep[] = results.flatMap(({ result }) => result.steps.map((s) => ({ s, t: Date.parse(s.t), res: result })))
    .sort((a, b) => a.t - b.t);

  const inWin = (ev: BacktestEvent) => {
    const [a, b] = windowOf(ev, o);
    return tagged.filter((x) => x.t >= a && x.t <= b);
  };
  const evs = events.filter((e) => e.kind === 'event').map((e) => judge(e, inWin(e)));
  const ctl = events.filter((e) => e.kind === 'control').map((e) => judge(e, inWin(e)));

  // everything outside of (extended) event windows; controls count as outside as well
  const eventWins = events.filter((e) => e.kind === 'event').map((e) => windowOf(e, o));
  const outsideSteps = tagged.filter((x) => !eventWins.some(([a, b]) => x.t >= a && x.t <= b));
  const covOutside = outsideSteps.filter((x) => x.s.dataDomains.length >= MIN_DOMAINS);
  let episodesL1 = 0;
  for (let i = 0; i < outsideSteps.length; i++) {
    const prev = outsideSteps[i - 1];
    const contiguous = prev && prev.res === outsideSteps[i].res && outsideSteps[i].t - prev.t <= outsideSteps[i].res.stepHours * HOUR;
    if (outsideSteps[i].s.level >= 1 && !(contiguous && prev.s.level >= 1)) episodesL1++;
  }

  // noise per signal: excursions outside event windows, normalised to 30 days with data
  const noise = new Map<string, NoiseRow>();
  for (const { result } of results) {
    const wasHot = new Map<string, boolean>();
    for (const s of result.steps) {
      const t = Date.parse(s.t);
      const outside = !eventWins.some(([a, b]) => t >= a && t <= b);
      const hotIds = new Set(s.hot.filter((h) => h.c > 0).map((h) => h.id));
      for (const i of s.fresh) {
        const sig = result.signals[i];
        if (!sig) continue;
        let row = noise.get(sig.id);
        if (!row) {
          row = { id: sig.id, domain: sig.domain, evidenceClass: sig.evidenceClass, daysWithData: 0, excursions: 0, per30d: null, hotSteps: 0 };
          noise.set(sig.id, row);
        }
        if (!outside) continue;
        row.daysWithData += result.stepHours / 24;
      }
      for (const id of new Set([...hotIds, ...wasHot.keys()])) {
        const now = hotIds.has(id);
        if (now && !wasHot.get(id) && outside) {
          const row = noise.get(id);
          if (row) row.excursions++;
        }
        if (now && outside) {
          const row = noise.get(id);
          if (row) row.hotSteps++;
        }
        wasHot.set(id, now);
      }
    }
  }
  const noiseRows = [...noise.values()].map((r) => ({
    ...r, daysWithData: Math.round(r.daysWithData * 10) / 10,
    per30d: r.daysWithData >= 3 ? Math.round((r.excursions / r.daysWithData) * 30 * 10) / 10 : null,
  })).sort((a, b) => (b.per30d ?? -1) - (a.per30d ?? -1) || b.excursions - a.excursions || a.id.localeCompare(b.id));

  // coverage over all result files
  const first = results[0]?.result;
  const sigEver = new Set<string>();
  const domSteps = new Map<string, number>();
  for (const { result } of results) {
    for (const s of result.signals) if (s.stepsFresh > 0) sigEver.add(s.id);
    for (const d of result.domains) domSteps.set(d.id, (domSteps.get(d.id) ?? 0) + d.stepsWithData);
  }
  const stepsTotal = tagged.length;
  const levelDistribution = [0, 1, 2, 3, 4].map((level) => {
    const n = tagged.filter((x) => x.s.level === level).length;
    return { level, steps: n, share: share(n, stepsTotal) ?? 0 };
  });
  return {
    schema: 'backtest-eval/1', generatedAt: new Date().toISOString(),
    results: results.map(({ file, result }) => ({ file, source: result.source, from: result.from, to: result.to, stepHours: result.stepHours, steps: result.steps.length, availability: result.availability ?? 'as-stamped' })),
    options: { ...o, minDomains: MIN_DOMAINS },
    coverage: {
      signalsInScenario: first ? first.signals.length : 0,
      signalsActive: first ? first.signals.filter((s) => s.status === 'active').length : 0,
      signalsWithDataEver: sigEver.size,
      domainsInScenario: first ? first.domains.length : 0,
      domainsWithDataEver: [...domSteps.values()].filter((n) => n > 0).length,
      stepsTotal,
      stepsWithMinDomains: tagged.filter((x) => x.s.dataDomains.length >= MIN_DOMAINS).length,
      perDomain: (first?.domains ?? []).map((d) => ({ id: d.id, title: d.title, stepsWithData: domSteps.get(d.id) ?? 0, share: share(domSteps.get(d.id) ?? 0, stepsTotal) ?? 0 })),
    },
    levelDistribution,
    events: evs,
    controls: ctl,
    outside: {
      steps: outsideSteps.length, coveredSteps: covOutside.length,
      shareL1: share(outsideSteps.filter((x) => x.s.level >= 1).length, outsideSteps.length),
      shareL2: share(outsideSteps.filter((x) => x.s.level >= 2).length, outsideSteps.length),
      shareL1Covered: share(covOutside.filter((x) => x.s.level >= 1).length, covOutside.length),
      shareL2Covered: share(covOutside.filter((x) => x.s.level >= 2).length, covOutside.length),
      episodesL1,
    },
    noise: noiseRows,
    diagnostics: {
      stepsL1WithoutActiveDomain: tagged.filter((x) => x.s.level >= 1 && x.s.activeDomains.length === 0).length,
      stepsL2WithoutActiveDomain: tagged.filter((x) => x.s.level >= 2 && x.s.activeDomains.length === 0).length,
      levelDistributionIfNoDomainIsCalm: [0, 1, 2, 3, 4].map((level) => {
        const n = tagged.filter((x) => (x.s.activeDomains.length === 0 ? 0 : x.s.level) === level).length;
        return { level, steps: n, share: share(n, stepsTotal) ?? 0 };
      }),
    },
  };
}
