import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../src/core/catalog.ts';
import { activate, discoverCollectors } from '../src/core/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const catalog = loadCatalog(root);
const signals = activate(catalog, await discoverCollectors(root), process.env).signals;
const active = signals.filter((s) => s.collector && s.status !== 'planned' && s.status !== 'license-unclear');

test('geo.json: Regeln gültig, Koordinaten im Wertebereich', () => {
  assert.ok(catalog.geo.length > 0);
  for (const r of catalog.geo) {
    assert.ok(r.appliesTo.length > 0 && r.label, r.label);
    assert.ok(r.lat >= -90 && r.lat <= 90, `lat ${r.label}`);
    assert.ok(r.lon >= -180 && r.lon <= 180, `lon ${r.label}`);
    assert.ok(['point', 'country', 'region', 'route'].includes(r.kind), `kind ${r.label}`);
    if (r.kind === 'country') assert.match(r.cc ?? '', /^[A-Z]{2}$/, `cc ${r.label}`);
  }
});

test('geo.json: mindestens 60 aktive Signale haben einen Ort', () => {
  assert.ok(active.filter((s) => s.geo).length >= 60);
});

test('geo.json: weltweite Signale bleiben ohne Ort', () => {
  for (const id of ['cyber.vuln.cve_published_daily', 'cyber.vuln.nvd_cve_volume', 'cyber.attention.hackernews_volume', 'cyber.outages.tor_exit_nodes']) {
    const s = signals.find((x) => x.id === id);
    assert.ok(s, id);
    assert.equal(s.geo, undefined, id);
  }
});
