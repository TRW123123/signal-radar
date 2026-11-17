// Deutschland: Zahl aktiver Warnmeldungen im Modularen Warnsystem MoWaS, wie sie die Warn-App NINA zeigt (Evidenzklasse C: amtliche
// Mitteilung, nur Kontext; Gewicht höchstens 0,2). Die Meldungen sind Aussagen von Behörden, keine Messung.
// Quelle: Bundesamt für Bevölkerungsschutz und Katastrophenhilfe (BBK), NINA-API https://nina.api.bund.dev/ (inoffizielle Doku),
// Endpunkt https://warnung.bund.de/api31/mowas/mapData.json, kein Key. Lizenz/Nutzung: Daten des BBK, Hinweise unter
// https://www.bbk.bund.de/ (Quellenangabe); nur passive Leseabfrage, keine Personen.
// Aufbau (nach Doku, Liste): [{ id, version, startDate, severity, urgency, type, i18nTitle: { de }, transKeys }]; type Alert/Update/Cancel,
// severity Minor/Moderate/Severe/Extreme. Es wird nur gezählt, kein Text gespeichert.
// Gemessen (Zeitstempel = Abrufzeit auf 15 Minuten abgerundet): (1) Zahl aller Meldungen außer type Cancel, (2) davon Zahl mit severity
// Severe oder Extreme (Kategorie schwer), (3) Zahl der Meldungen, deren deutscher Titel ein Strahlungs- oder Atom-Stichwort enthält
// (radiolog, radioakt, strahl, nuklear, atom, kernkraft, kernreaktor, kernwaffe, jod, CBRN).
// Harmlose Ursachen: Unwetter und Hochwasser (viele Meldungen), Bundesweiter Warntag (2. Donnerstag im September, Testmeldungen),
// Übungen, Bombenentschärfungen und Großbrände (Schlagwort-Treffer durch Wortbestandteile wie "Strahl" in Sonnenstrahl).
// Hinweis: Stichwort-Zähler zählt auch Wortteile; der Zähler ist grob und dient nur als Kontext. Die Antwort wächst mit der Zahl der
// aktiven Meldungen (normal wenige kB; bei Großlagen größer).
// VERIFIED: nein (Form nach Doku; in der Bau-Umgebung nicht abrufbar)

import type { Collector } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

export const URL_MAP = 'https://warnung.bund.de/api31/mowas/mapData.json';
const STEP = 15 * 60_000;
const SIG_COUNT = 'nuclear.alerts.nina_mowas_count';
const SIG_SEVERE = 'nuclear.alerts.nina_mowas_severe';
const SIG_KEY = 'nuclear.alerts.nina_keyword_radiological';
const KEYWORDS = /radiolog|radioakt|strahl|nuklear|atom|kernkraft|kernreaktor|kernwaffe|jod|cbrn/i;

export interface Counts { total: number; severe: number; keyword: number }

/** Zählt aktive Meldungen (ohne type Cancel), schwere Meldungen und Stichwort-Treffer im deutschen Titel. */
export function parseWarnings(body: unknown): Counts {
  const list = expect(Array.isArray(body) ? (body as unknown[]) : null, 'Liste der Meldungen');
  const c: Counts = { total: 0, severe: 0, keyword: 0 };
  for (const w of list) {
    const o = (w ?? {}) as { type?: unknown; severity?: unknown; i18nTitle?: { de?: unknown } };
    if (typeof o.type === 'string' && o.type.toLowerCase() === 'cancel') continue;
    c.total++;
    if (typeof o.severity === 'string' && /^(severe|extreme)$/i.test(o.severity)) c.severe++;
    const title = o.i18nTitle?.de;
    if (typeof title === 'string' && KEYWORDS.test(title)) c.keyword++;
  }
  return c;
}

const common = {
  scenarios: ['nuclear'], domain: 'alerts', evidenceClass: 'C' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'low' as const, independenceGroup: 'nina-mowas', intervalMinutes: 15, holdHours: 12,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 96 }, thresholds: { z0: 3, z1: 8, absFloor: 2 },
  sourceName: 'NINA / MoWaS (BBK)', sourceUrl: 'https://warnung.bund.de/', license: 'BBK, Quellenangabe',
};

const collector: Collector = {
  id: 'nina-warnings',
  title: 'NINA / MoWaS Warnmeldungen (Zähler)',
  sourceUrl: 'https://warnung.bund.de/',
  intervalMinutes: 15,
  signals: [
    {
      ...common, id: SIG_COUNT, name: 'Aktive Warnmeldungen in NINA (MoWaS)', weight: 0.2, unit: 'Meldungen',
      plain: 'Wie viele amtliche Warnmeldungen im Modularen Warnsystem des Bundes gerade aktiv sind; ein Sprung zeigt eine Großlage, meist Wetter.',
      banalCauses: ['Unwetter und Hochwasser', 'Bundesweiter Warntag (Testmeldungen)', 'Übungen', 'Bombenentschärfungen'],
    },
    {
      ...common, id: SIG_SEVERE, name: 'Schwere aktive Warnmeldungen in NINA', weight: 0.15, unit: 'Meldungen',
      plain: 'Wie viele der aktiven Warnmeldungen als schwer oder extrem eingestuft sind.',
      banalCauses: ['Sturm- und Hochwasserlagen', 'Großbrände mit Rauchwarnung'],
    },
    {
      ...common, id: SIG_KEY, name: 'Aktive NINA-Warnungen mit Strahlungs- oder Atom-Stichwort', weight: 0.2, unit: 'Meldungen',
      plain: 'Wie viele aktive Warnmeldungen im Titel Begriffe wie radioaktiv, Strahlung oder Atom enthalten; normal null.',
      banalCauses: ['Übungen und Warntag', 'Wortteile wie Sonnenstrahl', 'Meldungen zu Jod (z. B. Chemieunfälle)'],
    },
  ],
  async collect(ctx) {
    const c = parseWarnings(await ctx.http.json<unknown>(URL_MAP, { fixture: 'nina/mowas-mapdata.json' }));
    const ts = Math.floor(ctx.now.getTime() / STEP) * STEP;
    return { observations: [obs(SIG_COUNT, ts, c.total), obs(SIG_SEVERE, ts, c.severe), obs(SIG_KEY, ts, c.keyword)] };
  },
};

export default collector;
