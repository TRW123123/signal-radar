import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNas } from '../../src/collectors/faa-nas.ts';

// SAMPLE nach Doku nachgebaut (nicht gegen echte Antwort geprüft).
const SAMPLE = `<AIRPORT_STATUS_INFORMATION><Update_Time>Mon Nov 16 23:55:00 2026 GMT</Update_Time>
<Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List>
<Ground_Delay><ARPT>EWR</ARPT><Reason>weather</Reason></Ground_Delay><Ground_Delay><ARPT>SFO</ARPT></Ground_Delay></Ground_Delay_List></Delay_type>
<Delay_type><Name>Ground Stops</Name><Ground_Stop_List><Program><ARPT>JFK</ARPT></Program></Ground_Stop_List></Delay_type>
<Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>ABC</ARPT></Airport></Airport_Closure_List></Delay_type>
</AIRPORT_STATUS_INFORMATION>`;

test('Normalfall', () => assert.deepEqual(parseNas(SAMPLE), { groundStops: 1, groundDelays: 2, closures: 1, closuresListed: 1 }));
test('leere Listen zählen 0', () => {
  const x = '<AIRPORT_STATUS_INFORMATION><Update_Time>x</Update_Time><Delay_type><Ground_Stop_List></Ground_Stop_List></Delay_type></AIRPORT_STATUS_INFORMATION>';
  assert.deepEqual(parseNas(x), { groundStops: 0, groundDelays: 0, closures: 0, closuresListed: 0 });
});
test('fremde Antwort wirft', () => {
  assert.throws(() => parseNas('<html>Service unavailable</html>'), /FAA/);
  assert.throws(() => parseNas(''), /FAA/);
});

// Echter Ausschnitt (17.11.2026, gekürzt): Ground Stop LGA, Ground Delay SFO, Sperr-NOTAMs (nur Teilsperren)
const REAL = `<AIRPORT_STATUS_INFORMATION><Update_Time>Tue Nov 17 00:19:21 2026 GMT</Update_Time><Delay_type><Name>Ground Stop Programs</Name><Ground_Stop_List><Program><ARPT>LGA</ARPT><Reason>airport volume</Reason><End_Time>7:45 pm EST</End_Time></Program></Ground_Stop_List></Delay_type><Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List><Ground_Delay><ARPT>SFO</ARPT><Reason>low ceilings</Reason></Ground_Delay></Ground_Delay_List></Delay_type><Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>SNA</ARPT><Reason>!SNA 11/020 SNA AD AP CLSD DLY 0730-1415 2611150730-2611211415</Reason></Airport></Airport_Closure_List></Delay_type><Delay_type><Name>Airport Closures</Name><Airport_Closure_List><Airport><ARPT>LAX</ARPT><Reason>!LAX 05/277 LAX AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC 24HR PPR CTC</Reason></Airport><Airport><ARPT>SAN</ARPT><Reason>!SAN 10/004 SAN AD AP CLSD TO NON SKED TRANSIENT GA ACFT EXC PPR</Reason></Airport></Airport_Closure_List></Delay_type></AIRPORT_STATUS_INFORMATION>`;
test('echte Antwort: Teilsperr-NOTAMs zählen nicht als Schließung, Vollsperrung schon', () => {
  assert.deepEqual(parseNas(REAL), { groundStops: 1, groundDelays: 1, closures: 0, closuresListed: 3 });
  const full = REAL.replace('</AIRPORT_STATUS_INFORMATION>', '<Airport_Closure_List><Airport><ARPT>XYZ</ARPT><Reason>!XYZ 11/001 XYZ AD AP CLSD</Reason></Airport></Airport_Closure_List></AIRPORT_STATUS_INFORMATION>');
  assert.equal(parseNas(full).closures, 1);
});
