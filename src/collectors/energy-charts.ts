// Netzfrequenz und Wind/PV-Einspeisung Deutschland (Evidenzklasse A: unabhängige Messung).
// Quelle: Energy-Charts API, Fraunhofer ISE, https://api.energy-charts.info/ (Swagger-Doku dort), kein Key.
// Lizenz: CC BY 4.0, Namensnennung "Energy-Charts, Fraunhofer ISE". Nur Leseabfragen mit kleinem Zeitfenster.
// Gemessen: (1) Netzfrequenz (Hz, Sekundenauflösung): aus den letzten 4 Minuten der zuletzt abgeschlossenen UTC-Stunde (ca. 240 Werte,
// ca. 4 500 Zeichen; ganze Stunden sind zu groß) maximale absolute Abweichung von 50 Hz und Standardabweichung in mHz, gemeldet für diese Stunde; (2) Summe Solar + Wind onshore + Wind offshore aus /public_power je abgeschlossener Stunde (MW),
// abgefragt für die letzten 6 Stunden (24 Viertelstunden x 21 Erzeugungsarten, ca. 157 Zeichen je Viertelstunde, also ca. 4 000 Zeichen;
// ein ganzer Tag waren 14 900 Zeichen). Grenze der Aufzeichnungs-Umgebung ca. 6 000 Zeichen.
// Harmlose Ursachen: Kraftwerks-/Leitungsausfälle, Handelsviertelstunden-Sprünge (Frequenz); Wolkenfronten, Sturmabschaltung,
// Abregelung, Tageszeit (Einspeisung).
// VERIFIED: teilweise (public_power: ja, 17.11.2026, echte Antwort { unix_seconds, production_types[{name,data}] }, 15-Minuten-Raster, Tag = lokaler
// Kalendertag; frequency: Form { unix_seconds, data } in Sekunden bestätigt, aber Fenster von 3 h war 204 kB; neues 4-Minuten-Fenster und 6-Stunden-Fenster für public_power warten auf Aufzeichnung).
// Zeitauflösung wird aus den Zeitstempeln abgeleitet, nicht angenommen.

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const BASE = 'https://api.energy-charts.info';
// Sekundenauflösung: ca. 18,9 Zeichen je Sekunde (3 Stunden waren 204 kB); 4 Minuten ≈ 240 Werte ≈ 4 500 Zeichen.
export const FREQ_WINDOW_MIN = 4;
/** Fenster für /public_power in Stunden (die Läufe sind stündlich; Überlappung fängt ausgefallene Läufe auf). */
export const POWER_WINDOW_H = 6;
const HOUR = 3600_000;

export interface Series { ts: number[]; values: (number | null)[] }

interface FreqResp { unix_seconds?: unknown; data?: unknown }
interface PowerResp { unix_seconds?: unknown; production_types?: { name?: string; data?: unknown }[] }

function toSeries(unix: unknown, data: unknown, what: string): Series {
  if (!Array.isArray(unix) || !Array.isArray(data)) throw new Error(`unerwartete Antwort: ${what} fehlt`);
  const n = Math.min(unix.length, data.length);
  const ts: number[] = [];
  const values: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const t = num(unix[i]);
    if (t === null) continue;
    ts.push(t * 1000);
    values.push(num(data[i]));
  }
  return { ts, values };
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Group by UTC hour; returns only hours before `before` with enough valid samples. */
function byHour(s: Series, before: number, windowMs = HOUR): Map<number, number[]> {
  const gaps: number[] = [];
  for (let i = 1; i < s.ts.length; i++) gaps.push(s.ts[i] - s.ts[i - 1]);
  const step = median(gaps);
  if (!(step > 0)) return new Map();
  const expected = Math.max(1, Math.round(Math.min(windowMs, HOUR) / step));
  const groups = new Map<number, (number | null)[]>();
  for (let i = 0; i < s.ts.length; i++) {
    const h = Math.floor(s.ts[i] / HOUR) * HOUR;
    if (h >= before) continue;
    (groups.get(h) ?? groups.set(h, []).get(h)!).push(s.values[i]);
  }
  const out = new Map<number, number[]>();
  for (const [h, vals] of groups) {
    const ok = vals.filter((v): v is number => v !== null);
    if (ok.length >= Math.ceil(expected * 0.8) && ok.length === vals.length) out.set(h, ok);
  }
  return out;
}

/**
 * Frequency series (Hz) -> per UTC hour: max |f-50| and standard deviation, both in mHz. The series may cover only a window
 * (default: a whole hour; the collector fetches the last FREQ_WINDOW_MIN minutes of the last complete hour), which then labels that hour.
 */
export function parseFrequency(body: FreqResp, before: number, windowMs = HOUR): { hour: number; maxDevMHz: number; stdMHz: number; n: number }[] {
  const s = toSeries(body.unix_seconds, body.data, 'unix_seconds/data');
  const out: { hour: number; maxDevMHz: number; stdMHz: number; n: number }[] = [];
  for (const [hour, vals] of byHour(s, before, windowMs)) {
    // plausibility: values in Hz around 50; anything else means a changed unit
    if (vals.some((v) => v < 40 || v > 60)) continue;
    const dev = vals.map((v) => (v - 50) * 1000);
    const mean = dev.reduce((a, b) => a + b, 0) / dev.length;
    const std = Math.sqrt(dev.reduce((a, b) => a + (b - mean) ** 2, 0) / dev.length);
    out.push({ hour, maxDevMHz: Math.max(...dev.map(Math.abs)), stdMHz: std, n: vals.length });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

const RENEWABLES = ['Solar', 'Wind onshore', 'Wind offshore'];

/** /public_power -> per complete hour: mean MW of Solar + Wind onshore + Wind offshore. Hours with a missing part are dropped. */
export function parseRenewables(body: PowerResp, before: number): { hour: number; mw: number }[] {
  const types = expect(body.production_types, 'production_types');
  const perType: Map<number, number[]>[] = [];
  for (const name of RENEWABLES) {
    const t = types.find((x) => x.name === name);
    if (!t) throw new Error(`unerwartete Antwort: Reihe ${name} fehlt`);
    perType.push(byHour(toSeries(body.unix_seconds, t.data, name), before));
  }
  const out: { hour: number; mw: number }[] = [];
  for (const hour of perType[0].keys()) {
    if (!perType.every((m) => m.has(hour))) continue;
    const mw = perType.reduce((sum, m) => { const v = m.get(hour)!; return sum + v.reduce((a, b) => a + b, 0) / v.length; }, 0);
    out.push({ hour, mw });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

const common = {
  scenarios: ['cyber'], domain: 'physical', evidenceClass: 'A' as const, manipulability: 'low' as const,
  independenceGroup: 'energy-charts', intervalMinutes: 60, license: 'CC BY 4.0 (Energy-Charts, Fraunhofer ISE)',
};

const collector: Collector = {
  id: 'energy-charts',
  title: 'Energy-Charts (Fraunhofer ISE)',
  sourceUrl: 'https://api.energy-charts.info/',
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: 'cyber.physical.frequency_deviation_de', name: 'Netzfrequenz-Abweichung (Maximum der letzten 4 Minuten je Stunde)',
      plain: 'Die Netzfrequenz soll bei 50 Hz bleiben; die größte Abweichung in einem 4-Minuten-Ausschnitt je Stunde zeigt, ob Erzeugung und Verbrauch aus dem Gleichgewicht geraten.',
      direction: 'up', kind: 'gauge', weight: 0.5, unit: 'mHz', holdHours: 6,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { absFloor: 5 },
    },
    {
      ...common, id: 'cyber.physical.frequency_stddev_de', name: 'Netzfrequenz-Unruhe (Standardabweichung, 4-Minuten-Ausschnitt je Stunde)',
      plain: 'Wie stark die Netzfrequenz in einem 4-Minuten-Ausschnitt je Stunde schwankt; ein ruhiges Netz liegt eng bei 50 Hz.',
      direction: 'up', kind: 'gauge', weight: 0.3, unit: 'mHz', holdHours: 6,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { absFloor: 3 },
    },
    {
      ...common, id: 'cyber.physical.solar_wind_feedin_sudden_drop', name: 'Einspeisung Wind und Photovoltaik Deutschland',
      plain: 'Wie viel Strom Wind und Sonne gerade ins deutsche Netz liefern; ein plötzlicher Einbruch ohne Wetterursache wäre auffällig.',
      direction: 'down', kind: 'gauge', weight: 0.25, unit: 'MW', holdHours: 6,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { relFloor: 0.1 },
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const before = floorHour(ctx.now).getTime();
    const enc = (d: Date) => encodeURIComponent(d.toISOString().slice(0, 16) + 'Z');

    let failures = 0;
    try {
      const start = new Date(before - FREQ_WINDOW_MIN * 60_000);
      const url = `${BASE}/frequency?country=de&start=${enc(start)}&end=${enc(new Date(before))}`;
      const rows = parseFrequency(await ctx.http.json<FreqResp>(url, { fixture: `energy-charts/frequency-${FREQ_WINDOW_MIN}m.json` }), before, FREQ_WINDOW_MIN * 60_000);
      for (const r of rows) {
        observations.push(obs('cyber.physical.frequency_deviation_de', r.hour, r.maxDevMHz, { samples: r.n }));
        observations.push(obs('cyber.physical.frequency_stddev_de', r.hour, r.stdMHz, { samples: r.n }));
      }
    } catch (e) {
      failures++;
      ctx.log(`Frequenz übersprungen: ${(e as Error).message}`);
    }
    try {
      const url = `${BASE}/public_power?country=de&start=${enc(new Date(before - POWER_WINDOW_H * HOUR))}&end=${enc(new Date(before))}`;
      const rows = parseRenewables(await ctx.http.json<PowerResp>(url, { fixture: `energy-charts/public_power-${POWER_WINDOW_H}h.json` }), before);
      for (const r of rows) observations.push(obs('cyber.physical.solar_wind_feedin_sudden_drop', r.hour, r.mw));
    } catch (e) {
      failures++;
      ctx.log(`Einspeisung übersprungen: ${(e as Error).message}`);
    }
    if (failures === 2) throw new Error('Energy-Charts: beide Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
