import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHttp } from '../../src/core/http.ts';
import collector, { decay, parseChart, sumSeries, REFLECTOR_TAGS } from '../../src/collectors/shadowserver.ts';

const FX = join(import.meta.dirname, '..', '..', 'fixtures');
const real = (f: string) => JSON.parse(readFileSync(join(FX, 'shadowserver', f), 'utf8'));
const NOW = new Date('2026-11-20T08:00:00Z');

test('echte Antwort (20.11.2026): ICS weltweit = Summe der Regionen', () => {
  const chart = parseChart(real('ics-world.json'));
  assert.equal(chart.days.length, 30);
  const o = sumSeries('x', chart);
  assert.equal(o.length, 30);
  assert.equal(o.at(-1)!.ts, '2026-11-18T00:00:00.000Z');
  const manual = [...chart.series.values()].reduce((s, v) => s + v.at(-1)!, 0);
  assert.equal(o.at(-1)!.value, manual);
  assert.ok(manual > 10_000);
});

test('echte Antwort: Reflektoren-Tags vollständig, DE-Reihe und Abbau', () => {
  const refl = sumSeries('r', parseChart(real('reflectors-world.json')), REFLECTOR_TAGS);
  assert.ok(refl.length >= 25 && refl.length <= 30); // Tage mit fehlendem Tag-Wert entfallen (am 20.11.2026: 29)
  assert.ok(refl[0].value > 1_000_000);
  const vuln = sumSeries('v', parseChart(real('vulnerable-de.json')), ['Germany']);
  const d = decay('d', vuln);
  assert.equal(d.length, 23);
  assert.equal(d.at(-1)!.value, vuln.at(-8)!.value - vuln.at(-1)!.value);
});

test('collect gegen echte Aufzeichnung (replay)', async () => {
  const http = createHttp({ fixturesDir: FX, mode: 'replay' });
  const res = await collector.collect({ now: NOW, http, key: () => undefined, log: () => {} });
  const ids = new Set(res.observations.map((o) => o.signalId));
  assert.deepEqual([...ids].sort(), collector.signals.map((s) => s.id).sort());
  assert.ok(res.observations.every((o) => Number.isFinite(o.value)));
});

test('leere Antwort', () => {
  assert.throws(() => parseChart(null), /unerwartete Antwort/);
  assert.throws(() => parseChart({ content: '<div class="empty-message">Please enter some filter details</div>' }), /data-bb/);
  assert.throws(() => parseChart({ errors: { dataset: ['This field is required.'] }, content: '' }), /Formularfehler/);
});

test('fehlendes Feld: fehlende Serie bzw. Tageswert', () => {
  const bb = (cols: unknown[]) => ({ content: `<div data-bb="${JSON.stringify({ data: { columns: cols } }).replace(/"/g, '&quot;')}"></div>` });
  const chart = parseChart(bb([['x', '2026-11-17', '2026-11-18'], ['dns', 10, null], ['ntp', 5, 6]]));
  assert.deepEqual(sumSeries('s', chart, ['dns', 'ntp']).map((o) => o.value), [15]);
  assert.throws(() => sumSeries('s', chart, ['dns', 'snmp']), /snmp fehlen/);
  assert.throws(() => parseChart(bb([['dns', 1]])), /x-Spalte/);
  assert.throws(() => parseChart({ content: '<div data-bb="{}"></div>' }), /data.columns/);
});

test('kein Key nötig: Collector läuft ohne needsKey', () => {
  assert.equal(collector.needsKey, undefined);
});
