// Prognosemärkte zu Cyberereignissen (Polymarket). Märkte zu Cyber-Themen sind selten; der Collector meldet nichts,
// wenn kein offener Markt zu den Suchbegriffen passt.
// Quelle: Polymarket Gamma API, kein Key. Doku: https://docs.polymarket.com/ (Endpunkt /public-search)
// Lizenz/ToS: Polymarket-Nutzungsbedingungen; Nutzung in einigen Ländern eingeschränkt (hier nur lesend, öffentliche Marktdaten).
// Gemessen (je Lauf, Momentaufnahme): über alle gefundenen, offenen Märkte
//   1. höchste Ja-Wahrscheinlichkeit in Prozent (Preis des Ergebnisses "Yes"),
//   2. Summe des 24-Stunden-Handelsvolumens in US-Dollar (volume24hr); das Gesamtvolumen (volumeNum) steht in meta.
// Gefunden wird per Textsuche (Suchbegriffe je Szenario in src/collectors/config/<szenario>.ts, Feld polymarket) und zusätzlich über
// den Fragetext gefiltert (match), weil die Volltextsuche auch Ereignisse mit nur teilweise passenden Märkten liefert.
// Harmlose Ursachen für Ausschläge: wenige, dünn gehandelte Märkte (ein einzelner Großhändler bewegt den Preis),
// Auslauf/Neuaufnahme eines Marktes (Sprung in der Zusammensetzung), virale Nachricht.
// Echte Antworten (17.11.2026): Form events[].markets[] bestätigt, outcomes/outcomePrices sind JSON-Strings. Ein Ereignis mit
// allen Märkten, Beschreibungen und Tags wiegt 8 bis 17 kB; mit limit_per_type=5 waren Antworten 29 bis 86 kB (zu groß für die
// Prüf-Umgebung), daher limit_per_type=1 (nur der beste Treffer je Begriff; Nachteil: weitere passende Ereignisse fallen weg).
// events_status=active filtert nicht zuverlässig: Treffer können archived=true/active=false sein (werden übersprungen).
// Größe: keep_closed_markets=0 (geschlossene Märkte eines Ereignisses entfallen, die der Parser ohnehin überspringt) sowie
// search_tags=false und search_profiles=false (keine Tag- und Profil-Treffer) sollen die Antwort unter ca. 6 000 Zeichen halten;
// die Parameter stehen in der Doku zu /public-search, ihre Wirkung auf die Größe ist ungeprüft. Ereignisse mit vielen offenen
// Märkten (z. B. Datumsstaffeln) können trotzdem größer sein.
// Szenario war: eigene Suchbegriffe und eigener Fragetext-Filter, Signale war.attention.prediction_markets_war (höchste
// Ja-Wahrscheinlichkeit) und war.attention.prediction_volume_spike (24-Stunden-Volumen), nur Aggregat über Märkte, keine Konten.
// Harmlose Ursachen (war): neue/auslaufende Märkte, Sportmärkte mit Ländernamen (Filter dagegen nur grob), dünne Liquidität.
// VERIFIED: teilweise (17.11.2026: Parser gegen echte, vollständige Antwort geprüft; die Antworten mit limit_per_type=1 stehen
// noch zur Aufzeichnung aus, nur "cyber attack" (1 irrelevanter, archivierter Treffer) und "cyberattack" (0 Treffer) liegen vor).

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

/** Suchen aller Szenarien (src/collectors/config/<szenario>.ts, Feld polymarket). */
const ENTRIES = scenarioEntries('polymarket');
const SCENARIO_CFG = ENTRIES.map((e) => ({ scenario: e.scenario, terms: e.terms, match: e.match, yesId: e.yesSignal.id, volId: e.volumeSignal.id }));
/** Suchbegriffe je Szenario (aus der Konfiguration). */
export const SEARCH_TERMS: Record<string, string[]> = {};
/** Fragetext-Filter je Szenario (aus der Konfiguration). */
export const MATCH: Record<string, RegExp> = {};
for (const e of ENTRIES) { (SEARCH_TERMS[e.scenario] ??= []).push(...e.terms); MATCH[e.scenario] ??= e.match; }

const DEFAULTS = {
  kind: 'gauge' as const, manipulability: 'high' as const, independenceGroup: 'polymarket-gamma', intervalMinutes: 360, holdHours: 24,
  baseline: { method: 'rolling' as const, windowDays: 56, minPoints: 14 },
  license: 'Polymarket ToS; Nutzung in einigen Ländern eingeschränkt',
};

export interface Market { id: string; question: string; yes: number | null; volume24h: number; volumeTotal: number }

interface RawMarket {
  id?: unknown; question?: unknown; outcomes?: unknown; outcomePrices?: unknown;
  volumeNum?: unknown; volume?: unknown; volume24hr?: unknown; closed?: unknown; active?: unknown; archived?: unknown;
}
interface Resp { events?: { markets?: RawMarket[] }[] }

function jsonArray(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') { try { const v = JSON.parse(x); return Array.isArray(v) ? v : null; } catch { return null; } }
  return null;
}

/** Offene Märkte aus einer public-search-Antwort. */
export function parse(body: Resp): Market[] {
  const events = expect(body.events, 'events');
  const out: Market[] = [];
  for (const ev of events) {
    for (const m of ev?.markets ?? []) {
      if (m.closed === true || m.active === false || m.archived === true) continue;
      const question = typeof m.question === 'string' ? m.question : '';
      const id = m.id !== undefined ? String(m.id) : question;
      if (!question) continue;
      const outcomes = jsonArray(m.outcomes);
      const prices = jsonArray(m.outcomePrices);
      let yes: number | null = null;
      if (outcomes && prices) {
        const i = outcomes.findIndex((o) => String(o).toLowerCase() === 'yes');
        const p = i >= 0 ? num(prices[i]) : null;
        if (p !== null && p >= 0 && p <= 1) yes = p * 100;
      }
      out.push({ id, question, yes, volume24h: num(m.volume24hr) ?? 0, volumeTotal: num(m.volumeNum) ?? num(m.volume) ?? 0 });
    }
  }
  return out;
}

/** Dedupliziert nach id und filtert auf den Fragetext. */
export function select(markets: Market[], match: RegExp): Market[] {
  const byId = new Map<string, Market>();
  for (const m of markets) if (match.test(m.question)) byId.set(m.id, m);
  return [...byId.values()];
}

export function buildUrl(term: string): string {
  return `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(term)}&limit_per_type=1&events_status=active&keep_closed_markets=0&search_tags=false&search_profiles=false`;
}
export function fixtureName(term: string): string {
  return `polymarket/search-${term.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-open.json`;
}

const collector: Collector = {
  id: 'polymarket-gamma',
  title: 'Polymarket Gamma API',
  sourceUrl: 'https://docs.polymarket.com/',
  intervalMinutes: 360,
  signals: ENTRIES.flatMap((e) => [declare(DEFAULTS, e.scenario, e.yesSignal), declare(DEFAULTS, e.scenario, e.volumeSignal)]),
  async collect(ctx) {
    const ts = floorHour(ctx.now);
    const observations: Observation[] = [];
    let answered = 0;
    // Ein Begriff in mehreren Szenarien wird je Lauf nur einmal abgefragt.
    const cache = new Map<string, Promise<Market[]>>();
    const search = (term: string) => {
      if (!cache.has(term)) cache.set(term, ctx.http.json<Resp>(buildUrl(term), { fixture: fixtureName(term) }).then(parse));
      return cache.get(term)!;
    };
    for (const cfg of SCENARIO_CFG) {
      const all: Market[] = [];
      let ok = 0;
      for (const term of cfg.terms) {
        try {
          all.push(...(await search(term)));
          ok++;
        } catch (e) {
          ctx.log(`Suchbegriff ${term} (${cfg.scenario}) fehlgeschlagen: ${(e as Error).message}`);
        }
      }
      if (ok === 0) continue;
      answered++;
      // Ein fehlender Begriff würde Markt-Zusammensetzung und Volumen verfälschen: dann nichts melden.
      if (ok !== cfg.terms.length) { ctx.log(`polymarket-gamma ${cfg.scenario}: unvollständig, nichts gemeldet`); continue; }
      const markets = select(all, cfg.match);
      if (markets.length === 0) continue;
      const yes = markets.filter((m) => m.yes !== null);
      if (yes.length) {
        const top = yes.reduce((a, b) => ((b.yes as number) > (a.yes as number) ? b : a));
        observations.push(obs(cfg.yesId, ts, top.yes as number, { question: top.question, markets: markets.length }));
      }
      observations.push(obs(cfg.volId, ts, markets.reduce((s, m) => s + m.volume24h, 0), {
        markets: markets.length, volumeTotal: markets.reduce((s, m) => s + m.volumeTotal, 0),
      }));
    }
    if (answered === 0) throw new Error('polymarket-gamma: keine Suche beantwortet');
    return { observations };
  },
};

export default collector;
