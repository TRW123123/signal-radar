import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, GROUPS, MAX_ARTICLES, fixtureName, buildUrl } from '../../src/collectors/wikimedia-pageviews.ts';

// Form laut Auftrag/Doku: {"items":[{"timestamp":"2026090300","views":1}, ...]}; Zahlen frei gewählt, keine Aufzeichnung.
const sample = (v: number) => ({ items: [{ timestamp: '2026110100', views: v }, { timestamp: '2026110200', views: v + 1 }] });

test('parse: Tageswerte, kaputte Einträge werden übersprungen, fehlendes items wirft', () => {
  assert.deepEqual([...parse(sample(4))], [['20261101', 4], ['20261102', 5]]);
  assert.equal(parse({ items: [{ timestamp: 'x', views: 1 }, { timestamp: '2026110100', views: 'a' as never }] }).size, 0);
  assert.throws(() => parse({}), /items fehlt/);
});

test('jede Gruppe hat 1 bis 6 Artikel, Fenster 30 Tage, Baseline day-of-week 28/14', () => {
  assert.equal(MAX_ARTICLES, 6);
  for (const g of GROUPS) assert.ok(g.articles.length >= 1 && g.articles.length <= MAX_ARTICLES, g.signalId);
  for (const s of collector.signals) assert.deepEqual(s.baseline, { method: 'day-of-week', windowDays: 28, minPoints: 14 });
  assert.equal(fixtureName('de.wikipedia', 'Hacker'), 'wikimedia/de.wikipedia-Hacker-30d.json');
  assert.equal(buildUrl('de.wikipedia', 'Hacker', '20261018', '20261116'),
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Hacker/daily/20261018/20261116');
});

function ctxWith(fail: (url: string) => string | null) {
  const logs: string[] = [];
  return { logs, ctx: { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: (m: string) => logs.push(m),
    http: { text: async () => '', json: async (url: string) => { const e = fail(url); if (e) throw new Error(e); return sample(10); } } } };
}

test('collect: ein 404 fällt aus der Summe, Zahl der Artikel steht in meta', async () => {
  const { ctx } = ctxWith((u) => (u.includes('/Phishing/') && u.includes('de.wikipedia') ? 'HTTP 404 ' + u : null));
  const r = await collector.collect(ctx as never);
  const de = r.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de');
  assert.equal(de[0].value, 50); // 5 Artikel * 10
  assert.equal((de[0].meta as { articles: number }).articles, 5);
  assert.equal(r.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_en')[0].value, 60);
});

test('collect: unter 80 % oder Nicht-404-Fehler meldet für die Gruppe nichts', async () => {
  const many = ctxWith((u) => (u.includes('de.wikipedia') && !/\/(Stromausfall|Phishing|Hacker)\//.test(u) ? 'HTTP 404 ' + u : null));
  const r1 = await collector.collect(many.ctx as never);
  assert.equal(r1.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de').length, 0);
  const timeout = ctxWith((u) => (u.includes('/Hacker/') ? 'Timeout' : null));
  const r2 = await collector.collect(timeout.ctx as never);
  assert.equal(r2.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de').length, 0);
  assert.ok(r2.observations.some((o) => o.signalId === 'cyber.attention.wikipedia_en'));
});

test('war: zwei Gruppen mit den vorgegebenen IDs, Szenario war, Domain attention', () => {
  const war = GROUPS.filter((g) => g.scenario === 'war');
  assert.deepEqual(war.map((g) => g.signalId), ['war.attention.wikipedia_de', 'war.attention.wikipedia_en']);
  assert.ok(war[0].articles.includes('Dritter_Weltkrieg') && war[1].articles.includes('World_War_III'));
  const sigs = collector.signals.filter((s) => s.id.startsWith('war.'));
  assert.equal(sigs.length, 2);
  assert.ok(sigs.every((s) => s.domain === 'attention' && s.evidenceClass === 'D' && s.scenarios!.join() === 'war' && s.plain && s.name));
});

test('war: collect summiert die Kriegsartikel, Fixture-Namen sind neu', async () => {
  const urls: string[] = [];
  const { ctx } = ctxWith((u) => { urls.push(u); return null; });
  const r = await collector.collect(ctx as never);
  const de = r.observations.filter((o) => o.signalId === 'war.attention.wikipedia_de');
  assert.equal(de[0].value, 60);
  assert.equal(r.observations.filter((o) => o.signalId === 'war.attention.wikipedia_en')[0].value, 60);
  assert.ok(urls.some((u) => u.includes('/en.wikipedia/all-access/user/Strait_of_Hormuz/daily/20261018/20261116')));
  assert.equal(urls.length, GROUPS.reduce((n, g) => n + g.articles.length, 0));
});

test('war: 404 bei Straße_von_Hormus fällt aus der Summe, Cyber-Gruppen unberührt', async () => {
  const { ctx } = ctxWith((u) => (u.includes('Stra%C3%9Fe_von_Hormus') ? 'HTTP 404 ' + u : null));
  const r = await collector.collect(ctx as never);
  const de = r.observations.filter((o) => o.signalId === 'war.attention.wikipedia_de');
  assert.equal(de[0].value, 50);
  assert.equal(r.observations.filter((o) => o.signalId === 'cyber.attention.wikipedia_de')[0].value, 60);
});
