import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CollectContext, MapLayer } from '../../src/core/types.ts';
import quakes, { parseQuakes } from '../../src/collectors/layer-usgs-quakes.ts';
import eonet, { parseEonet } from '../../src/collectors/layer-eonet.ts';
import gdacs, { parseGdacs } from '../../src/collectors/layer-gdacs.ts';
import { MAX_POINTS } from '../../src/collectors/_layer-util.ts';

// Fixtures unter fixtures/layers/ sind nach Doku nachgebaut (Bau-Umgebung ohne Internet), mit je einem kaputten Eintrag.
const now = new Date('2026-11-24T00:00:00Z');
const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../../fixtures/layers/${n}`, import.meta.url), 'utf8'));
const ctxWith = (body: unknown): CollectContext => ({
  now, key: () => undefined, log: () => {},
  http: { json: async () => body, text: async () => '', request: async () => { throw new Error('unused'); } } as never,
});
const layerOf = async (c: typeof quakes, body: unknown): Promise<MapLayer> => {
  const r = await c.collect(ctxWith(body));
  assert.deepEqual(r.observations, []);
  assert.equal(r.layers?.length, 1);
  return r.layers![0];
};

test('Erdbeben: Punkte, Stärke, kaputter Eintrag übersprungen', async () => {
  const pts = parseQuakes(fixture('usgs-2.5-day.geojson'));
  assert.equal(pts.length, 3);
  const l = await layerOf(quakes, fixture('usgs-2.5-day.geojson'));
  assert.equal(l.id, 'quakes');
  assert.deepEqual(l.scenarios, ['nuclear', 'blackout']);
  assert.equal(l.points[0].value, 6.1);
  assert.equal(l.points[0].unit, 'M');
  assert.equal(l.points[0].lon, 121.4);
  assert.ok(Math.abs(l.points[0].strength! - (6.1 - 2.5) / 4.5) < 1e-9);
  assert.equal(l.points[2].strength, 0);
  assert.equal(l.ts, '2026-11-23T22:00:00.000Z');
  assert.ok(l.title_en && l.plain_en);
});
test('Erdbeben: leer, fehlendes Feld, höchstens 300 Punkte', async () => {
  assert.deepEqual(parseQuakes({ features: [] }), []);
  assert.throws(() => parseQuakes({}), /features/);
  const many = { features: Array.from({ length: 500 }, (_, i) => ({ properties: { mag: 2.5 + (i % 40) / 10, place: `P${i}`, time: 1795471200000 + i }, geometry: { coordinates: [i % 180, 10, 5] } })) };
  const l = await layerOf(quakes, many);
  assert.equal(l.points.length, MAX_POINTS);
  assert.ok(l.points[0].strength! >= l.points[299].strength!);
});

test('EONET: jüngste Koordinate, Polygon-Mittelpunkt, Defekt übersprungen', async () => {
  assert.equal(parseEonet(fixture('eonet-open-7d.json')).length, 3);
  const l = await layerOf(eonet, fixture('eonet-open-7d.json'));
  assert.equal(l.id, 'natural');
  assert.deepEqual(l.scenarios, ['blackout', 'war']);
  const etna = l.points.find((p) => p.label.startsWith('Etna'))!;
  assert.equal(etna.lon, 15.0);
  assert.equal(etna.t, '2026-11-23T00:00:00.000Z');
  const ice = l.points.find((p) => p.label.startsWith('Iceberg'))!;
  assert.ok(Math.abs(ice.lon + 49.2) < 1 && ice.lat < -69);
  assert.equal(l.ts, '2026-11-23T00:00:00.000Z');
});
test('EONET: leer und fehlendes Feld', () => {
  assert.deepEqual(parseEonet({ events: [] }), []);
  assert.throws(() => parseEonet({}), /events/);
});

test('GDACS: Orange 0.6, Rot 1, Fläche und Grün übersprungen', async () => {
  assert.equal(parseGdacs(fixture('gdacs-orange-red.json')).length, 2);
  const l = await layerOf(gdacs, fixture('gdacs-orange-red.json'));
  assert.equal(l.id, 'disasters');
  assert.deepEqual(l.scenarios, []);
  assert.equal(l.sourceName, 'GDACS');
  assert.equal(l.points[0].strength, 1);
  assert.equal(l.points[0].label, 'Erdbeben: Earthquake in Taiwan');
  assert.match(l.points[0].url!, /gdacs\.org/);
  assert.equal(l.points[1].strength, 0.6);
});
test('GDACS: leer und fehlendes Feld', () => {
  assert.deepEqual(parseGdacs({ features: [] }), []);
  assert.throws(() => parseGdacs({}), /features/);
});

test('Collector-Metadaten: Abrufabstand 30 Minuten, keine Signale', () => {
  for (const c of [quakes, eonet, gdacs]) { assert.equal(c.intervalMinutes, 30); assert.deepEqual(c.signals, []); assert.ok(c.id.startsWith('layer-')); }
});
