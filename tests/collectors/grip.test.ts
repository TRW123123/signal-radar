import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, hourUrl } from '../../src/collectors/grip.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const SAMPLE = { draw: 1, recordsTotal: 5000, recordsFiltered: 42, data: [{ id: 'moas-1' }] };

test('Normalfall', () => assert.equal(parseCount(SAMPLE), 42));
test('leere Antwort: 0 Ereignisse', () => assert.equal(parseCount({ recordsFiltered: 0, data: [] }), 0));
test('fehlendes Feld', () => {
  assert.throws(() => parseCount({ data: [] }), /recordsFiltered/);
  assert.throws(() => parseCount({ recordsFiltered: 'x' }), /recordsFiltered/);
});
test('URL', () => assert.match(hourUrl(3600), /ts_start=3600&ts_end=7200/));
