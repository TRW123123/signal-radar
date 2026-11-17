import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { buildUrl, parsePage } from '../../src/collectors/sec-edgar.ts';

// Beispiel nach Doku/Drittbeschreibung nachgebaut (EDGAR-Volltextsuche).
const hit = (adsh: string, date: string, items: string[], form = '8-K') => ({ _id: `${adsh}:doc.htm`, _source: { adsh, form, file_date: date, items, display_names: ['X'] } });
const SAMPLE = { hits: { total: { value: 4, relation: 'eq' }, hits: [
  hit('0001-26-000001', '2026-11-12', ['1.05', '9.01']),
  hit('0001-26-000001', '2026-11-12', ['1.05', '9.01']), // zweites Dokument desselben Filings
  hit('0001-26-000002', '2026-11-12', ['8.01']),          // nur Erwähnung, kein Item 1.05
  hit('0001-26-000003', '2026-11-10', ['1.05'], '8-K/A'),  // Nachmeldung
] } };

test('parsePage: Normalfall filtert auf Item 1.05 in 8-K', () => {
  const p = parsePage(SAMPLE);
  assert.equal(p.total, 4);
  assert.equal(p.rawCount, 4);
  assert.equal(new Set(p.filings.map((f) => f.id)).size, 1);
});
test('parsePage: leere Antwort', () => {
  const p = parsePage({ hits: { total: { value: 0 }, hits: [] } });
  assert.deepEqual(p.filings, []);
});
test('parsePage: fehlendes Feld', () => {
  assert.throws(() => parsePage({} as never), /hits/);
  assert.throws(() => parsePage({ hits: {} }), /hits\.hits/);
  assert.equal(parsePage({ hits: { hits: [{ _source: { file_date: '2026-11-01' } }] } }).filings.length, 0);
});
test('buildUrl', () => {
  assert.equal(buildUrl('2026-08-19', '2026-11-17', 0), 'https://efts.sec.gov/LATEST/search-index?q=%22Item%201.05%22&forms=8-K&dateRange=custom&startdt=2026-08-19&enddt=2026-11-17&from=0');
});
test('collect: Tageszähler, UA-Header, heutiger Tag fehlt, 0 an leeren Tagen', async () => {
  let ua: string | undefined;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: (n: string) => (n === 'SR_SEC_USER_AGENT' ? 'Test test@example.org' : undefined), log: () => {},
    http: { json: async (_u: string, i?: { headers?: Record<string, string> }) => { ua = i?.headers?.['user-agent']; return SAMPLE; }, text: async () => '' },
  };
  // total 4, rawCount 4 < 100 -> one page
  const r = await collector.collect(ctx as never);
  assert.equal(ua, 'Test test@example.org');
  assert.equal(r.observations.length, 90);
  assert.equal(r.observations.find((o) => o.ts === '2026-11-12T00:00:00.000Z')!.value, 1);
  assert.equal(r.observations.find((o) => o.ts === '2026-11-16T00:00:00.000Z')!.value, 0);
  assert.ok(!r.observations.some((o) => o.ts.startsWith('2026-11-17')));
});
test('collect: unvollständige Trefferliste wirft', async () => {
  const big = { hits: { total: { value: 500 }, hits: Array.from({ length: 100 }, (_, i) => hit(`a${i}`, '2026-11-01', ['1.05'])) } };
  const ctx = { now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {}, http: { json: async () => big, text: async () => '' } };
  await assert.rejects(collector.collect(ctx as never), /unvollständig/);
});

// Echter Ausschnitt (17.11.2026, gekürzt auf benötigte Felder): zwei 8-K mit Item 1.05, ein 8-K nur mit Item 8.01
const REAL = { hits: { total: { value: 3, relation: 'eq' }, hits: [
  { _id: '0001104659-26-109813:asth-20260922x8k.htm', _source: { file_date: '2026-09-23', form: '8-K', adsh: '0001104659-26-109813', items: ['1.05'] } },
  { _id: '0001104659-26-104300:park-20260828x8k.htm', _source: { file_date: '2026-09-01', form: '8-K', adsh: '0001104659-26-104300', items: ['1.05', '9.01'] } },
  { _id: '0001628280-26-061432:x.htm', _source: { file_date: '2026-09-11', form: '8-K', adsh: '0001628280-26-061432', items: ['8.01', '9.01'] } },
] } };
test('parsePage echte Antwort: nur 8-K mit Item 1.05', () => {
  const p = parsePage(REAL);
  assert.equal(p.total, 3);
  assert.equal(p.rawCount, 3);
  assert.deepEqual(p.filings.map((f) => f.date), ['2026-09-23', '2026-09-01']);
});
