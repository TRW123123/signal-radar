// Global Fishing Watch Events API v3: AIS-Abschaltungen ("AIS off", aka GAP) je Seegebiet und UTC-Tag (Klasse A).
// Quelle: GET https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-gaps-events:latest
//   &gap-intentional-disabling=true&regionDatasets[0]=public-eez-areas&regionIds[0]=...&start-date&end-date&limit&offset
// Doku: https://globalfishingwatch.org/our-apis/documentation/ (gelesen 20.11.2026 über /llms-full.txt und die Seite
//   /docs/v3/events/get-all-events): GET-Parameter u. a. datasets*, start-date (inkl.), end-date (exkl.), limit*, offset*,
//   gap-intentional-disabling, regionDatasets, regionIds, include-regions, timeFilterMode (Standard OVERLAP).
//   Antwort: { entries: [{ id, type, start, end, position: { lat, lon }, vessel: {...}, regions, distances, ... }],
//   limit, offset, nextOffset, total, metadata }. Regionen-IDs der EEZ = Marine-Regions-MRGID (Doku-Beispiele Senegal 8371,
//   Ghana 8400, Argentinien 8466; IDs hier per marineregions.org-Gazetteer ermittelt).
// Key: Bearer-Token (env SR_GFW_KEY). Limits: 50 000 Requests/Tag, 1 500 000/Monat je Nutzer. Hier 2 bis 4 Requests pro Lauf, alle 12 h.
// Lizenz: nur nicht-kommerziell, CC BY-NC 4.0 (Terms of Use, Abschnitt 1.C). Pflicht-Attribution auf Webseiten/Grafiken
//   (Abschnitt 3.A.1): "Powered by Global Fishing Watch." mit Link auf https://globalfishingwatch.org
//   (oder die lange Zitierform mit Datensatzname/Datum). Gap-Datensatz ist laut Doku im Prototyp-Stadium.
// Definition GAP (Doku "Data caveats"): Lücke >= 12 h, Beginn >= 50 sm von der Küste, gute Satellitenabdeckung, >= 14 Positionen
//   in den 12 h davor. In schmalen Meeren (Ostsee, Persischer Golf) erfüllen nur wenige Lücken die 50-sm-Regel: kleine Zahlen.
// Gemessen: Zahl der als absichtlich eingestuften AIS-Lücken je UTC-Tag nach Beginn (start), je Gebiet:
//   war.shipping.ais_gaps_gulf:        EEZ Iran 8469, Irak 8470, Kuwait 8357, Bahrain 8358, Katar 8468, VAE 8360, Saudi-Arabien 8356,
//                                      Oman 8354 (Saudi-Arabien schließt das Rote Meer ein, Oman das Arabische Meer)
//   war.shipping.baltic_dark_vessels:  EEZ Estland 5675, Lettland 5683, Litauen 5684, Finnland 5676, Schweden 5694, Polen 5687
//                                      (ohne Deutschland/Dänemark wegen Nordseeanteil, ohne Russland wegen Gesamt-EEZ)
//   Fenster: Tage von now-10 d bis now-4 d (GFW-Verzug und 12-h-Mindestdauer: jüngere Tage sind noch unvollständig).
//   Sind mehr Einträge vorhanden als abgerufen (total > geholt nach höchstens 2 Seiten à 500), wird nichts gemeldet.
// Harmlose Ursachen: Empfangslücken der Satelliten, GPS-Störungen/Spoofing (Ostsee, Golf), technische Ausfälle an Bord,
//   Nachverarbeitung bei GFW (Werte können sich nachträglich ändern; der Speicher behält den ersten Wert).
// Not built: war.shipping.chokepoint_taiwan_strait. Katalog-Collector ist imf-portwatch (Tagesdurchfahrten); Verkehrszählungen
//   bietet GFW nur über 4Wings-Reports bzw. events/stats per POST, und ctx.http kann nur GET.
// VERIFIED: nein (ungeprüft bis Key). Ohne Token {"error":"invalid token"}; Format nach offizieller Doku (OpenAPI-Beispiel).
//   Offen: ob mehrere regionIds im GET als ODER verknüpft werden (Doku nennt Liste, Semantik nicht beschrieben).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, num, obs } from './_helpers.ts';

const KEY_ENV = 'SR_GFW_KEY';
const BASE = 'https://gateway.api.globalfishingwatch.org/v3/events';
export const PAGE = 500;
const MAX_PAGES = 2;
const FIRST_DAY_AGO = 10;
const LAST_DAY_AGO = 4;

export interface Region { signalId: string; slug: string; eez: number[] }
export const REGIONS: Region[] = [
  { signalId: 'war.shipping.ais_gaps_gulf', slug: 'gulf', eez: [8469, 8470, 8357, 8358, 8468, 8360, 8356, 8354] },
  { signalId: 'war.shipping.baltic_dark_vessels', slug: 'baltic', eez: [5675, 5683, 5684, 5676, 5694, 5687] },
];

export interface Page { starts: number[]; total: number; count: number }

/** One page of the events response: start times (ms) of all entries plus total. */
export function parsePage(body: unknown): Page {
  const b = (body ?? {}) as { entries?: unknown; total?: unknown };
  const entries = expect(b.entries, 'entries');
  if (!Array.isArray(entries)) throw new Error('unerwartete Antwort: entries ist keine Liste');
  const total = expect(num(b.total), 'total');
  const starts: number[] = [];
  for (const e of entries as Record<string, unknown>[]) {
    const t = typeof e?.start === 'string' ? Date.parse(e.start) : NaN;
    if (Number.isFinite(t)) starts.push(t);
  }
  return { starts, total, count: entries.length };
}

export function days(now: Date): string[] {
  const today = floorDay(now).getTime();
  const out: string[] = [];
  for (let i = FIRST_DAY_AGO; i >= LAST_DAY_AGO; i--) out.push(isoDay(new Date(today - i * DAY_MS)));
  return out;
}

export function eventsUrl(region: Region, now: Date, offset: number): string {
  const d = days(now);
  const end = isoDay(new Date(Date.parse(d[d.length - 1]) + DAY_MS));
  const p: string[] = [
    `datasets[0]=${encodeURIComponent('public-global-gaps-events:latest')}`,
    'gap-intentional-disabling=true',
    'regionDatasets[0]=public-eez-areas',
    ...region.eez.map((id, i) => `regionIds[${i}]=${id}`),
    `start-date=${d[0]}`, `end-date=${end}`, 'include-regions=false',
    `limit=${PAGE}`, `offset=${offset}`,
  ];
  return `${BASE}?${p.join('&')}`;
}

/** Daily counts by event start; days without events are 0. */
export function dailyCounts(signalId: string, starts: number[], now: Date): Observation[] {
  const counts = new Map(days(now).map((d) => [d, 0]));
  for (const t of starts) {
    const d = isoDay(new Date(t));
    if (counts.has(d)) counts.set(d, counts.get(d)! + 1);
  }
  return [...counts.entries()].map(([d, n]) => obs(signalId, `${d}T00:00:00Z`, n));
}

const LICENSE = 'CC BY-NC 4.0, nur nicht-kommerziell; Pflichthinweis "Powered by Global Fishing Watch." mit Link auf globalfishingwatch.org';
const common = { scenarios: ['war'], domain: 'shipping', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'gfw', unit: 'AIS-Lücken/Tag', intervalMinutes: 1440, holdHours: 48,
  maxAgeHours: 6 * 24, baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 }, license: LICENSE,
  sourceName: 'Global Fishing Watch API (AIS-off-Events)', sourceUrl: 'https://globalfishingwatch.org/our-apis/' };

const collector: Collector = {
  id: 'gfw',
  title: 'Global Fishing Watch Events API (AIS-Abschaltungen)',
  sourceUrl: 'https://globalfishingwatch.org/our-apis/documentation/',
  needsKey: KEY_ENV,
  intervalMinutes: 720,
  signals: [
    { ...common, id: 'war.shipping.ais_gaps_gulf', name: 'AIS-Abschaltungen Golfregion', weight: 0.6,
      plain: 'Zählt Schiffe im Golf, die ihr Ortungssignal absichtlich abschalten (pro Tag, mit einigen Tagen Verzug).',
      banalCauses: ['Technik', 'Satellitenlücken', 'Spoofing', 'Empfängerausfall'] },
    { ...common, id: 'war.shipping.baltic_dark_vessels', name: 'Dunkle Schiffe Ostsee', weight: 0.45,
      plain: 'Zählt Schiffe in der Ostsee, die ihr Ortungssignal absichtlich abschalten (pro Tag, mit einigen Tagen Verzug).',
      banalCauses: ['GPS-Spoofing', 'Satellitenlücken', 'Wenige Ereignisse wegen 50-Seemeilen-Regel'] },
  ],
  async collect(ctx) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const headers = { Authorization: `Bearer ${key}` };
    const observations: Observation[] = [];
    let ok = 0;
    for (const region of REGIONS) {
      try {
        const starts: number[] = [];
        let fetched = 0;
        let total = 0;
        for (let page = 0; page < MAX_PAGES; page++) {
          const p = parsePage(await ctx.http.json<unknown>(eventsUrl(region, ctx.now, page * PAGE), {
            fixture: `gfw/gaps-${region.slug}-p${page}.json`, headers, timeoutMs: 60_000 }));
          starts.push(...p.starts);
          fetched += p.count;
          total = p.total;
          if (fetched >= total || p.count < PAGE) break;
        }
        if (fetched < total) throw new Error(`nur ${fetched} von ${total} Einträgen geholt, unvollständige Zählung verworfen`);
        observations.push(...dailyCounts(region.signalId, starts, ctx.now));
        ok++;
      } catch (e) {
        ctx.log(`${region.signalId} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('Global Fishing Watch: keine Region abrufbar');
    return { observations };
  },
};

export default collector;
