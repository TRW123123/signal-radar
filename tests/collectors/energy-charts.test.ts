import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrequency, parseRenewables } from '../../src/collectors/energy-charts.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
const H0 = Date.UTC(2026, 10, 16, 21) / 1000;
const unix = Array.from({ length: 120 }, (_, i) => H0 + i * 60); // 2 Stunden, Minutenraster
const data = unix.map((_, i) => (i === 10 ? 50.05 : 50.0 + (i % 2 ? 0.01 : -0.01)));
const before = (H0 + 7200) * 1000;

test('Frequenz: max. Abweichung und Std je Stunde', () => {
  const r = parseFrequency({ unix_seconds: unix, data }, before);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0].maxDevMHz - 50) < 1e-6);
  assert.ok(r[0].stdMHz > 5);
  assert.ok(r[1].maxDevMHz <= 10.0001);
});
test('Frequenz: laufende Stunde und leere Antwort', () => {
  assert.equal(parseFrequency({ unix_seconds: unix, data }, (H0 + 3600) * 1000).length, 1);
  assert.deepEqual(parseFrequency({ unix_seconds: [], data: [] }, before), []);
});
test('Frequenz: fehlendes Feld wirft', () => {
  assert.throws(() => parseFrequency({ unix_seconds: unix }, before), /fehlt/);
});

const q = Array.from({ length: 8 }, (_, i) => H0 + i * 900);
const mk = (name: string, v: (number | null)[]) => ({ name, data: v });
test('Einspeisung: Summe der Mittel, unvollständige Stunde entfällt', () => {
  const body = { unix_seconds: q, production_types: [
    mk('Solar', [100, 100, 100, 100, 50, 50, 50, null]), mk('Wind onshore', Array(8).fill(1000)), mk('Wind offshore', Array(8).fill(200)),
  ] };
  const r = parseRenewables(body, (H0 + 7200) * 1000);
  assert.equal(r.length, 1);
  assert.equal(r[0].mw, 1300);
});
test('Einspeisung: leer und fehlende Reihe', () => {
  assert.deepEqual(parseRenewables({ unix_seconds: [], production_types: [mk('Solar', []), mk('Wind onshore', []), mk('Wind offshore', [])] }, before), []);
  assert.throws(() => parseRenewables({ unix_seconds: q, production_types: [mk('Solar', [])] }, before), /fehlt/);
  assert.throws(() => parseRenewables({ unix_seconds: q }, before), /production_types/);
});

// Echter Ausschnitt (public_power vom 17.11.2026, Solar/Wind in MW, 15-Minuten-Raster, ein Stundenpaket gekürzt auf 4 Werte)
const REAL_PP = { unix_seconds: [1794783600, 1794784500, 1794785400, 1794786300], production_types: [
  { name: 'Wind offshore', data: [4864.5, 5309.5, 5300.0, 5290.0] },
  { name: 'Wind onshore', data: [29896.2, 29979.1, 29900.0, 29800.0] },
  { name: 'Solar', data: [0.0, 0.0, 0.0, 0.0] },
] };
test('Einspeisung echter Ausschnitt: Summe Wind + Solar rund 35 GW', () => {
  const r = parseRenewables(REAL_PP, (1794783600 + 3600) * 1000);
  assert.equal(r.length, 1);
  assert.ok(r[0].mw > 34000 && r[0].mw < 36000);
});
test('Frequenz: 15-Minuten-Fenster in Sekundenauflösung ergibt Wert für die Stunde', () => {
  const t0 = Date.UTC(2026, 10, 16, 23, 45) / 1000;
  const u = Array.from({ length: 900 }, (_, i) => t0 + i);
  const d = u.map((_, i) => (i === 100 ? 49.97 : 50.0));
  const r = parseFrequency({ unix_seconds: u, data: d }, Date.UTC(2026, 10, 17, 0) , 15 * 60_000);
  assert.equal(r.length, 1);
  assert.equal(new Date(r[0].hour).toISOString(), '2026-11-16T23:00:00.000Z');
  assert.ok(Math.abs(r[0].maxDevMHz - 30) < 1e-6);
  // ohne Fenster-Angabe gilt eine ganze Stunde als erwartet: 900 Werte reichen dann nicht
  assert.equal(parseFrequency({ unix_seconds: u, data: d }, Date.UTC(2026, 10, 17, 0)).length, 0);
});
