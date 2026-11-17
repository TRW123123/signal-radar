// Zahl erreichbarer Bitcoin-Knoten (Internet-Partitionen und Störungen zeigen sich als Einbruch).
// Source: Bitnodes API, Snapshot-Liste ohne Knotenliste. Doku: https://bitnodes.io/api/
// Lizenz/Nutzung: öffentlich, Nutzungsbedingungen nicht eindeutig; nur ein passiver Abruf der veröffentlichten Snapshots,
// anonym begrenzt (daher ein Request je Lauf, kein eigenes Scannen). Quelle nennen.
// Gemessen: total_nodes je Snapshot (alle ~10 Minuten), die letzten 100 Snapshots (gut 16 Stunden).
// Harmlose Ursachen: Probleme des Bitnodes-Crawlers, Knotenwechsel (Tor/IPv6), Software-Updates.
// VERIFIED: nein (Form {count,next,previous,results:[{timestamp,total_nodes,latest_height}]} nach Gedächtnis).

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

interface Resp { results?: { timestamp?: unknown; total_nodes?: unknown }[] }

export function parseSnapshots(body: Resp) {
  const results = expect(body.results, 'results');
  const out = [];
  for (const r of results) {
    const t = num(r.timestamp), n = num(r.total_nodes);
    if (t === null || n === null || n <= 0) continue;
    out.push(obs('cyber.finance.bitcoin_network_nodes', t * 1000, n));
  }
  return out.sort((a, b) => a.ts.localeCompare(b.ts));
}

const collector: Collector = {
  id: 'bitnodes',
  title: 'Bitnodes (erreichbare Bitcoin-Knoten)',
  sourceUrl: 'https://bitnodes.io/api/',
  intervalMinutes: 60,
  signals: [{
    id: 'cyber.finance.bitcoin_network_nodes', scenarios: ['cyber'], domain: 'finance', collector: 'bitnodes',
    name: 'Erreichbare Bitcoin-Knoten',
    plain: 'Wie viele Bitcoin-Rechner weltweit erreichbar sind; ein Einbruch kann auf Internet-Störungen hindeuten.',
    evidenceClass: 'A', direction: 'down', kind: 'count', weight: 0.45, manipulability: 'low', independenceGroup: 'bitnodes',
    unit: 'Knoten', intervalMinutes: 10, holdHours: 12, license: 'öffentlich, Nutzungsbedingungen unklar',
    baseline: { method: 'rolling', windowDays: 7, minPoints: 48 }, thresholds: { relFloor: 0.01 },
  }],
  async collect(ctx) {
    const body = await ctx.http.json<Resp>('https://bitnodes.io/api/v1/snapshots/?limit=100', { fixture: 'bitnodes/snapshots.json' });
    return { observations: parseSnapshots(body) };
  },
};

export default collector;
