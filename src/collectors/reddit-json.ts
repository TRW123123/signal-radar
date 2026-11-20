// Reddit Data API: Nutzer gerade aktiv in r/sysadmin und r/LocalLLaMA (Klasse D: Aufmerksamkeit/Verhalten).
// Quelle: https://oauth.reddit.com/r/<sub>/about (App-only-OAuth). Token: POST https://www.reddit.com/api/v1/access_token mit
//   grant_type=client_credentials und HTTP-Basic-Auth client_id:client_secret; Antwort { access_token, token_type: "bearer", expires_in: 86400 }.
// Doku: https://github.com/reddit-archive/reddit/wiki/OAuth2 ("Application Only OAuth"; Anfragen mit Token an oauth.reddit.com, nicht www),
//   https://github.com/reddit-archive/reddit/wiki/API (User-Agent "<platform>:<app ID>:<version> (by /u/<username>)", Rate-Limit-Header
//   X-Ratelimit-*; 100 Anfragen/Minute je OAuth-Client), https://www.reddit.com/dev/api/#GET_r_{subreddit}_about (gelesen 20.11.2026).
//   Antwort about: { kind: "t5", data: { display_name, subscribers, active_user_count, accounts_active, ... } }.
// Key: SR_REDDIT_USER (client_id) und SR_REDDIT_PASS (client_secret); needsKey als Paar.
// BLOCKER: ctx.http kann nur GET (HttpInit ohne method/body). Der Token-Abruf braucht POST; http.ts wird laut Auftrag nicht geändert.
//   collect() wirft deshalb ohne Netzwerkzugriff einen klaren Fehler, sobald beide Keys gesetzt sind. Parser und URL-Bau sind fertig und getestet.
//   Keyfrei geht es nicht: https://www.reddit.com/r/sysadmin/about.json antwortet 403 (HTML-Sperrseite, 20.11.2026).
// User-Agent: Reddit verlangt einen eindeutigen UA im Format oben (mit Reddit-Benutzername); der gemeinsame UA des HTTP-Clients passt nicht
//   ganz -> REDDIT_UA wird beim Abruf als Header gesetzt (Benutzername als Platzhalter, offener Punkt).
// Lizenz: Reddit Data API Terms (https://redditinc.com/policies/data-api-terms) und Developer Terms: nichtkommerziell frei mit Registrierung,
//   kommerziell nur mit Vertrag; keine Speicherung gelöschter Inhalte (hier nur Zählwerte), Quellenangabe Reddit.
// Gemessen (je Lauf ein Wert, ts = Abrufzeit auf 5 Minuten abgerundet):
//   cyber.attention.reddit_sysadmin_activity  active_user_count von r/sysadmin
//   ai.attention.ai_local_community_activity  active_user_count von r/LocalLLaMA
//   Fallback accounts_active. Reddit hat 2025 die Online-Anzeige auf der Website umgestellt; liefert die API beide Felder als null, meldet
//   der Parser einen Fehler statt 0 (offener Punkt: mit Key prüfen).
// Harmlose Ursachen: Tageszeit/Wochentag (US-Arbeitszeit), Reddit-Ausfälle, große Patch-Days (sysadmin), neue Modell-Releases (LocalLLaMA).
// VERIFIED: nein (ungeprüft bis Key und bis ctx.http POST kann). Format aus der Reddit-API-Doku.

import type { Collector, CollectContext, SignalDef } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

const USER_ENV = 'SR_REDDIT_USER';
const PASS_ENV = 'SR_REDDIT_PASS';
const SIG_SYSADMIN = 'cyber.attention.reddit_sysadmin_activity';
const SIG_LOCALLLAMA = 'ai.attention.ai_local_community_activity';
export const REDDIT_UA = 'server:signal-radar:0.1 (by /u/<reddit-username>; passive read-only)';
export const SUBS: [string, string][] = [[SIG_SYSADMIN, 'sysadmin'], [SIG_LOCALLLAMA, 'LocalLLaMA']];

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026). */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "ai.attention.ai_local_community_activity",scenarios: ["ai"],domain: "attention",name: "Aktivität der Community um lokale Modelle",plain: "Mitglieder- und Aktivnutzerzahl in r/LocalLLaMA.",evidenceClass: "D",direction: "up",kind: "gauge",weight: 0.4,manipulability: "high",independenceGroup: "reddit-json",unit: "Nutzer online",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 15,license: "Reddit-API-Bedingungen",banalCauses: ["Modellstart"],sourceName: "Reddit r/LocalLLaMA und r/ChatGPT (JSON)",sourceUrl: "https://www.reddit.com/dev/api/"},
  {id: "cyber.attention.reddit_sysadmin_activity",scenarios: ["cyber"],domain: "attention",name: "Reddit r/sysadmin Aktivität",plain: "Aktive Nutzer in der Admin-Community.",evidenceClass: "D",direction: "up",kind: "count",weight: 0.6,manipulability: "medium",independenceGroup: "reddit-json",unit: "Anzahl",baseline: {method: "hour-of-week",windowDays: 28,minPoints: 48},intervalMinutes: 5,license: "Reddit Data API Terms, kommerziell eingeschraenkt",banalCauses: ["Virale Threads"],sourceName: "Reddit about.json",sourceUrl: "https://www.reddit.com/dev/api/"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

/** Token-Anfrage (für einen späteren POST-fähigen Client): URL, Header, Formular-Body. */
export function tokenRequest(clientId: string, clientSecret: string): { url: string; headers: Record<string, string>; body: string } {
  return {
    url: 'https://www.reddit.com/api/v1/access_token',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': REDDIT_UA },
    body: 'grant_type=client_credentials',
  };
}

export function aboutUrl(sub: string): string {
  return `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/about?raw_json=1`;
}

/** data.active_user_count (Fallback accounts_active) und subscribers; wirft, wenn kein Aktivwert lesbar ist. */
export function parseAbout(body: unknown): { active: number; subscribers: number | null } {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  const d = expect(b.data as Record<string, unknown> | undefined, 'data');
  const active = num(d.active_user_count) ?? num(d.accounts_active);
  return { active: expect(active, 'data.active_user_count/accounts_active'), subscribers: num(d.subscribers) };
}

const SOURCE = { sourceName: 'Reddit Data API', sourceUrl: 'https://www.reddit.com/', license: 'Reddit Data API Terms, nichtkommerziell' };

const collector: Collector = {
  id: 'reddit-json',
  title: 'Reddit Subreddit-Aktivität (OAuth)',
  sourceUrl: 'https://www.reddit.com/dev/api/',
  needsKey: [USER_ENV, PASS_ENV],
  intervalMinutes: 15,
  signals: [
    { ...CATALOG[SIG_SYSADMIN], ...SOURCE, collector: 'reddit-json', id: SIG_SYSADMIN, unit: 'Nutzer online', intervalMinutes: 15 },
    { ...CATALOG[SIG_LOCALLLAMA], ...SOURCE, collector: 'reddit-json', id: SIG_LOCALLLAMA },
  ],
  async collect(ctx: CollectContext) {
    expect(ctx.key(USER_ENV), USER_ENV);
    expect(ctx.key(PASS_ENV), PASS_ENV);
    // Der Token-Abruf (tokenRequest) braucht POST, ctx.http kann nur GET. Ohne Token liefert oauth.reddit.com nichts.
    throw new Error('reddit-json: App-only-OAuth braucht POST an /api/v1/access_token; ctx.http unterstützt nur GET (http.ts erweitern, dann aboutUrl/parseAbout nutzen)');
  },
};

/** Für den späteren Abruf: Beobachtungen aus about-Antworten je Signal. */
export function toObservations(now: Date, bodies: [string, unknown][]) {
  const ts = Math.floor(now.getTime() / 300_000) * 300_000;
  return bodies.map(([sig, body]) => obs(sig, ts, parseAbout(body).active));
}

export default collector;
