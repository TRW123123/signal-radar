import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelta } from '../../src/collectors/cvelist-delta.ts';

// nach der echten Form von deltaLog.json nachgebaut (kleines Beispiel, neueste zuerst)
const e = (t: string, n: number, u: number) => ({ fetchTime: t, numberOfChanges: n + u, new: Array(n).fill({ cveId: 'CVE-2026-1' }), updated: Array(u).fill({ cveId: 'CVE-2026-2' }), error: [] });
const LOG = [
  e('2026-11-16T12:10:00.000Z', 1, 1), // laufender Tag
  e('2026-11-15T22:50:00.000Z', 2, 0),
  e('2026-11-15T10:20:00.000Z', 3, 4),
  e('2026-11-14T08:05:00.000Z', 1, 0), // Tag 13 ohne Eintrag
  e('2026-11-12T07:30:00.000Z', 9, 9), // erster Tag, angeschnitten
  e('2026-11-12T01:30:00.000Z', 1, 1),
];

test('Normalfall: Summe je voller Tag, Lücke = 0, laufender und erster Tag entfallen', () => {
  const r = parseDelta(LOG, new Date('2026-11-16T12:30:00Z'));
  assert.deepEqual(r.map((x) => [new Date(x.day).toISOString().slice(0, 10), x.published, x.updated]), [
    ['2026-11-13', 0, 0], ['2026-11-14', 1, 0], ['2026-11-15', 5, 4],
  ]);
});
test('leere Antwort', () => {
  assert.deepEqual(parseDelta([], new Date('2026-11-16T12:30:00Z')), []);
});
test('fehlende Felder und falsche Form', () => {
  assert.throws(() => parseDelta({ foo: 1 }, new Date()), /Liste/);
  const r = parseDelta([{ fetchTime: '2026-11-14T10:20:00Z' }, { fetchTime: '2026-11-15T11:20:00Z' }, { fetchTime: '2026-11-16T13:20:00Z' }], new Date('2026-11-16T13:40:00Z'));
  assert.deepEqual(r.map((x) => x.published + x.updated), [0]);
});
test('veraltetes Log wirft Fehler', () => {
  assert.throws(() => parseDelta(LOG, new Date('2026-11-17T12:00:00Z')), /veraltet/);
});
