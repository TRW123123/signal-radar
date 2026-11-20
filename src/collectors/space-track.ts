// Space-Track.org (18th/19th Space Defense Squadron): Wiedereintritte (Decay-Meldungen) pro Tag (Klasse A).
// Quelle: https://www.space-track.org/basicspacedata/query/class/decay/MSG_EPOCH/<gestern>--<heute>/orderby/DECAY_EPOCH%20desc/format/json
// Doku: https://www.space-track.org/documentation (gelesen 20.11.2026): Login per POST https://www.space-track.org/ajaxauth/login
//   (Formularfelder identity, password) setzt ein Session-Cookie; danach GET-Abfragen. API-Richtlinien: < 30 Requests/min,
//   < 300/h; Klasse DECAY höchstens 1×/Tag ("If checking once per day, add /MSG_EPOCH/>now-1/"); einmal geladene Historie
//   nicht erneut laden. Glossar: Decay-Meldungstypen "Historical" (tatsächlicher Wiedereintritt) und "Prediction" (TIP, 60-Tage).
// Key: SR_SPACE_TRACK_USER (identity) / SR_SPACE_TRACK_PASS (password).
// Nutzungsbedingungen: Space-Track User Agreement; keine Weitergabe der Rohdaten an Dritte. Hier werden nur Tageszahlen gezeigt.
//   Quelle "Space-Track.org" nennen.
// Antwort (Doku, Klasse decay): Liste von Objekten mit NORAD_CAT_ID, OBJECT_NUMBER, OBJECT_NAME, INTLDES, OBJECT_ID, RCS,
//   RCS_SIZE, COUNTRY, MSG_EPOCH, DECAY_EPOCH, SOURCE, MSG_TYPE, PRECEDENCE (Werte als Text).
// Gemessen: cyber.physical.satellite_decay_events = Zahl der am Vortag (UTC, nach MSG_EPOCH) eingegangenen Meldungen
//   MSG_TYPE "Historical", je Objekt (NORAD_CAT_ID) einmal. Tageswert, ein Request pro Tag.
//   Abweichung vom Katalog: intervalMinutes 1440 und Baseline rolling statt hour-of-week (Daten sind Tageswerte).
// Harmlose Ursachen: geplante Deorbits großer Konstellationen (Starlink), Sonnenstürme (erhöhte Abbremsung), Nachmeldungen.
// Ablauf (2 Requests/Tag): POST ajaxauth/login (identity/password, form-urlencoded) über ctx.http.request mit secret: true
//   (Antwort und Cookie werden nie aufgezeichnet), dann GET der Decay-Abfrage mit dem Session-Cookie. Ein fehlgeschlagener Login
//   antwortet laut Doku mit HTTP 200 und {"Login":"Failed"}; das und ein fehlendes Cookie gelten als Fehler.
// Not built:
//   cyber.physical.starlink_fleet_count und war.military.sat_maneuvers: Katalog-Collector ist celestrak (keyfreie GP-Daten);
//     dieselbe id hier würde Reihen mischen, und die GP-Abfragen lägen ohnehin hinter demselben Login.
// VERIFIED: nein (ungeprüft bis Key). Format und Login nach offizieller Doku.

import type { Collector, Observation } from '../core/types.ts';
import { DAY_MS, expect, floorDay, isoDay, obs } from './_helpers.ts';

const USER_ENV = 'SR_SPACE_TRACK_USER';
const PASS_ENV = 'SR_SPACE_TRACK_PASS';
export const SIG_DECAY = 'cyber.physical.satellite_decay_events';
export const LOGIN_URL = 'https://www.space-track.org/ajaxauth/login';

/** Form body for the login POST. */
export function loginBody(identity: string, password: string): string {
  return new URLSearchParams({ identity, password }).toString();
}

/** Query URL for decay messages received on the previous complete UTC day. */
export function decayUrl(now: Date): string {
  const to = floorDay(now);
  const from = new Date(to.getTime() - DAY_MS);
  return `https://www.space-track.org/basicspacedata/query/class/decay/MSG_EPOCH/${isoDay(from)}--${isoDay(to)}/orderby/DECAY_EPOCH%20desc/format/json`;
}

/** Counts distinct objects with a "Historical" decay message whose MSG_EPOCH lies on the previous UTC day. */
export function parseDecay(body: unknown, now: Date): Observation {
  const list = expect(Array.isArray(body) ? body : null, 'Liste der Decay-Meldungen');
  const to = floorDay(now).getTime();
  const from = to - DAY_MS;
  const ids = new Set<string>();
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const type = expect(r.MSG_TYPE as string | undefined, 'MSG_TYPE');
    if (String(type).toLowerCase() !== 'historical') continue;
    const t = Date.parse(`${String(r.MSG_EPOCH ?? '').replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(String(r.MSG_EPOCH)) ? '' : 'Z'}`);
    if (!Number.isFinite(t) || t < from || t >= to) continue;
    ids.add(String(r.NORAD_CAT_ID ?? r.OBJECT_NUMBER ?? r.OBJECT_ID));
  }
  return obs(SIG_DECAY, from, ids.size);
}

const collector: Collector = {
  id: 'space-track',
  title: 'Space-Track.org (Decay-Meldungen)',
  sourceUrl: 'https://www.space-track.org/documentation',
  needsKey: [USER_ENV, PASS_ENV],
  intervalMinutes: 1440,
  signals: [{
    id: SIG_DECAY, scenarios: ['cyber'], domain: 'physical', name: 'Satellitenzerfall und Anomalien',
    plain: 'Wie viele Satelliten und Raketenteile am Vortag nach offizieller Meldung in die Atmosphäre eingetreten sind.',
    evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.2, manipulability: 'low', independenceGroup: 'space-track',
    unit: 'Objekte/Tag', intervalMinutes: 1440, holdHours: 48, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
    license: 'Space-Track User Agreement, keine Weitergabe roher Daten; Quelle Space-Track.org nennen',
    banalCauses: ['Normaler Zerfall', 'Geplante Deorbits (Starlink)', 'Sonnenstürme', 'Nachmeldungen'],
  }],
  async collect(ctx) {
    const identity = expect(ctx.key(USER_ENV), USER_ENV);
    const password = expect(ctx.key(PASS_ENV), PASS_ENV);
    const login = await ctx.http.request(LOGIN_URL, {
      method: 'POST', body: loginBody(identity, password), secret: true, fixture: 'space-track/login.json',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    if (/"Login"\s*:\s*"Failed"/i.test(login.body)) throw new Error('Space-Track: Login fehlgeschlagen (identity/password prüfen)');
    if (!login.cookie) throw new Error('Space-Track: Login ohne Session-Cookie');
    const body = await ctx.http.json<unknown>(decayUrl(ctx.now), { fixture: 'space-track/decay.json', headers: { cookie: login.cookie } });
    return { observations: [parseDecay(body, ctx.now)] };
  },
};

export default collector;
