import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHttp } from '../../src/core/http.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';
import collector, { AI_RE, malwareObs, parseAdvisories, reviewedObs, urls } from '../../src/collectors/ghsa.ts';

const FX = join(import.meta.dirname, '..', '..', 'fixtures');
const real = (f: string) => JSON.parse(readFileSync(join(FX, 'ghsa', f), 'utf8'));
// Aufzeichnung 20.11.2026 ohne Token, gekürzt (je Eintrag nur ghsa_id, type, severity, published_at, Paketnamen;
// reviewed.json: erste 40 von 74 Einträgen; malware-w0..w3 aus der echten Ganztagsantwort (100 neueste ab 04:52 UTC)
// nach Fenstern aufgeteilt, w0 daher unvollständig, w2 41 von 43).
const NOW = new Date('2026-11-20T09:00:00Z');
const DAY = Date.parse('2026-11-19T00:00:00Z');

test('URLs: vier 6-h-Fenster und der ganze Vortag', () => {
  const u = urls(NOW);
  assert.equal(u.malware.length, 4);
  assert.equal(u.malware[0], 'https://api.github.com/advisories?type=malware&published=2026-11-19T00:00:00Z..2026-11-19T05:59:59Z&per_page=100');
  assert.equal(u.malware[3], 'https://api.github.com/advisories?type=malware&published=2026-11-19T18:00:00Z..2026-11-19T23:59:59Z&per_page=100');
  assert.equal(u.reviewed, 'https://api.github.com/advisories?type=reviewed&published=2026-11-19T00:00:00Z..2026-11-19T23:59:59Z&per_page=100');
});

test('echte Antwort reviewed: Volumen und hoch/kritisch', () => {
  const body = real('reviewed.json');
  const o = reviewedObs(body, DAY);
  assert.equal(o[0].value, 40);
  assert.equal(o[0].ts, '2026-11-19T00:00:00.000Z');
  const sev = parseAdvisories(body).filter((a) => a.severity === 'high' || a.severity === 'critical').length;
  assert.equal(o[1].value, sev);
  assert.ok(sev > 0 && sev < 40);
});

test('echte Malware-Fenster: Summe, KI-Filter, replay über collect', async () => {
  const windows = [0, 1, 2, 3].map((i) => real(`malware-w${i}.json`));
  const o = malwareObs(windows, DAY);
  assert.equal(o[0].value, windows.reduce((s, w) => s + w.length, 0));
  assert.ok(o[1].value <= o[0].value);
  const http = createHttp({ fixturesDir: FX, mode: 'replay' });
  const res = await collector.collect({ now: NOW, http, key: () => 'dummy', log: () => {} });
  assert.deepEqual(res.observations.map((x) => x.signalId).sort(), collector.signals.map((s) => s.id).sort());
});

test('KI-Filter auf Paketnamen', () => {
  const w = [[
    { ghsa_id: 'GHSA-1', severity: 'critical', published_at: '2026-11-19T01:00:00Z', vulnerabilities: [{ package: { ecosystem: 'npm', name: '@x/md-doc-mcp' } }] },
    { ghsa_id: 'GHSA-2', severity: 'critical', published_at: '2026-11-19T02:00:00Z', vulnerabilities: [{ package: { ecosystem: 'npm', name: 'jeddah' } }] },
  ], [
    { ghsa_id: 'GHSA-1', severity: 'critical', published_at: '2026-11-19T01:00:00Z', vulnerabilities: [] },
  ]];
  const o = malwareObs(w, DAY);
  assert.deepEqual(o.map((x) => x.value), [2, 1]);
  assert.ok(AI_RE.test('openai-helper') && !AI_RE.test('lodash'));
});

test('gesättigtes Fenster: kein Tageswert', () => {
  const full = Array.from({ length: 100 }, (_, i) => ({ ghsa_id: `G${i}`, published_at: '2026-11-19T01:00:00Z' }));
  assert.throws(() => malwareObs([full, [], [], []], DAY), /gesättigt/);
  assert.throws(() => reviewedObs(full, DAY), /gesättigt/);
});

test('leere Antwort', () => {
  assert.deepEqual(reviewedObs([], DAY).map((o) => o.value), [0, 0]);
  assert.deepEqual(malwareObs([[], [], [], []], DAY).map((o) => o.value), [0, 0]);
  assert.throws(() => parseAdvisories({ message: 'API rate limit exceeded' }), /unerwartete Antwort/);
});

test('fehlendes Feld: Einträge ohne ghsa_id oder published_at zählen nicht', () => {
  assert.equal(parseAdvisories([{ ghsa_id: 'G1' }, { published_at: '2026-11-19T01:00:00Z' }]).length, 0);
});

test('ohne Key: Runner überspringt sauber', async () => {
  assert.equal(collector.needsKey, 'SR_GITHUB_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-ghsa-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'kein Key (SR_GITHUB_KEY)');
});
