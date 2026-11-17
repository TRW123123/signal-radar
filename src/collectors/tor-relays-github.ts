// Tor-Ausgangsknoten (IPv4) aus dem GitHub-Spiegel SecOps-Institute/Tor-IP-Addresses (stündlich vom Bot "mirabot" aktualisiert).
// Quelle: https://github.com/SecOps-Institute/Tor-IP-Addresses (tor-exit-nodes.lst, Last-Checked-At). Daten stammen von dan.me.uk
//   bzw. als Rückfall vom Tor Project (TorBulkExitList, nur IPv4).
// Lizenz: MIT für das Repo (laut README), Relay-Daten sind öffentliche Tor-Netz-Informationen. Kein Key.
// Aufbau: `tor-exit-nodes.lst` eine IP je Zeile, IPv4 vor IPv6, ohne Kommentare; `Last-Checked-At` eine Zeile im Format
//   "Tue Nov 17 05:00:21 IST 2026", laut README indische Zeit (UTC+05:30). Passt zur Stundenrhythmik des Bots (geprüft 17.11.2026).
// Gemessen: Zahl der IPv4-Ausgangsknoten. IPv6 wird nicht gezählt, weil der Rückfall nur IPv4 liefert (sonst künstliche Sprünge).
//   Zeitstempel = Last-Checked-At in UTC. Liegt der Zeitstempel mehr als 6 Stunden zurück oder in der Zukunft, wird nichts gemeldet
//   (Bot hält Updates zurück oder ist ausgefallen); das Repo prüft selbst auf Einbrüche über 50 Prozent und behält dann die alte Liste.
// Harmlose Ursachen: Wechsel der Datenquelle (dan.me.uk gegen Tor Project: Zahl springt um einige Prozent), Relay-Fluktuation,
//   Ausfall des Bots (Wert fehlt).
// VERIFIED: ja (17.11.2026)

import type { Collector } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const BASE = 'https://raw.githubusercontent.com/SecOps-Institute/Tor-IP-Addresses/master/';
const SIG = 'cyber.outages.tor_exit_nodes';
const HOUR = 3600_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 5.5 * HOUR;

/** Zählt IPv4-Zeilen. Wirft, wenn keine gültige Adresse enthalten ist (Datei leer oder fehlerhaft). */
export function countIpv4(text: string): number {
  const body = expect(typeof text === 'string' && text.trim() ? text : null, 'Antworttext');
  let n = 0;
  for (const line of body.split('\n')) {
    const p = line.trim().split('.');
    if (p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) <= 255)) n++;
  }
  if (n === 0) throw new Error('unerwartete Antwort: keine IPv4-Adressen');
  return n;
}

/** "Tue Nov 17 05:00:21 IST 2026" (indische Zeit, UTC+05:30) in ms seit Epoche UTC. */
export function parseLastChecked(text: string): number {
  const m = /(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+IST\s+(\d{4})/.exec(expect(text?.trim() || null, 'Last-Checked-At'));
  const mon = m ? MONTHS.indexOf(m[1]) : -1;
  if (!m || mon < 0) throw new Error('unerwartete Antwort: Last-Checked-At nicht lesbar');
  return Date.UTC(Number(m[6]), mon, Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) - IST_OFFSET_MS;
}

const collector: Collector = {
  id: 'tor-relays-github',
  title: 'Tor-Ausgangsknoten (GitHub-Spiegel)',
  sourceUrl: 'https://github.com/SecOps-Institute/Tor-IP-Addresses',
  intervalMinutes: 360,
  signals: [{
    id: SIG, scenarios: ['cyber'], domain: 'outages', name: 'Tor-Ausgangsknoten (IPv4)',
    plain: 'Wie viele Ausgangsknoten das Tor-Netz gerade hat; ein Einbruch zeigt Eingriffe oder Störungen im Tor-Netz.',
    evidenceClass: 'A', direction: 'both', kind: 'gauge', weight: 0.15, manipulability: 'medium', independenceGroup: 'tor-network',
    unit: 'Knoten', intervalMinutes: 360, holdHours: 24,
    baseline: { method: 'rolling', windowDays: 28, minPoints: 28 }, thresholds: { z0: 3, z1: 8, relFloor: 0.05 },
    sourceName: 'SecOps-Institute/Tor-IP-Addresses (GitHub)', sourceUrl: 'https://github.com/SecOps-Institute/Tor-IP-Addresses',
    license: 'MIT (Repo), Daten aus öffentlichen Tor-Netz-Informationen',
    banalCauses: ['Wechsel der Datenquelle des Bots', 'normale Relay-Fluktuation'],
  }],
  async collect(ctx) {
    const checked = parseLastChecked(await ctx.http.text(BASE + 'Last-Checked-At', { fixture: 'tor-relays-github/Last-Checked-At.txt' }));
    const age = ctx.now.getTime() - checked;
    if (age > 6 * HOUR || age < -HOUR) throw new Error(`Last-Checked-At unplausibel: ${new Date(checked).toISOString()}`);
    const n = countIpv4(await ctx.http.text(BASE + 'tor-exit-nodes.lst', { fixture: 'tor-relays-github/tor-exit-nodes.lst' }));
    return { observations: [obs(SIG, checked, n)] };
  },
};

export default collector;
