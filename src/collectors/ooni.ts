// Anteil anomaler Web-Messungen je Land und Tag als Proxy für Störungen und Zensur (Evidenzklasse A: Messung durch Probe-Netz).
// Quelle: OONI Measurement Aggregation API, kein Key. Doku: https://docs.ooni.org/api/ (Endpunkt /api/v1/aggregation)
// Lizenz: OONI-Daten CC BY 4.0 (Quellenangabe OONI). Fair-Use-Rate-Limit; wir stellen eine Anfrage je Land und Lauf.
// Gemessen: test_name=web_connectivity, anomaly_count / measurement_count in Prozent, je Land (probe_cc) und UTC-Tag.
// Tage mit weniger als MIN_MEASUREMENTS Messungen werden nicht gemeldet (zu verrauscht). Der laufende Tag wird nicht gemeldet.
// Länder je Szenario: src/collectors/config/<szenario>.ts (Feld ooni), ein Eintrag = ein Signal; dasselbe Land in zwei Szenarien = ein Request.
// Fenster 30 Tage (DEFAULT_WINDOW_DAYS): eine Zeile hat ca. 145 Zeichen, die Antwort also ca. 4 500 statt 11 000 Zeichen (75 Tage);
// die Aufzeichnungs-Umgebung nimmt nur ca. 6 000 Zeichen. Ältere Historie baut der Speicher Lauf für Lauf auf.
// Harmlose Ursachen für Ausschläge: Änderungen der Testliste oder der Probe-Zusammensetzung (wenige Freiwillige), ein einzelner
// Probe-Betreiber mit kaputtem Netz, staatlich angeordnete Sperren (Zensur ist hier eher Normalzustand als Cyberlage), Messartefakte.
// Antwortform: {"result":[{"measurement_start_day":"YYYY-MM-DD","anomaly_count":..,"confirmed_count":..,"failure_count":..,"ok_count":..,"measurement_count":..}]}
// Szenario war: Länder der Konfliktregionen (IR, IL, UA, RU, TW), Signale war.connectivity.ooni_anomaly_share_<cc>. Golfstaaten (SA, AE, QA) bewusst nicht: zu wenige Messungen je Tag
// (unter MIN_MEASUREMENTS), die Reihen bestünden aus Lücken; für den Golf trägt IODA. Harmlose Ursachen (war): in IR/RU ist Zensur Normalzustand
// (hoher Sockel), Wechsel der Testliste, wenige Probe-Betreiber, Kriegsschäden am Netz. VERIFIED (war): nein.
// VERIFIED: ja (17.11.2026, echte Antwort mit 75 Tagen): 2 bis 5 % anomal, über 60 000 Messungen je Tag; Antwort mit 30 Tagen steht zur Aufzeichnung aus.

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs } from './_helpers.ts';
import { declare, scenarioEntries } from './_scenario.ts';

export const MIN_MEASUREMENTS = 100;
/** Standard-Fenster neuer Länder (Tage); rund 145 Zeichen je Tag. */
export const DEFAULT_WINDOW_DAYS = 30;

/** Länder aller Szenarien (src/collectors/config/<szenario>.ts, Feld ooni). */
const ENTRIES = scenarioEntries('ooni');
export interface Country { signalId: string; cc: string; windowDays: number }
export const COUNTRIES: Country[] = ENTRIES.map((e) => ({ signalId: e.signal.id, cc: e.cc, windowDays: e.windowDays ?? DEFAULT_WINDOW_DAYS }));

const DEFAULTS = {
  evidenceClass: 'A' as const, direction: 'up' as const, kind: 'rate' as const, weight: 0.25, manipulability: 'medium' as const,
  independenceGroup: 'ooni', unit: '% anomal', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 56, minPoints: 21 },
  license: 'CC BY 4.0 (OONI)',
  banalCauses: ['Wechsel der Testliste', 'Wenige Probe-Betreiber', 'Einzelner defekter Anschluss', 'Behördliche Sperren'],
};

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

export function buildUrl(cc: string, now: Date, windowDays = DEFAULT_WINDOW_DAYS): string {
  const since = isoDay(daysAgo(now, windowDays));
  const until = isoDay(now);
  return `https://api.ooni.io/api/v1/aggregation?probe_cc=${cc}&test_name=web_connectivity&since=${since}&until=${until}&axis_x=measurement_start_day`;
}
/** Mit Tageszahl im Namen: frühere Aufzeichnungen (75 Tage, ca. 11 000 Zeichen) hießen ooni/web-connectivity-<cc>-daily.json. */
export function fixtureName(cc: string, windowDays = DEFAULT_WINDOW_DAYS): string {
  return `ooni/web-connectivity-${cc.toLowerCase()}-${windowDays}d.json`;
}

const collector: Collector = {
  id: 'ooni',
  title: 'OONI Aggregation API',
  sourceUrl: 'https://docs.ooni.org/api/',
  intervalMinutes: 720,
  signals: ENTRIES.map((e) => declare(DEFAULTS, e.scenario, e.signal)),
  async collect(ctx) {
    const today = isoDay(ctx.now);
    const observations: Observation[] = [];
    let ok = 0;
    const fetched = new Map<string, Promise<Map<string, { share: number; n: number }>>>(); // gleiche Anfrage nur einmal je Lauf
    for (const c of COUNTRIES) {
      const minDay = isoDay(new Date(ctx.now.getTime() - c.windowDays * DAY_MS));
      const key = `${c.cc}|${c.windowDays}`;
      if (!fetched.has(key)) fetched.set(key, ctx.http.json<Resp>(buildUrl(c.cc, ctx.now, c.windowDays), { fixture: fixtureName(c.cc, c.windowDays) }).then(parse));
      try {
        const days = await fetched.get(key)!;
        for (const [day, v] of [...days.entries()].sort()) {
          if (day >= today || day < minDay) continue;
          if (v.n < MIN_MEASUREMENTS) { ctx.log(`OONI ${c.cc} ${day}: nur ${v.n} Messungen, übersprungen`); continue; }
          observations.push(obs(c.signalId, `${day}T00:00:00Z`, v.share, { measurements: v.n }));
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
