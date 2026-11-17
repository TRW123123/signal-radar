// Anteil anomaler Web-Messungen je Land und Tag als Proxy für Störungen und Zensur (Evidenzklasse A: Messung durch Probe-Netz).
// Quelle: OONI Measurement Aggregation API, kein Key. Doku: https://docs.ooni.org/api/ (Endpunkt /api/v1/aggregation)
// Lizenz: OONI-Daten CC BY 4.0 (Quellenangabe OONI). Fair-Use-Rate-Limit; wir stellen eine Anfrage je Land und Lauf.
// Gemessen: test_name=web_connectivity, anomaly_count / measurement_count in Prozent, je Land (probe_cc) und UTC-Tag.
// Tage mit weniger als MIN_MEASUREMENTS Messungen werden nicht gemeldet (zu verrauscht). Der laufende Tag wird nicht gemeldet.
// Länder sind in COUNTRIES erweiterbar (ein Eintrag = ein Signal).
// Harmlose Ursachen für Ausschläge: Änderungen der Testliste oder der Probe-Zusammensetzung (wenige Freiwillige), ein einzelner
// Probe-Betreiber mit kaputtem Netz, staatlich angeordnete Sperren (Zensur ist hier eher Normalzustand als Cyberlage), Messartefakte.
// Antwortform: {"result":[{"measurement_start_day":"YYYY-MM-DD","anomaly_count":..,"confirmed_count":..,"failure_count":..,"ok_count":..,"measurement_count":..}]}
// Szenario war: Länder der Konfliktregionen in WAR_COUNTRIES (IR, IL, UA, RU, TW), Signale war.connectivity.ooni_anomaly_share_<cc>, gleiche
// Anfrageform, eigene Fixture-Namen je Land (kein Überschneiden mit Cyber). Golfstaaten (SA, AE, QA) bewusst nicht: zu wenige Messungen je Tag
// (unter MIN_MEASUREMENTS), die Reihen bestünden aus Lücken; für den Golf trägt IODA. Harmlose Ursachen (war): in IR/RU ist Zensur Normalzustand
// (hoher Sockel), Wechsel der Testliste, wenige Probe-Betreiber, Kriegsschäden am Netz. VERIFIED (war): nein.
// VERIFIED: ja (17.11.2026, echte Antwort): 75 Tageswerte je Land, 2 bis 5 % anomal, über 60 000 Messungen je Tag.

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

export const COUNTRIES: { cc: string; name: string }[] = [
  { cc: 'DE', name: 'Deutschland' },
  { cc: 'US', name: 'USA' },
  { cc: 'GB', name: 'Großbritannien' },
  { cc: 'FR', name: 'Frankreich' },
  { cc: 'NL', name: 'Niederlande' },
];
/** Länder der Konfliktregionen (Szenario war). */
export const WAR_COUNTRIES: { cc: string; name: string }[] = [
  { cc: 'IR', name: 'Iran' },
  { cc: 'IL', name: 'Israel' },
  { cc: 'UA', name: 'Ukraine' },
  { cc: 'RU', name: 'Russland' },
  { cc: 'TW', name: 'Taiwan' },
];
export function warSignalId(cc: string): string { return `war.connectivity.ooni_anomaly_share_${cc.toLowerCase()}`; }
const ALL: { cc: string; name: string; scenario: 'cyber' | 'war' }[] = [
  ...COUNTRIES.map((c) => ({ ...c, scenario: 'cyber' as const })),
  ...WAR_COUNTRIES.map((c) => ({ ...c, scenario: 'war' as const })),
];
const sid = (c: { cc: string; scenario: 'cyber' | 'war' }) => (c.scenario === 'war' ? warSignalId(c.cc) : signalId(c.cc));
export const MIN_MEASUREMENTS = 100;
const WINDOW_DAYS = 75;

export function signalId(cc: string): string { return `cyber.outages.ooni_anomaly_share_${cc.toLowerCase()}`; }

interface Row { measurement_start_day?: unknown; anomaly_count?: unknown; measurement_count?: unknown }
interface Resp { result?: Row[] }

/** Antwort -> Map Tag -> { share (Prozent), n (Messungen) }; Tage ohne gültige Zahlen entfallen. */
export function parse(body: Resp): Map<string, { share: number; n: number }> {
  const rows = expect(body.result, 'result');
  const out = new Map<string, { share: number; n: number }>();
  for (const r of rows) {
    const day = typeof r?.measurement_start_day === 'string' ? r.measurement_start_day.slice(0, 10) : '';
    const a = num(r?.anomaly_count);
    const n = num(r?.measurement_count);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || a === null || n === null || n <= 0) continue;
    out.set(day, { share: (a / n) * 100, n });
  }
  return out;
}

export function buildUrl(cc: string, now: Date): string {
  const since = isoDay(daysAgo(now, WINDOW_DAYS));
  const until = isoDay(now);
  return `https://api.ooni.io/api/v1/aggregation?probe_cc=${cc}&test_name=web_connectivity&since=${since}&until=${until}&axis_x=measurement_start_day`;
}
export function fixtureName(cc: string): string { return `ooni/web-connectivity-${cc.toLowerCase()}-daily.json`; }

const collector: Collector = {
  id: 'ooni',
  title: 'OONI Aggregation API',
  sourceUrl: 'https://docs.ooni.org/api/',
  intervalMinutes: 720,
  signals: ALL.map((c) => ({
    id: sid(c), scenarios: [c.scenario], domain: c.scenario === 'war' ? 'connectivity' : 'outages',
    name: `Anteil anomaler Web-Messungen (${c.name})`,
    plain: `Welcher Anteil der OONI-Messungen zur Erreichbarkeit von Webseiten in ${c.name} auffällig ausfällt oder blockiert wird.`,
    evidenceClass: 'A' as const, direction: 'up' as const, kind: 'rate' as const, weight: 0.25, manipulability: 'medium' as const,
    independenceGroup: 'ooni', unit: '% anomal', intervalMinutes: 1440, holdHours: 48,
    baseline: { method: 'rolling' as const, windowDays: 56, minPoints: 21 },
    license: 'CC BY 4.0 (OONI)',
    banalCauses: ['Wechsel der Testliste', 'Wenige Probe-Betreiber', 'Einzelner defekter Anschluss', 'Behördliche Sperren'],
  })),
  async collect(ctx) {
    const today = isoDay(ctx.now);
    const minDay = isoDay(new Date(ctx.now.getTime() - WINDOW_DAYS * DAY_MS));
    const observations: Observation[] = [];
    let ok = 0;
    for (const c of ALL) {
      try {
        const days = parse(await ctx.http.json<Resp>(buildUrl(c.cc, ctx.now), { fixture: fixtureName(c.cc) }));
        for (const [day, v] of [...days.entries()].sort()) {
          if (day >= today || day < minDay) continue;
          if (v.n < MIN_MEASUREMENTS) { ctx.log(`OONI ${c.cc} ${day}: nur ${v.n} Messungen, übersprungen`); continue; }
          observations.push(obs(sid(c), `${day}T00:00:00Z`, v.share, { measurements: v.n }));
        }
        ok++;
      } catch (e) {
        ctx.log(`OONI Land ${c.cc} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('ooni: kein Land abrufbar');
    return { observations };
  },
};

export default collector;
