// Mediale Aufmerksamkeit für Cyberangriffe (Evidenzklasse D: Nachrichtenvolumen, keine Messung des Ereignisses).
// Quelle: GDELT DOC 2.0 API, kein Key. Doku: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
// Lizenz: frei nutzbar mit Quellenangabe (GDELT Project). Empfohlenes Limit: 1 Anfrage pro 5 Sekunden; wir stellen 6 pro Lauf (2 Cyber, 4 war); der Collector erzwingt keinen 5-Sekunden-Abstand.
// Gemessen: mode=timelinevol, Anteil der Artikel (in Prozent aller von GDELT erfassten Artikel) zu den Suchbegriffen,
// deutsch und englisch getrennt. timespan=1m (rund 30 Tage); timespan=3m und die längere Suchanfrage liefen am 17.11.2026 in einen
// Timeout der Prüf-Umgebung, deshalb kürzerer Zeitraum und je zwei statt vier Suchbegriffe. Ältere Historie baut der Speicher selbst auf.
// Die Auflösung der Zeitreihe hängt vom Zeitraum ab (bei Monaten typischerweise täglich); der Parser fasst jede Auflösung
// per Mittelwert auf UTC-Tage zusammen und meldet den laufenden Tag nicht.
// Harmlose Ursachen für Ausschläge: Berichterstattung über einen Einzelfall (bekannte Firma gehackt), Jahres-/Quartalsberichte
// von Sicherheitsfirmen, Wochentagsrhythmus der Medien, Änderungen in GDELTs Quellenabdeckung.
// Szenario war (Kriegseskalation): vier weitere Ströme (je eine Anfrage pro Lauf, gleiche Form timespan=1m, kurze Suchbegriffe wegen der
// Timeouts): Iran/Hormus, Ukraine/NATO, Taiwan getrennt, dazu Anteil "World War III"/"nuclear war". Nur englischsprachige Quellen.
// Harmlose Ursachen (war): Sport/Kultur-Berichte mit Ländernamen (Iran, Taiwan), Wahlen, Jahrestage, Wochentagsrhythmus, Änderungen der GDELT-Abdeckung.
// Ströme je Szenario: src/collectors/config/<szenario>.ts (Feld gdelt), je Strom eine Anfrage und ein Signal.
// VERIFIED: teilweise (17.11.2026, echte Antwort aus Node und curl): Form { timeline: [{ series, data: [{ date, value }] }] } stimmt, Sprachfilter sourcelang:english / sourcelang:german gilt.
//   GDELT antwortet langsam (12 bis 23 s) und begrenzt auf einen Abruf je 5 Sekunden (HTTP 429 sonst); der Client hält 5,5 s Abstand und wartet bis 60 s. Einzelne Ströme können dennoch ausfallen und werden dann übersprungen.

import type { Collector, Observation } from '../core/types.ts';
import { expect, isoDay, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

export interface Stream { signalId: string; scenario: string; fixture: string; query: string }

/** Ströme aller Szenarien (src/collectors/config/<szenario>.ts, Feld gdelt). */
const ENTRIES = scenarioEntries('gdelt');
export const STREAMS: Stream[] = ENTRIES.map((e) => ({ signalId: e.signal.id, scenario: e.scenario, fixture: e.fixture, query: e.query }));

const DEFAULTS = {
  domain: 'attention', evidenceClass: 'D' as const, direction: 'up' as const, kind: 'gauge' as const,
  independenceGroup: 'gdelt-doc', unit: '% der Artikel', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  license: 'frei nutzbar mit Quellenangabe (GDELT Project)',
};

interface Point { date?: string; value?: unknown }
interface Resp { timeline?: { series?: string; data?: Point[] }[] }

/** GDELT-Datum "20260801T000000Z" -> Date (UTC) oder null */
export function parseGdeltDate(s: unknown): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/.exec(String(s ?? ''));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

/** Zeitreihe -> Mittelwert je UTC-Tag (Map "YYYY-MM-DD" -> Wert). */
export function parse(body: Resp): Map<string, number> {
  const timeline = expect(body.timeline, 'timeline');
  const data = expect(timeline[0]?.data, 'timeline[0].data');
  const sums = new Map<string, { s: number; n: number }>();
  for (const p of data) {
    const d = parseGdeltDate(p?.date);
    const v = num(p?.value);
    if (!d || v === null) continue;
    const k = isoDay(d);
    const cur = sums.get(k) ?? { s: 0, n: 0 };
    cur.s += v; cur.n++;
    sums.set(k, cur);
  }
  return new Map([...sums.entries()].sort().map(([k, v]) => [k, v.s / v.n]));
}

export function buildUrl(query: string): string {
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=timelinevol&format=json&timespan=1m`;
}

const collector: Collector = {
  id: 'gdelt-doc',
  title: 'GDELT DOC 2.0 API',
  sourceUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
  intervalMinutes: 720,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    const today = isoDay(ctx.now);
    const observations: Observation[] = [];
    let ok = 0;
    for (const s of STREAMS) {
      try {
        const days = parse(await ctx.http.json<Resp>(buildUrl(s.query), { fixture: s.fixture, timeoutMs: 60_000 }));
        for (const [day, v] of days) {
          if (day >= today) continue; // laufender Tag unvollständig
          observations.push(obs(s.signalId, `${day}T00:00:00Z`, v));
        }
        ok++;
      } catch (e) {
        ctx.log(`GDELT-Strom ${s.signalId} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('gdelt-doc: keine Antwort verwertbar');
    return { observations };
  },
};

export default collector;
