// Chrome-Stable-Releases (Windows) aus Chromium Dash, Klasse B: Takt der Sicherheitsupdates des Browsers.
// Quelle: https://chromiumdash.appspot.com/fetch_releases  (inoffizielle API der Chromium-Dashboard-Seite, keine Doku-Garantie)
// Doku/Seite: https://chromiumdash.appspot.com/releases   Lizenz: BSD (Chromium), Daten ohne ausdrückliche Nutzungsbedingungen.
// Gemessen: Anzahl Stable-Releases pro UTC-Tag (Feld `time`, Millisekunden seit Epoche). Normal ist etwa ein Release pro Woche;
//   zusätzliche Releases dazwischen sind das Muster von Notfall-Patches gegen ausgenutzte Zero-Days.
// Harmlose Ursachen: Meilenstein-Wechsel alle vier Wochen (zusätzliche Releases), Feiertags-Pausen.
// Es werden nur Tage nach dem ältesten gelieferten Release gemeldet, damit eine zu kurze Antwort nicht wie eine Lücke aussieht.
// Echte Form (17.11.2026): Array mit je ca. 600 Zeichen (channel, hashes, milestone, platform, previous_version, time, version).
//   Mehrere Versionen eines Release-Schubs teilen sich denselben `time`-Wert; gezählt werden deshalb verschiedene Zeitstempel.
//   num=50 waren 30 103 Zeichen (ca. 600 je Release); die Aufzeichnungs-Umgebung nimmt nur ca. 6 000 Zeichen, daher num=8 (ca. 4 800).
//   Das reicht für einige Wochen Historie; ältere Tage baut der Speicher Lauf für Lauf auf (es wird erst ab dem ältesten Release gezählt).
// VERIFIED: teilweise (17.11.2026, Form an echtem Ausschnitt geprüft; Antwort mit num=8 wartet auf Aufzeichnung).

import type { Collector } from '../core/types.ts';
import { DAY_MS, countPerDay, expect, floorDay, num } from './_helpers.ts';

export const URL = 'https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=8';
export const FIXTURE = 'chromiumdash/stable-windows-8.json';

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
  const events = [...new Set(releases.map((r) => r.time))];
  return countPerDay('cyber.vuln.emergency_releases', events, now, { days });
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
    const releases = parseReleases(await ctx.http.json<unknown>(URL, { fixture: FIXTURE }));
    if (releases.length === 0) throw new Error('unerwartete Antwort: keine Releases');
    return { observations: releasesPerDay(releases, ctx.now, 90) };
  },
};

export default collector;
