// Blackout, Brücke: Netzfrequenz, Wind/PV-Einspeisung, Netzlast, Kp-Index und Day-Ahead-Strompreis unter blackout-IDs.
// Warum eigener Collector: energy-charts, smard und noaa-swpc melden ihre Messwerte nur unter cyber-IDs. Diese Brücke stellt dieselben Requests
// (gleiche URLs, gleiche Fixture-Namen, Aufzeichnungen vorhanden), nutzt deren exportierte Parser und meldet die Werte unter blackout.*-IDs.
// Quellen und Lizenzen: Energy-Charts (Fraunhofer ISE, CC BY 4.0), SMARD (Bundesnetzagentur, CC BY 4.0), NOAA SWPC (gemeinfrei). Kein Key.
// Neu und noch nicht gegen eine echte Antwort geprüft: /price?bzn=DE-LU (Day-Ahead, Form laut Energy-Charts-Doku { unix_seconds, price[], unit }),
// Fenster = 2 volle UTC-Tage (bis 15-Minuten-Raster, ca. 4 500 Zeichen); je UTC-Tag Mittelwert, nur wenn der Tag lückenlos ist.
// Harmlose Ursachen für Ausschläge: Handelsviertelstunden-Sprünge, Feiertage, Wetter, Gaspreis, Zeitumstellung, Sonnenstürme (Kp).
// Sofort-Historie (24.11.2026): Einspeisung DE über 4 Abschnitte à 6 Stunden (24 Stundenwerte), Preis über 5 Abschnitte à 2 Tage (10 Tageswerte),
// damit die Vergleichsbasis (mindestens 7 Werte) schon nach dem ersten Lauf steht. Abschnitte statt eines großen Fensters, weil jede Antwort
// unter ca. 6 000 Zeichen bleiben soll (Aufzeichnungs-Umgebung). Abschnitt 0 ist jeweils die bisherige URL mit dem bisherigen Fixture-Namen.
// Neu: Netzlast (production_types "Load") für Frankreich, Spanien, Italien aus /public_power?country=<cc>, je 2 Abschnitte à 6 Stunden;
// aus der französischen Antwort zusätzlich die Kernkraft-Erzeugung ("Nuclear"), ohne weiteren Request. Netzfrequenz für weitere Länder ist
// zwecklos: Kontinentaleuropa ist ein Synchrongebiet, die Frequenz ist überall gleich.
// Netzlast SMARD erscheint mit bis zu ca. 20 Stunden Verzug, daher maxAgeHours 36.
// Harmlose Ursachen (Last/Kernkraft): Feiertage, Wetter, Revisionen, Lastfolgebetrieb, Streiks in Frankreich.
// VERIFIED: teilweise (Frequenz, Einspeisung, Netzlast, Kp: ja, Replay gegen echte Aufzeichnungen; Preis, Abschnitte 1 bis n, Netzlast FR/ES/IT,
// Kernkraft FR: nein, Form wie public_power DE angenommen, Test nach Doku)

import type { Collector, GeoRef, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, floorHour, num, obs } from './_helpers.ts';
import { FREQ_WINDOW_MIN, POWER_WINDOW_H, byHour, parseFrequency, parseRenewables, toSeries } from './energy-charts.ts';
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
export const S_NUCLEAR_FR = 'blackout.plants.nuclear_generation_fr_measured';
/** Abschnitte für Sofort-Historie: Einspeisung DE (je POWER_WINDOW_H Stunden), Preis (je 2 Tage), Netzlast je Land (je POWER_WINDOW_H Stunden). */
export const FEEDIN_CHUNKS = 4;
export const PRICE_CHUNKS = 5;
export const LOAD_CHUNKS = 2;
export const LOAD_COUNTRIES: { cc: string; label: string; lat: number; lon: number }[] = [
  { cc: 'FR', label: 'Frankreich', lat: 46.6, lon: 2.4 },
  { cc: 'ES', label: 'Spanien', lat: 40.2, lon: -3.7 },
  { cc: 'IT', label: 'Italien', lat: 42.8, lon: 12.6 },
];
export const loadSignalId = (cc: string) => `blackout.grid.load_${cc.toLowerCase()}`;
/** Fixture-Name eines Abschnitts; Abschnitt 0 behält den bisherigen Namen. */
export function chunkFixture(base: string, ext: string, i: number): string { return i === 0 ? `${base}.${ext}` : `${base}-${i}.${ext}`; }

/** /public_power -> Stundenmittel (MW) einer Erzeugungsart bzw. der Last ("Load") je vollständiger Stunde vor `before`. */
export function parseTypeHourly(body: { unix_seconds?: unknown; production_types?: { name?: string; data?: unknown }[] }, name: string, before: number): { hour: number; mw: number }[] {
  const types = expect(Array.isArray(body?.production_types) ? body.production_types : null, 'production_types');
  const t = types.find((x) => x?.name === name);
  if (!t) throw new Error(`unerwartete Antwort: Reihe ${name} fehlt`);
  const out: { hour: number; mw: number }[] = [];
  for (const [hour, v] of byHour(toSeries(body.unix_seconds, t.data, name), before)) {
    const mw = v.reduce((a, b) => a + b, 0) / v.length;
    if (mw < 0 || mw > 500_000) continue; // Plausibilität: andere Einheit
    out.push({ hour, mw });
  }
  return out.sort((a, b) => a.hour - b.hour);
}

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
      direction: 'down', weight: 0.5, unit: 'MW', intervalMinutes: 60, holdHours: 6, maxAgeHours: 36, baseline: hourly, thresholds: { relFloor: 0.05 },
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
    ...LOAD_COUNTRIES.map((c) => ({
      ...common, id: loadSignalId(c.cc), domain: 'grid', name: `Stromverbrauch ${c.label} (Netzlast)`,
      plain: `Wie viel Strom in ${c.label} gerade verbraucht wird. Bei einem großen Stromausfall bricht der Wert plötzlich ein.`,
      direction: 'down' as const, weight: 0.5, unit: 'MW', intervalMinutes: 60, holdHours: 6, baseline: hourly, thresholds: { relFloor: 0.05 },
      geo: { lat: c.lat, lon: c.lon, label: c.label, kind: 'country' as const, cc: c.cc },
      independenceGroup: 'energy-charts', license: CCBY, sourceName: 'Energy-Charts (Fraunhofer ISE)', sourceUrl: 'https://api.energy-charts.info/',
      banalCauses: ['Feiertage und Brückentage', 'Wetter', 'Zeitumstellung', 'Nachmeldungen der Netzbetreiber'],
    })),
    {
      ...common, id: S_NUCLEAR_FR, domain: 'plants', name: 'Kernkrafterzeugung Frankreich gemessen',
      plain: 'Wie viel Strom die französischen Kernkraftwerke gerade liefern. Fallen viele Blöcke unerwartet aus, fehlt Strom in ganz Europa.',
      direction: 'down', weight: 0.7, unit: 'MW', intervalMinutes: 60, holdHours: 6, baseline: hourly, thresholds: { relFloor: 0.05 },
      geo: { lat: 46.6, lon: 2.4, label: 'Frankreich', kind: 'country', cc: 'FR' },
      independenceGroup: 'energy-charts', license: CCBY, sourceName: 'Energy-Charts (Fraunhofer ISE)', sourceUrl: 'https://api.energy-charts.info/',
      banalCauses: ['Lastfolgebetrieb', 'Geplante Revisionen', 'Kühlwasser-Grenzen im Sommer', 'Streiks'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const before = floorHour(ctx.now).getTime();
    const enc = (d: Date) => encodeURIComponent(d.toISOString().slice(0, 16) + 'Z');
    let failures = 0;
    const attempts = 5 + LOAD_COUNTRIES.length;
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
      // Abschnitt 0 = jüngste 6 Stunden, ältere Abschnitte für die Sofort-Historie; Fehler je Abschnitt nur protokollieren.
      let ok = 0;
      for (let i = 0; i < FEEDIN_CHUNKS; i++) {
        const end = before - i * POWER_WINDOW_H * HOUR;
        const url = `${BASE}/public_power?country=de&start=${enc(new Date(end - POWER_WINDOW_H * HOUR))}&end=${enc(new Date(end))}`;
        try {
          const body = await ctx.http.json<Parameters<typeof parseRenewables>[0]>(url, { fixture: chunkFixture(`energy-charts/public_power-${POWER_WINDOW_H}h`, 'json', i) });
          for (const r of parseRenewables(body, end)) observations.push(obs(S_FEEDIN, r.hour, r.mw));
          ok++;
        } catch (e) { ctx.log(`Einspeisung Abschnitt ${i} übersprungen: ${(e as Error).message}`); }
      }
      if (!ok) throw new Error('kein Abschnitt lesbar');
    });
    for (const c of LOAD_COUNTRIES) {
      await tryPart(`Netzlast ${c.cc}`, async () => {
        let ok = 0;
        for (let i = 0; i < LOAD_CHUNKS; i++) {
          const end = before - i * POWER_WINDOW_H * HOUR;
          const url = `${BASE}/public_power?country=${c.cc.toLowerCase()}&start=${enc(new Date(end - POWER_WINDOW_H * HOUR))}&end=${enc(new Date(end))}`;
          try {
            const body = await ctx.http.json<Parameters<typeof parseTypeHourly>[0]>(url, { fixture: chunkFixture(`energy-charts/public_power-${c.cc.toLowerCase()}-${POWER_WINDOW_H}h`, 'json', i) });
            for (const r of parseTypeHourly(body, 'Load', end)) observations.push(obs(loadSignalId(c.cc), r.hour, Math.round(r.mw)));
            if (c.cc === 'FR') {
              try { for (const r of parseTypeHourly(body, 'Nuclear', end)) observations.push(obs(S_NUCLEAR_FR, r.hour, Math.round(r.mw))); }
              catch (e) { ctx.log(`Kernkraft FR Abschnitt ${i} übersprungen: ${(e as Error).message}`); }
            }
            ok++;
          } catch (e) { ctx.log(`Netzlast ${c.cc} Abschnitt ${i} übersprungen: ${(e as Error).message}`); }
        }
        if (!ok) throw new Error('kein Abschnitt lesbar');
      });
    }
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
      let ok = 0;
      for (let i = 0; i < PRICE_CHUNKS; i++) {
        const end = floorDay(ctx.now).getTime() - i * 2 * DAY_MS;
        const url = `${BASE}/price?bzn=DE-LU&start=${enc(new Date(end - 2 * DAY_MS))}&end=${enc(new Date(end))}`;
        try {
          const body = await ctx.http.json<PriceResp>(url, { fixture: chunkFixture('energy-charts/price-de-lu-2d', 'json', i) });
          for (const r of parseDayAheadDaily(body, end)) observations.push(obs(S_PRICE, `${r.day}T00:00:00Z`, r.eurMwh));
          ok++;
        } catch (e) { ctx.log(`Strompreis Abschnitt ${i} übersprungen: ${(e as Error).message}`); }
      }
      if (!ok) throw new Error('kein Abschnitt lesbar');
    });
    if (failures === attempts) throw new Error('Blackout-Brücke: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
