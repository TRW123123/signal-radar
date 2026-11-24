// Kartenschicht "Katastrophenwarnungen der UN/EU" (nicht gewertet, nur zur Orientierung auf dem Globus).
// Quelle: GDACS (Global Disaster Alert and Coordination System, UN OCHA / EU-Kommission JRC), https://www.gdacs.org/ , kein Key.
// URL: https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?alertlevel=Orange;Red
// Lizenz/Bedingungen: frei nutzbar mit Quellenangabe "GDACS" (https://www.gdacs.org/About/termsofuse.aspx).
// Antwort: GeoJSON-FeatureCollection; je Feature geometry (Point, [lon,lat]) und properties.{name, alertlevel, eventtype
//   (EQ Erdbeben, TC Wirbelsturm, FL Überschwemmung, VO Vulkan, DR Dürre, WF Waldbrand, TS Tsunami), fromdate, url:{report}}.
// Gemessen: nichts. Keine Beobachtungen, nie eine Stufe. strength: Orange 0.6, Rot 1.
// VERIFIED: nein (Live-Prüfung steht aus; Fixture nach Doku nachgebaut)

import type { Collector, MapPoint } from '../core/types.ts';
import { num } from './_helpers.ts';
import { isoOrNull, newestTs, topPoints, validCoord } from './_layer-util.ts';

// The first live run answered HTTP 400 to `MAP?alertlevel=Orange;Red`. The alert level is filtered here anyway,
// so the variants below are tried in order and the first usable answer wins.
export const FEED_URLS = [
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP',
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP',
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=orange%3Bred&eventlist=EQ%3BTC%3BFL%3BVO%3BWF',
];
export const FEED_URL = FEED_URLS[0];

const TYPE_DE: Record<string, string> = { EQ: 'Erdbeben', TC: 'Wirbelsturm', FL: 'Überschwemmung', VO: 'Vulkan', DR: 'Dürre', WF: 'Waldbrand', TS: 'Tsunami' };

/** Parses the GDACS event list into map points (broken features and non-point geometries are skipped). Throws when `features` is missing. */
export function parseGdacs(body: unknown): MapPoint[] {
  const features = (body as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('unerwartete Antwort: features fehlt');
  const out: MapPoint[] = [];
  for (const f of features) {
    try {
      const feat = f as { geometry?: { type?: unknown; coordinates?: unknown[] }; properties?: Record<string, unknown> };
      const p = feat.properties ?? {};
      if (feat.geometry?.type !== 'Point') continue;
      const lon = num(feat.geometry.coordinates?.[0]);
      const lat = num(feat.geometry.coordinates?.[1]);
      if (lat === null || lon === null || !validCoord(lat, lon)) continue;
      const level = String(p.alertlevel ?? '').toLowerCase();
      if (level !== 'orange' && level !== 'red') continue;
      const kind = TYPE_DE[String(p.eventtype ?? '').toUpperCase()];
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const label = [kind, name].filter(Boolean).join(': ') || 'Katastrophenwarnung';
      const t = isoOrNull(p.fromdate);
      const report = (p.url as { report?: unknown } | undefined)?.report;
      out.push({ lat, lon, label, strength: level === 'red' ? 1 : 0.6, ...(t ? { t } : {}),
        ...(typeof report === 'string' && report.startsWith('http') ? { url: report } : {}) });
    } catch { /* Eintrag überspringen */ }
  }
  return out;
}

const collector: Collector = {
  id: 'layer-gdacs',
  title: 'Kartenschicht: Katastrophenwarnungen (GDACS)',
  sourceUrl: 'https://www.gdacs.org/',
  intervalMinutes: 30,
  signals: [],
  async collect(ctx) {
    let parsed: MapPoint[] | null = null;
    let lastError: unknown = null;
    for (const url of FEED_URLS) {
      try {
        parsed = parseGdacs(await ctx.http.json<unknown>(url, { fixture: 'layers/gdacs-orange-red.json' }));
        break;
      } catch (e) { lastError = e; }
    }
    if (!parsed) throw lastError;
    const points = topPoints(parsed);
    return {
      observations: [],
      layers: [{
        id: 'disasters',
        title: 'Katastrophenwarnungen der UN/EU',
        title_en: 'Disaster alerts by the UN/EU',
        plain: 'Jeder Punkt ist eine ernste Katastrophenwarnung (orange oder rot) für ein Erdbeben, einen Sturm, eine Überschwemmung oder einen Vulkan. Nur zur Orientierung, es fließt nicht in die Stufen ein.',
        plain_en: 'Each dot is a serious disaster alert (orange or red) for an earthquake, storm, flood or volcano. For orientation only, it does not affect any level.',
        scenarios: [],
        sourceName: 'GDACS',
        sourceUrl: 'https://www.gdacs.org/',
        license: 'Quellenangabe "GDACS" erforderlich',
        ts: newestTs(points, ctx.now),
        points,
      }],
    };
  },
};

export default collector;
