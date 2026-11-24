// Szenario ai: Konfiguration der geteilten Collectors. Anleitung: docs/SCENARIO-CONFIG-GUIDE.md
// Stand 24.11.2026. Wikipedia (attention, Klasse D): englische Artikel zu KI-Sicherheit und -Risiken. Markets: Yahoo-Symbole der KI-Chipwerte (NVDA, AMD, AVGO); incidents: Hacker-News-Titelsuche.
// Statuspage-Kategorie `ai` hat nur 2 Hosts (unter 3 wird nichts gemeldet), deshalb dort kein Eintrag; platforms liefert ai-hf-hub.
// VERIFIED: nein (neue Requests warten auf Aufzeichnung, Queue-Einträge in fixtures/queue/yahoo-chart.json, hn-algolia.json und wikimedia-pageviews.json).

import type { ScenarioCollectorConfig } from './_types.ts';

const yahooBaseline = { method: 'rolling' as const, windowDays: 56, minPoints: 21 };

export default {
  scenario: 'ai',
  wikipedia: [
    {
      signal: {
        id: 'ai.attention.ai_attention_wiki', name: 'Wikipedia-Aufrufe zu KI-Risiken (englisch)',
        plain: 'Wie oft englischsprachige Wikipedia-Artikel zu KI-Sicherheit, Prompt Injection und KI-Risiken aufgerufen werden.',
        weight: 0.45, banalCauses: ['Produktvorstellungen', 'Filme und Serien', 'Anhörungen und Gesetzgebung', 'Schul- und Semesterbeginn'],
      },
      project: 'en.wikipedia',
      // Titel aus Kenntnis gewählt, nicht live geprüft (ab 2 fehlenden Artikeln meldet der Collector nichts)
      articles: ['AI_safety', 'Prompt_injection', 'Existential_risk_from_artificial_intelligence', 'AI_alignment', 'Deepfake', 'Hugging_Face'],
    },
  ],
  hackerNews: [
    {
      signal: {
        id: 'ai.incidents.hackernews_ai_incidents', domain: 'incidents', name: 'Hacker-News-Stories zu KI-Vorfällen',
        plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie jailbreak, prompt injection oder model leak im Titel haben.',
        weight: 0.3, banalCauses: ['Produktvorstellungen', 'Konferenzen', 'Einzelner viraler Blogpost'],
      },
      terms: ['jailbreak', '"prompt injection"', '"model leak"', '"AI incident"'],
      fixturePrefix: 'ai-',
    },
  ],
  gdelt: [],
  polymarket: [],
  yahoo: [
    {
      signal: {
        id: 'ai.markets.ai_stock_volume', domain: 'markets', name: 'Relatives Handelsvolumen der KI-Chipwerte (NVDA, AMD, AVGO)',
        plain: 'Wie stark die Aktien der wichtigsten KI-Chiphersteller gerade gehandelt werden, verglichen mit den 10 Handelstagen davor.',
        weight: 0.3, unit: 'x Median 10 Tage', baseline: yahooBaseline,
        banalCauses: ['Quartalszahlen', 'Index-Rebalancing', 'Verfallstermine', 'Quartalsende'],
      },
      symbols: ['NVDA', 'AMD', 'AVGO'], metric: 'rel-volume-sum',
    },
    {
      signal: {
        id: 'ai.markets.ai_stock_abs_return', domain: 'markets', name: 'Tagesschwankung der KI-Chipwerte (NVDA, AMD, AVGO)',
        plain: 'Wie stark die Aktien der KI-Chiphersteller an einem Tag steigen oder fallen (Betrag der Tagesrendite).',
        weight: 0.25, unit: '% (Betrag)', baseline: yahooBaseline,
        banalCauses: ['Marktweite Kursbewegung', 'Quartalszahlen', 'Zinsentscheide', 'Exportbeschränkungen'],
      },
      symbols: ['NVDA', 'AMD', 'AVGO'], metric: 'abs-return-mean',
    },
  ],
  iodaCountries: [],
  iodaEvents: [],
  ooni: [],
  statuspage: [],
  adsb: [],
} satisfies ScenarioCollectorConfig;
