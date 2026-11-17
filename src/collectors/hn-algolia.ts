// Hacker-News-Aufmerksamkeit zu Begriffen der Szenarien (Evidenzklasse D: Aufmerksamkeit der Technikszene, keine Messung).
// Quelle: Hacker News Search API von Algolia, kein Key. Doku: https://hn.algolia.com/api
// Lizenz/ToS: Daten öffentlich; Algolia/HN-Nutzungsbedingungen beachten, Rate-Limit laut Doku 10 000 Anfragen/h (wir brauchen 11 pro Lauf).
// Gemessen: neue Stories der letzten 24 Stunden (voller UTC-Vortag), deren TITEL einen der Begriffe enthält, Summe über alle Begriffe
// einer Gruppe (eine Story, die zwei Begriffe trifft, zählt doppelt; für eine Baseline unkritisch, weil es konstant bleibt).
// Ablauf: je Begriff eine Anfrage mit hitsPerPage=0 und Zeitfilter; gelesen wird nur `nbHits` (Antwort ca. 500 Zeichen statt bis zu
// 20 000 mit Trefferliste). Keine Historie: ein Wert je Lauf und Tag, die Baseline baut sich über die Läufe auf.
// Begriffsgruppen je Szenario: src/collectors/config/<szenario>.ts (Feld hackerNews).
// Harmlose Ursachen für Ausschläge: Einzelner viraler Blogpost, Großausfall eines bekannten Dienstes (dann echt, aber banal),
// Wochentag (Wochenende ruhiger), Feiertage in den USA, Konferenzen (Black Hat/DEF CON); war: Meinungsbeiträge, Dokumentationen,
// Jahrestage, Technik-Beiträge zu Drohnen/GNSS ohne Kriegsbezug.
// VERIFIED: teilweise (17.11.2026: Form hits[]/nbHits mit echter Antwort bestätigt, aber mit Trefferliste; die Anfrage mit
// hitsPerPage=0 und Tagesfenster steht zur Aufzeichnung aus).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

/** Begriffsgruppen aller Szenarien. */
const ENTRIES = scenarioEntries('hackerNews');
export interface Group { scenario: string; signalId: string; terms: string[]; prefix: string }
export const GROUPS: Group[] = ENTRIES.map((e) => ({ scenario: e.scenario, signalId: e.signal.id, terms: e.terms, prefix: e.fixturePrefix }));

const DEFAULTS = {
  domain: 'attention', evidenceClass: 'D' as const, direction: 'up' as const, kind: 'count' as const, manipulability: 'medium' as const,
  independenceGroup: 'hn-algolia', unit: 'Stories/Tag', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  license: 'öffentliche Daten, Algolia/HN-ToS beachten',
};

interface Resp { nbHits?: unknown }

/** Trefferzahl einer Suche mit hitsPerPage=0. */
export function parseNbHits(body: Resp): number {
  const n = expect(num(body?.nbHits), 'nbHits');
  if (n < 0) throw new Error('unerwartete Antwort: nbHits negativ');
  return n;
}

/** Suche nach Stories mit dem Begriff im Titel, erstellt in [startSec, endSec). Keine Trefferliste, nur nbHits. */
export function buildUrl(term: string, startSec: number, endSec: number): string {
  const filters = encodeURIComponent(`created_at_i>=${startSec},created_at_i<${endSec}`);
  return `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&tags=story&restrictSearchableAttributes=title`
    + `&numericFilters=${filters}&hitsPerPage=0`;
}

/** Suffix -24h: frühere Aufzeichnungen (60 Tage mit Trefferliste) hatten denselben Namen ohne Suffix. */
export function fixtureName(term: string, prefix = ''): string {
  return `hn-algolia/${prefix}${term.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-24h.json`;
}

const collector: Collector = {
  id: 'hn-algolia',
  title: 'Hacker News Algolia API',
  sourceUrl: 'https://hn.algolia.com/api',
  intervalMinutes: 720,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    const end = floorDay(ctx.now); // laufender Tag wird nicht gemeldet
    const start = new Date(end.getTime() - DAY_MS);
    const startSec = start.getTime() / 1000;
    const endSec = end.getTime() / 1000;
    const observations: Observation[] = [];
    let answered = 0;
    for (const g of GROUPS) {
      let sum = 0;
      let ok = 0;
      for (const term of g.terms) {
        try {
          sum += parseNbHits(await ctx.http.json<Resp>(buildUrl(term, startSec, endSec), { fixture: fixtureName(term, g.prefix) }));
          ok++;
        } catch (e) {
          ctx.log(`Begriff ${term} (${g.scenario}) fehlgeschlagen: ${(e as Error).message}`);
        }
      }
      if (ok === 0) continue;
      answered++;
      // Teilsumme wäre ein Scheineinbruch: nur melden, wenn alle Begriffe geantwortet haben.
      if (ok !== g.terms.length) { ctx.log(`hn-algolia ${g.scenario}: unvollständig, nichts gemeldet`); continue; }
      observations.push(obs(g.signalId, `${isoDay(start)}T00:00:00Z`, sum, { terms: g.terms.length }));
    }
    if (GROUPS.length && answered === 0) throw new Error('hn-algolia: kein Begriff abrufbar');
    return { observations };
  },
};

export default collector;
