// Gasspeicher Deutschland und EU als Tagesreihen (Klasse A: Betreiberdaten der Speicher, Transparenzplattform GIE AGSI+), über das GitHub-Repo
// volzinnovation/de-gas-storage-tracker-bnetza, das AGSI+ täglich abruft und als CSV fortschreibt.
// Quelle: https://github.com/volzinnovation/de-gas-storage-tracker-bnetza, Datei data/gie_storage.csv (ca. 620 kB, ab 2020-04, wird täglich fortgeschrieben).
//   Zuerst alle Zeilen Deutschland (scope DE, aufsteigend), danach alle Zeilen EU (scope EU), deshalb kein Range-Abruf des Dateiendes: ganze Datei.
//   Kopf `scope,date,name,code,gas_in_storage_twh,working_gas_volume_twh,fill_pct,consumption_gwh_per_day,injection_gwh_per_day,
//   withdrawal_gwh_per_day,net_withdrawal_gwh_per_day,...,status,full_pct,norm_5y_fill_pct,source`.
// Lizenz: Repo CC0 1.0; die zugrunde liegenden AGSI+-Daten von Gas Infrastructure Europe sind frei weiterverarbeitbar, Quellenangabe
//   "GIE AGSI / ALSI platform" ist Pflicht (GIE-Bedingungen, gelesen 17.11.2026; src/core/attribution.ts). Kein Key.
// Aktualität: Stand 17.11.2026 letzter Tag 13.11.2026 (Verzug 3 bis 4 Tage). Die jüngsten Tage tragen `status` E (geschätzt, noch unvollständig;
//   z. B. Entnahme 358 statt rund 1000 GWh am 12.11.). Deshalb werden nur Zeilen mit Status C (bestätigt) gemeldet; die Reihe hinkt dadurch etwa
//   eine Woche nach (maxAgeHours 240). Auch einzelne ältere Tage mit E fehlen dann (z. B. 08.11.); Lücken sind harmlos.
//   Ausnahme EU: Dort steht seit 07.10.2026 durchgehend E (die EU-Summe wird offenbar nie auf C gesetzt, der Verlauf ist glatt). Für den EU-Füllstand
//   zählen deshalb auch E-Zeilen, nur die jüngsten 2 Tage der Reihe (noch unvollständig) werden weggelassen.
//   Ist der letzte bestätigte Tag älter als 14 Tage, wird ein Fehler geworfen (Repo nicht mehr gepflegt).
// Gemessen (je Tag, letzte 90 Tage bis gestern):
//   blackout.gas.storage_fill_de  Füllstand Deutschland in % (fill_pct)
//   blackout.gas.storage_withdrawal_rate  Netto-Entnahme Deutschland in GWh/Tag (net_withdrawal_gwh_per_day, negativ = Einspeicherung)
//   blackout.gas.storage_fill_eu  Füllstand EU in %
// Hinweis zur Baseline: Der Füllstand sinkt im Winter stetig (rund 0,3 bis 0,5 Punkte je Tag). Die Basislinie ist der Median der letzten 28 Tage mit
//   relFloor 0,06 (Streuung mindestens 6 % des Füllstands), damit der normale Abbau nicht als Ausschlag zählt.
// Harmlose Ursachen für Ausschläge: Kältewelle, Preisarbitrage der Speicherbetreiber, Umstellung vom Einspeichern aufs Ausspeichern im Herbst,
//   Wartung einzelner Speicher, nachträgliche Korrektur gemeldeter Werte.
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, daysAgo, expect, isoDay, num, obs, parseCsv } from './_helpers.ts';

const URL_CSV = 'https://raw.githubusercontent.com/volzinnovation/de-gas-storage-tracker-bnetza/main/data/gie_storage.csv';
const WINDOW_DAYS = 90;
const MAX_AGE_DAYS = 14;
const SIG_FILL_DE = 'blackout.gas.storage_fill_de';
const SIG_WD_DE = 'blackout.gas.storage_withdrawal_rate';
const SIG_FILL_EU = 'blackout.gas.storage_fill_eu';

export interface StorageDay { day: string; fillPct: number | null; netWithdrawal: number | null }
export interface StorageResult { de: StorageDay[]; eu: StorageDay[]; lastConfirmedDay: string | null }

/** Liest gie_storage.csv; Deutschland nur Status C (bestätigt), EU alle Zeilen bis 2 Tage vor Reihenende. Wirft bei fehlenden Spalten oder veralteter Reihe. Fenster: 90 Tage bis gestern. */
export function parseStorage(text: string, now: Date): StorageResult {
  const body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  const rows = parseCsv(body);
  const head = rows[0] ?? [];
  const idx = (n: string) => head.indexOf(n);
  const [iScope, iDate, iFill, iNet, iStatus] = ['scope', 'date', 'fill_pct', 'net_withdrawal_gwh_per_day', 'status'].map(idx);
  if ([iScope, iDate, iFill, iNet, iStatus].some((i) => i < 0)) throw new Error('unerwartete Antwort: Spalten scope/date/fill_pct/net_withdrawal_gwh_per_day/status fehlen');
  const from = isoDay(daysAgo(now, WINDOW_DAYS));
  const to = isoDay(now);
  const out: StorageResult = { de: [], eu: [], lastConfirmedDay: null };
  const eu: StorageDay[] = [];
  let euLast = '';
  for (const r of rows.slice(1)) {
    const day = r[iDate] ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (r[iScope] === 'EU') {
      if (day > euLast) euLast = day;
      eu.push({ day, fillPct: num(r[iFill]), netWithdrawal: num(r[iNet]) });
      continue;
    }
    if (r[iScope] !== 'DE' || r[iStatus] !== 'C') continue;
    const list = out.de;
    if ((!out.lastConfirmedDay || day > out.lastConfirmedDay)) out.lastConfirmedDay = day;
    if (day >= from && day < to) list.push({ day, fillPct: num(r[iFill]), netWithdrawal: num(r[iNet]) });
  }
  const euCut = euLast ? isoDay(new Date(Date.parse(`${euLast}T00:00:00Z`) - 2 * DAY_MS)) : '';
  out.eu = eu.filter((d) => d.day <= euCut && d.day >= from && d.day < to);
  if (out.lastConfirmedDay && now.getTime() - Date.parse(`${out.lastConfirmedDay}T00:00:00Z`) > MAX_AGE_DAYS * DAY_MS) {
    throw new Error(`Speicherreihe veraltet: letzter bestätigter Tag ${out.lastConfirmedDay}`);
  }
  return out;
}

const common = {
  scenarios: ['blackout'], domain: 'gas', evidenceClass: 'A' as const, kind: 'gauge' as const, manipulability: 'low' as const,
  independenceGroup: 'agsi', intervalMinutes: 1440, holdHours: 72, maxAgeHours: 240,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  sourceName: 'GIE AGSI+ (GitHub-Spiegel volzinnovation/de-gas-storage-tracker-bnetza)',
  sourceUrl: 'https://github.com/volzinnovation/de-gas-storage-tracker-bnetza', license: 'CC0 1.0 (Repo); AGSI+-Daten: Quellenangabe "GIE AGSI / ALSI platform" Pflicht',
};

const collector: Collector = {
  id: 'github-gas-storage',
  title: 'Gasspeicher Deutschland und EU (GitHub-Spiegel der GIE-AGSI+-Tagesdaten)',
  sourceUrl: 'https://github.com/volzinnovation/de-gas-storage-tracker-bnetza',
  intervalMinutes: 1440,
  signals: [
    {
      ...common, id: SIG_FILL_DE, direction: 'down', weight: 0.8, unit: '%', thresholds: { z0: 3, z1: 8, relFloor: 0.06 },
      name: 'Gasspeicher Deutschland: Füllstand (Tagesreihe, ca. 1 Woche Verzug)',
      plain: 'Wie voll die deutschen Gasspeicher sind; ein ungewöhnlich schneller Abfall zeigt, dass mehr Gas gebraucht wird, als nachkommt.',
      banalCauses: ['Kältewelle', 'Speicherbetreiber-Strategie', 'Umstellung auf Ausspeicherung im Herbst', 'nachträgliche Korrektur der Meldungen'],
    },
    {
      ...common, id: SIG_WD_DE, direction: 'up', weight: 0.8, unit: 'GWh/Tag', thresholds: { z0: 3, z1: 8, relFloor: 0.15 },
      name: 'Gasspeicher Deutschland: Netto-Entnahme (Tagesreihe, ca. 1 Woche Verzug)',
      plain: 'Wie viel Gas pro Tag netto aus den deutschen Speichern geholt wird; ein Sprung nach oben heißt, dass Verbrauch oder Ausfälle die Lieferungen übersteigen.',
      banalCauses: ['Kältewelle', 'Preisarbitrage', 'Wochenendrhythmus', 'Wartung einzelner Speicher'],
    },
    {
      ...common, id: SIG_FILL_EU, direction: 'down', weight: 0.6, unit: '%', thresholds: { z0: 3, z1: 8, relFloor: 0.06 },
      name: 'Gasspeicher EU: Füllstand (Tagesreihe, ca. 1 Woche Verzug)',
      plain: 'Wie voll die Gasspeicher in der EU insgesamt sind; fällt der Stand schneller als üblich, wird das Gas im Winter knapper.',
      banalCauses: ['Kältewelle', 'Umstellung auf Ausspeicherung im Herbst', 'nachträgliche Korrektur der Meldungen'],
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_CSV, { fixture: 'gas-storage/gie_storage.csv', timeoutMs: 40_000 });
    const res = parseStorage(text, ctx.now);
    const observations: Observation[] = [];
    for (const d of res.de) {
      if (d.fillPct !== null) observations.push(obs(SIG_FILL_DE, `${d.day}T00:00:00Z`, d.fillPct));
      if (d.netWithdrawal !== null) observations.push(obs(SIG_WD_DE, `${d.day}T00:00:00Z`, d.netWithdrawal));
    }
    for (const d of res.eu) if (d.fillPct !== null) observations.push(obs(SIG_FILL_EU, `${d.day}T00:00:00Z`, d.fillPct));
    return { observations };
  },
};

export default collector;
