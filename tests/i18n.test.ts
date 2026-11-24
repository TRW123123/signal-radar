import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const en = JSON.parse(readFileSync('frontend/data/i18n-en.json', 'utf8'));
const scenarios = JSON.parse(readFileSync('catalog/scenarios.json', 'utf8')) as Array<{ id: string; domains: Record<string, unknown> }>;

test('English texts cover all scenarios and their domains', () => {
  for (const s of scenarios) {
    const e = en.scenarios[s.id];
    assert.ok(e, `scenario ${s.id} missing`);
    for (const k of ['title', 'question', 'tagline']) assert.ok(e[k], `${s.id}.${k} missing`);
    for (const d of Object.keys(s.domains)) {
      assert.ok(e.domains?.[d]?.title && e.domains[d].plain, `domain ${s.id}.${d} missing`);
    }
  }
});

test('English texts cover at least 95 % of signals with a collector', async () => {
  const { loadCatalog } = await import('../src/core/catalog.ts');
  const { discoverCollectors, activate } = await import('../src/core/registry.ts');
  const cat = activate(loadCatalog('.'), await discoverCollectors('.'), process.env);
  const ids = cat.signals.filter((s) => s.collector && s.status !== 'planned' && s.status !== 'license-unclear').map((s) => s.id);
  assert.ok(ids.length > 0);
  const covered = ids.filter((id) => en.signals[id]?.name && en.signals[id]?.plain);
  assert.ok(covered.length / ids.length >= 0.95, `only ${covered.length} of ${ids.length} signals translated`);
});
