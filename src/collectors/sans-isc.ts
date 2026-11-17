// SANS Internet Storm Center / DShield: tägliche Summe der Sensor-Meldungen freiwilliger Honeypots (Klasse A).
// Quelle: https://isc.sans.edu/api/dailysummary/<von>/<bis>?json und .../topports/records/10/<datum>?json
// Doku: https://isc.sans.edu/api/ (Regeln: aussagekräftiger User-Agent, höchstens 1 Anfrage pro Sekunde)
// Lizenz: CC BY-NC-SA (laut ISC, Namensnennung: SANS Internet Storm Center). Vor kommerzieller Nutzung prüfen.
// Gemessen: Meldungen (records) je UTC-Tag über 60 Tage Historie; der laufende Tag wird nicht gemeldet.
//           Die Top-10-Ports des letzten vollständigen Tages hängen als `meta.topPorts` an dessen Beobachtung
//           (nur Portnummern und Zähler, keine IP-Adressen).
// Harmlose Ursachen: Forschungsscanner, Botnet-Rauschen, Änderungen in der Zahl der Sensoren, Ausfälle einzelner Sensoren.
// Ausgelassen: OT-Port-Signal (Endpunkt nicht belegt), Infocon (Klasse C, nur Ampel, keine Historie).
// VERIFIED: nein (Form nach Gedächtnis: Array von { date, records|reports, sources, targets }; topports: Array von
//           { rank, targetport, records, targets, sources }; Parser akzeptiert auch ein Wrapper-Objekt).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const SIGNAL = 'cyber.threat.dshield_port_scan_spike';

function rows(body: unknown, what: string): Record<string, unknown>[] {
  let v: unknown = body;
  if (v && !Array.isArray(v) && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    v = o.dailysummary ?? o.topports ?? o.data ?? Object.values(o).find(Array.isArray);
  }
  return expect(Array.isArray(v) ? (v as Record<string, unknown>[]) : null, what);
}

export interface Day { day: string; records: number; sources: number | null; targets: number | null }

export function parseDailySummary(body: unknown): Day[] {
  const out: Day[] = [];
  for (const r of rows(body, 'Tagesliste (dailysummary)')) {
    const day = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
    const records = num(r.records ?? r.reports);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || records === null) continue;
    out.push({ day, records, sources: num(r.sources), targets: num(r.targets) });
  }
  return out;
}

export function parseTopPorts(body: unknown): { port: number; records: number }[] {
  const out: { port: number; records: number }[] = [];
  for (const r of rows(body, 'Portliste (topports)')) {
    const port = num(r.targetport ?? r.port);
    const records = num(r.records);
    if (port !== null && records !== null) out.push({ port, records });
  }
  return out;
}

export function toObservations(days: Day[], now: Date, topPorts: { port: number; records: number }[] = []): Observation[] {
  const today = isoDay(now);
  const done = days.filter((d) => d.day < today).sort((a, b) => a.day.localeCompare(b.day));
  const latest = done.length ? done[done.length - 1].day : null;
  return done.map((d) => obs(SIGNAL, `${d.day}T00:00:00Z`, d.records, {
    ...(d.sources !== null ? { sources: d.sources } : {}),
    ...(d.targets !== null ? { targets: d.targets } : {}),
    ...(d.day === latest && topPorts.length ? { topPorts } : {}),
  }));
}

const collector: Collector = {
  id: 'sans-isc',
  title: 'SANS ISC / DShield API',
  sourceUrl: 'https://isc.sans.edu/api/',
  intervalMinutes: 360,
  signals: [{
    id: SIGNAL, scenarios: ['cyber'], domain: 'threat', name: 'DShield Sensor-Meldungen pro Tag',
    plain: 'Wie viele Verbindungsversuche die freiwilligen Messfallen des SANS Internet Storm Center pro Tag melden.',
    evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.65, manipulability: 'medium',
    independenceGroup: 'sans-isc', unit: 'Meldungen/Tag', intervalMinutes: 1440, holdHours: 72,
    baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
    license: 'CC BY-NC-SA (laut ISC)',
  }],
  async collect(ctx) {
    const from = isoDay(daysAgo(ctx.now, 60));
    const to = isoDay(daysAgo(ctx.now, 1));
    const days = parseDailySummary(await ctx.http.json<unknown>(
      `https://isc.sans.edu/api/dailysummary/${from}/${to}?json`, { fixture: 'sans-isc/dailysummary.json' }));
    let top: { port: number; records: number }[] = [];
    try {
      top = parseTopPorts(await ctx.http.json<unknown>(
        `https://isc.sans.edu/api/topports/records/10/${to}?json`, { fixture: 'sans-isc/topports.json' }));
    } catch (e) {
      ctx.log(`Top-Ports übersprungen: ${(e as Error).message}`);
    }
    return { observations: toObservations(days, ctx.now, top) };
  },
};

export default collector;
