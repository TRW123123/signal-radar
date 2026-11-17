import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSirens } from '../../src/collectors/github-air-raid-sirens.ts';

// nach der echten Form von volunteer_data_en.csv nachgebaut
const HEAD = 'region,started_at,finished_at,naive\n';
const CSV = HEAD +
  'Kyiv City,2026-11-12 04:00:00+00:00,2026-11-12 04:40:00+00:00,False\n' +
  'Lvivska oblast,2026-11-12 05:00:00+00:00,2026-11-12 05:20:00+00:00,False\n' +
  'Kyiv City,2026-11-12 22:00:00+00:00,2026-11-12 22:30:00+00:00,False\n' +
  'Kharkivska oblast,2026-11-14 01:00:00+00:00,2026-11-14 01:40:00+00:00,False\n' +
  'Kyivska oblast,2026-11-15 04:58:14+00:00,2026-11-15 05:15:20+00:00,False\n';
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall: nur vollständige Tage, Lücke = 0', () => {
  const r = parseSirens(CSV, NOW);
  assert.deepEqual(r.days.map((d) => [d.day, d.alerts, d.regions]), [['2026-11-12', 3, 2], ['2026-11-13', 0, 0], ['2026-11-14', 1, 1]]);
  assert.equal(r.lastStart, '2026-11-15T04:58:14.000Z');
});
test('Range-Abruf: angeschnittene Zeile und Starttag entfallen', () => {
  const r = parseSirens('ska oblast,2026-11-11 03:00:00+00:00,x,False\n' + CSV.split('\n').slice(1).join('\n'), NOW, { partial: true });
  assert.equal(r.days[0].day, '2026-11-13'); // 12.11. ist der erste (angeschnittene) Tag der Datei, die Zeile vom 11.11. wurde verworfen
});
test('leere Antwort', () => {
  assert.throws(() => parseSirens('', NOW), /Antworttext/);
  assert.deepEqual(parseSirens(HEAD, NOW).days, []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseSirens('region,finished_at\nKyiv City,x\n', NOW), /started_at/);
  assert.deepEqual(parseSirens(HEAD + 'Kyiv City,kaputt,x,False\n', NOW).days, []);
});
