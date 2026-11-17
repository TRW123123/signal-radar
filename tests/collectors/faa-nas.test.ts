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

test('Normalfall', () => assert.deepEqual(parseNas(SAMPLE), { groundStops: 1, groundDelays: 2, closures: 1 }));
test('leere Listen zählen 0', () => {
  const x = '<AIRPORT_STATUS_INFORMATION><Update_Time>x</Update_Time><Delay_type><Ground_Stop_List></Ground_Stop_List></Delay_type></AIRPORT_STATUS_INFORMATION>';
  assert.deepEqual(parseNas(x), { groundStops: 0, groundDelays: 0, closures: 0 });
});
test('fremde Antwort wirft', () => {
  assert.throws(() => parseNas('<html>Service unavailable</html>'), /FAA/);
  assert.throws(() => parseNas(''), /FAA/);
});
