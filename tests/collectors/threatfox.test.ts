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

test('30-Tage-Fenster: alte first_seen_utc werden ignoriert', () => {
  const cutoff = NOW.getTime() - 30 * 24 * 3600_000; // 2026-10-17T16:30:00Z
  const mixed = {
    ...SAMPLE,
    '9001': [{ ioc_value: 'old1.example', ioc_type: 'domain', first_seen_utc: '2021-03-01 08:00:00' }],
    '9002': [{ ioc_value: 'old2.example', ioc_type: 'domain', first_seen_utc: '2021-03-01 08:15:00' }],
    '9003': [{ ioc_value: 'old3.example', ioc_type: 'domain', first_seen_utc: '2026-10-17 16:29:59' }], // knapp vor Cutoff
  };
  const o = parse(mixed, NOW);
  assert.deepEqual(o.map((x) => x.value), [2, 0, 1]);
  assert.equal(o[0].ts, '2026-11-16T13:00:00.000Z');
  assert.ok(o.every((x) => Date.parse(x.ts) >= cutoff));
  assert.ok(o.length < 30 * 24);
  assert.equal(o.reduce((s, x) => s + x.value, 0), 3);
});

test('30-Tage-Fenster: Eintrag knapp innerhalb zählt, Lücken bekommen Null-Stunden', () => {
  const o = parse({
    '1': [{ first_seen_utc: '2026-10-17 16:30:00' }], // genau am Cutoff: im Fenster, älteste Stunde entfällt
    '2': [{ first_seen_utc: '2026-10-17 17:10:00' }],
    '3': [{ first_seen_utc: '2026-11-16 15:20:00' }],
    '4': [{ first_seen_utc: '2026-10-17 16:29:59' }], // knapp älter: ignoriert
  }, NOW);
  assert.equal(o[0].ts, '2026-10-17T17:00:00.000Z');
  assert.equal(o[0].value, 1);
  assert.equal(o.at(-1)!.ts, '2026-11-16T15:00:00.000Z');
  assert.equal(o.at(-1)!.value, 1);
  assert.equal(o.length, 30 * 24 - 1); // 17:00 am 17.10. bis 15:00 am 16.11.
  assert.equal(o.reduce((s, x) => s + x.value, 0), 2);
});
