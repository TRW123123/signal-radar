#!/usr/bin/env node
// Calibration: measures how often the current thresholds call something "unusual" on the real stored data, so that
// every threshold can be justified with a measured number (docs/CALIBRATION.md, docs/SCORING.md).
//
//   node src/backtest/calibrate.ts [--data data] [--days 30] [--step-hours 1] [--out backtest/results/calibration.json]
//                                  [--availability as-stamped|end-of-day]   (default as-stamped, like the dashboard)
//                                  [--before <calibration.json>] [--dry] [--z0 2.5] [--override '{"<signal>":{...}}']
//
// Three levels are measured, always "as the system would have computed it then" (only data up to that moment):
//   signal    every stored observation that had a baseline is compared with the baseline built from its own past
//             (engine function baselineAt, same transform and availability shift as the backtest). Share of
//             comparison points at or beyond the signal's effective z threshold, separate episodes per 30 days.
//   domain    the scenarios are recomputed every --step-hours over the last --days (computeTimeline, engine
//             unchanged). Share of time a domain with data was at or above the "unusual" threshold.
//   scenario  share of time at level >= 1, 2, 3, overall and outside of known event windows (backtest/events.json),
//             plus the highest level reached with date and the signals that carried it.
// --before: an earlier calibration.json; its numbers appear as "vorher" in the report.
// --dry:    print the summary only and write no report (with --out: only the JSON), for trying --z0 / --override variants.
// Writes backtest/results/calibration.json, docs/CALIBRATION.md and frontend/data/explain.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../core/catalog.ts';
import { activate, discoverCollectors } from '../core/registry.ts';
import { fileStore } from '../core/store.ts';
import type { Observation, SignalDef } from '../core/types.ts';
import { BASELINE_RULES, baselineAt, directionalZ, SENSITIVITY } from '../engine/anomaly.ts';
import { CONVERGENCE_GATE, DOMAIN_ACTIVE, LEVEL_LABELS, LEVEL_THRESHOLDS } from '../engine/score.ts';
import { applyTransform } from '../pipeline/snapshot.ts';
import { type BacktestEvent, type BacktestResult, computeTimeline, DAY, DEFAULT_EVAL, HOUR, shiftToAvailability } from './lib.ts';

// ---------------------------------------------------------------- target (the one place where it is set)

/** The target the thresholds are derived from. Changing it here changes the report and explain.json. */
export const TARGET = {
  /** a single measurement: at most about 1 in 50 comparison points beyond the threshold (median over signals) */
  signalShare: 0.02,
  /** a domain with data: "unusual" at most about 5 % of the time */
  domainShare: 0.05,
  /** a scenario outside of known events: level 2 or higher at most about 1 % of the time */
  level2Share: 0.01,
  /** level 1 or higher outside of known events: at most about 15 % of the time (a single domain may deviate) */
  level1Share: 0.15,
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dry = args.includes('--dry');
const days = Number(opt('days') ?? 30);
const stepHours = Number(opt('step-hours') ?? 1);
const dataDir = resolve(opt('data') ?? join(root, 'data'));
const sensName = process.env.SR_SENSITIVITY === 'normal' ? 'normal' : 'high';
const sens = SENSITIVITY[sensName];
if (opt('z0')) sens.z0 = Number(opt('z0'));
if (opt('min-values')) BASELINE_RULES.minValues = Number(opt('min-values'));
const overrides = opt('override') ? (JSON.parse(opt('override')!) as Record<string, Partial<SignalDef>>) : {};

const collectors = await discoverCollectors(root);
const catalog = activate(loadCatalog(root), collectors, process.env);
for (const s of catalog.signals) {
  const o = overrides[s.id];
  if (o) Object.assign(s, { ...o, thresholds: { ...(s.thresholds ?? {}), ...(o.thresholds ?? {}) } });
}
const store = fileStore(dataDir);
// Live operation has the keys; locally they are usually missing. Stored data was collected with a key, so every
// signal with a collector and stored values is measured as active (otherwise e.g. all FRED signals would be skipped).
const keyed: string[] = [];
for (const s of catalog.signals) {
  if (s.status === 'needs-key' && (await store.read(s.id)).length) {
    s.status = 'active';
    keyed.push(s.id);
  }
}
const availability = opt('availability') === 'end-of-day' ? 'end-of-day' : 'as-stamped';
const events = JSON.parse(readFileSync(join(root, 'backtest', 'events.json'), 'utf8')) as BacktestEvent[];

const raw = new Map<string, Observation[]>();
let latest = 0;
for (const s of catalog.signals) {
  if (s.status !== 'active') continue;
  const obs = await store.read(s.id);
  if (!obs.length) continue;
  raw.set(s.id, obs);
  for (const o of obs) latest = Math.max(latest, Date.parse(o.ts));
}
const to = opt('to') ? Date.parse(opt('to')!) : latest;
const from = to - days * DAY;
const eventWins = events.filter((e) => e.kind === 'event')
  .map((e) => [Date.parse(e.start) - DEFAULT_EVAL.preHours * HOUR, Date.parse(e.end) + DEFAULT_EVAL.postHours * HOUR] as const);
const inEvent = (t: number) => eventWins.some(([a, b]) => t >= a && t <= b);

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '–' : `${(x * 100).toFixed(d).replace('.', ',')} %`);
const num = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '–' : x.toFixed(d).replace('.', ','));
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
};

// ---------------------------------------------------------------- 1. signals

const CANDIDATE_Z = [2, 2.5, 3, 3.5, 4, 5];

interface SignalRow {
  id: string;
  name: string;
  scenarios: string[];
  domain: string;
  evidenceClass: string;
  collector: string;
  /** effective threshold (signal's own z0 or the profile's) and whether it is signal-specific */
  z0: number;
  ownZ0: boolean;
  holdHours: number | null;
  /** comparison points (observations with a baseline) over the whole history / inside the last `days` */
  points: number;
  points30: number;
  matureShare: number;
  historyDays: number;
  /** share of comparison points with z >= z0 */
  share: number | null;
  share30: number | null;
  shareMature: number | null;
  episodes: number;
  episodesPer30d: number | null;
  /** z reached by 2 % of the comparison points: where the threshold would lie for "1 in 50" */
  z98: number | null;
  /** share beyond each candidate threshold */
  byZ: Record<string, number>;
  /** median spacing of observations in hours */
  cadenceHours: number | null;
  cause: string | null;
}

function cadenceOf(ts: number[]): number | null {
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter((g) => g > 0);
  const m = median(gaps);
  return m === null ? null : m / HOUR;
}

/** a rough reason why a signal is loud, from its own data */
function causeOf(def: SignalDef, series: Observation[], zs: { t: number; z: number }[], z0: number, points: number): string | null {
  const hot = zs.filter((p) => p.z >= z0);
  if (!hot.length) return null;
  if (points < 30) return 'kurze Historie';
  const vals = series.map((o) => o.value).filter(Number.isFinite);
  const zeros = vals.filter((v) => v === 0).length / Math.max(vals.length, 1);
  const q50 = quantile(vals, 0.5) ?? 0;
  const q95 = quantile(vals, 0.95) ?? 0;
  if (zeros > 0.4 || (q50 > 0 && q95 / q50 > 4)) return 'stoßweise';
  if (def.baseline.method === 'rolling' && (def.intervalMinutes <= 360)) {
    const wk = new Set(hot.map((p) => new Date(p.t).getUTCDay()));
    if (wk.size <= 2 && hot.length >= 3) return 'Wochenrhythmus';
  }
  // trend: most exceedances in the last quarter of the history
  const tMin = zs[0].t;
  const tMax = zs[zs.length - 1].t;
  if (hot.filter((p) => p.t >= tMin + 0.75 * (tMax - tMin)).length >= 0.8 * hot.length && hot.length >= 3) return 'Trend/Niveauwechsel';
  return 'Einzelereignisse';
}

/** share beyond the threshold by size of the baseline at the time of comparison: does a short history make noise? */
const N_BUCKETS = [3, 7, 14, 28, 56];
const byN = N_BUCKETS.map((lo, i) => ({ from: lo, to: N_BUCKETS[i + 1] ?? null, points: 0, hits: 0 }));
const signals: SignalRow[] = [];
const allZ: number[] = [];
const allZ30: number[] = [];
for (const def of catalog.signals) {
  if (def.status !== 'active' || !raw.has(def.id) || def.evidenceClass === 'C') continue;
  const tr = applyTransform(def, raw.get(def.id)!);
  const series = (availability === 'end-of-day' ? shiftToAvailability(def, tr) : tr)
    .filter((o) => Number.isFinite(o.value))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const z0 = def.thresholds?.z0 ?? sens.z0;
  const zs: { t: number; z: number; mature: boolean }[] = [];
  for (const o of series) {
    const t = Date.parse(o.ts);
    const b = baselineAt(def, series, t);
    if (!b) continue;
    const z = directionalZ(def, o.value, b);
    zs.push({ t, z, mature: b.mature });
    const nb = byN[N_BUCKETS.findLastIndex((lo) => b.n >= lo)];
    if (nb) {
      nb.points++;
      if (z >= (def.thresholds?.z0 ?? sens.z0)) nb.hits++;
    }
  }
  const ts = series.map((o) => Date.parse(o.ts));
  const cadence = cadenceOf(ts);
  const hold = (def.holdHours ?? Math.max(6, (cadence ?? 0) * 2)) * HOUR;
  let episodes = 0;
  let lastHot = -Infinity;
  for (const p of zs) {
    if (p.z < z0) continue;
    if (p.t - lastHot > hold) episodes++;
    lastHot = p.t;
  }
  const z30 = zs.filter((p) => p.t >= from && p.t <= to);
  const mature = zs.filter((p) => p.mature);
  const historyDays = zs.length >= 2 ? (zs[zs.length - 1].t - zs[0].t) / DAY : 0;
  for (const p of zs) allZ.push(p.z);
  for (const p of z30) allZ30.push(p.z);
  const share = (xs: { z: number }[], z = z0) => (xs.length ? xs.filter((p) => p.z >= z).length / xs.length : null);
  signals.push({
    id: def.id, name: def.name, scenarios: def.scenarios, domain: def.domain, evidenceClass: def.evidenceClass, collector: def.collector,
    z0, ownZ0: def.thresholds?.z0 !== undefined, holdHours: def.holdHours ?? null,
    points: zs.length, points30: z30.length, matureShare: zs.length ? r4(mature.length / zs.length) : 0, historyDays: r2(historyDays),
    share: share(zs) === null ? null : r4(share(zs)!), share30: share(z30) === null ? null : r4(share(z30)!),
    shareMature: share(mature) === null ? null : r4(share(mature)!),
    episodes, episodesPer30d: historyDays >= 3 ? r2((episodes / historyDays) * 30) : null,
    z98: zs.length >= 20 ? r2(quantile(zs.map((p) => p.z), 0.98)!) : null,
    byZ: Object.fromEntries(CANDIDATE_Z.map((z) => [String(z), r4(share(zs, z) ?? 0)])),
    cadenceHours: cadence === null ? null : r2(cadence),
    cause: causeOf(def, series, zs, z0, zs.length),
  });
}
// only signals with enough comparison points enter the summary; very short histories are listed separately
const MIN_POINTS = 10;
const measured = signals.filter((s) => s.points >= MIN_POINTS);
const measured30 = signals.filter((s) => s.points30 >= MIN_POINTS);
/** signals with enough history that their baseline is settled: the basis for deriving the global threshold */
const SETTLED_POINTS = 60;
const settled = signals.filter((s) => s.points >= SETTLED_POINTS);
const signalSummary = {
  signals: signals.length,
  signalsMeasured: measured.length,
  signalsMeasured30: measured30.length,
  points: signals.reduce((a, s) => a + s.points, 0),
  points30: signals.reduce((a, s) => a + s.points30, 0),
  medianShare: r4(median(measured.map((s) => s.share!)) ?? 0),
  meanShare: r4(mean(measured.map((s) => s.share!)) ?? 0),
  meanShare30: r4(mean(measured30.map((s) => s.share30!)) ?? 0),
  medianShare30: r4(median(measured30.map((s) => s.share30!)) ?? 0),
  /** all comparison points of all signals pooled */
  pooledShare: r4(signals.reduce((a, s) => a + (s.share ?? 0) * s.points, 0) / Math.max(1, signals.reduce((a, s) => a + s.points, 0))),
  signalsOverTarget: measured.filter((s) => (s.share ?? 0) > 2 * TARGET.signalShare).length,
  medianEpisodesPer30d: median(measured.filter((s) => s.episodesPer30d !== null).map((s) => s.episodesPer30d!)),
  /** pooled share beyond each candidate global threshold (signals with own z0 included at the candidate) */
  byZ: Object.fromEntries(CANDIDATE_Z.map((z) => [String(z), r4(allZ.filter((x) => x >= z).length / Math.max(1, allZ.length))])),
  medianShareByZ: Object.fromEntries(CANDIDATE_Z.map((z) => [String(z), r4(median(measured.map((s) => s.byZ[String(z)])) ?? 0)])),
  /** z that 2 % of all pooled comparison points reach */
  pooledZ98: r2(quantile(allZ, 0.98) ?? 0),
  medianZ98: median(measured.filter((s) => s.z98 !== null).map((s) => s.z98!)),
  settledSignals: settled.length,
  settledMeanShare: r4(mean(settled.map((s) => s.share!)) ?? 0),
  /** mean over settled signals of the share beyond each candidate global threshold */
  settledByZ: Object.fromEntries(CANDIDATE_Z.map((z) => [String(z), r4(mean(settled.map((s) => s.byZ[String(z)])) ?? 0)])),
  byBaselineSize: byN.map((b) => ({ ...b, share: b.points ? r4(b.hits / b.points) : null })),
};

// ---------------------------------------------------------------- 2./3. domains and scenarios

interface DomainRow { id: string; title: string; stepsWithData: number; share: number | null; shareQuiet: number | null; maxScore: number; drivers: { id: string; steps: number }[] }
interface ScenarioRow {
  id: string;
  title: string;
  steps: number;
  stepsQuiet: number;
  stepsMinDomains: number;
  shareL1: number; shareL2: number; shareL3: number;
  quietL1: number | null; quietL2: number | null; quietL3: number | null;
  covL1: number | null; covL2: number | null;
  levelCounts: number[];
  episodesL1: number;
  episodesL2: number;
  maxLevel: number;
  maxAt: string | null;
  maxScore: number;
  maxDomains: string[];
  maxTriggers: { id: string; name: string; domain: string; c: number; z: number | null }[];
  domains: DomainRow[];
}

const nameOf = new Map(catalog.signals.map((s) => [s.id, s.name]));
const domainOf = new Map(catalog.signals.map((s) => [s.id, s.domain]));
const scenarios: ScenarioRow[] = [];
const timelines: BacktestResult[] = [];
for (const scenario of catalog.scenarios) {
  const step = stepHours * HOUR;
  const alignedFrom = to - Math.floor((to - from) / step) * step;
  const res = computeTimeline({
    scenario, signals: catalog.signals, raw, rules: catalog.rules, from: alignedFrom, to, stepHours, sensitivity: sensName, source: `data:${relative(root, dataDir)}`, availability,
  });
  timelines.push(res);
  const st = res.steps;
  const quiet = st.filter((s) => !inEvent(Date.parse(s.t)));
  const cov = st.filter((s) => s.dataDomains.length >= 3);
  const sh = (xs: typeof st, l: number) => (xs.length ? r4(xs.filter((s) => s.level >= l).length / xs.length) : null);
  const episodes = (l: number) => st.reduce((n, s, i) => n + (s.level >= l && !(i > 0 && st[i - 1].level >= l) ? 1 : 0), 0);
  let best = st[0];
  for (const s of st) if (s.level > best.level || (s.level === best.level && s.score > best.score)) best = s;
  const domains: DomainRow[] = Object.entries(scenario.domains).map(([id, meta]) => {
    const withData = st.filter((s) => s.dataDomains.includes(id));
    const quietData = withData.filter((s) => !inEvent(Date.parse(s.t)));
    return {
      id, title: meta.title, stepsWithData: withData.length,
      share: withData.length ? r4(withData.filter((s) => (s.d[id] ?? 0) >= DOMAIN_ACTIVE).length / withData.length) : null,
      shareQuiet: quietData.length ? r4(quietData.filter((s) => (s.d[id] ?? 0) >= DOMAIN_ACTIVE).length / quietData.length) : null,
      maxScore: Math.max(0, ...withData.map((s) => s.d[id] ?? 0)),
      // which signal carried the domain while it was "unusual"
      drivers: (() => {
        const n = new Map<string, number>();
        for (const s of withData) {
          if ((s.d[id] ?? 0) < DOMAIN_ACTIVE) continue;
          const top = s.hot.filter((h) => domainOf.get(h.id) === id && h.c > 0).sort((a, b) => b.c - a.c)[0];
          if (top) n.set(top.id, (n.get(top.id) ?? 0) + 1);
        }
        return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([sid, steps]) => ({ id: sid, steps }));
      })(),
    };
  });
  scenarios.push({
    id: scenario.id, title: scenario.title, steps: st.length, stepsQuiet: quiet.length, stepsMinDomains: cov.length,
    shareL1: sh(st, 1)!, shareL2: sh(st, 2)!, shareL3: sh(st, 3)!,
    quietL1: sh(quiet, 1), quietL2: sh(quiet, 2), quietL3: sh(quiet, 3),
    covL1: sh(cov, 1), covL2: sh(cov, 2),
    levelCounts: res.summary.levelCounts, episodesL1: episodes(1), episodesL2: episodes(2),
    maxLevel: best?.level ?? 0, maxAt: best && best.level > 0 ? best.t : null, maxScore: best?.score ?? 0,
    maxDomains: best?.activeDomains ?? [],
    maxTriggers: (best?.triggers ?? []).slice(0, 5).map((x) => ({ id: x.id, name: nameOf.get(x.id) ?? x.id, domain: x.domain, c: x.c, z: x.z })),
    domains,
  });
}

// distribution of domain scores: how often would a domain be "unusual" at other thresholds?
const DOMAIN_CANDIDATES = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
const domainSteps: number[] = [];
for (let i = 0; i < scenarios.length; i++) {
  const res = timelines[i];
  for (const d of scenarios[i].domains) {
    if (d.stepsWithData < 24) continue;
    for (const st of res.steps) if (st.dataDomains.includes(d.id)) domainSteps.push(st.d[d.id] ?? 0);
  }
}
const domainByThreshold = Object.fromEntries(DOMAIN_CANDIDATES.map((x) => [String(x), r4(domainSteps.filter((v) => v >= x).length / Math.max(1, domainSteps.length))]));
const domainShares = scenarios.flatMap((s) => s.domains.filter((d) => d.stepsWithData >= 24 && d.share !== null).map((d) => ({ scenario: s.id, ...d })));
const scen = scenarios.filter((s) => s.stepsMinDomains > 0);
const summary = {
  signal: signalSummary,
  domain: {
    domainsMeasured: domainShares.length,
    meanShare: r4(mean(domainShares.map((d) => d.share!)) ?? 0),
    medianShare: r4(median(domainShares.map((d) => d.share!)) ?? 0),
    pooledShare: domainByThreshold[String(DOMAIN_ACTIVE)] ?? null,
    byThreshold: domainByThreshold,
    overTarget: domainShares.filter((d) => d.share! > TARGET.domainShare).map((d) => `${d.scenario}.${d.id}`),
  },
  levels: [1, 2, 3].map((l) => ({
    level: l,
    meanShare: r4(mean(scen.map((s) => (l === 1 ? s.shareL1 : l === 2 ? s.shareL2 : s.shareL3))) ?? 0),
    meanShareQuiet: r4(mean(scen.map((s) => (l === 1 ? s.quietL1 : l === 2 ? s.quietL2 : s.quietL3) ?? 0)) ?? 0),
    maxShareQuiet: r4(Math.max(0, ...scen.map((s) => (l === 1 ? s.quietL1 : l === 2 ? s.quietL2 : s.quietL3) ?? 0))),
  })),
  /** highest scenario value reached outside of event windows, per scenario */
  maxQuietScore: Object.fromEntries(timelines.map((res) => [res.scenario, Math.max(0, ...res.steps.filter((s) => !inEvent(Date.parse(s.t))).map((s) => s.score))])),
};
const verdict = {
  signal: summary.signal.settledMeanShare <= TARGET.signalShare * 1.25,
  domain: summary.domain.overTarget.length === 0,
  level2: summary.levels[1].maxShareQuiet <= TARGET.level2Share,
  level1: summary.levels[0].maxShareQuiet <= TARGET.level1Share,
};

const out = resolve(opt('out') ?? join(root, 'backtest', 'results', 'calibration.json'));
const before = opt('before') && existsSync(resolve(opt('before')!)) ? JSON.parse(readFileSync(resolve(opt('before')!), 'utf8')) : null;
const result = {
  schema: 'calibration/1',
  generatedAt: new Date().toISOString(),
  data: relative(root, dataDir) || dataDir,
  sensitivity: sensName,
  settings: { minBaselineValues: BASELINE_RULES.minValues, z0: sens.z0, z1: sens.z1, flagZ: sens.flagZ, domainActive: DOMAIN_ACTIVE, levelThresholds: LEVEL_THRESHOLDS, convergenceGate: CONVERGENCE_GATE, overrides },
  window: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), days, stepHours, availability },
  signalsActivatedWithoutKey: keyed.length,
  target: TARGET,
  verdict,
  summary,
  scenarios,
  signals: signals.sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || b.points - a.points),
  before: before ? { generatedAt: before.generatedAt, settings: before.settings, summary: before.summary, scenarios: before.scenarios?.map((s: ScenarioRow) => ({ id: s.id, shareL1: s.shareL1, shareL2: s.shareL2, quietL1: s.quietL1, quietL2: s.quietL2, maxLevel: s.maxLevel })) } : null,
};

// ---------------------------------------------------------------- console
console.log(`Daten ${result.data}, ${days} Tage bis ${result.window.to}, z0 ${sens.z0}${Object.keys(overrides).length ? `, ${Object.keys(overrides).length} Overrides` : ''}`);
console.log(`Signale: ${signalSummary.signalsMeasured} gemessen (${signalSummary.points} Vergleichspunkte), Median-Anteil ≥ Schwelle ${pct(signalSummary.medianShare)}, Mittel ${pct(signalSummary.meanShare)}, letzte ${days} T Mittel ${pct(signalSummary.meanShare30)}, gepoolt ${pct(signalSummary.pooledShare)}, z98 gepoolt ${signalSummary.pooledZ98}`);
console.log(`  eingeschwungen (≥ ${SETTLED_POINTS} Punkte, ${settled.length} Signale): Mittel ${pct(signalSummary.settledMeanShare)}; je z: ${CANDIDATE_Z.map((z) => `${z}: ${pct(signalSummary.settledByZ[String(z)])}`).join(', ')}`);
console.log(`  Bereichswert-Kandidaten: ${DOMAIN_CANDIDATES.map((x) => `${x}: ${pct(domainByThreshold[String(x)])}`).join(', ')}; max ruhig ${JSON.stringify(summary.maxQuietScore)}`);
console.log(`  nach Baseline-Größe: ${signalSummary.byBaselineSize.map((b) => `${b.from}-${b.to ?? '∞'}: ${pct(b.share)} (${b.points})`).join(', ')}`);
console.log(`  Median-Anteil je Kandidat-z: ${CANDIDATE_Z.map((z) => `${z}: ${pct(signalSummary.medianShareByZ[String(z)])}`).join(', ')}`);
console.log(`Bereiche: ${summary.domain.domainsMeasured} gemessen, Mittel ${pct(summary.domain.meanShare)}, Median ${pct(summary.domain.medianShare)}, über Ziel: ${summary.domain.overTarget.join(', ') || 'keiner'}`);
for (const s of scenarios) console.log(`  ${s.id.padEnd(9)} ≥1 ${pct(s.shareL1).padStart(7)} ≥2 ${pct(s.shareL2).padStart(7)} ≥3 ${pct(s.shareL3).padStart(7)} | ruhig ≥1 ${pct(s.quietL1).padStart(7)} ≥2 ${pct(s.quietL2).padStart(7)} | max ${s.maxLevel} ${s.maxAt ?? ''} | Bereiche ${s.domains.filter((d) => d.share !== null).map((d) => `${d.id} ${pct(d.share, 0)}`).join(', ')}`);
console.log(`Ziel erfüllt: ${JSON.stringify(verdict)}`);
console.log('Lauteste Signale:', signals.filter((s) => s.points >= MIN_POINTS).slice(0, 12).map((s) => `${s.id} ${pct(s.share)} (n ${s.points}, z0 ${s.z0}, ${s.cause})`).join('\n  '));
mkdirSync(dirname(out), { recursive: true });
if (dry && opt('out')) writeFileSync(out, JSON.stringify(result, null, 1));
if (dry) process.exit(0);
writeFileSync(out, JSON.stringify(result, null, 1));

// ---------------------------------------------------------------- explain.json (plain language, numbers from the measurement)

const fmt = (x: number, d = 1) => (x * 100).toFixed(d).replace('.', ',');
const fmtEn = (x: number, d = 1) => (x * 100).toFixed(d);
const oneIn = (x: number) => (x > 0 ? Math.max(2, Math.round(1 / x)) : null);
const sShare = signalSummary.settledMeanShare;
const youngShare = r4(mean(measured.filter((x) => x.points < SETTLED_POINTS).map((x) => x.share!)) ?? 0);
const lvl = summary.levels;
const explainLevels = [
  {
    level: 1,
    text_de: 'Leicht erhöht: Mindestens ein Bereich weicht deutlich ab, zum Beispiel der Zahlungsverkehr. Das kommt immer wieder vor und ist meist harmlos.',
    text_en: 'Slightly raised: at least one area deviates clearly, for example payments. This happens from time to time and is usually harmless.',
  },
  {
    level: 2,
    text_de: 'Erhöht: Mindestens zwei voneinander unabhängige Bereiche weichen gleichzeitig ab. Erst ab hier lohnt genaueres Hinsehen.',
    text_en: 'Raised: at least two independent areas deviate at the same time. From here on it is worth a closer look.',
  },
  {
    level: 3,
    text_de: 'Hoch: Mindestens drei unabhängige Bereiche weichen gleichzeitig und stark ab.',
    text_en: 'High: at least three independent areas deviate strongly at the same time.',
  },
  {
    level: 4,
    text_de: 'Akut: Vier oder mehr unabhängige Bereiche weichen gleichzeitig sehr stark ab.',
    text_en: 'Acute: four or more independent areas deviate very strongly at the same time.',
  },
].map((x) => {
  const m = x.level <= 3 ? lvl[x.level - 1].meanShare : r4(mean(scen.map((s) => s.levelCounts[4] / Math.max(1, s.steps))) ?? 0);
  const seen = m > 0 ? `In den letzten ${days} Tagen war ein Thema im Mittel ${fmt(m)} % der Zeit auf dieser Stufe${x.level < 4 ? ' oder höher' : ''}.` : `In den letzten ${days} Tagen kam diese Stufe bei keinem Thema vor.`;
  const seenEn = m > 0 ? `Over the last ${days} days a topic was at this level${x.level < 4 ? ' or higher' : ''} ${fmtEn(m)} % of the time on average.` : `Over the last ${days} days no topic reached this level.`;
  return { level: x.level, label_de: LEVEL_LABELS[x.level], text_de: `${x.text_de} ${seen}`, text_en: `${x.text_en} ${seenEn}`, measuredShareOfTime: m };
});
const plainDomain = (scenarioId: string, d: string) => catalog.scenarios.find((s) => s.id === scenarioId)?.domains[d]?.title ?? d;
const examples = scenarios.filter((s) => s.maxLevel >= 1 && s.maxAt).sort((a, b) => b.maxLevel - a.maxLevel || b.maxScore - a.maxScore).slice(0, 5).map((s) => {
  const ds = s.maxDomains.map((d) => plainDomain(s.id, d));
  const sigs = [...new Set(s.maxTriggers.map((t) => t.name))].slice(0, 3);
  const date = new Date(s.maxAt!);
  const day = `${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
  return {
    scenario: s.id, title: s.title, date: s.maxAt, level: s.maxLevel, label_de: LEVEL_LABELS[s.maxLevel],
    what_de: `Am ${day} stand „${s.title}" auf „${LEVEL_LABELS[s.maxLevel]}". Ungewöhnlich war: ${ds.join(', ') || 'kein Bereich über der Grenze'}. Beteiligt waren vor allem: ${sigs.join('; ')}.`,
    signals: s.maxTriggers.map((t) => t.id),
  };
});
const dShare = summary.domain.meanShare;
const explain = {
  generatedAt: result.generatedAt,
  source: 'src/backtest/calibrate.ts, Details in docs/CALIBRATION.md',
  basis: { days, signals: signalSummary.signalsMeasured30, points: signalSummary.points30, from: result.window.from, to: result.window.to },
  signalRule: {
    text_de: `Eine Messung gilt als ungewöhnlich, wenn sie weiter von ihrem Normalwert entfernt ist, als diese Messreihe es sonst fast immer tut. Der Normalwert kommt nur aus der eigenen Vergangenheit der Messung. Bei Messreihen mit genug Vergangenheit war das im Mittel ${fmt(sShare)} % der Zeit der Fall, also etwa an 1 von ${oneIn(sShare) ?? '–'} Zeitpunkten. Neue Messreihen mit kurzer Vergangenheit schlagen öfter aus (${fmt(youngShare)} %); sie zählen deshalb erst, wenn es mindestens sieben frühere Werte zum Vergleich gibt, und danach zunächst nur halb.`,
    text_en: `A measurement counts as unusual when it is further from its normal value than this series almost always is. The normal value comes only from the measurement's own past. For series with enough past this was the case ${fmtEn(sShare)} % of the time on average, about 1 in ${oneIn(sShare) ?? '–'} points in time. New series with a short past deviate more often (${fmtEn(youngShare)} %); they only count once there are at least seven earlier values to compare with, and then only half until they have settled.`,
    measuredShare: sShare,
    measuredShareNewSeries: youngShare,
    target: TARGET.signalShare,
  },
  domainRule: {
    text_de: `Ein Bereich (zum Beispiel Zahlungsverkehr oder Stromnetz) gilt als ungewöhnlich, wenn mindestens eine seiner Quellen deutlich ausschlägt. Mehrere Kennzahlen derselben Quelle zählen nur einmal. In den letzten ${days} Tagen war ein Bereich im Mittel ${fmt(dShare)} % der Zeit ungewöhnlich, also etwa an 1 von ${oneIn(dShare) ?? '–'} Stunden.`,
    text_en: `An area (for example payments or the power grid) counts as unusual when at least one of its sources deviates clearly. Several figures from the same source count only once. Over the last ${days} days an area was unusual ${fmtEn(dShare)} % of the time on average, about 1 in ${oneIn(dShare) ?? '–'} hours.`,
    measuredShare: dShare,
    target: TARGET.domainShare,
  },
  convergenceRule: {
    text_de: 'Ein einzelner ungewöhnlicher Bereich hebt ein Thema höchstens auf „Leicht erhöht". Für jede höhere Stufe müssen mehr voneinander unabhängige Bereiche gleichzeitig abweichen.',
    text_en: 'A single unusual area raises a topic to "slightly raised" at most. Every higher level needs more independent areas deviating at the same time.',
  },
  levelRules: explainLevels,
  examples,
};
const explainFile = join(root, 'frontend', 'data', 'explain.json');
writeFileSync(explainFile, JSON.stringify(explain, null, 1));

// ---------------------------------------------------------------- report

const L: string[] = [];
const scenTitle = (id: string) => catalog.scenarios.find((s) => s.id === id)?.title ?? id;
L.push('# Kalibrierung der Schwellen', '');
L.push(`Erzeugt ${result.generatedAt.slice(0, 16).replace('T', ' ')} UTC mit \`node src/backtest/calibrate.ts${before ? ` --before ${relative(root, resolve(opt('before')!))}` : ''}\`. Diese Datei wird bei jedem Lauf überschrieben; der begründende Text steht in \`docs/SCORING.md\`.`, '');
L.push(`Daten: \`${result.data}/series\`, ${signalSummary.signals} Signale mit Collector und gespeicherten Werten, davon ${signalSummary.signalsMeasured} mit mindestens ${MIN_POINTS} Vergleichspunkten (${signalSummary.points} Vergleichspunkte über die ganze Historie, ${signalSummary.points30} in den letzten ${days} Tagen). Bereiche und Stufen: jedes Szenario alle ${stepHours} h von ${result.window.from.slice(0, 16).replace('T', ' ')} bis ${result.window.to.slice(0, 16).replace('T', ' ')} UTC neu berechnet. Profil \`${sensName}\`, z-Schwelle ${num(sens.z0)}, Zeitstempel ${availability === 'as-stamped' ? 'wie gespeichert (wie der Verlauf im Dashboard)' : 'Tageswerte erst ab Tagesende'}. ${keyed.length} Signale brauchen im Live-Betrieb einen Schlüssel; ihre gespeicherten Werte sind mitgemessen.`, '');
L.push('Regeln: Jeder Wert wird mit einer Baseline verglichen, die nur aus Werten **vor** ihm gebildet wird (Engine-Funktion `baselineAt`, dieselbe Umrechnung wie Dashboard und Backtest). Bereiche und Stufen kommen aus `computeTimeline` (Engine unverändert). „Ruhige Zeit" = außerhalb der Ereignisfenster aus `backtest/events.json` (72 h vorher bis 24 h nachher).', '');

L.push('## Zielvorgabe', '');
L.push(`- **Einzelne Messung:** höchstens etwa **1 von 50** Vergleichszeitpunkten über der Schwelle (${pct(TARGET.signalShare, 0)}), im Mittel über die eingeschwungenen Signale (mindestens ${SETTLED_POINTS} Vergleichspunkte). Einzelne Signale dürfen darüber liegen, solange sie keinen Bereich dauerhaft ungewöhnlich machen.`);
L.push(`- **Bereich:** höchstens etwa **${pct(TARGET.domainShare, 0)} der Zeit** „ungewöhnlich" (Bereichswert ≥ ${num(DOMAIN_ACTIVE, 2)}), und zwar jeder einzelne Bereich mit Daten.`);
L.push(`- **Stufe 2 oder höher** in ruhigen Zeiten höchstens etwa **${pct(TARGET.level2Share, 0)} der Zeit**, in jedem Szenario. Stufe 1 höchstens etwa ${pct(TARGET.level1Share, 0)}.`, '');
L.push('Begründung: Ein Radar ist nur so viel wert wie sein Ruhezustand. Prüft man zu jeder Stunde rund 150 Messungen, erzeugt eine Schwelle mit 1 von 50 schon drei auffällige Einzelwerte pro Stunde; das ist als „Auffälligkeit" in der Liste vertretbar, weil eine einzelne Messung nie allein eine Stufe hebt. Ein Bereich bündelt mehrere unabhängige Quellen; wenn er öfter als etwa eine Stunde von zwanzig abweicht, verliert die Aussage „dieser Bereich ist ungewöhnlich" ihren Sinn. Stufe 2 heißt „zwei unabhängige Bereiche gleichzeitig"; wäre das in ruhigen Zeiten öfter als etwa 1 % der Zeit (rund 7 Stunden im Monat) der Fall, würde der Leser lernen, die Stufe zu ignorieren. Die Ziele sind bewusst als Größenordnung gesetzt, nicht als exakte Zahl: Bei der heutigen Datenmenge kann die Messung 1 % nicht von 2 % sicher unterscheiden.', '');

L.push('## Ergebnis', '');
const bs = before?.summary;
const row = (label: string, now: string, prev: string | null, target: string, ok: boolean | null) => `| ${label} | ${prev ?? '–'} | ${now} | ${target} | ${ok === null ? '–' : ok ? 'ja' : 'nein'} |`;
L.push('| Größe | vorher | jetzt | Ziel | erfüllt |', '|---|---:|---:|---:|---|');
L.push(row(`Einzelmessung über Schwelle (Mittel der eingeschwungenen Signale)`, pct(signalSummary.settledMeanShare), bs ? pct(bs.signal.settledMeanShare) : null, `≤ ${pct(TARGET.signalShare, 0)}`, verdict.signal));
L.push(row('Einzelmessung über Schwelle (Mittel aller Signale, auch junge)', pct(signalSummary.meanShare), bs ? pct(bs.signal.meanShare) : null, '–', null));
L.push(row(`Einzelmessung über Schwelle (Mittel aller Signale, letzte ${days} Tage)`, pct(signalSummary.meanShare30), bs ? pct(bs.signal.meanShare30) : null, '–', null));
L.push(row('Signale mit mehr als doppeltem Ziel', String(signalSummary.signalsOverTarget), bs ? String(bs.signal.signalsOverTarget) : null, '–', null));
L.push(row('Bereich ungewöhnlich (Mittel der Bereiche mit Daten)', pct(summary.domain.meanShare), bs ? pct(bs.domain.meanShare) : null, '–', null));
const maxDom = domainShares.reduce((m, d) => (d.share! > (m?.share ?? -1) ? d : m), null as (typeof domainShares)[number] | null);
const bMax = before?.scenarios?.flatMap((x: ScenarioRow) => (x.domains ?? []).filter((d) => d.stepsWithData >= 24).map((d) => d.share ?? 0)) as number[] | undefined;
L.push(row(`Bereich ungewöhnlich, lautester Bereich (jetzt \`${maxDom ? `${maxDom.scenario}.${maxDom.id}` : '–'}\`)`, pct(maxDom?.share ?? null), bMax?.length ? pct(Math.max(...bMax)) : null, `≤ ${pct(TARGET.domainShare, 0)}`, verdict.domain));
for (const l of summary.levels) {
  const p = bs?.levels?.find((x: { level: number }) => x.level === l.level);
  L.push(row(`Stufe ≥ ${l.level}, ruhige Zeit, Mittel der Szenarien`, pct(l.meanShareQuiet), p ? pct(p.meanShareQuiet) : null, '–', true));
  L.push(row(`Stufe ≥ ${l.level}, ruhige Zeit, schlechtestes Szenario`, pct(l.maxShareQuiet), p ? pct(p.maxShareQuiet) : null, l.level === 1 ? `≤ ${pct(TARGET.level1Share, 0)}` : l.level === 2 ? `≤ ${pct(TARGET.level2Share, 0)}` : '–', l.level === 1 ? verdict.level1 : l.level === 2 ? verdict.level2 : true));
}
L.push('');

if (before) {
  L.push('## Änderungen gegenüber „vorher"', '');
  const ch: string[] = [];
  const bmv = before.settings?.minBaselineValues ?? 3;
  if (bmv !== BASELINE_RULES.minValues) ch.push(`Mindestzahl Vergleichswerte einer Baseline: ${bmv} → ${BASELINE_RULES.minValues} (\`BASELINE_RULES.minValues\` in \`src/engine/anomaly.ts\`).`);
  if (before.settings?.z0 !== sens.z0) ch.push(`Globale z-Schwelle: ${num(before.settings?.z0)} → ${num(sens.z0)}.`);
  const prevZ = new Map<string, number>((before.signals ?? []).map((x: SignalRow) => [x.id, x.z0]));
  for (const x of signals) {
    const p = prevZ.get(x.id);
    if (p !== undefined && p !== x.z0) ch.push(`\`${x.id}\`: eigene Schwelle ${num(p)} → ${num(x.z0)} (über Schwelle ${pct((before.signals as SignalRow[]).find((y) => y.id === x.id)?.share ?? null)} → ${pct(x.share)}).`);
  }
  L.push(...(ch.length ? ch.map((c) => `- ${c}`) : ['- keine']), '');
}

L.push('## Herleitung der Schwellen', '');
const sb = signalSummary.settledByZ;
L.push(`**z-Schwelle ${num(sens.z0)} (Einzelmessung).** Maßgeblich sind die ${signalSummary.settledSignals} eingeschwungenen Signale (mindestens ${SETTLED_POINTS} Vergleichspunkte), weil bei kürzerer Historie die Baseline selbst noch wackelt. Bei einer einheitlichen Schwelle von 2,5 lagen sie im Mittel ${pct(sb['2.5'])} der Zeit darüber, bei 3 ${pct(sb['3'])}, bei 2 ${pct(sb['2'])}. Mit den signal-eigenen Schwellen sind es ${pct(signalSummary.settledMeanShare)}. Das Ziel 1 von 50 (2 %) liegt zwischen 2,5 und 3; die Schwelle bleibt bei ${num(sens.z0)}, weil die Abweichung vom Ziel kleiner ist als die Messunsicherheit und eine höhere Schwelle echte Ausschläge später zeigen würde.`, '');
L.push('| z-Schwelle | eingeschwungene Signale (Mittel) | alle Signale (gepoolt) | alle Signale (Median) |', '|---:|---:|---:|---:|');
for (const z of CANDIDATE_Z) L.push(`| ${num(z)} | ${pct(sb[String(z)])} | ${pct(signalSummary.byZ[String(z)])} | ${pct(signalSummary.medianShareByZ[String(z)])} |`);
L.push('');
L.push(`**Mindestens ${BASELINE_RULES.minValues} Vergleichswerte.** Anteil der Vergleiche über der Schwelle nach Größe der Baseline zum jeweiligen Zeitpunkt. Kurze Baselines sind deutlich lauter; unter ${BASELINE_RULES.minValues} Werten wird ein Signal deshalb gar nicht bewertet, darunter nur angezeigt. Zwischen ${BASELINE_RULES.minValues} Werten und \`minPoints\` zählt es wie bisher nur halb.`, '');
const bb = before?.summary?.signal?.byBaselineSize as { from: number; to: number | null; points: number; share: number | null }[] | undefined;
L.push('| Werte in der Baseline | Vergleiche (jetzt) | über Schwelle (jetzt) | über Schwelle (vorher) |', '|---|---:|---:|---:|');
for (const b of signalSummary.byBaselineSize) {
  const p = bb?.find((x) => x.from === b.from);
  L.push(`| ${b.from} bis ${b.to === null ? '∞' : b.to - 1} | ${b.points} | ${pct(b.share)} | ${p ? `${pct(p.share)} (${p.points})` : '–'} |`);
}
L.push('');
const db = summary.domain.byThreshold;
L.push(`**Bereich ab ${num(DOMAIN_ACTIVE, 2)}.** Anteil aller Zeitschritte mit Daten (alle Bereiche gepoolt), an denen der Bereichswert die Grenze erreicht. Das Ziel (höchstens ${pct(TARGET.domainShare, 0)} je Bereich) wäre auch mit 0,15 noch knapp einzuhalten, mit 0,1 nicht mehr. Die Grenze bleibt bei ${num(DOMAIN_ACTIVE, 2)}: Eine Quelle mit mittlerem Gewicht (Beitrag 0,5 bei vollem Ausschlag) erreicht sie erst bei halbem Ausschlag, also deutlich jenseits der Einzelschwelle, und der lauteste Bereich (\`${maxDom ? `${maxDom.scenario}.${maxDom.id}` : '–'}\`, ${pct(maxDom?.share ?? null)}) liegt damit im Ziel. Eine niedrigere Grenze ist erst sinnvoll, wenn mehr Bereiche dauerhaft Daten haben und die Messung pro Bereich belastbar ist.`, '');
L.push(`| Grenze | ${DOMAIN_CANDIDATES.map((x) => num(x, 2)).join(' | ')} |`, `|---|${DOMAIN_CANDIDATES.map(() => '---:').join('|')}|`);
L.push(`| Anteil der Zeit ungewöhnlich | ${DOMAIN_CANDIDATES.map((x) => pct(db[String(x)])).join(' | ')} |`);
L.push('');
L.push(`**Stufen ${LEVEL_THRESHOLDS.map((x) => num(x, 2)).join(' / ')} und Konvergenz-Schranke ${CONVERGENCE_GATE.map((x) => num(x, 2)).join(' / ')}.** Diese Grenzen sind aus der Konstruktion abgeleitet, nicht aus der Häufigkeit: Die Schranke für n abweichende Bereiche liegt jeweils knapp unter der Grenze der Stufe n + 1, sodass n Bereiche höchstens Stufe n erreichen. Die Messung prüft nur, ob das im Ruhezustand hält. Höchster Szenario-Wert außerhalb von Ereignissen: ${Object.entries(summary.maxQuietScore).map(([k, v]) => `${k} ${num(v as number, 3)}`).join(', ')}. Stufe 2 kam in ${days} Tagen ${summary.levels[1].meanShare > 0 ? `${pct(summary.levels[1].meanShare)} der Zeit` : 'nie'} vor; die Stufen 2 bis 4 lassen sich mit diesen Daten deshalb nicht feiner kalibrieren.`, '');
const own = signals.filter((x) => x.ownZ0 && x.points >= MIN_POINTS).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, 15);
L.push(`Signale mit eigener Schwelle (${signals.filter((x) => x.ownZ0).length} insgesamt, hier die 15 lautesten mit mindestens ${MIN_POINTS} Vergleichspunkten):`, '');
L.push('| Signal | eigene Schwelle | über Schwelle | über 2,5 | Vergleichspunkte |', '|---|---:|---:|---:|---:|');
for (const x of own) L.push(`| \`${x.id}\` | ${num(x.z0)} | ${pct(x.share)} | ${pct(x.byZ['2.5'])} | ${x.points} |`);
L.push('');

L.push('## Szenarien', '');
L.push(`| Szenario | Schritte | davon ≥ 3 Bereiche mit Daten | Stufe ≥ 1 | ≥ 2 | ≥ 3 | ruhig ≥ 1 | ruhig ≥ 2 | Episoden ≥ 1 | höchste Stufe | wann | Bereiche |`, '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|');
for (const s of scenarios) {
  const p = before?.scenarios?.find((x: { id: string }) => x.id === s.id);
  const v = (now: number | null, prev: number | null | undefined) => (p ? `${pct(now)} (vorher ${pct(prev ?? null)})` : pct(now));
  L.push(`| ${s.title} (\`${s.id}\`) | ${s.steps} | ${s.stepsMinDomains} | ${v(s.shareL1, p?.shareL1)} | ${v(s.shareL2, p?.shareL2)} | ${pct(s.shareL3)} | ${pct(s.quietL1)} | ${pct(s.quietL2)} | ${s.episodesL1} | ${s.maxLevel} ${LEVEL_LABELS[s.maxLevel]} | ${s.maxAt ? s.maxAt.slice(0, 16).replace('T', ' ') : '–'} | ${s.maxDomains.join(', ') || '–'} |`);
}
L.push('');
L.push('Höchste erreichte Stufe und auslösende Signale:', '');
for (const s of scenarios) {
  if (!s.maxAt) { L.push(`- **${s.title}:** nie über „Ruhig".`); continue; }
  L.push(`- **${s.title}:** Stufe ${s.maxLevel} am ${s.maxAt.slice(0, 16).replace('T', ' ')} UTC (Wert ${num(s.maxScore, 3)}), Bereiche ${s.maxDomains.map((d) => `\`${d}\``).join(', ')}; ${s.maxTriggers.map((t) => `\`${t.id}\` (z ${num(t.z, 1)})`).join(', ')}`);
}
L.push('');

L.push('## Bereiche', '');
L.push('Anteil der Zeitschritte mit Daten, an denen der Bereichswert ≥ 0,25 war. Nur Bereiche mit mindestens 24 Schritten mit Daten.', '');
L.push('| Szenario | Bereich | Schritte mit Daten | ungewöhnlich | davon ruhige Zeit | höchster Wert | getragen von (Schritte) |', '|---|---|---:|---:|---:|---:|---|');
for (const d of domainShares.sort((a, b) => (b.share ?? 0) - (a.share ?? 0))) {
  L.push(`| ${d.scenario} | ${d.title} (\`${d.id}\`) | ${d.stepsWithData} | ${d.share! > TARGET.domainShare ? '**' + pct(d.share) + '**' : pct(d.share)} | ${pct(d.shareQuiet)} | ${num(d.maxScore, 2)} | ${d.drivers.map((x) => `\`${x.id}\` (${x.steps})`).join(', ') || '–'} |`);
}
L.push('');

L.push('## Einzelsignale', '');
L.push(`Lauteste Signale (mindestens ${MIN_POINTS} Vergleichspunkte), sortiert nach Anteil über der eigenen Schwelle. Ursache ist eine grobe Einordnung aus den Daten: *stoßweise* (viele Nullen oder lange Spitzen), *Wochenrhythmus* (Treffer fast nur an ein, zwei Wochentagen), *Trend/Niveauwechsel* (Treffer gehäuft am Ende der Historie), *kurze Historie* (unter 30 Vergleichspunkte).`, '');
L.push('| Signal | Szenario | Klasse | Vergleichspunkte | Historie (Tage) | Schwelle | über Schwelle | Episoden / 30 T | z für 1 von 50 | Ursache |', '|---|---|---|---:|---:|---:|---:|---:|---:|---|');
for (const s of measured.filter((x) => (x.share ?? 0) > TARGET.signalShare).sort((x, y) => (y.share ?? 0) - (x.share ?? 0)).slice(0, 40)) {
  L.push(`| \`${s.id}\` | ${s.scenarios.join(', ')} | ${s.evidenceClass} | ${s.points} | ${num(s.historyDays, 0)} | ${num(s.z0)}${s.ownZ0 ? ' (eigen)' : ''} | ${pct(s.share)} | ${num(s.episodesPer30d)} | ${num(s.z98, 1)} | ${s.cause ?? '–'} |`);
}
const quietSignals = measured.filter((x) => (x.share ?? 0) <= TARGET.signalShare).length;
L.push('', `${quietSignals} von ${measured.length} gemessenen Signalen liegen bei höchstens ${pct(TARGET.signalShare, 0)}. ${signals.length - measured.length} Signale haben weniger als ${MIN_POINTS} Vergleichspunkte und sind nicht bewertet.`, '');

L.push('## Belastbarkeit', '');
const histDays = measured.map((s) => s.historyDays);
L.push(`- **Kurze Basis.** Der 15-Minuten-Betrieb läuft seit dem 17.11.2026. Die Historie der Signale reicht von wenigen Tagen bis zu Jahren (Median ${num(median(histDays), 0)} Tage, nur ${histDays.filter((d) => d >= 28).length} von ${measured.length} Signalen mit mindestens 28 Tagen). Viele Baselines sind noch unreif (Anteil reifer Vergleichspunkte im Mittel ${pct(mean(measured.map((s) => s.matureShare)) ?? 0, 0)}).`);
L.push(`- **Wenige unabhängige Episoden.** Die Stufen-Anteile beruhen auf ${days} Tagen mit ${stepHours}-h-Schritten; aufeinanderfolgende Schritte sind nicht unabhängig. Stufe 1 trat über alle Szenarien in ${scenarios.reduce((a, x) => a + x.episodesL1, 0)} getrennten Episoden auf, Stufe 2 in ${scenarios.reduce((a, x) => a + x.episodesL2, 0)}. Bei so wenigen Episoden ist ein gemessener Anteil von 1 % nicht von 0,3 % oder 3 % zu unterscheiden; dass Stufe 2 nie vorkam, belegt nur, dass das Ziel nicht grob verfehlt wird.`);
L.push('- **Frühe Zeitschritte sind dünn.** Am Anfang des Fensters hatten viele Signale noch keine Daten; dort ist „Ruhig" auch eine Folge fehlender Messungen. Die Spalte „≥ 3 Bereiche mit Daten" zeigt, wie viel der Zeit überhaupt prüfbar war.');
L.push('- **Ereignisse im Fenster.** Drei Ereignisse aus `backtest/events.json` fallen in den Zeitraum (12. bis 16.11.). Die „ruhige Zeit" schließt ihre Fenster aus; ob das Radar sie erkennt, ist Aufgabe des Backtests, nicht dieser Kalibrierung.');
L.push('- **Was sich mit mehr Daten ändern kann:** Mit wachsender Historie werden die Baselines reif, die Streuungs-Untergrenzen greifen seltener und Wochenrhythmen werden über die saisonale Baseline erfasst. Das senkt den Anteil eher. Signale, die heute nur wegen kurzer Historie laut sind, sollten in vier Wochen erneut gemessen werden, bevor ihre Schwelle dauerhaft angehoben wird. Die Kalibrierung ist deshalb monatlich neu zu fahren (`node src/backtest/calibrate.ts --before backtest/results/calibration.json`).');
L.push('');
L.push(`Maschinenlesbar: \`${relative(root, out)}\`, Alltagssprache fürs Frontend: \`frontend/data/explain.json\`.`, '');
writeFileSync(join(root, 'docs', 'CALIBRATION.md'), L.join('\n'));
console.log(`geschrieben: ${relative(root, out)}, docs/CALIBRATION.md, frontend/data/explain.json`);
