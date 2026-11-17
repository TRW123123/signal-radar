import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, compute, buildUrl, fixtureName, SPECS } from '../../src/collectors/yahoo-chart.ts';

// SAMPLE: nach bekannter Form der inoffiziellen Chart-API nachgebaut, keine echte Aufzeichnung.
function sample(closes: (number | null)[], vols: (number | null)[], startDay = '2026-10-01') {
  const t0 = Date.UTC(+startDay.slice(0, 4), +startDay.slice(5, 7) - 1, +startDay.slice(8, 10), 14, 30) / 1000;
  return { chart: { error: null, result: [{ meta: { gmtoffset: -18000 }, timestamp: closes.map((_, i) => t0 + i * 86400),
    indicators: { quote: [{ close: closes, volume: vols }] } }] } };
}

test('Normalfall: Kerzen mit Ortsdatum, null-Werte bleiben null', () => {
  const c = parse(sample([100, null, 102], [10, 20, null]));
  assert.equal(c.length, 3);
  assert.equal(c[0].day, '2026-10-01');
  assert.equal(c[1].close, null);
  assert.equal(c[2].volume, null);
});

test('leere Antwort und fehlende Felder', () => {
  assert.throws(() => parse({ chart: { result: [], error: null } }), /result\[0\] fehlt/);
  assert.throws(() => parse({ chart: { result: null, error: { description: 'Not Found' } } }), /Yahoo-Fehler: Not Found/);
  assert.throws(() => parse({ chart: { result: [{ timestamp: [1], indicators: { quote: [{}] } }] } }), /close fehlt/);
});

test('compute: Tagesrendite-Betrag, Schlusskurs, relatives Volumen', () => {
  const a = parse(sample([100, 110, 99], [1, 1, 1]));
  const abs = compute('abs-return-mean', [a]);
  assert.ok(Math.abs(abs.get('2026-10-02')! - 10) < 1e-9);
  assert.ok(Math.abs(abs.get('2026-10-03')! - 10) < 1e-9);
  assert.equal(compute('close', [a]).get('2026-10-03'), 99);
  const vols = Array.from({ length: 25 }, (_, i) => (i === 24 ? 300 : 100));
  const b = parse(sample(vols.map(() => 1), vols));
  const rel = compute('rel-volume-sum', [b, b]);
  assert.equal(rel.size, 5);
  assert.equal([...rel.values()].at(-1), 3);
});

test('compute: Tag mit fehlendem Wert eines Symbols wird nicht gemeldet', () => {
  const a = parse(sample([100, 101, 102], [1, 1, 1]));
  const b = parse(sample([100, null, 102], [1, 1, 1]));
  const r = compute('abs-return-mean', [a, b]);
  assert.equal(r.size, 0); // Tag 2 und 3 haben keine vollständige Rendite
});

test('collect: laufender Tag fehlt, fehlendes Symbol lässt nur betroffene Signale aus', async () => {
  const body = sample([100, 101, 102, 103], [1, 1, 1, 1], '2026-11-13'); // 13.-16.11.
  const late = sample([100, 101, 102, 103, 104], [1, 1, 1, 1, 1], '2026-11-13'); // letzte Kerze 17.11. (laufend)
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { if (u.includes('HACK')) throw new Error('404'); return u.includes('VIX') ? late : body; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  const ids = new Set(r.observations.map((o) => o.signalId));
  assert.ok(ids.has('cyber.markets.vix'));
  assert.ok(!ids.has('cyber.markets.cyber_etf_abs_return'));
  assert.ok(r.observations.every((o) => o.ts < '2026-11-17'));
  assert.equal(buildUrl('^VIX'), 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=3mo&interval=1d');
  assert.equal(fixtureName('GC=F'), 'yahoo/GC_F-3mo-1d.json');
  assert.ok(SPECS.every((s) => s.weight >= 0.2 && s.weight <= 0.5));
});

// Fehlerobjekt nach bekannter Yahoo-Form (nicht aufgezeichnet; echte Antworten bisher nur als Antwortbeginn vorhanden).
test('Fehlerantwort der Quelle wirft klaren Fehler', () => {
  assert.throws(() => parse({ chart: { result: null, error: { description: 'No data found, symbol may be delisted' } } }), /Yahoo-Fehler/);
});

// --- Szenario war ---
test('war: Symbole, Domain markets, Gewichte 0,2 bis 0,5, Gold und VIX zusätzlich unter war-IDs', () => {
  const war = SPECS.filter((s) => s.scenario === 'war');
  assert.deepEqual(war.flatMap((s) => s.symbols).sort(), ['BZ=F', 'CL=F', 'GC=F', 'ITA', 'RHM.DE', 'ZW=F', '^OVX', '^VIX'].sort());
  const sigs = collector.signals.filter((s) => s.id.startsWith('war.'));
  assert.equal(sigs.length, war.length);
  assert.ok(sigs.every((s) => s.domain === 'markets' && s.scenarios!.join() === 'war' && s.weight! >= 0.2 && s.weight! <= 0.5 && s.plain && s.name));
  assert.ok(sigs.some((s) => s.id === 'war.markets.gold_price') && SPECS.some((s) => s.signalId === 'cyber.markets.gold_abs_return'));
  assert.equal(fixtureName('BZ=F'), 'yahoo/BZ_F-3mo-1d.json');
  assert.equal(buildUrl('^OVX'), 'https://query1.finance.yahoo.com/v8/finance/chart/%5EOVX?range=3mo&interval=1d');
});

test('war: ein Symbol wird nur einmal geholt, ausgefallenes Symbol lässt nur sein Signal aus', async () => {
  const body = sample([100, 101, 102, 103], [1, 1, 1, 1], '2026-11-13');
  const urls: string[] = [];
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { urls.push(u); if (u.includes('ZW%3DF')) throw new Error('404'); return body; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  const ids = new Set(r.observations.map((o) => o.signalId));
  assert.ok(ids.has('war.markets.brent_futures') && ids.has('war.markets.vix') && ids.has('cyber.markets.vix'));
  assert.ok(!ids.has('war.markets.wheat_prices'));
  assert.equal(urls.length, new Set(urls).size);
  assert.equal(urls.length, 12);
});
