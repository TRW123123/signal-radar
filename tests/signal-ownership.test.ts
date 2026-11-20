import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCollectors } from '../src/core/registry.ts';

// Eine Signal-id darf nur von einem gebauten Collector gespeist werden; sonst überschreibt activate() den Eigentümer
// und zwei Quellen landen in einer Reihe.
test('keine Signal-id wird von zwei gebauten Collectors deklariert', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const owners = new Map<string, string[]>();
  for (const c of await discoverCollectors(root)) for (const s of c.signals) owners.set(s.id, [...(owners.get(s.id) ?? []), c.id]);
  const dup = [...owners].filter(([, cs]) => new Set(cs).size > 1 || cs.length > 1);
  assert.deepEqual(dup, []);
});
