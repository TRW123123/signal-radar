// Szenario-Konfiguration der geteilten Collectors (src/collectors/config/*.ts) und Abgleich der Aufzeichnungs-Queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCENARIO_CONFIGS } from '../../src/collectors/config/index.ts';
import type { ScenarioCollectorConfig } from '../../src/collectors/config/_types.ts';
import { declare, scenarioEntries } from '../../src/collectors/_scenario.ts';
import { discoverCollectors } from '../../src/core/registry.ts';
import type { Collector } from '../../src/core/types.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const SCENARIOS = ['cyber', 'war', 'blackout', 'ai', 'finance', 'nuclear', 'bio'];
const LISTS = ['wikipedia', 'hackerNews', 'gdelt', 'polymarket', 'yahoo', 'iodaCountries', 'iodaEvents', 'ooni', 'statuspage', 'adsb'] as const;
const SHARED = ['wikimedia-pageviews', 'hn-algolia', 'gdelt-doc', 'polymarket-gamma', 'yahoo-chart', 'ioda', 'ooni', 'statuspage', 'adsb-lol'];

test('sieben Szenario-Dateien, Reihenfolge, Listen vollständig, IDs im eigenen Szenario', () => {
  assert.deepEqual(SCENARIO_CONFIGS.map((c) => c.scenario), SCENARIOS);
  const files = readdirSync(join(ROOT, 'src', 'collectors', 'config')).filter((f) => !f.startsWith('_') && f !== 'index.ts');
  assert.deepEqual(files.map((f) => f.replace(/\.ts$/, '')).sort(), [...SCENARIOS].sort());
  for (const c of SCENARIO_CONFIGS) for (const k of LISTS) assert.ok(Array.isArray(c[k]), `${c.scenario}.${k}`);
  // Szenario-Dateien werden laufend befüllt: jede Signal-ID muss zum eigenen Szenario gehören
  for (const c of SCENARIO_CONFIGS) {
    const ids = JSON.stringify(c).match(/"(?:signalId|id)":"([a-z_]+)\./g) ?? [];
    for (const m of ids) assert.ok(m.includes(`"${c.scenario}.`) || m.includes('"cyber.') && c.scenario === 'cyber', `${c.scenario}: ${m}`);
  }
});

test('Registry lädt den Ordner config/ nicht als Collector', async () => {
  const ids = (await discoverCollectors(ROOT)).map((c) => c.id);
  assert.ok(!ids.some((id) => SCENARIOS.includes(id) || id === 'index' || id.startsWith('config')));
  assert.ok(SHARED.every((id) => ids.includes(id)));
});

test('Signal-IDs der geteilten Collectors: eindeutig, Präfix = Szenario, scenarios = [Szenario]', async () => {
  const cs = (await discoverCollectors(ROOT)).filter((c) => SHARED.includes(c.id));
  const all = cs.flatMap((c) => c.signals);
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
  for (const s of all) {
    const scenario = s.id.split('.')[0];
    assert.ok(SCENARIOS.includes(scenario), s.id);
    assert.deepEqual(s.scenarios, [scenario], s.id);
    assert.ok(s.name && s.plain && s.domain && s.evidenceClass && s.baseline && s.independenceGroup, s.id);
  }
  // keine Hilfsfelder der Konfiguration in den Signal-Deklarationen
  assert.ok(all.every((s) => !('scenario' in s)));
});

test('Wikipedia: höchstens 6 Artikel je Gruppe', () => {
  for (const e of scenarioEntries('wikipedia')) assert.ok(e.articles.length >= 1 && e.articles.length <= 6, e.signal.id);
});

test('scenarioEntries/declare: Eintrag eines neuen Szenarios landet mit Szenario und Defaults im Signal', () => {
  const empty = SCENARIO_CONFIGS.find((c) => c.scenario === 'blackout')!;
  const extra: ScenarioCollectorConfig = { ...empty, ooni: [{ signal: { id: 'blackout.connectivity.ooni_anomaly_share_es', domain: 'connectivity', name: 'n', plain: 'p' }, cc: 'ES' }] };
  const entries = scenarioEntries('ooni', [SCENARIO_CONFIGS[0], extra]);
  const last = entries.at(-1)!;
  assert.equal(last.scenario, 'blackout');
  assert.equal(last.cc, 'ES');
  const decl = declare({ weight: 0.25, unit: '% anomal' }, last.scenario, last.signal);
  assert.deepEqual(decl.scenarios, ['blackout']);
  assert.equal(decl.weight, 0.25);
  assert.equal(decl.id, 'blackout.connectivity.ooni_anomaly_share_es');
});

// Queue: genau die Requests, die der Collector für now = capturedAt stellt; bei den verkleinerten Requests maxChars höchstens 8000.
// gdelt-doc, statuspage und adsb-lol: Requests unverändert, maxChars alt (Antworten teils über 8000, siehe Kopfkommentare).
const UNCHANGED = ['gdelt-doc', 'statuspage', 'adsb-lol'];
const QUEUED = ['wikimedia-pageviews', 'hn-algolia', 'polymarket-gamma', 'yahoo-chart', 'ioda', 'ooni', 'ripe-stat', 'smard', 'energy-charts', 'chromiumdash'];

async function requests(c: Collector, now: Date): Promise<{ fixture: string; url: string }[]> {
  const out: { fixture: string; url: string }[] = [];
  const raw = async (url: string, init?: { fixture?: string }) => {
    if (!out.some((r) => r.url === url)) out.push({ fixture: init?.fixture ?? '', url });
    if (url.includes('/outages/events')) return '{"data":[]}';
    throw new Error('offline');
  };
  const http = { text: raw, json: async (u: string, i?: { fixture?: string }) => JSON.parse(await raw(u, i)) };
  try { await c.collect({ now, http, key: () => undefined, log: () => {} } as never); } catch { /* offline */ }
  return out;
}

test('Queue-Dateien stimmen mit den Requests für capturedAt überein, maxChars höchstens 8000', async () => {
  const now = new Date(JSON.parse(readFileSync(join(ROOT, 'fixtures', 'META.json'), 'utf8')).capturedAt);
  const cs = (await discoverCollectors(ROOT)).filter((c) => QUEUED.includes(c.id) || UNCHANGED.includes(c.id));
  assert.equal(cs.length, QUEUED.length + UNCHANGED.length);
  for (const c of cs) {
    const queue = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'queue', `${c.id}.json`), 'utf8')) as { fixture: string; url: string; maxChars: number }[];
    const reqs = await requests(c, now);
    assert.deepEqual(queue.map((q) => [q.fixture, q.url]).sort(), reqs.map((r) => [r.fixture, r.url]).sort(), c.id);
    if (QUEUED.includes(c.id)) assert.ok(queue.every((q) => q.maxChars > 0 && q.maxChars <= 8000), c.id);
    assert.equal(new Set(queue.map((q) => q.fixture)).size, queue.length, c.id);
  }
});
