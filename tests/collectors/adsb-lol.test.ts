import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMilCount } from '../../src/collectors/adsb-lol.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
test('total wird bevorzugt', () => assert.equal(parseMilCount({ ac: [{}, {}], total: 7 }), 7));
test('Länge von ac als Ersatz, leere Liste ist 0', () => {
  assert.equal(parseMilCount({ ac: [{}, {}, {}] }), 3);
  assert.equal(parseMilCount({ ac: [], total: 0 }), 0);
});
test('fehlendes Feld wirft', () => assert.throws(() => parseMilCount({}), /fehlt/));
