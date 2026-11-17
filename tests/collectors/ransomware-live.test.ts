import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseVictims } from '../../src/collectors/ransomware-live.ts';

// Nach Doku nachgebaut. Namen sind Platzhalter; der Collector liest sie nie.
const SAMPLE = [
  { victim: 'x1', group: 'alpha', discovered: '2026-11-14 09:00:00.123456' },
  { victim: 'x2', group: 'alpha', discovered: '2026-11-15 01:00:00.000000' },
  { victim: 'x3', group: 'beta', discovered: '2026-11-15 12:00:00.000000' },
  { victim: 'x4', group: 'Beta', discovered: '2026-11-15 18:30:00.000000' },
  { victim: 'x5', group: 'gamma', discovered: '2026-11-16 08:00:00.000000' },
  { victim: 'x6', group: 'alpha', discovered: '2026-11-17 00:10:00.000000' },
];
const NOW = new Date('2026-11-17T06:00:00Z');

test('Normalfall: nur volle Tage nach dem ältesten, Zähler ohne Namen', () => {
  const o = parse(SAMPLE, NOW);
  const posts = o.filter((x) => x.signalId === 'cyber.threat.leak_posts_daily').map((x) => [x.ts.slice(0, 10), x.value]);
  const groups = o.filter((x) => x.signalId === 'cyber.threat.ransomware_active_groups').map((x) => [x.ts.slice(0, 10), x.value]);
  assert.deepEqual(posts, [['2026-11-15', 3], ['2026-11-16', 1]]);
  assert.deepEqual(groups, [['2026-11-15', 2], ['2026-11-16', 1]]);
  assert.ok(o.every((x) => x.meta === undefined));
});

test('leere Antwort', () => {
  assert.deepEqual(parse([], NOW), []);
  assert.throws(() => parse({ foo: 1 }, NOW), /unerwartete Antwort/);
});

test('fehlendes Feld: Einträge ohne discovered fallen weg', () => {
  assert.equal(parseVictims([{ group: 'a' }, { discovered: 'kaputt' }]).length, 0);
});

// gekürzter echter Ausschnitt (17.11.2026): ISO-Format mit T und +00:00
const REAL = [
  { activity: 'Financial Services', attackdate: '2026-11-16T19:36:13.028366+00:00', claim_url: '', country: 'GB', data_size: null, discovered: '2026-11-16T19:36:14.075930+00:00', domain: 'example.invalid', group: 'Shiba', press: null, ransom: null, screenshot: '', victim: 'x' },
  { discovered: '2026-11-15T10:00:00.000000+00:00', group: 'Shiba' },
  { discovered: '2026-11-14T10:00:00.000000+00:00', group: 'Other' },
];
test('echte Form: ISO-Zeitstempel mit Offset', () => {
  const v = parseVictims(REAL);
  assert.equal(v.length, 3);
  assert.equal(v[0].group, 'shiba');
  const o = parse(REAL, NOW);
  assert.deepEqual(o.filter((x) => x.signalId === 'cyber.threat.leak_posts_daily').map((x) => [x.ts.slice(0, 10), x.value]), [['2026-11-15', 1], ['2026-11-16', 1]]);
});
