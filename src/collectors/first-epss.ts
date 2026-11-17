// FIRST EPSS (Exploit Prediction Scoring System), Klasse A: modellierte Ausnutzungswahrscheinlichkeit je CVE.
// Quelle: https://api.first.org/data/v1/epss  Doku: https://www.first.org/epss/api
// Lizenz: frei nutzbar mit Quellenangabe (laut FIRST).
// Gemessen: Anzahl CVEs mit EPSS > 0.5 an einem Stichtag (Feld `total` der Antwort bei limit=1, damit die Antwort klein bleibt).
//   Die API hat keine Massen-Zeitreihe, daher ein Request je Tag, sieben Tage Rückblick. Ein Delta-Signal (EPSS-Sprünge je CVE)
//   ist ohne Massenabruf nicht möglich und wird nicht gebaut.
// Harmlose Ursachen: Modellversionswechsel (EPSS v3/v4 verschieben das Niveau sprunghaft), Neu veröffentlichte PoCs.
// VERIFIED: nein (Parameter epss-gt, limit, date und Feld total aus dem Gedächtnis; Katalog meldet Basisabruf total 406741).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

interface Resp { total?: number | string; data?: { cve?: string; epss?: string | number; date?: string }[] }

/** Returns the day (YYYY-MM-DD) the scores belong to and the number of CVEs above the threshold. null = no data for that date. */
export function parseHighCount(body: Resp, requestedDay: string): { day: string; total: number } | null {
  const total = num(expect(body.total, 'total'));
  if (total === null) throw new Error('unerwartete Antwort: total ist keine Zahl');
  const data = Array.isArray(body.data) ? body.data : [];
  if (total === 0 && data.length === 0) return null; // date not (yet) published: not a measurement of zero
  const d = data[0]?.date;
  const day = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : requestedDay;
  return { day, total };
}

export function urlFor(day: string): string {
  return `https://api.first.org/data/v1/epss?epss-gt=0.5&limit=1&date=${day}`;
}

const collector: Collector = {
  id: 'first-epss',
  title: 'FIRST EPSS API',
  sourceUrl: 'https://www.first.org/epss/api',
  intervalMinutes: 1440,
  signals: [{
    id: 'cyber.vuln.epss_high_count', scenarios: ['cyber'], domain: 'vuln', name: 'Anzahl CVEs mit EPSS über 0,5',
    plain: 'Wie viele Schwachstellen laut FIRST-Modell sehr wahrscheinlich bald ausgenutzt werden.',
    evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.55, manipulability: 'low', independenceGroup: 'first-epss',
    unit: 'CVEs', intervalMinutes: 1440, holdHours: 72,
    baseline: { method: 'rolling', windowDays: 60, minPoints: 14 },
    thresholds: { relFloor: 0.02 },
    license: 'frei nutzbar mit Quellenangabe (FIRST)',
    banalCauses: ['Modellversionswechsel', 'Neu veröffentlichter PoC'],
  }],
  async collect(ctx) {
    const byDay = new Map<string, number>();
    let ok = 0;
    for (let i = 1; i <= 7; i++) {
      const day = isoDay(daysAgo(ctx.now, i));
      try {
        const r = parseHighCount(await ctx.http.json<Resp>(urlFor(day), { fixture: `first-epss/high-${day}.json` }), day);
        if (r) byDay.set(r.day, r.total);
        else ctx.log(`EPSS ${day}: noch nicht veröffentlicht`);
        ok++;
      } catch (e) {
        ctx.log(`EPSS ${day} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('EPSS-API lieferte keinen brauchbaren Tag');
    const observations: Observation[] = [...byDay.entries()].sort().map(([d, t]) => obs('cyber.vuln.epss_high_count', `${d}T00:00:00Z`, t));
    return { observations };
  },
};

export default collector;
