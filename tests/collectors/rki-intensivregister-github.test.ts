import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseIcu } from '../../src/collectors/rki-intensivregister-github.ts';

// gekürzter echter Ausschnitt aus Intensivregister_Deutschland_Kapazitaeten.csv (Abruf 24.11.2026, Spalten gekürzt auf die genutzten plus Füllspalten)
const H = 'datum,bundesland_id,bundesland_name,behandlungsgruppe,behandlungsgruppe_level_2,anzahl_meldebereiche,faelle_covid_aktuell,faelle_covid_erstaufnahmen,intensivbetten_belegt,intensivbetten_frei,intensivbetten_7_tage_notfallreserve,kapazitaeten_frei_invasive_beatmung_gesamt\n';
const BODY =
  '2026-11-22,00,Deutschland,Kinder,PICU,106,2,0,293,188,103,151\n' +
  '2026-11-23,00,Deutschland,Erwachsene,ERWACHSENE,731,58,NA,10126,1976,4279,1949\n' +
  '2026-11-23,00,Deutschland,Kinder,NICU,134,2,NA,775,561,116,411\n' +
  '2026-11-23,00,Deutschland,Kinder,PICU,106,2,NA,288,195,102,163\n';
const FULL = '2026-11-21,00,Deutschland,Erwachsene,ERWACHSENE,731,57,NA,10100,2000,4279,1900\n2026-11-21,00,Deutschland,Kinder,NICU,134,2,NA,770,560,116,400\n2026-11-21,00,Deutschland,Kinder,PICU,106,1,NA,280,200,102,160\n';

test('Normalfall: PICU-Auslastung, Summe der Corona-Patienten und freien Beatmungsplätze über alle Gruppen', () => {
  const r = parseIcu(H + FULL + BODY);
  assert.deepEqual(r.days.map((d) => d.day), ['2026-11-21', '2026-11-23']); // 22.11. hat nur eine Gruppe und entfällt
  const d = r.days[1];
  assert.equal(d.picuPct, 59.6); // 288 / (288 + 195)
  assert.equal(d.covid, 62);
  assert.equal(d.freeVent, 2523);
  assert.equal(r.lastDay, '2026-11-23');
});
test('Range-Abruf: angeschnittene Zeile und frühester Tag entfallen', () => {
  const r = parseIcu('rest der Zeile,1\n' + FULL + BODY, { partial: true });
  assert.deepEqual(r.days.map((d) => d.day), ['2026-11-23']);
});
test('NA in einer Gruppe ergibt keinen Summenwert', () => {
  const r = parseIcu(H + BODY.replace('ERWACHSENE,731,58', 'ERWACHSENE,731,NA'));
  assert.equal(r.days[0].covid, null);
  assert.equal(r.days[0].picuPct, 59.6);
});
test('leere Antwort und fehlende Spalten', () => {
  assert.throws(() => parseIcu(''), /Antworttext/);
  assert.throws(() => parseIcu('datum,x\n2026-11-23,1\n'), /Spalten/);
});
test('Deklaration: Tagesreihen mit Katalog-Gewicht, geo Deutschland', () => {
  assert.deepEqual(collector.signals.map((s) => [s.id, s.weight, s.direction]), [
    ['bio.clinical.icu_picu', 0.55, 'up'], ['bio.clinical.icu_covid_current', 0.5, 'up'], ['bio.clinical.icu_free_vent', 0.5, 'down'],
  ]);
  assert.ok(collector.signals.every((s) => s.geo?.cc === 'DE' && s.intervalMinutes === 1440));
});
