// Planetarer Kp-Index als Kontext-Signal (Gewicht 0, wird von der Dämpfungsregel "geomagnetic-storm" gelesen).
// Quelle: NOAA Space Weather Prediction Center, https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
// (Produktbeschreibung: https://www.swpc.noaa.gov/products/planetary-k-index), kein Key. Lizenz: US-Regierungsdaten, gemeinfrei.
// Gemessen: Kp je 3-Stunden-Intervall (0 bis 9), Zeitstempel = Intervallbeginn in UTC. Das laufende Intervall ist ein Schätzwert
// und wird bewusst mitgeliefert, weil ein laufender Sturm genau das ist, was die Dämpfungsregel braucht.
// Akzeptiert beide bekannten Formate: Array von Objekten ({ time_tag, Kp, ... }) und Array von Arrays mit Kopfzeile.
// Röntgenfluss: nicht gebaut (xrays-1-day.json hat ~2900 Einträge, nicht klein abrufbar).
// VERIFIED: ja (17.11.2026, echte Antwort: Array von Objekten { time_tag "2026-11-10T00:00:00" (UTC ohne Z), Kp, a_running, station_count }, 56 Einträge = 7 Tage, Kp 0-3,7).

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

export function parseKp(body: unknown): { ts: string; kp: number }[] {
  const rows = expect(Array.isArray(body) ? body : null, 'Kp-Liste');
  const out: { ts: string; kp: number }[] = [];
  let header: string[] | null = null;
  for (const r of rows) {
    let time: unknown;
    let kp: unknown;
    if (Array.isArray(r)) {
      if (!header) { header = r.map((x) => String(x).toLowerCase()); continue; }
      const ti = header.indexOf('time_tag');
      const ki = header.indexOf('kp');
      if (ti < 0 || ki < 0) throw new Error('unerwartete Antwort: Spalten time_tag/Kp fehlen');
      time = r[ti]; kp = r[ki];
    } else if (r && typeof r === 'object') {
      const o = r as Record<string, unknown>;
      time = o.time_tag; kp = o.Kp ?? o.kp;
    } else continue;
    const v = num(kp);
    if (typeof time !== 'string' || v === null || v < 0 || v > 9) continue;
    const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(time) ? time.replace(' ', 'T') : time.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) continue;
    out.push({ ts: d.toISOString(), kp: v });
  }
  return out;
}

const collector: Collector = {
  id: 'noaa-swpc',
  title: 'NOAA SWPC (Kp-Index)',
  sourceUrl: 'https://services.swpc.noaa.gov/products/',
  intervalMinutes: 180,
  signals: [
    {
      id: 'cyber.context.geomagnetic_kp', scenarios: ['cyber'], domain: 'context', name: 'Geomagnetische Aktivität (Kp-Index)',
      plain: 'Wie stark Sonnenstürme das Erdmagnetfeld gerade stören; hohe Werte erklären GPS-, Funk- und Satellitenprobleme natürlich.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0, manipulability: 'low', independenceGroup: 'noaa-swpc',
      unit: 'Kp', intervalMinutes: 180, holdHours: 12,
      baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      license: 'US-Regierungsdaten, gemeinfrei',
    },
  ],
  async collect(ctx) {
    const body = await ctx.http.json<unknown>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { fixture: 'noaa-swpc/planetary-k-index.json' });
    return { observations: parseKp(body).map((p) => obs('cyber.context.geomagnetic_kp', p.ts, p.kp)) };
  },
};

export default collector;
