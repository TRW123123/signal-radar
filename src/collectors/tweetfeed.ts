// TweetFeed: von Sicherheitsforschern auf X/Twitter gemeldete Indikatoren (Phishing-URLs, Domains, IPs, Hashes) pro Tag (Klasse D: Crowd-Meldungen).
// Quelle: https://github.com/0xDanielLopez/TweetFeed (month.csv, alle 15 Minuten neu erzeugt; Doku: https://tweetfeed.live/api/)
// Lizenz: CC0 1.0 (LICENSE im Repo). Kein Key. Abruf höchstens alle 15 Minuten, hier alle 6 Stunden.
// Aufbau: CSV OHNE Kopfzeile: date (UTC), user, type (domain|url|ip|sha256|md5), value, tags (leerzeichengetrennt, z. B. "#phishing #malware"), tweet_url.
// Gemessen: (a) alle IOC-Zeilen je UTC-Tag, (b) Zeilen mit Tag #malware, #C2, #ransomware oder #APT je UTC-Tag.
//   Der erste Tag der Datei (angeschnitten) sowie heute und gestern entfallen: laut Doku treffen Zeilen bis zu 48 Stunden verspätet ein.
// Harmlose Ursachen: einzelne Melder laden Stapel hoch (z. B. 1366 IPs an einem Tag, 17.-21.10.2026), Wochenendrhythmus,
//   Änderung der Melder-Gruppe. Jede Domain steht meist zusätzlich als URL-Zeile (Zahl ist deshalb keine Zahl einzelner Vorfälle).
// VERIFIED: ja (17.11.2026)

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, obs } from './_helpers.ts';

const URL_MONTH = 'https://raw.githubusercontent.com/0xDanielLopez/TweetFeed/master/month.csv';
const SIG_ALL = 'cyber.threat.tweetfeed_iocs_daily';
const SIG_MAL = 'cyber.threat.tweetfeed_malware_iocs_daily';
const MALWARE_TAG = /(^|\s)#(malware|c2|ransomware|apt)(\s|$)/i;

export interface DayCount { day: string; all: number; malware: number }

/** Zählt Zeilen je UTC-Tag. Tage ab `now - 2 Tage` und der erste (angeschnittene) Tag der Datei werden nicht zurückgegeben. */
export function parseTweetfeed(text: string, now: Date): DayCount[] {
  const body = expect(typeof text === 'string' && text.trim() ? text : null, 'Antworttext');
  const perDay = new Map<string, { all: number; malware: number }>();
  for (const line of body.split('\n')) {
    const m = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2},/.exec(line);
    if (!m) continue;
    // Spalten: date,user,type,value,tags,tweet_url; Werte enthalten keine Kommas ausser selten in URLs, Tags stehen an Position 5 von vorne
    const parts = line.split(',');
    const tags = parts.length >= 6 ? parts[4] : '';
    const o = perDay.get(m[1]) ?? { all: 0, malware: 0 };
    o.all++;
    if (MALWARE_TAG.test(tags)) o.malware++;
    perDay.set(m[1], o);
  }
  if (perDay.size === 0) throw new Error('unerwartete Antwort: keine gültigen Zeilen');
  const days = [...perDay.keys()].sort();
  const lastComplete = new Date(floorDay(now).getTime() - 2 * DAY_MS).toISOString().slice(0, 10); // heute und gestern ausgeschlossen
  return days.slice(1).filter((d) => d <= lastComplete).map((d) => ({ day: d, ...perDay.get(d)! }));
}

const common = {
  scenarios: ['cyber'], domain: 'threat', evidenceClass: 'D' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'high' as const, independenceGroup: 'tweetfeed', unit: 'IOCs/Tag', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'day-of-week' as const, windowDays: 28, minPoints: 14 }, thresholds: { z0: 3, z1: 8, relFloor: 0.3 },
  sourceName: 'TweetFeed (GitHub)', sourceUrl: 'https://github.com/0xDanielLopez/TweetFeed', license: 'CC0 1.0',
  banalCauses: ['Stapel-Uploads einzelner Melder', 'Wochenendrhythmus'],
};

const collector: Collector = {
  id: 'tweetfeed',
  title: 'TweetFeed (IOC-Meldungen aus X/Twitter)',
  sourceUrl: 'https://github.com/0xDanielLopez/TweetFeed',
  intervalMinutes: 360,
  signals: [
    {
      ...common, id: SIG_ALL, name: 'TweetFeed: gemeldete IOCs pro Tag', weight: 0.15,
      plain: 'Wie viele Phishing-Adressen, Schad-Server und Dateikennungen Sicherheitsforscher pro Tag öffentlich melden.',
    },
    {
      ...common, id: SIG_MAL, name: 'TweetFeed: Malware-, C2-, Ransomware-Meldungen pro Tag', weight: 0.2,
      plain: 'Wie viele der täglichen Meldungen Schadsoftware, Steuerserver, Erpresser oder Staatshacker betreffen.',
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_MONTH, { fixture: 'tweetfeed/month.csv', timeoutMs: 60_000 });
    const observations: Observation[] = [];
    for (const d of parseTweetfeed(text, ctx.now)) {
      observations.push(obs(SIG_ALL, `${d.day}T00:00:00Z`, d.all));
      observations.push(obs(SIG_MAL, `${d.day}T00:00:00Z`, d.malware));
    }
    return { observations };
  },
};

export default collector;
