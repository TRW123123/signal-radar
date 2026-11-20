// GIE AGSI+ (Aggregated Gas Storage Inventory): Gasspeicher EU und ein deutscher Großspeicherbetreiber, täglich (Betreiberdaten der Speicher).
// Quelle: https://agsi.gie.eu/api?type=eu&from=YYYY-MM-DD&to=YYYY-MM-DD&size=26
//         https://agsi.gie.eu/api?country=DE&company=21X000000001160J&from=...&to=...&size=26
// Doku: https://agsi.gie.eu/api und API-Dokumentation https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf (gelesen 20.11.2026):
//   Header x-key, Seitengröße size (Standard 30), höchstens 60 Aufrufe/Minute (sonst 60 s Sperre), Aktualisierung 19:30 und 23:00 MEZ.
//   Antwort { last_page, total, dataset, gas_day, data: [ { name, code, gasDayStart, gasInStorage (TWh), injection, withdrawal,
//   netWithdrawal (GWh/d), workingGasVolume (TWh), status (E/C/N), trend, full (%), info, children } ] }. Zahlen können als Text kommen.
//   Ohne Key antwortet die API mit HTTP 200 und { "error": "access denied", "message": "Invalid or missing API key", "data": [] } (echt, 20.11.2026,
//   fixtures/agsi/no-key-error.json); das wird als Fehler gemeldet.
// Key: SR_AGSI_KEY im Header x-key.
// Lizenz: GIE-Bedingungen, Weiterverarbeitung frei, Quellenangabe "GIE AGSI / ALSI platform" Pflicht (sonst kann GIE den Key sperren);
//   steht in src/core/attribution.ts.
// Gemessen (2 Requests je Lauf, Fenster 21 Gastage bis gestern):
//   war.energy.eu_gas_storage  EU-Füllstand in % (full, type=eu)
//   cyber.physical.storage_level_anomaly_eu  EU-Netto-Ausspeicherung in GWh/Tag (netWithdrawal, type=eu; negativ = Einspeicherung)
//   blackout.gas.storage_by_site_critical  Füllstand des Speicherbetreibers 21X000000001160J in Deutschland in % (EIC aus der GIE-Doku/Katalog,
//     laut Katalog nicht geprüft; ohne Key keine Bestätigung, welcher Betreiber das ist -> erste Antwort mit Key prüfen, Feld name)
//   Die jüngsten 2 Gastage entfallen (Status E, oft noch unvollständig), Status N entfällt.
// Harmlose Ursachen: Kältewelle, Umstellung Ein-/Ausspeichern im Herbst, Preisarbitrage, Wartung, nachträgliche Korrekturen.
// Not built (bereits von github-gas-storage, einem AGSI-Spiegel, gespeist; zweite Quelle würde die Reihen vermischen):
//   blackout.gas.storage_fill_de, blackout.gas.storage_withdrawal_rate. Umstellung auf diesen Collector ist Sache der Koordination.
// VERIFIED: nein (ungeprüft bis Key). Datenformat aus der GIE-API-Dokumentation v007; Fehlerantwort ohne Key echt geprüft.

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const ID = 'agsi';
const BASE = 'https://agsi.gie.eu/api';
const KEY_ENV = 'SR_AGSI_KEY';
const WINDOW_DAYS = 21;
const DROP_NEWEST = 2;
const SIG_EU_FULL = 'war.energy.eu_gas_storage';
const SIG_EU_NETWD = 'cyber.physical.storage_level_anomaly_eu';
const SIG_SITE = 'blackout.gas.storage_by_site_critical';
const COMPANY = '21X000000001160J';

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "war.energy.eu_gas_storage",scenarios: ["war"],domain: "energy",name: "EU-Gasspeicher-Füllstand",plain: "Misst, wie voll die Gasspeicher in der EU sind.",evidenceClass: "B",direction: "down",kind: "gauge",weight: 0.4,manipulability: "low",independenceGroup: "agsi",unit: "%",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Winterwetter","Einspeicherstrategie","Preis","Kälteeinbruch","Marktpreise"],sourceName: "GIE AGSI+ Gasspeicher",sourceUrl: "https://agsi.gie.eu/api"},
  {id: "cyber.physical.storage_level_anomaly_eu",scenarios: ["cyber"],domain: "physical",name: "Gasspeicher-Füllstand und Ausspeicherung",plain: "Wie voll die Gasspeicher sind und wie schnell sie sich leeren.",evidenceClass: "B",direction: "up",kind: "gauge",weight: 0.3,manipulability: "low",independenceGroup: "agsi",unit: "Messwert",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Winterwetter","Marktpreise"],sourceName: "AGSI+ Gas Infrastructure Europe",sourceUrl: "https://agsi.gie.eu/api"},
  {id: "blackout.gas.storage_by_site_critical",scenarios: ["blackout"],domain: "gas",name: "Füllstand einzelner Großspeicher",plain: "Rehden, Etzel, Jemgum und andere Anlagen einzeln.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "agsi",unit: "%",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Wartungspausen"],sourceName: "GIE AGSI+ (Gasspeicher)",sourceUrl: "https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

export interface GieRow { day: string; status: string; row: Record<string, unknown> }

/** data[] einer AGSI/ALSI-Antwort. Die Plattform meldet Key-Fehler mit HTTP 200 und { error, message, data: [] }: dann Fehler werfen. */
export function parseGie(body: unknown): GieRow[] {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  if (b.error) throw new Error(`GIE-Fehler: ${String(b.error)}${b.message ? ` (${String(b.message)})` : ''}`);
  const data = expect(Array.isArray(b.data) ? (b.data as unknown[]) : null, 'data');
  const out: GieRow[] = [];
  for (const d of data) {
    const r = d as Record<string, unknown>;
    if (typeof r.gasDayStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.gasDayStart)) continue;
    out.push({ day: r.gasDayStart, status: String(r.status ?? ''), row: r });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Tagesreihe: Status N (keine Daten) entfällt, ebenso die DROP_NEWEST jüngsten Gastage (noch geschätzt und unvollständig). */
export function dailySeries(signalId: string, rows: GieRow[], value: (r: Record<string, unknown>) => number | null): Observation[] {
  const usable = rows.slice(0, Math.max(0, rows.length - DROP_NEWEST));
  const out: Observation[] = [];
  for (const r of usable) {
    if (r.status === 'N') continue;
    const v = value(r.row);
    if (v !== null && Number.isFinite(v)) out.push(obs(signalId, `${r.day}T00:00:00Z`, v));
  }
  return out;
}

const JOBS: { query: string; fixture: string; series: [string, (r: Record<string, unknown>) => number | null][] }[] = [
  { query: 'type=eu', fixture: 'agsi/eu.json', series: [[SIG_EU_FULL, (r) => num(r.full)], [SIG_EU_NETWD, (r) => num(r.netWithdrawal)]] },
  { query: `country=DE&company=${COMPANY}`, fixture: 'agsi/de-company.json', series: [[SIG_SITE, (r) => num(r.full)]] },
];

const SOURCE = { sourceName: 'GIE AGSI / ALSI platform (AGSI+)', sourceUrl: 'https://agsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe "GIE AGSI / ALSI platform" Pflicht' };

const collector: Collector = {
  id: ID,
  title: 'GIE AGSI+ Gasspeicher',
  sourceUrl: 'https://agsi.gie.eu/',
  needsKey: KEY_ENV,
  intervalMinutes: 360,
  signals: [
    { ...CATALOG[SIG_EU_FULL], ...SOURCE, collector: ID, id: SIG_EU_FULL, name: 'EU-Gasspeicher-Füllstand', maxAgeHours: 24 * 5 },
    { ...CATALOG[SIG_EU_NETWD], ...SOURCE, collector: ID, id: SIG_EU_NETWD, name: 'EU-Gasspeicher: Netto-Ausspeicherung', unit: 'GWh/Tag', maxAgeHours: 24 * 5,
      plain: 'Wie viel Gas die EU-Speicher am Tag netto abgeben; ein sprunghafter Anstieg kann auf Versorgungsstress hindeuten.' },
    { ...CATALOG[SIG_SITE], ...SOURCE, collector: ID, id: SIG_SITE, maxAgeHours: 24 * 5,
      plain: 'Füllstand der Speicher eines großen deutschen Speicherbetreibers (EIC 21X000000001160J).' },
  ],

  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const from = isoDay(daysAgo(ctx.now, WINDOW_DAYS));
    const to = isoDay(daysAgo(ctx.now, 1));
    const observations: Observation[] = [];
    let failed = 0;
    let firstErr = '';
    for (const job of JOBS) {
      try {
        const body = await ctx.http.json(`${BASE}?${job.query}&from=${from}&to=${to}&size=${WINDOW_DAYS + 5}`, { headers: { 'x-key': key }, fixture: job.fixture });
        const rows = parseGie(body);
        for (const [sig, fn] of job.series) observations.push(...dailySeries(sig, rows, fn));
      } catch (e) {
        failed++;
        firstErr ||= e instanceof Error ? e.message : String(e);
        ctx.log(`${ID}: ${job.query} fehlgeschlagen: ${firstErr}`);
      }
    }
    if (failed === JOBS.length) throw new Error(`${ID}: alle Abrufe fehlgeschlagen (${firstErr})`);
    return { observations };
  },
};

export default collector;
