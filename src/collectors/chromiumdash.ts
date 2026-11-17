// Chrome-Stable-Releases (Windows) aus Chromium Dash, Klasse B: Takt der Sicherheitsupdates des Browsers.
// Quelle: https://chromiumdash.appspot.com/fetch_releases  (inoffizielle API der Chromium-Dashboard-Seite, keine Doku-Garantie)
// Doku/Seite: https://chromiumdash.appspot.com/releases   Lizenz: BSD (Chromium), Daten ohne ausdrückliche Nutzungsbedingungen.
// Gemessen: Anzahl Stable-Releases pro UTC-Tag (Feld `time`, Millisekunden seit Epoche). Normal ist etwa ein Release pro Woche;
//   zusätzliche Releases dazwischen sind das Muster von Notfall-Patches gegen ausgenutzte Zero-Days.
// Harmlose Ursachen: Meilenstein-Wechsel alle vier Wochen (zusätzliche Releases), Feiertags-Pausen.
// Es werden nur Tage nach dem ältesten gelieferten Release gemeldet, damit eine zu kurze Antwort nicht wie eine Lücke aussieht.
// VERIFIED: nein (Antwortform aus dem Gedächtnis: Array mit version, milestone, time, platform, channel).

import type { Collector } from '../core/types.ts';
import { DAY_MS, countPerDay, expect, floorDay, num } from './_helpers.ts';

export const URL = 'https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=50';

export interface Release { version: string; time: number; milestone: number | null }

export function parseReleases(body: unknown): Release[] {
  const arr = expect(Array.isArray(body) ? (body as Record<string, unknown>[]) : null, 'Release-Liste (Array)');
  const out: Release[] = [];
  for (const r of arr) {
    const t = num(r?.time);
    if (t === null || typeof r.version !== 'string') continue;
    out.push({ version: r.version, time: t, milestone: num(r.milestone) });
  }
  return out;
}

export function releasesPerDay(releases: Release[], now: Date, maxDays: number) {
  if (releases.length === 0) return [];
  const oldest = Math.min(...releases.map((r) => r.time));
  const firstFull = floorDay(new Date(oldest)).getTime() + DAY_MS;
  const days = Math.min(maxDays, Math.round((floorDay(now).getTime() - firstFull) / DAY_MS));
  if (days < 1) return [];
  return countPerDay('cyber.vuln.emergency_releases', releases.map((r) => r.time), now, { days });
}

const collector: Collector = {
  id: 'chromiumdash',
  title: 'Chromium Dash Releases',
  sourceUrl: 'https://chromiumdash.appspot.com/releases',
  intervalMinutes: 360,
  signals: [{
    id: 'cyber.vuln.emergency_releases', scenarios: ['cyber'], domain: 'vuln', name: 'Chrome-Stable-Releases pro Tag',
    plain: 'Wie oft Google seinen Browser Chrome aktualisiert; ungewöhnlich viele Updates deuten auf Notfall-Patches hin.',
    evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.7, manipulability: 'low', independenceGroup: 'chromiumdash',
    unit: 'Releases/Tag', intervalMinutes: 1440, holdHours: 72,
    baseline: { method: 'day-of-week', windowDays: 56, minPoints: 21 },
    thresholds: { absFloor: 1 },
    license: 'BSD (Chromium), API inoffiziell',
    banalCauses: ['Meilenstein-Wechsel', 'Zero-Day-Einzelfall'],
  }],
  async collect(ctx) {
    const releases = parseReleases(await ctx.http.json<unknown>(URL, { fixture: 'chromiumdash/stable-windows.json' }));
    if (releases.length === 0) throw new Error('unerwartete Antwort: keine Releases');
    return { observations: releasesPerDay(releases, ctx.now, 90) };
  },
};

export default collector;
