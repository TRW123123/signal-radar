import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import collector, { dailyCounts, INCIDENT_CAP, incidentsUrl, MAX_DAYS, MIN_DAYS, parseStarts, PROVIDERS, SIG_SUM } from '../../src/collectors/ai-provider-incidents.ts';

// nach Doku nachgebaut (Statuspage /api/v2/incidents.json), keine echte Antwort
const SAMPLE = JSON.parse(readFileSync(new URL('../../fixtures/ai-provider-incidents/doc-sample-incidents.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-17T00:16:00Z');

test('Parser: impact none zählt nicht, fehlendes impact zählt', () => {
  const l = parseStarts(SAMPLE);
  assert.equal(l.starts.length, 4);
  assert.equal(l.full, false);
  assert.equal(new Date(l.oldest!).toISOString(), '2026-11-02T07:58:00.000Z');
  assert.equal(parseStarts({ incidents: [{ created_at: '2026-11-10T00:00:00Z' }] }).starts.length, 1);
});
test('Parser: leere Liste und fehlendes Feld', () => {
  assert.deepEqual(parseStarts({ incidents: [] }), { starts: [], full: false, oldest: null });
  assert.throws(() => parseStarts({} as never), /incidents/);
});
test('Tageszählung: volle Tage bis gestern, Summe über Anbieter', () => {
  const l = parseStarts(SAMPLE);
  const s = dailyCounts([l, l], NOW)!;
  assert.equal(s.length, MAX_DAYS);
  assert.equal(s.at(-1)!.day, '2026-11-16');
  assert.equal(s.at(-1)!.n, 4);
  assert.equal(s.find((d) => d.day === '2026-11-14')!.n, 0);
  assert.equal(dailyCounts([l, null], NOW), null);
});
test('volle Liste: Zeitraum beginnt nach dem ältesten Eintrag, unter 7 Tagen nichts', () => {
  const mk = (oldestDay: string) => ({ incidents: Array.from({ length: INCIDENT_CAP }, () => ({ impact: 'minor', created_at: `${oldestDay}T12:00:00Z` })) });
  assert.equal(dailyCounts([parseStarts(mk('2026-11-12'))], NOW), null);
  const s = dailyCounts([parseStarts(mk('2026-11-05'))], NOW)!;
  assert.equal(s.length, 11);
  assert.ok(s.length >= MIN_DAYS);
  assert.equal(s[0].day, '2026-11-06');
});
test('Collector: je Anbieter und Summe; ein Ausfall meldet keine Summe', async () => {
  const urls: string[] = [];
  const http = { json: async (u: string) => { urls.push(u); return SAMPLE; }, text: async () => '' } as never;
  const r = await collector.collect({ now: NOW, http, key: () => undefined, log: () => {} });
  assert.deepEqual(urls.sort(), PROVIDERS.map((p) => incidentsUrl(p.host)).sort());
  assert.equal(r.observations.filter((o) => o.signalId === SIG_SUM).length, MAX_DAYS);
  for (const p of PROVIDERS) assert.equal(r.observations.filter((o) => o.signalId === p.signal).length, MAX_DAYS);

  const http2 = { json: async (u: string) => { if (u.includes('openai')) throw new Error('404'); return SAMPLE; }, text: async () => '' } as never;
  const r2 = await collector.collect({ now: NOW, http: http2, key: () => undefined, log: () => {} });
  assert.equal(r2.observations.filter((o) => o.signalId === SIG_SUM).length, 0);
  assert.equal(r2.observations.filter((o) => o.signalId === 'ai.platforms.anthropic_incident_starts').length, MAX_DAYS);

  const http3 = { json: async () => { throw new Error('down'); }, text: async () => '' } as never;
  await assert.rejects(collector.collect({ now: NOW, http: http3, key: () => undefined, log: () => {} }), /keine Statusseite/);
});
