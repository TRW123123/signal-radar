// GitHub Advisory Database über die REST-API (Klasse B: kuratierte Meldungen; Malware-Einträge stammen großteils aus
// OpenSSF malicious-packages und Amazon Inspector, die geprüften Advisories von GitHub bzw. den Maintainern).
// Quelle: https://api.github.com/advisories  Doku: https://docs.github.com/en/rest/security-advisories/global-advisories
// Key: SR_GITHUB_KEY (Bearer-Token, nur lesend, 1 000 Anfragen/h). Kein Fallback auf github.token. Ohne Token gehen die
//   Endpunkte auch (60/h je IP, geprüft 20.11.2026), das Limit teilen sich aber alle GitHub-Collectors: daher needsKey.
// Lizenz: CC BY 4.0. Attribution laut GitHub: Link auf die GitHub Advisory Database https://github.com/advisories
//   (oder auf einzelne Einträge). Pflichtangabe gehört in src/core/attribution.ts.
// Gemessen (je Lauf 5 Anfragen, nur der volle Vortag in UTC, Filter published=<Zeitfenster>):
//   - cyber.threat.osv_malware_advisories: type=malware, Anzahl/Tag. Mehr als 100 pro Tag (per_page-Maximum), daher vier
//     6-Stunden-Fenster. Liefert ein Fenster 100 Einträge (gesättigt), entfällt der Tageswert (keine Untergrenzen melden).
//   - ai.supply_chain.osv_malware_ai: dieselben Malware-Einträge, gefiltert auf Paketnamen mit KI-Begriff (llm, openai,
//     gpt, anthropic, claude, mcp, agent, langchain, ollama, huggingface, copilot, gemini, deepseek, mistral).
//   - cyber.vuln.advisory_volume: type=reviewed (von GitHub geprüft), Anzahl/Tag.
//   - cyber.vuln.github_security_issue_spike: type=reviewed mit severity high oder critical, Anzahl/Tag. Näherung für
//     "Security-Meldungen bei Kernprojekten": GHSA kennt keinen Repo-Größenfilter.
// Harmlose Ursachen: Massenimporte (z. B. ein Forscher meldet hundert Spam-Pakete), Backfill älterer Advisories,
//   ein Paket mit vielen Advisories an einem Tag (am 19.11.2026: 20 × nltk), Release-Termine; "agent" trifft auch
//   harmlose Namen wie user-agent.
// VERIFIED: ja (20.11.2026 ohne Token gegen echte Antworten; Fixtures fixtures/ghsa/*.json sind gekürzt: je Eintrag nur
//   ghsa_id, type, severity, published_at, vulnerabilities[].package; reviewed.json 40 von 74 Einträgen; malware-w0..w3
//   aus der echten Ganztagsantwort published=2026-11-19 (100 neueste, ab 04:52 UTC) nach Fenstern aufgeteilt: w0 deshalb nur
//   04:52–06:00, w2 41 von 43 Einträgen; Grund: anonymes GitHub-Limit der geteilten Bau-IP erschöpft).

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, obs } from './_helpers.ts';

const API = 'https://api.github.com/advisories';
const S_MAL = 'cyber.threat.osv_malware_advisories';
const S_MAL_AI = 'ai.supply_chain.osv_malware_ai';
const S_VOL = 'cyber.vuln.advisory_volume';
const S_SEV = 'cyber.vuln.github_security_issue_spike';
const PER_PAGE = 100;
export const AI_RE = /llm|openai|gpt|anthropic|claude|mcp|agent|langchain|ollama|hugging-?face|copilot|gemini|deepseek|mistral/i;

export interface Advisory { id: string; severity: string; published: number; packages: string[] }

const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z');

/** Vier 6-Stunden-Fenster des Vortags (Malware) bzw. der ganze Vortag (reviewed). */
export function urls(now: Date): { malware: string[]; reviewed: string } {
  const d0 = floorDay(now).getTime() - DAY_MS;
  const win = (a: number, b: number) => `${iso(a)}..${iso(b - 1000)}`;
  const malware = [0, 1, 2, 3].map((i) => `${API}?type=malware&published=${win(d0 + i * 6 * 3600_000, d0 + (i + 1) * 6 * 3600_000)}&per_page=${PER_PAGE}`);
  return { malware, reviewed: `${API}?type=reviewed&published=${win(d0, d0 + DAY_MS)}&per_page=${PER_PAGE}` };
}

export function parseAdvisories(body: unknown): Advisory[] {
  const list = expect(Array.isArray(body) ? (body as Record<string, unknown>[]) : null, 'Liste der Advisories');
  const out: Advisory[] = [];
  for (const a of list) {
    const id = a?.ghsa_id;
    const t = typeof a?.published_at === 'string' ? Date.parse(a.published_at) : NaN;
    if (typeof id !== 'string' || !Number.isFinite(t)) continue;
    const vulns = Array.isArray(a.vulnerabilities) ? (a.vulnerabilities as { package?: { ecosystem?: unknown; name?: unknown } }[]) : [];
    const packages = vulns.map((v) => v?.package?.name).filter((n): n is string => typeof n === 'string');
    out.push({ id, severity: typeof a.severity === 'string' ? a.severity.toLowerCase() : 'unknown', published: t, packages });
  }
  return out;
}

const saturated = (body: unknown) => Array.isArray(body) && body.length >= PER_PAGE;

export function malwareObs(windows: unknown[], day: number): Observation[] {
  if (windows.some(saturated)) throw new Error('ein Malware-Zeitfenster hat 100 Einträge (gesättigt), Tageswert entfällt');
  const seen = new Map<string, Advisory>();
  for (const w of windows) {
    for (const a of parseAdvisories(w)) {
      const prev = seen.get(a.id);
      seen.set(a.id, prev ? { ...prev, packages: [...new Set([...prev.packages, ...a.packages])] } : a);
    }
  }
  const all = [...seen.values()];
  const ai = all.filter((a) => a.packages.some((p) => AI_RE.test(p)));
  return [obs(S_MAL, day, all.length), obs(S_MAL_AI, day, ai.length, ai.length ? { ids: ai.slice(0, 10).map((a) => a.id) } : undefined)];
}

export function reviewedObs(body: unknown, day: number): Observation[] {
  if (saturated(body)) throw new Error('reviewed: 100 Einträge (gesättigt), Tageswert entfällt');
  const list = parseAdvisories(body);
  return [obs(S_VOL, day, list.length), obs(S_SEV, day, list.filter((a) => a.severity === 'high' || a.severity === 'critical').length)];
}

const base = {
  scenarios: ['cyber'], evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, intervalMinutes: 1440, unit: 'Advisories/Tag',
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  sourceName: 'GitHub Advisory Database', sourceUrl: 'https://github.com/advisories',
  license: 'CC BY 4.0 (GitHub Advisory Database; Link auf https://github.com/advisories)',
};

const collector: Collector = {
  id: 'ghsa',
  title: 'GitHub Advisory Database (REST)',
  sourceUrl: 'https://github.com/advisories',
  needsKey: 'SR_GITHUB_KEY',
  intervalMinutes: 1440,
  signals: [
    { ...base, id: S_MAL, domain: 'threat', name: 'Neue Paket-Malware-Advisories (GHSA)', weight: 0.55, independenceGroup: 'osv',
      plain: 'Wie viele bösartige Pakete (npm, PyPI und andere) an einem Tag in der GitHub-Advisory-Datenbank gemeldet werden.' },
    { ...base, id: S_MAL_AI, scenarios: ['ai'], domain: 'supply_chain', name: 'Schadpaket-Meldungen mit KI-Bezug (GHSA)',
      weight: 0.85, manipulability: 'low', independenceGroup: 'ossf-malicious', unit: 'Meldungen/Tag',
      baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
      plain: 'Zählt gemeldete Schadpakete, deren Name auf KI-Werkzeuge zielt (LLM, OpenAI, MCP, Agent und Ähnliche).' },
    { ...base, id: S_VOL, domain: 'vuln', name: 'GitHub Advisories Volumen (geprüft)', weight: 0.3, independenceGroup: 'osv',
      plain: 'Wie viele neue, von GitHub geprüfte Sicherheitsmeldungen zu Software-Paketen an einem Tag erscheinen.' },
    { ...base, id: S_SEV, domain: 'vuln', name: 'Schwere GitHub-Advisories (hoch/kritisch)', weight: 0.3, independenceGroup: 'ghsa',
      plain: 'Wie viele neue geprüfte Sicherheitsmeldungen mit hoher oder kritischer Schwere an einem Tag erscheinen.' },
  ],
  async collect(ctx) {
    const key = expect(ctx.key('SR_GITHUB_KEY'), 'SR_GITHUB_KEY');
    const init = (fixture: string) => ({
      fixture, timeoutMs: 60_000,
      headers: { authorization: `Bearer ${key}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    const u = urls(ctx.now);
    const day = floorDay(ctx.now).getTime() - DAY_MS;
    const observations: Observation[] = [];
    let failed = 0;
    try {
      const windows: unknown[] = [];
      for (let i = 0; i < u.malware.length; i++) windows.push(await ctx.http.json(u.malware[i], init(`ghsa/malware-w${i}.json`)));
      observations.push(...malwareObs(windows, day));
    } catch (e) {
      failed++;
      ctx.log(`malware: ${(e as Error).message}`);
    }
    try {
      observations.push(...reviewedObs(await ctx.http.json(u.reviewed, init('ghsa/reviewed.json')), day));
    } catch (e) {
      failed++;
      ctx.log(`reviewed: ${(e as Error).message}`);
    }
    if (failed === 2) throw new Error('GHSA: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
