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
