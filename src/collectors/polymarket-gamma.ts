// Prognosemärkte zu Cyberereignissen (Polymarket). Märkte zu Cyber-Themen sind selten; der Collector meldet nichts,
// wenn kein offener Markt zu den Suchbegriffen passt.
// Quelle: Polymarket Gamma API, kein Key. Doku: https://docs.polymarket.com/ (Endpunkt /public-search)
// Lizenz/ToS: Polymarket-Nutzungsbedingungen; Nutzung in einigen Ländern eingeschränkt (hier nur lesend, öffentliche Marktdaten).
// Gemessen (je Lauf, Momentaufnahme): über alle gefundenen, offenen Märkte
//   1. höchste Ja-Wahrscheinlichkeit in Prozent (Preis des Ergebnisses "Yes"),
//   2. Summe des 24-Stunden-Handelsvolumens in US-Dollar (volume24hr); das Gesamtvolumen (volumeNum) steht in meta.
// Gefunden wird per Textsuche (SEARCH_TERMS je Szenario, Datei-Konstante) und zusätzlich über den Fragetext gefiltert
// (MATCH), weil die Volltextsuche auch Ereignisse mit nur teilweise passenden Märkten liefert.
// Harmlose Ursachen für Ausschläge: wenige, dünn gehandelte Märkte (ein einzelner Großhändler bewegt den Preis),
// Auslauf/Neuaufnahme eines Marktes (Sprung in der Zusammensetzung), virale Nachricht.
// VERIFIED: nein (Doku nicht abrufbar; Parameter q, limit_per_type, events_status und Feldnamen nach Kenntnis;
// outcomes/outcomePrices sind JSON-Strings innerhalb des JSON). Der Katalog-Hinweis, tag_slug filtere nicht, ist berücksichtigt.

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

/** Suchbegriffe je Szenario. Neues Szenario = neuer Eintrag. */
export const SEARCH_TERMS: Record<string, string[]> = {
  cyber: ['cyberattack', 'cyber attack', 'ransomware', 'hack', 'internet outage'],
};
/** Fragetext muss einen dieser Ausdrücke enthalten (je Szenario). */
export const MATCH: Record<string, RegExp> = {
  cyber: /cyber|ransomware|hack|outage|blackout|power grid|data breach/i,
};
export const SCENARIO = 'cyber';

export interface Market { id: string; question: string; yes: number | null; volume24h: number; volumeTotal: number }

interface RawMarket {
  id?: unknown; question?: unknown; outcomes?: unknown; outcomePrices?: unknown;
  volumeNum?: unknown; volume?: unknown; volume24hr?: unknown; closed?: unknown; active?: unknown;
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
      if (m.closed === true || m.active === false) continue;
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
  return `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(term)}&limit_per_type=5&events_status=active`;
}
export function fixtureName(term: string): string {
  return `polymarket/search-${term.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.json`;
}

const collector: Collector = {
  id: 'polymarket-gamma',
  title: 'Polymarket Gamma API',
  sourceUrl: 'https://docs.polymarket.com/',
  intervalMinutes: 360,
  signals: [
    {
      id: 'cyber.markets.polymarket_cyber', scenarios: ['cyber'], domain: 'markets',
      name: 'Prognosemarkt: höchste Ja-Wahrscheinlichkeit zu Cyberereignissen',
      plain: 'Die höchste Wahrscheinlichkeit, die Wettende auf Polymarket einem Cyberangriff oder Großausfall geben (nur wenn ein passender Markt existiert).',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.35, manipulability: 'high',
      independenceGroup: 'polymarket-gamma', unit: '%', intervalMinutes: 360, holdHours: 24,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 14 },
      license: 'Polymarket ToS; Nutzung in einigen Ländern eingeschränkt',
      banalCauses: ['Geringe Liquidität', 'Einzelne Großhändler', 'Wechsel der gefundenen Märkte'],
    },
    {
      id: 'cyber.markets.market_volume_cyber', scenarios: ['cyber'], domain: 'markets',
      name: 'Handelsvolumen in Cyber-Prognosemärkten (24 Stunden)',
      plain: 'Wie viel in den letzten 24 Stunden auf Cyberangriffe und Großausfälle gewettet wurde.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.2, manipulability: 'high',
      independenceGroup: 'polymarket-gamma', unit: 'USD/24h', intervalMinutes: 360, holdHours: 24,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 14 },
      license: 'Polymarket ToS; Nutzung in einigen Ländern eingeschränkt',
      banalCauses: ['Virale Nachricht', 'Neuer Markt in der Trefferliste'],
    },
  ],
  async collect(ctx) {
    const terms = SEARCH_TERMS[SCENARIO];
    const match = MATCH[SCENARIO];
    const all: Market[] = [];
    let ok = 0;
    for (const term of terms) {
      try {
        all.push(...parse(await ctx.http.json<Resp>(buildUrl(term), { fixture: fixtureName(term) })));
        ok++;
      } catch (e) {
        ctx.log(`Suchbegriff ${term} fehlgeschlagen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('polymarket-gamma: keine Suche beantwortet');
    // Ein fehlender Begriff würde Markt-Zusammensetzung und Volumen verfälschen: dann nichts melden.
    if (ok !== terms.length) { ctx.log('polymarket-gamma: unvollständig, nichts gemeldet'); return { observations: [] }; }
    const markets = select(all, match);
    if (markets.length === 0) return { observations: [] };
    const ts = floorHour(ctx.now);
    const observations: Observation[] = [];
    const yes = markets.filter((m) => m.yes !== null);
    if (yes.length) {
      const top = yes.reduce((a, b) => ((b.yes as number) > (a.yes as number) ? b : a));
      observations.push(obs('cyber.markets.polymarket_cyber', ts, top.yes as number, { question: top.question, markets: markets.length }));
    }
    observations.push(obs('cyber.markets.market_volume_cyber', ts, markets.reduce((s, m) => s + m.volume24h, 0), {
      markets: markets.length, volumeTotal: markets.reduce((s, m) => s + m.volumeTotal, 0),
    }));
    return { observations };
  },
};

export default collector;
