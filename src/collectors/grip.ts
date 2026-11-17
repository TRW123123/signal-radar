// GRIP (Global Routing Intelligence Platform, Georgia Tech): automatisch erkannte BGP-Ereignisse (MOAS = mehrere Ursprungsnetze
// für dasselbe Präfix, mögliche Hijacks). Doku: https://api.grip.inetintel.cc.gatech.edu/json/events (Parameter laut Erinnerung:
// event_type, ts_start, ts_end, min_susp, length, start; Antwort mit recordsTotal).
// Lizenz/Nutzung: unklar, öffentlich ohne Key, fair use. Es wird nur ein Zähler je Stunde gelesen (length=1), kein Ereignisinhalt.
// Gemessen: Zahl verdächtiger MOAS-Ereignisse (min_susp=80), die in der jeweiligen Stunde beobachtet wurden.
// Harmlose Ursachen: Fehlkonfigurationen, legitime MOAS (Anycast, Multihoming), Änderung der Erkennungsregeln bei GRIP.
// Route-Leaks (Katalog-Signal route_leaks) nicht gebaut: GRIP hat laut Erinnerung keinen Ereignistyp dafür.
// 6 Requests pro Lauf (eine je abgeschlossener Stunde); der Speicher ignoriert schon bekannte Stunden.
// Echte Antwort (17.11.2026): {copyright, data:[Ereignis...], draw, recordsFiltered, recordsTotal}. recordsFiltered ist 0, auch
// wenn data ein Ereignis enthält; recordsTotal zählt die Treffer (1 bei einem Ereignis). Deshalb wird recordsTotal gelesen.
// length=1 hält die Antwort bei ca. 10 000 Zeichen (ein Ereignis ist groß), ohne Treffer 400 Zeichen.
// VERIFIED: ja (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel)

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

const BASE = 'https://api.grip.inetintel.cc.gatech.edu/json/events';
const HOURS_BACK = 6;

export function parseCount(body: unknown): number {
  const b = expect(body as { recordsTotal?: unknown; data?: unknown } | null, 'Antwort');
  const n = expect(num(b.recordsTotal), 'recordsTotal');
  if (n < 0) throw new Error('unerwartete Antwort: recordsTotal negativ');
  return Math.max(n, Array.isArray(b.data) ? b.data.length : 0);
}

export function hourUrl(startSec: number): string {
  return `${BASE}?event_type=moas&min_susp=80&ts_start=${startSec}&ts_end=${startSec + 3600}&length=1`;
}

const collector: Collector = {
  id: 'grip',
  title: 'GRIP BGP-Hijack-Ereignisse',
  sourceUrl: 'https://api.grip.inetintel.cc.gatech.edu/json/events',
  intervalMinutes: 60,
  signals: [
    {
      id: 'cyber.routing.hijack_events', scenarios: ['cyber'], domain: 'routing', name: 'BGP-Hijack-Ereignisse (verdächtige MOAS)',
      plain: 'Wie viele verdächtige Fälle pro Stunde erkannt werden, in denen ein fremdes Netz Präfixe eines anderen für sich beansprucht.',
      evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.6, manipulability: 'medium', independenceGroup: 'grip',
      unit: 'Ereignisse/Stunde', intervalMinutes: 60, holdHours: 12,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      license: 'unklar (öffentlich, fair use)',
      sourceName: 'GRIP (Georgia Tech)', sourceUrl: 'https://api.grip.inetintel.cc.gatech.edu/json/events',
      banalCauses: ['Fehlkonfigurationen', 'legitime MOAS (Anycast)', 'Änderung der Erkennungsregeln'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const endSec = Math.floor(ctx.now.getTime() / 3600_000) * 3600; // laufende Stunde ausschließen
    let ok = 0;
    for (let i = HOURS_BACK; i >= 1; i--) {
      const start = endSec - i * 3600;
      try {
        const n = parseCount(await ctx.http.json(hourUrl(start), { fixture: `grip/moas-${start}.json` }));
        observations.push(obs('cyber.routing.hijack_events', start * 1000, n));
        ok++;
      } catch (e) {
        ctx.log(`GRIP Stunde ${start} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('GRIP: keine Stunde abrufbar');
    return { observations };
  },
};

export default collector;
