import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseSari } from '../../src/collectors/rki-sari-github.ts';

// gekürzter echter Ausschnitt aus SARI-Hospitalisierungsinzidenz.tsv (Abruf 24.11.2026)
const H = 'Saison\tKalenderwoche\tAltersgruppe\tSARI\tHospitalisierungsinzidenz\n';
const BODY =
  '2026/27\t2026-W46\t0-4\tGesamt\t18.8\n2026/27\t2026-W46\t00+\tGesamt\t8.6\n2026/27\t2026-W46\t00+\tCOVID-19\t0.4\n' +
  '2026/27\t2026-W46\t00+\tInfluenza\t0.6\n2026/27\t2026-W46\t00+\tRSV\t0.0\n' +
  '2026/27\t2026-W45\t0-4\tGesamt\t22.6\n2026/27\t2026-W45\t00+\tGesamt\t8.9\n2026/27\t2026-W45\t00+\tCOVID-19\t0.3\n' +
  '2026/27\t2026-W45\t00+\tInfluenza\t0.5\n2026/27\t2026-W45\t00+\tRSV\t0.0\n';

test('Normalfall: Gesamt 00+ und 0-4, Rest-Anteil in Prozent', () => {
  const r = parseSari(H + BODY);
  assert.deepEqual(r.total.map((p) => p.value), [8.6, 8.9]);
  assert.deepEqual(r.kids.map((p) => p.value), [18.8, 22.6]);
  assert.deepEqual(r.unexplained.map((p) => [p.week, p.value]).sort(), [[45, 91], [46, 88.4]]);
  assert.equal(r.lastWeek, '2026-W46');
});
test('Woche ohne alle vier Angaben ergibt keinen Rest-Anteil', () => {
  const r = parseSari(H + '2024/25\t2024-W40\t00+\tGesamt\t14.1\n2024/25\t2024-W40\t00+\tCOVID-19\t1.0\n');
  assert.equal(r.total.length, 1);
  assert.equal(r.unexplained.length, 0);
});
test('leere Antwort und fehlende Spalten', () => {
  assert.throws(() => parseSari(''), /Antworttext/);
  assert.throws(() => parseSari('a\tb\n1\t2\n'), /Spalten/);
});
test('Deklaration: Rohreihen 0,2, Verhältnisse mit Katalog-Gewicht', () => {
  const w = Object.fromEntries(collector.signals.map((s) => [s.id, s.weight]));
  assert.deepEqual(w, {
    'bio.clinical.sari_total': 0.2, 'bio.clinical.sari_total_saison': 0.7, 'bio.clinical.sari_kids': 0.2, 'bio.clinical.sari_kids_saison': 0.5,
    'bio.clinical.sari_unexplained': 0.2, 'bio.clinical.sari_unexplained_saison': 0.85,
  });
  assert.ok(collector.signals.every((s) => s.geo?.cc === 'DE' && s.maxAgeHours === 360));
});
