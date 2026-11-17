import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, hourUrl } from '../../src/collectors/grip.ts';

// gekürzter echter Ausschnitt (17.11.2026): ein Ereignis in data, recordsFiltered trotzdem 0, recordsTotal 1
const REAL = {
  data: [{ event_type: 'moas', id: 'moas-1794854400-219084_401152', summary: { attackers: ['401152'], victims: ['219084'], prefixes: ['179.253.171.0/24'] }, view_ts: 1794854400 }],
  draw: null, recordsFiltered: 0, recordsTotal: 1,
};
const EMPTY = { data: [], draw: null, recordsFiltered: 0, recordsTotal: 0 };

test('echte Antwort: recordsTotal zählt', () => assert.equal(parseCount(REAL), 1));
test('leere Antwort: 0 Ereignisse', () => assert.equal(parseCount(EMPTY), 0));
test('fehlendes Feld', () => {
  assert.throws(() => parseCount({ data: [] }), /recordsTotal/);
  assert.throws(() => parseCount({ recordsTotal: 'x' }), /recordsTotal/);
});
test('URL', () => assert.match(hourUrl(3600), /ts_start=3600&ts_end=7200/));
