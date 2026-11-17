// abuse.ch ThreatFox: neu gemeldete Indikatoren (IOCs: IP:Port, Domain, URL, Hash) pro Stunde (Klasse A).
// Quelle: https://threatfox.abuse.ch/export/json/recent/ (JSON-Export der jüngsten IOCs)
// Doku: https://threatfox.abuse.ch/api/ und https://threatfox.abuse.ch/export/
// Lizenz: CC0 (abuse.ch).
// Auth: abuse.ch verlangt seit 2025 Auth-Keys ("Community First", https://auth.abuse.ch/). Ob der Export schon
//       einen Key braucht, war per Doku nicht prüfbar: needsKey gesetzt, Header Auth-Key.
// Gemessen: IOCs je voller UTC-Stunde aus `first_seen_utc`; älteste Stunde der Antwort und laufende Stunde entfallen.
// Harmlose Ursachen: Import-Batches einzelner Melder, Massenmeldung einer Familie, Quellenausfall (Lücke).
// Ausgelassen: cyber.threat.c2_hosting_concentration (braucht Hoster-Zuordnung, nicht in diesem Export).
// VERIFIED: nein (Form nach Gedächtnis: Objekt { "<ioc_id>": [ { first_seen_utc, ... } ] }; Array wird ebenfalls akzeptiert).

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const SIGNAL = 'cyber.threat.threatfox_ioc_volume';
const HOUR = 3600_000;

function parseUtc(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Zeitstempel (ms) aller IOC-Einträge, egal ob Objekt-von-Listen oder flache Liste. */
export function parseTimestamps(body: unknown): number[] {
  const root = expect(body as object | null, 'JSON-Körper');
  const entries: unknown[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if ('first_seen_utc' in (v as Record<string, unknown>)) entries.push(v);
      else Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(root);
  const out: number[] = [];
  for (const e of entries) {
    const t = parseUtc((e as Record<string, unknown>).first_seen_utc);
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

export function parse(body: unknown, now: Date): Observation[] {
  const ts = parseTimestamps(body);
  expect(ts.length > 0 ? ts : null, 'Einträge mit first_seen_utc');
  return hourlyCounts(SIGNAL, ts, now);
}

const collector: Collector = {
  id: 'threatfox',
  title: 'abuse.ch ThreatFox (recent IOCs)',
  sourceUrl: 'https://threatfox.abuse.ch/export/',
  needsKey: 'SR_ABUSECH_KEY',
  intervalMinutes: 60,
  signals: [{
    id: SIGNAL, scenarios: ['cyber'], domain: 'threat', name: 'ThreatFox neue Indikatoren pro Stunde',
    plain: 'Wie viele neue Hinweise auf Schadsoftware-Infrastruktur (IP, Domain, Hash) pro Stunde gemeldet werden.',
    evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.45, manipulability: 'medium',
    independenceGroup: 'threatfox', unit: 'IOCs/Stunde', intervalMinutes: 60, holdHours: 6,
    baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
    license: 'CC0 (abuse.ch)',
  }],
  async collect(ctx) {
    const key = expect(ctx.key('SR_ABUSECH_KEY'), 'SR_ABUSECH_KEY');
    const body = await ctx.http.json<unknown>('https://threatfox.abuse.ch/export/json/recent/', {
      fixture: 'threatfox/export-json-recent.json', headers: { 'Auth-Key': key },
    });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
