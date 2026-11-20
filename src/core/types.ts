// Core data contracts of Signal Radar. Everything else (collectors, engine, frontend) depends on these.

/** A = independent third-party measurement, B = self-reported operational data / mandatory filings,
 *  C = official statements (context layer only, never scored), D = crowd attention and behaviour. */
export type EvidenceClass = 'A' | 'B' | 'C' | 'D';
export type Direction = 'up' | 'down' | 'both';
export type Manipulability = 'low' | 'medium' | 'high';
export type SignalStatus = 'active' | 'needs-key' | 'planned' | 'license-unclear';
export type SignalKind = 'gauge' | 'count' | 'rate' | 'binary';

export interface BaselineSpec {
  /** rolling: all points in window. hour-of-week / day-of-week: only points from the same seasonal bucket. fixed: constant. */
  method: 'rolling' | 'hour-of-week' | 'day-of-week' | 'fixed';
  windowDays: number;
  /** below this many baseline points the signal is "immature" and contributes with reduced confidence */
  minPoints: number;
  fixed?: { center: number; scale: number };
}

export interface SignalDef {
  id: string;
  /** scenario ids this signal feeds */
  scenarios: string[];
  /** independence domain inside a scenario (routing, finance, behaviour ...) */
  domain: string;
  name: string;
  /** one sentence a layperson understands */
  plain: string;
  evidenceClass: EvidenceClass;
  direction: Direction;
  kind: SignalKind;
  /** base weight 0..1: how much a full anomaly of this signal says about the scenario */
  weight: number;
  manipulability: Manipulability;
  /** signals sharing an upstream source share a group; only the strongest one counts per domain */
  independenceGroup: string;
  /**
   * Shared upstream across collectors and domains (catalog/upstreams.json). Signals with the same upstream count
   * once per domain, and one upstream can make at most one domain count towards convergence.
   */
  upstream?: string;
  collector: string;
  unit?: string;
  baseline: BaselineSpec;
  /** z0: anomaly starts, z1: anomaly saturates, absFloor/relFloor: minimum scale to avoid tiny-variance blowups */
  thresholds?: { z0?: number; z1?: number; absFloor?: number; relFloor?: number };
  /** how long an anomalous observation keeps counting, in hours */
  holdHours?: number;
  /**
   * rate: the source reports a monotonically growing counter (e.g. a log's tree size); the engine scores the
   * increase per hour between consecutive observations instead of the raw counter.
   */
  transform?: 'rate';
  /**
   * Oldest age of the latest observation that still counts as current, in hours. Set this for sources that
   * publish with a delay (e.g. weekly statistics released a week late). Default: three times the larger of
   * `intervalMinutes` and the series' own typical spacing.
   */
  maxAgeHours?: number;
  /** expected interval between observations in minutes (for freshness) */
  intervalMinutes: number;
  status: SignalStatus;
  sourceName: string;
  sourceUrl: string;
  license?: string;
  rationale?: string;
  banalCauses?: string[];
}

export interface Observation {
  signalId: string;
  /** ISO 8601 UTC */
  ts: string;
  value: number;
  meta?: Record<string, unknown>;
}

export interface ContextItem {
  /** class C: official statements, shown separately, never scored */
  scenario: string;
  ts: string;
  title: string;
  source: string;
  url: string;
}

export interface CollectContext {
  now: Date;
  /** fetch with timeout, UA, retries and fixture record/replay */
  http: HttpClient;
  /** API keys from environment, undefined when missing */
  key(name: string): string | undefined;
  log(msg: string): void;
}

export interface HttpClient {
  json<T = unknown>(url: string, init?: HttpInit): Promise<T>;
  text(url: string, init?: HttpInit): Promise<string>;
}

export interface HttpInit {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** stable name for the fixture file; defaults to a hash of the URL */
  fixture?: string;
}

export interface CollectorResult {
  observations: Observation[];
  context?: ContextItem[];
}

export interface Collector {
  id: string;
  title: string;
  sourceUrl: string;
  /**
   * env var name(s) of required keys; collector is skipped (not failed) when one is missing.
   * With an array, all listed variables must be set.
   */
  needsKey?: string | string[];
  intervalMinutes: number;
  /**
   * Signals this collector feeds. Entries are merged over the catalog entry with the same id
   * (the collector author knows unit, kind and baseline best); ids missing in the catalog are added.
   * A signal becomes "active" as soon as a collector declares it.
   */
  signals: (Partial<SignalDef> & { id: string })[];
  collect(ctx: CollectContext): Promise<CollectorResult>;
}

export interface ScenarioDef {
  id: string;
  title: string;
  /** short question in plain language, e.g. "Läuft gerade ein großer Cyberangriff an?" */
  question: string;
  tagline: string;
  /** per-domain weight and display title */
  domains: Record<string, { title: string; weight: number; plain?: string }>;
  order: number;
}

export interface UpstreamRule {
  id: string;
  reason: string;
  appliesTo: string[];
}

export interface BanalRule {
  id: string;
  type: 'date-range' | 'nth-weekday' | 'weekday' | 'day-of-month' | 'signal-condition';
  /** glob patterns on signal ids, '*' wildcard */
  appliesTo: string[];
  /** multiplier on the anomaly, 0..1 */
  factor: number;
  reason: string;
  params: Record<string, unknown>;
}

// ---------- engine output / frontend contract ----------

export interface SignalView {
  id: string;
  name: string;
  plain: string;
  domain: string;
  evidenceClass: EvidenceClass;
  status: SignalStatus;
  unit?: string;
  value: number | null;
  ts: string | null;
  fresh: boolean;
  baseline: { center: number; scale: number; n: number; mature: boolean } | null;
  z: number | null;
  /** 0..1 after hold/decay, before damping */
  anomaly: number;
  damp: { factor: number; reason: string } | null;
  /** 0..1 contribution to its domain after weight, class, manipulability, damping */
  contribution: number;
  spark: number[];
  /** ISO timestamps of the first and last spark point (points are in time order, spacing may be uneven) */
  sparkStart: string | null;
  sparkEnd: string | null;
  sourceName: string;
  sourceUrl: string;
  /** license / terms label from the catalog or collector (per-signal metadata for the UI) */
  license?: string;
  /** collector id, used to match required source notices (src/core/attribution.ts) */
  collector?: string;
}

export interface DomainView {
  id: string;
  title: string;
  plain?: string;
  score: number;
  /**
   * 0..1: how close the most deviating signal of this domain is to the anomaly threshold (1 = at threshold).
   * Purely for display below the threshold line; it never influences the score.
   */
  unrest: number;
  active: boolean;
  signals: SignalView[];
}

export type RumorGap = 'none' | 'talk-no-data' | 'data-no-talk' | 'both';

export interface ScenarioView {
  id: string;
  title: string;
  question: string;
  tagline: string;
  score: number;
  level: 0 | 1 | 2 | 3 | 4;
  levelLabel: string;
  verdict: string;
  attention: number;
  rumorGap: RumorGap;
  confidence: number;
  /** fresh/active: built signals; planned: catalogued but not built yet; domainsWithData: domains fed by at least one fresh signal */
  coverage: { fresh: number; active: number; planned: number; total: number; domainsWithData: number; domainsTotal: number };
  activeDomains: number;
  domains: DomainView[];
  attentionSignals: SignalView[];
  anomalies: SignalView[];
  context: ContextItem[];
  /** score recomputed from the same raw data at past points in time; d = score per domain (shared time axis for the lanes) */
  history: HistoryPoint[];
}

export interface HistoryPoint {
  t: string;
  score: number;
  level: number;
  attention: number;
  activeDomains: number;
  /** domain score per domain id */
  d: Record<string, number>;
  /** sub-threshold unrest per domain id (display only) */
  u: Record<string, number>;
}

export interface Snapshot {
  schema: 1;
  generatedAt: string;
  mode: 'live' | 'snapshot' | 'demo';
  sensitivity: 'normal' | 'high';
  note?: string;
  scenarios: ScenarioView[];
  /**
   * Required credits and notices of the sources whose data appears in this snapshot (src/core/attribution.ts).
   * Optional: older snapshots and the demo files do not have it; the frontend falls back to a static line.
   */
  attributions?: SourceAttribution[];
}

// ---------- source terms / required attribution (registry in src/core/attribution.ts) ----------

export type AttributionStatus = 'active-collector' | 'mirror-only' | 'planned-needs-key' | 'blocked-pending-license' | 'pending-terms';

export interface SourceAttribution {
  /** catalog source id where one exists (catalog/sources.json) */
  id: string;
  name: string;
  /** collector ids that use this source, including mirrors */
  collectors: string[];
  /** case-sensitive substrings of SignalView.sourceName, for signals without collector id */
  sourceNameHints?: string[];
  /** required short credit on charts and in the list */
  attribution: string;
  attributionUrl?: string;
  /** short license / terms label */
  license: string;
  /** required dashboard notices, verbatim where the source prescribes the wording */
  footerNotices: string[];
  restrictions?: string[];
  status: AttributionStatus;
}
