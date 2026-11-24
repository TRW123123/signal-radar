// Kartenschicht "Länder mit Internet-Störungen in den letzten 24 Stunden" (nicht gewertet, nur zur Orientierung auf dem Globus).
// Quelle: IODA (Internet Outage Detection and Analysis, Georgia Tech), https://api.ioda.inetintel.cc.gatech.edu/v2/ , kein Key.
// URLs (nacheinander versucht, die erste brauchbare Antwort gewinnt):
//   1. outages/summary?from=<unix>&until=<unix>&entityType=country&limit=300  (je Land eine Bewertung scores.overall)
//   2. outages/events?from=<unix>&until=<unix>&entityType=country&limit=300&extendWindow=0  (Adressform wie in ioda.ts; Ereignisse
//      {location:'country/XX', location_name, score, start}, die Bewertungen je Land werden addiert)
// Lizenz/Bedingungen: frei für Forschung und Beobachtung, fair use (siehe IODA-Website); Quellenangabe "IODA (Georgia Tech)".
// Gemessen: nichts. Keine Beobachtungen, nie eine Stufe. strength: logarithmisch aus der Bewertung (log10(1+score)/6, auf 0..1 begrenzt).
// Harmlose Ursachen: Stromausfälle, Messausfall einzelner IODA-Datenquellen, Wartung großer Provider, Prüfungsabschaltungen.
// Parser tolerant: Liste unter `data` (auch Liste von Listen), Einträge mit entity.code/entity.name/scores.overall; unbekannte Formen
// werden übersprungen, bei völlig unerwarteter Antwort (kein `data`-Array) wird ein Fehler geworfen.
// VERIFIED: nein (Antwortformat der Zusammenfassung nicht live geprüft; Fixture nach Doku nachgebaut)

import type { Collector, MapPoint } from '../core/types.ts';
import { num } from './_helpers.ts';
import { countryCentroid } from './_country-centroids.ts';
import { clamp01, topPoints } from './_layer-util.ts';

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
const WINDOW_SEC = 24 * 3600;

export function feedUrls(now: Date): string[] {
  const until = Math.floor(now.getTime() / 1000);
  const from = until - WINDOW_SEC;
  return [
    `${BASE}/outages/summary?from=${from}&until=${until}&entityType=country&limit=300`,
    `${BASE}/outages/events?from=${from}&until=${until}&entityType=country&limit=300&extendWindow=0`,
  ];
}

/** log scale: score 1 -> 0.05, 100 -> 0.33, 10 000 -> 0.67, 1 000 000 -> 1 */
export const strengthOf = (score: number): number => clamp01(Math.log10(1 + Math.max(0, score)) / 6);

/** Parses summary entries (and, as fallback, event entries) into one point per country. Throws when `data` is not a list. */
export function parseIodaOutages(body: unknown): MapPoint[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error('unerwartete Antwort: data fehlt oder ist keine Liste');
  const byCode = new Map<string, { score: number; name: string }>();
  for (const entry of data.flat()) {
    try {
      const e = entry as { entity?: { code?: unknown; name?: unknown; type?: unknown }; scores?: { overall?: unknown }; location?: unknown; location_name?: unknown; score?: unknown } | null;
      if (!e || typeof e !== 'object') continue;
      let code: string | null = null;
      let name = '';
      let score: number | null = null;
      if (e.entity && typeof e.entity === 'object') {
        if (typeof e.entity.type === 'string' && e.entity.type !== 'country') continue;
        code = typeof e.entity.code === 'string' ? e.entity.code : null;
        name = typeof e.entity.name === 'string' ? e.entity.name : '';
        score = num(e.scores?.overall);
      } else if (typeof e.location === 'string' && e.location.startsWith('country/')) {
        code = e.location.slice('country/'.length);
        name = typeof e.location_name === 'string' ? e.location_name : '';
        score = num(e.score);
      }
      if (!code || score === null || score <= 0) continue;
      code = code.toUpperCase();
      const prev = byCode.get(code);
      byCode.set(code, { score: (prev?.score ?? 0) + score, name: prev?.name || name });
    } catch { /* Eintrag überspringen */ }
  }
  const out: MapPoint[] = [];
  for (const [code, v] of byCode) {
    const c = countryCentroid(code);
    if (!c) continue;
    out.push({ lat: c.lat, lon: c.lon, label: c.de || v.name || code, value: Math.round(v.score), strength: strengthOf(v.score) });
  }
  return out;
}

const collector: Collector = {
  id: 'layer-ioda-outages',
  title: 'Kartenschicht: Internet-Störungen je Land (IODA)',
  sourceUrl: 'https://ioda.inetintel.cc.gatech.edu/',
  intervalMinutes: 30,
  signals: [],
  async collect(ctx) {
    let parsed: MapPoint[] | null = null;
    let lastError: unknown = null;
    for (const url of feedUrls(ctx.now)) {
      try {
        parsed = parseIodaOutages(await ctx.http.json<unknown>(url, { fixture: 'layers/ioda-outages-summary.json' }));
        break;
      } catch (e) { lastError = e; }
    }
    if (!parsed) throw lastError;
    const points = topPoints(parsed);
    return {
      observations: [],
      layers: [{
        id: 'internet-outages',
        title: 'Internet-Störungen je Land (letzte 24 Stunden)',
        title_en: 'Internet disruptions by country (last 24 hours)',
        plain: 'Jeder Punkt ist ein Land, in dem Messstellen in den letzten 24 Stunden Störungen im Internet gesehen haben. Größer heißt stärker. Nur zur Orientierung, zählt nicht zur Bewertung.',
        plain_en: 'Each dot is a country where monitoring stations saw internet disruptions in the last 24 hours. Bigger means stronger. For orientation only, it does not count towards any rating.',
        scenarios: ['cyber', 'blackout', 'war'],
        sourceName: 'IODA (Georgia Tech)',
        sourceUrl: 'https://ioda.inetintel.cc.gatech.edu/',
        license: 'frei für Forschung und Beobachtung, Quellenangabe erforderlich',
        ts: ctx.now.toISOString(),
        points,
      }],
    };
  },
};

export default collector;
