import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { decayUrl, parseDecay, SIG_DECAY } from '../../src/collectors/space-track.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// nach Doku nachgebaut (Klasse decay, Felder als Text)
const row = (id: string, type: string, msg: string) => ({ NORAD_CAT_ID: id, OBJECT_NUMBER: id, OBJECT_NAME: 'STARLINK-1', INTLDES: '2020-001A',
  OBJECT_ID: '2020-001A', RCS: '0', RCS_SIZE: 'LARGE', COUNTRY: 'US', MSG_EPOCH: msg, DECAY_EPOCH: '2026-11-19 04:12:00', SOURCE: '60day',
  MSG_TYPE: type, PRECEDENCE: '1' });
const SAMPLE = [
  row('44001', 'Historical', '2026-11-19 06:00:00'),
  row('44001', 'Historical', '2026-11-19 07:00:00'), // doppelt, zählt einmal
  row('44002', 'Historical', '2026-11-19 23:59:00'),
  row('44003', 'Prediction', '2026-11-19 10:00:00'),
  row('44004', 'Historical', '2026-11-20 01:00:00'), // heute
];
const NOW = new Date('2026-11-20T18:00:00Z');

test('parseDecay: Normalfall', () => {
  const o = parseDecay(SAMPLE, NOW);
  assert.deepEqual([o.signalId, o.ts, o.value], [SIG_DECAY, '2026-11-19T00:00:00.000Z', 2]);
});

test('leere Antwort = 0, fehlendes Feld wirft', () => {
  assert.equal(parseDecay([], NOW).value, 0);
  assert.throws(() => parseDecay({ error: 'login' }, NOW), /Liste/);
  assert.throws(() => parseDecay([{ NORAD_CAT_ID: '1', MSG_EPOCH: '2026-11-19 06:00:00' }], NOW), /MSG_TYPE/);
});

test('decayUrl: Vortag, 1 Abfrage/Tag', () => {
  assert.equal(decayUrl(NOW), 'https://www.space-track.org/basicspacedata/query/class/decay/MSG_EPOCH/2026-11-19--2026-11-20/orderby/DECAY_EPOCH%20desc/format/json');
  assert.equal(collector.intervalMinutes, 1440);
});

test('collect: mit Keys klarer Fehler (POST-Login nicht möglich)', async () => {
  await assert.rejects(collector.collect({ now: NOW, key: () => 'x', log: () => {}, http: {} as HttpClient }), /POST/);
});

test('Runner: ohne Keys übersprungen', async () => {
  assert.deepEqual(collector.needsKey, ['SR_SPACE_TRACK_USER', 'SR_SPACE_TRACK_PASS']);
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-st-')));
  const [r] = await runCollectors([collector], store, { now: NOW, http: {} as HttpClient, env: { SR_SPACE_TRACK_PASS: 'p' } });
  assert.equal(r.skipped, 'kein Key (SR_SPACE_TRACK_USER, SR_SPACE_TRACK_PASS)');
});
