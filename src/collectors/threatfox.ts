// abuse.ch ThreatFox: neu gemeldete Indikatoren (IOCs: IP:Port, Domain, URL, Hash) pro Stunde (Klasse A).
// Quelle: https://threatfox-api.abuse.ch/files/exports/recent.json?auth-key=KEY (JSON-Export der jüngsten IOCs;
//         der alte Pfad https://threatfox.abuse.ch/export/json/recent/ liefert HTTP 410)
// Doku: https://threatfox.abuse.ch/api/ und https://threatfox.abuse.ch/export/
// Lizenz: Daten laut abuse.ch CC0, aber Nutzungsbedingungen (gelesen 17.11.2026): kostenlos nur nicht-gewinnorientiert, moderates Polling,
//   kein Massen-Harvesting, KI-Training nur mit Zustimmung; Quelle abuse.ch nennen. Pflichtangaben: src/core/attribution.ts, docs/DATA-TERMS.md.
// Auth: abuse.ch verlangt seit 2025 Auth-Keys ("Community First", https://auth.abuse.ch/). Die Quelle antwortet ohne Key mit HTTP 410 (17.11.2026, Aufzeichnung);
//       needsKey ist richtig. Key als Query-Parameter auth-key (Header Auth-Key liefert auf den neuen Datei-Exporten HTTP 401).
// Gemessen: IOCs je voller UTC-Stunde aus `first_seen_utc`, nur Einträge der letzten 30 Tage (ab now - 30 × 24 h; ältere
//         werden ignoriert, der Export reicht bis 2021 zurück); älteste Stunde im Fenster und laufende Stunde entfallen.
// Harmlose Ursachen: Import-Batches einzelner Melder, Massenmeldung einer Familie, Quellenausfall (Lücke).
// Ausgelassen: cyber.threat.c2_hosting_concentration (braucht Hoster-Zuordnung, nicht in diesem Export).
// VERIFIED: nein (17.11.2026: ohne Key HTTP 410, keine echte Antwort; Form nach Gedächtnis: Objekt { "<ioc_id>": [ { first_seen_utc, ... } ] }; Array wird ebenfalls akzeptiert).

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const SIGNAL = 'cyber.threat.threatfox_ioc_volume';
const HOUR = 3600_000;
const WINDOW_MS = 30 * 24 * HOUR;

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
  const cutoff = now.getTime() - WINDOW_MS;
  return hourlyCounts(SIGNAL, ts.filter((t) => t >= cutoff), now);
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
    license: 'abuse.ch-Nutzungsbedingungen: kostenlos nur nicht-gewinnorientiert, moderates Polling; Quelle abuse.ch nennen (Daten laut abuse.ch CC0)',
  }],
  async collect(ctx) {
    const key = expect(ctx.key('SR_ABUSECH_KEY'), 'SR_ABUSECH_KEY');
    const url = new URL('https://threatfox-api.abuse.ch/files/exports/recent.json');
    url.searchParams.set('auth-key', key);
    const body = await ctx.http.json<unknown>(url.toString(), {
      fixture: 'threatfox/export-json-recent.json', timeoutMs: 60_000,
    });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
