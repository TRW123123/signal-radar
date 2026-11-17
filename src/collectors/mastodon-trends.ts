// Mastodon-Hashtag-Nutzung zu Cyber-/Ausfallthemen (Evidenzklasse D: Aufmerksamkeit, keine Messung).
// Quelle: Mastodon-API einer großen Instanz, kein Key. Doku: https://docs.joinmastodon.org/methods/tags/ und /entities/Tag/
// GET /api/v1/tags/:name liefert history[] mit {day (Unix-Sekunden als String), uses, accounts} für die letzten 7 Tage.
// Lizenz/ToS: offene API, je Instanz; es werden nur aggregierte Zähler je Hashtag gelesen, keine Konten, keine Beiträge.
// Gemessen: Summe der täglichen Nutzungen (uses) über die Hashtags in TAGS, so wie die Instanz sie sieht (lokal plus föderiert).
// Die Quelle liefert nur 7 Tage Historie; die Baseline baut sich daher erst über Wochen im Speicher auf (minPoints niedrig).
// Harmlose Ursachen für Ausschläge: Änderungen der Föderation der Instanz (neue Relays/Abos), Bot-Konten, Konferenzen,
// Wochentagsrhythmus. Der Wert hängt an EINER Instanz (INSTANCE); wechselt sie die Richtlinien, bricht die Reihe.
// Hinweis: Manche Instanzen verlangen für /api/v1/tags Login; dann schlägt der Abruf fehl und der Collector meldet nichts.
// VERIFIED: ja (17.11.2026, echte Antwort): history[] mit day (Unix-Sekunden, String), uses, accounts bestätigt; ohne Login abrufbar.
// Replay: 6 vollständige Tage (laufender Tag verworfen), Summe 834 bis 2909/Tag, Wochenende niedriger.

import type { Collector, Observation } from '../core/types.ts';
import { expect, isoDay, num, obs } from './_helpers.ts';

export const INSTANCE = 'https://mastodon.social';
export const SIGNAL_ID = 'cyber.attention.bluesky_mastodon_keywords';
/** Hashtags (ohne #, Kleinschreibung). Pro Szenario erweiterbar. */
export const TAGS = ['infosec', 'cybersecurity', 'ransomware', 'outage'];

interface Resp { history?: { day?: unknown; uses?: unknown; accounts?: unknown }[] }

/** history[] -> Map "YYYY-MM-DD" -> uses */
export function parse(body: Resp): Map<string, number> {
  const history = expect(body.history, 'history');
  const out = new Map<string, number>();
  for (const h of history) {
    const sec = num(h?.day);
    const uses = num(h?.uses);
    if (sec === null || uses === null) continue;
    out.set(isoDay(new Date(sec * 1000)), uses);
  }
  return out;
}

export function buildUrl(tag: string): string {
  return `${INSTANCE}/api/v1/tags/${encodeURIComponent(tag)}`;
}

const collector: Collector = {
  id: 'mastodon-trends',
  title: 'Mastodon Hashtag-Verlauf',
  sourceUrl: 'https://docs.joinmastodon.org/methods/tags/',
  intervalMinutes: 720,
  signals: [{
    id: SIGNAL_ID, scenarios: ['cyber'], domain: 'attention',
    name: 'Mastodon-Nutzung von Cyber-Hashtags',
    plain: 'Wie oft pro Tag die Hashtags infosec, cybersecurity, ransomware und outage auf Mastodon benutzt werden.',
    evidenceClass: 'D', direction: 'up', kind: 'count', weight: 0.25, manipulability: 'medium',
    independenceGroup: 'mastodon-trends', unit: 'Nutzungen/Tag', intervalMinutes: 1440, holdHours: 48,
    baseline: { method: 'rolling', windowDays: 56, minPoints: 14 },
    license: 'offene API, je Instanz',
    banalCauses: ['Föderationsänderungen der Instanz', 'Bot-Konten', 'Konferenzwochen'],
  }],
  async collect(ctx) {
    const today = isoDay(ctx.now);
    const perDay = new Map<string, number>();
    const seen = new Map<string, number>(); // Tag -> Anzahl Hashtags, die den Tag lieferten
    let ok = 0;
    for (const tag of TAGS) {
      try {
        const days = parse(await ctx.http.json<Resp>(buildUrl(tag), { fixture: `mastodon/tag-${tag}.json` }));
        for (const [d, v] of days) {
          perDay.set(d, (perDay.get(d) ?? 0) + v);
          seen.set(d, (seen.get(d) ?? 0) + 1);
        }
        ok++;
      } catch (e) {
        ctx.log(`Hashtag ${tag} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('mastodon-trends: kein Hashtag abrufbar');
    // Teilsumme wäre ein Scheineinbruch
    if (ok !== TAGS.length) { ctx.log('mastodon-trends: unvollständig, nichts gemeldet'); return { observations: [] }; }
    const observations: Observation[] = [];
    for (const [d, v] of [...perDay.entries()].sort()) {
      if (d >= today || seen.get(d) !== TAGS.length) continue; // laufender Tag unvollständig
      observations.push(obs(SIGNAL_ID, `${d}T00:00:00Z`, v, { tags: TAGS.length }));
    }
    return { observations };
  },
};

export default collector;
