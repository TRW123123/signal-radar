// Kartenschicht "Katastrophenwarnungen der UN/EU" (nicht gewertet, nur zur Orientierung auf dem Globus).
// Quelle: GDACS (Global Disaster Alert and Coordination System, UN OCHA / EU-Kommission JRC), https://www.gdacs.org/ , kein Key.
// URL: https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?alertlevel=Orange;Red
// Lizenz/Bedingungen: frei nutzbar mit Quellenangabe "GDACS" (https://www.gdacs.org/About/termsofuse.aspx).
// Robust: alertlevel auch als alertLevel/episodealertlevel (Groß-/Kleinschreibung egal); Nicht-Punkt-Geometrie über properties.latitude/longitude oder bbox-Mittelpunkt; Grün nie.
// Antwort: GeoJSON-FeatureCollection; je Feature geometry (Point, [lon,lat]) und properties.{name, alertlevel, eventtype
//   (EQ Erdbeben, TC Wirbelsturm, FL Überschwemmung, VO Vulkan, DR Dürre, WF Waldbrand, TS Tsunami), fromdate, url:{report}}.
// Gemessen: nichts. Keine Beobachtungen, nie eine Stufe. strength: Orange 0.6, Rot 1.
// VERIFIED: teilweise (läuft fehlerfrei, liefert aber nichts; Format prüfen)

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

/** Reads a property independent of key case, first match of `names` wins. */
function prop(p: Record<string, unknown>, names: string[]): unknown {
  const keys = Object.keys(p);
  for (const n of names) {
    const k = keys.find((x) => x.toLowerCase() === n.toLowerCase());
    if (k !== undefined && p[k] !== null && p[k] !== undefined && p[k] !== '') return p[k];
  }
  return undefined;
}

/** Position: Point geometry, else properties.latitude/longitude, else centre of the bbox (feature or geometry). */
function position(feat: { geometry?: { type?: unknown; coordinates?: unknown[]; bbox?: unknown }; bbox?: unknown }, p: Record<string, unknown>): { lat: number; lon: number } | null {
  if (feat.geometry?.type === 'Point') {
    const lon = num(feat.geometry.coordinates?.[0]);
    const lat = num(feat.geometry.coordinates?.[1]);
    if (lat !== null && lon !== null && validCoord(lat, lon)) return { lat, lon };
  }
  const plat = num(prop(p, ['latitude', 'lat']));
  const plon = num(prop(p, ['longitude', 'lon']));
  if (plat !== null && plon !== null && validCoord(plat, plon)) return { lat: plat, lon: plon };
  for (const bb of [feat.bbox, feat.geometry?.bbox]) {
    if (!Array.isArray(bb) || bb.length < 4) continue;
    const [w, s, e, n] = bb.slice(0, 4).map((v) => num(v));
    if (w === null || s === null || e === null || n === null) continue;
    const lat = (s + n) / 2;
    const lon = (w + e) / 2;
    if (validCoord(lat, lon)) return { lat, lon };
  }
  return null;
}

/** Parses the GDACS event list into map points (broken features and features without any usable position are skipped; green is not included). Throws when `features` is missing. */
export function parseGdacs(body: unknown): MapPoint[] {
  const features = (body as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('unerwartete Antwort: features fehlt');
  const out: MapPoint[] = [];
  for (const f of features) {
    try {
      const feat = f as { geometry?: { type?: unknown; coordinates?: unknown[]; bbox?: unknown }; bbox?: unknown; properties?: Record<string, unknown> };
      const p = feat.properties ?? {};
      const level = String(prop(p, ['alertlevel', 'episodealertlevel']) ?? '').trim().toLowerCase();
      if (level !== 'orange' && level !== 'red') continue;
      const pos = position(feat, p);
      if (!pos) continue;
      const kind = TYPE_DE[String(prop(p, ['eventtype']) ?? '').toUpperCase()];
      const rawName = prop(p, ['name']);
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      const label = [kind, name].filter(Boolean).join(': ') || 'Katastrophenwarnung';
      const t = isoOrNull(prop(p, ['fromdate']));
      const report = (prop(p, ['url']) as { report?: unknown } | undefined)?.report;
      out.push({ lat: pos.lat, lon: pos.lon, label, strength: level === 'red' ? 1 : 0.6, ...(t ? { t } : {}),
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
