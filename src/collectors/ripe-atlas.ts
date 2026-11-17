// RIPE Atlas: Zahl der verbundenen Messgeräte (Probes) als Gesundheits-Proxy für Netze eines Landes.
// Doku: https://atlas.ripe.net/docs/apis/rest-api-manual/ (Endpunkt /api/v2/probes/, Feld `count` der paginierten Antwort)
// Lizenz/Nutzung: RIPE Atlas Nutzungsbedingungen, lesender Zugriff ohne Key, fair use. Es wird nichts gescannt oder gemessen,
// nur der Zähler der öffentlichen Probe-Liste gelesen (page_size=1).
// Gemessen: Anzahl Probes mit status=1 (connected) in Deutschland und weltweit, eine Momentaufnahme je Lauf.
// Harmlose Ursachen: Firmware-Updates (Probes starten gestaffelt neu), Stromausfälle einzelner Regionen, Wachstum der Probe-Zahl.
// Messreihen (Root-DNS, Ping) wurden nicht gebaut: Zuordnung der Measurement-IDs ist ungeprüft.
// VERIFIED: nein. Form `{count, next, previous, results}` aus dem Gedächtnis; Doku war beim Bau nicht abrufbar.

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const BASE = 'https://atlas.ripe.net/api/v2/probes/';

export function parseProbeCount(body: unknown): number {
  const b = expect(body as { count?: unknown } | null, 'Antwort');
  const n = expect(num(b.count), 'count');
  if (n < 0) throw new Error('unerwartete Antwort: count negativ');
  return n;
}

const SRC = { sourceName: 'RIPE Atlas', sourceUrl: 'https://atlas.ripe.net/' };
const common = {
  scenarios: ['cyber'], domain: 'outages', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'ripe-atlas', direction: 'down' as const, kind: 'count' as const, unit: 'Probes',
  intervalMinutes: 60, holdHours: 12, license: 'RIPE Atlas Nutzungsbedingungen, offen', ...SRC,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 },
};

const collector: Collector = {
  id: 'ripe-atlas',
  title: 'RIPE Atlas verbundene Probes',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: 'cyber.outages.atlas_probe_connectivity', name: 'RIPE-Atlas-Probes in Deutschland verbunden',
      plain: 'Wie viele der RIPE-Messgeräte in Deutschland gerade online sind; ein plötzlicher Abfall deutet auf Netz- oder Stromprobleme.',
      weight: 0.7, banalCauses: ['Firmware-Updates', 'Stromausfälle'],
    },
    {
      ...common, id: 'cyber.outages.atlas_probes_connected_global', name: 'RIPE-Atlas-Probes weltweit verbunden',
      plain: 'Wie viele der RIPE-Messgeräte weltweit gerade online sind; ein Abfall deutet auf eine großflächige Störung.',
      weight: 0.5, banalCauses: ['Firmware-Updates', 'Ausfall der Atlas-Infrastruktur selbst'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const ts = floorHour(ctx.now);
    const jobs = [
      { id: 'cyber.outages.atlas_probe_connectivity', url: `${BASE}?country_code=DE&status=1&page_size=1`, fixture: 'ripe-atlas/probes-DE.json' },
      { id: 'cyber.outages.atlas_probes_connected_global', url: `${BASE}?status=1&page_size=1`, fixture: 'ripe-atlas/probes-global.json' },
    ];
    for (const j of jobs) {
      try {
        observations.push(obs(j.id, ts, parseProbeCount(await ctx.http.json(j.url, { fixture: j.fixture }))));
      } catch (e) {
        ctx.log(`RIPE Atlas ${j.id} übersprungen: ${(e as Error).message}`);
      }
    }
    return { observations };
  },
};

export default collector;
