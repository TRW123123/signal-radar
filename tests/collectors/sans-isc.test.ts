import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseDailySummary, parseTopPorts, toObservations } from '../../src/collectors/sans-isc.ts';

// Nach Doku nachgebaut (Formen unverifiziert).
const DAILY = [
  { date: '2026-11-14', records: 1000000, sources: 50000, targets: 90000 },
  { date: '2026-11-15', reports: '1,200,000', sources: 52000, targets: 91000 },
  { date: '2026-11-16', records: 900000, sources: 49000, targets: 88000 },
  { date: '2026-11-17', records: 5, sources: 1, targets: 1 },
];
const TOP = [{ rank: 1, targetport: 445, records: 300000, targets: 1, sources: 1 }, { rank: 2, targetport: '22', records: 200000 }];
const NOW = new Date('2026-11-17T00:00:00Z');

test('Normalfall: laufender Tag entfällt, Top-Ports hängen am letzten Tag', () => {
  const o = toObservations(parseDailySummary(DAILY), NOW, parseTopPorts(TOP));
  assert.deepEqual(o.map((x) => x.value), [1000000, 1200000, 900000]);
  assert.equal(o[2].ts, '2026-11-16T00:00:00.000Z');
  assert.deepEqual((o[2].meta as { topPorts: unknown[] }).topPorts[1], { port: 22, records: 200000 });
  assert.equal((o[0].meta as Record<string, unknown>).topPorts, undefined);
});

test('Wrapper-Objekt wird akzeptiert', () => {
  assert.equal(parseDailySummary({ dailysummary: DAILY }).length, 4);
});

test('leere Antwort und fehlendes Feld', () => {
  assert.throws(() => parseDailySummary({}), /unerwartete Antwort/);
  assert.deepEqual(parseDailySummary([{ date: '2026-11-14' }, { records: 5 }]), []);
  assert.deepEqual(toObservations([], NOW), []);
});

test('Signal-ID und Klasse', () => {
  assert.equal(collector.signals[0].id, 'cyber.threat.dshield_port_scan_spike');
  assert.equal(collector.needsKey, undefined);
});
