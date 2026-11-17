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
