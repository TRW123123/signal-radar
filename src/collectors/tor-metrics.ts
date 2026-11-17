// Tor Metrics (Tor Project): geschätzte Zahl direkter Tor-Nutzer in Deutschland und Gesamtbandbreite des Relay-Netzes.
// Doku: https://metrics.torproject.org/stats.html (userstats-relay-country.csv, bandwidth.csv)
// Lizenz: CC0, kein Key. Daten kommen mit etwa 2 Tagen Verzug, die jüngsten Tage fehlen oder sind unvollständig.
// Gemessen: (a) Nutzer DE pro Tag, (b) angekündigte Relay-Bandbreite pro Tag (advbw, Bytes/s laut Tor Metrics).
// Harmlose Ursachen: Kampagnen/Software-Releases, Zensurwellen in anderen Ländern, Messmethodik-Änderungen, Relay-Wartung.
// Die CSV beginnt mit Kommentarzeilen (#); Spalten werden über die Kopfzeile gefunden, nicht über Positionen.
// VERIFIED: nein. Spalten (date,country,users,lower,upper,frac bzw. date,advbw,bwhist) aus dem Gedächtnis, Doku war beim Bau nicht abrufbar.

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, isoDay, num, obs, parseCsv } from './_helpers.ts';

const BASE = 'https://metrics.torproject.org';
const HISTORY_DAYS = 75;
const LAG_DAYS = 3; // jüngste Tage sind unvollständig

export interface DayValue { day: string; value: number }

/** Liest eine Spalte nach Kopfzeilenname; Kommentarzeilen werden verworfen, leere Werte übersprungen. */
export function parseColumn(text: string, column: string, filter?: { column: string; equals: string }): DayValue[] {
  const body = text.split(/\r?\n/).filter((l) => !l.startsWith('#')).join('\n');
  const rows = parseCsv(body);
  if (rows.length === 0) return [];
  const head = rows[0].map((h) => h.trim());
  const di = head.indexOf('date');
  const vi = head.indexOf(column);
  if (di < 0 || vi < 0) throw new Error(`unerwartete Antwort: Spalte date oder ${column} fehlt`);
  const fi = filter ? head.indexOf(filter.column) : -1;
  if (filter && fi < 0) throw new Error(`unerwartete Antwort: Spalte ${filter.column} fehlt`);
  const out: DayValue[] = [];
  for (const r of rows.slice(1)) {
    if (filter && (r[fi] ?? '').trim().toLowerCase() !== filter.equals) continue;
    const v = num(r[vi]);
    const day = (r[di] ?? '').trim();
    if (v !== null && /^\d{4}-\d{2}-\d{2}$/.test(day)) out.push({ day, value: v });
  }
  return out;
}

const SRC = { sourceName: 'Tor Metrics', sourceUrl: 'https://metrics.torproject.org/stats.html' };
const common = {
  scenarios: ['cyber'], domain: 'outages', evidenceClass: 'A' as const, independenceGroup: 'tor-metrics',
  kind: 'count' as const, intervalMinutes: 1440, holdHours: 72, license: 'CC0', ...SRC,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
};

const collector: Collector = {
  id: 'tor-metrics',
  title: 'Tor Metrics',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 720,
  signals: [
    {
      ...common, id: 'cyber.outages.users_de', name: 'Tor-Nutzerschätzung Deutschland',
      plain: 'Geschätzte Zahl direkter Tor-Verbindungen aus Deutschland pro Tag; Einbruch deutet auf Netzausfall, Anstieg auf Ausweichverhalten.',
      direction: 'both', weight: 0.4, manipulability: 'medium', unit: 'Nutzer/Tag',
      banalCauses: ['Kampagnen', 'Software-Releases', 'Zensurwellen in anderen Ländern'],
    },
    {
      ...common, id: 'cyber.outages.tor_advertised_bandwidth', name: 'Tor-Relay-Bandbreite',
      plain: 'Gesamtkapazität, die alle Tor-Relays ankündigen; ein Einbruch zeigt Probleme im Tor-Netz.',
      direction: 'down', weight: 0.3, manipulability: 'low', unit: 'Bytes/s',
      thresholds: { relFloor: 0.02 }, banalCauses: ['Wartung', 'Hosting-Anbieter sperrt Relays'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const start = isoDay(daysAgo(ctx.now, HISTORY_DAYS));
    const end = isoDay(daysAgo(ctx.now, LAG_DAYS));
    const jobs: { id: string; url: string; fixture: string; col: string; filter?: { column: string; equals: string } }[] = [
      { id: 'cyber.outages.users_de', col: 'users', filter: { column: 'country', equals: 'de' }, fixture: 'tor-metrics/userstats-de.csv',
        url: `${BASE}/userstats-relay-country.csv?start=${start}&end=${end}&country=de&events=off` },
      { id: 'cyber.outages.tor_advertised_bandwidth', col: 'advbw', fixture: 'tor-metrics/bandwidth.csv',
        url: `${BASE}/bandwidth.csv?start=${start}&end=${end}` },
    ];
    for (const j of jobs) {
      try {
        const rows = parseColumn(await ctx.http.text(j.url, { fixture: j.fixture }), j.col, j.filter);
        for (const r of rows) if (r.day <= end) observations.push(obs(j.id, `${r.day}T00:00:00Z`, r.value));
      } catch (e) {
        ctx.log(`Tor Metrics ${j.id} übersprungen: ${(e as Error).message}`);
      }
    }
    return { observations };
  },
};

export default collector;
