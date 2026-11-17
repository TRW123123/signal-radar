import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, select, MATCH, buildUrl, fixtureName, SEARCH_TERMS } from '../../src/collectors/polymarket-gamma.ts';

// SAMPLE: nach Doku nachgebaut (public-search: events[].markets[], outcomes/outcomePrices als JSON-Strings), keine echte Aufzeichnung.
const SAMPLE = { events: [{ markets: [
  { id: '1', question: 'Major cyberattack on US grid in 2026?', outcomes: '["Yes","No"]', outcomePrices: '["0.12","0.88"]', volumeNum: 5000, volume24hr: 300, closed: false, active: true },
  { id: '2', question: 'Will ransomware hit a Fortune 100 firm?', outcomes: '["No","Yes"]', outcomePrices: '["0.7","0.3"]', volumeNum: 1000, volume24hr: 50, closed: false },
  { id: '3', question: 'Hack of exchange X?', outcomes: '["Yes","No"]', outcomePrices: '["0.9","0.1"]', volumeNum: 10, volume24hr: 1, closed: true },
  { id: '4', question: 'Will it rain tomorrow?', outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]', volume24hr: 9999 },
] }] };

test('Normalfall: offene Märkte, Ja-Preis auch bei vertauschter Reihenfolge', () => {
  const m = parse(SAMPLE);
  assert.equal(m.length, 3); // geschlossener Markt fehlt
  assert.ok(Math.abs((m.find((x) => x.id === '2')?.yes ?? 0) - 30) < 1e-9);
  assert.equal(select(m, MATCH.cyber).length, 2); // Regenmarkt wird gefiltert
});

test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parse({ events: [] }), []);
  assert.throws(() => parse({}), /events fehlt/);
  assert.deepEqual(parse({ pagination: { totalResults: 0 } }), []); // echte Nulltreffer-Antwort
  const m = parse({ events: [{ markets: [{ id: '9', question: 'cyber?', outcomes: 'kaputt', outcomePrices: '[1' }] }] });
  assert.equal(m[0].yes, null);
  assert.equal(m[0].volume24h, 0);
});

test('collect: höchste Ja-Wahrscheinlichkeit und Volumensumme, Duplikate zählen einmal', async () => {
  const ctx = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {}, http: { json: async () => SAMPLE, text: async () => '' } };
  const r = await collector.collect(ctx as never);
  const p = r.observations.find((o) => o.signalId === 'cyber.markets.polymarket_cyber')!;
  const v = r.observations.find((o) => o.signalId === 'cyber.markets.market_volume_cyber')!;
  assert.ok(Math.abs(p.value - 30) < 1e-9);
  assert.equal(v.value, 350);
  assert.equal(v.ts, '2026-11-17T00:00:00.000Z');
});

test('collect: kein passender Markt meldet nichts; Teilausfall meldet nichts', async () => {
  const base = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {} };
  const none = { ...base, http: { json: async () => ({ events: [] }), text: async () => '' } };
  assert.equal((await collector.collect(none as never)).observations.length, 0);
  let n = 0;
  const partial = { ...base, http: { json: async () => { if (++n === 3) throw new Error('500'); return SAMPLE; }, text: async () => '' } };
  assert.equal((await collector.collect(partial as never)).observations.length, 0);
  assert.equal(fixtureName('cyber attack'), 'polymarket/search-cyber-attack-open.json');
  assert.equal(buildUrl('cyber attack'), 'https://gamma-api.polymarket.com/public-search?q=cyber%20attack&limit_per_type=1&events_status=active&keep_closed_markets=0&search_tags=false&search_profiles=false');
  assert.match(buildUrl('cyber attack'), /q=cyber%20attack/);
  assert.ok(SEARCH_TERMS.cyber.length <= 8);
});

// Gekürzter echter Ausschnitt (public-search "cyber attack", 17.11.2026): archivierter Markt, active=false, closed=false.
const REAL = { events: [{ id: '242733', title: 'Israel false flag attack confirmed?', active: false, closed: false, archived: true, markets: [{
  id: '1488488', question: 'Israel false flag attack confirmed?', outcomes: '["Yes", "No"]', outcomePrices: '["0.5", "0.5"]',
  volume: '1.0204', active: false, closed: false, archived: true, volumeNum: 1.0204,
}] }], pagination: { hasMore: false, totalResults: 1 } };

test('echte Antwort: archivierter Markt (active=false) wird übersprungen, URL nutzt limit_per_type=1', () => {
  assert.deepEqual(parse(REAL), []);
  assert.match(buildUrl('hack'), /limit_per_type=1/);
  assert.deepEqual(parse({ events: [{ markets: [{ id: '1', question: 'cyber?', archived: true }] }] }), []);
});

// --- Szenario war (Beispiel nach Doku nachgebaut, keine echte Aufzeichnung) ---
const WAR_MATCH = MATCH.war;
const WAR_TERMS = SEARCH_TERMS.war;

const WAR_SAMPLE = { events: [{ markets: [
  { id: 'w1', question: 'Will the US strike Iran by December 31?', outcomes: '["Yes","No"]', outcomePrices: '["0.21","0.79"]', volumeNum: 90000, volume24hr: 4000 },
  { id: 'w2', question: 'Will Iran win the 2026 World Cup?', outcomes: '["Yes","No"]', outcomePrices: '["0.01","0.99"]', volume24hr: 700 },
  { id: 'w3', question: 'World War 3 before 2027?', outcomes: '["Yes","No"]', outcomePrices: '["0.05","0.95"]', volumeNum: 20000, volume24hr: 1000 },
] }] };

test('war: Fragetext-Filter nimmt Eskalationsmärkte, keine Sportmärkte', () => {
  const qs = parse(WAR_SAMPLE).map((m) => m.question);
  assert.deepEqual(qs.filter((q) => WAR_MATCH.test(q)), ['Will the US strike Iran by December 31?', 'World War 3 before 2027?']);
  assert.ok(!WAR_MATCH.test('Will it rain tomorrow?'));
  assert.ok(WAR_TERMS.every((t) => fixtureName(t).startsWith('polymarket/search-')));
  assert.equal(new Set([...WAR_TERMS, ...SEARCH_TERMS.cyber].map(fixtureName)).size, WAR_TERMS.length + SEARCH_TERMS.cyber.length);
});

test('war: collect meldet Wahrscheinlichkeit und Volumen unter den Kriegs-IDs, Cyber getrennt', async () => {
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => (/q=(cyber|ransomware|hack|internet)/.test(u) ? SAMPLE : WAR_SAMPLE), text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  const p = r.observations.find((o) => o.signalId === 'war.attention.prediction_markets_war')!;
  const v = r.observations.find((o) => o.signalId === 'war.attention.prediction_volume_spike')!;
  assert.ok(Math.abs(p.value - 21) < 1e-9);
  assert.equal(v.value, 5000);
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.markets.polymarket_cyber'));
});

test('war: Teilausfall bei den Kriegsbegriffen meldet für war nichts', async () => {
  let n = 0;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { if (++n === 7) throw new Error('500'); return /q=(cyber|ransomware|hack|internet)/.test(u) ? SAMPLE : WAR_SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  assert.ok(!r.observations.some((o) => o.signalId.startsWith('war.')));
  assert.ok(r.observations.some((o) => o.signalId.startsWith('cyber.')));
});
