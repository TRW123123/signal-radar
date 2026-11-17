import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, parseTimestamps } from '../../src/collectors/threatfox.ts';

// Nach Doku nachgebaut: Objekt { "<ioc_id>": [ { ... first_seen_utc ... } ] }
const SAMPLE = {
  '1001': [{ ioc_value: '1.2.3.4:80', ioc_type: 'ip:port', malware: 'win.foo', first_seen_utc: '2026-11-16 12:05:00', last_seen_utc: null }],
  '1002': [{ ioc_value: 'a.example', ioc_type: 'domain', malware: 'win.foo', first_seen_utc: '2026-11-16 13:10:00' }],
  '1003': [{ ioc_value: 'b.example', ioc_type: 'domain', malware: 'win.bar', first_seen_utc: '2026-11-16 13:50:00' }],
  '1004': [{ ioc_value: 'c.example', ioc_type: 'domain', malware: 'win.bar', first_seen_utc: '2026-11-16 15:20:00' }],
};
const NOW = new Date('2026-11-16T16:30:00Z');

test('Normalfall', () => {
  const o = parse(SAMPLE, NOW);
  assert.deepEqual(o.map((x) => x.value), [2, 0, 1]);
  assert.equal(o[0].ts, '2026-11-16T13:00:00.000Z');
});

test('flache Liste wird ebenfalls akzeptiert', () => {
  assert.equal(parseTimestamps(Object.values(SAMPLE).flat()).length, 4);
});

test('leere Antwort', () => {
  assert.throws(() => parse({}, NOW), /unerwartete Antwort/);
  assert.throws(() => parse(null, NOW), /unerwartete Antwort/);
});

test('fehlendes Feld: Einträge ohne first_seen_utc zählen nicht', () => {
  assert.equal(parseTimestamps({ '1': [{ ioc_value: 'x' }] }).length, 0);
  assert.equal(collector.needsKey, 'SR_ABUSECH_KEY');
});
