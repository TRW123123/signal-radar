// GitHub REST API: Suche (Commits, Pull Requests, Repositories) und Commit-Listen öffentlicher Security-Repos.
// Klassen: A für Zählungen über die GitHub-Plattform (Katalog), D für das Commit-Zeitmuster (Katalog).
// Quelle: https://api.github.com/search/{commits,issues,repositories} und https://api.github.com/repos/<repo>/commits
// Doku: https://docs.github.com/en/rest/search/search , https://docs.github.com/en/rest/commits/commits
// Key: SR_GITHUB_KEY (Bearer-Token; in Actions ersatzweise github.token: 1 000 Anfragen/h je Repo, Suche 30/min).
//   Ohne Token gehen die Endpunkte auch (Suche 10/min, sonst 60/h je IP), das Limit teilen sich aber alle GitHub-
//   Collectors: daher needsKey. Je Lauf 8 Anfragen (5 Suche, 3 Commit-Listen), nur Zahlen und Zeitstempel, keine Personen.
// Lizenz/Bedingungen: GitHub-Nutzungsbedingungen (https://docs.github.com/en/site-policy/github-terms/github-terms-of-service);
//   nur Aggregate, keine Profile. Quelle "GitHub" nennen.
// Gemessen:
//   - ai.agents.github_agent_coauthor_commits: Commits (Standard-Branches) des vollen Vorvortags (committer-date; 2 Tage Abstand, damit Suchindex und späte Pushes nachziehen) mit
//     "noreply@anthropic.com" (Claude-Co-Autor-Zeile) plus "Co-authored-by: Copilot", Summe der total_count.
//     Die Phrase "Co-authored-by: Claude" lieferte am 20.11.2026 incomplete_results=true; die E-Mail-Suche einmal
//     vollständig, einmal ebenfalls unvollständig (~2 Mio. Treffer/Tag sprengen das Such-Zeitlimit). Dann entfällt der Wert.
//   - ai.agents.github_agent_pr_rate: PRs des Vorvortags von den Agenten-Apps copilot-swe-agent und devin-ai-integration
//     (author:app/...), Summe. Codex/Claude-PRs laufen über Nutzerkonten und sind so nicht zählbar.
//   - ai.supply_chain.mcp_repo_growth: neue Repos mit Thema mcp-server in der letzten vollen ISO-Woche (Mo–So).
//   - cyber.attention.security_repo_commit_hours: Commits je voller UTC-Stunde (committer.date) in openssl/openssl,
//     curl/curl, openssh/openssh-portable, Fenster 54 h bis 6 h vor jetzt (die letzten 6 h fehlen, weil Pushes später
//     ankommen). Fehlt ein Repo oder ist eine Seite voll (100), entfällt der Lauf für dieses Signal.
//   Bei incomplete_results=true oder fehlendem Summanden wird der jeweilige Wert nicht gemeldet.
// Not built: war.military.mil_count_baltic (ADS-B-Flugdaten, nicht aus GitHub-REST messbar; gehört zu adsb-lol).
// Harmlose Ursachen: Produktstarts und Preisänderungen der Agenten, Wochenenden, Massen-Forks/Spam-Repos, Release-Termine
//   und Merge-Wellen in den Security-Repos, Zeitzonen der Maintainer, Änderungen am GitHub-Suchindex.
// VERIFIED: ja (20.11.2026 ohne Token gegen echte Antworten; Fixtures fixtures/github-rest/*.json, gekürzt: Suche ohne
//   items, Commit-Listen nur sha und commit.committer.date; Feld _trimmed bzw. Kommentar im Test vermerkt das).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, floorHour, isoDay, num, obs } from './_helpers.ts';

const API = 'https://api.github.com';
const HOUR = 3600_000;
const S_COAUTHOR = 'ai.agents.github_agent_coauthor_commits';
const S_PR = 'ai.agents.github_agent_pr_rate';
const S_MCP = 'ai.supply_chain.mcp_repo_growth';
const S_HOURS = 'cyber.attention.security_repo_commit_hours';

export const COAUTHOR_QUERIES = [
  { slug: 'claude', q: '"noreply@anthropic.com"' },
  { slug: 'copilot', q: '"Co-authored-by: Copilot"' },
];
export const PR_APPS = ['copilot-swe-agent', 'devin-ai-integration'];
export const REPOS = ['openssl/openssl', 'curl/curl', 'openssh/openssh-portable'];
const SEARCH_LAG_H = 6;
/** Tageszählungen für den Vorvortag: Suchindex und verspätete Pushes (committer-date liegt vor dem Push) haben sich gesetzt. */
export const SEARCH_DAY_LAG = 2;
const WINDOW_H = 48;

const q = (s: string) => encodeURIComponent(s);

export function coauthorUrl(query: string, day: string): string {
  return `${API}/search/commits?q=${q(`${query} committer-date:${day}`)}&per_page=1`;
}
export function prUrl(app: string, day: string): string {
  return `${API}/search/issues?q=${q(`is:pr author:app/${app} created:${day}`)}&per_page=1`;
}
/** letzte volle ISO-Woche (Montag..Sonntag) vor dem Tag von now */
export function lastWeek(now: Date): { monday: Date; sunday: Date } {
  const today = floorDay(now);
  const dow = (today.getUTCDay() + 6) % 7; // Mo=0
  const monday = new Date(today.getTime() - (dow + 7) * DAY_MS);
  return { monday, sunday: new Date(monday.getTime() + 6 * DAY_MS) };
}
export function mcpUrl(now: Date): string {
  const w = lastWeek(now);
  return `${API}/search/repositories?q=${q(`topic:mcp-server created:${isoDay(w.monday)}..${isoDay(w.sunday)}`)}&per_page=1`;
}
export function hoursWindow(now: Date): { start: number; end: number } {
  const end = floorHour(now).getTime() - SEARCH_LAG_H * HOUR;
  return { start: end - WINDOW_H * HOUR, end };
}
export function commitsUrl(repo: string, now: Date): string {
  const w = hoursWindow(now);
  return `${API}/repos/${repo}/commits?since=${new Date(w.start).toISOString().replace('.000Z', 'Z')}&per_page=100`;
}

/** total_count einer Suchantwort; wirft bei fehlendem Feld oder incomplete_results. */
export function parseSearchTotal(body: unknown): number {
  const b = expect(body as { total_count?: unknown; incomplete_results?: unknown } | null, 'JSON-Körper');
  const n = expect(num(b.total_count), 'total_count');
  if (b.incomplete_results === true) throw new Error('incomplete_results=true (Suche unvollständig)');
  return n;
}

/** committer-Zeitstempel (ms) einer Commit-Liste; wirft, wenn die Seite voll ist. */
export function parseCommitTimes(body: unknown): number[] {
  const list = expect(Array.isArray(body) ? (body as { commit?: { committer?: { date?: unknown } } }[]) : null, 'Commit-Liste');
  if (list.length >= 100) throw new Error('Commit-Seite voll (100), Zählung unvollständig');
  const out: number[] = [];
  for (const c of list) {
    const d = c?.commit?.committer?.date;
    const t = typeof d === 'string' ? Date.parse(d) : NaN;
    if (Number.isFinite(t)) out.push(t);
  }
  return out;
}

export function hourlyCounts(times: number[], now: Date): Observation[] {
  const w = hoursWindow(now);
  const out: Observation[] = [];
  for (let h = w.start; h < w.end; h += HOUR) out.push(obs(S_HOURS, h, times.filter((t) => t >= h && t < h + HOUR).length));
  return out;
}

const base = {
  scenarios: ['ai'], evidenceClass: 'A' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'github-rest', intervalMinutes: 1440, maxAgeHours: 96,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  license: 'GitHub-Nutzungsbedingungen; nur Aggregatzahlen',
};

const collector: Collector = {
  id: 'github-rest',
  title: 'GitHub REST API (Suche und Commits)',
  sourceUrl: 'https://docs.github.com/en/rest',
  needsKey: 'SR_GITHUB_KEY',
  intervalMinutes: 60,
  signals: [
    { ...base, id: S_COAUTHOR, domain: 'agents', name: 'Commits mit KI-Co-Autor-Zeile', manipulability: 'high', weight: 0.5,
      unit: 'Commits/Tag', sourceName: 'GitHub Search API (Commits)', sourceUrl: 'https://docs.github.com/en/rest/search/search#search-commits',
      plain: 'Zählt öffentliche Commits eines Tages mit Co-Autor-Zeile von Claude oder Copilot.' },
    { ...base, id: S_PR, domain: 'agents', name: 'Pull-Requests durch Coding-Agenten pro Tag', weight: 0.6,
      unit: 'Pull Requests/Tag', sourceName: 'GitHub Search API (Issues/PRs)', sourceUrl: 'https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests',
      plain: 'Zählt Pull-Requests eines Tages, die Agenten-Apps (Copilot Coding Agent, Devin) selbst geöffnet haben.' },
    { ...base, id: S_MCP, domain: 'supply_chain', name: 'Neue Repositories zu MCP-Servern', weight: 0.5, intervalMinutes: 10080, maxAgeHours: 24 * 16,
      unit: 'Repos/Woche', baseline: { method: 'rolling', windowDays: 365, minPoints: 26 },
      sourceName: 'GitHub Search API (Repositories)', sourceUrl: 'https://docs.github.com/en/rest/search/search#search-repositories',
      plain: 'Zählt neue GitHub-Repos einer Woche mit dem Thema mcp-server als Maß für die Agenten-Angriffsfläche.' },
    { ...base, id: S_HOURS, scenarios: ['cyber'], domain: 'attention', evidenceClass: 'D', name: 'Commit-Zeitmuster in öffentlichen Security-Repos',
      weight: 0.35, unit: 'Commits/Stunde', intervalMinutes: 60, holdHours: 6, maxAgeHours: 12,
      baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      sourceName: 'GitHub REST API (Commits)', sourceUrl: 'https://docs.github.com/en/rest/commits/commits',
      plain: 'Wie viele Commits pro Stunde in OpenSSL, curl und OpenSSH landen; ungewöhnliche Nachtarbeit kann auf einen Notfall deuten.' },
  ],
  async collect(ctx) {
    const key = expect(ctx.key('SR_GITHUB_KEY'), 'SR_GITHUB_KEY');
    const headers = { authorization: `Bearer ${key}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
    const get = (url: string, fixture: string) => ctx.http.json<unknown>(url, { headers, fixture, timeoutMs: 30_000 });
    const yday = floorDay(ctx.now).getTime() - SEARCH_DAY_LAG * DAY_MS;
    const day = isoDay(new Date(yday));
    const observations: Observation[] = [];
    let failed = 0;

    const sum = async (signal: string, ts: number, parts: [string, string][]) => {
      try {
        let total = 0;
        for (const [url, fixture] of parts) total += parseSearchTotal(await get(url, fixture));
        observations.push(obs(signal, ts, total));
      } catch (e) {
        failed++;
        ctx.log(`${signal}: ${(e as Error).message}`);
      }
    };
    await sum(S_COAUTHOR, yday, COAUTHOR_QUERIES.map((c) => [coauthorUrl(c.q, day), `github-rest/coauthor-${c.slug}.json`]));
    await sum(S_PR, yday, PR_APPS.map((a) => [prUrl(a, day), `github-rest/pr-${a}.json`]));
    await sum(S_MCP, lastWeek(ctx.now).monday.getTime(), [[mcpUrl(ctx.now), 'github-rest/mcp-week.json']]);

    try {
      const times: number[] = [];
      for (const r of REPOS) times.push(...parseCommitTimes(await get(commitsUrl(r, ctx.now), `github-rest/commits-${r.replace('/', '-')}.json`)));
      observations.push(...hourlyCounts(times, ctx.now));
    } catch (e) {
      failed++;
      ctx.log(`${S_HOURS}: ${(e as Error).message}`);
    }
    if (failed === 4) throw new Error('GitHub: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
