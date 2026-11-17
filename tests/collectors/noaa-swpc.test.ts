import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKp } from '../../src/collectors/noaa-swpc.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
test('Objektformat', () => {
  const r = parseKp([{ time_tag: '2026-11-16T00:00:00', Kp: 2.33, a_running: 9, station_count: 8 }, { time_tag: '2026-11-16T03:00:00', Kp: 5 }]);
  assert.deepEqual(r, [{ ts: '2026-11-16T00:00:00.000Z', kp: 2.33 }, { ts: '2026-11-16T03:00:00.000Z', kp: 5 }]);
});
test('Array-Format mit Kopfzeile', () => {
  const r = parseKp([['time_tag', 'Kp', 'a_running', 'station_count'], ['2026-11-16 00:00:00.000', '1.67', '6', '8']]);
  assert.equal(r.length, 1);
  assert.equal(r[0].kp, 1.67);
});
test('leere Antwort, kaputte Zeilen, falsche Form', () => {
  assert.deepEqual(parseKp([]), []);
  assert.deepEqual(parseKp([{ time_tag: 'x', Kp: 3 }, { time_tag: '2026-11-16T00:00:00', Kp: null }]), []);
  assert.throws(() => parseKp({}), /fehlt/);
  assert.throws(() => parseKp([['a', 'b'], ['1', '2']]), /Spalten/);
});
