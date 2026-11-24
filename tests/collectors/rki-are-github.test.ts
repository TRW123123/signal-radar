import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseAre, spreadPerWeek } from '../../src/collectors/rki-are-github.ts';
import { isoWeekThursday, type WeekPoint } from '../../src/collectors/_rki-weekly.ts';

// gekürzter echter Ausschnitt aus ARE-Konsultationsinzidenz.tsv (Abruf 24.11.2026); die Woche W44 steht nur mit einer Zeile da (angeschnitten)
const H = 'Saison\tKalenderwoche\tBundesland\tBundesland_ID\tAltersgruppe\tARE_Konsultationsinzidenz\n';
const BODY =
  '2026/27\t2026-W44\tBundesweit\t0\t00+\t1300\n' +
  '2026/27\t2026-W45\tBundesweit\t0\t00+\t1341\n' +
  '2026/27\t2026-W45\tBundesweit\t0\t0-4\t3812\n' +
  '2026/27\t2026-W45\tBayern\t9\t00+\t1501\n' +
  '2026/27\t2026-W46\tBundesweit\t0\t00+\t1326\n' +
  '2026/27\t2026-W46\tBundesweit\t0\t0-4\t3479\n' +
  '2026/27\t2026-W46\tBayern\t9\t00+\t1389\n' +
  '2026/27\t2026-W46\tBayern\t9\t0-4\t2293\n';

test('Normalfall: Bundesweit 00+ und 0-4, Länder getrennt, Donnerstag als Zeitstempel', () => {
  const r = parseAre(H + BODY);
  assert.deepEqual(r.all.map((p) => [p.ts.toISOString().slice(0, 10), p.value]), [['2026-10-29', 1300], ['2026-11-05', 1341], ['2026-11-12', 1326]]);
  assert.deepEqual(r.kids.map((p) => p.value), [3812, 3479]);
  assert.deepEqual(r.laender.get('Bayern')!.map((p) => p.value), [1501, 1389]);
  assert.equal(r.lastWeek, '2026-W46');
});
test('Range-Abruf: angeschnittene erste Zeile und früheste Woche entfallen', () => {
  const r = parseAre('rest der angeschnittenen Zeile\t1\n' + BODY, { partial: true });
  assert.deepEqual(r.all.map((p) => p.week), [45, 46]);
});
test('leere Antwort und fehlende Spalten', () => {
  assert.throws(() => parseAre(''), /Antworttext/);
  assert.throws(() => parseAre('Saison\tKalenderwoche\n2026/27\t2026-W46\n'), /Spalten/);
});
test('Zeile mit fehlendem Wert oder ungültiger Woche wird übersprungen', () => {
  const r = parseAre(H + '2026/27\t2026-W46\tBundesweit\t0\t00+\t\n2026/27\tkeine\tBundesweit\t0\t00+\t5\n');
  assert.equal(r.all.length, 0);
});
test('Zahl der Bundesländer über Vorjahresmittel: nur bei Werten aller 16 Länder (synthetisch)', () => {
  const pts = (cur: number): WeekPoint[] => [2023, 2024, 2025].map((y, i) => ({ year: y, week: 10, ts: isoWeekThursday(y, 10), value: i < 2 ? 100 : cur }));
  const l = new Map<string, WeekPoint[]>();
  for (let i = 0; i < 16; i++) l.set(`L${i}`, pts(i < 5 ? 150 : 50));
  assert.deepEqual([...spreadPerWeek(l).values()], [5]);
  l.delete('L0');
  assert.equal(spreadPerWeek(l).size, 0);
});
test('Deklaration: Gewichte, geo, Verzug', () => {
  const byId = new Map(collector.signals.map((s) => [s.id, s]));
  assert.equal(byId.get('bio.clinical.are_konsultation')!.weight, 0.2);
  assert.equal(byId.get('bio.clinical.are_konsultation_saison')!.weight, 0.6);
  assert.equal(byId.get('bio.clinical.are_kids_saison')!.weight, 0.5);
  assert.equal(byId.get('bio.clinical.are_bl_spread')!.weight, 0.55);
  assert.equal(byId.get('bio.clinical.are_bl_spread')!.geo?.cc, 'DE');
  assert.equal(byId.get('bio.clinical.are_konsultation')!.maxAgeHours, 360);
});
