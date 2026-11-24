import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseAmelag } from '../../src/collectors/rki-amelag-github.ts';
import { isoWeekOf, isoWeekThursday, parseKw, seasonalRatios } from '../../src/collectors/_rki-weekly.ts';

// gekürzter echter Ausschnitt aus amelag_aggregierte_kurve.tsv (Abruf 24.11.2026)
const H = 'datum\tn\tanteil_bev\tviruslast\tviruslast_normalisiert\tvorhersage\tobere_schranke\tuntere_schranke\ttyp\n';
const TSV = H +
  '2023-11-29\t28\t0.0313\t1549.03\t2106.82\t1443.72\t2048.84\t1017.33\tInfluenza A\n' +
  '2026-11-04\t63\t0.2425\t56325.66\t44054.99\t60547.55\t69639.80\t52642.39\tSARS-CoV-2\n' +
  '2026-11-11\t59\t0.2309\t82966.81\t78230.13\t76282.18\t93902.54\t61968.20\tSARS-CoV-2\n' +
  '2026-11-11\t58\t0.2226\t2898.67\t2898.67\t2000\t2500\t1500\tInfluenza A\n' +
  '2026-11-11\t55\t0.1767\t1637.94\t1637.94\t1500\t1800\t1200\tInfluenza B\n' +
  '2026-11-11\t21\t0.0482\t1572.85\t1285.84\t1804.25\t2233.77\t1457.32\tRSV A/B\n' +
  '2026-11-11\t33\t0.1125\t1350.64\t1350.64\t1300\t1500\t1100\tRSV A\n';

test('Normalfall: je Erreger die Wochenwerte, RSV A/B getrennt von RSV A, Abdeckung in Prozent', () => {
  const r = parseAmelag(TSV);
  assert.deepEqual(r.series.get('bio.wastewater.amelag_sars2')!.map((p) => p.value), [44055, 78230.1]);
  assert.equal(r.series.get('bio.wastewater.amelag_flu')!.length, 2);
  assert.equal(r.series.get('bio.wastewater.amelag_flub')![0].value, 1637.9);
  assert.equal(r.series.get('bio.wastewater.amelag_rsv')![0].value, 1285.8);
  assert.deepEqual(r.coverage.map((p) => p.value), [24.3, 23.1]);
  assert.equal(r.lastDate, '2026-11-11');
});
test('leere Antwort und fehlende Spalten', () => {
  assert.throws(() => parseAmelag(''), /Antworttext/);
  assert.throws(() => parseAmelag('a\tb\n1\t2\n'), /Spalten/);
});
test('Zeilen mit fehlendem Wert oder Datum werden übersprungen', () => {
  const r = parseAmelag(H + '2026-11-11\t59\t0.23\t1\t\t1\t1\t1\tSARS-CoV-2\nkein-datum\t1\t1\t1\t5\t1\t1\t1\tSARS-CoV-2\n');
  assert.equal(r.series.get('bio.wastewater.amelag_sars2')!.length, 0);
});
test('ISO-Woche und Saisonverhältnis (mindestens 2 Vorjahre, Pandemiejahre ausgelassen)', () => {
  assert.deepEqual(parseKw('2026-W46'), { year: 2026, week: 46 });
  assert.equal(parseKw('2026/27'), null);
  assert.equal(isoWeekThursday(2026, 46).toISOString(), '2026-11-12T00:00:00.000Z');
  assert.deepEqual(isoWeekOf(new Date('2026-11-11T00:00:00Z')), { year: 2026, week: 46 });
  assert.deepEqual(isoWeekOf(new Date('2021-01-03T00:00:00Z')), { year: 2020, week: 53 });
  const mk = (year: number, value: number) => ({ year, week: 10, ts: isoWeekThursday(year, 10), value });
  const ratios = seasonalRatios([mk(2020, 1000), mk(2022, 10), mk(2023, 30), mk(2024, 40), mk(2025, 80)]);
  assert.equal(ratios.get(mk(2025, 0).ts.getTime()), 3); // Mittel 2022 bis 2024 (10+30+40)/3 = 26,67; 2020 zählt nicht
  assert.equal(ratios.has(mk(2023, 0).ts.getTime()), false); // nur 1 zulässiges Vorjahr (2022)
});
test('Deklaration: Rohreihe Gewicht 0,2, Verhältnis mit Katalog-Gewicht, geo Deutschland', () => {
  const sars = collector.signals.find((s) => s.id === 'bio.wastewater.amelag_sars2')!;
  const ratio = collector.signals.find((s) => s.id === 'bio.wastewater.amelag_sars2_saison')!;
  assert.equal(sars.weight, 0.2);
  assert.equal(ratio.weight, 0.7);
  assert.equal(ratio.unit, 'x Vorjahresmittel');
  assert.equal(sars.geo?.cc, 'DE');
  assert.equal(sars.maxAgeHours, 360);
});
