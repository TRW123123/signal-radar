// CISA Known Exploited Vulnerabilities (KEV), Klasse B: Behörden-Katalog tatsächlich ausgenutzter Schwachstellen.
// Quelle: offizieller GitHub-Spiegel cisagov/kev-data (Datei im Repo-Root, Branch main), identisch mit dem Feed auf cisa.gov.
// Doku: https://www.cisa.gov/known-exploited-vulnerabilities-catalog , https://github.com/cisagov/kev-data
// Lizenz: CC0 / US-Regierungswerk, gemeinfrei (laut CISA und Repo; nicht eigenhändig geprüft).
// Gemessen: (1) Neuaufnahmen der letzten 7 Tage (gleitende Summe, je voller UTC-Tag; Feld vulnerabilities[].dateAdded), (2) gleitender 28-Tage-Anteil der Neuaufnahmen mit
//   knownRansomwareCampaignUse == "Known".
// Harmlose Ursachen: Backlog-Aufarbeitung und Sammelaufnahmen alter CVEs, Patch-Dienstag-Zyklus, an Wochenenden keine Aufnahmen.
//   Das Ransomware-Flag wird nachträglich gesetzt; ältere Fenster werden daher mit der Zeit höher, das jüngste Fenster ist tendenziell zu niedrig.
// Abweichung vom Guide: die Datei ist größer als 1 MB (ein Request, gesamte Historie); der Parser filtert selbst auf das Fenster.
// Echte Daten (17.11.2026, 1781 Einträge): Tageswerte sind klein und stoßweise (Mittel 1,2 pro Tag, 50 % Nulltage, Maximum 7), Wochensummen
//   (ISO-Wochen seit August) liegen stabil bei 3 bis 14. Deshalb wird die gleitende 7-Tage-Summe gemeldet statt der Tageszahl.
//   Das Ransomware-Flag ist in den echten Daten für September bis November durchgehend 0 von 94 Neuaufnahmen (wird nachträglich gesetzt);
//   das zweite Signal liefert deshalb derzeit nur Nullen und trägt erst nach Nachpflege Information.
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { countPerDay, daysAgo, expect, isoDay, obs } from './_helpers.ts';

export const URL = 'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json';

interface Raw { vulnerabilities?: { cveID?: string; dateAdded?: string; knownRansomwareCampaignUse?: string }[] }
export interface KevEntry { cve: string; day: string; ransomware: boolean }

/** Reads entries; entries without a valid dateAdded are dropped. Throws when the catalog array is missing. */
export function parseKev(body: Raw): KevEntry[] {
  const list = expect(body.vulnerabilities, 'vulnerabilities');
  const out: KevEntry[] = [];
  for (const v of list) {
    if (!v || typeof v.dateAdded !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.dateAdded)) continue;
    out.push({
      cve: String(v.cveID ?? ''),
      day: v.dateAdded,
      ransomware: String(v.knownRansomwareCampaignUse ?? '').toLowerCase() === 'known',
    });
  }
  return out;
}

/** Additions per complete UTC day, zeros included. */
export function additionsPerDay(entries: KevEntry[], now: Date, days: number): Observation[] {
  return countPerDay('cyber.vuln.kev_additions_rate', entries.map((e) => `${e.day}T00:00:00Z`), now, { days });
}

/** Trailing 7-day sum of additions, one value per complete UTC day (the day itself and the 6 days before). */
export function additionsRolling7(entries: KevEntry[], now: Date, days: number): Observation[] {
  const perDay = new Map(additionsPerDay(entries, now, days + 6).map((o) => [o.ts.slice(0, 10), o.value]));
  const out: Observation[] = [];
  for (let i = days; i >= 1; i--) {
    let sum = 0;
    for (let k = 0; k < 7; k++) sum += perDay.get(isoDay(daysAgo(now, i + k))) ?? 0;
    out.push(obs('cyber.vuln.kev_additions_rate', `${isoDay(daysAgo(now, i))}T00:00:00Z`, sum));
  }
  return out;
}

/** Rolling share (percent) of additions flagged "Known" over `window` days ending at each complete day. Windows with fewer than minN additions are skipped. */
export function ransomwareShare(entries: KevEntry[], now: Date, opts: { days: number; window: number; minN: number }): Observation[] {
  const out: Observation[] = [];
  for (let i = opts.days; i >= 1; i--) {
    const end = isoDay(daysAgo(now, i));
    const start = isoDay(daysAgo(now, i + opts.window - 1));
    let n = 0, known = 0;
    for (const e of entries) {
      if (e.day >= start && e.day <= end) { n++; if (e.ransomware) known++; }
    }
    if (n >= opts.minN) out.push(obs('cyber.vuln.kev_ransomware_flag', `${end}T00:00:00Z`, Math.round((1000 * known) / n) / 10, { n, known }));
  }
  return out;
}

const collector: Collector = {
  id: 'cisa-kev',
  title: 'CISA Known Exploited Vulnerabilities (GitHub-Spiegel)',
  sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  intervalMinutes: 1440,
  signals: [
    {
      id: 'cyber.vuln.kev_additions_rate', scenarios: ['cyber'], domain: 'vuln', name: 'Neuaufnahmen im CISA-KEV-Katalog (7-Tage-Summe)',
      plain: 'Wie viele aktiv ausgenutzte Schwachstellen in den letzten sieben Tagen neu in die Liste der US-Behörde CISA aufgenommen werden.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.65, manipulability: 'medium', independenceGroup: 'cisa-kev',
      unit: 'Einträge/7 Tage', intervalMinutes: 1440, holdHours: 72,
      baseline: { method: 'rolling', windowDays: 90, minPoints: 28 },
      thresholds: { absFloor: 5, relFloor: 0.5 },
      license: 'CC0 / US-Regierungswerk',
      banalCauses: ['Backlog-Aufarbeitung durch CISA', 'Sammelaufnahmen alter CVEs', 'Patch-Dienstag-Zyklus'],
    },
    {
      id: 'cyber.vuln.kev_ransomware_flag', scenarios: ['cyber'], domain: 'vuln', name: 'Anteil KEV-Neuaufnahmen mit Ransomware-Nutzung (28 Tage)',
      plain: 'Welcher Anteil der zuletzt gelisteten ausgenutzten Schwachstellen bereits von Erpressungstrojanern genutzt wird.',
      evidenceClass: 'B', direction: 'up', kind: 'gauge', weight: 0.5, manipulability: 'low', independenceGroup: 'cisa-kev',
      unit: '%', intervalMinutes: 1440, holdHours: 72,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
      thresholds: { absFloor: 5 },
      license: 'CC0 / US-Regierungswerk',
      banalCauses: ['Flag wird nachträglich gesetzt (jüngste Werte zu niedrig)', 'Einzelne große Sammelaufnahme'],
    },
  ],
  async collect(ctx) {
    const body = await ctx.http.json<Raw>(URL, { fixture: 'cisa-kev/known_exploited_vulnerabilities.json', timeoutMs: 60000 });
    const entries = parseKev(body);
    if (entries.length === 0) throw new Error('unerwartete Antwort: KEV-Katalog leer');
    return {
      observations: [
        ...additionsRolling7(entries, ctx.now, 90),
        ...ransomwareShare(entries, ctx.now, { days: 60, window: 28, minN: 5 }),
      ],
    };
  },
};

export default collector;
