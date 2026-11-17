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
  assert.equal(fixtureName('cyber attack'), 'polymarket/search-cyber-attack.json');
  assert.match(buildUrl('cyber attack'), /q=cyber%20attack/);
  assert.ok(SEARCH_TERMS.cyber.length <= 8);
});
