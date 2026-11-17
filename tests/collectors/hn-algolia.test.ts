import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseHits, countDays, buildUrl, fixtureName, TERMS } from '../../src/collectors/hn-algolia.ts';

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
  assert.equal(r.observations.length, 0);
});
