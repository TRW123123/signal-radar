import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CollectContext, MapLayer } from '../../src/core/types.ts';
import quakes, { parseQuakes } from '../../src/collectors/layer-usgs-quakes.ts';
import eonet, { parseEonet } from '../../src/collectors/layer-eonet.ts';
import gdacs, { parseGdacs } from '../../src/collectors/layer-gdacs.ts';
import iodaOut, { parseIodaOutages, strengthOf } from '../../src/collectors/layer-ioda-outages.ts';
import { COUNTRY_CENTROIDS } from '../../src/collectors/_country-centroids.ts';
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

test('GDACS: Schreibweise, episodealertlevel, lat/lon und bbox, Grün nie', () => {
  const feat = (geometry: unknown, properties: unknown, extra: object = {}) => ({ type: 'Feature', geometry, properties, ...extra });
  const poly = { type: 'Polygon', coordinates: [[[0, 0]]] };
  const pts = parseGdacs({ features: [
    feat({ type: 'Point', coordinates: [10, 20] }, { AlertLevel: 'RED', eventtype: 'EQ', name: 'A' }),
    feat({ type: 'Point', coordinates: [11, 21] }, { episodealertlevel: 'Orange', eventtype: 'TC', name: 'B' }),
    feat(poly, { alertlevel: 'Orange', latitude: '5.5', longitude: '6.5', name: 'C' }),
    feat(poly, { alertlevel: 'Red', name: 'D' }, { bbox: [10, 0, 20, 10] }),
    feat(poly, { alertlevel: 'Orange', name: 'E' }),
    feat({ type: 'Point', coordinates: [1, 1] }, { alertlevel: 'Green' }),
    feat({ type: 'Point', coordinates: [1, 1] }, { episodealertlevel: 'green' }),
  ] });
  assert.deepEqual(pts.map((p) => p.label), ['Erdbeben: A', 'Wirbelsturm: B', 'C', 'D']);
  assert.deepEqual(pts.map((p) => p.strength), [1, 0.6, 0.6, 1]);
  assert.deepEqual([pts[2].lat, pts[2].lon], [5.5, 6.5]);
  assert.deepEqual([pts[3].lat, pts[3].lon], [5, 15]);
});

test('IODA-Störungen: Länderpunkte, logarithmische Stärke, Defekte übersprungen', async () => {
  const pts = parseIodaOutages(fixture('ioda-outages-summary.json'));
  assert.equal(pts.length, 3);
  const l = await layerOf(iodaOut as never, fixture('ioda-outages-summary.json'));
  assert.equal(l.id, 'internet-outages');
  assert.deepEqual(l.scenarios, ['cyber', 'blackout', 'war']);
  assert.equal(l.title, 'Internet-Störungen je Land (letzte 24 Stunden)');
  assert.equal(l.points[0].label, 'Kuba');
  assert.equal(l.points[0].value, undefined);
  assert.equal(l.points[0].unit, undefined);
  assert.ok(l.points[0].strength! > l.points[1].strength! && l.points[1].strength! > l.points[2].strength!);
  assert.ok(strengthOf(0) === 0 && strengthOf(1e12) === 1);
  assert.ok(l.title_en && l.plain_en);
});
test('IODA-Störungen: Ereignisform, leer, unerwartet, Tabelle', () => {
  const ev = { data: [{ location: 'country/GU', score: 10, location_name: 'Guam' }, { location: 'country/GU', score: 5 }, { location: 'asn/1', score: 3 }] };
  const pts = parseIodaOutages(ev);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].value, undefined);
  assert.deepEqual(parseIodaOutages({ data: [] }), []);
  assert.throws(() => parseIodaOutages({}), /data/);
  assert.throws(() => parseIodaOutages(null), /data/);
  assert.ok(Object.keys(COUNTRY_CENTROIDS).length >= 150);
});
test('IODA-Störungen: zweite Adresse wird versucht', async () => {
  const urls: string[] = [];
  const ctx = { ...ctxWith(null), http: { json: async (u: string) => { urls.push(u); if (urls.length === 1) throw new Error('HTTP 400'); return fixture('ioda-outages-summary.json'); } } as never };
  const r = await iodaOut.collect(ctx);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /outages\/summary\?from=\d+&until=\d+&entityType=country&limit=300/);
  assert.equal(r.layers![0].points.length, 3);
});

test('Collector-Metadaten: Abrufabstand 30 Minuten, keine Signale', () => {
  for (const c of [quakes, eonet, gdacs, iodaOut]) { assert.equal(c.intervalMinutes, 30); assert.deepEqual(c.signals, []); assert.ok(c.id.startsWith('layer-')); }
});
