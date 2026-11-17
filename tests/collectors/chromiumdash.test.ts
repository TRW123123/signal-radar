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

// gekürzter echter Ausschnitt (17.11.2026): mehrere Versionen mit identischem Zeitstempel
const REAL = [
  { channel: 'Stable', milestone: 158, platform: 'Windows', previous_version: '158.0.8127.36', time: 1794517537028, version: '158.0.8127.37' },
  { channel: 'Stable', milestone: 158, platform: 'Windows', previous_version: '158.0.8127.18', time: 1794517537028, version: '158.0.8127.36' },
  { channel: 'Stable', milestone: 157, platform: 'Windows', previous_version: '157.0.8103.79', time: 1794517537028, version: '157.0.8103.80' },
  { channel: 'Stable', milestone: 157, platform: 'Windows', previous_version: '157.0.8103.78', time: 1794424236096, version: '157.0.8103.79' },
  { channel: 'Stable', milestone: 157, platform: 'Windows', previous_version: '157.0.8103.52', time: 1794424236096, version: '157.0.8103.78' },
  { channel: 'Stable', milestone: 157, platform: 'Windows', previous_version: '157.0.8103.51', time: 1794256051699, version: '157.0.8103.51' },
];
test('echte Form: gleiche Zeitstempel zählen als ein Release-Schub', () => {
  const o = releasesPerDay(parseReleases(REAL), now, 90);
  assert.equal(o.find((x) => x.ts.startsWith('2026-11-12'))!.value, 1);
  assert.equal(o.find((x) => x.ts.startsWith('2026-11-11'))!.value, 1);
});
