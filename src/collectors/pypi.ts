// PyPI (Paket-Registry für Python), Klasse A: Veröffentlichungs-Takt und neue Paketnamen aus den öffentlichen RSS-Feeds.
// Quelle: https://pypi.org/rss/updates.xml (100 neueste Releases), https://pypi.org/rss/packages.xml (ca. 40 neueste Projekte),
//   https://pypi.org/rss/project/<paket>/releases.xml (letzte 40 Releases je Paket). Doku: https://docs.pypi.org/api/feeds/
// Lizenz: PyPI-Nutzungsbedingungen, Metadaten frei abrufbar; kein Key. Nur Paketnamen und Zeitstempel, keine Personen
//   (Autor-Felder der Feeds werden nicht gelesen).
// Schnittstellen-Prüfung (17.11.2026, von hier): GET JSON-API /pypi/<paket>/json antwortet, ist aber groß (litellm 2,4 MB), und
//   RSS antwortet (updates 34 kB, packages 15 kB, je Paket ca. 11 kB). XML-RPC (changelog_since_serial) ist ein POST, der HTTP-Client
//   kann kein POST: Yanks, Löschungen, Maintainer-Wechsel (pypi_ai_yanks_removals, pypi_ai_maintainer_changes) und die globale
//   Seriennummer (Header X-PyPI-Last-Serial) sind damit nicht erreichbar und werden nicht gebaut.
// Gemessen (jeweils ein Messwert je Lauf; Historie gibt es nur durch eigenes Mitschreiben, ausgenommen release_burst):
//   ai.supply_chain.pypi_serial_rate: Releases pro Stunde, aus updates.xml: (Einträge - 1) / Spanne zwischen ältestem und jetzt.
//     Die Feed-Spanne beträgt nur ca. 15 Minuten (ca. 6 Releases pro Minute). Ersatz für die nicht erreichbare Seriennummer;
//     zählt nur Releases, keine Löschungen oder Rechteänderungen.
//   ai.supply_chain.pypi_new_projects_rate: neue Projekte pro Stunde, aus packages.xml (Spanne ca. 55 Minuten, ca. 40 pro Stunde).
//   ai.supply_chain.pypi_ai_name_typosquats: neue Projekte pro Stunde in packages.xml, deren Name einem zentralen KI-Paket ähnelt
//     (Schreibweise nach Entfernen von - _ . gleich oder Editierdistanz 1, bei Namen ab 8 Zeichen bis 2), ohne den echten Namen selbst.
//   ai.supply_chain.pypi_ai_release_burst: je UTC-Tag das Maximum der Releases eines einzelnen Pakets aus 8 zentralen KI-Paketen
//     (releases.xml, letzte 40 Releases; es werden nur volle Tage gemeldet, die vom Feed jedes Pakets vollständig abgedeckt sind,
//     höchstens 28). Fällt ein Paket aus, wird das Signal nicht gemeldet (ein Maximum über Teilmenge wäre verfälscht).
// Anfragen: 2 Feeds + 8 Paket-Feeds = 10 (über der Richtgröße 8, begründet: acht kleine Feeds sind die Paketliste selbst).
// Harmlose Ursachen: Release-Automation, Nightly- und Dev-Builds (litellm mehrfach täglich), Wochentag und Tageszeit (US/EU-Arbeitszeit),
//   Klassen- und Kurs-Uploads, legitime Plugins (langchain-xyz zählt nicht, nur Namen mit kleinem Abstand).
// VERIFIED: ja (17.11.2026, echte Antwort)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, obs } from './_helpers.ts';

const BASE = 'https://pypi.org';
export const URL_UPDATES = `${BASE}/rss/updates.xml`;
export const URL_PACKAGES = `${BASE}/rss/packages.xml`;
export const urlReleases = (pkg: string) => `${BASE}/rss/project/${pkg}/releases.xml`;

/** Zentrale KI-Pakete (Release-Takt). */
export const AI_PACKAGES = ['litellm', 'langchain-core', 'openai', 'anthropic', 'transformers', 'vllm', 'torch', 'mlflow'];
/** Namen, denen Typosquats ähneln könnten. */
export const SQUAT_TARGETS = ['openai', 'anthropic', 'langchain', 'litellm', 'transformers', 'tensorflow', 'huggingface-hub', 'llama-index', 'pytorch', 'torch'];

const SIG_SERIAL = 'ai.supply_chain.pypi_serial_rate';
const SIG_NEW = 'ai.supply_chain.pypi_new_projects_rate';
const SIG_SQUAT = 'ai.supply_chain.pypi_ai_name_typosquats';
const SIG_BURST = 'ai.supply_chain.pypi_ai_release_burst';
const HOUR = 3600_000;
const BURST_DAYS = 28;

export interface FeedItem { name: string; ts: number }

function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Liest die Einträge eines PyPI-RSS-Feeds (neueste zuerst). `kind`: updates = "<paket> <version>", packages = "<paket> added to PyPI",
 * releases = "<version>" (Paketname kommt dann aus `pkg`). Einträge ohne gültige Zeit entfallen; fehlt `<item>` ganz, ist es ein Fehler,
 * wenn der Kanal fehlt.
 */
export function parseFeed(xml: string, kind: 'updates' | 'packages' | 'releases', pkg = ''): FeedItem[] {
  expect(typeof xml === 'string' && xml.includes('<channel>') ? xml : null, 'RSS-Kanal');
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = /<title>([\s\S]*?)<\/title>/.exec(m[1])?.[1];
    const date = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(m[1])?.[1];
    const ts = date ? Date.parse(date) : NaN;
    if (!title || !Number.isFinite(ts)) continue;
    const t = decode(title).trim();
    let name = pkg;
    if (kind === 'updates') name = t.split(' ')[0];
    else if (kind === 'packages') name = t.replace(/ added to PyPI$/, '');
    if (name) out.push({ name, ts });
  }
  return out;
}

/** Ereignisse pro Stunde über die Spanne zwischen dem ältesten Eintrag und `now`; null bei zu kurzer Spanne oder zu wenigen Einträgen. */
export function ratePerHour(items: { ts: number }[], now: Date, minItems = 10): number | null {
  if (items.length < minItems) return null;
  const oldest = Math.min(...items.map((i) => i.ts));
  const hours = (now.getTime() - oldest) / HOUR;
  if (hours < 5 / 60) return null;
  const n = items.filter((i) => i.ts > oldest).length;
  return Math.round((n / hours) * 100) / 100;
}

const strip = (s: string) => s.toLowerCase().replace(/[-_.]/g, '');

export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Ist `name` ein ähnlicher, aber nicht identischer Name zu einem Ziel? */
export function isLookalike(name: string, targets = SQUAT_TARGETS): boolean {
  const n = name.toLowerCase();
  const s = strip(n);
  for (const t of targets) {
    if (n === t) continue; // echter Name
    const ts = strip(t);
    if (s === ts) return true; // nur Trennzeichen anders (lang_chain, open.ai)
    const max = ts.length >= 8 ? 2 : 1;
    if (Math.abs(s.length - ts.length) <= max && editDistance(s, ts) <= max) return true;
  }
  return false;
}

/** Tageswerte: je Tag das Maximum der Releases eines Pakets; nur Tage, die jeder Feed vollständig abdeckt. */
export function burstPerDay(feeds: Record<string, FeedItem[]>, now: Date, days = BURST_DAYS): Observation[] {
  const names = Object.keys(feeds);
  if (!names.length) return [];
  // erster vollständig abgedeckter Tag: Tag nach dem ältesten Eintrag des Feeds mit der kürzesten Historie (nur Feeds, die voll sind)
  const today = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  let from = today - days * DAY_MS;
  for (const n of names) {
    const f = feeds[n];
    if (f.length >= 40) from = Math.max(from, Math.floor(Math.min(...f.map((i) => i.ts)) / DAY_MS) * DAY_MS + DAY_MS);
  }
  const out: Observation[] = [];
  for (let d = from; d < today; d += DAY_MS) {
    let max = 0;
    let top = '';
    for (const n of names) {
      const c = feeds[n].filter((i) => i.ts >= d && i.ts < d + DAY_MS).length;
      if (c > max) { max = c; top = n; }
    }
    out.push(obs(SIG_BURST, d, max, { top }));
  }
  return out;
}

const common = {
  scenarios: ['ai'], domain: 'supply_chain', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'pypi',
  sourceName: 'PyPI RSS-Feeds', sourceUrl: 'https://docs.pypi.org/api/feeds/', license: 'PyPI-Nutzungsbedingungen, Metadaten frei',
};
const how = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };

const collector: Collector = {
  id: 'pypi',
  title: 'PyPI (RSS-Feeds)',
  sourceUrl: 'https://docs.pypi.org/api/feeds/',
  intervalMinutes: 15,
  signals: [
    {
      ...common, id: SIG_SERIAL, name: 'PyPI-Releases pro Stunde (Gesamt)', weight: 0.35, unit: 'Releases/Stunde', intervalMinutes: 15, holdHours: 6, baseline: how,
      plain: 'Wie viele neue Paketversionen pro Stunde auf PyPI erscheinen; ein Sprung kann auf automatisch verbreitete Releases hindeuten.',
      thresholds: { z0: 3, z1: 8, relFloor: 0.3 },
      banalCauses: ['Release-Wellen und CI-Jobs', 'Wochentag und Tageszeit'],
    },
    {
      ...common, id: SIG_NEW, name: 'Neue PyPI-Projekte pro Stunde', weight: 0.4, unit: 'Projekte/Stunde', intervalMinutes: 15, holdHours: 6, baseline: how,
      plain: 'Wie viele neue Paketnamen pro Stunde auf PyPI angelegt werden; Wellen gibt es bei Massen-Registrierungen.',
      thresholds: { z0: 3, z1: 8, relFloor: 0.3 },
      banalCauses: ['Boom neuer KI-Pakete', 'Klassen- und Kurs-Uploads', 'Wochentag und Tageszeit'],
    },
    {
      ...common, id: SIG_SQUAT, name: 'Neue PyPI-Namen nahe an KI-Bibliotheken', weight: 0.75, unit: 'Projekte/Stunde', intervalMinutes: 15, holdHours: 24, baseline: how,
      plain: 'Wie viele neue Paketnamen pro Stunde einem bekannten KI-Paket (openai, langchain, litellm, transformers ...) sehr ähneln.',
      thresholds: { z0: 3, z1: 8, absFloor: 1 },
      banalCauses: ['Legitime Forks und Umbenennungen', 'Zufällige Namensähnlichkeit'],
    },
    {
      ...common, id: SIG_BURST, name: 'Release-Ausbruch bei einem KI-Paket', weight: 0.7, unit: 'Releases/Tag (Maximum eines Pakets)', intervalMinutes: 1440, holdHours: 48,
      baseline: { method: 'rolling', windowDays: 28, minPoints: 14 }, thresholds: { z0: 3, z1: 8, absFloor: 2 },
      plain: 'Wie viele Versionen das am häufigsten veröffentlichende von acht zentralen KI-Paketen an einem Tag herausbringt; eine Flut kann auf ein übernommenes Konto hindeuten.',
      banalCauses: ['Release-Automation', 'Nightly- und Dev-Builds', 'Release-Kandidaten vor einem großen Release'],
    },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const now = ctx.now;
    const ts = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    let ok = 0;
    try {
      const up = parseFeed(await ctx.http.text(URL_UPDATES, { fixture: 'pypi/rss-updates.xml' }), 'updates');
      const r = ratePerHour(up, now);
      if (r !== null) observations.push(obs(SIG_SERIAL, ts, r, { items: up.length }));
      ok++;
    } catch (e) { ctx.log(`updates.xml übersprungen: ${(e as Error).message}`); }
    try {
      const pk = parseFeed(await ctx.http.text(URL_PACKAGES, { fixture: 'pypi/rss-packages.xml' }), 'packages');
      const r = ratePerHour(pk, now);
      if (r !== null) {
        observations.push(obs(SIG_NEW, ts, r, { items: pk.length }));
        const oldest = Math.min(...pk.map((i) => i.ts));
        const hits = pk.filter((i) => i.ts > oldest && isLookalike(i.name));
        observations.push(obs(SIG_SQUAT, ts, Math.round((hits.length / ((now.getTime() - oldest) / HOUR)) * 100) / 100, { hits: hits.map((h) => h.name) }));
      }
      ok++;
    } catch (e) { ctx.log(`packages.xml übersprungen: ${(e as Error).message}`); }
    const feeds: Record<string, FeedItem[]> = {};
    let failed = false;
    for (const p of AI_PACKAGES) {
      try {
        feeds[p] = parseFeed(await ctx.http.text(urlReleases(p), { fixture: `pypi/rss-project-${p}-releases.xml` }), 'releases', p);
      } catch (e) { failed = true; ctx.log(`${p}: Release-Feed übersprungen: ${(e as Error).message}`); }
    }
    if (!failed) { observations.push(...burstPerDay(feeds, now)); ok++; }
    if (!ok) throw new Error('PyPI: kein Feed erreichbar');
    return { observations };
  },
};

export default collector;
