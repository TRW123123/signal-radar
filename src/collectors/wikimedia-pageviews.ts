// Wikipedia page views for crisis-related articles (evidence class D: public attention, not measurement).
// Source: Wikimedia Analytics REST API, no key, daily values with years of history.
// https://wikimedia.org/api/rest_v1/#/Pageviews%20data
// Reference implementation: other collectors follow this structure.

import type { Collector, Observation } from '../core/types.ts';
import { daysAgo, expect, num, obs, ymd } from './_helpers.ts';

interface Group { signalId: string; name: string; plain: string; project: string; articles: string[]; scenario: string }

/** Article groups per scenario. Adding a scenario's attention signal is one entry here. */
export const GROUPS: Group[] = [
  {
    signalId: 'cyber.attention.wikipedia_de', scenario: 'cyber', project: 'de.wikipedia',
    name: 'Wikipedia-Aufrufe zu Cyber-Themen (deutsch)',
    plain: 'Wie oft deutschsprachige Wikipedia-Artikel zu Cyberangriff, Stromausfall und Notvorrat aufgerufen werden.',
    articles: ['Cyberattacke', 'Stromausfall', 'Notvorrat', 'Hacker'],
  },
  {
    signalId: 'cyber.attention.wikipedia_en', scenario: 'cyber', project: 'en.wikipedia',
    name: 'Wikipedia-Aufrufe zu Cyber-Themen (englisch)',
    plain: 'Wie oft englische Wikipedia-Artikel zu Cyberangriffen und Internet-Ausfällen aufgerufen werden.',
    articles: ['Cyberattack', 'Internet_outage', 'Power_outage', 'Cyberwarfare'],
  },
];

interface Resp { items?: { timestamp: string; views: number }[] }

export function parse(body: Resp): Map<string, number> {
  const items = expect(body.items, 'items');
  const out = new Map<string, number>();
  for (const it of items) {
    const v = num(it.views);
    // timestamp format YYYYMMDD00
    if (v !== null && /^\d{10}$/.test(it.timestamp)) out.set(it.timestamp.slice(0, 8), v);
  }
  return out;
}

const collector: Collector = {
  id: 'wikimedia-pageviews',
  title: 'Wikimedia Pageviews API',
  sourceUrl: 'https://wikimedia.org/api/rest_v1/',
  intervalMinutes: 360,
  signals: GROUPS.map((g) => ({
    id: g.signalId, scenarios: [g.scenario], domain: 'attention', name: g.name, plain: g.plain,
    evidenceClass: 'D' as const, direction: 'up' as const, kind: 'count' as const, weight: 0.5, manipulability: 'medium' as const,
    independenceGroup: 'wikimedia', unit: 'Aufrufe/Tag', intervalMinutes: 1440, holdHours: 48,
    baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
    license: 'CC0 (Wikimedia Analytics)',
  })),
  async collect(ctx) {
    const end = ymd(daysAgo(ctx.now, 1));
    const start = ymd(daysAgo(ctx.now, 75));
    const observations: Observation[] = [];
    for (const g of GROUPS) {
      const perDay = new Map<string, number>();
      let ok = 0;
      for (const article of g.articles) {
        const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${g.project}/all-access/user/${encodeURIComponent(article)}/daily/${start}/${end}`;
        try {
          const days = parse(await ctx.http.json<Resp>(url, { fixture: `wikimedia/${g.project}-${article}.json` }));
          for (const [d, v] of days) perDay.set(d, (perDay.get(d) ?? 0) + v);
          ok++;
        } catch (e) {
          ctx.log(`Artikel ${article} übersprungen: ${(e as Error).message}`);
        }
      }
      // A partial article set would look like a drop; only report when every article answered.
      if (ok !== g.articles.length) continue;
      for (const [d, v] of perDay) {
        observations.push(obs(g.signalId, `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`, v, { articles: g.articles.length }));
      }
    }
    return { observations };
  },
};

export default collector;
