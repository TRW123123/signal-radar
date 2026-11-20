// SAM.gov Get Opportunities Public API (GSA): täglich neu veröffentlichte US-Bundesausschreibungen bestimmter Art (Klasse B: Pflichtveröffentlichungen).
// Quelle: https://api.sam.gov/opportunities/v2/search?api_key=<KEY>&postedFrom=MM/dd/yyyy&postedTo=MM/dd/yyyy&ptype=u&ncode=541512&limit=1&offset=0
//         https://api.sam.gov/opportunities/v2/search?api_key=<KEY>&postedFrom=...&postedTo=...&ncode=332993&limit=1&offset=0
// Doku: https://open.gsa.gov/api/get-opportunities-public-api/ (gelesen 20.11.2026): postedFrom/postedTo Pflicht (MM/dd/yyyy, höchstens 1 Jahr),
//   limit 0-1000 (Standard 1), ptype u = Justification (J&A), ncode = NAICS (bis 6 Stellen). Antwort { totalRecords, limit, offset,
//   opportunitiesData: [ { noticeId, title, postedDate, type, naicsCode, ... pointOfContact ... } ] }. Es wird nur totalRecords gelesen
//   (limit=1; Kontaktdaten der Vergabestellen werden nicht gespeichert). Request-Kontingent je Tag hängt von der Rolle des Kontos ab
//   (ohne Rolle sehr klein, laut Doku "limited based on roles"); deshalb nur 2 Requests je Lauf und Lauf einmal täglich.
// Key: SR_SAM_GOV_KEY als Query-Parameter api_key. Ohne Key antwortet der Endpunkt mit HTTP 404 ohne Inhalt (20.11.2026), auch mit DEMO_KEY.
//   Der HTTP-Client schwärzt "api_key" nicht; dieser Collector ersetzt den Key in Fehlermeldungen selbst.
// Lizenz: US-Bundesdaten, gemeinfrei (SAM.gov Terms of Use: keine Billigung andeuten, Rate-Limits einhalten).
// Gemessen (je ein Wert für einen abgeschlossenen Tag D = UTC-Datum von now - 30 h, damit der Tag auch in US-Ostküstenzeit vorbei ist):
//   cyber.services.sam_gov_justifications  Zahl neuer J&A-Notices (Vergabe ohne Wettbewerb) für NAICS 541512 (IT-Systemdesign) am Tag D
//   war.government.defense_procurement  Zahl neuer Notices aller Art für NAICS 332993 (Munition außer Kleinkaliber) am Tag D
//     (Katalog-Collector ist ted, EU-Ausschreibungen; SAM.gov ist dort als Alternative genannt. Wird ted gebaut, braucht eine der Reihen eine eigene id.)
// Harmlose Ursachen: Feiertage und Wochenenden (fast keine Veröffentlichungen), Haushaltsjahresende 30.09. (viele Vergaben im September),
//   Shutdown der US-Regierung, Sammelveröffentlichungen einzelner Vergabestellen.
// VERIFIED: nein (ungeprüft bis Key). Antwortformat aus der Doku (Beispielantwort "totalRecords": 34).

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { expect, isoDay, num, obs } from './_helpers.ts';

const BASE = 'https://api.sam.gov/opportunities/v2/search';
const KEY_ENV = 'SR_SAM_GOV_KEY';
const LAG_HOURS = 30;
const SIG_JA = 'cyber.services.sam_gov_justifications';
const SIG_DEF = 'war.government.defense_procurement';

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "cyber.services.sam_gov_justifications",scenarios: ["cyber"],domain: "services",name: "SAM.gov Justification-Notices (ohne Wettbewerb)",plain: "US-Notvergaben im Cyberbereich.",evidenceClass: "B",direction: "up",kind: "count",weight: 0.35,manipulability: "medium",independenceGroup: "sam-gov",unit: "Anzahl",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "US-Public-Domain",banalCauses: ["Fiskaljahresende"],sourceName: "SAM.gov Opportunities API",sourceUrl: "https://open.gsa.gov/api/get-opportunities-public-api/"},
  {id: "war.government.defense_procurement",scenarios: ["war"],domain: "government",name: "Staatliche Beschaffung von Munition und Luftabwehr",plain: "Zählt öffentliche Ausschreibungen und Zuschläge für Munition, Drohnenabwehr und Feldlazarette.",evidenceClass: "B",direction: "up",kind: "count",weight: 0.45,manipulability: "medium",independenceGroup: "ted",unit: "Anzahl",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "CC BY 4.0 (laut Erinnerung)",banalCauses: ["Aufrüstungsbudget","Haushaltsjahresende","Haushaltsende","Übungen"],sourceName: "TED (EU-Ausschreibungen) API v3",sourceUrl: "https://docs.ted.europa.eu/api/latest/index.html"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

/** totalRecords einer Suchantwort; wirft bei Fehlerobjekt oder fehlendem Feld. */
export function parseTotal(body: unknown): number {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  if (b.error || b.errorMessage || b.errorCode) {
    const e = b.error as Record<string, unknown> | string | undefined;
    throw new Error(`SAM.gov-Fehler: ${typeof e === 'object' && e ? String(e.message ?? e.code) : String(e ?? b.errorMessage ?? b.errorCode)}`);
  }
  const n = expect(num(b.totalRecords), 'totalRecords');
  if (n < 0) throw new Error('unerwartete Antwort: totalRecords negativ');
  return n;
}

/** Abgeschlossener Tag D (UTC-Datum von now - 30 h) als ISO und als MM/dd/yyyy. */
export function targetDay(now: Date): { iso: string; us: string } {
  const iso = isoDay(new Date(now.getTime() - LAG_HOURS * 3600_000));
  const [y, m, d] = iso.split('-');
  return { iso, us: `${m}/${d}/${y}` };
}

export function searchUrl(key: string, day: string, filter: string): string {
  return `${BASE}?api_key=${encodeURIComponent(key)}&postedFrom=${day}&postedTo=${day}&${filter}&limit=1&offset=0`;
}

const SOURCE = { sourceName: 'SAM.gov Opportunities API (GSA)', sourceUrl: 'https://sam.gov/', license: 'US-Bundesdaten, gemeinfrei' };

const JOBS: [string, string, string][] = [
  [SIG_JA, 'ptype=u&ncode=541512', 'sam-gov/justifications-541512.json'],
  [SIG_DEF, 'ncode=332993', 'sam-gov/naics-332993.json'],
];

const collector: Collector = {
  id: 'sam-gov',
  title: 'SAM.gov Ausschreibungen (GSA)',
  sourceUrl: 'https://open.gsa.gov/api/get-opportunities-public-api/',
  needsKey: KEY_ENV,
  intervalMinutes: 1440,
  signals: [
    { ...CATALOG[SIG_JA], ...SOURCE, collector: 'sam-gov', id: SIG_JA, maxAgeHours: 24 * 4,
      plain: 'Wie viele US-Behörden am Tag IT-Aufträge ohne Wettbewerb begründen (Justification & Approval) – oft ein Zeichen für Eilbedarf.' },
    { ...CATALOG[SIG_DEF], ...SOURCE, collector: 'sam-gov', id: SIG_DEF, maxAgeHours: 24 * 4,
      name: 'US-Ausschreibungen für Munition (SAM.gov)', plain: 'Wie viele neue US-Bundesausschreibungen am Tag Munition betreffen (NAICS 332993).' },
  ],
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const day = targetDay(ctx.now);
    const observations: Observation[] = [];
    let firstErr = '';
    for (const [sig, filter, fixture] of JOBS) {
      try {
        const n = parseTotal(await ctx.http.json(searchUrl(key, day.us, filter), { fixture }));
        observations.push(obs(sig, `${day.iso}T00:00:00Z`, n));
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).split(key).join('REDACTED').split(encodeURIComponent(key)).join('REDACTED');
        firstErr ||= msg;
        ctx.log(`sam-gov: ${sig} fehlgeschlagen: ${msg}`);
      }
    }
    if (!observations.length) throw new Error(`SAM.gov: alle Abrufe fehlgeschlagen (${firstErr})`);
    return { observations };
  },
};

export default collector;
