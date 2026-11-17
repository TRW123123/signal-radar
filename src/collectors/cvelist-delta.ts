// CVE-Programm: neu veröffentlichte und aktualisierte CVE-Einträge pro Tag (Klasse B: Pflege-Daten der CNAs).
// Quelle: deltaLog.json im Repo CVEProject/cvelistV5 (GitHub), das etwa alle 7 Minuten aus den CVE Services erzeugt wird.
// https://github.com/CVEProject/cvelistV5 (Datei cves/deltaLog.json, ca. 31 MB, 30 Tage Verlauf)
// Lizenz: CVE Program Terms of Use (https://www.cve.org/Legal/TermsOfUse), Nutzung und Weitergabe frei, kostenlos, ohne Key.
// Aufbau: Liste, neueste zuerst, je Abruf-Lauf ein Eintrag { fetchTime, numberOfChanges, new[], updated[], error[] };
//   Läufe ohne Änderungen stehen nicht im Log (Tage ohne Eintrag zählen als 0).
// Gemessen: je voller UTC-Tag (nach fetchTime) die Summe von `new` und von `updated`. Der erste (angeschnittene) Tag des
//   Logs und der laufende Tag entfallen; ist das Log älter als 6 Stunden, wird ein Fehler geworfen statt Nullen zu melden.
//   Tagesreihen statt Stundenreihen: CVEs erscheinen stoßweise, der erste Backtest zeigte bei Stundenwerten 17,7 Einzel-Ausschläge
//   pro 30 Tage (zu laut).
// Harmlose Ursachen: Massen-Updates einzelner CNAs (z. B. Metadaten-Korrekturen: tausende updated in einer Stunde),
//   Reservierungs-Stapel vor Feiertagen, Pause des Abrufdienstes (Lücke, danach Nachholstapel), Wochenendrhythmus.
// Hinweis: Der Abruf lädt 31 MB; intervalMinutes 360 hält die Last gering.
// Kein Stichwort-Filter je Szenario: die Einträge in new[]/updated[] tragen nur cveId, cveOrgLink, githubLink und dateUpdated
// (geprüft am Fixture, 3 225 Läufe), keinen Beschreibungstext; ein Filter bräuchte je CVE einen weiteren Abruf.
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const URL_DELTA = 'https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/deltaLog.json';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const SIG_NEW = 'cyber.vuln.cve_published_daily';
const SIG_UPD = 'cyber.vuln.cve_updated_daily';
const MAX_LOG_AGE_H = 6;

interface Entry { fetchTime?: string; new?: unknown[]; updated?: unknown[] }
export interface DayCount { day: number; published: number; updated: number }

/** Summiert new/updated je UTC-Tag und füllt Tage ohne Log-Eintrag mit 0. */
export function parseDelta(body: unknown, now: Date): DayCount[] {
  const list = expect(Array.isArray(body) ? (body as Entry[]) : null, 'Liste der Abruf-Läufe');
  const perDay = new Map<number, { p: number; u: number }>();
  let minT = Infinity;
  let maxT = -Infinity;
  for (const e of list) {
    const t = typeof e?.fetchTime === 'string' ? Date.parse(e.fetchTime) : NaN;
    if (!Number.isFinite(t)) continue;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
    const h = Math.floor(t / DAY) * DAY;
    const o = perDay.get(h) ?? { p: 0, u: 0 };
    o.p += Array.isArray(e.new) ? e.new.length : 0;
    o.u += Array.isArray(e.updated) ? e.updated.length : 0;
    perDay.set(h, o);
  }
  if (!Number.isFinite(minT)) return [];
  if (now.getTime() - maxT > MAX_LOG_AGE_H * HOUR) {
    throw new Error(`deltaLog veraltet: letzter Lauf ${new Date(maxT).toISOString()}`);
  }
  const start = Math.ceil(minT / DAY) * DAY; // erster voller Tag
  let end = Math.floor(now.getTime() / DAY) * DAY; // laufender Tag entfällt
  if (maxT < end - 2 * HOUR) end -= DAY; // letzter Tag nicht bis zum Ende abgedeckt
  const out: DayCount[] = [];
  for (let d = start; d < end; d += DAY) {
    const o = perDay.get(d);
    out.push({ day: d, published: o?.p ?? 0, updated: o?.u ?? 0 });
  }
  return out;
}

const common = {
  scenarios: ['cyber'], domain: 'vuln', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'cvelist-v5', unit: 'CVEs/Tag', intervalMinutes: 360, holdHours: 36,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  sourceName: 'CVE Project cvelistV5 (GitHub)', sourceUrl: 'https://github.com/CVEProject/cvelistV5',
  license: 'CVE Program Terms of Use',
  thresholds: { z0: 3, z1: 8, relFloor: 0.3 },
};

const collector: Collector = {
  id: 'cvelist-delta',
  title: 'CVE-Liste (cvelistV5 deltaLog)',
  sourceUrl: 'https://github.com/CVEProject/cvelistV5',
  intervalMinutes: 360,
  signals: [
    {
      ...common, id: SIG_NEW, name: 'Neu veröffentlichte CVEs pro Tag', weight: 0.3,
      plain: 'Wie viele neue Sicherheitslücken mit CVE-Nummer pro Tag veröffentlicht werden; ein Sprung zeigt ungewöhnliche Meldewellen.',
      banalCauses: ['Meldestapel einzelner CNAs', 'Feiertage und Wochenenden', 'Pause des Abrufdienstes'],
    },
    {
      ...common, id: SIG_UPD, name: 'Aktualisierte CVEs pro Tag', weight: 0.2,
      plain: 'Wie viele bestehende CVE-Einträge pro Tag überarbeitet werden; Sprünge sind meist Massenkorrekturen, selten Krisen.',
      banalCauses: ['Massen-Updates einzelner CNAs', 'Metadaten-Korrekturen'],
    },
  ],
  async collect(ctx) {
    const body = await ctx.http.json<unknown>(URL_DELTA, { fixture: 'cvelist/deltaLog.json', timeoutMs: 180_000 });
    const days = parseDelta(body, ctx.now);
    const observations: Observation[] = [];
    for (const h of days) {
      observations.push(obs(SIG_NEW, h.day, h.published));
      observations.push(obs(SIG_UPD, h.day, h.updated));
    }
    return { observations };
  },
};

export default collector;
