import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import collector, { parseDayAheadDaily, parseTypeHourly, chunkFixture, loadSignalId, LOAD_COUNTRIES, S_FREQ, S_FEEDIN, S_LOAD, S_KP, S_PRICE, S_NUCLEAR_FR } from '../../src/collectors/blackout-grid-bridge.ts';

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
  assert.equal(collector.signals.length, 6 + LOAD_COUNTRIES.length);
  for (const s of collector.signals) { assert.deepEqual(s.scenarios, ['blackout']); assert.match(s.id, /^blackout\./); assert.ok(s.plain.endsWith('.')); }
  assert.equal(collector.signals.find((s) => s.id === S_FREQ)?.geo?.cc, 'DE');
  assert.equal(collector.signals.find((s) => s.id === loadSignalId('ES'))?.geo?.cc, 'ES');
  assert.equal(collector.signals.find((s) => s.id === S_NUCLEAR_FR)?.domain, 'plants');
  assert.equal(collector.signals.find((s) => s.id === S_LOAD)?.maxAgeHours, 36);
});

// /public_power nach dem Muster der echten DE-Antwort nachgebaut (production_types[{name,data}], 15-Minuten-Raster); FR/ES/IT ungeprüft.
function power(hours: number, withNuclear = true, nullTail = 0) {
  const t0 = Date.UTC(2026, 10, 16, 18) / 1000;
  const unix: number[] = []; const load: (number | null)[] = []; const nuc: number[] = [];
  for (let i = 0; i < hours * 4; i++) { unix.push(t0 + i * 900); load.push(i >= hours * 4 - nullTail ? null : 50000 + i); nuc.push(40000); }
  const types = [{ name: 'Load', data: load }, ...(withNuclear ? [{ name: 'Nuclear', data: nuc }] : [])];
  return { unix_seconds: unix, production_types: types };
}

test('public_power: Stundenmittel je Art, unveröffentlichte Viertelstunden (null) lassen die Stunde aus', () => {
  const before = Date.UTC(2026, 10, 17);
  const r = parseTypeHourly(power(6), 'Load', before);
  assert.equal(r.length, 6);
  assert.equal(r[0].hour, Date.UTC(2026, 10, 16, 18));
  assert.equal(r[0].mw, 50001.5);
  assert.equal(parseTypeHourly(power(6, true, 2), 'Load', before).length, 5);
  assert.equal(parseTypeHourly(power(6), 'Nuclear', before)[0].mw, 40000);
  assert.throws(() => parseTypeHourly(power(6, false), 'Nuclear', before), /Nuclear/);
  assert.throws(() => parseTypeHourly({ unix_seconds: [] } as never, 'Load', before), /production_types/);
  assert.deepEqual(parseTypeHourly({ unix_seconds: [], production_types: [{ name: 'Load', data: [] }] }, 'Load', before), []);
});

test('Sofort-Historie: Abschnitte für Einspeisung, Last je Land, Preis; Abschnitt 0 behält den alten Fixture-Namen', async () => {
  assert.equal(chunkFixture('energy-charts/price-de-lu-2d', 'json', 0), 'energy-charts/price-de-lu-2d.json');
  assert.equal(chunkFixture('energy-charts/price-de-lu-2d', 'json', 3), 'energy-charts/price-de-lu-2d-3.json');
  const now = new Date('2026-11-17T00:16:13Z');
  const urls: string[] = [];
  const http = {
    json: async (url: string) => {
      urls.push(url);
      if (url.includes('/public_power')) {
        const end = Date.parse(decodeURIComponent(url.match(/end=([^&]+)/)![1]).replace('Z', ':00Z'));
        const b = power(6);
        b.unix_seconds = b.unix_seconds.map((_, i) => end / 1000 - 6 * 3600 + i * 900);
        return { ...b, production_types: [...b.production_types, ...['Solar', 'Wind onshore', 'Wind offshore'].map((name) => ({ name, data: b.unix_seconds.map(() => 100) }))] };
      }
      throw new Error('offline');
    },
    text: async () => '',
  } as never;
  const r = await collector.collect({ now, http, key: () => undefined, log: () => {} });
  const count = (id: string) => r.observations.filter((o) => o.signalId === id).length;
  assert.equal(count(S_FEEDIN), 24);
  for (const c of LOAD_COUNTRIES) assert.equal(count(loadSignalId(c.cc)), 12, c.cc);
  assert.equal(count(S_NUCLEAR_FR), 12);
  assert.equal(urls.filter((u) => u.includes('/price')).length, 5);
  assert.ok(urls.length <= 21, `zu viele Requests: ${urls.length}`);
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
