import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColumn } from '../../src/collectors/tor-metrics.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const USERS = `# Estimated users
# Last updated
date,country,users,lower,upper,frac
2026-11-10,de,25000,,,95
2026-11-11,de,26000,,,96
2026-11-12,de,,,,
2026-11-13,fr,1,,,
`;
const BW = `date,advbw,bwhist
2026-11-10,900000000,500000000
2026-11-11,910000000,
`;

test('Normalfall', () => {
  const r = parseColumn(USERS, 'users', { column: 'country', equals: 'de' });
  assert.deepEqual(r, [{ day: '2026-11-10', value: 25000 }, { day: '2026-11-11', value: 26000 }]);
  assert.equal(parseColumn(BW, 'advbw').length, 2);
});
test('leere Antwort', () => {
  assert.deepEqual(parseColumn('', 'users'), []);
  assert.deepEqual(parseColumn('# nur Kommentar\n', 'users'), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseColumn(BW, 'users'), /users/);
  assert.throws(() => parseColumn(BW, 'advbw', { column: 'country', equals: 'de' }), /country/);
});
