import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReleases, releasesPerDay } from '../../src/collectors/chromiumdash.ts';

// nach Doku nachgebaut
const t = (s: string) => Date.parse(s);
const SAMPLE = [
  { channel: 'Stable', platform: 'Windows', milestone: 142, version: '142.0.1.2', time: t('2026-11-12T10:00:00Z') },
  { channel: 'Stable', platform: 'Windows', milestone: 142, version: '142.0.1.1', time: t('2026-11-12T20:00:00Z') },
  { channel: 'Stable', platform: 'Windows', milestone: 142, version: '142.0.1.0', time: t('2026-11-05T10:00:00Z') },
  { channel: 'Stable', platform: 'Windows', milestone: 141, version: '141.0.9.9', time: t('2026-10-29T10:00:00Z') },
  { platform: 'Windows' },
];
const now = new Date('2026-11-17T00:00:00Z');

test('Normalfall: Releases pro Tag, Fenster beginnt nach ältestem Release', () => {
  const r = parseReleases(SAMPLE);
  assert.equal(r.length, 4);
  const o = releasesPerDay(r, now, 90);
  assert.equal(o[0].ts, '2026-10-30T00:00:00.000Z');
  assert.equal(o.find((x) => x.ts.startsWith('2026-11-12'))!.value, 2);
  assert.equal(o.find((x) => x.ts.startsWith('2026-11-13'))!.value, 0);
  assert.ok(!o.some((x) => x.ts.startsWith('2026-10-29')));
});
test('leere Antwort', () => {
  assert.deepEqual(parseReleases([]), []);
  assert.deepEqual(releasesPerDay([], now, 90), []);
});
test('kein Array wirft', () => {
  assert.throws(() => parseReleases({ error: 'x' }), /Release-Liste/);
});
