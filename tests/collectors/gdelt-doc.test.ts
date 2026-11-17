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
  const cyber = r.observations.filter((o) => o.signalId.startsWith('cyber.'));
  assert.equal(cyber.length, 2);
  assert.ok(cyber.every((o) => o.signalId === STREAMS[0].signalId));
  assert.match(buildUrl(STREAMS[1].query), /mode=timelinevol&format=json&timespan=1m/);
});

test('war: vier Ströme mit getrennten Hotspot-Reihen, Klasse D, neue Fixture-Namen', () => {
  const war = STREAMS.filter((s) => s.signalId.startsWith('war.'));
  assert.deepEqual(war.map((s) => s.signalId), [
    'war.attention.gdelt_hotspot_iran_hormuz', 'war.attention.gdelt_hotspot_ukraine_nato', 'war.attention.gdelt_hotspot_taiwan', 'war.attention.gdelt_coverage_share']);
  assert.equal(new Set(STREAMS.map((s) => s.fixture)).size, STREAMS.length);
  const sigs = collector.signals.filter((s) => s.id.startsWith('war.'));
  assert.ok(sigs.every((s) => s.evidenceClass === 'D' && s.domain === 'attention' && s.scenarios!.join() === 'war'));
  assert.match(buildUrl(war[3].query), /query=\(%22World%20War%20III%22%20OR%20%22nuclear%20war%22\)%20sourcelang%3Aenglish&mode=timelinevol/);
});

test('war: collect meldet alle Ströme, Ausfall eines Kriegsstroms lässt Cyber unberührt', async () => {
  const ctx = {
    now: new Date('2026-11-17T00:00:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { if (u.includes('Taiwan')) throw new Error('429'); return SAMPLE; }, text: async () => '' },
  };
  const ids = new Set((await collector.collect(ctx as never)).observations.map((o) => o.signalId));
  assert.ok(ids.has('cyber.attention.gdelt_cyber_volume') && ids.has('war.attention.gdelt_hotspot_iran_hormuz'));
  assert.ok(!ids.has('war.attention.gdelt_hotspot_taiwan'));
});
