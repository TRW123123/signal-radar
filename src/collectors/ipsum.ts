// IPsum (stamparm): tägliche Liste verdächtiger IP-Adressen mit der Zahl der Sperrlisten, auf denen sie stehen (Klasse A).
// Quelle: https://github.com/stamparm/ipsum, Datei ipsum.txt (ca. 2 MB, einmal täglich gegen 03:00 MEZ aktualisiert).
// Lizenz: The Unlicense (Public Domain, laut README des Repos). Kein Key. Es werden nur Zähler gespeichert, keine Adressen.
// Aufbau: Kopf mit `# Last update: Mon, 16 Nov 2026 03:00:42 +0100`, danach je Zeile `<IP>\t<Zahl der Listen>`.
// Gemessen: Zahl der IPs auf mindestens 3 und auf mindestens 5 Listen; Zeitstempel = `Last update` (UTC).
//   Die Schwellen 3 und 5 sind robuster als die Gesamtzahl, weil viele Einträge nur auf 1 oder 2 Listen stehen (Rauschen).
// Harmlose Ursachen: Hinzukommen oder Wegfall einer der ausgewerteten Quell-Listen (Sprung der Zahl), Massenscans durch
//   bekannte Forschungs-Scanner, Ausfall des täglichen Laufs (Wert fehlt, kein Einbruch).
// VERIFIED: ja (17.11.2026)

import type { Collector } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const URL_IPSUM = 'https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt';
const SIG3 = 'cyber.threat.ipsum_ips_ge3';
const SIG5 = 'cyber.threat.ipsum_ips_ge5';

export interface IpsumStats { ts: number; ge3: number; ge5: number; total: number }

/** Liest `Last update` und zählt Zeilen nach Listenzahl. Wirft, wenn Kopf oder Datenzeilen fehlen. */
export function parseIpsum(text: string): IpsumStats {
  const head = expect(typeof text === 'string' && text.length ? text : null, 'Antworttext');
  const m = /^#\s*Last update:\s*(.+)$/m.exec(head);
  const ts = Date.parse(expect(m?.[1], 'Kopfzeile Last update').trim());
  if (!Number.isFinite(ts)) throw new Error('unerwartete Antwort: Last update nicht lesbar');
  let ge3 = 0;
  let ge5 = 0;
  let total = 0;
  for (const line of head.split('\n')) {
    if (!line || line.charCodeAt(0) === 35) continue; // '#'
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2 || !/^\d{1,3}(\.\d{1,3}){3}$/.test(parts[0])) continue;
    const n = Number(parts[1]);
    if (!Number.isInteger(n) || n < 1) continue;
    total++;
    if (n >= 3) ge3++;
    if (n >= 5) ge5++;
  }
  if (total === 0) throw new Error('unerwartete Antwort: keine Datenzeilen');
  return { ts, ge3, ge5, total };
}

const common = {
  scenarios: ['cyber'], domain: 'threat', evidenceClass: 'A' as const, direction: 'up' as const, kind: 'gauge' as const,
  manipulability: 'medium' as const, independenceGroup: 'ipsum', unit: 'IP-Adressen', intervalMinutes: 1440, holdHours: 48,
  baseline: { method: 'rolling' as const, windowDays: 28, minPoints: 14 },
  thresholds: { z0: 3, z1: 8, relFloor: 0.1 },
  sourceName: 'IPsum (GitHub)', sourceUrl: 'https://github.com/stamparm/ipsum', license: 'Unlicense (Public Domain)',
  banalCauses: ['Änderung der ausgewerteten Quell-Listen', 'Massenscans von Forschungs-Scannern'],
};

const collector: Collector = {
  id: 'ipsum',
  title: 'IPsum Threat Intelligence Feed',
  sourceUrl: 'https://github.com/stamparm/ipsum',
  intervalMinutes: 360,
  signals: [
    {
      ...common, id: SIG3, name: 'IPsum: IPs auf mindestens 3 Sperrlisten', weight: 0.4,
      plain: 'Wie viele IP-Adressen auf mindestens drei von vielen öffentlichen Sperrlisten stehen; steigt bei Angriffs- und Scanwellen.',
    },
    {
      ...common, id: SIG5, name: 'IPsum: IPs auf mindestens 5 Sperrlisten', weight: 0.3,
      plain: 'Wie viele IP-Adressen auf mindestens fünf Sperrlisten stehen, also besonders sicher bösartig sind.',
    },
  ],
  async collect(ctx) {
    const text = await ctx.http.text(URL_IPSUM, { fixture: 'ipsum/ipsum.txt', timeoutMs: 60_000 });
    const s = parseIpsum(text);
    return { observations: [obs(SIG3, s.ts, s.ge3, { total: s.total }), obs(SIG5, s.ts, s.ge5, { total: s.total })] };
  },
};

export default collector;
