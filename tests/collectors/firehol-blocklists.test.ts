import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeader } from '../../src/collectors/firehol-blocklists.ts';

// nach der echten Kopfzeilen-Form der FireHOL-Listen nachgebaut
const HEAD = `#
# blocklist_de
#
# Source File Date: Mon Nov 16 08:18:02 UTC 2026
# Category        : attacks
# This File Date  : Mon Nov 16 08:28:09 UTC 2026
# Update Frequency: 15 mins 
# Entries         : 21658 unique IPs
#
1.1.220.166
`;

test('Normalfall', () => {
  assert.deepEqual(parseHeader(HEAD), { entries: 21658, fileDate: Date.UTC(2026, 10, 16, 8, 28, 9) });
  assert.equal(parseHeader(HEAD.replace('21658 unique IPs', '13781 subnets, 31638 unique IPs')).entries, 31638);
});
test('leere Antwort', () => {
  assert.throws(() => parseHeader(''), /Antworttext/);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseHeader(HEAD.replace(/# Entries.*\n/, '')), /Entries/);
  assert.throws(() => parseHeader(HEAD.replace(/# This File Date.*\n/, '')), /This File Date/);
  assert.throws(() => parseHeader(HEAD.replace('Date  : Mon Nov', 'Date  : Mon Xyz')), /nicht lesbar/);
});
