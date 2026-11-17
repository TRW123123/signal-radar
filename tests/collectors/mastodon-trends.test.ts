import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, buildUrl, TAGS } from '../../src/collectors/mastodon-trends.ts';

// SAMPLE: nach Doku nachgebaut (Tag-Entität, history[] mit Strings), keine echte Aufzeichnung.
const t = (d: string) => String(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000);
const SAMPLE = { name: 'infosec', history: [
  { day: t('2026-11-17'), uses: '3', accounts: '2' },
  { day: t('2026-11-16'), uses: '120', accounts: '80' },
  { day: t('2026-11-15'), uses: '100', accounts: '70' },
] };

test('Normalfall: uses je Tag', () => {
  const m = parse(SAMPLE);
  assert.equal(m.get('2026-11-16'), 120);
  assert.equal(m.size, 3);
});

test('leere Antwort und fehlendes Feld', () => {
  assert.equal(parse({ history: [] }).size, 0);
  assert.throws(() => parse({}), /history fehlt/);
  assert.equal(parse({ history: [{ day: 'x', uses: '1' }, { day: t('2026-11-16') }] }).size, 0);
});

test('collect: Summe über Tags, laufender Tag fehlt', async () => {
  const ctx = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {}, http: { json: async () => SAMPLE, text: async () => '' } };
  const r = await collector.collect(ctx as never);
  assert.equal(r.observations.length, 2);
  assert.equal(r.observations.find((o) => o.ts.startsWith('2026-11-16'))?.value, 120 * TAGS.length);
});

test('collect: Teilausfall meldet nichts, Totalausfall wirft', async () => {
  let n = 0;
  const base = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {} };
  const partial = { ...base, http: { json: async () => { if (++n === 1) throw new Error('401'); return SAMPLE; }, text: async () => '' } };
  assert.equal((await collector.collect(partial as never)).observations.length, 0);
  const dead = { ...base, http: { json: async () => { throw new Error('401'); }, text: async () => '' } };
  await assert.rejects(collector.collect(dead as never), /kein Hashtag/);
  assert.equal(buildUrl('infosec'), 'https://mastodon.social/api/v1/tags/infosec');
});

// Gekürzter echter Ausschnitt (/api/v1/tags/infosec, mastodon.social, 17.11.2026): day = Unix-Sekunden als String.
const REAL = { id: '1487', name: 'infosec', url: 'https://mastodon.social/tags/infosec', history: [
  { day: '1794873600', accounts: '14', uses: '22' }, { day: '1794787200', accounts: '115', uses: '808' },
  { day: '1794700800', accounts: '77', uses: '359' }, { day: '1794614400', accounts: '86', uses: '372' },
] };

test('echte Antwort: Tage in UTC, uses als Zahl', () => {
  const m = parse(REAL);
  assert.equal(m.get('2026-11-17'), 22);
  assert.equal(m.get('2026-11-16'), 808);
  assert.equal(m.size, 4);
});
