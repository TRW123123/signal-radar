// alerts.in.ua API: aktuell aktive Luftalarme in der Ukraine, live (Klasse B: Betriebsdaten des Alarmsystems).
// Quelle: https://api.alerts.in.ua/v1/alerts/active.json   Doku: https://devs.alerts.in.ua/ (geprüft 20.11.2026)
// Key: persönlicher Token, Header "Authorization: Bearer <token>" (env SR_ALERTS_IN_UA_KEY).
// Limits laut Doku: Soft 8-10, Hard 12 Requests/min je IP; bei auffälliger Tagesmenge Sperre. Hier 1 Request pro Lauf, alle 15 min.
//   History-Endpunkt (/v1/regions/{uid}/alerts/month_ago.json) hat 2/min und soll nicht laufend genutzt werden: nicht verwendet.
// Nutzungsbedingungen (Doku "Відмова від відповідальності"/"Використання у публічних сервісах"): Token geheim halten, für
//   öffentliche Dienste über eigenen Server abrufen (passt: Abruf im Backend, nur Aggregate werden gezeigt), nicht für
//   kritische Infrastruktur; keine ausdrückliche Lizenz für die Daten. Projekt von Freiwilligen, Daten aus offiziellen Quellen.
//   Quellenangabe "alerts.in.ua" empfohlen (keine Pflichtformulierung gefunden).
// Antwort (Doku-Beispiel): { alerts: [{ id, location_title, location_type: oblast|raion|city|hromada|unknown, started_at,
//   finished_at, updated_at, alert_type: air_raid|artillery_shelling|urban_fights|chemical|nuclear, location_uid,
//   location_oblast, location_oblast_uid, location_raion, notes, alert_level: red|yellow,
//   threats?: [{ threat_type, level, started_at, source_message }] }] }. threats fehlt, wenn keine Einzelbedrohung offen ist.
// Gemessen (Momentaufnahme je Lauf, Zeitstempel = Lauf auf 15 min abgerundet):
//   war.conflict.ua_active_air_raid_oblasts: Zahl der Oblaste (location_oblast_uid) mit mindestens einem aktiven Luftalarm
//     (alert_type air_raid, beliebige Ebene, rot oder gelb). Höchstens 27.
//   war.conflict.ua_active_missile_threats: Zahl der Oblaste mit offener Raketen-/Startwarnung (threat_type ballistic_missiles,
//     cruise_missiles, unspecified_missiles, mig31k_departure, strategic_aircraft_activity).
// Harmlose Ursachen: einzelne Drohnen oder MiG-31K-Starts ohne Abschuss lösen landesweite Alarme aus; Änderungen der
//   Alarmpraxis (Raion-Ebene); Ausfall des Dienstes (dann Fehler, keine 0).
// Not built:
//   war.conflict.ua_air_alerts: Katalog-Collector ist github-air-raid-sirens (Tagesreihe, dort gebaut und VERIFIED). Dieselbe
//     id hier würde eine Live-Momentaufnahme mit einer Tageszählung mischen. Stattdessen die zwei neuen ids oben (Vorschlag:
//     gemeinsamer upstream "ua-air-raid-alarm-system" mit github-air-raid-sirens in catalog/upstreams.json).
//   war.attention.baltic_drone_warnings: alerts.in.ua deckt nur die Ukraine ab, keine Warnungen für Baltikum/Finnland.
// VERIFIED: nein (ungeprüft bis Key). Ohne Token HTTP 401; Format nach offizieller Doku (Beispiel und Modell "Alert").

import type { Collector, Observation } from '../core/types.ts';
import { expect, obs } from './_helpers.ts';

const KEY_ENV = 'SR_ALERTS_IN_UA_KEY';
export const SIG_OBLASTS = 'war.conflict.ua_active_air_raid_oblasts';
export const SIG_MISSILE = 'war.conflict.ua_active_missile_threats';
export const MISSILE_THREATS = new Set(['ballistic_missiles', 'cruise_missiles', 'unspecified_missiles', 'mig31k_departure', 'strategic_aircraft_activity']);
const SLOT_MS = 15 * 60_000;

export interface ActiveStats { airRaidOblasts: number; missileOblasts: number; alerts: number }

/** Counts oblasts with an active air-raid alert and with an open missile-type threat. */
export function parseActive(body: unknown): ActiveStats {
  const list = expect((body as { alerts?: unknown } | null)?.alerts, 'alerts');
  if (!Array.isArray(list)) throw new Error('unerwartete Antwort: alerts ist keine Liste');
  const air = new Set<string>();
  const missile = new Set<string>();
  for (const a of list as Record<string, unknown>[]) {
    if (!a || a.finished_at) continue;
    const oblast = String(a.location_oblast_uid ?? a.location_oblast ?? '');
    if (!oblast) continue;
    if (a.alert_type === 'air_raid') air.add(oblast);
    const threats = Array.isArray(a.threats) ? (a.threats as Record<string, unknown>[]) : [];
    if (threats.some((t) => MISSILE_THREATS.has(String(t?.threat_type)))) missile.add(oblast);
  }
  return { airRaidOblasts: air.size, missileOblasts: missile.size, alerts: list.length };
}

export function toObservations(s: ActiveStats, now: Date): Observation[] {
  const ts = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  return [
    obs(SIG_OBLASTS, ts, s.airRaidOblasts, { alerts: s.alerts }),
    obs(SIG_MISSILE, ts, s.missileOblasts),
  ];
}

const LICENSE = 'alerts.in.ua: Token-Nutzung nach Regeln der API-Doku, keine ausdrückliche Datenlizenz; Quelle alerts.in.ua nennen';
const common = { scenarios: ['war'], domain: 'conflict', evidenceClass: 'B' as const, direction: 'up' as const, kind: 'count' as const,
  manipulability: 'medium' as const, independenceGroup: 'alerts-in-ua', upstream: 'ua-air-raid-alarm-system', intervalMinutes: 15,
  holdHours: 3, baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 }, license: LICENSE,
  sourceName: 'alerts.in.ua API', sourceUrl: 'https://devs.alerts.in.ua/' };

const collector: Collector = {
  id: 'alerts-in-ua',
  title: 'alerts.in.ua (aktive Luftalarme Ukraine)',
  sourceUrl: 'https://devs.alerts.in.ua/',
  needsKey: KEY_ENV,
  intervalMinutes: 15,
  signals: [
    { ...common, id: SIG_OBLASTS, name: 'Ukraine: Oblaste mit aktivem Luftalarm (live)', weight: 0.6, unit: 'Oblaste',
      plain: 'In wie vielen ukrainischen Regionen gerade Luftalarm herrscht.',
      rationale: 'Live-Ergänzung zur Tagesreihe aus dem GitHub-Spiegel; große Angriffswellen erfassen fast alle Regionen gleichzeitig.',
      banalCauses: ['Einzelne Drohnen', 'MiG-31K-Starts ohne Abschuss', 'Geänderte Alarmpraxis'] },
    { ...common, id: SIG_MISSILE, name: 'Ukraine: Regionen mit Raketenwarnung (live)', weight: 0.65, unit: 'Oblaste',
      plain: 'In wie vielen ukrainischen Regionen gerade ausdrücklich vor Raketen oder Startplattformen gewarnt wird.',
      banalCauses: ['Vorsorgliche Warnung bei MiG-31K-Starts', 'Bedrohungsangaben nicht von allen Quellen gepflegt'] },
  ],
  async collect(ctx) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const body = await ctx.http.json<unknown>('https://api.alerts.in.ua/v1/alerts/active.json', {
      fixture: 'alerts-in-ua/active.json', headers: { Authorization: `Bearer ${key}` },
    });
    return { observations: toObservations(parseActive(body), ctx.now) };
  },
};

export default collector;
