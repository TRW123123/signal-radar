// Bitcoin-Mempool: empfohlene Gebühr und Größe der Warteschlange (Proxy für Krypto-Infrastruktur-Störungen und Fluchtbewegungen).
// Source: mempool.space REST API, kein Key. Doku: https://mempool.space/docs/api/rest
// Lizenz: Software AGPL, API frei nutzbar bei fairer Nutzung (ein Abruf je Lauf, 2 Requests).
// Gemessen: fastestFee (sat/vB) und Mempool-Größe (vsize in Megabyte virtuell), jeweils Momentwert.
// Keine Historie über diese Endpunkte: die Baseline baut sich über die Läufe auf.
// Harmlose Ursachen: Ordinals/Inscriptions/Runes-Wellen, Kursrallyes, Halving, Blockfindungs-Zufall (Gebühren schwanken stündlich).
// VERIFIED: nein ({fastestFee,halfHourFee,hourFee,economyFee,minimumFee} und {count,vsize,total_fee,fee_histogram} nach Gedächtnis).

import type { Collector } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

interface Fees { fastestFee?: unknown; halfHourFee?: unknown }
interface Pool { count?: unknown; vsize?: unknown }

export function parseFees(body: Fees): number {
  const v = num(body.fastestFee);
  return expect(v, 'fastestFee');
}

/** vsize in virtual megabytes, plus transaction count. */
export function parsePool(body: Pool): { vMB: number; count: number | null } {
  const vsize = expect(num(body.vsize), 'vsize');
  return { vMB: Math.round(vsize / 1e4) / 100, count: num(body.count) };
}

const common = {
  scenarios: ['cyber'], domain: 'finance', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'gauge' as const,
  manipulability: 'medium' as const, independenceGroup: 'mempool-space', collector: 'mempool-space',
  intervalMinutes: 15, holdHours: 6, license: 'API frei, faire Nutzung',
  baseline: { method: 'rolling' as const, windowDays: 14, minPoints: 48 },
};

const collector: Collector = {
  id: 'mempool-space',
  title: 'mempool.space (Bitcoin-Mempool)',
  sourceUrl: 'https://mempool.space/docs/api/rest',
  intervalMinutes: 15,
  signals: [
    {
      ...common, id: 'cyber.finance.mempool_fee_spike', name: 'Bitcoin: empfohlene Gebühr', weight: 0.3, unit: 'sat/vB',
      plain: 'Wie viel eine schnelle Bitcoin-Überweisung kostet; steigt, wenn viele gleichzeitig Geld bewegen.',
      thresholds: { absFloor: 2 },
    },
    {
      ...common, id: 'cyber.finance.mempool_size', name: 'Bitcoin: Größe der Warteschlange', weight: 0.25, unit: 'MvB',
      plain: 'Wie viele Bitcoin-Überweisungen auf Bestätigung warten; wächst bei Ansturm oder Störungen.',
      thresholds: { absFloor: 1 },
    },
  ],
  async collect(ctx) {
    const ts = Math.floor(ctx.now.getTime() / 900_000) * 900_000;
    const observations = [];
    const fees = parseFees(await ctx.http.json<Fees>('https://mempool.space/api/v1/fees/recommended', { fixture: 'mempool/fees.json' }));
    observations.push(obs('cyber.finance.mempool_fee_spike', ts, fees));
    try {
      const pool = parsePool(await ctx.http.json<Pool>('https://mempool.space/api/mempool', { fixture: 'mempool/pool.json' }));
      observations.push(obs('cyber.finance.mempool_size', ts, pool.vMB, { count: pool.count }));
    } catch (e) {
      ctx.log(`Mempool-Größe übersprungen: ${(e as Error).message}`);
    }
    return { observations };
  },
};

export default collector;
