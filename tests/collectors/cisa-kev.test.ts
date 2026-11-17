import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKev, additionsPerDay, additionsRolling7, ransomwareShare } from '../../src/collectors/cisa-kev.ts';

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

test('gleitende 7-Tage-Summe', () => {
  const o = additionsRolling7(parseKev(SAMPLE), now, 3);
  assert.deepEqual(o.map((v) => [v.ts.slice(0, 10), v.value]), [['2026-11-14', 2], ['2026-11-15', 2], ['2026-11-16', 4]]);
});
// gekürzter echter Ausschnitt (17.11.2026), Felder wie im echten Katalog
const REAL = { title: 'CISA Catalog of Known Exploited Vulnerabilities', catalogVersion: '2026.11.13', count: 1781, vulnerabilities: [
  { cveID: 'CVE-2026-114713', vendorProject: 'UnrealIRCd', product: 'UnrealIRCd', dateAdded: '2026-11-13', knownRansomwareCampaignUse: 'Unknown' },
] };
test('echter Ausschnitt', () => {
  assert.deepEqual(parseKev(REAL), [{ cve: 'CVE-2026-114713', day: '2026-11-13', ransomware: false }]);
});
