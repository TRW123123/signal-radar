import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseNbHits, buildUrl, fixtureName, GROUPS } from '../../src/collectors/hn-algolia.ts';

// SAMPLE: nach Doku nachgebaut (Algolia search_by_date mit hitsPerPage=0), keine echte Aufzeichnung.
const sample = (n: number) => ({ hits: [], nbHits: n, page: 0, nbPages: 0, hitsPerPage: 0, exhaustiveNbHits: true, query: 'outage', params: '' });

const cyber = GROUPS.find((g) => g.signalId === 'cyber.attention.hackernews_volume')!;
const war = GROUPS.find((g) => g.signalId === 'war.attention.hackernews_mentions')!;

test('parseNbHits: Normalfall, null, fehlendes Feld', () => {
  assert.equal(parseNbHits(sample(17)), 17);
  assert.equal(parseNbHits(sample(0)), 0);
  assert.throws(() => parseNbHits({}), /nbHits fehlt/);
  assert.throws(() => parseNbHits({ nbHits: 'x' }), /nbHits fehlt/);
});

// Gekürzter echter Ausschnitt (search_by_date "outage", 17.11.2026, damals mit Trefferliste): nbHits steht auf oberster Ebene.
test('echte Antwortform: nbHits auf oberster Ebene', () => {
  assert.equal(parseNbHits({ exhaustiveNbHits: true, nbHits: 117, hits: [{ created_at_i: 1794870537, objectID: '50524882' }] } as never), 117);
});

test('URL: Titelsuche, Tagesfenster [start, end), hitsPerPage=0; Fixture-Namen mit Suffix -24h', () => {
  assert.equal(buildUrl('"is down"', 1794787200, 1794873600),
    'https://hn.algolia.com/api/v1/search_by_date?query=%22is%20down%22&tags=story&restrictSearchableAttributes=title'
    + '&numericFilters=created_at_i%3E%3D1794787200%2Ccreated_at_i%3C1794873600&hitsPerPage=0');
  assert.equal(fixtureName('"is down"'), 'hn-algolia/is-down-24h.json');
  assert.equal(fixtureName('"nuclear war"', 'war-'), 'hn-algolia/war-nuclear-war-24h.json');
  assert.equal(cyber.terms.length, 4);
  assert.equal(war.terms.length, 6);
  const names = GROUPS.flatMap((g) => g.terms.map((t) => fixtureName(t, g.prefix)));
  assert.equal(new Set(names).size, names.length);
});

function ctx(json: (u: string) => unknown) {
  return { now: new Date('2026-11-17T00:16:13Z'), key: () => undefined, log: () => {}, http: { json: async (u: string) => json(u), text: async () => '' } };
}

test('collect: je Szenario ein Tageswert für den Vortag, Summe über die Begriffe', async () => {
  const urls: string[] = [];
  const r = await collector.collect(ctx((u) => { urls.push(u); return sample(3); }) as never);
  assert.equal(urls.length, GROUPS.reduce((n, g) => n + g.terms.length, 0));
  assert.ok(urls.every((u) => u.includes('created_at_i%3E%3D1794787200%2Ccreated_at_i%3C1794873600')));
  const c = r.observations.filter((o) => o.signalId === cyber.signalId);
  assert.deepEqual(c.map((o) => [o.ts, o.value]), [['2026-11-16T00:00:00.000Z', 3 * cyber.terms.length]]);
  assert.deepEqual(r.observations.filter((o) => o.signalId === war.signalId).map((o) => o.value), [18]);
  assert.ok(collector.signals.find((s) => s.id === war.signalId)!.scenarios!.includes('war'));
});

test('collect: Teilausfall eines Szenarios liefert dort nichts statt Scheineinbruch, anderes Szenario bleibt', async () => {
  const r = await collector.collect(ctx((u) => { if (u.includes('Hormuz')) throw new Error('boom'); return sample(2); }) as never);
  assert.ok(r.observations.some((o) => o.signalId === cyber.signalId));
  assert.ok(!r.observations.some((o) => o.signalId === war.signalId));
});

test('collect: gar keine Antwort ist ein Fehler', async () => {
  await assert.rejects(collector.collect(ctx(() => { throw new Error('down'); }) as never), /kein Begriff abrufbar/);
});
