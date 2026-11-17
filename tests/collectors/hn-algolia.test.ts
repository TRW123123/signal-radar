import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseHits, countDays, buildUrl, fixtureName, TERMS, WAR_TERMS } from '../../src/collectors/hn-algolia.ts';

// SAMPLE: nach Doku nachgebaut (Algolia search_by_date mit attributesToRetrieve=created_at_i), keine echte Aufzeichnung.
const D = Date.UTC(2026, 10, 10); // 2026-11-10
const SAMPLE = { nbHits: 3, hits: [{ created_at_i: (D + 3600_000 * 5) / 1000 }, { created_at_i: (D + 3600_000) / 1000 }, { created_at_i: (D - 3600_000) / 1000 }] };

test('Normalfall: Hits werden pro Tag gezählt', () => {
  const p = parseHits(SAMPLE);
  assert.equal(p.times.length, 3);
  const { counts, coveredFrom } = countDays(p, D - 2 * 86400_000, D + 86400_000);
  assert.equal(counts.get('2026-11-10'), 2);
  assert.equal(counts.get('2026-11-09'), 1);
  assert.equal(counts.get('2026-11-08'), 0);
  assert.equal(coveredFrom, '2026-11-08');
});

test('leere Antwort: keine Hits, alles null', () => {
  const p = parseHits({ nbHits: 0, hits: [] });
  const { counts } = countDays(p, D - 86400_000, D + 86400_000);
  assert.deepEqual([...counts.values()], [0, 0]);
});

test('fehlendes Feld hits wirft klaren Fehler, kaputte Einträge werden übersprungen', () => {
  assert.throws(() => parseHits({ nbHits: 5 }), /hits fehlt/);
  assert.equal(parseHits({ hits: [{}, { created_at_i: 'x' as unknown as number }] }).times.length, 0);
});

test('Seitenlimit erreicht: ältester Tag wird als unvollständig verworfen', () => {
  const times = [D + 7200_000, D + 3600_000, D - 3600_000]; // ältester liegt am 09.11.
  const { coveredFrom } = countDays({ nbHits: 50, times }, D - 3 * 86400_000, D + 86400_000, 3);
  assert.equal(coveredFrom, '2026-11-10');
});

test('URL und Fixture-Namen', () => {
  assert.match(buildUrl('"is down"', 1, 2), /query=%22is%20down%22.*hitsPerPage=400/);
  assert.equal(fixtureName('"is down"'), 'hn-algolia/is-down.json');
  assert.equal(TERMS.length, 5);
});

test('collect: Teilausfall liefert nichts statt Scheineinbruch', async () => {
  let n = 0;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async () => { if (++n === 2) throw new Error('boom'); return SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  assert.equal(r.observations.filter((o) => o.signalId === 'cyber.attention.hackernews_volume').length, 0);
});

// Gekürzter echter Ausschnitt (search_by_date "outage", 17.11.2026): nur created_at_i und objectID, wie angefordert.
const REAL = { exhaustiveNbHits: true, nbHits: 117, hits: [
  { created_at_i: 1794870537, objectID: '50524882' }, { created_at_i: 1794868492, objectID: '50524437' },
  { created_at_i: 1794867738, objectID: '50524260' }, { created_at_i: 1794785000, objectID: '50500000' },
] };

test('echte Antwort: Form wird gelesen, Tageszählung', () => {
  const p = parseHits(REAL);
  assert.equal(p.nbHits, 117);
  assert.equal(p.times.length, 4);
  const { counts } = countDays(p, Date.UTC(2026, 10, 15), Date.UTC(2026, 10, 17));
  assert.equal(counts.get('2026-11-16'), 3);
  assert.equal(counts.get('2026-11-15'), 1);
});

// --- Szenario war ---
test('war: Begriffe, eigene Fixture-Namen und Seitengröße 300 (Antwort unter 20 000 Zeichen)', () => {
  assert.equal(WAR_TERMS.length, 6);
  assert.equal(fixtureName('"nuclear war"', 'war-'), 'hn-algolia/war-nuclear-war.json');
  assert.match(buildUrl('Hormuz', 1, 2, 300), /hitsPerPage=300$/);
  const cyber = new Set(TERMS.map((t) => fixtureName(t)));
  assert.ok(WAR_TERMS.every((t) => !cyber.has(fixtureName(t, 'war-'))));
});

test('war: collect meldet beide Szenarien getrennt, Cyber-Anfragen bleiben unverändert', async () => {
  const urls: string[] = [];
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { urls.push(u); return SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.attention.hackernews_volume'));
  assert.ok(r.observations.some((o) => o.signalId === 'war.attention.hackernews_mentions'));
  assert.equal(urls.length, TERMS.length + WAR_TERMS.length);
  assert.ok(urls.slice(0, 5).every((u) => u.endsWith('hitsPerPage=400')));
  assert.ok(collector.signals.find((s) => s.id === 'war.attention.hackernews_mentions')!.scenarios!.includes('war'));
});

test('war: Teilausfall bei den Kriegsbegriffen meldet für war nichts, Cyber bleibt', async () => {
  let n = 0;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async () => { if (++n === 7) throw new Error('boom'); return SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.attention.hackernews_volume'));
  assert.ok(!r.observations.some((o) => o.signalId === 'war.attention.hackernews_mentions'));
});
