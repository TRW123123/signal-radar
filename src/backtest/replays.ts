// Replays for the frontend time machine: compact frames built from backtest results (run.ts with per-signal details).
// Pure functions; the CLI export-replays.ts does the I/O. Nothing here scores: level, attention, active domains,
// z and anomaly are copied from the result, which the unchanged engine produced.

import type { GeoRef, SignalDef } from '../core/types.ts';
import { type BacktestResult, HOUR } from './lib.ts';

export const MAX_SIGNALS_PER_FRAME = 40;
/** every replay file must stay below this many bytes */
export const MAX_BYTES = 150_000;
/** single measurement counts as "auffällig" from this anomaly on (0..1 ramp of the engine) */
export const NOTABLE_ANOMALY = 0.25;
/** attention counts as "auffällig" from here (same threshold as rumorGap talk-no-data in docs/SCORING.md) */
export const NOTABLE_ATTENTION = 0.35;

export type SawIt = 'ja' | 'teilweise' | 'nein';

export interface ReplaySignal {
  id: string;
  name: string;
  domain: string;
  anomaly: number;
  z: number | null;
  value: number | null;
  geo?: GeoRef;
}

export interface ReplayFrame {
  t: string;
  level: number;
  attention: number;
  activeDomains: string[];
  signals: ReplaySignal[];
}

export interface Replay {
  id: string;
  scenario: string;
  start: string;
  end: string;
  /** null for replays without an event (recent live data) */
  eventStart: string | null;
  stepHours: number;
  /** signals per frame actually kept (≤ MAX_SIGNALS_PER_FRAME; lowered if the file would exceed MAX_BYTES) */
  maxSignalsPerFrame: number;
  source: string;
  /** first frame at the highest level (from the judged result grid), null if the level stayed 0 */
  peakAt: string | null;
  frames: ReplayFrame[];
}

export interface ReplayIndexEntry {
  id: string;
  kind: 'event' | 'control' | 'recent';
  title_de: string;
  title_en: string;
  date: string;
  scenario: string;
  summary_de: string;
  summary_en: string;
  /** verdict; absent for kind "recent" (not an event, no judgement) */
  sawIt?: SawIt;
  /** only for kind "control": quiet = stayed calm (as it should), false-alarm = level rose to 1 or more without a known event */
  control?: 'quiet' | 'false-alarm';
  /** highest level from the event start to the end of the window (0..4) */
  maxLevel: number;
  /** hours from the event start to the first rise of the level to 1 or more, null if none */
  firstSeenHours: number | null;
  /** ISO time of the first step at the highest level (null if the level stayed 0); this frame is in the replay */
  peakAt: string | null;
  stepHours: number;
  steps: number;
}

export interface BuildOptions {
  from: number;
  to: number;
  stepHours: number;
  eventStart: string | null;
  id: string;
  maxSignals?: number;
  /** time (ms) that must be a frame, e.g. the peak; default: the event start */
  anchor?: number;
  peakAt?: string | null;
}

/** most frames per event replay; above this the step grows (3 → 6 → 12 → 24 h) instead of cutting the window */
export const MAX_FRAMES = 60;
export const PRE_HOURS = 48;
export const MIN_POST_HOURS = 72;

/**
 * Window of an event replay: PRE_HOURS before the start up to at least 1 day after the peak (and at least MIN_POST_HOURS
 * after the start), never past the last computed step. The step is the smallest multiple of the result grid
 * (3, 6, 12, 24 h) that keeps the frames at or below MAX_FRAMES.
 */
export function replayWindow(resStepHours: number, startMs: number, peakMs: number | null, lastStepMs: number): { from: number; to: number; stepHours: number } {
  const from = startMs - PRE_HOURS * HOUR;
  const to = Math.min(lastStepMs, Math.max(startMs + MIN_POST_HOURS * HOUR, (peakMs ?? startMs) + 24 * HOUR));
  const steps = [3, 6, 12, 24].map((h) => Math.max(resStepHours, Math.ceil(h / resStepHours) * resStepHours));
  const stepHours = steps.find((h) => Math.floor((to - from) / (h * HOUR)) + 1 <= MAX_FRAMES) ?? steps[steps.length - 1];
  return { from, to, stepHours };
}

/** Frames every stepHours inside [from, to], taken from the result steps (which must lie on a finer or equal grid). */
export function buildReplay(res: BacktestResult, defs: Map<string, SignalDef>, o: BuildOptions): Replay {
  const maxSignals = o.maxSignals ?? MAX_SIGNALS_PER_FRAME;
  const step = o.stepHours * HOUR;
  const inRange = res.steps.filter((s) => {
    const t = Date.parse(s.t);
    return t >= o.from && t <= o.to;
  });
  // keep steps on the grid anchored at the event start (or at the last step when there is no event)
  const anchor = o.anchor ?? (o.eventStart ? Date.parse(o.eventStart) : inRange.length ? Date.parse(inRange[inRange.length - 1].t) : 0);
  const onGrid = inRange.filter((s) => (((Date.parse(s.t) - anchor) % step) + step) % step === 0);
  // if the result grid does not hit the anchored grid (e.g. steps at :59), fall back to every n-th step through the
  // step nearest the anchor
  const ratio = Math.max(1, Math.round(step / (res.stepHours * HOUR)));
  let ai = 0;
  inRange.forEach((s, i) => { if (Math.abs(Date.parse(s.t) - anchor) < Math.abs(Date.parse(inRange[ai].t) - anchor)) ai = i; });
  const picked = onGrid.length * ratio >= inRange.length * 0.8 ? onGrid : inRange.filter((_, i) => (((i - ai) % ratio) + ratio) % ratio === 0);
  const frames: ReplayFrame[] = picked.map((s) => {
    if (!s.v) throw new Error(`${o.id}: Ergebnis ohne Signalwerte (run.ts mit --details bzw. --history neu laufen lassen)`);
    const sigs: ReplaySignal[] = s.v.map(([i, value, z, anomaly]) => {
      const sum = res.signals[i];
      const def = defs.get(sum.id);
      return { id: sum.id, name: def?.name ?? sum.name, domain: sum.domain, anomaly, z, value, ...(def?.geo ? { geo: def.geo } : {}) };
    });
    // strongest first, then signals with a place (the globe needs points), then by |z|, then by id for stable output
    sigs.sort((a, b) => b.anomaly - a.anomaly || Number(!!b.geo) - Number(!!a.geo) || Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0) || a.id.localeCompare(b.id));
    return { t: s.t, level: s.level, attention: s.attention, activeDomains: s.activeDomains, signals: sigs.slice(0, maxSignals) };
  });
  return {
    id: o.id, scenario: res.scenario, start: frames[0]?.t ?? new Date(o.from).toISOString(), end: frames[frames.length - 1]?.t ?? new Date(o.to).toISOString(),
    eventStart: o.eventStart, stepHours: o.stepHours, maxSignalsPerFrame: maxSignals, source: res.source, peakAt: o.peakAt ?? null, frames,
  };
}

/** Lowers the signals per frame until the serialised replay is below MAX_BYTES. */
export function fitReplay(res: BacktestResult, defs: Map<string, SignalDef>, o: BuildOptions, maxBytes = MAX_BYTES): { replay: Replay; json: string } {
  for (let n = o.maxSignals ?? MAX_SIGNALS_PER_FRAME; n >= 1; n = n > 10 ? n - 5 : n - 1) {
    const replay = buildReplay(res, defs, { ...o, maxSignals: n });
    const json = JSON.stringify(replay);
    if (Buffer.byteLength(json) < maxBytes) return { replay, json };
  }
  throw new Error(`${o.id}: auch mit 1 Signal je Frame über ${maxBytes} Bytes`);
}

export interface SawItInput {
  frames: ReplayFrame[];
  eventStart: string | null;
  eventEnd: string | null;
  /** domains in which the event should show; empty = every domain counts */
  expectedDomains?: string[];
  preHours?: number;
  postHours?: number;
  /** quiet period without a known event: never "teilweise", result carries `control` instead */
  control?: boolean;
  /**
   * per signal id: number of excursions (anomaly >= NOTABLE_ANOMALY) in the 4 weeks before the window (see priorNoiseCounts).
   * A swing before the event start counts as a lead only if its signal was quiet then (count 0); without this
   * information (undefined) every swing before the start is treated as noise.
   */
  priorNoise?: Map<string, number>;
}

export interface SawItResult {
  sawIt: SawIt;
  maxLevel: number;
  maxAttention: number;
  /** hours from event start to the first frame with a level rise from measured domains (ja) */
  firstLevelHours: number | null;
  /** hours from event start to the first rise of the level to 1 or more (any domain), null if none */
  firstSeenHours: number | null;
  /** level reached at that first rise */
  firstSeenLevel: number;
  /** first frame at the highest level (null if the level stayed 0) and its hours from the event start */
  peakAt: string | null;
  peakHours: number | null;
  /** names of the notable measurements in the active domains at the first rise, and the ones added at the peak */
  firstDrivers: string[];
  peakDrivers: string[];
  /** highest level in the frames before the event start (0 without an event) */
  preLevel: number;
  /** notable single measurements in the window: strongest anomaly and first time */
  notable: { id: string; name: string; domain: string; anomaly: number; z: number | null; firstHours: number | null }[];
  /** swings before the event start whose signal also swung in the 4 weeks before: noise, not a lead */
  preNoise: { id: string; name: string; firstHours: number | null }[];
  /** the level rose only through one single measurement that also swung before without an event */
  weak: { id: string; name: string } | null;
  control: 'quiet' | 'false-alarm' | null;
  attentionNotable: boolean;
}

/** Excursions per signal (rising edges of anomaly >= NOTABLE_ANOMALY) in [start - weeks, start - preHours) of a backtest result. */
export function priorNoiseCounts(res: BacktestResult, startMs: number, weeks = 4, preHours = 24): Map<string, number> {
  const from = startMs - weeks * 7 * 24 * HOUR;
  const to = startMs - preHours * HOUR;
  const counts = new Map<string, number>();
  let prev = new Set<string>();
  for (const st of res.steps) {
    const t = Date.parse(st.t);
    if (t < from || t >= to || !st.v) continue;
    const now = new Set<string>();
    for (const [i, , , anomaly] of st.v) {
      if (anomaly < NOTABLE_ANOMALY) continue;
      const id = res.signals[i].id;
      now.add(id);
      if (!prev.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    prev = now;
  }
  return counts;
}

/**
 * Only changes from the event start on count as "seen": the first rise of the level at or after the start (a swing before the
 * start is named only if its signal was quiet in the 4 weeks before; otherwise it is noise, listed in `preNoise`).
 * „ja“: from the start to postHours after the end the level rose to 1 or more and at least one domain was above the
 * "weicht ab" threshold, i.e. the rise came from measured domains. Exception: if the rise came through one single
 * measurement that also swung before without an event, the result is „teilweise“ with `weak` set.
 * „teilweise“: no such rise, but single measurements (anomaly >= NOTABLE_ANOMALY, in an expected domain if any are
 * given; the excursion must begin inside the window, from preHours before the start) or the attention value
 * (>= NOTABLE_ATTENTION) were notable. Otherwise „nein“.
 * Control windows (quiet periods) are always „nein“; `control` is "false-alarm" if the level rose, else "quiet".
 * Without an event (recent), the whole replay is the window.
 */
export function judgeSawIt(x: SawItInput): SawItResult {
  const pre = (x.preHours ?? 24) * HOUR;
  const post = (x.postHours ?? 24) * HOUR;
  const start = x.eventStart ? Date.parse(x.eventStart) : null;
  const end = x.eventEnd ? Date.parse(x.eventEnd) : start;
  const inWin = (t: string) => {
    if (start === null) return true;
    const ms = Date.parse(t);
    return ms >= start - pre && ms <= (end ?? start) + post;
  };
  // a step less than half a grid step before the start cannot be told apart from the start (the grid is the resolution)
  const gap = x.frames.length > 1 ? Math.min(...x.frames.slice(1).map((f, i) => Date.parse(f.t) - Date.parse(x.frames[i].t)).filter((d) => d > 0)) : 0;
  const tol = Number.isFinite(gap) ? gap / 2 : 0;
  const afterStart = (t: string) => start === null || (Date.parse(t) >= start - tol && Date.parse(t) <= (end ?? start) + post);
  const pw = x.frames.filter((f) => afterStart(f.t));
  const rel = (t: string) => (start === null ? null : Math.round((Date.parse(t) - start) / HOUR));
  const exp = x.expectedDomains ?? [];
  const notableIds = (f: ReplayFrame | undefined) => new Set((f?.signals ?? []).filter((s) => s.anomaly >= NOTABLE_ANOMALY).map((s) => s.id));
  // first rise of the level inside the post-start window: level above the previous frame, or a newly notable measurement
  let firstSeen: ReplayFrame | undefined;
  let rise: ReplayFrame | undefined;
  for (const f of pw) {
    const i = x.frames.indexOf(f);
    const prev = i > 0 ? x.frames[i - 1] : undefined;
    const before = notableIds(prev);
    const fresh = [...notableIds(f)].some((id) => !before.has(id));
    const isRise = start === null ? f.level >= 1 : f.level >= 1 && ((prev?.level ?? 0) < f.level || fresh);
    if (!isRise) continue;
    firstSeen ??= f;
    if (f.activeDomains.length > 0) { rise = f; break; }
  }
  // a notable single measurement counts only if its excursion begins inside the window: a deviation that started
  // days earlier and is still held (holdHours) is not a reaction to the event
  const notable = new Map<string, SawItResult['notable'][number]>();
  const preNoise = new Map<string, SawItResult['preNoise'][number]>();
  const wasNotable = new Set<string>();
  for (const f of x.frames) {
    const now = new Set<string>();
    for (const s of f.signals) {
      if (s.anomaly < NOTABLE_ANOMALY) continue;
      now.add(s.id);
      if (exp.length && !exp.includes(s.domain)) continue;
      const prev = notable.get(s.id);
      if (prev) { if (inWin(f.t) && s.anomaly > prev.anomaly) { prev.anomaly = s.anomaly; prev.z = s.z; } continue; }
      if (preNoise.has(s.id)) continue;
      if (!wasNotable.has(s.id) && inWin(f.t)) {
        const h = rel(f.t);
        const early = h !== null && start !== null && Date.parse(f.t) < start - tol;
        if (early && (x.priorNoise ? (x.priorNoise.get(s.id) ?? 0) : 1) > 0) preNoise.set(s.id, { id: s.id, name: s.name, firstHours: h });
        else notable.set(s.id, { id: s.id, name: s.name, domain: s.domain, anomaly: s.anomaly, z: s.z, firstHours: h });
      }
    }
    wasNotable.clear();
    for (const id of now) wasNotable.add(id);
  }
  const maxAttention = pw.reduce((m, f) => Math.max(m, f.attention), 0);
  const attentionNotable = maxAttention >= NOTABLE_ATTENTION;
  const maxLevel = pw.reduce((m, f) => Math.max(m, f.level), 0);
  const peak = maxLevel > 0 ? pw.find((f) => f.level === maxLevel) : undefined;
  const drivers = (f: ReplayFrame | undefined) => (f ? f.signals.filter((s) => s.anomaly >= NOTABLE_ANOMALY && f.activeDomains.includes(s.domain)) : []);
  const firstDrivers = drivers(firstSeen);
  let peakDrivers: ReplaySignal[] = [];
  if (peak && peak !== firstSeen) {
    const known = new Set(firstDrivers.map((s) => s.id));
    const prev = x.frames[x.frames.indexOf(peak) - 1];
    const before = notableIds(prev);
    const all = drivers(peak).filter((s) => !known.has(s.id));
    peakDrivers = all.filter((s) => !before.has(s.id));
    if (!peakDrivers.length) peakDrivers = all;
  }
  const preLevel = start === null ? 0 : x.frames.filter((f) => Date.parse(f.t) < start - tol).reduce((m, f) => Math.max(m, f.level), 0);
  // weak: only one measurement in the active domains was notable after the start, and it also swung in the weeks before
  let weak: SawItResult['weak'] = null;
  if (rise && !x.control && start !== null && x.priorNoise) {
    const active = new Set(pw.filter((f) => f.level >= 1).flatMap((f) => f.activeDomains));
    const drivers = new Map<string, string>();
    for (const f of pw) for (const s of f.signals) if (s.anomaly >= NOTABLE_ANOMALY && active.has(s.domain)) drivers.set(s.id, s.name);
    if (drivers.size === 1) {
      const [id, name] = [...drivers][0];
      if ((x.priorNoise.get(id) ?? 0) > 0) weak = { id, name };
    }
  }
  const control = x.control ? (maxLevel >= 1 ? 'false-alarm' : 'quiet') : null;
  const sawIt: SawIt = x.control ? 'nein' : rise && !weak ? 'ja' : rise || notable.size || attentionNotable ? 'teilweise' : 'nein';
  return {
    sawIt, maxLevel, maxAttention,
    firstLevelHours: rise ? rel(rise.t) : null,
    firstSeenHours: firstSeen ? rel(firstSeen.t) : null,
    firstSeenLevel: firstSeen?.level ?? 0,
    peakAt: peak?.t ?? null, peakHours: peak ? rel(peak.t) : null,
    firstDrivers: firstDrivers.slice(0, 2).map((s) => s.name), peakDrivers: peakDrivers.slice(0, 2).map((s) => s.name), preLevel,
    notable: [...notable.values()].sort((a, b) => b.anomaly - a.anomaly), preNoise: [...preNoise.values()], weak, control, attentionNotable,
  };
}

export const LEVEL_DE = ['Ruhig', 'Einzelne Auffälligkeit', 'Mehrere Auffälligkeiten', 'Deutliche Häufung', 'Starke Häufung'];
export const LEVEL_EN = ['Calm', 'Single anomaly', 'Several anomalies', 'Clear cluster', 'Strong cluster'];
const PRE_NOISE_DE = 'Ausschläge davor gab es auch an gewöhnlichen Tagen und zählen nicht als Vorwarnung.';
const PRE_NOISE_EN = 'Swings before the start also occurred on ordinary days and do not count as early warning.';

function whenDe(h: number | null): string {
  if (h === null) return '';
  if (h === 0) return ' zum Beginn';
  const a = Math.abs(h);
  const d = a >= 48 ? `${Math.round(a / 24)} Tage` : a === 1 ? '1 Stunde' : `${a} Stunden`;
  return h < 0 ? ` ${d} vor Beginn` : ` ${d} nach Beginn`;
}
function whenEn(h: number | null): string {
  if (h === null) return '';
  if (h === 0) return ' at the start';
  const a = Math.abs(h);
  const d = a >= 48 ? `${Math.round(a / 24)} days` : a === 1 ? '1 hour' : `${a} hours`;
  return h < 0 ? ` ${d} before the start` : ` ${d} after the start`;
}

/** Time after the start on the 3-hour grid of the backtest: under 3 h „innerhalb der ersten 3 Stunden“, from 2 days on in days („gut“/„knapp“). */
export function afterDe(h: number): string {
  if (h < 3) return 'innerhalb der ersten 3 Stunden';
  if (h < 48) return `nach ${h} Stunden`;
  const d = h / 24;
  const n = Math.round(d);
  return Math.abs(d - n) < 0.1 ? `nach ${n} Tagen` : d > n ? `nach gut ${n} Tagen` : `nach knapp ${n} Tagen`;
}
export function afterEn(h: number): string {
  if (h < 3) return 'within the first 3 hours';
  if (h < 48) return `after ${h} hours`;
  const d = h / 24;
  const n = Math.round(d);
  return Math.abs(d - n) < 0.1 ? `after ${n} days` : d > n ? `after just over ${n} days` : `after almost ${n} days`;
}
const byDe = (names: string[], extra = false) => (names.length ? `, ${extra ? 'zusätzlich ' : ''}durch ${names.map((n) => `„${n}“`).join(' und ')}` : '');
const byEn = (names: string[], extra = false) => (names.length ? `, ${extra ? 'additionally ' : ''}through ${names.map((n) => `“${n}”`).join(' and ')}` : '');

/**
 * One or two plain sentences on what the radar would have shown, derived only from the judged frames.
 * `note` replaces the generic second sentence for „teilweise“ (e.g. why a market move is not evidence).
 */
export function summarize(j: SawItResult, ctx: { kind: 'event' | 'control' | 'recent'; measuredSignals: number; days?: number; note?: { de: string; en: string } }): { de: string; en: string } {
  const top = j.notable.slice(0, 2);
  const plural = top.length > 1;
  const namesDe = top.map((n) => `„${n.name}“${whenDe(n.firstHours)}`).join(' und ');
  const namesEn = top.map((n) => `“${n.name}”${whenEn(n.firstHours)}`).join(' and ');
  const days = ctx.days ?? 14;
  if (ctx.kind === 'recent') {
    if (j.maxLevel > 0) {
      return {
        de: `In den letzten ${days} Tagen stieg das Radar bis „${LEVEL_DE[j.maxLevel]}“, weil gemessene Bereiche abwichen.`,
        en: `Over the last ${days} days the radar rose to “${LEVEL_EN[j.maxLevel]}” because measured areas deviated.`,
      };
    }
    return {
      de: `In den letzten ${days} Tagen blieb das Radar auf „${LEVEL_DE[0]}“.${top.length ? ' Einzelne Messungen wichen kurz ab; das allein hebt die Stufe nicht.' : ''}`,
      en: `Over the last ${days} days the radar stayed “${LEVEL_EN[0]}”.${top.length ? ' Individual measurements deviated briefly; that alone does not raise the level.' : ''}`,
    };
  }
  const preDe = j.preNoise.length ? ` ${PRE_NOISE_DE}` : '';
  const preEn = j.preNoise.length ? ` ${PRE_NOISE_EN}` : '';
  const noteDe = ctx.note ? ` ${ctx.note.de}` : '';
  const noteEn = ctx.note ? ` ${ctx.note.en}` : '';
  if (j.weak) {
    return {
      de: `Das Radar stieg bis „${LEVEL_DE[j.maxLevel]}“, erstmals${whenDe(j.firstLevelHours)}, aber nur durch eine einzige Messung („${j.weak.name}“), die auch vorher an gewöhnlichen Tagen ausschlug. Das ist ein schwaches Signal, keine belastbare Erkennung.${preDe}${noteDe}`,
      en: `The radar rose to “${LEVEL_EN[j.maxLevel]}”, first${whenEn(j.firstLevelHours)}, but only through one single measurement (“${j.weak.name}”) that also swung before on ordinary days. That is a weak signal, not a reliable detection.${preEn}${noteEn}`,
    };
  }
  if (j.sawIt === 'ja' && j.firstSeenHours !== null) {
    // exactly two times from the judged frames: first rise and peak (one if both coincide)
    const h1 = Math.max(0, j.firstSeenHours);
    const two = j.peakHours !== null && j.peakHours > h1 && j.maxLevel > j.firstSeenLevel;
    const firstDe = `${afterDe(h1)} auf „${LEVEL_DE[j.firstSeenLevel]}“${byDe(j.firstDrivers)}`;
    const firstEn = `${afterEn(h1)} to “${LEVEL_EN[j.firstSeenLevel]}”${byEn(j.firstDrivers)}`;
    const peakDe = two ? ` und ${afterDe(j.peakHours!)} auf „${LEVEL_DE[j.maxLevel]}“${byDe(j.peakDrivers, true)}` : '';
    const peakEn = two ? ` and ${afterEn(j.peakHours!)} to “${LEVEL_EN[j.maxLevel]}”${byEn(j.peakDrivers, true)}` : '';
    const quietDe = j.preLevel === 0 ? ` Vor Beginn blieb das Radar auf „${LEVEL_DE[0]}“.` : '';
    const quietEn = j.preLevel === 0 ? ` Before the start the radar stayed “${LEVEL_EN[0]}”.` : '';
    return {
      de: `Das Radar stieg ${firstDe}${peakDe}.${quietDe}${preDe}${noteDe}`,
      en: `The radar rose ${firstEn}${peakEn}.${quietEn}${preEn}${noteEn}`,
    };
  }
  const calmDe = `Mit den ${ctx.measuredSignals} damals verfügbaren Messungen blieb das Radar auf „${LEVEL_DE[j.maxLevel]}“`;
  const calmEn = `With the ${ctx.measuredSignals} measurements available back then, the radar stayed “${LEVEL_EN[j.maxLevel]}”`;
  if (ctx.kind === 'control') {
    if (j.control === 'false-alarm') {
      return {
        de: `Mit den ${ctx.measuredSignals} damals verfügbaren Messungen stieg das Radar bis „${LEVEL_DE[j.maxLevel]}“, obwohl in dieser Vergleichszeit nichts Bekanntes geschah: ein Fehlalarm.${top.length ? ` Auffällig: ${namesDe}.` : ''}`,
        en: `With the ${ctx.measuredSignals} measurements available back then, the radar rose to “${LEVEL_EN[j.maxLevel]}” although nothing known happened in this comparison period: a false alarm.${top.length ? ` Unusual: ${namesEn}.` : ''}`,
      };
    }
    return {
      de: `${calmDe}, wie es in einer ruhigen Zeit sein soll.${top.length ? ` Einzelne Ausschläge (${namesDe}) hoben die Stufe nicht.` : ''}${noteDe}`,
      en: `${calmEn}, as it should in a quiet period.${top.length ? ` Single swings (${namesEn}) did not raise the level.` : ''}${noteEn}`,
    };
  }
  if (j.sawIt === 'teilweise') {
    const att = j.attentionNotable && !top.length;
    return {
      de: `${calmDe}; auffällig ${att ? 'war nur die Aufmerksamkeit im Netz' : `${plural ? 'waren' : 'war'} nur ${namesDe}`}. ${ctx.note?.de ?? 'Das allein hebt die Stufe nicht.'}${preDe}`,
      en: `${calmEn}; only ${att ? 'online attention' : namesEn} stood out. ${ctx.note?.en ?? 'That alone does not raise the level.'}${preEn}`,
    };
  }
  return {
    de: `${calmDe} und zeigte nichts Auffälliges: Das Ereignis war in diesen Daten nicht zu sehen.${preDe}`,
    en: `${calmEn} and showed nothing unusual: the event was not visible in this data.${preEn}`,
  };
}
