import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyDeltas, parseAreaKm2 } from '../../src/collectors/github-deepstate.ts';

// nach der echten Form der Tagesdateien nachgebaut: FeatureCollection mit einem MultiPolygon (lon, lat)
const sq = (lon: number, lat: number, d: number) => [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]];
const fc = (coordinates: unknown) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates } }] });

test('Normalfall: Fläche eines 1°-Quadrats bei 48°N und Abzug eines Lochs', () => {
  const a = parseAreaKm2(fc([[sq(30, 48, 1)]]));
  assert.ok(a > 8000 && a < 8400, String(a)); // 1° x 1° bei 48° Breite: ca. 8 250 km²
  const withHole = parseAreaKm2(fc([[sq(30, 48, 1), sq(30.2, 48.2, 0.5)]]));
  assert.ok(withHole < a && withHole > a * 0.7);
});
test('Tagesdifferenzen nur zwischen aufeinanderfolgenden Tagen', () => {
  const d = dailyDeltas([{ day: '2026-11-15', km2: 100 }, { day: '2026-11-14', km2: 90 }, { day: '2026-11-12', km2: 80 }, { day: '2026-11-16', km2: 100 }]);
  assert.deepEqual(d, [{ day: '2026-11-15', deltaKm2: 10 }, { day: '2026-11-16', deltaKm2: 0 }]);
});
test('leere Antwort', () => {
  assert.throws(() => parseAreaKm2({ type: 'FeatureCollection', features: [] }), /Polygone/);
  assert.deepEqual(dailyDeltas([]), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseAreaKm2({}), /features/);
  assert.throws(() => parseAreaKm2(fc([[[[30, 'x'], [31, 48], [31, 49]]]])), /Koordinate/);
});
