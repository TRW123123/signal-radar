// abuse.ch URLhaus: neu gemeldete Malware-Verteilungs-URLs pro Stunde (Klasse A).
// Quelle: https://urlhaus.abuse.ch/downloads/csv_recent/ (kommentierte CSV der jüngsten URLs)
// Doku: https://urlhaus.abuse.ch/api/
// Lizenz: CC0 (abuse.ch).
// Auth: abuse.ch verlangt seit 2025 Auth-Keys (https://auth.abuse.ch/). Die Quelle antwortet ohne Key mit HTTP 410 (17.11.2026, Aufzeichnung);
//       needsKey ist richtig (Header Auth-Key).
// Gemessen: URLs je voller UTC-Stunde aus `dateadded`; älteste Stunde der Antwort und laufende Stunde entfallen.
// Harmlose Ursachen: Batch-Uploads einzelner Melder, Aufräumläufe, Quellenausfall (Lücke).
// Ausgelassen: cyber.threat.c2_hosting_concentration (Hoster-Zuordnung fehlt im Export).
// VERIFIED: nein (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Kopfzeile nach Gedächtnis: "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter").

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs, parseCsv } from './_helpers.ts';

const SIGNAL = 'cyber.threat.urlhaus_volume';
const HOUR = 3600_000;

function parseUtc(s: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Zeitstempel (ms) der Datenzeilen. Spalte `dateadded` laut #-Kopfzeile, sonst Spalte 1. */
export function parseTimestamps(body: string): number[] {
  let col = 1;
  const data: string[] = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('#')) {
      const names = line.replace(/^#\s*/, '').split(',').map((x) => x.trim().replace(/"/g, ''));
      const i = names.indexOf('dateadded');
      if (i >= 0) col = i;
    } else if (line.trim() !== '') data.push(line);
  }
  const out: number[] = [];
  for (const row of parseCsv(data.join('\n'))) {
    const t = parseUtc(row[col] ?? '');
    if (t !== null) out.push(t);
  }
  return out;
}

export function hourlyCounts(signalId: string, timestamps: number[], now: Date): Observation[] {
  if (timestamps.length < 2) return [];
  const first = Math.floor(Math.min(...timestamps) / HOUR) * HOUR + HOUR;
  const last = Math.floor(now.getTime() / HOUR) * HOUR;
  const counts = new Map<number, number>();
  for (let h = first; h < last; h += HOUR) counts.set(h, 0);
  for (const t of timestamps) {
    const h = Math.floor(t / HOUR) * HOUR;
    if (counts.has(h)) counts.set(h, counts.get(h)! + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => obs(signalId, h, n));
}

export function parse(body: string, now: Date): Observation[] {
  const ts = parseTimestamps(body);
  expect(ts.length > 0 ? ts : null, 'Zeilen mit dateadded');
  return hourlyCounts(SIGNAL, ts, now);
}

const collector: Collector = {
  id: 'urlhaus',
  title: 'abuse.ch URLhaus (recent)',
  sourceUrl: 'https://urlhaus.abuse.ch/api/',
  needsKey: 'SR_ABUSECH_KEY',
  intervalMinutes: 60,
  signals: [{
    id: SIGNAL, scenarios: ['cyber'], domain: 'threat', name: 'URLhaus Malware-URLs pro Stunde',
    plain: 'Wie viele neue Internetadressen, die Schadsoftware verteilen, pro Stunde gemeldet werden.',
    evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.45, manipulability: 'medium',
    independenceGroup: 'urlhaus', unit: 'URLs/Stunde', intervalMinutes: 60, holdHours: 6,
    baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
    license: 'CC0 (abuse.ch)',
  }],
  async collect(ctx) {
    const key = expect(ctx.key('SR_ABUSECH_KEY'), 'SR_ABUSECH_KEY');
    const body = await ctx.http.text('https://urlhaus.abuse.ch/downloads/csv_recent/', {
      fixture: 'urlhaus/csv-recent.csv', headers: { 'Auth-Key': key },
    });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
