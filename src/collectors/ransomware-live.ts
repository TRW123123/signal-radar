// ransomware.live: neu auf Leak-Seiten veröffentlichte Opfer pro Tag und Zahl aktiver Gruppen (Klasse B: Selbstauskunft der Täter).
// Quelle: https://data.ransomware.live/<Jahr>-victims.json (Jahresarchiv aller Opfer; die freie API /v2/recentvictims ist seit 11/2026 weg, 404)
// Doku: https://data.ransomware.live/ (Datensatz-Downloads)
// Lizenz: laut Seite CC BY-NC-SA (nicht-kommerziell, Namensnennung: ransomware.live). Vor kommerzieller Nutzung prüfen.
// Datenschutz: es werden ausschließlich Zählwerte gespeichert. Opfer- und Gruppennamen landen weder in Observations
//              noch in `meta`; Gruppen werden nur im Speicher für die Zählung unterschieden.
// Gemessen: (1) Opfer je UTC-Tag aus `discovered`, (2) verschiedene Gruppen mit mindestens einem Post je Tag.
//           recentvictims ist eine begrenzte Liste (nur die jüngsten Einträge): es werden nur Tage gemeldet, die
//           vollständig in der Antwort liegen (nach dem ältesten Tag, vor heute). Die Historie baut sich so über Läufe auf.
// Harmlose Ursachen: Wochenmuster, Gruppen-Rebranding, Abrechnungswellen, Aufholen der Datenbank nach Ausfällen.
// Ausgelassen: Sektor-/Länder-Signale (Sektorfeld uneinheitlich, kleine Zahlen), Opfer-Cluster nach Software.
// Echte Form (17.11.2026, echte Antwort): Array mit {post_title, group_name, discovered "2026-11-16T19:36:14.075930+00:00", published, website, country, activity, description, post_url}.
//   Das Jahresarchiv ist ca. 7 MB groß; gelesen werden nur `discovered` und `group_name`. Die Datei enthält Opfernamen, gespeichert wird nichts davon.
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const DAY = 86400_000;
const POSTS = 'cyber.threat.leak_posts_daily';
const GROUPS = 'cyber.threat.ransomware_active_groups';

export interface VictimStamp { ts: number; group: string | null }

function parseUtc(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Nur Zeitstempel und Gruppenkennung; alles andere (Opfername, URL, Beschreibung) wird nie gelesen. */
export function parseVictims(body: unknown): VictimStamp[] {
  const list = Array.isArray(body) ? body : (body as { victims?: unknown } | null)?.victims;
  const arr = expect(Array.isArray(list) ? list : null, 'Liste der Opfer');
  const out: VictimStamp[] = [];
  for (const v of arr) {
    const rec = (v ?? {}) as Record<string, unknown>;
    const ts = parseUtc(rec.discovered);
    if (ts === null) continue;
    out.push({ ts, group: (() => { const g = rec.group_name ?? rec.group; return typeof g === 'string' && g !== '' ? g.toLowerCase() : null; })() });
  }
  return out;
}

/** Tageswerte für vollständig abgedeckte UTC-Tage: nach dem ältesten Tag der Antwort, vor dem laufenden Tag. */
export function dailySignals(victims: VictimStamp[], now: Date): Observation[] {
  if (victims.length < 2) return [];
  const first = Math.floor(Math.min(...victims.map((v) => v.ts)) / DAY) * DAY + DAY;
  const last = Math.floor(now.getTime() / DAY) * DAY;
  const posts = new Map<number, number>();
  const groups = new Map<number, Set<string>>();
  for (let d = first; d < last; d += DAY) { posts.set(d, 0); groups.set(d, new Set()); }
  for (const v of victims) {
    const d = Math.floor(v.ts / DAY) * DAY;
    if (!posts.has(d)) continue;
    posts.set(d, posts.get(d)! + 1);
    if (v.group) groups.get(d)!.add(v.group);
  }
  const days = [...posts.keys()].sort((a, b) => a - b);
  return [
    ...days.map((d) => obs(POSTS, d, posts.get(d)!)),
    ...days.map((d) => obs(GROUPS, d, groups.get(d)!.size)),
  ];
}

export function parse(body: unknown, now: Date): Observation[] {
  return dailySignals(parseVictims(body), now);
}

const collector: Collector = {
  id: 'ransomware-live',
  title: 'ransomware.live (Jahresarchiv)',
  sourceUrl: 'https://data.ransomware.live/',
  intervalMinutes: 360,
  signals: [
    {
      id: POSTS, scenarios: ['cyber'], domain: 'threat', name: 'Ransomware-Leak-Posts pro Tag',
      plain: 'Wie viele neue Opfer Erpresser-Gruppen pro Tag auf ihren Leak-Seiten nennen (nur gezählt, keine Namen).',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.6, manipulability: 'medium',
      independenceGroup: 'ransomware-live', unit: 'Opfer/Tag', intervalMinutes: 1440, holdHours: 72,
      baseline: { method: 'day-of-week', windowDays: 56, minPoints: 21 },
      license: 'CC BY-NC-SA (laut ransomware.live)',
    },
    {
      id: GROUPS, scenarios: ['cyber'], domain: 'threat', name: 'Aktive Ransomware-Gruppen pro Tag',
      plain: 'Wie viele verschiedene Erpresser-Gruppen pro Tag mindestens ein neues Opfer veröffentlichen.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.35, manipulability: 'medium',
      independenceGroup: 'ransomware-live', unit: 'Gruppen/Tag', intervalMinutes: 1440, holdHours: 72,
      baseline: { method: 'day-of-week', windowDays: 56, minPoints: 21 },
      license: 'CC BY-NC-SA (laut ransomware.live)',
    },
  ],
  async collect(ctx) {
    const year = ctx.now.getUTCFullYear();
    const body = await ctx.http.json<unknown>(`https://data.ransomware.live/${year}-victims.json`, {
      fixture: 'ransomware-live/recentvictims.json',
    });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
