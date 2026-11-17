// RIPEstat Data API (RIPE NCC): Routing-Sicht der RIS-Collector auf deutsche Netze.
// Doku: https://stat.ripe.net/docs/02.data-api/ (country-routing-stats, routing-status)
// Lizenz/Nutzung: RIPE NCC Terms, frei nutzbar ohne Key, fair use (ca. 8 parallele Anfragen, hier sequenziell).
// Gemessen: (a) Zahl der Präfixe, die RIS für Deutschland sieht (Tagesreihe), (b) Anteil der RIS-Peers, die kritische
// deutsche ASNs (Telekom, Vodafone, DE-CIX, Hetzner, IONOS) im Routing sehen (Momentaufnahme je Lauf, Historie baut der Speicher auf).
// Harmlose Ursachen: Aggregation/Deaggregation von Präfixen, Ausfall einzelner RIS-Peers, Umnummerierung, Wartung.
// bgp-update-activity wurde bewusst nicht gebaut: Intervalllänge und Feldnamen ließen sich ohne Doku nicht sicher bestimmen.
// Echte Formen (17.11.2026): country-routing-stats: data.stats[] mit {stats_date, v4_prefixes_ris, v6_prefixes_ris (kann .5 sein)},
// ca. 250 Zeichen je Tag; routing-status: data.visibility.v4.{ris_peers_seeing,total_ris_peers} (ca. 1 000 Zeichen).
// AS3209 lief beim Abruf in ein Timeout (Neuaufzeichnung beantragt); ohne alle fünf ASNs wird kein Mittelwert gemeldet.
// VERIFIED: ja (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel)

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, floorDay, floorHour, isoDay, num, obs } from './_helpers.ts';

const BASE = 'https://stat.ripe.net/data';
/** kuratierte Prüfliste: Telekom, Vodafone, DE-CIX, Hetzner, IONOS */
export const CRITICAL_ASNS = ['AS3320', 'AS3209', 'AS6695', 'AS24940', 'AS8560'];
// 75 Tage ergaben 19 000 Zeichen (ca. 250 je Tag); 20 Tage bleiben bei ca. 5 500 (Grenze der Aufzeichnungs-Umgebung ca. 6 000).
export const HISTORY_DAYS = 20;

export interface PrefixPoint { ts: number | null; value: number }

function toMs(x: unknown): number | null {
  if (typeof x === 'number') return x < 1e12 ? x * 1000 : x;
  if (typeof x === 'string' && x) {
    const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(x) ? `${x}T00:00:00Z` : /T\d{2}:\d{2}(:\d{2})?$/.test(x) ? `${x}Z` : x);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/** stats[] mit v4_prefixes_ris und v6_prefixes_ris; ts ist null, wenn der Eintrag kein Datum trägt. */
export function parseCountryStats(body: unknown): PrefixPoint[] {
  const data = expect((body as { data?: Record<string, unknown> } | null)?.data, 'data');
  const stats = expect(data.stats, 'data.stats');
  if (!Array.isArray(stats)) throw new Error('unerwartete Antwort: data.stats ist keine Liste');
  const out: PrefixPoint[] = [];
  for (const s of stats as Record<string, unknown>[]) {
    const v4 = num(s?.v4_prefixes_ris);
    const v6 = num(s?.v6_prefixes_ris);
    if (v4 === null || v6 === null) continue; // unvollständige Summe nicht melden
    out.push({ ts: toMs(s.date ?? s.timestamp ?? s.stats_date ?? s.time ?? s.starttime), value: v4 + v6 });
  }
  return out;
}

/** Anteil der RIS-Peers, die den Eintrag im IPv4-Routing sehen (0..1). */
export function parseRoutingStatus(body: unknown): number {
  const data = expect((body as { data?: Record<string, unknown> } | null)?.data, 'data');
  const v4 = expect((data.visibility as Record<string, Record<string, unknown>> | undefined)?.v4, 'data.visibility.v4');
  const seeing = expect(num(v4.ris_peers_seeing), 'ris_peers_seeing');
  const total = expect(num(v4.total_ris_peers), 'total_ris_peers');
  if (total <= 0) throw new Error('unerwartete Antwort: total_ris_peers ist 0');
  return seeing / total;
}

const SRC = { sourceName: 'RIPEstat Data API', sourceUrl: 'https://stat.ripe.net/docs/02.data-api/' };
const common = {
  scenarios: ['cyber'], domain: 'routing', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'ripe-stat', license: 'RIPE NCC Terms, frei nutzbar', ...SRC,
};

const collector: Collector = {
  id: 'ripe-stat',
  title: 'RIPEstat Routing-Daten',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: 'cyber.routing.country_prefix_visibility_de', name: 'Sichtbarkeit deutscher Netze im Routing',
      plain: 'Wie viele Netzblöcke aus Deutschland das RIPE-Messnetz weltweit im Routing sieht; ein Einbruch heißt, dass Netze verschwinden.',
      direction: 'down', kind: 'count', weight: 0.8, unit: 'Präfixe', intervalMinutes: 1440, holdHours: 48,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 14 },
      thresholds: { relFloor: 0.01 },
      banalCauses: ['Aggregation/Deaggregation von Präfixen', 'Ausfall einzelner RIS-Peers'],
    },
    {
      ...common, id: 'cyber.routing.asn_visibility_critical_de', name: 'Sichtbarkeit kritischer deutscher ASNs',
      plain: 'Anteil der Messpunkte, die große deutsche Netze (Telekom, Vodafone, DE-CIX, Hetzner, IONOS) im Routing sehen; Durchschnitt über fünf Netze.',
      direction: 'down', kind: 'gauge', weight: 0.75, unit: 'Anteil (0 bis 1)', intervalMinutes: 60, holdHours: 12,
      baseline: { method: 'rolling', windowDays: 28, minPoints: 48 },
      thresholds: { absFloor: 0.02 },
      banalCauses: ['Wartung', 'Ausfall einzelner RIS-Peers'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const today = floorDay(ctx.now).getTime();

    try {
      const start = isoDay(daysAgo(ctx.now, HISTORY_DAYS));
      const end = isoDay(daysAgo(ctx.now, 1));
      const url = `${BASE}/country-routing-stats/data.json?resource=DE&starttime=${start}&endtime=${end}`;
      const pts = parseCountryStats(await ctx.http.json(url, { fixture: `ripe-stat/country-routing-stats-DE-${HISTORY_DAYS}d.json` }));
      if (pts.length === 1 && pts[0].ts === null) {
        observations.push(obs('cyber.routing.country_prefix_visibility_de', floorHour(ctx.now), pts[0].value));
      } else {
        for (const p of pts) if (p.ts !== null && p.ts < today) observations.push(obs('cyber.routing.country_prefix_visibility_de', p.ts, p.value));
      }
    } catch (e) {
      ctx.log(`RIPEstat country-routing-stats übersprungen: ${(e as Error).message}`);
    }

    const shares: number[] = [];
    for (const asn of CRITICAL_ASNS) {
      try {
        shares.push(parseRoutingStatus(await ctx.http.json(`${BASE}/routing-status/data.json?resource=${asn}`, { fixture: `ripe-stat/routing-status-${asn}.json` })));
      } catch (e) {
        ctx.log(`RIPEstat ${asn} übersprungen: ${(e as Error).message}`);
      }
    }
    // Mittelwert nur über die vollständige Liste, sonst verschiebt ein fehlender ASN den Wert.
    if (shares.length === CRITICAL_ASNS.length) {
      observations.push(obs('cyber.routing.asn_visibility_critical_de', floorHour(ctx.now), shares.reduce((a, b) => a + b, 0) / shares.length, { asns: CRITICAL_ASNS }));
    } else ctx.log('RIPEstat: ASN-Mittelwert ausgelassen, Liste unvollständig');
    return { observations };
  },
};

export default collector;
