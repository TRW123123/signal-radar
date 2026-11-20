// FAA NOTAM API (External NOTAM API v1): Luftraumsperren an Brennpunkten, aktive US-TFRs, GPS-NOTAMs.
// Quelle: GET https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=...|domesticLocation=...|classification=...
// Doku: https://api.faa.gov/s/ (Gravitee-Portal; die NOTAM-API-Spezifikation ist dort nicht öffentlich gelistet, öffentlich
//   abrufbarer API-Katalog https://apim-api.apic4e.faa.gov/portal/environments/DEFAULT/apis enthält sie am 20.11.2026 nicht).
//   Format deshalb aus öffentlichem Client-Code abgeglichen (u. a. betaflight-configurator src/js/notam/faa.ts):
//   Header client_id und client_secret; Parameter icaoLocation, domesticLocation, classification (INTL|MIL|DOM|LMIL|FDC),
//   featureType, pageSize (max 1000), pageNum, responseFormat=geoJson (Standard).
//   Antwort: { pageSize, pageNum, totalCount, totalPages, items: [{ type: "Feature", properties: { coreNOTAMData: {
//   notam: { id, number, type, issued, selectionCode (Q-Code), location, icaoLocation, effectiveStart, effectiveEnd ("PERM"
//   möglich), text, classification, ... }, notamTranslation: [...] } }, geometry }] }.
// Key: Paar SR_FAA_NOTAM_USER (client_id) / SR_FAA_NOTAM_PASS (client_secret), als Header. Rate-Limit nicht dokumentiert;
//   hier 6 Requests pro Lauf, stündlich.
// Lizenz: US-Bundesbehördendaten, gemeinfrei (17 U.S.C. § 105); Quelle "FAA" nennen. Nutzungsbedingungen des API-Portals
//   (Registrierung) gelten zusätzlich.
// Gemessen:
//   war.military.faa_closures: neue Sperr-/Beschränkungs-NOTAMs am Vortag (UTC, nach issued, sonst effectiveStart) in den FIR
//     UKBV (Kiew), UBBA (Baku), OIIX (Teheran), RCAA (Taipeh), summiert. Sperr-NOTAM = Q-Code QR** (Sperr-, Gefahren-,
//     Beschränkungsgebiete) oder Q-Code mit Zustand LC (geschlossen); ohne Q-Code Textsuche (CLSD, RESTRICTED/PROHIBITED AREA).
//     Nur gemeldet, wenn alle vier FIR vollständig geholt wurden (sonst würde ein fehlender Summand wie ein Rückgang wirken).
//     Die API liefert nur gültige NOTAMs: am Vortag erteilte und schon abgelaufene fehlen (kurze Sperren werden unterschätzt).
//   nuclear.military.faa_notam_us_closures: Zahl der jetzt gültigen US-TFRs (classification=FDC, featureType=AIRSPACE, Text
//     "TEMPORARY FLIGHT RESTRICTION" bzw. 14 CFR 91.137-91.145/99.7), Momentaufnahme je volle Stunde.
//   cyber.physical.notam_gps_interference: Zahl der jetzt gültigen GPS-NOTAMs (domesticLocation=GPS, Text mit GPS),
//     Momentaufnahme je volle Stunde. Klasse C: Kontext, wird von der Engine nicht gewertet.
// Harmlose Ursachen: Militärübungen, Raumfahrtstarts, VIP-/Präsidenten-TFRs, Sportereignisse, angekündigte GPS-Tests
//   (US-Militär), Sammel-Neuausgaben (z. B. AIRAC-Termine) erhöhen die Tageszahl.
// Not built: war.military.russia_missile_ranges. Katalog-Collector ist eurocontrol (andere Messgröße: Flüge); dieselbe id
//   hier würde zwei Reihen mischen. Technisch wäre eine Zählung QRDCA/QRTCA für UMKK/ULLL/ULMM mit 3 weiteren Requests möglich.
// VERIFIED: nein (ungeprüft bis Key). Ohne Key HTTP 401 ({"message":"Unauthorized"}); offizielle Spec nicht öffentlich.

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, floorHour, isoDay, num, obs } from './_helpers.ts';

const USER_ENV = 'SR_FAA_NOTAM_USER';
const PASS_ENV = 'SR_FAA_NOTAM_PASS';
const BASE = 'https://external-api.faa.gov/notamapi/v1/notams';
const PAGE_SIZE = 1000;
export const FIRS = ['UKBV', 'UBBA', 'OIIX', 'RCAA'];
export const SIG_CLOSURES = 'war.military.faa_closures';
export const SIG_TFR = 'nuclear.military.faa_notam_us_closures';
export const SIG_GPS = 'cyber.physical.notam_gps_interference';

export interface Notam { id: string; issued: number | null; start: number | null; end: number | null; qcode: string; text: string }
export interface NotamPage { notams: Notam[]; total: number }

function time(x: unknown): number | null {
  if (typeof x !== 'string' || !x.trim() || /PERM/i.test(x)) return null;
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : null;
}

/** Parses a geoJson NOTAM response page. */
export function parseNotams(body: unknown): NotamPage {
  const b = (body ?? {}) as { items?: unknown; totalCount?: unknown };
  const items = expect(b.items, 'items');
  if (!Array.isArray(items)) throw new Error('unerwartete Antwort: items ist keine Liste');
  const notams: Notam[] = [];
  for (const it of items as Record<string, any>[]) {
    const n = it?.properties?.coreNOTAMData?.notam;
    if (!n || typeof n !== 'object') continue;
    notams.push({
      id: String(n.id ?? n.number ?? ''),
      issued: time(n.issued),
      start: time(n.effectiveStart),
      end: time(n.effectiveEnd),
      qcode: String(n.selectionCode ?? '').toUpperCase(),
      text: String(n.text ?? n.icaoMessage ?? ''),
    });
  }
  return { notams, total: num(b.totalCount) ?? notams.length };
}

export function isClosure(n: Notam): boolean {
  if (/^Q[A-Z]{4}$/.test(n.qcode)) return n.qcode[1] === 'R' || n.qcode.endsWith('LC');
  return /\bCLSD\b|RESTRICTED AREA|PROHIBITED AREA|DANGER AREA/i.test(n.text);
}
export const isTfr = (n: Notam) => /TEMPORARY FLIGHT RESTRICTION|\b(91\.13[789]|91\.14[135]|99\.7)\b/i.test(n.text);
export const isGps = (n: Notam) => /\bGPS\b/i.test(n.text);
export function isActive(n: Notam, now: Date): boolean {
  const t = now.getTime();
  return (n.start === null || n.start <= t) && (n.end === null || n.end > t);
}

/** Closure NOTAMs issued on the previous complete UTC day. */
export function closuresYesterday(notams: Notam[], now: Date): { day: string; count: number } {
  const to = floorDay(now).getTime();
  const from = to - DAY_MS;
  const count = notams.filter((n) => {
    const t = n.issued ?? n.start;
    return t !== null && t >= from && t < to && isClosure(n);
  }).length;
  return { day: isoDay(new Date(from)), count };
}

export function activeCount(notams: Notam[], now: Date, pred: (n: Notam) => boolean): number {
  return notams.filter((n) => pred(n) && isActive(n, now)).length;
}

function complete(p: NotamPage): NotamPage {
  if (p.total > p.notams.length) throw new Error(`nur ${p.notams.length} von ${p.total} NOTAMs in einer Seite, Zählung verworfen`);
  return p;
}

const PD = 'US-Regierungsdaten, gemeinfrei; Quelle FAA nennen';
const hourBase = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };

const collector: Collector = {
  id: 'faa-notam',
  title: 'FAA NOTAM API',
  sourceUrl: 'https://api.faa.gov/s/',
  needsKey: [USER_ENV, PASS_ENV],
  intervalMinutes: 60,
  signals: [
    { id: SIG_CLOSURES, scenarios: ['war'], domain: 'military', name: 'Luftraum-Beschränkungen (NOTAM) an Brennpunkten',
      plain: 'Zählt neue Luftraum-Beschränkungen (NOTAM) für Kiew, Baku, Teheran und Taipeh pro Tag.',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.65, manipulability: 'medium', independenceGroup: 'faa-notam',
      unit: 'NOTAMs/Tag', intervalMinutes: 1440, holdHours: 48, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      license: PD, sourceName: 'FAA NOTAM API (api.faa.gov)', sourceUrl: 'https://api.faa.gov/s/',
      banalCauses: ['Übungen', 'Raumfahrtstarts', 'Wartung', 'Sammel-Neuausgaben'] },
    { id: SIG_TFR, scenarios: ['nuclear'], domain: 'military', name: 'FAA: Luftraumsperren (NOTAM)',
      plain: 'Zahl der gerade gültigen temporären Sperrungen des US-Luftraums (TFR).',
      evidenceClass: 'B', direction: 'up', kind: 'count', weight: 0.5, manipulability: 'medium', independenceGroup: 'faa-notam',
      unit: 'TFRs', intervalMinutes: 60, holdHours: 12, baseline: hourBase, license: PD,
      sourceName: 'FAA NOTAM API (api.faa.gov)', sourceUrl: 'https://api.faa.gov/s/',
      banalCauses: ['Regierungsflüge', 'Starts', 'Sportereignisse', 'Waldbrände'] },
    { id: SIG_GPS, scenarios: ['cyber'], domain: 'physical', name: 'NOTAMs zu GPS-Ausfall',
      plain: 'Anzahl der gerade gültigen Flugwarnungen zu gestörtem GPS in den USA.',
      evidenceClass: 'C', direction: 'up', kind: 'count', weight: 0.25, manipulability: 'medium', independenceGroup: 'faa-notam',
      unit: 'NOTAMs', intervalMinutes: 60, holdHours: 12, baseline: hourBase, license: PD,
      sourceName: 'FAA NOTAM API (api.faa.gov)', sourceUrl: 'https://api.faa.gov/s/',
      banalCauses: ['Militärische GPS-Tests', 'Übungen'] },
  ],
  async collect(ctx) {
    const headers = { client_id: expect(ctx.key(USER_ENV), USER_ENV), client_secret: expect(ctx.key(PASS_ENV), PASS_ENV) };
    const get = async (query: string, fixture: string) =>
      complete(parseNotams(await ctx.http.json<unknown>(`${BASE}?${query}&pageSize=${PAGE_SIZE}&pageNum=1`, { fixture: `faa-notam/${fixture}.json`, headers, timeoutMs: 60_000 })));
    const observations: Observation[] = [];
    let ok = 0;
    // Brennpunkt-FIR: nur vollständige Summe melden
    try {
      let sum = 0;
      let day = '';
      const per: Record<string, number> = {};
      for (const fir of FIRS) {
        const r = closuresYesterday((await get(`icaoLocation=${fir}`, `fir-${fir.toLowerCase()}`)).notams, ctx.now);
        sum += r.count; day = r.day; per[fir] = r.count;
      }
      observations.push(obs(SIG_CLOSURES, `${day}T00:00:00Z`, sum, per));
      ok++;
    } catch (e) {
      ctx.log(`${SIG_CLOSURES} übersprungen: ${(e as Error).message}`);
    }
    const hour = floorHour(ctx.now);
    for (const [sig, q, fx, pred] of [
      [SIG_TFR, 'classification=FDC&featureType=AIRSPACE', 'us-fdc-airspace', isTfr],
      [SIG_GPS, 'domesticLocation=GPS', 'us-gps', isGps],
    ] as const) {
      try {
        observations.push(obs(sig, hour, activeCount((await get(q, fx)).notams, ctx.now, pred)));
        ok++;
      } catch (e) {
        ctx.log(`${sig} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('FAA NOTAM API: keine Abfrage erfolgreich');
    return { observations };
  },
};

export default collector;
