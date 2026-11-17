import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, parseGdeltDate, buildUrl, STREAMS } from '../../src/collectors/gdelt-doc.ts';

// SAMPLE: nach Doku nachgebaut (mode=timelinevol, format=json), keine echte Aufzeichnung.
const SAMPLE = {
  query_details: { title: 'x', date_resolution: 'day' },
  timeline: [{ series: 'Volume Intensity', data: [
    { date: '20261114T000000Z', value: 0.0123 },
    { date: '20261115T000000Z', value: 0.0150 },
    { date: '20261117T000000Z', value: 0.0100 },
  ] }],
};

test('Normalfall: Werte je Tag', () => {
  const m = parse(SAMPLE);
  assert.equal(m.size, 3);
  assert.equal(m.get('2026-11-15'), 0.015);
});

test('feinere Auflösung wird zum Tagesmittel', () => {
  const m = parse({ timeline: [{ data: [{ date: '20261114T000000Z', value: 1 }, { date: '20261114T001500Z', value: 3 }] }] });
  assert.equal(m.get('2026-11-14'), 2);
});

test('leere Antwort: leere Zeitreihe ohne Fehler, fehlende Felder werfen', () => {
  assert.equal(parse({ timeline: [{ data: [] }] }).size, 0);
  assert.throws(() => parse({}), /timeline fehlt/);
  assert.throws(() => parse({ timeline: [{}] }), /data fehlt/);
});

test('kaputte Punkte werden übersprungen, nie NaN', () => {
  const m = parse({ timeline: [{ data: [{ date: 'kaputt', value: 1 }, { date: '20261114T000000Z', value: 'abc' }] }] });
  assert.equal(m.size, 0);
  assert.equal(parseGdeltDate('20261114T000000Z')?.toISOString(), '2026-11-14T00:00:00.000Z');
});

test('collect: laufender Tag wird nicht gemeldet, ein Strom darf ausfallen', async () => {
  let n = 0;
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async () => { if (++n === 2) throw new Error('429'); return SAMPLE; }, text: async () => '' },
  };
  const r = await collector.collect(ctx as never);
  assert.equal(r.observations.length, 2);
  assert.ok(r.observations.every((o) => o.signalId === STREAMS[0].signalId));
  assert.match(buildUrl(STREAMS[1].query), /mode=timelinevol&format=json&timespan=3m/);
});
