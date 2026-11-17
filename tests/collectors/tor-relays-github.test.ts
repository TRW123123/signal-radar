import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countIpv4, parseLastChecked } from '../../src/collectors/tor-relays-github.ts';

// nach der echten Form der Dateien nachgebaut
const LST = `2.26.122.108\n2.56.10.36\n5.2.67.226\n2001:db8::1\n2a0b:f4c2::3\n`;

test('Normalfall', () => {
  assert.equal(countIpv4(LST), 3);
  assert.equal(parseLastChecked('Tue Nov 17 05:00:21 IST 2026\n'), Date.UTC(2026, 10, 16, 23, 30, 21));
});
test('leere Antwort', () => {
  assert.throws(() => countIpv4(''), /Antworttext/);
  assert.throws(() => parseLastChecked(''), /Last-Checked-At/);
});
test('fehlendes Feld', () => {
  assert.throws(() => countIpv4('2001:db8::1\n'), /IPv4/);
  assert.throws(() => parseLastChecked('Tue Xyz 17 05:00:21 IST 2026'), /nicht lesbar/);
});
