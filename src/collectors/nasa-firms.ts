// NASA FIRMS Area API: Satelliten-Hitzepunkte (VIIRS NOAA-20, Near Real-Time) je Gebiet und UTC-Tag (Klasse A).
// Quelle: https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/VIIRS_NOAA20_NRT/[west,south,east,north]/[DAY_RANGE]/[DATE]
// Doku: https://firms.modaps.eosdis.nasa.gov/api/area/ (geprüft 20.11.2026): DAY_RANGE 1..5, DATE liefert DATE .. DATE+DAY_RANGE-1;
//   Quellen u. a. VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, VIIRS_SNPP_NRT. Katalog: kein VIIRS_SNPP (endet 02.11.2026), daher NOAA-20.
// Key: MAP_KEY im Pfad (env SR_FIRMS_KEY). Limit 5000 Transaktionen / 10 min; mehrtägige Abfragen zählen mehrfach.
//   Hier 5 Requests à 2 Tage pro Lauf, Lauf alle 6 h. Der Key steht im Pfad: Fehlermeldungen werden im Collector geschwärzt
//   (redactUrl in http.ts schwärzt nur Query-Parameter).
// Lizenz: NASA-Daten frei nutzbar (NASA Earth Science Data Policy); Quelle nennen: "NASA FIRMS" (LANCE FIRMS, NASA EOSDIS).
// Antwort: CSV mit Kopfzeile latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,[instrument,]confidence,version,
//   bright_ti5,frp,daynight. Geprüft am 20.11.2026 gegen die keyfreie öffentliche 24-h-Datei
//   https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_24h.csv (gleiche Spalten,
//   Fixture fixtures/nasa-firms/public-24h-noaa20-ukraine-front.csv = echte Zeilen, auf die Front-Box gefiltert).
//   Der Parser liest Spalten über den Namen, eine zusätzliche Spalte instrument stört nicht.
// Gemessen: Zahl der Hitzepunkte je Box und UTC-Tag nach acq_date (Meta: FRP-Summe in MW). Nur sicher vollständige Tage:
//   Bezugstag = UTC-Tag von (now - 6 h); abgefragt und gemeldet werden die zwei Tage davor (NRT-Verzug ca. 3 h).
//   Tage ohne Treffer werden als 0 gemeldet. war.conflict.firms_refineries_russia zählt nur Punkte mit FRP >= 10 MW
//   ("ungewöhnlich starke Brände"); die übrigen Signale zählen alle Punkte.
// Boxen (west,south,east,north):
//   firms_front_ukraine     34,46.5,40.3,50.5   Charkiw bis Saporischschja, Donbas
//   firms_refineries_russia 36,44,53,58         Europäisches Russland: Moskau/Rjasan/Jaroslawl, Wolga, Krasnodar/Tuapse
//   fires_infrastructure    44,22,60,40         Iran und Golf (Box aus dem Katalog)
//   firms_gulf_energy       47,23,57.5,31       Küsten des Persischen Golfs (Katalog-Endpunkt 22,44,40,52 ist die Ukraine-Box,
//                                               offensichtlich kopiert; hier korrigiert)
//   firms_korea_dmz         125.5,37.5,129,38.7 Band um die innerkoreanische Grenze
// Harmlose Ursachen: Gasabfackelung (Golf, Wolga-Ural: stabiler Sockel), Landwirtschafts- und Waldbrände (saisonal),
//   Wolken verdecken Brände (Einbruch), Überflugsgeometrie (ein Gebiet liegt manchmal am Bahnrand).
// VERIFIED: ja (Live-Lauf Actions 20.11.2026, Run 44717048752): 10 Werte mit Key; Area-Endpunkt damit bestätigt. Welche der Signale im Einzelnen Werte hatten, ist im Lauf-Log nachzusehen (Summe 10).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, num, obs, parseCsv } from './_helpers.ts';

const KEY_ENV = 'SR_FIRMS_KEY';
const SOURCE = 'VIIRS_NOAA20_NRT';
const SETTLE_MS = 6 * 3600_000;
const DAYS = 2;

export interface Area { signalId: string; slug: string; bbox: [number, number, number, number]; minFrp?: number }
export const AREAS: Area[] = [
  { signalId: 'war.conflict.firms_front_ukraine', slug: 'ukraine-front', bbox: [34, 46.5, 40.3, 50.5] },
  { signalId: 'war.conflict.firms_refineries_russia', slug: 'russia-refineries', bbox: [36, 44, 53, 58], minFrp: 10 },
  { signalId: 'war.conflict.fires_infrastructure', slug: 'iran-gulf', bbox: [44, 22, 60, 40] },
  { signalId: 'war.conflict.firms_gulf_energy', slug: 'gulf-coast', bbox: [47, 23, 57.5, 31] },
  { signalId: 'war.conflict.firms_korea_dmz', slug: 'korea-dmz', bbox: [125.5, 37.5, 129, 38.7] },
];

export interface Hotspot { lat: number; lon: number; day: string; frp: number | null }

/** Parses a FIRMS CSV (area API or public file). Header only = no hotspots. Throws on non-CSV answers (e.g. key errors). */
export function parseFirmsCsv(text: string): Hotspot[] {
  const body = expect(typeof text === 'string' && text.trim() ? text : null, 'CSV-Text');
  const rows = parseCsv(body.trim());
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const iLat = head.indexOf('latitude');
  const iLon = head.indexOf('longitude');
  const iDay = head.indexOf('acq_date');
  const iFrp = head.indexOf('frp');
  if (iLat < 0 || iLon < 0 || iDay < 0) throw new Error(`unerwartete Antwort: CSV-Kopf ohne latitude/longitude/acq_date (${body.slice(0, 60).replace(/\s+/g, ' ')})`);
  const out: Hotspot[] = [];
  for (const r of rows.slice(1)) {
    const lat = num(r[iLat]);
    const lon = num(r[iLon]);
    const day = (r[iDay] ?? '').trim();
    if (lat === null || lon === null || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    out.push({ lat, lon, day, frp: iFrp >= 0 ? num(r[iFrp]) : null });
  }
  return out;
}

/** First day of the query and the days that are reported (complete days only). */
export function window(now: Date): { start: string; days: string[] } {
  const ref = floorDay(new Date(now.getTime() - SETTLE_MS)).getTime();
  const days = Array.from({ length: DAYS }, (_, i) => isoDay(new Date(ref - (DAYS - i) * DAY_MS)));
  return { start: days[0], days };
}

/** Daily counts for one area; hotspots outside the box or the requested days are ignored. */
export function dailyCounts(area: Area, spots: Hotspot[], days: string[]): Observation[] {
  const [w, s, e, n] = area.bbox;
  return days.map((day) => {
    const hit = spots.filter((p) => p.day === day && p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n
      && (area.minFrp === undefined || (p.frp ?? 0) >= area.minFrp));
    const frpSum = Math.round(hit.reduce((t, p) => t + (p.frp ?? 0), 0) * 10) / 10;
    return obs(area.signalId, `${day}T00:00:00Z`, hit.length, { frpSum, source: SOURCE });
  });
}

export function areaUrl(key: string, area: Area, start: string): string {
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${SOURCE}/${area.bbox.join(',')}/${DAYS}/${start}`;
}

const LICENSE = 'NASA offene Daten (Earth Science Data Policy); Quelle "NASA FIRMS" nennen; MAP_KEY max. 5000 Transaktionen/10 min';
const baseline = { method: 'rolling' as const, windowDays: 28, minPoints: 14 };
const common = { scenarios: ['war'], domain: 'conflict', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'low' as const, independenceGroup: 'nasa-firms', unit: 'Hitzepunkte/Tag', intervalMinutes: 1440, holdHours: 48,
  baseline, license: LICENSE, sourceName: 'NASA FIRMS Area API (VIIRS NOAA-20)', sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/' };

const collector: Collector = {
  id: 'nasa-firms',
  title: 'NASA FIRMS Area API (VIIRS NOAA-20 Hitzepunkte)',
  sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/',
  needsKey: KEY_ENV,
  intervalMinutes: 360,
  signals: [
    { ...common, id: 'war.conflict.firms_front_ukraine', name: 'Wärmequellen entlang der Front', weight: 0.6,
      plain: 'Zählt per Satellit erkannte Brände und Hitzepunkte im Osten der Ukraine (pro Tag).',
      banalCauses: ['Landwirtschaftsbrände', 'Gasfackeln', 'Wolken verdecken Brände'] },
    { ...common, id: 'war.conflict.firms_refineries_russia', name: 'Starke Brände im europäischen Russland (Raffineriegürtel)', weight: 0.6,
      plain: 'Zählt per Satellit erkannte starke Brände (ab 10 MW Strahlungsleistung) im europäischen Russland, wo die großen Raffinerien liegen.',
      banalCauses: ['Gasfackeln an Öl- und Gasfeldern', 'Industrielle Brände', 'Große Wald- und Steppenbrände'] },
    { ...common, id: 'war.conflict.fires_infrastructure', name: 'Satelliten-Hitzepunkte Iran und Golf', weight: 0.65,
      plain: 'Zählt per Satellit erkannte Hitzepunkte in Iran und am Golf, wo Raffinerien, Häfen und Depots liegen (pro Tag).',
      banalCauses: ['Gasabfackelung', 'Waldbrand', 'Industriebrand'] },
    { ...common, id: 'war.conflict.firms_gulf_energy', name: 'Hitzepunkte Golf-Energieanlagen', weight: 0.75,
      plain: 'Erkennt per Satellit Brände an Öl- und Gasanlagen an den Küsten des Persischen Golfs (pro Tag).',
      banalCauses: ['Fackelrauschen', 'Wolken und Staub'] },
    { ...common, id: 'war.conflict.firms_korea_dmz', name: 'Hotspots Korea (Grenze)', weight: 0.7,
      plain: 'Zählt per Satellit erkannte Hitzepunkte nahe der innerkoreanischen Grenze (pro Tag).',
      banalCauses: ['Waldbrand', 'Feldbrände im Frühjahr', 'Kontrollierte Brände an der Grenze'] },
  ],
  async collect(ctx) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const redact = (m: string) => m.split(key).join('REDACTED').split(encodeURIComponent(key)).join('REDACTED');
    const { start, days } = window(ctx.now);
    const observations: Observation[] = [];
    let ok = 0;
    for (const area of AREAS) {
      try {
        const text = await ctx.http.text(areaUrl(key, area, start), { fixture: `nasa-firms/area-${area.slug}.csv`, timeoutMs: 60_000 });
        observations.push(...dailyCounts(area, parseFirmsCsv(text), days));
        ok++;
      } catch (e) {
        ctx.log(`${area.signalId} übersprungen: ${redact(String((e as Error).message ?? e))}`);
      }
    }
    if (ok === 0) throw new Error('NASA FIRMS: kein Gebiet abrufbar (Key oder Dienst prüfen)');
    return { observations };
  },
};

export default collector;
