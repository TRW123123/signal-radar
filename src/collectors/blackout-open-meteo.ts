// Blackout, Wetter: Tagesminimum der Lufttemperatur an drei Orten in Deutschland (Kälte als Last- und Knappheitstreiber).
// Quelle: Open-Meteo Forecast API, https://open-meteo.com/en/docs (kein Key, Lizenz CC BY 4.0, Namensnennung "Open-Meteo.com", nur nicht-kommerzielle
// Nutzung im Gratis-Tarif; Rate-Limit laut Doku 10 000 Aufrufe/Tag, wir brauchen 24 pro Tag).
// Anfrage: eine Abfrage mit drei Orten (Berlin, Frankfurt, München) als kommagetrennte Koordinaten, daily=temperature_2m_min, timezone=UTC,
// past_days=30, forecast_days=1. Antwort laut Doku: Array von je einem Objekt { daily: { time: [...], temperature_2m_min: [...] } }
// (bei nur einem Ort ein einzelnes Objekt; beides wird akzeptiert). Ca. 2 500 Zeichen.
// Gemeldet: je abgeschlossenem UTC-Tag (der heutige Tag aus forecast_days=1 ist unvollständig/Vorhersage und fehlt) das Mittel der drei Tagesminima in °C;
// Tage, an denen ein Ort null liefert, fehlen. Die Werte der Vergangenheit sind Modellanalysen (Reanalyse/Messungen), keine Prognose.
// Harmlose Ursachen für Ausschläge: normale Jahreszeit (die Baseline gleitet mit, daher Fenster 28 Tage), kurze Frostnächte ohne Folgen.
// VERIFIED: ja (Live-Lauf 24.11.2026, 30 Beobachtungen)

import type { Collector, GeoRef, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, num, obs } from './_helpers.ts';

export const SIG_COLD = 'blackout.weather.cold_wave_temperature';
export const POINTS: { name: string; lat: number; lon: number }[] = [
  { name: 'Berlin', lat: 52.52, lon: 13.41 }, { name: 'Frankfurt', lat: 50.11, lon: 8.68 }, { name: 'München', lat: 48.14, lon: 11.58 },
];
const DE: GeoRef = { lat: 51.2, lon: 10.4, label: 'Deutschland', kind: 'country', cc: 'DE' };

export function buildUrl(): string {
  const lat = POINTS.map((p) => p.lat).join(',');
  const lon = POINTS.map((p) => p.lon).join(',');
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min&timezone=UTC&past_days=30&forecast_days=1`;
}

interface Loc { daily?: { time?: unknown; temperature_2m_min?: unknown } }

/** Mittel der Tagesminima über alle Orte je Tag vor `before` (ms). Ein Ort ohne Wert macht den Tag ungültig. */
export function parseColdDaily(body: unknown, before: number, places = POINTS.length): { day: string; celsius: number }[] {
  const locs: Loc[] = Array.isArray(body) ? body : [body as Loc];
  if (locs.length !== places) throw new Error(`unerwartete Antwort: ${locs.length} statt ${places} Orte`);
  const perDay = new Map<string, (number | null)[]>();
  for (const l of locs) {
    const time = expect(Array.isArray(l?.daily?.time) ? (l.daily!.time as unknown[]) : null, 'daily.time');
    const t = expect(Array.isArray(l?.daily?.temperature_2m_min) ? (l.daily!.temperature_2m_min as unknown[]) : null, 'daily.temperature_2m_min');
    time.forEach((d, i) => {
      if (typeof d !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(d)) return;
      (perDay.get(d) ?? perDay.set(d, []).get(d)!).push(num(t[i]));
    });
  }
  const out: { day: string; celsius: number }[] = [];
  for (const [day, vals] of [...perDay].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (Date.parse(`${day}T00:00:00Z`) + DAY_MS > before) continue;
    if (vals.length !== places || vals.some((v) => v === null || v < -60 || v > 60)) continue;
    out.push({ day, celsius: (vals as number[]).reduce((a, b) => a + b, 0) / places });
  }
  return out;
}

const collector: Collector = {
  id: 'blackout-open-meteo',
  title: 'Open-Meteo: Kälte in Deutschland (Tagesminimum, Blackout-Sicht)',
  sourceUrl: 'https://open-meteo.com/en/docs',
  intervalMinutes: 1440,
  signals: [
    {
      id: SIG_COLD, scenarios: ['blackout'], domain: 'weather', name: 'Kälte in Deutschland (Tagesminimum, Mittel aus Berlin, Frankfurt, München)',
      plain: 'Wie kalt die Nächte in Deutschland sind; anhaltender Frost treibt Heizlast und Strombedarf und verschärft jede Knappheit.',
      evidenceClass: 'A', direction: 'down', kind: 'gauge', weight: 0.7, manipulability: 'low', independenceGroup: 'open-meteo', geo: DE,
      unit: '°C', intervalMinutes: 1440, holdHours: 48, maxAgeHours: 72,
      baseline: { method: 'rolling', windowDays: 28, minPoints: 14 }, thresholds: { absFloor: 2 },
      license: 'CC BY 4.0 (Open-Meteo.com), Gratis-Tarif nur nicht-kommerziell', sourceName: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/',
      banalCauses: ['Normaler Wintereinbruch', 'Jahreszeitlicher Verlauf', 'Kurze Frostnächte ohne Netzfolgen'],
    },
  ],
  async collect(ctx) {
    const before = floorDay(ctx.now).getTime();
    const body = await ctx.http.json<unknown>(buildUrl(), { fixture: 'open-meteo/de-cold-min-30d.json' });
    const observations: Observation[] = parseColdDaily(body, before).map((r) => obs(SIG_COLD, `${r.day}T00:00:00Z`, Math.round(r.celsius * 100) / 100));
    if (!observations.length) throw new Error('Open-Meteo: keine vollständigen Tage in der Antwort');
    return { observations };
  },
};

export default collector;
