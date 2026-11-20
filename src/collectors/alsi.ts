// GIE ALSI+ (Aggregated LNG Storage Inventory): LNG-Terminals EU und Deutschland, täglich (Betreiberdaten der Terminals).
// Quelle: https://alsi.gie.eu/api?type=eu&from=YYYY-MM-DD&to=YYYY-MM-DD&size=26 und https://alsi.gie.eu/api?country=DE&from=...&to=...&size=26
// Doku: https://alsi.gie.eu/api und API-Dokumentation https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf (gelesen 20.11.2026):
//   Header x-key, höchstens 60 Aufrufe/Minute. Antwort { last_page, total, dataset, gas_day, data: [ { name, code, gasDayStart,
//   inventory { lng (10^3 m3), gwh }, sendOut (GWh/d), dtmi { lng, gwh } (Tankkapazität), dtrs (Send-out-Kapazität), status, info, children } ] }.
//   Ohne Key HTTP 200 mit { "error": "access denied", "message": "Invalid or missing API key", "data": [] } (echt, fixtures/alsi/no-key-error.json).
// Key: SR_ALSI_KEY im Header x-key.
// Lizenz: GIE-Bedingungen, Quellenangabe "GIE AGSI / ALSI platform" Pflicht (src/core/attribution.ts).
// Gemessen (2 Requests je Lauf, Fenster 21 Gastage bis gestern; jüngste 2 Gastage und Status N entfallen):
//   blackout.gas.lng_inventory_eu  LNG-Tankfüllstand EU in % (inventory.gwh / dtmi.gwh)
//   blackout.gas.lng_terminal_sendout  LNG-Send-out EU in GWh/Tag (Katalog nennt ENTSOG stündlich; hier ALSI täglich, Intervall/Baseline angepasst)
//   cyber.physical.lng_sendout_anomaly  LNG-Send-out Deutschland in GWh/Tag
//   war.energy.lng_terminals  LNG-Bestand der deutschen Terminals in GWh
// Harmlose Ursachen: Ankunft/Ausbleiben einzelner Tanker (Send-out schwankt stark), Wartung eines Terminals, neue FSRU-Terminals (Kapazitätssprung),
//   Preisarbitrage Asien/Europa.
// Not built: war.energy.eu_gas_storage (gehört zu agsi und wird dort gebaut).
// VERIFIED: ja (Live-Lauf Actions 20.11.2026, Run 44717048752): 72 Werte.

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const ID = 'alsi';
const BASE = 'https://alsi.gie.eu/api';
const KEY_ENV = 'SR_ALSI_KEY';
const WINDOW_DAYS = 21;
const DROP_NEWEST = 2;
const SIG_EU_INV = 'blackout.gas.lng_inventory_eu';
const SIG_EU_SEND = 'blackout.gas.lng_terminal_sendout';
const SIG_DE_SEND = 'cyber.physical.lng_sendout_anomaly';
const SIG_DE_INV = 'war.energy.lng_terminals';

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "blackout.gas.lng_inventory_eu",scenarios: ["blackout"],domain: "gas",name: "LNG-Tankfüllstand Terminals EU",plain: "Wie voll sind die LNG-Tanks an europäischen Terminals?",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "alsi",unit: "%",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Schiffsankunfts-Rhythmus"],sourceName: "GIE ALSI (LNG-Terminals)",sourceUrl: "https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf"},
  {id: "blackout.gas.lng_terminal_sendout",scenarios: ["blackout"],domain: "gas",name: "LNG-Anlandung und Einspeisung",plain: "Wie viel LNG kommt an und wird ins Netz gegeben?",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.7,manipulability: "low",independenceGroup: "entsog",unit: "GWh/Tag",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 60,license: "ENTSOG, Quellenangabe, unklar im Detail",banalCauses: ["Wartung","Wetter bei Entladung"],sourceName: "ENTSOG Transparency Platform API",sourceUrl: "https://transparency.entsog.eu/api/archiveDirectory/swagger/"},
  {id: "cyber.physical.lng_sendout_anomaly",scenarios: ["cyber"],domain: "physical",name: "LNG-Terminal Send-out",plain: "Abgabe aus LNG-Terminals ins Netz.",evidenceClass: "B",direction: "down",kind: "count",weight: 0.3,manipulability: "low",independenceGroup: "alsi",unit: "Anzahl",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Schiffsverspätungen","Wetter"],sourceName: "ALSI+ LNG Storage",sourceUrl: "https://alsi.gie.eu/api"},
  {id: "war.energy.lng_terminals",scenarios: ["war"],domain: "energy",name: "LNG-Terminal-Sendout und Füllstand",plain: "Misst, wie viel Flüssiggas die Terminals in Europa ins Netz abgeben und lagern.",evidenceClass: "B",direction: "both",kind: "gauge",weight: 0.45,manipulability: "low",independenceGroup: "alsi",unit: "GWh",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "GIE AGSI+/ALSI+: Weiterverarbeitung frei, Quellenangabe \"GIE AGSI / ALSI platform\" Pflicht (sonst Key-Sperre möglich)",banalCauses: ["Wartung"],sourceName: "GIE ALSI LNG-Terminals",sourceUrl: "https://alsi.gie.eu/api"},
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

/** Feld als Zahl; bei Objekten wie inventory { lng, gwh } das Unterfeld gwh. */
export function gwh(v: unknown): number | null {
  if (v && typeof v === 'object') return num((v as Record<string, unknown>).gwh);
  return num(v);
}

export function inventoryPct(r: Record<string, unknown>): number | null {
  const inv = gwh(r.inventory);
  const cap = gwh(r.dtmi);
  return inv !== null && cap ? Math.round((inv / cap) * 10000) / 100 : null;
}

const JOBS: { query: string; fixture: string; series: [string, (r: Record<string, unknown>) => number | null][] }[] = [
  { query: 'type=eu', fixture: 'alsi/eu.json', series: [[SIG_EU_INV, inventoryPct], [SIG_EU_SEND, (r) => num(r.sendOut)]] },
  { query: 'country=DE', fixture: 'alsi/de.json', series: [[SIG_DE_SEND, (r) => num(r.sendOut)], [SIG_DE_INV, (r) => gwh(r.inventory)]] },
];

const SOURCE = { sourceName: 'GIE AGSI / ALSI platform (ALSI+)', sourceUrl: 'https://alsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe "GIE AGSI / ALSI platform" Pflicht' };
const DAILY = { intervalMinutes: 1440, maxAgeHours: 24 * 5 };

const collector: Collector = {
  id: ID,
  title: 'GIE ALSI+ LNG-Terminals',
  sourceUrl: 'https://alsi.gie.eu/',
  needsKey: KEY_ENV,
  intervalMinutes: 360,
  signals: [
    { ...CATALOG[SIG_EU_INV], ...SOURCE, ...DAILY, collector: ID, id: SIG_EU_INV },
    { ...CATALOG[SIG_EU_SEND], ...SOURCE, ...DAILY, collector: ID, id: SIG_EU_SEND,
      name: 'LNG-Send-out EU', baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      plain: 'Wie viel Gas die europäischen LNG-Terminals am Tag ins Netz einspeisen.' },
    { ...CATALOG[SIG_DE_SEND], ...SOURCE, ...DAILY, collector: ID, id: SIG_DE_SEND, unit: 'GWh/Tag',
      name: 'LNG-Send-out Deutschland', plain: 'Wie viel Gas die deutschen LNG-Terminals am Tag ins Netz einspeisen.' },
    { ...CATALOG[SIG_DE_INV], ...SOURCE, ...DAILY, collector: ID, id: SIG_DE_INV,
      name: 'LNG-Bestand deutscher Terminals', plain: 'Wie viel LNG (in GWh Gasäquivalent) in den deutschen Terminals lagert.' },
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
        const msg = e instanceof Error ? e.message : String(e);
        firstErr ||= msg;
        ctx.log(`${ID}: ${job.query} fehlgeschlagen: ${msg}`);
      }
    }
    if (failed === JOBS.length) throw new Error(`${ID}: alle Abrufe fehlgeschlagen (${firstErr})`);
    return { observations };
  },
};

export default collector;
