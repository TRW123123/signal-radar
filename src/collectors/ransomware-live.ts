// ransomware.live: neu auf Leak-Seiten veröffentlichte Opfer pro Tag und Zahl aktiver Gruppen (Klasse B: Selbstauskunft der Täter).
// Quelle: https://api.ransomware.live/v2/recentvictims (Liste der zuletzt entdeckten Opfer)
// Doku: https://www.ransomware.live/apidocs (Repo: https://github.com/JMousqueton/api.ransomware.live)
// Lizenz: laut Seite CC BY-NC-SA (nicht-kommerziell, Namensnennung: ransomware.live). Vor kommerzieller Nutzung prüfen.
// Datenschutz: es werden ausschließlich Zählwerte gespeichert. Opfer- und Gruppennamen landen weder in Observations
//              noch in `meta`; Gruppen werden nur im Speicher für die Zählung unterschieden.
// Gemessen: (1) Opfer je UTC-Tag aus `discovered`, (2) verschiedene Gruppen mit mindestens einem Post je Tag.
//           recentvictims ist eine begrenzte Liste (nur die jüngsten Einträge): es werden nur Tage gemeldet, die
//           vollständig in der Antwort liegen (nach dem ältesten Tag, vor heute). Die Historie baut sich so über Läufe auf.
// Harmlose Ursachen: Wochenmuster, Gruppen-Rebranding, Abrechnungswellen, Aufholen der Datenbank nach Ausfällen.
// Ausgelassen: Sektor-/Länder-Signale (Sektorfeld uneinheitlich, kleine Zahlen), Opfer-Cluster nach Software.
// VERIFIED: nein (Feldnamen nach Gedächtnis: discovered "YYYY-MM-DD HH:MM:SS(.ffffff)", group; Ratenlimit unbekannt).

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
    out.push({ ts, group: typeof rec.group === 'string' && rec.group !== '' ? rec.group.toLowerCase() : null });
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
  title: 'ransomware.live (recentvictims)',
  sourceUrl: 'https://www.ransomware.live/apidocs',
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
    const body = await ctx.http.json<unknown>('https://api.ransomware.live/v2/recentvictims', {
      fixture: 'ransomware-live/recentvictims.json',
    });
    return { observations: parse(body, ctx.now) };
  },
};

export default collector;
