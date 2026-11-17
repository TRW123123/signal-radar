// Microsoft Security Update Guide (CVRF API v3.0), Klasse B: Veröffentlichungen von Microsoft-Sicherheitsinformationen.
// Quelle: https://api.msrc.microsoft.com/cvrf/v3.0/updates  Doku: https://api.msrc.microsoft.com/cvrf/v3.0/swagger/index.html
// Lizenz/Nutzung: Microsoft-Nutzungsbedingungen des Security Update Guide (öffentliche, keyfreie API).
// Die Liste enthält Monatsdokumente (ID wie "2026-Nov") und Einzel-CVE-Dokumente (ID "CVE-2026-xxxxx") mit
// InitialReleaseDate und CurrentReleaseDate. Gemessen werden zwei feinere Signale statt Monatszahlen:
//   (1) Monatsdokumente, deren CurrentReleaseDate nicht auf einen Patch-Dienstag fällt (Out-of-band-Veröffentlichung/-Überarbeitung),
//   (2) neue CVE-Dokumente pro Tag nach InitialReleaseDate.
// Harmlose Ursachen: Patch-Dienstag (2. Dienstag) erzeugt jeden Monat einen Volumenspitzer in (2); Microsoft überarbeitet Monatsdokumente
//   gelegentlich nachträglich ohne akuten Anlass; CVEs für Cloud-Dienste erscheinen außerhalb des Zyklus.
// Filter: OData `$filter=CurrentReleaseDate gt <Datum>` hält die Antwort klein (ob die API den Filter akzeptiert, ist ungeprüft;
//   der Parser filtert zusätzlich selbst auf das Fenster, die Antwort darf also auch größer sein).
// VERIFIED: nein (Feldnamen ID, CurrentReleaseDate, InitialReleaseDate aus dem Gedächtnis).

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, isoDay, obs } from './_helpers.ts';

interface Item { ID?: string; Alias?: string; InitialReleaseDate?: string; CurrentReleaseDate?: string }
interface Resp { value?: Item[] }

export function urlFor(now: Date, days: number): string {
  return `https://api.msrc.microsoft.com/cvrf/v3.0/updates?$filter=CurrentReleaseDate%20gt%20${isoDay(daysAgo(now, days + 2))}T00:00:00Z`;
}

/** Second Tuesday of the month containing the given YYYY-MM-DD. */
export function isPatchTuesday(day: string): boolean {
  const d = new Date(`${day}T00:00:00Z`);
  return d.getUTCDay() === 2 && d.getUTCDate() >= 8 && d.getUTCDate() <= 14;
}

export interface Doc { id: string; kind: 'monthly' | 'cve'; initialDay: string | null; currentDay: string | null }

export function parseUpdates(body: Resp): Doc[] {
  const list = expect(body.value, 'value');
  const day = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
  const out: Doc[] = [];
  for (const it of list) {
    const id = typeof it?.ID === 'string' ? it.ID : typeof it?.Alias === 'string' ? it.Alias : '';
    const kind = /^CVE-/i.test(id) ? 'cve' : /^\d{4}-[A-Za-z]{3}/.test(id) ? 'monthly' : null;
    if (!kind) continue;
    out.push({ id, kind, initialDay: day(it.InitialReleaseDate), currentDay: day(it.CurrentReleaseDate) });
  }
  return out;
}

export function buildObservations(docs: Doc[], now: Date, days: number): Observation[] {
  const oob = new Map<string, number>();
  const cve = new Map<string, number>();
  for (let i = 1; i <= days; i++) { const k = isoDay(daysAgo(now, i)); oob.set(k, 0); cve.set(k, 0); }
  for (const d of docs) {
    if (d.kind === 'monthly' && d.currentDay && oob.has(d.currentDay) && !isPatchTuesday(d.currentDay)) oob.set(d.currentDay, oob.get(d.currentDay)! + 1);
    if (d.kind === 'cve' && d.initialDay && cve.has(d.initialDay)) cve.set(d.initialDay, cve.get(d.initialDay)! + 1);
  }
  const toObs = (id: string, m: Map<string, number>) => [...m.entries()].sort().map(([k, v]) => obs(id, `${k}T00:00:00Z`, v));
  return [...toObs('cyber.vuln.msrc_out_of_band', oob), ...toObs('cyber.vuln.msrc_cve_publications', cve)];
}

const collector: Collector = {
  id: 'msrc-cvrf',
  title: 'Microsoft MSRC Security Update Guide (CVRF)',
  sourceUrl: 'https://api.msrc.microsoft.com/cvrf/v3.0/swagger/index.html',
  intervalMinutes: 1440,
  signals: [
    {
      id: 'cyber.vuln.msrc_out_of_band', scenarios: ['cyber'], domain: 'vuln', name: 'Microsoft-Monatsbulletin außerhalb des Patch-Dienstags',
      plain: 'Wie oft Microsoft sein Sicherheitsbulletin außerhalb des festen Patch-Dienstags veröffentlicht oder überarbeitet.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.75, manipulability: 'low', independenceGroup: 'msrc-cvrf',
      unit: 'Dokumente/Tag', intervalMinutes: 1440, holdHours: 96,
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 },
      thresholds: { absFloor: 1 },
      license: 'Microsoft-Nutzungsbedingungen',
      banalCauses: ['Nachträgliche Überarbeitung ohne akuten Anlass'],
    },
    {
      id: 'cyber.vuln.msrc_cve_publications', scenarios: ['cyber'], domain: 'vuln', name: 'Neue Microsoft-CVE-Meldungen pro Tag',
      plain: 'Wie viele neue Sicherheitslücken Microsoft täglich in seinem Update-Guide veröffentlicht.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.4, manipulability: 'low', independenceGroup: 'msrc-cvrf',
      unit: 'CVEs/Tag', intervalMinutes: 1440, holdHours: 48,
      baseline: { method: 'rolling', windowDays: 90, minPoints: 30 },
      thresholds: { relFloor: 0.2 },
      license: 'Microsoft-Nutzungsbedingungen',
      banalCauses: ['Patch-Dienstag (2. Dienstag im Monat)', 'Sammelveröffentlichung für Cloud-Dienste'],
    },
  ],
  async collect(ctx) {
    const docs = parseUpdates(await ctx.http.json<Resp>(urlFor(ctx.now, 90), { fixture: 'msrc-cvrf/updates.json', headers: { Accept: 'application/json' }, timeoutMs: 30000 }));
    if (docs.length === 0) throw new Error('unerwartete Antwort: keine Dokumente im Fenster');
    return { observations: buildObservations(docs, ctx.now, 90) };
  },
};

export default collector;
