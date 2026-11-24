// Abwasser Deutschland: RKI-Abwassersurveillance AMELAG, aggregierte Kurve (Klasse A: unabhängige Messung an Kläranlagen).
// Quelle: GitHub-Repo robert-koch-institut/Abwassersurveillance_AMELAG, Datei amelag_aggregierte_kurve.tsv (ca. 140 kB, wöchentlich fortgeschrieben).
// https://github.com/robert-koch-institut/Abwassersurveillance_AMELAG  (Rohdatei: raw.githubusercontent.com/.../main/amelag_aggregierte_kurve.tsv)
// Lizenz: CC BY 4.0. Quellenangabe: Robert Koch-Institut, Abwassersurveillance AMELAG (Daten bundesweit gewichtet über die Kläranlagen). Kein Key.
// Aufbau: tab-getrennt, Kopf `datum n anteil_bev viruslast viruslast_normalisiert vorhersage obere_schranke untere_schranke typ`;
//   je Woche (Mittwoch) und Erreger (`typ`) eine Zeile. n = Zahl der Standorte, anteil_bev = Anteil der Bevölkerung (0 bis 1) hinter den Standorten.
//   Erreger: SARS-CoV-2 (seit 2022-03), Influenza A, Influenza B, Influenza A+B (seit 2023-11), RSV A, RSV B, RSV A/B, RSV A+B (RSV seit 2024-08/10).
//   Gemessen wird `viruslast_normalisiert` (um Abfluss und Pegel bereinigte Viruslast, Mittel über die Standorte), nicht die Vorhersage-Kurve.
//   RSV: Reihe `RSV A/B` (lückenlos seit 2024-08, Standorte mit kombiniertem Test; Zahl der Standorte schwankt).
// Gemeldet: je Erreger die letzten 110 Wochen als Rohreihe (Gewicht 0,2) und das abgeleitete Verhältnis zum Mittel derselben Kalenderwochen
//   der bis zu 3 Vorjahre (nur mit mindestens 2 Vorjahren; AMELAG beginnt für Influenza 2023-11, daher gibt es das Verhältnis erst ab Ende 2025).
//   Zusätzlich Kontrollgröße: Anteil der überwachten Bevölkerung (SARS-CoV-2-Zeile), Gewicht 0.
// Aktualität: die jüngste Woche erscheint mit etwa 1 bis 2 Wochen Verzug; maxAgeHours 360.
// Harmlose Ursachen für Ausschläge: saisonale Winterwellen, Schulferien, Feiertage, Labor- oder Methodenwechsel, wechselnde Standortzahl.
// VERIFIED: ja (24.11.2026, echte Antwort: letzte Woche 2026-11-11)

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs, parseCsv } from './_helpers.ts';
import { GEO_DE, HISTORY_WEEKS, isoWeekOf, ratioObservations, rawAndRatio, rawObservations, weeklyBase, type WeekPoint } from './_rki-weekly.ts';

const URL_TSV = 'https://raw.githubusercontent.com/robert-koch-institut/Abwassersurveillance_AMELAG/main/amelag_aggregierte_kurve.tsv';
const SRC = { sourceName: 'RKI Abwassersurveillance AMELAG (GitHub)', sourceUrl: 'https://github.com/robert-koch-institut/Abwassersurveillance_AMELAG' };
const SIG_POP = 'bio.context.amelag_covered_pop';

/** Signal-ID -> Wert der Spalte `typ` */
const TYPES: Record<string, string> = {
  'bio.wastewater.amelag_sars2': 'SARS-CoV-2',
  'bio.wastewater.amelag_flu': 'Influenza A',
  'bio.wastewater.amelag_flub': 'Influenza B',
  'bio.wastewater.amelag_rsv': 'RSV A/B',
};

export interface AmelagResult { series: Map<string, WeekPoint[]>; coverage: WeekPoint[]; lastDate: string | null }

/** Liest die aggregierte Kurve: je Signal-ID die Wochenpunkte (viruslast_normalisiert), dazu die Bevölkerungsabdeckung (SARS-CoV-2). */
export function parseAmelag(text: string): AmelagResult {
  const body = expect(typeof text === 'string' && text.trim().length ? text : null, 'Antworttext');
  const rows = parseCsv(body, '\t');
  const head = rows[0] ?? [];
  const iDate = head.indexOf('datum');
  const iVal = head.indexOf('viruslast_normalisiert');
  const iPop = head.indexOf('anteil_bev');
  const iTyp = head.indexOf('typ');
  if (iDate < 0 || iVal < 0 || iTyp < 0) throw new Error('unerwartete Antwort: Spalten datum/viruslast_normalisiert/typ fehlen');
  const byType = new Map<string, string>(Object.entries(TYPES).map(([id, t]) => [t, id]));
  const series = new Map<string, WeekPoint[]>(Object.keys(TYPES).map((id) => [id, []]));
  const coverage: WeekPoint[] = [];
  let lastDate: string | null = null;
  for (const r of rows.slice(1)) {
    const d = r[iDate];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) continue;
    const ts = new Date(`${d}T00:00:00Z`);
    const { year, week } = isoWeekOf(ts);
    const id = byType.get(r[iTyp]);
    if (!id) continue;
    const v = num(r[iVal]);
    if (v !== null && v >= 0) {
      series.get(id)!.push({ year, week, ts, value: Math.round(v * 10) / 10 });
      if (!lastDate || d > lastDate) lastDate = d;
    }
    if (id === 'bio.wastewater.amelag_sars2' && iPop >= 0) {
      const p = num(r[iPop]);
      if (p !== null) coverage.push({ year, week, ts, value: Math.round(p * 1000) / 10 });
    }
  }
  return { series, coverage, lastDate };
}

const base = weeklyBase({ group: 'rki-amelag-github', domain: 'wastewater', evidenceClass: 'A', geo: GEO_DE, ...SRC });
const mk = (id: string, what: string, plainWhat: string, w: number, causes: string[]) => rawAndRatio(base, {
  id, name: `Abwasser Deutschland: ${what}`, plain: `Wie viel ${plainWhat} messen die Kläranlagen bundesweit in der Woche? Die Rohreihe schwankt mit der Jahreszeit.`,
  unit: 'Viruslast (normalisiert)', catalogWeight: w, banalCauses: causes,
  ratioName: `Abwasser Deutschland: ${what} im Vergleich zu den Vorjahren`,
  ratioPlain: `Wie viel höher oder niedriger als im Mittel derselben Kalenderwochen der Vorjahre liegt ${plainWhat} im Abwasser? 1 heißt: üblich für die Jahreszeit.`,
});

const collector: Collector = {
  id: 'rki-amelag-github',
  title: 'RKI Abwassersurveillance AMELAG (GitHub)',
  sourceUrl: SRC.sourceUrl,
  intervalMinutes: 10080,
  signals: [
    ...mk('bio.wastewater.amelag_sars2', 'Corona-Viruslast', 'Corona-Erbgut', 0.7, ['Sommer- oder Herbstwelle', 'neue Variante mit Wachstumsvorteil', 'Laborwechsel']),
    ...mk('bio.wastewater.amelag_flu', 'Grippe A', 'Grippe-A-Erbgut', 0.6, ['saisonale Winterwelle', 'Schulferien', 'Labor- oder Methodenwechsel']),
    ...mk('bio.wastewater.amelag_flub', 'Grippe B', 'Grippe-B-Erbgut', 0.4, ['saisonale Winterwelle', 'Schulferien', 'Labor- oder Methodenwechsel']),
    ...mk('bio.wastewater.amelag_rsv', 'RSV', 'RSV-Erbgut', 0.5, ['saisonale Winterwelle', 'Schulferien', 'wechselnde Zahl der Standorte']),
    {
      ...base, id: SIG_POP, domain: 'context', name: 'Abwasser: Anteil der überwachten Bevölkerung', unit: '% der Bevölkerung', direction: 'down', weight: 0,
      plain: 'Wie viel Prozent der Bevölkerung leben im Einzugsgebiet der Messstellen? Sinkt der Anteil, sind die Abwassersignale weniger aussagekräftig.',
      banalCauses: ['Finanzierungslage', 'Standortwechsel'], thresholds: { z0: 3, z1: 7, relFloor: 0.1 },
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_TSV, { fixture: 'rki-amelag/aggregierte_kurve.tsv' });
    const r = parseAmelag(text);
    ctx.log(`rki-amelag-github: letzte Woche ${r.lastDate ?? 'unbekannt'}`);
    const observations: Observation[] = [];
    for (const [id, pts] of r.series) {
      observations.push(...rawObservations(id, pts, HISTORY_WEEKS), ...ratioObservations(`${id}_saison`, pts, HISTORY_WEEKS));
    }
    for (const p of r.coverage.slice(-HISTORY_WEEKS)) observations.push(obs(SIG_POP, p.ts, p.value));
    return { observations };
  },
};

export default collector;
