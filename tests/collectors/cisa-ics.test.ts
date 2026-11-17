import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseTimestamps } from '../../src/collectors/cisa-ics.ts';

// Nach CSAF-Spezifikation nachgebaut: "pfad,zeitstempel", neueste zuerst, keine Kopfzeile.
// Wochen (Montag): 2026-11-02, 2026-11-09, 2026-11-16 (laufend)
const SAMPLE = `2026/icsa-26-316-01.json,2026-11-12T07:00:00.000000Z
2026/icsa-26-314-02.json,2026-11-10T07:00:00.000000Z
2026/icsa-26-314-01.json,2026-11-10T07:00:00.000000Z
2026/icsa-26-309-01.json,2026-11-05T07:00:00.000000Z
2026/icsa-26-307-01.json,2026-11-03T07:00:00.000000Z
2026/icsa-26-321-01.json,2026-11-17T07:00:00.000000Z
`;
const NOW = new Date('2026-11-17T12:00:00Z');

test('Normalfall: nur volle Wochen, älteste und laufende entfallen', () => {
  const o = parse(SAMPLE, NOW);
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-09', 3]]);
});

test('Woche beginnt am Montag', () => {
  const o = parse(SAMPLE + '2026/x.json,2026-10-28T07:00:00Z\n', NOW);
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-02', 2], ['2026-11-09', 3]]);
});

test('leere Antwort', () => {
  assert.throws(() => parse('', NOW), /unerwartete Antwort/);
});

test('fehlendes Feld: Zeilen ohne Zeitstempel werden ignoriert', () => {
  assert.equal(parseTimestamps('a.json\nb.json,kaputt\n').length, 0);
});

// gekürzter echter Ausschnitt (17.11.2026): Anführungszeichen, Mikrosekunden, Z
const REAL = [
  '"2026/icsa-26-316-05.json","2026-11-12T07:00:00.000000Z"',
  '"2026/icsa-26-307-01.json","2026-11-03T06:00:00.000000Z"',
  '"2026/icsa-26-302-03.json","2026-10-29T06:00:00.000000Z"',
  '"2026/icsa-26-302-02.json","2026-10-29T06:00:00.000000Z"',
].join('\n');
test('echter Ausschnitt', () => {
  assert.equal(parseTimestamps(REAL).length, 4);
  const o = parse(REAL, NOW);
  assert.deepEqual(o.map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-02', 1], ['2026-11-09', 1]]);
});
