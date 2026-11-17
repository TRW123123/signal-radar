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
  /** env var name of a required key; collector is skipped (not failed) when it is missing */
  needsKey?: string;
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
  sourceName: string;
  sourceUrl: string;
}

export interface DomainView {
  id: string;
  title: string;
  plain?: string;
  score: number;
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
  coverage: { fresh: number; active: number; planned: number; total: number };
  activeDomains: number;
  domains: DomainView[];
  attentionSignals: SignalView[];
  anomalies: SignalView[];
  context: ContextItem[];
  history: { t: string; score: number; attention: number }[];
}

export interface Snapshot {
  schema: 1;
  generatedAt: string;
  mode: 'live' | 'snapshot' | 'demo';
  sensitivity: 'normal' | 'high';
  note?: string;
  scenarios: ScenarioView[];
}
