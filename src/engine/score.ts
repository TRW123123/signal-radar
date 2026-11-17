// Scenario scoring. Design principles (see docs/SCORING.md):
//  1. A single signal is noise. Only convergence of several INDEPENDENT domains can raise a scenario.
//  2. Official statements (class C) are never scored. Crowd attention (class D) is scored separately
//     as "Aufmerksamkeit" so that rumours and measurements can be told apart.
//  3. Known harmless causes damp an anomaly and are shown as the reason.
//  4. The default state is calm. The score is "how unusual are the measurements", not a probability.

import type {
  BanalRule, ContextItem, DomainView, EvidenceClass, Observation, RumorGap, ScenarioDef, ScenarioView, SignalDef,
  SignalView,
} from '../core/types.ts';
import { evaluate, SENSITIVITY } from './anomaly.ts';
import { banalDamp } from './banal.ts';
import { clamp01, noisyOr, round } from './stats.ts';

export const CLASS_WEIGHT: Record<EvidenceClass, number> = { A: 1, B: 0.8, C: 0, D: 1 };
export const MANIP_FACTOR = { low: 1, medium: 0.8, high: 0.55 } as const;
/** a domain counts as "active" for convergence from this score on */
export const DOMAIN_ACTIVE = 0.25;
/**
 * Convergence gate: how much of the combined score is let through with n active independent domains.
 * Chosen so that the level is capped by the number of converging domains:
 * 1 domain -> at most "Leicht erhöht", 2 -> at most "Erhöht", 3 -> at most "Hoch", 4+ -> "Akut" possible.
 */
export const CONVERGENCE_GATE = [1, 0.29, 0.54, 0.77, 1];
export const LEVEL_THRESHOLDS = [0.12, 0.3, 0.55, 0.78];
export const LEVEL_LABELS = ['Ruhig', 'Leicht erhöht', 'Erhöht', 'Hoch', 'Akut'];

export function levelOf(score: number): 0 | 1 | 2 | 3 | 4 {
  let l = 0;
  for (const t of LEVEL_THRESHOLDS) if (score >= t) l++;
  return l as 0 | 1 | 2 | 3 | 4;
}

export interface ScoreInput {
  now: number;
  sensitivity: 'normal' | 'high';
  scenario: ScenarioDef;
  signals: SignalDef[];
  /** observations per signal id */
  series: Map<string, Observation[]>;
  rules: BanalRule[];
  context?: ContextItem[];
  /** all signal definitions, for cross-signal banal conditions */
  latest?: (signalId: string) => number | null;
}

function sparkOf(series: Observation[], now: number, n = 60): { v: number[]; start: string | null; end: string | null } {
  const s = series.filter((o) => Date.parse(o.ts) <= now).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)).slice(-n);
  return { v: s.map((o) => round(o.value, 4)), start: s[0]?.ts ?? null, end: s[s.length - 1]?.ts ?? null };
}

export function scoreScenario(input: ScoreInput): Omit<ScenarioView, 'history'> {
  const { now, scenario, rules } = input;
  const sens = SENSITIVITY[input.sensitivity];
  const mine = input.signals.filter((s) => s.scenarios.includes(scenario.id));
  const latest = input.latest ?? ((id: string) => {
    const s = input.series.get(id);
    if (!s || s.length === 0) return null;
    return s.reduce((a, b) => (Date.parse(a.ts) > Date.parse(b.ts) ? a : b)).value;
  });

  const views: (SignalView & { def: SignalDef; flagged: boolean; potential: number })[] = [];
  for (const def of mine) {
    const series = input.series.get(def.id) ?? [];
    const r = def.status === 'active' ? evaluate(def, series, now, sens)
      : { value: null, ts: null, baseline: null, z: null, anomaly: 0, flagged: false, fresh: false };
    const damp = r.anomaly > 0 || r.flagged ? banalDamp(rules, def.id, now, { latest }) : null;
    const potential = clamp01(def.weight) * CLASS_WEIGHT[def.evidenceClass] * MANIP_FACTOR[def.manipulability];
    // immature baselines count half: we do not know yet what "normal" looks like
    const maturity = r.baseline ? (r.baseline.mature ? 1 : 0.5) : 0;
    const contribution = potential * r.anomaly * (damp ? damp.factor : 1) * maturity;
    const spark = sparkOf(series, now);
    views.push({
      id: def.id, name: def.name, plain: def.plain, domain: def.domain, evidenceClass: def.evidenceClass,
      status: def.status, unit: def.unit, value: r.value === null ? null : round(r.value, 4), ts: r.ts, fresh: r.fresh,
      baseline: r.baseline
        ? { center: round(r.baseline.center, 4), scale: round(r.baseline.scale, 4), n: Number.isFinite(r.baseline.n) ? r.baseline.n : -1, mature: r.baseline.mature }
        : null,
      z: r.z === null ? null : round(r.z, 2), anomaly: round(r.anomaly), damp, contribution: round(contribution),
      spark: spark.v, sparkStart: spark.start, sparkEnd: spark.end, sourceName: def.sourceName, sourceUrl: def.sourceUrl,
      def, flagged: r.flagged, potential,
    });
  }

  const strip = (v: (typeof views)[number]): SignalView => {
    const { def: _d, flagged: _f, potential: _p, ...rest } = v;
    return rest;
  };

  // --- measured risk: classes A and B, grouped by domain, de-duplicated by independence group ---
  const domainViews: DomainView[] = [];
  for (const [domainId, meta] of Object.entries(scenario.domains)) {
    const inDomain = views.filter((v) => v.domain === domainId && (v.evidenceClass === 'A' || v.evidenceClass === 'B'));
    const byGroup = new Map<string, number>();
    for (const v of inDomain) byGroup.set(v.def.independenceGroup, Math.max(byGroup.get(v.def.independenceGroup) ?? 0, v.contribution));
    const score = noisyOr([...byGroup.values()]);
    domainViews.push({
      id: domainId, title: meta.title, plain: meta.plain, score: round(score), active: score >= DOMAIN_ACTIVE,
      signals: inDomain.sort((a, b) => b.contribution - a.contribution || b.anomaly - a.anomaly).map(strip),
    });
  }
  const activeDomains = domainViews.filter((d) => d.active).length;
  const combined = noisyOr(domainViews.map((d) => d.score * clamp01(scenario.domains[d.id].weight)));
  const gate = CONVERGENCE_GATE[Math.min(activeDomains, CONVERGENCE_GATE.length - 1)];
  const score = clamp01(combined * gate);
  const level = levelOf(score);

  // --- attention: class D, kept apart ---
  const attentionViews = views.filter((v) => v.evidenceClass === 'D');
  const attGroups = new Map<string, number>();
  for (const v of attentionViews) attGroups.set(v.def.independenceGroup, Math.max(attGroups.get(v.def.independenceGroup) ?? 0, v.contribution));
  const attention = noisyOr([...attGroups.values()]);

  let rumorGap: RumorGap = 'none';
  if (attention >= 0.35 && score < LEVEL_THRESHOLDS[1]) rumorGap = 'talk-no-data';
  else if (score >= LEVEL_THRESHOLDS[1] && attention < 0.15) rumorGap = 'data-no-talk';
  else if (score >= LEVEL_THRESHOLDS[1] && attention >= 0.35) rumorGap = 'both';

  // --- confidence: how much of the BUILT measuring capacity is fed by fresh data with a mature baseline ---
  // Catalogued but not yet built signals are reported as coverage, they do not lower the confidence.
  const scoreable = views.filter((v) => v.status === 'active' && (v.evidenceClass === 'A' || v.evidenceClass === 'B'));
  const totalPotential = scoreable.reduce((a, v) => a + v.potential, 0);
  const livePotential = scoreable.reduce((a, v) => a + (v.fresh && v.baseline ? v.potential * (v.baseline.mature ? 1 : 0.5) : 0), 0);
  const confidence = totalPotential > 0 ? livePotential / totalPotential : 0;
  const domainsWithData = domainViews.filter((d) => d.signals.some((x) => x.fresh && x.baseline)).length;

  const coverage = {
    fresh: views.filter((v) => v.fresh).length,
    active: views.filter((v) => v.status === 'active').length,
    planned: views.filter((v) => v.status !== 'active').length,
    total: views.length,
    domainsWithData,
    domainsTotal: Object.keys(scenario.domains).length,
  };

  const anomalies = views
    .filter((v) => v.evidenceClass !== 'C' && (v.anomaly > 0 || v.flagged))
    .sort((a, b) => b.contribution - a.contribution || (b.z ?? 0) - (a.z ?? 0))
    .slice(0, 25)
    .map(strip);

  return {
    id: scenario.id, title: scenario.title, question: scenario.question, tagline: scenario.tagline,
    score: round(score), level, levelLabel: LEVEL_LABELS[level],
    verdict: verdictOf(level, activeDomains, rumorGap, confidence, anomalies.length, domainsWithData),
    attention: round(attention), rumorGap, confidence: round(confidence), coverage, activeDomains,
    domains: domainViews.sort((a, b) => b.score - a.score),
    attentionSignals: attentionViews.sort((a, b) => b.contribution - a.contribution).map(strip),
    anomalies,
    context: (input.context ?? []).filter((c) => c.scenario === scenario.id).slice(0, 20),
  };
}

/** One plain sentence for people who read nothing else. No drama, no probabilities. */
export function verdictOf(level: number, activeDomains: number, gap: RumorGap, confidence: number, flagged: number, domainsWithData = 99): string {
  // convergence needs several independent domains; with fewer than three fed domains no statement is possible
  if (confidence < 0.15 || domainsWithData < 3) return 'Noch zu wenig Messdaten für eine belastbare Aussage.';
  if (gap === 'talk-no-data') return 'Viel Aufmerksamkeit im Netz, aber die Messwerte sind unauffällig.';
  if (gap === 'data-no-talk') return 'Messwerte weichen ab, obwohl kaum darüber gesprochen wird.';
  switch (level) {
    case 0:
      return flagged > 0 ? 'Einzelne Ausschläge, insgesamt im normalen Bereich.' : 'Messwerte im normalen Bereich.';
    case 1:
      return activeDomains <= 1 ? 'Ein Bereich weicht ab. Einzelne Ausschläge sind häufig und meist harmlos.' : 'Leichte Abweichungen in mehreren Bereichen.';
    case 2:
      return `Abweichungen in ${activeDomains} unabhängigen Bereichen gleichzeitig. Das ist ungewöhnlich.`;
    case 3:
      return `Deutliche Abweichungen in ${activeDomains} unabhängigen Bereichen gleichzeitig.`;
    default:
      return `Starke gleichzeitige Abweichungen in ${activeDomains} unabhängigen Bereichen.`;
  }
}
