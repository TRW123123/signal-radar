// Fingrid Open Data: Finnland, Netzfrequenz (Datensatz 177) und Atomstromerzeugung (Datensatz 188), Echtzeitmessungen
// aus dem Leitsystem des finnischen Übertragungsnetzbetreibers.
// Quelle: https://data.fingrid.fi/api/data?datasets=177,188&startTime=...&endTime=...  (ein Request für beide Datensätze)
// Doku: https://data.fingrid.fi/en/instructions, OpenAPI: Developer-Portal https://developer-data.fingrid.fi (avoindata-api,
//   Operation GetMultipleTimeseriesData), Datensätze https://data.fingrid.fi/en/datasets/177 und /188.
// Key: Header x-api-key (Pflicht, nicht in die URL), env SR_FINGRID_KEY. Limits: 10 000 Requests/24 h und 1 Request alle 2 s je Key;
//   hier 1 Request pro Lauf, Lauf stündlich.
// Lizenz: CC BY 4.0 (Datensatz-Metadaten 177/188). Namensnennung "Fingrid" bzw. "Source: Fingrid / data.fingrid.fi".
// Antwortform: { data: [{ datasetId, startTime, endTime, value }], pagination: { total, lastPage, perPage, currentPage, ... } }
//   (sortOrder default desc). Geprüft am 20.11.2026 an der echten API-Antwort, die das Portal ohne Key in die Datensatzseite
//   einbettet (fixtures/fingrid/portal-embedded-177.json, -188.json, je 5 Zeilen); /data liefert laut OpenAPI dieselbe Form.
// Gemessen (je volle UTC-Stunde, nur abgeschlossene Stunden aus dem 2-h-Fenster vor der laufenden Stunde):
//   nuclear.plants.fi_fingrid_nuclear: Mittelwert Atomstrom in MW (3-min-Werte; Stunde nur mit mindestens 15 von 20 Werten).
//   blackout.grid.frequency_nordic_deviation: größte Abweichung der Frequenz von 50 Hz in mHz (Minutenwerte; mindestens 45 von 60).
// Harmlose Ursachen: Revisionen (Olkiluoto/Loviisa jährlich im Frühjahr), Leistungsabsenkung bei Überschuss, Messausfälle;
//   Frequenz: Stundenwechsel (Handelsgrenzen), große Erzeugungsausfälle im Nordic-Verbund ohne Krisenbezug.
// Not built: blackout.grid.frequency_cross_check_gb_nordic. Der Katalog führt das Signal unter dem Collector elexon
//   (GB-Frequenz, independenceGroup elexon); dieselbe id hier würde zwei verschiedene Reihen mischen. Die Nordic-Frequenz
//   steht deshalb unter der neuen id blackout.grid.frequency_nordic_deviation (Vorschlag für den Katalog).
// VERIFIED: nein (ungeprüft bis Key). Antwortform gegen echte keyfreie Portal-Antwort geprüft, Endpunkt mit Key nicht.

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const KEY_ENV = 'SR_FINGRID_KEY';
const HOUR = 3600_000;
export const DS_FREQ = 177;
export const DS_NUCLEAR = 188;
export const SIG_NUCLEAR = 'nuclear.plants.fi_fingrid_nuclear';
export const SIG_FREQ = 'blackout.grid.frequency_nordic_deviation';
const WINDOW_HOURS = 2;
/** minimum number of values for an hour to count as complete */
const MIN_POINTS: Record<number, number> = { [DS_FREQ]: 45, [DS_NUCLEAR]: 15 };

export interface Row { datasetId: number; start: number; value: number }

interface Resp { data?: unknown }

/** Rows of a Fingrid timeseries response; rows with unusable values are dropped. */
export function parseRows(body: Resp): Row[] {
  const data = expect(body?.data, 'data');
  if (!Array.isArray(data)) throw new Error('unerwartete Antwort: data ist keine Liste');
  const out: Row[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const id = num(r?.datasetId);
    const v = num(r?.value);
    const t = typeof r?.startTime === 'string' ? Date.parse(r.startTime) : NaN;
    if (id !== null && v !== null && Number.isFinite(t)) out.push({ datasetId: id, start: t, value: v });
  }
  return out;
}

/** Groups rows of one dataset into complete UTC hours before `now`. */
function hours(rows: Row[], datasetId: number, now: Date): Map<number, number[]> {
  const cur = floorHour(now).getTime();
  const m = new Map<number, number[]>();
  for (const r of rows) {
    if (r.datasetId !== datasetId) continue;
    const h = Math.floor(r.start / HOUR) * HOUR;
    if (h + HOUR > cur) continue;
    if (!m.has(h)) m.set(h, []);
    m.get(h)!.push(r.value);
  }
  for (const [h, vs] of m) if (vs.length < (MIN_POINTS[datasetId] ?? 1)) m.delete(h);
  return m;
}

export function nuclearHourly(rows: Row[], now: Date): Observation[] {
  return [...hours(rows, DS_NUCLEAR, now).entries()].sort((a, b) => a[0] - b[0])
    .map(([h, vs]) => obs(SIG_NUCLEAR, h, Math.round((vs.reduce((s, v) => s + v, 0) / vs.length) * 10) / 10, { n: vs.length }));
}

export function frequencyHourly(rows: Row[], now: Date): Observation[] {
  return [...hours(rows, DS_FREQ, now).entries()].sort((a, b) => a[0] - b[0])
    .map(([h, vs]) => obs(SIG_FREQ, h, Math.round(Math.max(...vs.map((v) => Math.abs(v - 50))) * 1000), {
      n: vs.length, minHz: Math.min(...vs), maxHz: Math.max(...vs),
    }));
}

export function buildUrl(now: Date): string {
  const end = floorHour(now);
  const start = new Date(end.getTime() - WINDOW_HOURS * HOUR);
  const u = new URL('https://data.fingrid.fi/api/data');
  u.searchParams.set('datasets', `${DS_FREQ},${DS_NUCLEAR}`);
  u.searchParams.set('startTime', start.toISOString());
  u.searchParams.set('endTime', end.toISOString());
  u.searchParams.set('format', 'json');
  u.searchParams.set('pageSize', '1000');
  u.searchParams.set('sortBy', 'startTime');
  u.searchParams.set('sortOrder', 'asc');
  return u.toString();
}

const LICENSE = 'CC BY 4.0, Quelle: Fingrid (data.fingrid.fi)';

const collector: Collector = {
  id: 'fingrid',
  title: 'Fingrid Open Data (Frequenz, Atomstrom Finnland)',
  sourceUrl: 'https://data.fingrid.fi/en/instructions',
  needsKey: KEY_ENV,
  intervalMinutes: 60,
  signals: [
    { id: SIG_NUCLEAR, scenarios: ['nuclear'], domain: 'plants', name: 'Finnland: Atomstrom (Fingrid)',
      plain: 'Wie viel Strom die finnischen Kernkraftwerke gerade erzeugen (Stundenmittel).',
      evidenceClass: 'B', direction: 'down', kind: 'gauge', weight: 0.45, manipulability: 'low', independenceGroup: 'fingrid',
      unit: 'MW', intervalMinutes: 60, holdHours: 6, baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      sourceName: 'Fingrid Open Data (Datensatz 188)', sourceUrl: 'https://data.fingrid.fi/en/datasets/188', license: LICENSE,
      banalCauses: ['Jährliche Revision (Olkiluoto, Loviisa)', 'Leistungsabsenkung bei Stromüberschuss', 'Netzstörung'] },
    { id: SIG_FREQ, scenarios: ['blackout'], domain: 'grid', name: 'Netzfrequenz Nordic (Fingrid): größte Abweichung',
      plain: 'Wie weit die Netzfrequenz im nordischen Stromverbund in der letzten Stunde höchstens von 50 Hz abwich.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.6, manipulability: 'low', independenceGroup: 'fingrid',
      unit: 'mHz', intervalMinutes: 60, holdHours: 3, baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      sourceName: 'Fingrid Open Data (Datensatz 177)', sourceUrl: 'https://data.fingrid.fi/en/datasets/177', license: LICENSE,
      rationale: 'Gegenprobe zur kontinentaleuropäischen Frequenz: Ausschlag nur dort spricht für ein lokales Problem.',
      banalCauses: ['Stundenwechsel (Handelsgrenzen)', 'Ausfall eines großen Kraftwerks im Verbund', 'Messausfall'] },
  ],
  async collect(ctx) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const body = await ctx.http.json<Resp>(buildUrl(ctx.now), { fixture: 'fingrid/data-177-188.json', headers: { 'x-api-key': key } });
    const rows = parseRows(body);
    const observations = [...nuclearHourly(rows, ctx.now), ...frequencyHourly(rows, ctx.now)];
    if (!rows.length) ctx.log('keine Werte im Zeitfenster');
    return { observations };
  },
};

export default collector;
