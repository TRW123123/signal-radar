// Kartenschicht "Erdbeben der letzten 24 Stunden" (nicht gewertet, nur zur Orientierung auf dem Globus).
// Quelle: USGS Earthquake Hazards Program, GeoJSON-Summary-Feed M2.5+ der letzten 24 h.
// URL: https://earthquake.usgs.gov/feed/v1.0/summary/2.5_day.geojson (Doku: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php), kein Key.
// Lizenz: gemeinfrei (US-Regierung). Antwort: FeatureCollection; je Feature properties.{mag,place,time(ms),url}, geometry.coordinates=[lon,lat,tiefe].
// Gemessen: nichts. Die Punkte erzeugen keine Beobachtungen und heben nie eine Stufe. strength = (mag-2.5)/4.5, begrenzt auf 0..1.
// Größe: der Feed hat meist 300 bis 500 Einträge; die Aufzeichnung kann gekürzt sein, kaputte Einträge werden übersprungen.
// VERIFIED: ja (Live-Lauf 24.11.2026, 50 Punkte)

import type { Collector, MapPoint } from '../core/types.ts';
import { num } from './_helpers.ts';
import { clamp01, isoOrNull, newestTs, topPoints, validCoord } from './_layer-util.ts';

export const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

/** Parses the USGS GeoJSON feed into map points (broken features are skipped). Throws when the body is not a FeatureCollection. */
export function parseQuakes(body: unknown): MapPoint[] {
  const features = (body as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('unerwartete Antwort: features fehlt');
  const out: MapPoint[] = [];
  for (const f of features) {
    try {
      const p = (f as { properties?: Record<string, unknown> }).properties ?? {};
      const c = (f as { geometry?: { coordinates?: unknown[] } }).geometry?.coordinates;
      const lon = num(c?.[0]);
      const lat = num(c?.[1]);
      const mag = num(p.mag);
      if (lat === null || lon === null || mag === null || !validCoord(lat, lon)) continue;
      const t = isoOrNull(p.time);
      const place = typeof p.place === 'string' && p.place.trim() ? p.place.trim() : 'Unbekannter Ort';
      out.push({
        lat, lon, label: place, value: Math.round(mag * 10) / 10, unit: 'M', strength: clamp01((mag - 2.5) / 4.5),
        ...(t ? { t } : {}), ...(typeof p.url === 'string' && p.url.startsWith('http') ? { url: p.url } : {}),
      });
    } catch { /* Eintrag überspringen */ }
  }
  return out;
}

const collector: Collector = {
  id: 'layer-usgs-quakes',
  title: 'Kartenschicht: Erdbeben (USGS)',
  sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
  intervalMinutes: 30,
  signals: [],
  async collect(ctx) {
    const points = topPoints(parseQuakes(await ctx.http.json<unknown>(FEED_URL, { fixture: 'layers/usgs-2.5-day.geojson' })));
    return {
      observations: [],
      layers: [{
        id: 'quakes',
        title: 'Erdbeben der letzten 24 Stunden',
        title_en: 'Earthquakes in the last 24 hours',
        plain: 'Jeder Punkt ist ein Erdbeben ab Stärke 2,5 aus den letzten 24 Stunden; größere Punkte sind stärkere Beben. Das ist nur zur Orientierung und fließt nicht in die Stufen ein.',
        plain_en: 'Each dot is an earthquake of magnitude 2.5 or more from the last 24 hours; bigger dots are stronger quakes. For orientation only, it does not affect any level.',
        scenarios: ['nuclear', 'blackout'],
        sourceName: 'USGS Earthquake Hazards Program',
        sourceUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
        license: 'gemeinfrei (US-Regierung)',
        ts: newestTs(points, ctx.now),
        points,
      }],
    };
  },
};

export default collector;
