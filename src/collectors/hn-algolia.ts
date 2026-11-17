// Hacker-News-Aufmerksamkeit zu Ausfall- und Cyberbegriffen (Evidenzklasse D: Aufmerksamkeit der Technikszene, keine Messung).
// Quelle: Hacker News Search API von Algolia, kein Key. Doku: https://hn.algolia.com/api
// Lizenz/ToS: Daten öffentlich; Algolia/HN-Nutzungsbedingungen beachten, Rate-Limit laut Doku 10 000 Anfragen/h (wir brauchen 5 pro Lauf).
// Gemessen: neue Stories pro UTC-Tag, deren TITEL einen der Begriffe in TERMS enthält, Summe über alle Begriffe
// (eine Story, die zwei Begriffe trifft, zählt doppelt; das ist für eine Baseline unkritisch, weil es konstant bleibt).
// Ablauf: pro Begriff eine Anfrage über das ganze Fenster (neueste zuerst, nur created_at_i), Tageszählung im Collector.
// Wird das Trefferlimit pro Seite erreicht, ist der älteste Tag unvollständig; er und alles davor werden verworfen.
// Harmlose Ursachen für Ausschläge: Einzelner viraler Blogpost, Großausfall eines bekannten Dienstes (dann echt, aber banal),
// Wochentag (Wochenende ruhiger), Feiertage in den USA, Konferenzen (Black Hat/DEF CON).
// VERIFIED: nein (Doku-Seite war beim Bau nicht abrufbar; Parameter und Antwortform nach Kenntnis der API, Felder hits[].created_at_i und nbHits).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, num, obs } from './_helpers.ts';

export const SIGNAL_ID = 'cyber.attention.hackernews_volume';
/** Begriffe (Titelsuche). Anführungszeichen = Phrase. */
export const TERMS = ['outage', 'cyberattack', 'ransomware', 'breach', '"is down"'];
const WINDOW_DAYS = 60;
const PAGE_SIZE = 400;

interface Resp { nbHits?: number; hits?: { created_at_i?: number }[] }

export function parseHits(body: Resp): { nbHits: number; times: number[] } {
  const hits = expect(body.hits, 'hits');
  const times: number[] = [];
  for (const h of hits) {
    const t = num(h?.created_at_i);
    if (t !== null) times.push(t * 1000);
  }
  // nbHits fehlt notfalls: dann Länge der Liste (und damit "evtl. abgeschnitten" nur über PAGE_SIZE erkennbar)
  return { nbHits: num(body.nbHits) ?? hits.length, times };
}

/**
 * Tageszählung für einen Begriff. Liefert Map Tag -> Anzahl und den ersten vollständig abgedeckten Tag
 * (Tage davor sind wegen des Seitenlimits unvollständig).
 */
export function countDays(parsed: { nbHits: number; times: number[] }, startMs: number, endMs: number, pageSize = PAGE_SIZE): { counts: Map<string, number>; coveredFrom: string } {
  const counts = new Map<string, number>();
  for (let t = startMs; t < endMs; t += DAY_MS) counts.set(isoDay(new Date(t)), 0);
  for (const t of parsed.times) {
    if (t < startMs || t >= endMs) continue;
    const k = isoDay(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let coveredFrom = isoDay(new Date(startMs));
  const truncated = parsed.times.length >= pageSize && parsed.nbHits > parsed.times.length;
  if (truncated) {
    const oldest = Math.min(...parsed.times);
    coveredFrom = isoDay(new Date(floorDay(new Date(oldest)).getTime() + DAY_MS));
  }
  return { counts, coveredFrom };
}

export function buildUrl(term: string, startSec: number, endSec: number): string {
  const filters = encodeURIComponent(`created_at_i>${startSec},created_at_i<${endSec}`);
  return `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=story&restrictSearchableAttributes=title`
    + `&numericFilters=${filters}&attributesToRetrieve=created_at_i&attributesToHighlight=none&hitsPerPage=${PAGE_SIZE}`;
}

export function fixtureName(term: string): string {
  return `hn-algolia/${term.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.json`;
}

const collector: Collector = {
  id: 'hn-algolia',
  title: 'Hacker News Algolia API',
  sourceUrl: 'https://hn.algolia.com/api',
  intervalMinutes: 720,
  signals: [{
    id: SIGNAL_ID, scenarios: ['cyber'], domain: 'attention',
    name: 'Hacker-News-Stories zu Ausfall und Cyberangriff',
    plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie outage, ransomware oder breach im Titel haben.',
    evidenceClass: 'D', direction: 'up', kind: 'count', weight: 0.4, manipulability: 'medium',
    independenceGroup: 'hn-algolia', unit: 'Stories/Tag', intervalMinutes: 1440, holdHours: 48,
    baseline: { method: 'day-of-week', windowDays: 56, minPoints: 21 },
    license: 'öffentliche Daten, Algolia/HN-ToS beachten',
    banalCauses: ['Einzelner viraler Beitrag', 'Großausfall eines bekannten Dienstes', 'Konferenzwochen'],
  }],
  async collect(ctx) {
    const end = floorDay(ctx.now); // laufender Tag wird nicht gemeldet
    const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
    const startSec = Math.floor(start.getTime() / 1000);
    const endSec = Math.floor(end.getTime() / 1000);
    const perTerm: { counts: Map<string, number>; coveredFrom: string }[] = [];
    for (const term of TERMS) {
      try {
        const body = await ctx.http.json<Resp>(buildUrl(term, startSec, endSec), { fixture: fixtureName(term) });
        perTerm.push(countDays(parseHits(body), start.getTime(), end.getTime()));
      } catch (e) {
        ctx.log(`Begriff ${term} fehlgeschlagen: ${(e as Error).message}`);
      }
    }
    // Teilsumme wäre ein Scheineinbruch: nur melden, wenn alle Begriffe geantwortet haben.
    if (perTerm.length === 0) throw new Error('hn-algolia: kein Begriff abrufbar');
    if (perTerm.length !== TERMS.length) { ctx.log('hn-algolia: unvollständig, nichts gemeldet'); return { observations: [] }; }
    const from = perTerm.map((p) => p.coveredFrom).sort().at(-1)!;
    const observations: Observation[] = [];
    for (const day of [...perTerm[0].counts.keys()].sort()) {
      if (day < from) continue;
      const sum = perTerm.reduce((s, p) => s + (p.counts.get(day) ?? 0), 0);
      observations.push(obs(SIGNAL_ID, `${day}T00:00:00Z`, sum, { terms: TERMS.length }));
    }
    return { observations };
  },
};

export default collector;
