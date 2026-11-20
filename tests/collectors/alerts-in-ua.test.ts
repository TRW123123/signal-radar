import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseActive, toObservations, SIG_MISSILE, SIG_OBLASTS } from '../../src/collectors/alerts-in-ua.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// nach Doku nachgebaut (https://devs.alerts.in.ua/, Beispiel /v1/alerts/active.json und Modell "Alert")
const SAMPLE = { alerts: [
  { id: 10, location_title: 'Луганська область', location_type: 'oblast', started_at: '2026-11-20T09:45:39.000Z', finished_at: null,
    alert_type: 'air_raid', location_uid: '16', location_oblast: 'Луганська область', location_oblast_uid: '16', alert_level: 'yellow',
    threats: [{ threat_type: 'drones', level: 'yellow', started_at: '2026-11-20T09:45:39.681Z' }] },
  { id: 11, location_title: 'Харківський район', location_type: 'raion', started_at: '2026-11-20T09:50:00.000Z', finished_at: null,
    alert_type: 'air_raid', location_uid: '1293', location_oblast: 'Харківська область', location_oblast_uid: '22', alert_level: 'red',
    threats: [{ threat_type: 'ballistic_missiles', level: 'red' }] },
  { id: 12, location_title: 'м. Харків', location_type: 'city', started_at: '2026-11-20T09:51:00.000Z', finished_at: null,
    alert_type: 'air_raid', location_uid: '1294', location_oblast: 'Харківська область', location_oblast_uid: '22', alert_level: 'red' },
  { id: 13, location_title: 'Херсонська область', location_type: 'oblast', started_at: '2026-11-20T08:00:00.000Z', finished_at: null,
    alert_type: 'artillery_shelling', location_uid: '23', location_oblast: 'Херсонська область', location_oblast_uid: '23' },
] };
const NOW = new Date('2026-11-20T10:07:00Z');

test('parseActive: Oblaste dedupliziert, nur air_raid zählt, Raketenwarnung getrennt', () => {
  assert.deepEqual(parseActive(SAMPLE), { airRaidOblasts: 2, missileOblasts: 1, alerts: 4 });
  const o = toObservations(parseActive(SAMPLE), NOW);
  assert.deepEqual(o.map((x) => [x.signalId, x.ts, x.value]), [
    [SIG_OBLASTS, '2026-11-20T10:00:00.000Z', 2], [SIG_MISSILE, '2026-11-20T10:00:00.000Z', 1]]);
});

test('leere Antwort = 0, fehlendes Feld wirft', () => {
  assert.deepEqual(parseActive({ alerts: [] }), { airRaidOblasts: 0, missileOblasts: 0, alerts: 0 });
  assert.throws(() => parseActive({ message: 'API error' }), /alerts/);
  assert.throws(() => parseActive(null), /alerts/);
  // Eintrag ohne Oblast-Angabe wird ignoriert
  assert.equal(parseActive({ alerts: [{ alert_type: 'air_raid' }] }).airRaidOblasts, 0);
});

test('collect: Bearer-Header, ein Request', async () => {
  const seen: (string | undefined)[] = [];
  const res = await collector.collect({ now: NOW, key: () => 'T', log: () => {},
    http: { json: async (_u: string, init) => { seen.push(init?.headers?.Authorization); return SAMPLE as never; }, text: async () => '' } });
  assert.deepEqual(seen, ['Bearer T']);
  assert.equal(res.observations.length, 2);
});

test('Runner: ohne Key übersprungen', async () => {
  assert.equal(collector.needsKey, 'SR_ALERTS_IN_UA_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-aiu-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_ALERTS_IN_UA_KEY)');
});
