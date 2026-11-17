// Wikipedia page views for crisis-related articles (evidence class D: public attention, not measurement).
// Source: Wikimedia Analytics REST API, no key, daily values with years of history.
// https://wikimedia.org/api/rest_v1/#/Pageviews%20data
// Reference implementation: other collectors follow this structure.
// Echte Messung (17.11.2026): einzelne Artikel haben sehr kleine Zahlen (de Cyberattacke ca. 4/Tag, vermutlich Weiterleitung,
// Notvorrat 11, Stromausfall 22; en Cyberattack 289); daher Summe über mehrere Artikel je Gruppe. Artikelnamen nach Kenntnis gewählt.
// Gruppen je Szenario: src/collectors/config/<szenario>.ts (Feld wikipedia). Höchstens MAX_ARTICLES = 6 Artikel je Gruppe (die mit
// den vermutlich meisten Aufrufen) und ein Fenster von WINDOW_DAYS = 30 Tagen: eine Antwort hat rund 145 Zeichen je Tag, also
// ca. 4 500 Zeichen (Grenze der Aufzeichnungs-Umgebung ca. 6 000). Ältere Historie baut der Speicher Lauf für Lauf auf.
// Harmlose Ursachen für war-Ausschläge: Wehrdienst-Debatten im Bundestag, Warntag, Dokumentationen/Filme, Schulstoff, Katastrophenschutz-Berichte.
// VERIFIED: nein (neue Artikelliste noch nicht aufgezeichnet; Form {"items":[{"timestamp":"2026090300","views":1}]} laut Auftrag).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, num, obs, ymd } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

/** Mindestanteil der Artikel, die in einem Lauf antworten müssen (404 = Artikel existiert nicht/ist Weiterleitung und fällt aus der Summe). */
export const MIN_ANSWER_SHARE = 0.8;
/** Höchstens so viele Artikel je Gruppe (Antwortgröße und Zahl der Requests). */
export const MAX_ARTICLES = 6;
/** Tage je Anfrage (gestern und 29 Tage davor). */
export const WINDOW_DAYS = 30;

export interface Group { signalId: string; scenario: string; project: string; articles: string[] }

/** Artikelgruppen aller Szenarien (src/collectors/config/<szenario>.ts, Feld wikipedia). */
export const ENTRIES = scenarioEntries('wikipedia');
export const GROUPS: Group[] = ENTRIES.map((e) => ({ signalId: e.signal.id, scenario: e.scenario, project: e.project, articles: e.articles.slice(0, MAX_ARTICLES) }));

const DEFAULTS = {
  domain: 'attention', evidenceClass: 'D' as const, direction: 'up' as const, kind: 'count' as const, weight: 0.5, manipulability: 'medium' as const,
  independenceGroup: 'wikimedia', unit: 'Aufrufe/Tag', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'day-of-week' as const, windowDays: 28, minPoints: 14 },
  license: 'CC0 (Wikimedia Analytics)',
};

interface Resp { items?: { timestamp: string; views: number }[] }

export function parse(body: Resp): Map<string, number> {
  const items = expect(body.items, 'items');
  const out = new Map<string, number>();
  for (const it of items) {
    const v = num(it.views);
    // timestamp format YYYYMMDD00
    if (v !== null && /^\d{10}$/.test(it.timestamp)) out.set(it.timestamp.slice(0, 8), v);
  }
  return out;
}

export function buildUrl(project: string, article: string, start: string, end: string): string {
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${encodeURIComponent(article)}/daily/${start}/${end}`;
}
/** Suffix -30d: frühere Aufzeichnungen (75 Tage) hatten denselben Namen ohne Suffix. */
export function fixtureName(project: string, article: string): string {
  return `wikimedia/${project}-${article}-${WINDOW_DAYS}d.json`;
}

const collector: Collector = {
  id: 'wikimedia-pageviews',
  title: 'Wikimedia Pageviews API',
  sourceUrl: 'https://wikimedia.org/api/rest_v1/',
  intervalMinutes: 360,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    const end = ymd(daysAgo(ctx.now, 1));
    const start = ymd(daysAgo(ctx.now, WINDOW_DAYS));
    const observations: Observation[] = [];
    for (const g of GROUPS) {
      const perDay = new Map<string, number>();
      let ok = 0;
      let gone = 0; // 404: Artikel dauerhaft nicht vorhanden
      let failed = 0; // andere Fehler (Timeout, 5xx): Lauf unsicher
      for (const article of g.articles) {
        const url = buildUrl(g.project, article, start, end);
        try {
          const days = parse(await ctx.http.json<Resp>(url, { fixture: fixtureName(g.project, article) }));
          for (const [d, v] of days) perDay.set(d, (perDay.get(d) ?? 0) + v);
          ok++;
        } catch (e) {
          const msg = (e as Error).message;
          if (/^HTTP 404\b/.test(msg)) gone++; else failed++;
          ctx.log(`Artikel ${article} übersprungen: ${msg}`);
        }
      }
      // Summe nur über Artikel, die in DIESEM Lauf antworten, wenn mindestens 80 % antworten. Fehlt ein Artikel nur wegen 404,
      // fehlt er in der ganzen Reihe (Fenster wird bei jedem Lauf neu summiert), die Reihe springt also nicht.
      // Bei anderen Fehlern (Timeout usw.) wäre die Summe nur an diesem Lauf kleiner: dann nichts melden.
      if (failed > 0 || ok / g.articles.length < MIN_ANSWER_SHARE) {
        ctx.log(`${g.signalId}: ${ok} von ${g.articles.length} Artikeln (${gone} mal 404, ${failed} Fehler), nichts gemeldet`);
        continue;
      }
      for (const [d, v] of perDay) {
        observations.push(obs(g.signalId, `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`, v, { articles: ok }));
      }
    }
    return { observations };
  },
};

export default collector;
