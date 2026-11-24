import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import collector, { parseDayAheadDaily, S_FREQ, S_FEEDIN, S_LOAD, S_KP, S_PRICE } from '../../src/collectors/blackout-grid-bridge.ts';

const FIX = join(import.meta.dirname, '..', '..', 'fixtures');
const DAY = 86400;

// Preisantwort nach Doku nachgebaut (Energy-Charts /price: { unix_seconds, price, unit }), 15-Minuten-Raster, zwei volle UTC-Tage
function sample(days: number, step = 900, dropAt = -1) {
  const t0 = Date.UTC(2026, 10, 15) / 1000;
  const unix: number[] = []; const price: (number | null)[] = [];
  for (let i = 0; i < days * DAY / step; i++) { unix.push(t0 + i * step); price.push(i === dropAt ? null : 100 + (i % 96 < 48 ? 10 : -10)); }
  return { unix_seconds: unix, price, unit: 'EUR/MWh' };
}

test('Preis: Tagesmittel je vollständigem UTC-Tag', () => {
  const r = parseDayAheadDaily(sample(2), Date.UTC(2026, 10, 17));
  assert.deepEqual(r, [{ day: '2026-11-15', eurMwh: 100 }, { day: '2026-11-16', eurMwh: 100 }]);
});
test('Preis: laufender Tag, Lücken, leere und fehlerhafte Antwort', () => {
  assert.equal(parseDayAheadDaily(sample(2), Date.UTC(2026, 10, 16, 12)).length, 1);
  assert.equal(parseDayAheadDaily(sample(2, 900, 10), Date.UTC(2026, 10, 17)).length, 1);
  assert.deepEqual(parseDayAheadDaily({ unix_seconds: [], price: [] }, Date.now()), []);
  assert.throws(() => parseDayAheadDaily({ unix_seconds: [1] }, 0), /price/);
});
test('Signale: blackout, Gewichte, Geo', () => {
  assert.equal(collector.signals.length, 5);
  for (const s of collector.signals) { assert.deepEqual(s.scenarios, ['blackout']); assert.match(s.id, /^blackout\./); assert.ok(s.plain.endsWith('.')); }
  assert.equal(collector.signals.find((s) => s.id === S_FREQ)?.geo?.cc, 'DE');
});
test('Replay gegen echte Aufzeichnungen: Frequenz, Einspeisung, Netzlast, Kp unter blackout-IDs', { skip: !existsSync(join(FIX, 'energy-charts', 'frequency-4m.json')) }, async () => {
  // Frequenz-Aufzeichnung endet 2026-11-17T09:59:52Z, also läuft der Collector "um 10:16"
  const now = new Date('2026-11-17T10:16:00Z');
  const http = {
    json: async (url: string, i?: { fixture?: string }) => {
      const p = join(FIX, i!.fixture!);
      if (!existsSync(p)) throw new Error('keine Aufzeichnung');
      return JSON.parse(readFileSync(p, 'utf8'));
    },
    text: async () => '',
  } as never;
  const r = await collector.collect({ now, http, key: () => undefined, log: () => {} });
  const ids = new Set(r.observations.map((o) => o.signalId));
  for (const id of [S_KP, S_FREQ, S_FEEDIN]) assert.ok(ids.has(id), id);
  assert.ok(!ids.has('cyber.physical.frequency_deviation_de'));
  assert.ok(!r.observations.some((o) => Number.isNaN(o.value)));
});
