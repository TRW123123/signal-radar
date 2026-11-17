import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshots } from '../../src/collectors/bitnodes.ts';

// nach Doku nachgebaut
const SAMPLE = { count: 2, results: [
  { timestamp: 1763337600, total_nodes: 21000, latest_height: 1 },
  { timestamp: 1763337000, total_nodes: 20950 },
  { timestamp: 1763336400, total_nodes: null },
] };

test('Normalfall, sortiert, ohne ungültige', () => {
  const o = parseSnapshots(SAMPLE);
  assert.equal(o.length, 2);
  assert.equal(o[0].value, 20950);
  assert.ok(o[0].ts < o[1].ts);
});
test('leere Antwort', () => assert.deepEqual(parseSnapshots({ results: [] }), []));
test('fehlendes Feld', () => assert.throws(() => parseSnapshots({}), /results/));

// Echter Ausschnitt (17.11.2026): Snapshots kommen etwa stündlich, nicht alle 10 Minuten
const REAL = { count: 6188, next: '/api/v1/snapshots/?page=2&limit=100', previous: null, results: [
  { url: '/api/v1/snapshots/1794871366/', timestamp: 1794871366, total_nodes: 19925, latest_height: 976193 },
  { url: '/api/v1/snapshots/1794867852/', timestamp: 1794867852, total_nodes: 19439, latest_height: 976190 },
] };
test('parseSnapshots echte Antwort, aufsteigend sortiert', () => {
  const o = parseSnapshots(REAL);
  assert.deepEqual(o.map((x) => x.value), [19439, 19925]);
  assert.equal(o[1].ts, '2026-11-16T23:22:46.000Z');
});
