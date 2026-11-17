// Hacker-News-Aufmerksamkeit zu Ausfall- und Cyberbegriffen (Evidenzklasse D: Aufmerksamkeit der Technikszene, keine Messung).
// Quelle: Hacker News Search API von Algolia, kein Key. Doku: https://hn.algolia.com/api
// Lizenz/ToS: Daten öffentlich; Algolia/HN-Nutzungsbedingungen beachten, Rate-Limit laut Doku 10 000 Anfragen/h (wir brauchen 5 pro Lauf).
// Gemessen: neue Stories pro UTC-Tag, deren TITEL einen der Begriffe in TERMS enthält, Summe über alle Begriffe
// (eine Story, die zwei Begriffe trifft, zählt doppelt; das ist für eine Baseline unkritisch, weil es konstant bleibt).
// Ablauf: pro Begriff eine Anfrage über das ganze Fenster (neueste zuerst, nur created_at_i), Tageszählung im Collector.
// Wird das Trefferlimit pro Seite erreicht, ist der älteste Tag unvollständig; er und alles davor werden verworfen.
// Harmlose Ursachen für Ausschläge: Einzelner viraler Blogpost, Großausfall eines bekannten Dienstes (dann echt, aber banal),
// Wochentag (Wochenende ruhiger), Feiertage in den USA, Konferenzen (Black Hat/DEF CON).
// Szenario war: eigene Begriffsliste WAR_TERMS (Titelsuche, Summe wie oben), Signal war.attention.hackernews_mentions. Eigene, kleinere
// Seitengröße (300 statt 400 Treffer, rund 48 Zeichen je Treffer, damit die Antwort unter 20 000 Zeichen bleibt); die Cyber-Anfragen bleiben unverändert.
// Harmlose Ursachen (war): Meinungsbeiträge, Dokumentationen, Jahrestage, Technik-Beiträge zu Drohnen/GNSS ohne Kriegsbezug. VERIFIED (war): nein.
// VERIFIED: ja (17.11.2026, echte Antwort): Form hits[].created_at_i/nbHits bestätigt, alle 5 Begriffe vollständig (nbHits 24 bis 171 < 400),
// Replay liefert 60 Tageswerte (zuletzt 27, 9, 8, 25 Stories/Tag, Wochenende ruhiger).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, num, obs } from './_helpers.ts';

export const SIGNAL_ID = 'cyber.attention.hackernews_volume';
/** Begriffe (Titelsuche). Anführungszeichen = Phrase. */
export const TERMS = ['outage', 'cyberattack', 'ransomware', 'breach', '"is down"'];
/** Kriegsbegriffe (Titelsuche); eigene Fixture-Namen mit Präfix war-. */
export const WAR_TERMS = ['"world war"', '"nuclear war"', 'Hormuz', '"Taiwan Strait"', 'conscription', '"missile strike"'];
export const WAR_SIGNAL_ID = 'war.attention.hackernews_mentions';
const WINDOW_DAYS = 60;
const PAGE_SIZE = 400;
const WAR_PAGE_SIZE = 300;

interface Group { scenario: string; signalId: string; terms: string[]; pageSize: number; prefix: string }
const GROUPS: Group[] = [
  { scenario: 'cyber', signalId: SIGNAL_ID, terms: TERMS, pageSize: PAGE_SIZE, prefix: '' },
  { scenario: 'war', signalId: WAR_SIGNAL_ID, terms: WAR_TERMS, pageSize: WAR_PAGE_SIZE, prefix: 'war-' },
];

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

export function buildUrl(term: string, startSec: number, endSec: number, pageSize = PAGE_SIZE): string {
  const filters = encodeURIComponent(`created_at_i>${startSec},created_at_i<${endSec}`);
  return `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=story&restrictSearchableAttributes=title`
    + `&numericFilters=${filters}&attributesToRetrieve=created_at_i&attributesToHighlight=none&hitsPerPage=${pageSize}`;
}

export function fixtureName(term: string, prefix = ''): string {
  return `hn-algolia/${prefix}${term.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.json`;
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
  }, {
    id: WAR_SIGNAL_ID, scenarios: ['war'], domain: 'attention',
    name: 'Hacker-News-Stories zu Krieg und Eskalation',
    plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie World War, nuclear war oder Hormuz im Titel haben.',
    evidenceClass: 'D', direction: 'up', kind: 'count', weight: 0.35, manipulability: 'medium',
    independenceGroup: 'hn-algolia', unit: 'Stories/Tag', intervalMinutes: 1440, holdHours: 48,
    baseline: { method: 'day-of-week', windowDays: 56, minPoints: 21 },
    license: 'öffentliche Daten, Algolia/HN-ToS beachten',
    banalCauses: ['Meinungsbeiträge', 'Dokumentationen und Jahrestage', 'Nachrichten-Spitzen'],
  }],
  async collect(ctx) {
    const end = floorDay(ctx.now); // laufender Tag wird nicht gemeldet
    const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
    const startSec = Math.floor(start.getTime() / 1000);
    const endSec = Math.floor(end.getTime() / 1000);
    const observations: Observation[] = [];
    let answered = 0;
    for (const g of GROUPS) {
      const perTerm: { counts: Map<string, number>; coveredFrom: string }[] = [];
      for (const term of g.terms) {
        try {
          const body = await ctx.http.json<Resp>(buildUrl(term, startSec, endSec, g.pageSize), { fixture: fixtureName(term, g.prefix) });
          perTerm.push(countDays(parseHits(body), start.getTime(), end.getTime(), g.pageSize));
        } catch (e) {
          ctx.log(`Begriff ${term} (${g.scenario}) fehlgeschlagen: ${(e as Error).message}`);
        }
      }
      if (perTerm.length === 0) continue;
      answered++;
      // Teilsumme wäre ein Scheineinbruch: nur melden, wenn alle Begriffe geantwortet haben.
      if (perTerm.length !== g.terms.length) { ctx.log(`hn-algolia ${g.scenario}: unvollständig, nichts gemeldet`); continue; }
      const from = perTerm.map((p) => p.coveredFrom).sort().at(-1)!;
      for (const day of [...perTerm[0].counts.keys()].sort()) {
        if (day < from) continue;
        const sum = perTerm.reduce((s, p) => s + (p.counts.get(day) ?? 0), 0);
        observations.push(obs(g.signalId, `${day}T00:00:00Z`, sum, { terms: g.terms.length }));
      }
    }
    if (answered === 0) throw new Error('hn-algolia: kein Begriff abrufbar');
    return { observations };
  },
};

export default collector;
