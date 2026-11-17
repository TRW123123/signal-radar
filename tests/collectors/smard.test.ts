import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex, parseSeries } from '../../src/collectors/smard.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
const H = 3600_000;
const T0 = Date.UTC(2026, 10, 16, 0);
test('Index sortiert', () => {
  assert.deepEqual(parseIndex({ timestamps: [3, 1, 2] }), [1, 2, 3]);
});
test('Serie: Normalfall, null und laufende Stunde entfallen', () => {
  const r = parseSeries({ series: [[T0, 50000], [T0 + H, null], [T0 + 2 * H, 52000], [T0 + 3 * H, 53000]] }, T0 + 3 * H);
  assert.deepEqual(r.map((x) => x.mw), [50000, 52000]);
});
test('leere Antwort und fehlendes Feld', () => {
  assert.deepEqual(parseSeries({ series: [] }, T0), []);
  assert.throws(() => parseSeries({}, T0), /series/);
  assert.throws(() => parseIndex({}), /timestamps/);
});

// Echter Ausschnitt (index_hour.json vom 17.11.2026, Ende der Liste; Wochenanfang = Montag 00:00 Ortszeit)
const REAL_INDEX = { timestamps: [1793574000000, 1794178800000, 1794783600000] };
test('Index echter Ausschnitt: Wochenstarts liegen auf ganzen Stunden, jüngster vor dem 17.11.2026', () => {
  const t = parseIndex(REAL_INDEX);
  assert.equal(t.length, 3);
  assert.ok(t.every((x) => x % H === 0));
  assert.equal(new Date(t[2]).toISOString(), '2026-11-15T23:00:00.000Z');
});

// --- Wochenanfänge ohne Index-Abruf ---
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import collector, { weekStarts } from '../../src/collectors/smard.ts';

test('weekStarts: Montag 00:00 Europe/Berlin, stimmt mit dem echten Index (17.11.2026) überein, auch über Zeitumstellungen', () => {
  const idx = parseIndex(JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'smard', 'index_hour.json'), 'utf8')));
  const now = Date.UTC(2026, 10, 17, 0);
  assert.deepEqual(weekStarts(now, 4), idx.slice(-4));
  const year = weekStarts(now, 60);
  assert.equal(year.length, 60);
  assert.ok(year.every((t) => idx.includes(t)));
  // Winterzeit: Montag 00:00 MEZ = Sonntag 23:00 UTC; eine Stunde davor gehört noch zur Vorwoche
  assert.equal(weekStarts(Date.UTC(2026, 10, 15, 23, 0), 1)[0], Date.UTC(2026, 10, 15, 23, 0));
  assert.equal(weekStarts(Date.UTC(2026, 10, 15, 22, 0), 1)[0], Date.UTC(2026, 10, 8, 23, 0));
  // Sommerzeit: Montag 00:00 MESZ = Sonntag 22:00 UTC
  assert.equal(weekStarts(Date.UTC(2026, 6, 13, 12), 1)[0], Date.UTC(2026, 6, 12, 22, 0));
});

test('collect: kein Index-Request, vier Wochendateien', async () => {
  const urls: string[] = [];
  const ctx = { now: new Date('2026-11-17T00:16:13Z'), key: () => undefined, log: () => {},
    http: { text: async () => '', json: async (u: string) => { urls.push(u); return { series: [[1794783600000, 50000], [1794787200000, null]] }; } } };
  const r = await collector.collect(ctx as never);
  assert.equal(urls.length, 4);
  assert.ok(urls.every((u) => /410_DE_hour_\d+\.json$/.test(u)));
  assert.ok(r.observations.length >= 1);
});
