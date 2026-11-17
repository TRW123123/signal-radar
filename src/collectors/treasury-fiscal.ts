// US Treasury Fiscal Data: Kontostand des US-Finanzministeriums bei der Fed (Treasury General Account, TGA), Klasse A (amtliche Tagesmeldung).
// Quelle: https://api.fiscaldata.treasury.gov (Doku: https://fiscaldata.treasury.gov/api-documentation/), Datensatz Daily Treasury Statement,
//   Tabelle operating_cash_balance. Kein Key.
// Lizenz: gemeinfrei (US-Regierung).
// Gemessen: Schlussstand des TGA je Geschäftstag in Mio. USD (45 Tage Historie, ca. 5 kB). Ein rascher Aufbau entzieht dem Markt Reserven
//   und kann Repo-Zinsen hochtreiben; ein Abbau führt Liquidität zu.
// Harmlose Ursachen: Steuertermine (15. Jan/Apr/Jun/Sep, Monatsmitte), Auktions-Abwicklung, Schuldenobergrenze-Episoden.
// Annahmen laut Doku, nicht gegen eine echte Antwort geprüft: { data: [{ record_date, account_type, close_today_bal }] }, Zahlen als Text,
//   Konto „Treasury General Account (TGA) Closing Balance“ (älteres Schema) bzw. „Treasury General Account (TGA)“ (neueres Schema).
//   Daten sind am Folgetag verfügbar; der Tageswert des laufenden Tages wird nicht gemeldet.
// VERIFIED: nein (Endpunkt nach Doku und Recherche, Aufzeichnung steht aus; Queue-Datei fixtures/queue/treasury-fiscal.json)

import type { Collector, Observation } from '../core/types.ts';
import { expect, isoDay, num, obs } from './_helpers.ts';

const SIG = 'finance.money_market.us_tga_balance';
const URL_TGA = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance'
  + '?fields=record_date,account_type,close_today_bal'
  + '&filter=account_type:in:(Treasury%20General%20Account%20(TGA)%20Closing%20Balance,Treasury%20General%20Account%20(TGA))'
  + '&sort=-record_date&page[size]=45';

export function parseTga(body: unknown, today: string): Observation[] {
  const root = expect(body && typeof body === 'object' ? (body as { data?: unknown }) : null, 'Antwortobjekt');
  const rows = expect(Array.isArray(root.data) ? (root.data as Record<string, unknown>[]) : null, 'data');
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const day = String(r.record_date ?? '');
    const type = String(r.account_type ?? '');
    const v = num(r.close_today_bal);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= today || v === null || !/Treasury General Account/i.test(type)) continue;
    perDay.set(day, v);
  }
  return [...perDay.entries()].sort().map(([d, v]) => obs(SIG, `${d}T00:00:00Z`, v));
}

const collector: Collector = {
  id: 'treasury-fiscal',
  title: 'US Treasury Fiscal Data (TGA-Kontostand)',
  sourceUrl: 'https://fiscaldata.treasury.gov/api-documentation/',
  intervalMinutes: 720,
  signals: [{
    id: SIG, scenarios: ['finance'], domain: 'money_market', collector: 'treasury-fiscal',
    name: 'US-Staatskonto bei der Fed (TGA)',
    plain: 'Wie viel Geld die US-Regierung bei der Fed hält; schnelles Auffüllen entzieht dem Markt Reserven.',
    evidenceClass: 'A', direction: 'both', kind: 'gauge', weight: 0.3, manipulability: 'low', independenceGroup: 'treasury-fiscal',
    unit: 'Mio. USD', intervalMinutes: 1440, holdHours: 72, maxAgeHours: 120,
    baseline: { method: 'rolling', windowDays: 90, minPoints: 30 }, thresholds: { relFloor: 0.05 },
    sourceName: 'US Treasury Fiscal Data API', sourceUrl: 'https://fiscaldata.treasury.gov/api-documentation/', license: 'gemeinfrei (US-Regierung)',
    banalCauses: ['Steuertermine', 'Auktions-Abwicklung', 'Schuldenobergrenze'],
  }],
  async collect(ctx) {
    const body = await ctx.http.json<unknown>(URL_TGA, { fixture: 'treasury/tga-balance.json' });
    return { observations: parseTga(body, isoDay(ctx.now)) };
  },
};

export default collector;
