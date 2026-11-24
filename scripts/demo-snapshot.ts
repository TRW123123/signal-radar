// Generates clearly labelled DEMO snapshots with synthetic data for frontend development and state tests.
// Never used in production. Run: node scripts/demo-snapshot.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, normalizeSignal } from '../src/core/catalog.ts';
import type { GeoRef, Observation, SignalDef, Snapshot } from '../src/core/types.ts';
import { scoreScenario } from '../src/engine/score.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = loadCatalog(root);
const scenario = catalog.scenarios.find((s) => s.id === 'cyber')!;
const NOW = Date.parse('2026-11-17T06:00:00Z');
const H = 3600_000;

const defs: [string, string, string, string, 'A' | 'B' | 'D', number, string][] = [
  ['cyber.routing.demo_prefixes', 'Sichtbare Internet-Routen weltweit', 'Wie viele Netze weltweit im Internet erreichbar sind.', 'routing', 'A', 950000, 'Routen'],
  ['cyber.routing.demo_withdrawals', 'Zurückgezogene Routen pro Stunde', 'Wie viele Netze sich pro Stunde aus dem Internet abmelden.', 'routing', 'A', 4200, 'pro Stunde'],
  ['cyber.outages.demo_ioda', 'Länder mit Internet-Ausfall', 'In wie vielen Ländern Messnetze gerade einen Internet-Ausfall erkennen.', 'outages', 'A', 3, 'Länder'],
  ['cyber.outages.demo_cloud', 'Gestörte Cloud-Regionen', 'Wie viele Rechenzentrums-Regionen großer Anbieter eine Störung melden.', 'outages', 'B', 2, 'Regionen'],
  ['cyber.dns_core.demo_root', 'Antwortzeit der DNS-Wurzelserver', 'Wie schnell das zentrale Adressbuch des Internets antwortet.', 'dns_core', 'A', 28, 'ms'],
  ['cyber.threat.demo_honeypot', 'Angriffsversuche auf Lockvogel-Sensoren', 'Wie viele Angriffsversuche weltweite Sensoren pro Stunde zählen.', 'threat', 'A', 61000, 'pro Stunde'],
  ['cyber.threat.demo_ransom', 'Neue Erpressungs-Opfer pro Tag', 'Wie viele Firmen Erpresser-Gruppen pro Tag neu als Opfer veröffentlichen.', 'threat', 'A', 19, 'pro Tag'],
  ['cyber.vuln.demo_kev', 'Neu ausgenutzte Sicherheitslücken', 'Wie viele Lücken neu auf der Liste aktiv ausgenutzter Schwachstellen stehen.', 'vuln', 'A', 2, 'pro Woche'],
  ['cyber.finance.demo_target', 'Störungen im Euro-Zahlungssystem', 'Ob das Überweisungssystem der Zentralbanken eine Störung meldet.', 'finance', 'B', 0.2, 'Meldungen'],
  ['cyber.finance.demo_stable', 'Abweichung großer Stablecoins', 'Wie weit an den Dollar gebundene Kryptowährungen von 1 Dollar abweichen.', 'finance', 'A', 0.04, '%'],
  ['cyber.services.demo_status', 'Anbieter mit gemeldeter Störung', 'Wie viele von 60 beobachteten Statusseiten großer Dienste eine Störung zeigen.', 'services', 'B', 5, 'Anbieter'],
  ['cyber.services.demo_8k', 'Pflichtmeldungen zu Cyber-Vorfällen', 'Wie viele US-Börsenfirmen pro Tag einen Cyber-Vorfall melden mussten.', 'services', 'B', 1, 'pro Tag'],
  ['cyber.markets.demo_etf', 'Handelsvolumen in Cyber-Aktien', 'Wie viel in Fonds mit Sicherheitsfirmen gehandelt wird.', 'markets', 'A', 1.0, 'x normal'],
  ['cyber.physical.demo_freq', 'Abweichung der Netzfrequenz', 'Wie stark die Frequenz im europäischen Stromnetz von 50 Hertz abweicht.', 'physical', 'A', 18, 'mHz'],
  ['cyber.physical.demo_faa', 'Flughäfen mit Startstopp (USA)', 'Wie viele US-Flughäfen gerade keine Starts erlauben.', 'physical', 'B', 1, 'Flughäfen'],
  ['cyber.attention.demo_wiki', 'Wikipedia-Aufrufe zu Cyber-Themen', 'Wie oft Artikel zu Cyberangriff, Stromausfall und Notvorrat aufgerufen werden.', 'attention', 'D', 5200, 'pro Tag'],
  ['cyber.attention.demo_search', 'Diskussionen zu „Cyberangriff“', 'Wie oft in großen Foren über einen Cyberangriff geschrieben wird.', 'attention', 'D', 140, 'pro Stunde'],
];

// Demo places on several continents; two measurements stay worldwide (no geo), like global counts in real data.
const GEO: Record<string, GeoRef> = {
  'cyber.routing.demo_withdrawals': { lat: 52.37, lon: 4.9, label: 'Internet-Knoten Amsterdam', kind: 'point' },
  'cyber.outages.demo_ioda': { lat: 32.4, lon: 53.7, label: 'Iran', kind: 'country', cc: 'IR' },
  'cyber.outages.demo_cloud': { lat: 38.95, lon: -77.45, label: 'Rechenzentren Virginia', kind: 'point' },
  'cyber.dns_core.demo_root': { lat: -33.87, lon: 151.21, label: 'DNS-Knoten Sydney', kind: 'point' },
  'cyber.threat.demo_ransom': { lat: -29.0, lon: 24.7, label: 'Südafrika', kind: 'country', cc: 'ZA' },
  'cyber.vuln.demo_kev': { lat: 38.9, lon: -77.03, label: 'Washington', kind: 'point' },
  'cyber.finance.demo_target': { lat: 50.11, lon: 8.68, label: 'Frankfurt am Main', kind: 'point' },
  'cyber.finance.demo_stable': { lat: 35.68, lon: 139.69, label: 'Tokio', kind: 'point' },
  'cyber.services.demo_status': { lat: 37.77, lon: -122.42, label: 'San Francisco', kind: 'point' },
  'cyber.services.demo_8k': { lat: 40.71, lon: -74.0, label: 'New York', kind: 'point' },
  'cyber.markets.demo_etf': { lat: 51.51, lon: -0.13, label: 'London', kind: 'point' },
  'cyber.physical.demo_freq': { lat: 51.1, lon: 10.4, label: 'Deutschland', kind: 'country', cc: 'DE' },
  'cyber.physical.demo_faa': { lat: 39.8, lon: -98.6, label: 'USA', kind: 'country', cc: 'US' },
  'cyber.attention.demo_wiki': { lat: -15.8, lon: -47.9, label: 'Brasilien', kind: 'country', cc: 'BR' },
};

function mkSignals(): SignalDef[] {
  return defs.map(([id, name, plain, domain, cls, , unit], i) => normalizeSignal({
    id, name, plain, domain, evidenceClass: cls, scenarios: ['cyber'], direction: id.includes('prefixes') ? 'down' : 'up',
    kind: 'gauge', weight: cls === 'D' ? 0.6 : 0.75, manipulability: 'low', independenceGroup: `src${i}`, collector: 'demo',
    unit, intervalMinutes: 60, status: 'active', baseline: { method: 'rolling', windowDays: 21, minPoints: 48 },
    sourceName: 'Demo-Daten', sourceUrl: 'https://example.org/demo', holdHours: 12,
    ...(GEO[id] ? { geo: GEO[id] } : {}),
  }));
}

function mkSeries(id: string, level: number, mult: number, seed: number): Observation[] {
  const out: Observation[] = [];
  const down = id.includes('prefixes');
  for (let i = 21 * 24; i >= 0; i--) {
    const n = 1 + 0.035 * Math.sin(i * 1.3 + seed) + 0.025 * Math.cos(i * 0.31 + seed * 2) + 0.01 * Math.sin(i * 7.1 + seed);
    const ramp = i < 5 ? (down ? 1 - (1 - 1 / mult) * ((5 - i) / 5) : 1 + (mult - 1) * ((5 - i) / 5)) : 1;
    // past single-lane blips, present in every demo state: a lone spike is normal and must not raise the level
    const blip = (id.includes('demo_kev') && i >= 140 && i < 146) || (id.includes('demo_wiki') && i >= 215 && i < 224) || (id.includes('demo_faa') && i >= 60 && i < 64) ? 2.6 : 1;
    out.push({ signalId: id, ts: new Date(NOW - i * H).toISOString(), value: level * n * ramp * blip });
  }
  return out;
}

const STATES: Record<string, { domains: string[]; note: string }> = {
  calm: { domains: [], note: 'DEMO mit erfundenen Daten: ruhige Lage.' },
  rumor: { domains: ['attention'], note: 'DEMO mit erfundenen Daten: viel Gerede, Messwerte ruhig.' },
  single: { domains: ['services'], note: 'DEMO mit erfundenen Daten: ein Bereich weicht ab.' },
  elevated: { domains: ['services', 'outages', 'attention'], note: 'DEMO mit erfundenen Daten: zwei Bereiche weichen ab.' },
  acute: { domains: ['routing', 'outages', 'finance', 'services', 'physical', 'attention'], note: 'DEMO mit erfundenen Daten: fünf Bereiche weichen gleichzeitig ab.' },
};

const planned = catalog.signals.filter((s) => s.status !== 'active' && s.scenarios.includes('cyber'));
for (const [state, cfg] of Object.entries(STATES)) {
  const signals = [...mkSignals(), ...planned];
  const series = new Map<string, Observation[]>();
  defs.forEach(([id, , , domain, , level], i) => series.set(id, mkSeries(id, level, cfg.domains.includes(domain) ? 3.2 : 1, i)));
  const base = { sensitivity: 'high' as const, scenario, signals, series, rules: [] };
  const view = scoreScenario({ ...base, now: NOW });
  const history = [];
  for (let t = NOW - 14 * 24 * H; t <= NOW; t += 3 * H) {
    const h = scoreScenario({ ...base, now: t });
    history.push({ t: new Date(t).toISOString(), score: h.score, level: h.level, attention: h.attention, activeDomains: h.activeDomains, d: Object.fromEntries(h.domains.map((x) => [x.id, x.score])), u: Object.fromEntries(h.domains.map((x) => [x.id, x.unrest])) });
  }
  const snap: Snapshot = { schema: 1, generatedAt: new Date(NOW).toISOString(), mode: 'demo', sensitivity: 'high', note: cfg.note, scenarios: [{ ...view, history }] };
  const out = join(root, 'frontend', 'data', `demo-${state}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snap, null, 1));
  console.log(state.padEnd(9), `Stufe ${view.level} ${view.levelLabel} | score ${view.score} | Aufmerksamkeit ${view.attention} | Bereiche ${view.activeDomains} | ${view.verdict}`);
}
