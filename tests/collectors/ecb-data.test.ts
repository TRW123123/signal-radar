import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseEstCsv, buildObservations } from '../../src/collectors/ecb-data.ts';

// nach Doku nachgebaut (detail=dataonly)
const SAMPLE = `KEY,FREQ,REF_AREA,STAT_TYPE,TIME_PERIOD,OBS_VALUE
EST.B.EU000A2X2A25.VL,B,EU000A2X2A25,VL,2026-11-12,54.1
EST.B.EU000A2X2A25.VL,B,EU000A2X2A25,VL,2026-11-13,55.3
EST.B.EU000A2X2A25.R25,B,EU000A2X2A25,R25,2026-11-12,1.900
EST.B.EU000A2X2A25.R25,B,EU000A2X2A25,R25,2026-11-13,1.901
EST.B.EU000A2X2A25.R75,B,EU000A2X2A25,R75,2026-11-12,1.920
EST.B.EU000A2X2A25.R75,B,EU000A2X2A25,R75,2026-11-13,1.931
`;

test('Normalfall', () => {
  const o = buildObservations(parseEstCsv(SAMPLE));
  const sp = o.filter((x) => x.signalId.endsWith('spread'));
  assert.equal(sp.length, 2);
  assert.equal(sp[0].value, 2);
  assert.equal(sp[1].value, 3);
  assert.equal(o.filter((x) => x.signalId.endsWith('volume')).length, 2);
  assert.equal(sp[0].ts, '2026-11-12T00:00:00.000Z');
});
test('leere Antwort', () => {
  assert.equal(parseEstCsv('').size, 0);
  assert.throws(() => buildObservations(parseEstCsv('')), /fehlt/);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseEstCsv('KEY,OBS_VALUE\nx,1\n'), /Spalten/);
  const partial = SAMPLE.split('\n').filter((l) => !l.includes('.R75,')).join('\n');
  assert.throws(() => buildObservations(parseEstCsv(partial)), /R75/);
});
test('Collector deklariert Signale', () => assert.equal(collector.signals.length, 2));
