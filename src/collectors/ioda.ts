// IODA (Internet Outage Detection and Analysis, Georgia Tech): unabhängige Messreihen zur Erreichbarkeit von Ländernetzen.
// Quelle: https://api.ioda.inetintel.cc.gatech.edu/v2/ (Doku: https://api.ioda.inetintel.cc.gatech.edu/v2/ bzw. https://ioda.inetintel.cc.gatech.edu/)
// Lizenz/Nutzung: frei für Forschung und Beobachtung, kein Key, fair use. Bedingungen auf der IODA-Website beachten.
// Gemessen: (a) BGP-sichtbare /24-Netze je Land, (b) aktiv anpingbare /24-Netze je Land (ping-slash24),
// (c) Zahl der von IODA erkannten Ausfallereignisse (Länderebene) pro Tag.
// Harmlose Ursachen: Stromausfälle, Zensur/Prüfungsabschaltungen in anderen Ländern, Seekabelbrüche, Messausfall einzelner
// IODA-Datenquellen (dann fallen Zeitreihen ab, ohne dass das Netz ausfällt), Wartung großer Provider.
// 9 Requests pro Lauf (8 Länder + Ereignisliste): bewusst mehr als 8, weil die Länderliste die Signale 2 bis 4 trägt.
// VERIFIED: nein. Die Antwortform (data = Liste von Listen mit {datasource, from, step, values}; Ereignisse mit `start` in
// Unix-Sekunden) ist aus dem Gedächtnis rekonstruiert, die Parser sind deshalb tolerant. Doku war beim Bau nicht abrufbar.

import type { Collector, Observation } from '../core/types.ts';
import { countPerDay, expect, num, obs } from './_helpers.ts';

const BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
export const COUNTRIES = ['DE', 'US', 'GB', 'FR', 'NL', 'JP', 'IN', 'BR'];
const HOURS = 48;
const EVENT_DAYS = 21;

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
const common = {
  scenarios: ['cyber'], domain: 'outages', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'ioda', license: 'frei für Forschung, Bedingungen auf Website', ...SRC,
};
const hourly = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };

const collector: Collector = {
  id: 'ioda',
  title: 'IODA Internet-Ausfälle (Georgia Tech)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: 'cyber.outages.ioda_outage_events_global', name: 'IODA Ausfallereignisse weltweit',
      plain: 'Wie viele Internet-Ausfälle auf Länderebene IODA pro Tag automatisch erkennt.',
      direction: 'up', kind: 'count', weight: 0.85, unit: 'Ereignisse/Tag', intervalMinutes: 1440, holdHours: 48,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
      banalCauses: ['Prüfungsabschaltungen und Zensur', 'Stromausfälle', 'Seekabelbruch'],
    },
    {
      ...common, id: 'cyber.outages.ioda_country_signals_de', name: 'IODA: Deutsche Netze im Routing',
      plain: 'Wie viele deutsche Netzblöcke (/24) weltweit im Routing sichtbar sind; ein Einbruch heißt, dass Netze verschwinden.',
      direction: 'down', kind: 'gauge', weight: 0.8, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: hourly,
      banalCauses: ['Messausfall einzelner BGP-Quellen bei IODA'],
    },
    {
      ...common, id: 'cyber.outages.ioda_ping_de', name: 'IODA: Erreichbare deutsche Netze (Ping)',
      plain: 'Wie viele deutsche Netzblöcke (/24) auf aktive Anfragen antworten; unabhängig vom Routing gemessen.',
      direction: 'down', kind: 'gauge', weight: 0.7, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: hourly,
      banalCauses: ['Ausfall einzelner Messpunkte', 'Wartung großer Provider'],
    },
    {
      ...common, id: 'cyber.outages.ioda_bgp_big_countries', name: 'IODA: Routing-Sichtbarkeit großer Länder (Summe)',
      plain: 'Summe der im Routing sichtbaren Netzblöcke von acht großen Ländern; ein Einbruch deutet auf einen großflächigen Ausfall.',
      direction: 'down', kind: 'gauge', weight: 0.6, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: hourly,
      banalCauses: ['Messausfall bei IODA', 'Umnummerierung großer Provider'],
    },
  ],
  async collect(ctx) {
    const untilSec = Math.floor(ctx.now.getTime() / 3600_000) * 3600; // laufende Stunde ausschließen
    const fromSec = untilSec - HOURS * 3600;
    const observations: Observation[] = [];

    const bgpByCountry = new Map<string, Map<number, number>>();
    for (const cc of COUNTRIES) {
      const url = `${BASE}/signals/raw/country/${cc}?from=${fromSec}&until=${untilSec}`;
      try {
        const series = parseSignals(await ctx.http.json(url, { fixture: `ioda/country-${cc}.json` }));
        const bgp = series.find((s) => s.datasource === 'bgp');
        if (!bgp) throw new Error('Datenquelle bgp fehlt');
        const bgpH = hourlyMeans(bgp, untilSec);
        bgpByCountry.set(cc, bgpH);
        if (cc === 'DE') {
          for (const [h, v] of bgpH) observations.push(obs('cyber.outages.ioda_country_signals_de', h * 1000, v));
          const ping = series.find((s) => s.datasource === 'ping-slash24');
          if (ping) for (const [h, v] of hourlyMeans(ping, untilSec)) observations.push(obs('cyber.outages.ioda_ping_de', h * 1000, v));
          else ctx.log('IODA DE: ping-slash24 fehlt');
        }
      } catch (e) {
        ctx.log(`IODA Land ${cc} übersprungen: ${(e as Error).message}`);
      }
    }
    // Summe nur, wenn alle Länder geantwortet haben; sonst sähe ein fehlender Summand wie ein Einbruch aus.
    if (bgpByCountry.size === COUNTRIES.length) {
      const hours = [...bgpByCountry.get(COUNTRIES[0])!.keys()].filter((h) => [...bgpByCountry.values()].every((m) => m.has(h)));
      for (const h of hours) {
        let sum = 0;
        for (const m of bgpByCountry.values()) sum += m.get(h)!;
        observations.push(obs('cyber.outages.ioda_bgp_big_countries', h * 1000, sum, { countries: COUNTRIES.length }));
      }
    } else ctx.log('IODA: Länder-Summe ausgelassen, nicht alle Länder verfügbar');

    try {
      const evFrom = Math.floor(ctx.now.getTime() / 86400_000) * 86400 - EVENT_DAYS * 86400;
      const evUntil = Math.floor(ctx.now.getTime() / 86400_000) * 86400;
      const url = `${BASE}/outages/events?from=${evFrom}&until=${evUntil}&entityType=country`;
      const starts = parseEventStarts(await ctx.http.json(url, { fixture: 'ioda/events.json' }));
      observations.push(...countPerDay('cyber.outages.ioda_outage_events_global', starts.map((s) => s * 1000), ctx.now, { days: EVENT_DAYS }));
    } catch (e) {
      ctx.log(`IODA Ereignisliste übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
