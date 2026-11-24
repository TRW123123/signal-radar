// Blackout, Brücke: Netzfrequenz, Wind/PV-Einspeisung, Netzlast, Kp-Index und Day-Ahead-Strompreis unter blackout-IDs.
// Warum eigener Collector: energy-charts, smard und noaa-swpc melden ihre Messwerte nur unter cyber-IDs. Diese Brücke stellt dieselben Requests
// (gleiche URLs, gleiche Fixture-Namen, Aufzeichnungen vorhanden), nutzt deren exportierte Parser und meldet die Werte unter blackout.*-IDs.
// Quellen und Lizenzen: Energy-Charts (Fraunhofer ISE, CC BY 4.0), SMARD (Bundesnetzagentur, CC BY 4.0), NOAA SWPC (gemeinfrei). Kein Key.
// Neu und noch nicht gegen eine echte Antwort geprüft: /price?bzn=DE-LU (Day-Ahead, Form laut Energy-Charts-Doku { unix_seconds, price[], unit }),
// Fenster = 2 volle UTC-Tage (bis 15-Minuten-Raster, ca. 4 500 Zeichen); je UTC-Tag Mittelwert, nur wenn der Tag lückenlos ist.
// Harmlose Ursachen für Ausschläge: Handelsviertelstunden-Sprünge, Feiertage, Wetter, Gaspreis, Zeitumstellung, Sonnenstürme (Kp).
// VERIFIED: teilweise (Frequenz, Einspeisung, Netzlast, Kp: ja, Replay gegen echte Aufzeichnungen; Preis: nein, Test nach Doku)

import type { Collector, GeoRef, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, floorHour, num, obs } from './_helpers.ts';
import { FREQ_WINDOW_MIN, POWER_WINDOW_H, parseFrequency, parseRenewables } from './energy-charts.ts';
import { parseSeries, weekStarts } from './smard.ts';
import { parseKp } from './noaa-swpc.ts';

const BASE = 'https://api.energy-charts.info';
const HOUR = 3600_000;
const DE: GeoRef = { lat: 51.2, lon: 10.4, label: 'Deutschland', kind: 'country', cc: 'DE' };

export const S_FREQ = 'blackout.grid.frequency_de_deviation';
export const S_FEEDIN = 'blackout.grid.wind_solar_infeed_de';
export const S_LOAD = 'blackout.grid.net_load_de';
export const S_KP = 'blackout.weather.geomagnetic_storm';
export const S_PRICE = 'blackout.prices.day_ahead_de';

interface PriceResp { unix_seconds?: unknown; price?: unknown }

/** /price -> Tagesmittel (EUR/MWh) je vollständigem UTC-Tag vor `before`. Unvollständige Tage und Tage mit Lücken fehlen. */
export function parseDayAheadDaily(body: PriceResp, before: number): { day: string; eurMwh: number }[] {
  const unix = expect(Array.isArray(body.unix_seconds) ? body.unix_seconds : null, 'unix_seconds');
  const price = expect(Array.isArray(body.price) ? body.price : null, 'price');
  const n = Math.min(unix.length, price.length);
  const ts: number[] = [];
  const groups = new Map<number, (number | null)[]>();
  for (let i = 0; i < n; i++) {
    const t = num(unix[i]);
    if (t === null) continue;
    ts.push(t * 1000);
    const day = Math.floor((t * 1000) / DAY_MS) * DAY_MS;
    if (day + DAY_MS > before) continue;
    (groups.get(day) ?? groups.set(day, []).get(day)!).push(num(price[i]));
  }
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  const step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  if (!(step > 0)) return [];
  const expected = Math.round(DAY_MS / step);
  const out: { day: string; eurMwh: number }[] = [];
  for (const [day, vals] of [...groups].sort((a, b) => a[0] - b[0])) {
    const ok = vals.filter((v): v is number => v !== null);
    if (ok.length !== vals.length || ok.length < expected * 0.95) continue;
    const mean = ok.reduce((a, b) => a + b, 0) / ok.length;
    if (mean < -600 || mean > 4000) continue; // Plausibilität: andere Einheit
    out.push({ day: new Date(day).toISOString().slice(0, 10), eurMwh: mean });
  }
  return out;
}

const hourly = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };
const common = { scenarios: ['blackout'], evidenceClass: 'A' as const, manipulability: 'low' as const, kind: 'gauge' as const, geo: DE };
const CCBY = 'CC BY 4.0 (Energy-Charts, Fraunhofer ISE)';

const collector: Collector = {
  id: 'blackout-grid-bridge',
  title: 'Stromnetz Deutschland (Frequenz, Einspeisung, Last, Preis) und Kp-Index, Blackout-Sicht',
  sourceUrl: 'https://api.energy-charts.info/',
  intervalMinutes: 60,
  signals: [
    {
      ...common, id: S_FREQ, domain: 'grid', name: 'Netzfrequenz Deutschland: Abweichung von 50 Hz (Maximum der letzten 4 Minuten je Stunde)',
      plain: 'Die Netzfrequenz soll bei 50 Hz bleiben; starke Abweichungen zeigen, dass Erzeugung und Verbrauch aus dem Gleichgewicht geraten.',
      direction: 'up', weight: 0.9, unit: 'mHz', intervalMinutes: 60, holdHours: 6, baseline: hourly, thresholds: { absFloor: 5 },
      independenceGroup: 'energy-charts', license: CCBY, sourceName: 'Energy-Charts (Fraunhofer ISE)', sourceUrl: 'https://api.energy-charts.info/',
      banalCauses: ['Handelsviertelstunden-Sprünge', 'Kraftwerks- oder Leitungsausfall', 'Stundenwechsel-Rampen der Erzeugung'],
    },
    {
      ...common, id: S_FEEDIN, domain: 'grid', name: 'Wind- und Solareinspeisung Deutschland',
      plain: 'Wie viel Strom Wind und Sonne gerade ins deutsche Netz liefern; ein Einbruch bei hoher Last ist das Muster einer Dunkelflaute.',
      direction: 'down', weight: 0.5, unit: 'MW', intervalMinutes: 60, holdHours: 6, baseline: hourly, thresholds: { relFloor: 0.1 },
      independenceGroup: 'energy-charts', license: CCBY, sourceName: 'Energy-Charts (Fraunhofer ISE)', sourceUrl: 'https://api.energy-charts.info/',
      banalCauses: ['Nacht', 'Hochdruckwetter ohne Knappheit', 'Sturmabschaltung'],
    },
    {
      ...common, id: S_LOAD, domain: 'grid', name: 'Netzlast Deutschland (SMARD)',
      plain: 'Wie viel Strom in Deutschland gerade verbraucht wird; ein abrupter Einbruch ohne Feiertag oder Wetter kann einen Ausfall anzeigen.',
      direction: 'down', weight: 0.5, unit: 'MW', intervalMinutes: 60, holdHours: 6, baseline: hourly, thresholds: { relFloor: 0.05 },
      independenceGroup: 'smard', license: 'CC BY 4.0 (Bundesnetzagentur | SMARD.de)', sourceName: 'SMARD (Bundesnetzagentur)', sourceUrl: 'https://www.smard.de/',
      banalCauses: ['Feiertage und Brückentage', 'Wetter', 'Zeitumstellung'],
    },
    {
      ...common, id: S_KP, domain: 'weather', name: 'Sonnensturm: geomagnetische Aktivität (Kp-Index)',
      plain: 'Wie stark Sonnenstürme das Erdmagnetfeld gerade stören; starke Stürme können in seltenen Fällen Hochspannungsnetze belasten.',
      direction: 'up', weight: 0.4, unit: 'Kp', intervalMinutes: 180, holdHours: 12, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      geo: undefined, independenceGroup: 'noaa-swpc', license: 'US-Regierungsdaten, gemeinfrei', sourceName: 'NOAA Space Weather Prediction Center',
      sourceUrl: 'https://services.swpc.noaa.gov/products/',
      banalCauses: ['Normale Sonnenaktivität im Elfjahreszyklus', 'Polarlichter ohne Netzfolgen'],
    },
    {
      ...common, id: S_PRICE, domain: 'prices', name: 'Strompreis Day-Ahead Deutschland (Tagesmittel)',
      plain: 'Was Strom für den nächsten Tag an der Börse im Mittel kostet; Preisspitzen zeigen Knappheit.',
      direction: 'up', weight: 0.6, unit: 'EUR/MWh', intervalMinutes: 1440, holdHours: 48, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      thresholds: { relFloor: 0.1 }, independenceGroup: 'energy-charts', license: CCBY, sourceName: 'Energy-Charts (Fraunhofer ISE)', sourceUrl: 'https://api.energy-charts.info/',
      banalCauses: ['Gaspreis', 'CO2-Preis', 'Windflaute im Winter', 'Feiertage'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const before = floorHour(ctx.now).getTime();
    const enc = (d: Date) => encodeURIComponent(d.toISOString().slice(0, 16) + 'Z');
    let failures = 0;
    const attempts = 5;
    const tryPart = async (what: string, fn: () => Promise<void>) => {
      try { await fn(); } catch (e) { failures++; ctx.log(`${what} übersprungen: ${(e as Error).message}`); }
    };

    await tryPart('Frequenz', async () => {
      const start = new Date(before - FREQ_WINDOW_MIN * 60_000);
      const url = `${BASE}/frequency?country=de&start=${enc(start)}&end=${enc(new Date(before))}`;
      const body = await ctx.http.json<{ unix_seconds?: unknown; data?: unknown }>(url, { fixture: `energy-charts/frequency-${FREQ_WINDOW_MIN}m.json` });
      for (const r of parseFrequency(body, before, FREQ_WINDOW_MIN * 60_000)) observations.push(obs(S_FREQ, r.hour, r.maxDevMHz, { samples: r.n }));
    });
    await tryPart('Einspeisung', async () => {
      const url = `${BASE}/public_power?country=de&start=${enc(new Date(before - POWER_WINDOW_H * HOUR))}&end=${enc(new Date(before))}`;
      const body = await ctx.http.json<Parameters<typeof parseRenewables>[0]>(url, { fixture: `energy-charts/public_power-${POWER_WINDOW_H}h.json` });
      for (const r of parseRenewables(body, before)) observations.push(obs(S_FEEDIN, r.hour, r.mw));
    });
    await tryPart('Netzlast', async () => {
      let ok = 0;
      for (const w of weekStarts(before, 4)) {
        try {
          const body = await ctx.http.json<{ series?: unknown }>(`https://www.smard.de/app/chart_data/410/DE/410_DE_hour_${w}.json`, { fixture: `smard/410_DE_hour_${w}.json` });
          for (const p of parseSeries(body, before)) observations.push(obs(S_LOAD, p.ts, p.mw));
          ok++;
        } catch (e) { ctx.log(`SMARD Woche ${w} übersprungen: ${(e as Error).message}`); }
      }
      if (!ok) throw new Error('keine Wochendatei lesbar');
    });
    await tryPart('Kp-Index', async () => {
      const body = await ctx.http.json<unknown>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { fixture: 'noaa-swpc/planetary-k-index.json' });
      for (const p of parseKp(body)) observations.push(obs(S_KP, p.ts, p.kp));
    });
    await tryPart('Strompreis', async () => {
      const end = floorDay(ctx.now);
      const url = `${BASE}/price?bzn=DE-LU&start=${enc(new Date(end.getTime() - 2 * DAY_MS))}&end=${enc(end)}`;
      const body = await ctx.http.json<PriceResp>(url, { fixture: 'energy-charts/price-de-lu-2d.json' });
      for (const r of parseDayAheadDaily(body, end.getTime())) observations.push(obs(S_PRICE, `${r.day}T00:00:00Z`, r.eurMwh));
    });
    if (failures === attempts) throw new Error('Blackout-Brücke: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
