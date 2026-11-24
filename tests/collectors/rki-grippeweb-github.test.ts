import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseGrippeWeb } from '../../src/collectors/rki-grippeweb-github.ts';

// gekürzter echter Ausschnitt aus GrippeWeb_Daten_des_Wochenberichts.tsv (Abruf 24.11.2026)
const H = 'Meldungen\tSaison\tErkrankung\tAltersgruppe\tRegion\tKalenderwoche\tInzidenz\n';
const BODY =
  '11636\t2026/27\tARE\t00+\tBundesweit\t2026-W45\t6492\n' +
  '11636\t2026/27\tILI\t00+\tBundesweit\t2026-W45\t990\n' +
  '346\t2026/27\tILI\t0-4\tBundesweit\t2026-W45\t4758\n' +
  '2000\t2026/27\tILI\t00+\tOsten\t2026-W46\t900\n' +
  '9226\t2026/27\tILI\t00+\tBundesweit\t2026-W46\t983\n';

test('Normalfall: nur ILI, Bundesweit, 00+', () => {
  const r = parseGrippeWeb(H + BODY);
  assert.deepEqual(r.ili.map((p) => [p.ts.toISOString().slice(0, 10), p.value]), [['2026-11-05', 990], ['2026-11-12', 983]]);
  assert.equal(r.lastWeek, '2026-W46');
});
test('Range-Abruf: angeschnittene Zeile und früheste Woche entfallen', () => {
  const r = parseGrippeWeb('angeschnitten\t1\n' + BODY, { partial: true });
  assert.deepEqual(r.ili.map((p) => p.week), [46]);
});
test('leere Antwort und fehlende Spalten', () => {
  assert.throws(() => parseGrippeWeb(''), /Antworttext/);
  assert.throws(() => parseGrippeWeb('Meldungen\tSaison\n1\t2\n'), /Spalten/);
});
test('Deklaration', () => {
  const [raw, ratio] = collector.signals;
  assert.equal(raw.id, 'bio.attention.grippeweb_ili');
  assert.equal(raw.weight, 0.2);
  assert.equal(ratio.weight, 0.5);
  assert.equal(ratio.unit, 'x Vorjahresmittel');
  assert.equal(raw.geo?.cc, 'DE');
});
