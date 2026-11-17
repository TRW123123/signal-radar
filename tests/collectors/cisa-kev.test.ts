import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKev, additionsPerDay, ransomwareShare } from '../../src/collectors/cisa-kev.ts';

// nach Doku nachgebaut (kev-data Schema)
const SAMPLE = { title: 'CISA KEV', count: 5, vulnerabilities: [
  { cveID: 'CVE-1', dateAdded: '2026-11-16', knownRansomwareCampaignUse: 'Known' },
  { cveID: 'CVE-2', dateAdded: '2026-11-16', knownRansomwareCampaignUse: 'Unknown' },
  { cveID: 'CVE-3', dateAdded: '2026-11-14', knownRansomwareCampaignUse: 'Unknown' },
  { cveID: 'CVE-4', dateAdded: '2026-11-13' },
  { cveID: 'CVE-5', dateAdded: '2026-11-17', knownRansomwareCampaignUse: 'Known' },
  { cveID: 'CVE-6' },
] };
const now = new Date('2026-11-17T00:00:00Z');

test('Normalfall: Zählung pro Tag, heutiger Tag fehlt', () => {
  const e = parseKev(SAMPLE);
  assert.equal(e.length, 5);
  const o = additionsPerDay(e, now, 5);
  assert.equal(o.length, 5);
  assert.equal(o.find((x) => x.ts === '2026-11-16T00:00:00.000Z')!.value, 2);
  assert.equal(o.find((x) => x.ts === '2026-11-15T00:00:00.000Z')!.value, 0);
  assert.ok(!o.some((x) => x.ts.startsWith('2026-11-17')));
});
test('Ransomware-Anteil', () => {
  const o = ransomwareShare(parseKev(SAMPLE), now, { days: 1, window: 28, minN: 4 });
  assert.equal(o.length, 1);
  assert.equal(o[0].value, 25); // 1 von 4 (CVE-5 von heute zählt nicht)
  assert.deepEqual(ransomwareShare(parseKev(SAMPLE), now, { days: 1, window: 28, minN: 10 }), []);
});
test('leere Liste', () => {
  assert.deepEqual(parseKev({ vulnerabilities: [] }), []);
});
test('fehlendes Feld wirft', () => {
  assert.throws(() => parseKev({}), /vulnerabilities/);
});
