// Seismische Ereignisse: Zählwerte aus dem USGS-Ereigniskatalog (Evidenzklasse A: unabhängige Messung).
// Quelle: USGS FDSN-Ereignisdienst, Endpunkt /fdsnws/event/1/count, https://earthquake.usgs.gov/fdsnws/event/1/ (Doku dort), kein Key.
// Lizenz: gemeinfrei (US-Regierung). Nur Zähler, keine Ereignisdetails; passive Leseabfragen.
// Größe: /count liefert nur {"count": N, "maxAllowed": 20000} (ca. 40 Zeichen); keine Ereignisliste.
// Gemessen: je Lauf die Zahl der Katalog-Ereignisse im Fenster der letzten 24 Stunden bis zur zuletzt vollen UTC-Stunde (Zeitstempel =
// Fensterende, trailing 24 h), 8 Abfragen: (1) eventtype=nuclear explosion weltweit, (2) eventtype=explosion weltweit,
// (3 bis 8) alle Ereignisse mit Herdtiefe höchstens 10 km (maxdepth, flach) im Umkreis bekannter Testgelände (Punggye-ri 100 km,
// Nowaja Semlja 400 km, Lop Nur 150 km, Nevada NNSS 60 km, Chagai 150 km, Pokhran 150 km). Normalwert für die Gelände meist 0.
// Die Ereignisse erscheinen im Katalog mit Verzug (Minuten bis Stunden, Prüfung bis Tage): der Wert einer Stunde kann nachträglich
// steigen; der Speicher behält den ersten gemeldeten Wert, spätere Läufe überlappen aber (trailing 24 h).
// Harmlose Ursachen: natürliche Beben und Nachbeben, Steinbruch- und Bergwerkssprengungen, Einstürze in Minen, Kriegshandlungen
// (Einträge vom Typ explosion), neue Netzstationen oder geänderte Einstufung, Zählweise des Katalogs (Verzug).
// VERIFIED: nein (Form {"count":N,"maxAllowed":...} und Parameter laut USGS-Doku; in der Bau-Umgebung nicht abrufbar)

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/count?format=geojson';
const HOUR = 3600_000;
export const WINDOW_H = 24;
export const MAX_DEPTH_KM = 10;

interface Site { key: string; id: string; name: string; plain: string; lat: number; lon: number; radiusKm: number; weight: number }
const SITES: Site[] = [
  { key: 'punggye-ri', id: 'nuclear.seismic.events_near_punggye_ri', name: 'Seismische Ereignisse nahe Punggye-ri (Nordkorea)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Punggye-ri (Nordkorea).', lat: 41.28, lon: 129.08, radiusKm: 100, weight: 0.9 },
  { key: 'novaya-zemlya', id: 'nuclear.seismic.events_near_novaya_zemlya', name: 'Seismische Ereignisse nahe Nowaja Semlja (Russland)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Nowaja Semlja (Russland).', lat: 73.4, lon: 54.9, radiusKm: 400, weight: 0.85 },
  { key: 'lop-nur', id: 'nuclear.seismic.events_near_lop_nur', name: 'Seismische Ereignisse nahe Lop Nur (China)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Lop Nur (China).', lat: 41.7, lon: 88.4, radiusKm: 150, weight: 0.8 },
  { key: 'nevada-nnss', id: 'nuclear.seismic.events_near_nevada_nnss', name: 'Seismische Ereignisse nahe Nevada (USA)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Nevada (USA).', lat: 37.1, lon: -116.05, radiusKm: 60, weight: 0.8 },
  { key: 'chagai', id: 'nuclear.seismic.events_near_chagai', name: 'Seismische Ereignisse nahe Chagai (Pakistan)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Chagai (Pakistan).', lat: 28.8, lon: 64.9, radiusKm: 150, weight: 0.6 },
  { key: 'pokhran', id: 'nuclear.seismic.events_near_pokhran', name: 'Seismische Ereignisse nahe Pokhran (Indien)', plain: 'Zahl der flachen Erdbeben- oder Explosionsmeldungen der letzten 24 Stunden in der Nähe des bekannten Testgeländes Pokhran (Indien).', lat: 27.1, lon: 71.75, radiusKm: 150, weight: 0.6 },
];
const SIG_NUKE = 'nuclear.seismic.nuclear_explosion_type_global_count';
const SIG_EXPL = 'nuclear.seismic.explosion_type_global_count';

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);

export interface Query { signalId: string; fixture: string; url: string }

/** Alle Abfragen für das Fenster [end - 24 h, end] (end = volle UTC-Stunde). */
export function buildQueries(endMs: number): Query[] {
  const win = `&starttime=${iso(endMs - WINDOW_H * HOUR)}&endtime=${iso(endMs)}`;
  const q: Query[] = [
    { signalId: SIG_NUKE, fixture: 'usgs/count-nuclear-explosion-24h.json', url: `${BASE}${win}&eventtype=nuclear%20explosion` },
    { signalId: SIG_EXPL, fixture: 'usgs/count-explosion-24h.json', url: `${BASE}${win}&eventtype=explosion` },
  ];
  for (const s of SITES) {
    q.push({ signalId: s.id, fixture: `usgs/count-${s.key}-24h.json`, url: `${BASE}${win}&latitude=${s.lat}&longitude=${s.lon}&maxradiuskm=${s.radiusKm}&maxdepth=${MAX_DEPTH_KM}` });
  }
  return q;
}

/** Liest {"count": N}; negative oder fehlende Zahlen sind ein Fehler. */
export function parseCount(body: unknown): number {
  const n = num((body as { count?: unknown } | null)?.count);
  const c = expect(n, 'count');
  if (c < 0) throw new Error('unerwartete Antwort: count negativ');
  return c;
}

const common = {
  scenarios: ['nuclear'], domain: 'seismic', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'count' as const,
  independenceGroup: 'usgs', unit: 'Ereignisse/24 h', intervalMinutes: 60, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 48 }, thresholds: { z0: 4, z1: 10, absFloor: 1 },
  sourceName: 'USGS Earthquake Catalog (FDSN)', sourceUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/', license: 'gemeinfrei (US-Regierung)',
};

const collector: Collector = {
  id: 'usgs-quakes',
  title: 'USGS Ereigniskatalog (Zählwerte)',
  sourceUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/',
  intervalMinutes: 60,
  signals: [
    ...SITES.map((s) => ({
      ...common, id: s.id, name: s.name, plain: s.plain, weight: s.weight, manipulability: 'low' as const,
      banalCauses: ['Natürliche Beben', 'Steinbruch- und Bergwerkssprengungen', 'Einstürze in Minen', 'Verzug und Nachträge im Katalog'],
    })),
    {
      ...common, id: SIG_NUKE, name: 'Weltweit als Kernexplosion eingestufte Ereignisse', weight: 0.9, manipulability: 'low' as const,
      plain: 'Zahl der Ereignisse der letzten 24 Stunden, die der USGS-Katalog als Kernexplosion einstuft; normal null.',
      banalCauses: ['Fehleinstufung', 'Nachträgliche Korrektur im Katalog'],
    },
    {
      ...common, id: SIG_EXPL, name: 'Weltweit gemeldete Explosionen im Beben-Katalog', weight: 0.6, manipulability: 'medium' as const,
      plain: 'Zahl der Ereignisse der letzten 24 Stunden, die Seismologen als Explosion statt als Beben einstufen.',
      banalCauses: ['Steinbrüche und Bergwerke', 'Neue Netzstationen', 'Änderung der Einstufung', 'Kriegshandlungen'],
    },
  ],
  async collect(ctx) {
    const end = floorHour(ctx.now).getTime();
    const observations: Observation[] = [];
    let ok = 0;
    for (const q of buildQueries(end)) {
      try {
        observations.push(obs(q.signalId, end, parseCount(await ctx.http.json<unknown>(q.url, { fixture: q.fixture }))));
        ok++;
      } catch (e) {
        ctx.log(`${q.signalId} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('USGS-Zählabfragen: keine Antwort');
    return { observations };
  },
};

export default collector;
