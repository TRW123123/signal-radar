// Kartenschicht "Laufende Naturereignisse" (nicht gewertet, nur zur Orientierung auf dem Globus).
// Quelle: NASA EONET v3 (Earth Observatory Natural Event Tracker), https://eonet.gsfc.nasa.gov/docs/v3 , kein Key.
// URL: https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7
// Lizenz: NASA-Daten frei nutzbar (NASA Earth Science Data Policy); Quelle "NASA EONET" nennen.
// Antwort: { events: [{ id, title, link, categories:[{id,title}], geometry:[{ date, type:'Point', coordinates:[lon,lat] }] }] };
//   bei Flächen (type 'Polygon') wird der Mittelpunkt des äußeren Rings genommen. Je Ereignis zählt die jüngste Koordinate.
// Gemessen: nichts. Keine Beobachtungen, nie eine Stufe. strength: Vulkane und Stürme 0.8, Brände/Überschwemmungen 0.6, sonst 0.4.
// VERIFIED: nein (Live-Prüfung steht aus; Fixture nach Doku nachgebaut)

import type { Collector, MapPoint } from '../core/types.ts';
import { num } from './_helpers.ts';
import { isoOrNull, newestTs, topPoints, validCoord } from './_layer-util.ts';

export const FEED_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7';

const STRENGTH: Record<string, number> = { volcanoes: 0.8, severeStorms: 0.8, wildfires: 0.6, floods: 0.6, earthquakes: 0.6 };

function coordOf(g: { type?: unknown; coordinates?: unknown }): [number, number] | null {
  const c = g.coordinates;
  if (!Array.isArray(c)) return null;
  if (g.type === 'Polygon') {
    const ring = Array.isArray(c[0]) ? (c[0] as unknown[]) : [];
    const pts = ring.map((p) => [num((p as unknown[])?.[0]), num((p as unknown[])?.[1])]).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
    if (!pts.length) return null;
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  const lon = num(c[0]);
  const lat = num(c[1]);
  return lon === null || lat === null ? null : [lon, lat];
}

/** Parses EONET events into map points (newest coordinate per event, broken events skipped). Throws when `events` is missing. */
export function parseEonet(body: unknown): MapPoint[] {
  const events = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) throw new Error('unerwartete Antwort: events fehlt');
  const out: MapPoint[] = [];
  for (const e of events) {
    try {
      const ev = e as { title?: unknown; link?: unknown; categories?: { id?: unknown }[]; geometry?: { date?: unknown; type?: unknown; coordinates?: unknown }[] };
      if (typeof ev.title !== 'string' || !ev.title.trim() || !Array.isArray(ev.geometry)) continue;
      let best: { t: string; lon: number; lat: number } | null = null;
      for (const g of ev.geometry) {
        const t = isoOrNull(g?.date);
        const c = g ? coordOf(g) : null;
        if (!t || !c || !validCoord(c[1], c[0])) continue;
        if (!best || t > best.t) best = { t, lon: c[0], lat: c[1] };
      }
      if (!best) continue;
      const cat = String(ev.categories?.[0]?.id ?? '');
      out.push({ lat: best.lat, lon: best.lon, label: ev.title.trim(), strength: STRENGTH[cat] ?? 0.4, t: best.t,
        ...(typeof ev.link === 'string' && ev.link.startsWith('http') ? { url: ev.link } : {}) });
    } catch { /* Ereignis überspringen */ }
  }
  return out;
}

const collector: Collector = {
  id: 'layer-eonet',
  title: 'Kartenschicht: Naturereignisse (NASA EONET)',
  sourceUrl: 'https://eonet.gsfc.nasa.gov/docs/v3',
  intervalMinutes: 30,
  signals: [],
  async collect(ctx) {
    const points = topPoints(parseEonet(await ctx.http.json<unknown>(FEED_URL, { fixture: 'layers/eonet-open-7d.json' })));
    return {
      observations: [],
      layers: [{
        id: 'natural',
        title: 'Laufende Naturereignisse: Brände, Stürme, Vulkane',
        title_en: 'Ongoing natural events: fires, storms, volcanoes',
        plain: 'Jeder Punkt ist ein Naturereignis, das gerade läuft, etwa ein großer Brand, ein Sturm oder ein Vulkanausbruch. Nur zur Orientierung, es fließt nicht in die Stufen ein.',
        plain_en: 'Each dot is a natural event happening now, such as a large fire, a storm or a volcanic eruption. For orientation only, it does not affect any level.',
        scenarios: ['blackout', 'war'],
        sourceName: 'NASA EONET',
        sourceUrl: 'https://eonet.gsfc.nasa.gov/',
        license: 'NASA offene Daten (frei nutzbar), Quelle nennen',
        ts: newestTs(points, ctx.now),
        points,
      }],
    };
  },
};

export default collector;
