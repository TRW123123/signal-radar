import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStorage } from '../../src/collectors/github-gas-storage.ts';

// gekürzter echter Ausschnitt aus data/gie_storage.csv (Stand 17.11.2026); Zeilen DE zuerst, dann EU
const HEAD = 'scope,date,name,code,gas_in_storage_twh,working_gas_volume_twh,fill_pct,consumption_gwh_per_day,injection_gwh_per_day,withdrawal_gwh_per_day,net_withdrawal_gwh_per_day,injection_capacity_gwh_per_day,withdrawal_capacity_gwh_per_day,trend_pct,status,full_pct,norm_5y_fill_pct,source\n';
const CSV = HEAD
  + 'DE,2020-04-19,Germany,DE,185.8235,245.0576,75.83,871,991.75,2.5,-989.3,3897.58,6622.41,0.41,E,75.83,,GIE AGSI+ API v013\n'
  + 'DE,2026-11-10,Germany,DE,143.591,247.3563,58.05,903.9,53.15,1157.3,1104.2,4293.73,7068.47,-0.45,C,58.05,88.458,GIE AGSI+ API v013\n'
  + 'DE,2026-11-11,Germany,DE,142.6679,247.3563,57.68,903.9,43.82,975.5,931.7,4293.73,7068.47,-0.37,C,57.68,88.368,GIE AGSI+ API v013\n'
  + 'DE,2026-11-12,Germany,DE,142.4102,247.3563,57.57,903.9,102.51,358.8,256.3,4293.73,7068.47,-0.1,E,57.57,88.264,GIE AGSI+ API v013\n'
  + 'EU,2026-11-11,EU,eu,806.6938,1132.3616,71.24,3519,292.83,4220,3927.2,12181.76,20179.75,-0.35,C,71.24,88.99,GIE AGSI+ API v013\n'
  + 'EU,2026-11-12,EU,eu,803.965,1132.3616,71,3519,482.55,3195.4,2712.8,12182.16,20179.01,-0.24,E,71,88.834,GIE AGSI+ API v013\n'
  + 'EU,2026-11-13,EU,eu,801.2416,1132.3616,70.76,3519,323.67,3073.1,2749.5,12182.07,20179,-0.24,E,70.76,88.684,GIE AGSI+ API v013\n'
  + 'EU,2026-11-14,EU,eu,799,1132.3616,70.6,3519,300,3000,2700,12182,20179,-0.2,E,70.6,88.6,GIE AGSI+ API v013\n';
const NOW = new Date('2026-11-17T00:16:00Z');

test('Normalfall: nur bestätigte Tage im 90-Tage-Fenster, getrennt nach Gebiet', () => {
  const r = parseStorage(CSV, NOW);
  assert.deepEqual(r.de, [{ day: '2026-11-10', fillPct: 58.05, netWithdrawal: 1104.2 }, { day: '2026-11-11', fillPct: 57.68, netWithdrawal: 931.7 }]);
  // EU: auch E-Zeilen, nur die letzten 2 Tage der Reihe fehlen
  assert.deepEqual(r.eu.map((d) => d.day), ['2026-11-11', '2026-11-12']);
  assert.equal(r.eu[0].fillPct, 71.24);
  assert.equal(r.lastConfirmedDay, '2026-11-11');
});
test('leere Antwort', () => {
  assert.throws(() => parseStorage('', NOW), /Antworttext/);
  const r = parseStorage(HEAD, NOW);
  assert.deepEqual(r, { de: [], eu: [], lastConfirmedDay: null });
});
test('fehlendes Feld und veraltete Reihe', () => {
  assert.throws(() => parseStorage('scope,date\nDE,2026-11-11\n', NOW), /Spalten/);
  assert.throws(() => parseStorage(CSV, new Date('2026-12-20T00:00:00Z')), /veraltet/);
});
