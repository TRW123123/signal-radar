import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, GROUPS } from '../../src/collectors/wikimedia-pageviews.ts';

// Form laut Auftrag/Doku: {"items":[{"timestamp":"2026090300","views":1}, ...]}; Zahlen frei gewählt, keine Aufzeichnung.
const sample = (v: number) => ({ items: [{ timestamp: '2026110100', views: v }, { timestamp: '2026110200', views: v + 1 }] });

test('parse: Tageswerte, kaputte Einträge werden übersprungen, fehlendes items wirft', () => {
  assert.deepEqual([...parse(sample(4))], [['20261101', 4], ['20261102', 5]]);
  assert.equal(parse({ items: [{ timestamp: 'x', views: 1 }, { timestamp: '2026110100', views: 'a' as never }] }).size, 0);
  assert.throws(() => parse({}), /items fehlt/);
});

test('jede Gruppe hat 8 bis 10 Artikel', () => {
  for (const g of GROUPS) assert.ok(g.articles.length >= 8 && g.articles.length <= 10, g.signalId);
});

function ctxWith(fail: (url: string) => string | null) {
  const logs: string[] = [];
  return { logs, ctx: { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: (m: string) => logs.push(m),
    http: { text: async () => '', json: async (url: string) => { const e = fail(url); if (e) throw new Error(e); return sample(10); } } } };
}

test('collect: ein 404 fällt aus der Summe, Zahl der Artikel steht in meta', async () => {
  const { ctx } = ctxWith((u) => (u.includes('/Botnet/') && u.includes('de.wikipedia') ? 'HTTP 404 ' + u : null));
  const r = await collector.collect(ctx as never);
  const de = r.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de');
  assert.equal(de[0].value, 90); // 9 Artikel * 10
  assert.equal((de[0].meta as { articles: number }).articles, 9);
  assert.equal(r.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_en')[0].value, 100);
});

test('collect: unter 80 % oder Nicht-404-Fehler meldet für die Gruppe nichts', async () => {
  const many = ctxWith((u) => (u.includes('de.wikipedia') && !/\/(Stromausfall|Notvorrat|Hacker)\//.test(u) ? 'HTTP 404 ' + u : null));
  const r1 = await collector.collect(many.ctx as never);
  assert.equal(r1.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de').length, 0);
  const timeout = ctxWith((u) => (u.includes('/Hacker/') ? 'Timeout' : null));
  const r2 = await collector.collect(timeout.ctx as never);
  assert.equal(r2.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de').length, 0);
  assert.ok(r2.observations.some((o) => o.signalId === 'cyber.attention.wikipedia_en'));
});
