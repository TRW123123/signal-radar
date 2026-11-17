// SEC EDGAR Volltextsuche: 8-K-Meldungen mit Item 1.05 (Material Cybersecurity Incidents), Meldungen pro Tag.
// Quelle: https://efts.sec.gov/LATEST/search-index (inoffizielle, undokumentierte JSON-Schnittstelle der EDGAR-Volltextsuche,
// Pfad mit Großbuchstaben). Oberfläche: https://www.sec.gov/edgar/search/ ; Fair-Access-Regeln: max. 10 Anfragen/s,
// User-Agent mit Kontaktangabe verpflichtend (aus SR_SEC_USER_AGENT; ohne Variable läuft der Collector mit dem Standard-UA,
// die SEC kann dann mit 403 antworten).
// Lizenz: US-Regierungsdaten, gemeinfrei. Es werden nur Zählwerte gespeichert, keine Firmennamen.
// Gemessen: Zahl der Filings je Tag (Dateidatum, UTC) mit Item 1.05, 90 Tage Historie aus höchstens 3 Seiten à 100 Treffer.
// Harmlose Ursachen: einzelne große Ransomware-Fälle, Wochenenden/Feiertage (Wert 0), seit 2024 melden viele Firmen
// stattdessen unter Item 8.01, daher niedrige Grundrate. Mehrere Dokumente je Filing werden je Accession-Nummer nur einmal gezählt.
// Die Volltextsuche findet jede Erwähnung von "Item 1.05"; gezählt wird nur, wenn _source.items "1.05" enthält.
// VERIFIED: nein (Form nach Drittbeschreibungen: hits.total.value, hits.hits[]._id/_source{adsh, form, file_date, items}).

import type { Collector } from '../core/types.ts';
import { countPerDay, daysAgo, expect, isoDay, num } from './_helpers.ts';

interface Hit { _id?: string; _source?: { adsh?: string; form?: string; file_date?: string; items?: unknown } }
interface Resp { hits?: { total?: { value?: number }; hits?: Hit[] } }

export interface Page { total: number; filings: { id: string; date: string }[]; rawCount: number }

/** Parses one result page; keeps only 8-K filings that list Item 1.05. */
export function parsePage(body: Resp): Page {
  const hits = expect(body?.hits, 'hits');
  const list = expect(hits.hits, 'hits.hits');
  const total = num(hits.total?.value) ?? 0;
  const filings: Page['filings'] = [];
  for (const h of list) {
    const s = h._source;
    if (!s || typeof s.file_date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(s.file_date)) continue;
    const items = Array.isArray(s.items) ? s.items.map(String) : typeof s.items === 'string' ? s.items.split(/[,\s]+/) : [];
    if (!items.includes('1.05')) continue;
    if (s.form && s.form !== '8-K') continue; // 8-K/A are amendments, not new reports
    const id = s.adsh ?? (h._id ? h._id.split(':')[0] : undefined);
    if (!id) continue;
    filings.push({ id, date: s.file_date.slice(0, 10) });
  }
  return { total, filings, rawCount: list.length };
}

export const PAGE_SIZE = 100;
export const MAX_PAGES = 3;
export const WINDOW_DAYS = 90;

export function buildUrl(start: string, end: string, from: number): string {
  return `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent('"Item 1.05"')}&forms=8-K&dateRange=custom&startdt=${start}&enddt=${end}&from=${from}`;
}

const collector: Collector = {
  id: 'sec-edgar',
  title: 'SEC EDGAR Volltextsuche (8-K Item 1.05)',
  sourceUrl: 'https://www.sec.gov/edgar/search/',
  intervalMinutes: 360,
  signals: [
    {
      id: 'cyber.services.sec_8k_item105_daily_count', scenarios: ['cyber'], domain: 'services',
      name: 'SEC 8-K Item 1.05 Meldungen pro Tag',
      plain: 'Börsennotierte US-Firmen müssen wesentliche Cybervorfälle binnen vier Geschäftstagen melden; die Zahl der Meldungen pro Tag zeigt Wellen.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.75, manipulability: 'low', independenceGroup: 'sec-edgar',
      unit: 'Meldungen/Tag', intervalMinutes: 1440, holdHours: 72,
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 },
      thresholds: { absFloor: 1 },
      license: 'US-Regierungsdaten, gemeinfrei; faire Nutzung, User-Agent mit Kontakt Pflicht',
    },
  ],
  async collect(ctx) {
    const start = isoDay(daysAgo(ctx.now, WINDOW_DAYS));
    const end = isoDay(ctx.now);
    const ua = ctx.key('SR_SEC_USER_AGENT');
    const headers = ua ? { 'user-agent': ua } : undefined;
    const seen = new Map<string, string>();
    let total = 0;
    let fetched = 0;
    for (let p = 0; p < MAX_PAGES; p++) {
      const from = p * PAGE_SIZE;
      const page = parsePage(await ctx.http.json<Resp>(buildUrl(start, end, from), { fixture: `sec-edgar/item105-${from}.json`, headers }));
      total = page.total;
      fetched += page.rawCount;
      for (const f of page.filings) seen.set(f.id, f.date);
      if (page.rawCount < PAGE_SIZE || fetched >= total) break;
    }
    // A cut-off result list would undercount; better no value than a false drop.
    if (fetched < total) throw new Error(`Trefferliste unvollständig (${fetched} von ${total} geladen)`);
    const observations = countPerDay('cyber.services.sec_8k_item105_daily_count', [...seen.values()].map((d) => `${d}T00:00:00Z`), ctx.now, { days: WINDOW_DAYS });
    return { observations };
  },
};

export default collector;
