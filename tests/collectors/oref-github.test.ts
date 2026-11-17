import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOref } from '../../src/collectors/oref-github.ts';

// nach der echten Form von israel-alerts.csv nachgebaut (Kopf, Mehrfach-Ortschaften, Kategorien 1/2/10/13)
const HEAD = 'data,date,time,alertDate,category,category_desc,matrix_id,rid\n';
const CSV = HEAD +
  'נתיב העשרה,10.11.2026,06:10:06,2026-11-10T06:10:00,2,חדירת כלי טיס עוין,6,1\n' +
  'זרעית,10.11.2026,06:22:50,2026-11-10T06:23:00,13,האירוע הסתיים,10,2\n' +
  '"באר שבע 288, אשקלון 256",12.11.2026,18:53:20,2026-11-12T18:53:00,1,ירי רקטות וטילים,1,3\n' +
  'ניר עוז,12.11.2026,18:53:30,2026-11-12T18:53:00,1,ירי רקטות וטילים,1,4\n' +
  'ניר עוז,12.11.2026,19:10:00,2026-11-12T19:10:00,10,בדקות הקרובות,10,5\n' +
  'ניר עוז,14.11.2026,01:00:00,2026-11-14T01:00:00,1,ירי רקטות וטילים,1,6\n';
const NOW = new Date('2026-11-16T00:16:00Z');

test('Normalfall: Wellen und Ortschaften je Tag, Lücken = 0, Vorwarnung/Entwarnung zählen nicht', () => {
  const r = parseOref(CSV, NOW);
  assert.deepEqual(r.days.map((d) => [d.day, d.waves, d.localities]), [
    ['2026-11-10', 1, 1], ['2026-11-11', 0, 0], ['2026-11-12', 1, 3], ['2026-11-13', 0, 0], ['2026-11-14', 1, 1], ['2026-11-15', 0, 0],
  ]);
  assert.equal(r.lastAlertDay, '2026-11-14');
});
test('Range-Abruf: angeschnittene erste Zeile und erster Tag entfallen', () => {
  const cut = 'rest of cut line",1,2\n' + CSV.split('\n').slice(1).join('\n');
  const r = parseOref(cut, NOW, { partial: true });
  assert.equal(r.days[0].day, '2026-11-11'); // 10.11. ist der angeschnittene Starttag
  assert.equal(r.days.find((d) => d.day === '2026-11-12')?.waves, 1);
});
test('leere Antwort', () => {
  assert.throws(() => parseOref('', NOW), /Antworttext/);
  assert.deepEqual(parseOref(HEAD, NOW).days, []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseOref('data,date,time\nx,1,2\n', NOW), /Spalten/);
  assert.deepEqual(parseOref(HEAD + 'a,b,c,kaputt,1,x,1,1\n', NOW).days, []);
});
