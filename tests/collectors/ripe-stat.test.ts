import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCountryStats, parseRoutingStatus } from '../../src/collectors/ripe-stat.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const STATS = { data: { stats: [
  { date: '2026-11-15', v4_prefixes_ris: 1000, v6_prefixes_ris: 200 },
  { date: '2026-11-16', v4_prefixes_ris: 1010, v6_prefixes_ris: 205 },
  { date: '2026-11-17', v4_prefixes_ris: 1010 },
] } };
const STATUS = { data: { visibility: { v4: { ris_peers_seeing: 300, total_ris_peers: 320 }, v6: { ris_peers_seeing: 290, total_ris_peers: 320 } } } };

test('Normalfall', () => {
  const p = parseCountryStats(STATS);
  assert.equal(p.length, 2); // unvollständiger Eintrag fehlt
  assert.equal(p[0].value, 1200);
  assert.equal(p[0].ts, Date.parse('2026-11-15T00:00:00Z'));
  assert.equal(parseRoutingStatus(STATUS), 300 / 320);
});
test('leere Antwort', () => {
  assert.deepEqual(parseCountryStats({ data: { stats: [] } }), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseCountryStats({ data: {} }), /stats/);
  assert.throws(() => parseRoutingStatus({ data: {} }), /visibility/);
  assert.throws(() => parseRoutingStatus({ data: { visibility: { v4: { ris_peers_seeing: 1, total_ris_peers: 0 } } } }), /0/);
});
test('Eintrag ohne Datum liefert ts null', () => {
  assert.equal(parseCountryStats({ data: { stats: [{ v4_prefixes_ris: 1, v6_prefixes_ris: 2 }] } })[0].ts, null);
});

// gekürzter echter Ausschnitt (17.11.2026, Anfang der Antwort von country-routing-stats; v6 kann halbe Werte tragen)
const REAL_STATS = { messages: [], data_call_name: 'country-routing-stats', status: 'ok', data: { query_starttime: '2026-09-03T00:00:00', query_endtime: '2026-11-16T00:00:00', stats: [
  { timeline: [{ starttime: '2026-09-03T00:00:00', endtime: '2026-09-03T00:00:00' }], v4_prefixes_ris: 21789, v6_prefixes_ris: 5142.5, asns_ris: 2357, v4_prefixes_stats: -1, v6_prefixes_stats: -1, asns_stats: 3239, stats_date: '2026-09-03T00:00:00' },
] } };
test('echte Form country-routing-stats', () => {
  const p = parseCountryStats(REAL_STATS);
  assert.equal(p.length, 1);
  assert.equal(p[0].value, 26931.5);
  assert.equal(p[0].ts, Date.parse('2026-09-03T00:00:00Z'));
});
// gekürzter echter Ausschnitt routing-status AS3320 (17.11.2026)
test('echte Form routing-status', () => {
  const real = { data: { visibility: { v4: { ris_peers_seeing: 320, total_ris_peers: 320 }, v6: { ris_peers_seeing: 302, total_ris_peers: 309 } }, resource: '3320' } };
  assert.equal(parseRoutingStatus(real), 1);
});
