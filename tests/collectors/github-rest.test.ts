import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttp } from '../../src/core/http.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';
import collector, { commitsUrl, coauthorUrl, hourlyCounts, lastWeek, mcpUrl, parseCommitTimes, parseSearchTotal, prUrl } from '../../src/collectors/github-rest.ts';

const FX = join(import.meta.dirname, '..', '..', 'fixtures');
const real = (f: string) => JSON.parse(readFileSync(join(FX, 'github-rest', f), 'utf8'));
// Aufzeichnung 20.11.2026 ohne Token mit now = 2026-11-20T09:00Z; gekürzt: Suche ohne items (Feld _trimmed),
// Commits nur sha + committer.date.
const NOW = new Date('2026-11-20T09:00:00Z');

test('URLs', () => {
  assert.equal(coauthorUrl('"noreply@anthropic.com"', '2026-11-18'), 'https://api.github.com/search/commits?q=%22noreply%40anthropic.com%22%20committer-date%3A2026-11-18&per_page=1');
  assert.equal(prUrl('copilot-swe-agent', '2026-11-18'), 'https://api.github.com/search/issues?q=is%3Apr%20author%3Aapp%2Fcopilot-swe-agent%20created%3A2026-11-18&per_page=1');
  assert.equal(mcpUrl(NOW), 'https://api.github.com/search/repositories?q=topic%3Amcp-server%20created%3A2026-11-09..2026-11-15&per_page=1');
  assert.equal(lastWeek(new Date('2026-11-16T01:00:00Z')).monday.toISOString(), '2026-11-09T00:00:00.000Z');
  assert.equal(commitsUrl('curl/curl', NOW), 'https://api.github.com/repos/curl/curl/commits?since=2026-11-18T03:00:00Z&per_page=100');
});

test('echte Antworten: Suche und Commit-Stunden über collect (replay)', async () => {
  // Die Claude-Suche (~2 Mio. Commits/Tag) kam bei der Aufzeichnung mit incomplete_results=true: kein Co-Autor-Wert.
  assert.throws(() => parseSearchTotal(real('coauthor-claude.json')), /incomplete/);
  assert.ok(parseSearchTotal(real('coauthor-copilot.json')) > 1000);
  const http = createHttp({ fixturesDir: FX, mode: 'replay' });
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, http, key: () => 'dummy', log: (m) => logs.push(m) });
  const by = (id: string) => res.observations.filter((o) => o.signalId === id);
  assert.equal(by('ai.agents.github_agent_coauthor_commits').length, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /coauthor_commits: incomplete_results/);
  const pr = by('ai.agents.github_agent_pr_rate');
  assert.equal(pr[0].ts, '2026-11-18T00:00:00.000Z');
  assert.equal(pr[0].value, parseSearchTotal(real('pr-copilot-swe-agent.json')) + parseSearchTotal(real('pr-devin-ai-integration.json')));
  assert.equal(by('ai.supply_chain.mcp_repo_growth')[0].ts, '2026-11-09T00:00:00.000Z');
  const hours = by('cyber.attention.security_repo_commit_hours');
  assert.equal(hours.length, 48);
  assert.equal(hours[0].ts, '2026-11-18T03:00:00.000Z');
  assert.equal(hours.at(-1)!.ts, '2026-11-20T02:00:00.000Z');
  assert.ok(hours.reduce((s, o) => s + o.value, 0) > 0);
});

test('Stundenzählung', () => {
  const o = hourlyCounts([Date.parse('2026-11-19T10:15:00Z'), Date.parse('2026-11-19T10:59:59Z'), Date.parse('2026-11-20T05:00:00Z')], NOW);
  assert.equal(o.find((x) => x.ts === '2026-11-19T10:00:00.000Z')!.value, 2);
  assert.equal(o.reduce((s, x) => s + x.value, 0), 2); // 05:00 liegt in den letzten 6 h und zählt nicht
});

test('leere Antwort', () => {
  assert.equal(parseSearchTotal({ total_count: 0, incomplete_results: false, items: [] }), 0);
  assert.deepEqual(parseCommitTimes([]), []);
  assert.throws(() => parseSearchTotal(null), /unerwartete Antwort/);
});

test('fehlendes Feld, unvollständige Suche, volle Seite', () => {
  assert.throws(() => parseSearchTotal({ items: [] }), /total_count/);
  assert.throws(() => parseSearchTotal({ total_count: 5, incomplete_results: true }), /incomplete/);
  assert.throws(() => parseCommitTimes({}), /Commit-Liste/);
  assert.throws(() => parseCommitTimes(Array.from({ length: 100 }, () => ({}))), /voll/);
  assert.deepEqual(parseCommitTimes([{ sha: 'a' }]), []);
});

test('Teilfehler: fehlender Summand meldet keine Summe', async () => {
  const http = { json: async (u: string) => (u.includes('Copilot') ? { incomplete_results: true, total_count: 3 } : u.includes('/repos/') ? [] : { total_count: 7, incomplete_results: false }), text: async () => '' } as unknown as HttpClient;
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, http, key: () => 'k', log: (m) => logs.push(m) });
  assert.equal(res.observations.some((o) => o.signalId === 'ai.agents.github_agent_coauthor_commits'), false);
  assert.equal(res.observations.find((o) => o.signalId === 'ai.agents.github_agent_pr_rate')!.value, 14);
  assert.equal(logs.length, 1);
});

test('ohne Key: Runner überspringt sauber; mil_count_baltic nicht gebaut', async () => {
  assert.equal(collector.needsKey, 'SR_GITHUB_KEY');
  assert.equal(collector.signals.some((s) => s.id === 'war.military.mil_count_baltic'), false);
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-gh-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_GITHUB_KEY)');
});
