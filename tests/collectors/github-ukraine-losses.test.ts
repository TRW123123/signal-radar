import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyIncrease } from '../../src/collectors/github-ukraine-losses.ts';

// nach der echten Form der JSON-Dateien nachgebaut (kumulative Zähler je Tag)
const P = (date: string, personnel: number) => ({ date, day: 1, personnel, 'personnel*': 'about' });
const E = (date: string, drone: number, cm: number) => ({ date, day: 1, drone, 'cruise missiles': cm, tank: 1 });
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall: Tageszuwachs, heutiger Tag und Lücken entfallen', () => {
  const r = dailyIncrease([P('2026-11-13', 1000), P('2026-11-14', 1050), P('2026-11-15', 1120), P('2026-11-17', 1300)], ['personnel'], NOW);
  assert.deepEqual(r, [{ day: '2026-11-14', value: 50 }, { day: '2026-11-15', value: 70 }]);
});
test('Summe mehrerer Felder, Einträge ohne Feld ergeben keine Differenz', () => {
  const r = dailyIncrease([E('2026-11-14', 100, 10), { date: '2026-11-15', drone: 150 }, E('2026-11-16', 400, 20)], ['drone', 'cruise missiles'], NOW);
  assert.deepEqual(r, []);
  const r2 = dailyIncrease([E('2026-11-15', 100, 10), E('2026-11-16', 400, 20)], ['drone', 'cruise missiles'], NOW);
  assert.deepEqual(r2, [{ day: '2026-11-16', value: 310 }]);
});
test('leere Antwort', () => {
  assert.deepEqual(dailyIncrease([], ['personnel'], NOW), []);
  assert.throws(() => dailyIncrease({}, ['personnel'], NOW), /Liste/);
});
test('veralteter Datensatz und rückläufiger Zähler', () => {
  assert.throws(() => dailyIncrease([P('2026-11-01', 1), P('2026-11-02', 2)], ['personnel'], NOW), /veraltet/);
  assert.deepEqual(dailyIncrease([P('2026-11-14', 1100), P('2026-11-15', 1000), P('2026-11-16', 1090)], ['personnel'], NOW), [{ day: '2026-11-16', value: 90 }]);
});
