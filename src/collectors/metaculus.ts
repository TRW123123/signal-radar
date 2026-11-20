// Metaculus API: neue Prognosefragen zum Thema Cyberangriffe je Tag (Klasse D: Aufmerksamkeit der Prognose-Community).
// Quelle: https://www.metaculus.com/api/posts/?search=cyber&order_by=-published_at&published_at__gt=YYYY-MM-DD&limit=50
// Doku: OpenAPI https://raw.githubusercontent.com/Metaculus/metaculus/main/docs/openapi.yml (die Seite https://www.metaculus.com/api/ lädt sie
//   hinter einer Cloudflare-Prüfung; gelesen 20.11.2026). Antwort { next, previous, results: [ Post { id, title, short_title, published_at,
//   status, nr_forecasters, forecasts_count, question { ... aggregations ... } } ] }. `published_at__gt` und `order_by` sind dokumentiert,
//   `search` nicht (die Website nutzt ihn, der Katalog auch) -> zusätzlich Titelfilter im Collector, damit eine ignorierte Suche nicht alle
//   neuen Fragen zählt.
// Key: SR_METACULUS_KEY im Header "Authorization: Token <key>". Ohne Token: HTTP 403 "Permission Error: The API is only available to
//   authenticated users." (echt, 20.11.2026, fixtures/metaculus/no-token-403.txt) -> keine echte Datenantwort ohne Token möglich.
// Zugangsstufe: Gratis-Konten sind "Restricted". Laut Doku setzt das Gateway dort die Community-Prognose (aggregations.*.latest) auf null,
//   außer für rund 50 Fragen im Bot-Testbereich. Wahrscheinlichkeiten sind deshalb mit dem Gratis-Zugang nicht messbar.
// Lizenz: Metaculus Terms of Use (https://www.metaculus.com/terms-of-use/): keine KI-Trainingsnutzung ohne Erlaubnis, kommerzielle Nutzung nur
//   mit Vertrag; nichtkommerzielle Nutzung über das Data-Needs-Formular erbitten (offener Punkt, Übergabe). Quellenangabe "Metaculus".
// Gemessen: cyber.attention.metaculus_manifold = Zahl neu veröffentlichter Metaculus-Fragen je UTC-Tag, deren Titel Cyber-Begriffe enthält
//   (cyber, hack, ransomware, malware, ddos, cyberattack), letzte 7 abgeschlossene Tage; der laufende Tag fehlt. Wird die Liste am limit
//   abgeschnitten, entfallen die ältesten (unvollständigen) Tage.
// Harmlose Ursachen: neue Turniere oder Fragenserien (viele Fragen auf einmal), Moderationsrückstau, Feiertage.
// Not built (CP auf Gratis-Stufe null, s. o.):
//   nuclear.attention.metaculus_nuclear (Community-Prognose in %), ai.markets.prediction_ai_incident (Prognose in %; Katalog-Collector polymarket-gamma).
//   war.attention.prediction_markets_war: bereits über polymarket-gamma (config/war.ts) gespeist.
// VERIFIED: nein (ungeprüft bis Key). Format aus der OpenAPI-Spezifikation; 403 ohne Token echt geprüft.

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { countPerDay, daysAgo, expect, isoDay } from './_helpers.ts';

const KEY_ENV = 'SR_METACULUS_KEY';
const SIG = 'cyber.attention.metaculus_manifold';
const DAYS = 7;
const LIMIT = 50;
const TERMS = /cyber|hack|ransomware|malware|ddos/i;

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "cyber.attention.metaculus_manifold",scenarios: ["cyber"],domain: "attention",name: "Community-Prognosen (Metaculus, Manifold) zu Cyber/Infrastruktur",plain: "Aggregierte Expertenschätzungen zu Großausfällen.",evidenceClass: "D",direction: "up",kind: "count",weight: 0.35,manipulability: "high",independenceGroup: "manifold",unit: "Anzahl",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 5,license: "Manifold ToS, Daten offen",banalCauses: ["Medienereignisse beeinflussen Schätzung"],sourceName: "Manifold Markets API",sourceUrl: "https://docs.manifold.markets/api"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

export interface Posts { published: string[]; truncated: boolean }

/** results[] -> published_at der Posts mit Cyber-Begriff im Titel; truncated, wenn die Seite voll ist und es weitere gibt. */
export function parsePosts(body: unknown, limit = LIMIT): Posts {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  const results = expect(Array.isArray(b.results) ? (b.results as unknown[]) : null, 'results');
  const published: string[] = [];
  for (const r of results) {
    const p = r as Record<string, unknown>;
    const title = `${String(p.title ?? '')} ${String(p.short_title ?? '')}`;
    if (typeof p.published_at === 'string' && TERMS.test(title)) published.push(p.published_at);
  }
  return { published, truncated: results.length >= limit && Boolean(b.next) };
}

/** Tageszählung; bei abgeschnittener Liste nur Tage nach dem ältesten enthaltenen Eintrag (der älteste Tag ist dann unvollständig). */
export function dailyCounts(posts: Posts, oldestAll: string | null, now: Date): Observation[] {
  const all = countPerDay(SIG, posts.published, now, { days: DAYS });
  if (!posts.truncated || !oldestAll) return all;
  const cut = isoDay(new Date(oldestAll));
  return all.filter((o) => o.ts.slice(0, 10) > cut);
}

export function postsUrl(now: Date): string {
  return `https://www.metaculus.com/api/posts/?search=cyber&order_by=-published_at&published_at__gt=${isoDay(daysAgo(now, DAYS + 1))}&limit=${LIMIT}`;
}

const collector: Collector = {
  id: 'metaculus',
  title: 'Metaculus API',
  sourceUrl: 'https://www.metaculus.com/',
  needsKey: KEY_ENV,
  intervalMinutes: 360,
  signals: [
    { ...CATALOG[SIG], collector: 'metaculus', id: SIG, sourceName: 'Metaculus', sourceUrl: 'https://www.metaculus.com/questions/',
      license: 'Metaculus Terms of Use (nichtkommerziell, kein KI-Training; Erlaubnis angefragt?)',
      name: 'Metaculus: neue Fragen zu Cyberangriffen', unit: 'Fragen je Tag', intervalMinutes: 1440,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 21 }, maxAgeHours: 72,
      plain: 'Wie viele neue Prognosefragen zu Cyberangriffen die Metaculus-Community am Tag aufmacht.' },
  ],
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const body = await ctx.http.json(postsUrl(ctx.now), { headers: { Authorization: `Token ${key}` }, fixture: 'metaculus/posts-cyber.json' });
    const posts = parsePosts(body);
    const res = (body as { results: Record<string, unknown>[] }).results;
    const oldest = res.length ? String(res[res.length - 1].published_at ?? '') || null : null;
    if (posts.truncated) ctx.log(`metaculus: Liste bei ${LIMIT} abgeschnitten, ältere Tage entfallen`);
    return { observations: dailyCounts(posts, oldest, ctx.now) };
  },
};

export default collector;
