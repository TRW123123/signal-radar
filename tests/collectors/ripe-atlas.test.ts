import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProbeCount } from '../../src/collectors/ripe-atlas.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const SAMPLE = { count: 1234, next: 'https://atlas.ripe.net/api/v2/probes/?page=2', previous: null, results: [{ id: 1 }] };

test('Normalfall', () => assert.equal(parseProbeCount(SAMPLE), 1234));
test('leere Antwort: count 0 ist gültig', () => assert.equal(parseProbeCount({ count: 0, results: [] }), 0));
test('fehlendes Feld', () => {
  assert.throws(() => parseProbeCount({ results: [] }), /count/);
  assert.throws(() => parseProbeCount(null), /Antwort/);
  assert.throws(() => parseProbeCount({ count: 'abc' }), /count/);
});
