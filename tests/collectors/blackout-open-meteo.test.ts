import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { buildUrl, parseColdDaily, SIG_COLD } from '../../src/collectors/blackout-open-meteo.ts';

// nach Doku nachgebaut (Open-Meteo, mehrere Orte = Array von Objekten)
const loc = (t: (number | null)[]) => ({ latitude: 52.5, daily: { time: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'], temperature_2m_min: t } });
const SAMPLE = [loc([1, 2, 3, 9]), loc([3, 4, 5, 9]), loc([2, 3, 4, 9])];
const BEFORE = Date.UTC(2026, 10, 17);

test('Mittel der Tagesminima, heutiger Tag fehlt', () => {
  assert.deepEqual(parseColdDaily(SAMPLE, BEFORE), [{ day: '2026-11-14', celsius: 2 }, { day: '2026-11-15', celsius: 3 }, { day: '2026-11-16', celsius: 4 }]);
});
test('null bei einem Ort: Tag fehlt; falsche Ortszahl und fehlendes Feld werfen', () => {
  assert.equal(parseColdDaily([loc([null, 2, 3, 9]), loc([1, 2, 3, 9]), loc([1, 2, 3, 9])], BEFORE).length, 2);
  assert.throws(() => parseColdDaily([loc([1, 2, 3, 9])], BEFORE), /Orte/);
  assert.throws(() => parseColdDaily([{}, {}, {}], BEFORE), /daily\.time/);
});
test('URL und Collector', async () => {
  assert.match(buildUrl(), /past_days=30&forecast_days=1$/);
  const http = { json: async () => SAMPLE, text: async () => '' } as never;
  const r = await collector.collect({ now: new Date('2026-11-17T00:16:00Z'), http, key: () => undefined, log: () => {} });
  assert.equal(r.observations.length, 3);
  assert.equal(r.observations[0].signalId, SIG_COLD);
  assert.deepEqual(collector.signals[0].scenarios, ['blackout']);
});
