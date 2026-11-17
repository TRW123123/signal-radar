import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIpsum } from '../../src/collectors/ipsum.ts';

// nach der echten Form von ipsum.txt nachgebaut (gekürzt)
const SAMPLE = `# IPsum Threat Intelligence Feed
# (https://github.com/stamparm/ipsum)
#
# Last update: Mon, 16 Nov 2026 03:00:42 +0100
#
# IP\tnumber of (black)lists
#
77.239.124.252\t11
45.148.10.5\t5
66.132.195.49\t3
1.2.3.4\t2
5.6.7.8\t1
`;

test('Normalfall', () => {
  assert.deepEqual(parseIpsum(SAMPLE), { ts: Date.UTC(2026, 10, 16, 2, 0, 42), ge3: 3, ge5: 2, total: 5 });
});
test('leere Antwort', () => {
  assert.throws(() => parseIpsum(''), /Antworttext/);
  assert.throws(() => parseIpsum('# Last update: Mon, 16 Nov 2026 03:00:42 +0100\n#\n'), /Datenzeilen/);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseIpsum(SAMPLE.replace(/# Last update.*\n/, '')), /Last update/);
  assert.throws(() => parseIpsum(SAMPLE.replace('Mon, 16 Nov 2026', 'Mon, 16 Xyz 2026')), /nicht lesbar/);
});
