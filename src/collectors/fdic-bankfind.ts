// FDIC BankFind: gescheiterte US-Banken (Klasse B: amtliche Schließungen durch die Einlagensicherung).
// Quelle: https://banks.data.fdic.gov/api/failures (Doku: https://banks.data.fdic.gov/docs/), kein Key.
// Lizenz: gemeinfrei (US-Regierung), Quellenangabe FDIC.
// Anfrage: Schließungen der letzten 150 Tage, neueste zuerst, höchstens 50 Zeilen, nur die Felder NAME, FAILDATE, QBFASSET (kleine Antwort, ca. 3 kB).
// Gemessen: je Tag die Zahl der Schließungen in den 90 Tagen bis einschließlich dieses Tages (60 Tage Historie). Einzelne Schließungen
//   kleiner Banken sind normal (wenige pro Jahr); eine Häufung zeigt Stress im Bankensystem.
// Harmlose Ursachen: einzelne Kleinstbanken (Betrug, Kapitalmangel), Freitags-Schließungen, die bereits lange absehbar waren.
// Annahmen laut Doku, nicht gegen eine echte Antwort geprüft: Antwort { meta, data: [{ data: { NAME, FAILDATE, QBFASSET }, score }] }; FAILDATE als
//   „M/D/YYYY“ oder ISO-Datum (beides wird gelesen). Ist `data` leer, gilt das als 0 Schließungen.
// VERIFIED: ja (17.11.2026, echte Antwort live abgerufen; Parser läuft, Werte plausibel)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const SIG = 'finance.banks.fdic_failed_list';
const LOOKBACK_DAYS = 150;
const COUNT_DAYS = 90;
const HIST_DAYS = 60;

export interface Failure { day: string; name: string; assets: number | null }

/** Wandelt „3/10/2023“ oder „2023-03-10“ in YYYY-MM-DD; sonst null. */
export function toIsoDay(s: unknown): string | null {
  const t = String(s ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

export function parseFailures(body: unknown): Failure[] {
  const root = expect(body && typeof body === 'object' ? (body as { data?: unknown }) : null, 'Antwortobjekt');
  const rows = expect(Array.isArray(root.data) ? (root.data as { data?: Record<string, unknown> }[]) : null, 'data');
  const out: Failure[] = [];
  for (const r of rows) {
    const d = r?.data ?? (r as Record<string, unknown>);
    const day = toIsoDay((d as Record<string, unknown>)?.FAILDATE);
    if (!day) continue;
    out.push({ day, name: String((d as Record<string, unknown>).NAME ?? ''), assets: num((d as Record<string, unknown>).QBFASSET) });
  }
  return out;
}

/** Je Tag die Zahl der Schließungen der 90 Tage bis einschließlich dieses Tages; nur Tage vor `now`. */
export function rollingCounts(list: Failure[], now: Date): Observation[] {
  const out: Observation[] = [];
  const times = list.map((f) => Date.parse(`${f.day}T00:00:00Z`));
  for (let i = HIST_DAYS; i >= 1; i--) {
    const end = Date.parse(`${isoDay(daysAgo(now, i))}T00:00:00Z`);
    const n = times.filter((t) => t <= end && t > end - COUNT_DAYS * DAY_MS).length;
    out.push(obs(SIG, end, n));
  }
  return out;
}

const collector: Collector = {
  id: 'fdic-bankfind',
  title: 'FDIC BankFind: gescheiterte US-Banken',
  sourceUrl: 'https://banks.data.fdic.gov/docs/',
  intervalMinutes: 720,
  signals: [{
    id: SIG, scenarios: ['finance'], domain: 'banks', collector: 'fdic-bankfind',
    name: 'FDIC: Schließungen von Banken (letzte 90 Tage)',
    plain: 'Wie viele US-Banken in den letzten 90 Tagen von der Einlagensicherung geschlossen wurden; einzelne sind normal, eine Häufung ist ein Alarmzeichen.',
    evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.9, manipulability: 'low', independenceGroup: 'fdic-bankfind',
    unit: 'Anzahl', intervalMinutes: 1440, holdHours: 168, maxAgeHours: 72,
    baseline: { method: 'rolling', windowDays: 365, minPoints: 30 }, thresholds: { absFloor: 0.5 },
    sourceName: 'FDIC BankFind Suite API', sourceUrl: 'https://banks.data.fdic.gov/docs/', license: 'gemeinfrei (US-Regierung)',
    banalCauses: ['Einzelne Kleinstbanken', 'Betrugsfälle bei kleinen Instituten'],
  }],
  async collect(ctx) {
    const from = isoDay(daysAgo(ctx.now, LOOKBACK_DAYS));
    const url = `https://banks.data.fdic.gov/api/failures?filters=FAILDATE%3A%5B${from}%20TO%20*%5D&fields=NAME%2CFAILDATE%2CQBFASSET&sort_by=FAILDATE&sort_order=DESC&limit=50`;
    const body = await ctx.http.json<unknown>(url, { fixture: 'fdic/failures-recent.json' });
    return { observations: rollingCounts(parseFailures(body), ctx.now) };
  },
};

export default collector;
