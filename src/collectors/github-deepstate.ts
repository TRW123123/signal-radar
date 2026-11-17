// Ukraine: Frontverschiebung als tägliche Flächenänderung der von Russland besetzten Gebiete laut DeepStateMap (GitHub-Archiv).
// Quelle: GitHub-Repo cyterat/deepstate-map-data, Tagesdateien data/deepstatemap_data_<JJJJMMTT>.geojson (je ca. 77 kB, täglich gegen 03:00 UTC;
//   enthalten das MultiPolygon der besetzten Gebiete, Kartenstand von DeepStateMap, einer freiwilligen OSINT-Karte).
// https://github.com/cyterat/deepstate-map-data  Kein Key. Die Datei des laufenden Tages erscheint erst gegen 03:00 UTC, deshalb werden Dateien ab gestern abgerufen.
// Lizenz: unklar (Quelle DeepStateMap, Repo-Lizenz nicht geprüft). Es werden nur Flächenzahlen gespeichert, keine Geometrien.
// Gemessen: war.attention.frontline_area_change = Fläche(Tag) minus Fläche(Vortag) in km², berechnet aus den Ringen des GeoJSON mit der
//   sphärischen Flächenformel (Chamberlain/Duquette, Erdradius 6371,0088 km; Löcher werden abgezogen). Absolutwert ca. 116 900 km² (17.11.2026),
//   Fehler gegen ellipsoidische Rechnung unter 1 %, für Differenzen aufeinanderfolgender Tage unerheblich, da identisch gerechnet.
//   Zeitstempel = Dateidatum um 00:00 UTC. Differenz nur zwischen zwei unmittelbar aufeinanderfolgenden Tagesdateien; fehlt ein Tag, entfällt die Differenz.
//   Je Lauf werden 8 Dateien abgerufen (ca. 0,6 MB) und 7 Differenzen gemeldet; die Reihe wächst täglich, der Speicher ignoriert bekannte Zeitstempel.
// Normalzustand: 0 bis 10 km² pro Tag (Tage ohne Kartenänderung ergeben genau 0), vereinzelt Sprünge nach Nachpflege der Karte.
// Harmlose Ursachen für Ausschläge: Nachpflege oder Korrektur der Karte (rückwirkende Neuzeichnung ganzer Abschnitte), Kartierungsverzug,
//   gebündelte Änderungen nach mehreren Tagen ohne Update, Ausfall der täglichen Aktualisierung im Repo.
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, obs, ymd } from './_helpers.ts';

const BASE = 'https://raw.githubusercontent.com/cyterat/deepstate-map-data/main/data/deepstatemap_data_';
const FILES = 8;
const R_KM = 6371.0088;
const SIG = 'war.attention.frontline_area_change';

type Ring = number[][];
const rad = (d: number): number => (d * Math.PI) / 180;

function ringArea(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    if (!Array.isArray(a) || !Array.isArray(b) || !Number.isFinite(a[0]) || !Number.isFinite(b[1])) throw new Error('unerwartete Antwort: Koordinate ungültig');
    s += rad(b[0] - a[0]) * (2 + Math.sin(rad(a[1])) + Math.sin(rad(b[1])));
  }
  return (Math.abs(s) * R_KM * R_KM) / 2;
}

function polygonArea(p: Ring[]): number {
  return ringArea(p[0]) - p.slice(1).reduce((acc, h) => acc + ringArea(h), 0);
}

/** Fläche in km² aller Polygone einer FeatureCollection (Polygon und MultiPolygon). Wirft bei fehlender Geometrie. */
export function parseAreaKm2(body: unknown): number {
  const fc = body as { features?: { geometry?: { type?: string; coordinates?: unknown } }[] };
  const features = expect(Array.isArray(fc?.features) ? fc.features : null, 'features');
  let total = 0;
  let polys = 0;
  for (const f of features) {
    const g = f?.geometry;
    if (g?.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      for (const p of g.coordinates as Ring[][]) { total += polygonArea(p); polys++; }
    } else if (g?.type === 'Polygon' && Array.isArray(g.coordinates)) {
      total += polygonArea(g.coordinates as Ring[]); polys++;
    }
  }
  if (polys === 0 || !(total > 0)) throw new Error('unerwartete Antwort: keine Polygone');
  return total;
}

export interface DayArea { day: string; km2: number }
export interface DayDelta { day: string; deltaKm2: number }

/** Differenzen zwischen unmittelbar aufeinanderfolgenden Tagen (Eingabe beliebig sortiert). */
export function dailyDeltas(areas: DayArea[]): DayDelta[] {
  const sorted = [...areas].sort((a, b) => a.day.localeCompare(b.day));
  const out: DayDelta[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = Date.parse(`${sorted[i].day}T00:00:00Z`) - Date.parse(`${sorted[i - 1].day}T00:00:00Z`);
    if (gap === DAY_MS) out.push({ day: sorted[i].day, deltaKm2: Math.round((sorted[i].km2 - sorted[i - 1].km2) * 100) / 100 });
  }
  return out;
}

const collector: Collector = {
  id: 'github-deepstate',
  title: 'DeepStateMap-Archiv (GitHub, Frontverlauf)',
  sourceUrl: 'https://github.com/cyterat/deepstate-map-data',
  intervalMinutes: 1440,
  signals: [
    {
      id: SIG, scenarios: ['war'], domain: 'attention', evidenceClass: 'D', direction: 'up', kind: 'gauge', weight: 0.5, manipulability: 'medium',
      independenceGroup: 'github-deepstate', unit: 'km²/Tag', intervalMinutes: 1440, holdHours: 72,
      name: 'Ukraine: Frontverschiebung (Flächenänderung der besetzten Gebiete pro Tag)',
      plain: 'Misst, wie viel Fläche laut der Freiwilligenkarte DeepStateMap von einem Tag zum nächsten als besetzt eingezeichnet wird; große Sprünge zeigen Offensiven oder Kartenkorrekturen.',
      baseline: { method: 'rolling', windowDays: 56, minPoints: 14 },
      thresholds: { z0: 3, z1: 8, absFloor: 5 },
      sourceName: 'cyterat/deepstate-map-data (GitHub)', sourceUrl: 'https://github.com/cyterat/deepstate-map-data',
      license: 'unklar (Quelle DeepStateMap, Repo-Lizenz nicht geprüft)',
      banalCauses: ['Nachpflege und Korrektur der Karte', 'Kartierungsverzug, gebündelte Änderungen', 'Ausfall der täglichen Aktualisierung'],
    },
  ],
  async collect(ctx) {
    const areas: DayArea[] = [];
    for (let i = 1; i <= FILES; i++) {
      const d = daysAgo(ctx.now, i);
      const day = d.toISOString().slice(0, 10);
      try {
        const body = await ctx.http.json<unknown>(`${BASE}${ymd(d)}.geojson`, { fixture: `deepstate/${ymd(d)}.geojson`, timeoutMs: 30_000 });
        areas.push({ day, km2: parseAreaKm2(body) });
      } catch (e) {
        ctx.log(`DeepState ${day} übersprungen: ${(e as Error).message}`);
      }
    }
    if (areas.length < 2) throw new Error('weniger als zwei Tagesdateien lesbar');
    const observations: Observation[] = dailyDeltas(areas).map((x) => obs(SIG, `${x.day}T00:00:00Z`, x.deltaKm2));
    return { observations };
  },
};

export default collector;
