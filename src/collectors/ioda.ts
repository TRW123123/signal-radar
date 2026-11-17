// IODA (Internet Outage Detection and Analysis, Georgia Tech): unabhängige Messreihen zur Erreichbarkeit von Ländernetzen.
// Quelle: https://api.ioda.inetintel.cc.gatech.edu/v2/ (Doku: https://api.ioda.inetintel.cc.gatech.edu/v2/ bzw. https://ioda.inetintel.cc.gatech.edu/)
// Lizenz/Nutzung: frei für Forschung und Beobachtung, kein Key, fair use. Bedingungen auf der IODA-Website beachten.
// Gemessen: (a) BGP-sichtbare /24-Netze je Land, (b) aktiv anpingbare /24-Netze je Land (ping-slash24),
// (c) Zahl der von IODA erkannten Ausfallereignisse (Länderebene) pro Tag.
// Harmlose Ursachen: Stromausfälle, Zensur/Prüfungsabschaltungen in anderen Ländern, Seekabelbrüche, Messausfall einzelner
// IODA-Datenquellen (dann fallen Zeitreihen ab, ohne dass das Netz ausfällt), Wartung großer Provider.
// Requests pro Lauf: eine je (Land, Datenquelle) über alle Szenarien (heute 17) plus 4 für die Ereignisliste; bewusst mehr als 8,
// weil die Länderliste die Signale trägt. Länder und Ländergruppen je Szenario: src/collectors/config/<szenario>.ts (iodaCountries, iodaEvents).
// Echte Form (17.11.2026, aus dem abgeschnittenen Anfang): {type, metadata, requestParameters, error, perf, data:[[{entityType,
// entityCode, datasource, subtype?, from, until, step, nativeStep, values}]]}. Ohne `datasource` kommen alle Quellen (gtr, bgp,
// ping-slash24, ...) und die Antwort hat ca. 142 000 Zeichen; mit `datasource=bgp` bzw. `ping-slash24` und 24 Stunden bleibt sie klein.
// Ereignisse: {type:'outages.events', data:[{location:'country/GU', start (Unix-s), duration, method, datasource, score,
// overlaps_window}]}, ca. 230 Zeichen je Ereignis, Standard-limit 500 und extendWindow 14 Tage (ergab 113 300 Zeichen). Daher nur
// der letzte vollständige Tag in vier 6-Stunden-Abschnitten mit limit=20 und extendWindow=0 (je Antwort höchstens ca. 5 300 Zeichen,
// Grenze der Aufzeichnungs-Umgebung ca. 6 000); gezählt wird nach `start` im Abschnitt, eine Antwort mit limit Treffern gilt als
// unvollständig und der Tag wird nicht gemeldet. Die Historie baut der Speicher Tag für Tag auf.
// Länderreihen mit datasource=bgp (5-Minuten-Schritt) und 24 Stunden: geschätzt 2 500 bis 3 500 Zeichen je Antwort.
// Szenario war (Kriegseskalation): zusätzlich BGP-Reihen (gleiche URL-Form, 24 Stunden, datasource=bgp, je Land eine kleine Antwort) für IR, IL, UA, RU, TW
// und die Golfstaaten SA, AE, QA (Summe als Signal gulf_states_internet; nur wenn alle drei antworten). Neue Fixture-Namen ioda/country-<CC>.json
// (kein Überschneiden mit den Cyber-Ländern). 8 weitere Requests, je Land ein Signal. Harmlose Ursachen (war): Stromausfälle, staatlich angeordnete
// Abschaltungen und Prüfungsabschaltungen, Messausfall einzelner BGP-Quellen, Seekabelbrüche. Die Cyber-Anfragen und ihre Fixture-Namen sind unverändert.
// VERIFIED: nein (Antwort zu groß für die Prüf-Umgebung; Formen aus dem abgeschnittenen Anfang bestätigt, die verkleinerten
// Requests und ob extendWindow=0 gilt sind noch nicht aufgezeichnet).

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
/** Länder bzw. Ländergruppen aller Szenarien (src/collectors/config/<szenario>.ts, Felder iodaCountries und iodaEvents). */
const ENTRIES = scenarioEntries('iodaCountries');
const EVENT_ENTRIES = scenarioEntries('iodaEvents');
export interface CountryGroup { signalId: string; countries: string[]; datasource: 'bgp' | 'ping-slash24' }
export const GROUPS: CountryGroup[] = ENTRIES.map((e) => ({ signalId: e.signal.id, countries: e.countries, datasource: e.datasource ?? 'bgp' }));
export const EVENT_SIGNAL_IDS = EVENT_ENTRIES.map((e) => e.id);
const HOURS = 24;
/** Ereignisliste in EVENT_SLICES Abschnitten je Tag mit höchstens EVENT_LIMIT Einträgen (ca. 230 Zeichen je Ereignis, Antwort unter ca. 5 300 Zeichen). */
export const EVENT_LIMIT = 20;
export const EVENT_SLICES = 4;

export interface Series { datasource: string; from: number; step: number; values: (number | null)[] }

/** data ist laut Erinnerung eine Liste von Listen; Liste von Objekten wird ebenfalls akzeptiert. */
export function parseSignals(body: unknown): Series[] {
  const data = expect((body as { data?: unknown } | null)?.data, 'data');
  if (!Array.isArray(data)) throw new Error('unerwartete Antwort: data ist keine Liste');
  const out: Series[] = [];
  for (const entry of data.flat()) {
    const e = entry as Record<string, unknown> | null;
    if (!e || typeof e !== 'object') continue;
    const from = num(e.from);
    const step = num(e.step);
    if (typeof e.datasource !== 'string' || from === null || step === null || step <= 0 || !Array.isArray(e.values)) continue;
    out.push({ datasource: e.datasource, from, step, values: e.values.map((v) => num(v)) });
  }
  return out;
}

/** Mittelwert je vollständiger UTC-Stunde (alle Punkte der Stunde vorhanden und nicht null). Schlüssel: Unix-Sekunden der Stunde. */
export function hourlyMeans(s: Series, untilSec: number): Map<number, number> {
  const out = new Map<number, number>();
  if (3600 % s.step !== 0) return out;
  const perHour = 3600 / s.step;
  const sums = new Map<number, { sum: number; n: number }>();
  s.values.forEach((v, i) => {
    if (v === null) return;
    const t = s.from + i * s.step;
    const h = Math.floor(t / 3600) * 3600;
    const a = sums.get(h) ?? { sum: 0, n: 0 };
    a.sum += v; a.n++;
    sums.set(h, a);
  });
  for (const [h, a] of sums) if (a.n === perHour && h + 3600 <= untilSec) out.set(h, a.sum / a.n);
  return out;
}

/** Startzeitpunkte (Unix-Sekunden) der Ausfallereignisse. */
export function parseEventStarts(body: unknown): number[] {
  let data = expect((body as { data?: unknown } | null)?.data, 'data');
  if (!Array.isArray(data) && data && typeof data === 'object') data = (data as { events?: unknown }).events ?? [];
  if (!Array.isArray(data)) throw new Error('unerwartete Antwort: Ereignisliste fehlt');
  const out: number[] = [];
  for (const it of data) {
    const s = num((it as Record<string, unknown>)?.start ?? (it as Record<string, unknown>)?.start_time);
    if (s !== null && s > 0) out.push(s);
  }
  return out;
}

const SRC = { sourceName: 'IODA (Georgia Tech)', sourceUrl: 'https://ioda.inetintel.cc.gatech.edu/' };
const DEFAULTS = {
  evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'ioda', license: 'frei für Forschung, Bedingungen auf Website', ...SRC,
};

export function fixtureName(cc: string, datasource: CountryGroup['datasource']): string {
  return `ioda/country-${cc}${datasource === 'bgp' ? '' : '-ping'}.json`;
}

export function eventsUrl(fromSec: number, untilSec: number): string {
  return `${BASE}/outages/events?from=${fromSec}&until=${untilSec}&entityType=country&limit=${EVENT_LIMIT}&extendWindow=0`;
}
/** Abschnitt i des Vortags (0 = 00 bis 06 Uhr UTC). */
export function eventsFixture(i: number): string {
  return `ioda/events-${String(i * (24 / EVENT_SLICES)).padStart(2, '0')}h.json`;
}

const collector: Collector = {
  id: 'ioda',
  title: 'IODA Internet-Ausfälle (Georgia Tech)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 60,
  signals: [
    ...ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
    ...EVENT_ENTRIES.map(({ scenario, ...decl }) => declare(DEFAULTS, scenario, decl)),
  ],
  async collect(ctx) {
    const untilSec = Math.floor(ctx.now.getTime() / 3600_000) * 3600; // laufende Stunde ausschließen
    const fromSec = untilSec - HOURS * 3600;
    const observations: Observation[] = [];

    // Jede Reihe (Land, Datenquelle) wird je Lauf nur einmal geholt, auch wenn mehrere Gruppen sie nutzen.
    const cache = new Map<string, Promise<Map<number, number>>>();
    const hourly = (cc: string, ds: CountryGroup['datasource']) => {
      const key = `${cc}|${ds}`;
      if (!cache.has(key)) {
        const url = `${BASE}/signals/raw/country/${cc}?from=${fromSec}&until=${untilSec}&datasource=${ds}`;
        cache.set(key, ctx.http.json(url, { fixture: fixtureName(cc, ds) }).then((body) => {
          const s = parseSignals(body).find((x) => x.datasource === ds);
          if (!s) throw new Error(`Datenquelle ${ds} fehlt`);
          return hourlyMeans(s, untilSec);
        }));
      }
      return cache.get(key)!;
    };
    for (const g of GROUPS) {
      const maps: Map<number, number>[] = [];
      for (const cc of g.countries) {
        try {
          maps.push(await hourly(cc, g.datasource));
        } catch (e) {
          ctx.log(`IODA Land ${cc} (${g.datasource}) für ${g.signalId} übersprungen: ${(e as Error).message}`);
        }
      }
      // Summe nur, wenn alle Länder geantwortet haben; sonst sähe ein fehlender Summand wie ein Einbruch aus.
      if (maps.length !== g.countries.length) { ctx.log(`IODA: ${g.signalId} ausgelassen, nicht alle Länder verfügbar`); continue; }
      const meta = g.countries.length > 1 ? { countries: g.countries.length } : undefined;
      for (const h of [...maps[0].keys()].filter((x) => maps.every((m) => m.has(x)))) {
        observations.push(obs(g.signalId, h * 1000, maps.reduce((sum, m) => sum + m.get(h)!, 0), meta));
      }
    }

    if (EVENT_SIGNAL_IDS.length) try {
      const evUntil = Math.floor(ctx.now.getTime() / 86400_000) * 86400; // laufenden Tag ausschließen
      const evFrom = evUntil - 86400;
      const step = 86400 / EVENT_SLICES;
      let n = 0;
      for (let i = 0; i < EVENT_SLICES; i++) {
        const from = evFrom + i * step;
        const until = from + step;
        const body = await ctx.http.json(eventsUrl(from, until), { fixture: eventsFixture(i) });
        const all = parseEventStarts(body);
        if (all.length >= EVENT_LIMIT) throw new Error(`Ereignisliste ${i + 1}/${EVENT_SLICES} an limit=${EVENT_LIMIT} abgeschnitten, Tageszahl unvollständig`);
        // Ereignisse, die vor dem Abschnitt begonnen haben, aber hineinreichen, zählen nur in ihrem Startabschnitt.
        n += all.filter((t) => t >= from && t < until).length;
      }
      for (const id of EVENT_SIGNAL_IDS) observations.push(obs(id, evFrom * 1000, n));
    } catch (e) {
      ctx.log(`IODA Ereignisliste übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
