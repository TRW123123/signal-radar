// FireHOL blocklist-ipsets: Größe ausgewählter, aktiv gepflegter IP-Sperrlisten als Lagemaß (Klasse A: Sensor-/Meldedaten Dritter).
// Quelle: https://github.com/firehol/blocklist-ipsets, Rohdateien unter raw.githubusercontent.com/firehol/blocklist-ipsets/master/<liste>
// Doku: https://iplists.firehol.org/ und README im Repo. Kein Key. Je Liste ein Request mit Range-Header (nur die Kopfzeilen, ~4 kB).
// Lizenz: unklar. Das Repo-README warnt, dass einzelne Listen eigene Lizenzen haben; geprüft wurde keine einzeln.
//   blocklist_de (Blocklist.de), greensnow (GreenSnow), tor_exits (Tor Project, TorDNSEL), bruteforceblocker (danger.rulez.sk),
//   cybercrime (cybercrime-tracker.net), firehol_level2 und firehol_abusers_1d (FireHOL-Aggregate aus mehreren Quellen): je „unklar“.
//   Es werden nur Zahlen aus den Kopfzeilen übernommen, keine IP-Adressen gespeichert.
// Gemessen: Zahl der „unique IPs“ (Zeile `# Entries`), Zeitstempel = `# This File Date` (UTC). Beim erneuten Abruf derselben
//   Dateiversion entsteht derselbe Zeitstempel, der Speicher ignoriert das Duplikat.
// Veraltet: Liegt `This File Date` mehr als 3 Tage vor dem Abrufzeitpunkt, wird die Liste nicht gemeldet (Log-Hinweis).
// Geprüft und NICHT gewählt (17.11.2026): feodo.ipset (Datei vom 12.03.2026, veraltet), sslbl.ipset (existiert im Repo nicht),
//   et_compromised.ipset (Datei vom 14.11.2026, nach 3 Tagen Grenze veraltet), dshield.netset (immer die Top-20-/24-Netze, Größe konstant 5120), ciarmy.ipset (bei 15000 gedeckelt), spamhaus_drop.netset
//   (ändert sich nur selten, Datei 3 Tage alt), firehol_level1.netset (statisch, überwiegend Bogon-/Reservebereiche).
// Harmlose Ursachen: Ausfall oder Änderung der Upstream-Quelle (Liste springt auf 0 oder verdoppelt sich), Aufnahme eines großen
//   Hosters, Aufbewahrungsfristen der Listen (blocklist_de: 48 Stunden), Wochenend-/Tagesrhythmus von Scan-Wellen.
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, num, obs } from './_helpers.ts';

const BASE = 'https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/';
const MAX_AGE_DAYS = 3;

interface ListDef { file: string; slug: string; name: string; plain: string; weight: number; direction: 'up' | 'down' | 'both'; group: string }

export const LISTS: ListDef[] = [
  {
    file: 'blocklist_de.ipset', slug: 'blocklist_de', group: 'blocklist-de', weight: 0.4, direction: 'up',
    name: 'Blocklist.de: Angreifer-IPs (48 Stunden)',
    plain: 'Wie viele IP-Adressen in den letzten 48 Stunden bei Blocklist.de als Angreifer (Einbruchsversuche auf Server) gemeldet wurden.',
  },
  {
    file: 'greensnow.ipset', slug: 'greensnow', group: 'greensnow', weight: 0.3, direction: 'up',
    name: 'GreenSnow: Angreifer-IPs',
    plain: 'Wie viele IP-Adressen GreenSnow aktuell als Angreifer führt (Portscans, Brute-Force).',
  },
  {
    file: 'bruteforceblocker.ipset', slug: 'bruteforceblocker', group: 'bruteforceblocker', weight: 0.3, direction: 'up',
    name: 'BruteForceBlocker: Angreifer-IPs',
    plain: 'Wie viele IP-Adressen beim Passwort-Raten gegen SSH-Dienste aufgefallen sind.',
  },
  {
    file: 'firehol_abusers_1d.netset', slug: 'abusers_1d', group: 'firehol-aggregate-1d', weight: 0.3, direction: 'up',
    name: 'FireHOL: Angreifer der letzten 24 Stunden',
    plain: 'Wie viele IP-Adressen in den letzten 24 Stunden gegen Webserver, Mailserver und Blogs aufgefallen sind (Zusammenfassung mehrerer Quellen).',
  },
  {
    file: 'cybercrime.ipset', slug: 'cybercrime', group: 'cybercrime-tracker', weight: 0.3, direction: 'up',
    name: 'CyberCrime Tracker: Schadsoftware-Server',
    plain: 'Wie viele IP-Adressen aktuell als Steuerserver von Schadsoftware geführt werden.',
  },
  {
    file: 'firehol_level2.netset', slug: 'level2', group: 'firehol-aggregate', weight: 0.4, direction: 'up',
    name: 'FireHOL Level 2: Angriffe der letzten 48 Stunden',
    plain: 'Zusammenfassung mehrerer Sperrlisten: wie viele IP-Adressen in den letzten 48 Stunden Angriffe geführt haben.',
  },
  {
    file: 'tor_exits.ipset', slug: 'tor_exits', group: 'tor-dnsel', weight: 0.15, direction: 'both',
    name: 'Tor-Ausgangsknoten (Zahl der IPs)',
    plain: 'Wie viele Tor-Ausgangsknoten gerade im Netz sind; Einbruch oder Sprung deutet auf Eingriffe ins Tor-Netz.',
  },
];

export const signalId = (l: Pick<ListDef, 'slug'>): string => `cyber.threat.firehol_${l.slug}_entries`;

export interface ListHeader { entries: number; fileDate: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Liest `# Entries` (Zahl vor „unique IPs“) und `# This File Date` aus den Kopfzeilen. Wirft bei fehlenden Feldern. */
export function parseHeader(text: string): ListHeader {
  const head = expect(typeof text === 'string' && text.length ? text : null, 'Antworttext');
  const ent = /^#\s*Entries\s*:\s*(.+)$/m.exec(head);
  const dt = /^#\s*This File Date\s*:\s*(.+)$/m.exec(head);
  const entries = num(/(\d[\d,]*)\s+unique IPs/.exec(expect(ent?.[1], 'Kopfzeile Entries'))?.[1]);
  const m = /(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+UTC\s+(\d{4})/.exec(expect(dt?.[1], 'Kopfzeile This File Date'));
  const mon = m ? MONTHS.indexOf(m[1]) : -1;
  if (entries === null) throw new Error('unerwartete Antwort: Entries ohne „unique IPs“');
  if (!m || mon < 0) throw new Error('unerwartete Antwort: This File Date nicht lesbar');
  const fileDate = Date.UTC(Number(m[4]), mon, Number(m[2]), Number(m[3].slice(0, 2)), Number(m[3].slice(3, 5)), Number(m[3].slice(6, 8)));
  return { entries, fileDate };
}

const collector: Collector = {
  id: 'firehol-blocklists',
  title: 'FireHOL blocklist-ipsets (Listengrößen)',
  sourceUrl: 'https://github.com/firehol/blocklist-ipsets',
  intervalMinutes: 360,
  signals: LISTS.map((l) => ({
    id: signalId(l), scenarios: ['cyber'], domain: 'threat', name: l.name, plain: l.plain,
    evidenceClass: 'A' as const, direction: l.direction, kind: 'gauge' as const, weight: l.weight, manipulability: 'medium' as const,
    independenceGroup: l.group, unit: 'IP-Adressen', intervalMinutes: 360, holdHours: 24,
    baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 28 },
    thresholds: { z0: 3, z1: 8, relFloor: 0.1 },
    sourceName: 'FireHOL blocklist-ipsets (GitHub)', sourceUrl: `https://github.com/firehol/blocklist-ipsets/blob/master/${l.file}`,
    license: 'unklar (je Liste unterschiedlich)',
    banalCauses: ['Ausfall oder Umstellung der Upstream-Quelle', 'Aufnahme eines großen Hosters'],
  })),
  async collect(ctx) {
    const observations: Observation[] = [];
    let ok = 0;
    for (const l of LISTS) {
      try {
        const text = await ctx.http.text(BASE + l.file, { fixture: `firehol/${l.file}`, headers: { range: 'bytes=0-3999' } });
        const h = parseHeader(text);
        ok++;
        if (ctx.now.getTime() - h.fileDate > MAX_AGE_DAYS * DAY_MS) {
          ctx.log(`${l.file} veraltet (This File Date ${new Date(h.fileDate).toISOString()}), nicht gemeldet`);
          continue;
        }
        observations.push(obs(signalId(l), h.fileDate, h.entries));
      } catch (e) {
        ctx.log(`Liste ${l.file} übersprungen: ${(e as Error).message}`);
      }
    }
    if (ok === 0) throw new Error('keine FireHOL-Liste lesbar');
    return { observations };
  },
};

export default collector;
