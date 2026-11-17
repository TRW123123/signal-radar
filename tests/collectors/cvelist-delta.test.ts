import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelta } from '../../src/collectors/cvelist-delta.ts';

// nach der echten Form von deltaLog.json nachgebaut (kleines Beispiel, neueste zuerst)
const e = (t: string, n: number, u: number) => ({ fetchTime: t, numberOfChanges: n + u, new: Array(n).fill({ cveId: 'CVE-2026-1' }), updated: Array(u).fill({ cveId: 'CVE-2026-2' }), error: [] });
const LOG = [
  e('2026-11-16T12:10:00.000Z', 1, 1), // laufende Stunde
  e('2026-11-16T10:50:00.000Z', 2, 0),
  e('2026-11-16T10:20:00.000Z', 3, 4),
  e('2026-11-16T08:05:00.000Z', 1, 0), // Stunde 09 ohne Eintrag
  e('2026-11-16T07:30:00.000Z', 9, 9), // erste Stunde, angeschnitten
];

test('Normalfall: Summe je volle Stunde, Lücke = 0, laufende und erste Stunde entfallen', () => {
  const r = parseDelta(LOG, new Date('2026-11-16T12:30:00Z'));
  assert.deepEqual(r.map((x) => [new Date(x.hour).toISOString().slice(11, 13), x.published, x.updated]), [
    ['08', 1, 0], ['09', 0, 0], ['10', 5, 4], ['11', 0, 0],
  ]);
});
test('leere Antwort', () => {
  assert.deepEqual(parseDelta([], new Date('2026-11-16T12:30:00Z')), []);
});
test('fehlende Felder und falsche Form', () => {
  assert.throws(() => parseDelta({ foo: 1 }, new Date()), /Liste/);
  const r = parseDelta([{ fetchTime: '2026-11-16T10:20:00Z' }, { fetchTime: '2026-11-16T11:20:00Z' }, { fetchTime: '2026-11-16T13:20:00Z' }], new Date('2026-11-16T13:40:00Z'));
  assert.deepEqual(r.map((x) => x.published + x.updated), [0, 0]);
});
test('veraltetes Log wirft Fehler', () => {
  assert.throws(() => parseDelta(LOG, new Date('2026-11-17T12:00:00Z')), /veraltet/);
});
