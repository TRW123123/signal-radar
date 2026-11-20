// aisstream.io: AIS-Positionsmeldungen per WebSocket, kurze Stichprobe je Lauf, nur Aggregate (keine Einzelschiffe gespeichert).
// Quelle: wss://stream.aisstream.io/v0/stream   Doku: https://aisstream.io/documentation (gelesen 20.11.2026)
// Ausnahme von "nur ctx.http": globales WebSocket von Node 22 (ausdrücklich erlaubt). Sitzung höchstens 55 s plus harte Grenze
//   von 5 s, danach wird die Verbindung in jedem Fall geschlossen.
// Doku-Punkte: Abonnement als JSON innerhalb von 3 s nach dem Öffnen { APIKey, BoundingBoxes: [[[lat,lon],[lat,lon]], ...],
//   FilterMessageTypes }; Server sendet binäre Frames mit UTF-8-JSON { MessageType, MetaData: { MMSI, ShipName, Latitude,
//   Longitude, (time_utc) }, Message: { <MessageType>: { UserID, Sog, Cog, NavigationalStatus, Latitude, Longitude, Valid, ... } } };
//   Bestätigung { MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled } }. Limits: 3 Verbindungen je Konto
//   und IP, Abo-Änderung höchstens 1/s; seit September 2026 Bandbreitengrenze für unkomprimierte Verbindungen (permessage-deflate
//   empfohlen; ob Node-WebSocket es aushandelt, meldet CompressionEnabled, siehe ctx.log). Direktzugriff aus dem Browser verboten
//   (hier Backend, passt). Kein SLA, keine Wiederholung verpasster Meldungen.
// Key: SR_AISSTREAM_KEY (im Abo-JSON, nie in URL/Fixture).
// Lizenz/Nutzungsbedingungen: unklar; auf aisstream.io keine Terms-Seite gefunden (nur Datenschutz). Daten sind
//   empfangene AIS-Funkmeldungen. Nur Aggregate je Gebiet zeigen, Quelle "aisstream.io" nennen.
// Gebiete (BoundingBoxes laut Katalog: Kabeltrassen und Häfen):
//   Kabel: gulf-of-finland [[59.3,22.5],[60.4,27.0]] (Balticconnector, Estlink), central-baltic [[54.6,13.5],[57.6,21.2]] (C-Lion1, BCS)
//   Häfen: rotterdam [[51.85,3.3],[52.15,4.2]] (Reede Maas), elbe [[53.75,7.8],[54.15,8.8]] (Reede Elbe/Deutsche Bucht)
// Gemessen (Momentaufnahme je Lauf, Zeitstempel = volle Stunde; Messgröße hängt von der Sitzungslänge ab, daher fix 55 s):
//   cyber.physical.ais_position_jumps: Schiffe (MMSI) mit unplausiblem Sprung zwischen zwei Positionen (> 60 kn bei > 2 km);
//     Meta: Schiffe gesamt und Anteil.
//   cyber.physical.port_congestion: Schiffe mit Navigationsstatus 1 (vor Anker) in den Hafen-Boxen.
//   cyber.attention.ship_ais_aggregate: Schiffe mit Fahrt < 1 kn (ohne Status 5 = festgemacht) in den Kabel-Boxen.
//   Ankernde Schiffe senden nur alle 3 min: eine 55-s-Stichprobe sieht etwa ein Drittel davon. Das ist systematisch und
//   gleich je Lauf (Baseline), aber verrauscht. Keine Position-Meldung in der ganzen Sitzung = Fehler, keine 0.
// Harmlose Ursachen: Wetter (Ankern vor Sturm), Streik, Hafenbetrieb, Fischerei, Empfangslücken des Netzes, GPS-Störungen
//   (Positionssprünge in der Ostsee sind seit 2023 häufig).
// Not built: war.shipping.baltic_ais_traffic. Katalog-Collector ist digitraffic (keyfrei, Finnischer Meerbusen); dieselbe id
//   hier würde Reihen mischen. Technisch ginge eine Zählung aus derselben Sitzung.
// VERIFIED: nein (ungeprüft bis Key). Nachrichtenformat nach Doku; Fixture fixtures/aisstream/doc-sample-messages.json ist
//   nach der Doku nachgebaut, keine echte Aufzeichnung.

import type { Collector, Observation } from '../core/types.ts';
import { expect, floorHour, num, obs } from './_helpers.ts';

const KEY_ENV = 'SR_AISSTREAM_KEY';
const URL_WS = 'wss://stream.aisstream.io/v0/stream';
export const SESSION_MS = 55_000;
const HARD_EXTRA_MS = 5_000;
export const SIG_JUMPS = 'cyber.physical.ais_position_jumps';
export const SIG_PORT = 'cyber.physical.port_congestion';
export const SIG_CABLE = 'cyber.attention.ship_ais_aggregate';
const KN = 1852 / 3600; // m/s per knot
const JUMP_KN = 60;
const JUMP_MIN_M = 2000;

export type BoxKind = 'cable' | 'port';
export interface Box { slug: string; kind: BoxKind; sw: [number, number]; ne: [number, number] }
export const BOXES: Box[] = [
  { slug: 'gulf-of-finland', kind: 'cable', sw: [59.3, 22.5], ne: [60.4, 27.0] },
  { slug: 'central-baltic', kind: 'cable', sw: [54.6, 13.5], ne: [57.6, 21.2] },
  { slug: 'rotterdam', kind: 'port', sw: [51.85, 3.3], ne: [52.15, 4.2] },
  { slug: 'elbe', kind: 'port', sw: [53.75, 7.8], ne: [54.15, 8.8] },
];
const POSITION_TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'];

export function subscription(key: string): string {
  return JSON.stringify({ APIKey: key, BoundingBoxes: BOXES.map((b) => [b.sw, b.ne]), FilterMessageTypes: POSITION_TYPES });
}

export interface Fix { mmsi: string; t: number; lat: number; lon: number; sog: number | null; status: number | null }

function parseTime(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  // e.g. "2026-11-20 10:00:01.123456789 +0000 UTC" or ISO
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/.exec(x.trim());
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}${m[3] ? m[3].slice(0, 4) : ''}Z`);
  return Number.isFinite(t) ? t : null;
}

/** Extracts position fixes from raw stream messages. `__t` (receipt time, ms) is used when MetaData has no time. */
export function parseMessages(messages: unknown[]): Fix[] {
  const list = expect(Array.isArray(messages) ? messages : null, 'Nachrichtenliste');
  const out: Fix[] = [];
  for (const m of list as Record<string, any>[]) {
    if (!m || !POSITION_TYPES.includes(m.MessageType)) continue;
    const meta = m.MetaData ?? {};
    const body = m.Message?.[m.MessageType] ?? {};
    if (body.Valid === false) continue;
    const mmsi = String(meta.MMSI ?? body.UserID ?? '');
    const lat = num(meta.Latitude ?? meta.latitude ?? body.Latitude);
    const lon = num(meta.Longitude ?? meta.longitude ?? body.Longitude);
    const t = parseTime(meta.time_utc) ?? num(m.__t);
    if (!mmsi || lat === null || lon === null || t === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push({ mmsi, t, lat, lon, sog: num(body.Sog), status: num(body.NavigationalStatus) });
  }
  return out;
}

function boxOf(f: Fix): Box | undefined {
  return BOXES.find((b) => f.lat >= Math.min(b.sw[0], b.ne[0]) && f.lat <= Math.max(b.sw[0], b.ne[0])
    && f.lon >= Math.min(b.sw[1], b.ne[1]) && f.lon <= Math.max(b.sw[1], b.ne[1]));
}

function distM(a: Fix, b: Fix): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371_000 * Math.asin(Math.sqrt(h));
}

export interface SessionStats { ships: number; jumps: number; anchoredPort: number; slowCable: number; fixes: number }

export function aggregate(fixes: Fix[]): SessionStats {
  const byShip = new Map<string, Fix[]>();
  for (const f of fixes) {
    if (!byShip.has(f.mmsi)) byShip.set(f.mmsi, []);
    byShip.get(f.mmsi)!.push(f);
  }
  let jumps = 0;
  const port = new Set<string>();
  const cable = new Set<string>();
  for (const [mmsi, fs] of byShip) {
    fs.sort((a, b) => a.t - b.t);
    for (let i = 1; i < fs.length; i++) {
      const d = distM(fs[i - 1], fs[i]);
      const dt = Math.max(1, (fs[i].t - fs[i - 1].t) / 1000);
      if (d > JUMP_MIN_M && d / dt > JUMP_KN * KN) { jumps++; break; }
    }
    for (const f of fs) {
      const box = boxOf(f);
      if (box?.kind === 'port' && f.status === 1) port.add(mmsi);
      if (box?.kind === 'cable' && f.sog !== null && f.sog < 1 && f.status !== 5) cable.add(mmsi);
    }
  }
  return { ships: byShip.size, jumps, anchoredPort: port.size, slowCable: cable.size, fixes: fixes.length };
}

export function toObservations(s: SessionStats, now: Date): Observation[] {
  if (s.fixes === 0) throw new Error('aisstream: keine Positionsmeldung in der Sitzung (Stream gestört oder Key ungültig)');
  const ts = floorHour(now);
  return [
    obs(SIG_JUMPS, ts, s.jumps, { ships: s.ships, share: s.ships ? Math.round((s.jumps / s.ships) * 1000) / 1000 : 0 }),
    obs(SIG_PORT, ts, s.anchoredPort),
    obs(SIG_CABLE, ts, s.slowCable),
  ];
}

/** Minimal WebSocket surface used here (Node 22 global WebSocket fits). */
export interface WsLike {
  binaryType: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}
export type WsCtor = new (url: string) => WsLike;

async function decode(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data as Uint8Array);
  if (data && typeof (data as Blob).text === 'function') return (data as Blob).text();
  return String(data);
}

/** Opens one session, collects raw messages for `durationMs`, always closes. Early close or error rejects (partial sample would bias counts). */
export function runSession(Ws: WsCtor, key: string, durationMs: number, log: (m: string) => void): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const msgs: unknown[] = [];
    const pending: Promise<void>[] = [];
    let done = false;
    let ws: WsLike;
    const finish = async (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(soft); clearTimeout(hard);
      try { ws.close(); } catch { /* already closed */ }
      await Promise.allSettled(pending);
      if (err) reject(err); else resolve(msgs);
    };
    const soft = setTimeout(() => void finish(), durationMs);
    const hard = setTimeout(() => void finish(new Error('aisstream: harte Zeitgrenze erreicht')), durationMs + HARD_EXTRA_MS);
    try { ws = new Ws(URL_WS); } catch (e) { clearTimeout(soft); clearTimeout(hard); reject(e as Error); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { try { ws.send(subscription(key)); } catch (e) { void finish(e as Error); } };
    ws.onmessage = (ev) => {
      pending.push(decode(ev.data).then((s) => {
        try {
          const m = JSON.parse(s) as Record<string, any>;
          if (m?.MessageType === 'SubscriptionConfirmation') { log(`Abo bestätigt, Kompression: ${m.Message?.CompressionEnabled}`); return; }
          if (m?.error) { log(`Fehler vom Stream: ${String(m.error).slice(0, 120)}`); return; }
          m.__t = Date.now();
          msgs.push(m);
        } catch { /* ignore malformed frame */ }
      }));
    };
    ws.onerror = () => void finish(new Error('aisstream: WebSocket-Fehler'));
    ws.onclose = () => void finish(new Error('aisstream: Verbindung vom Server geschlossen'));
  });
}

const LICENSE = 'aisstream.io: Nutzungsbedingungen unklar (keine Terms-Seite gefunden); nur Aggregate, Quelle aisstream.io nennen';
const baseline = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };
const common = { manipulability: 'medium' as const, independenceGroup: 'aisstream', kind: 'count' as const, direction: 'up' as const,
  intervalMinutes: 60, holdHours: 6, baseline, license: LICENSE, sourceName: 'aisstream.io', sourceUrl: 'https://aisstream.io/documentation' };

export function createCollector(getWs: () => WsCtor | undefined, sessionMs = SESSION_MS): Collector {
  return {
    id: 'aisstream',
    title: 'aisstream.io (AIS-Stichprobe Ostsee-Kabel und Nordsee-Häfen)',
    sourceUrl: 'https://aisstream.io/documentation',
    needsKey: KEY_ENV,
    intervalMinutes: 60,
    signals: [
      { ...common, id: SIG_JUMPS, scenarios: ['cyber'], domain: 'physical', name: 'AIS-Positionssprünge', evidenceClass: 'A', weight: 0.35,
        unit: 'Schiffe', plain: 'Wie viele Schiffe in einer Stichprobe unplausibel weit springen (Hinweis auf GPS-Störung oder Fälschung).',
        banalCauses: ['Technische Fehler', 'GPS-Störungen in der Ostsee', 'Fehlerhafte Transponder'] },
      { ...common, id: SIG_PORT, scenarios: ['cyber'], domain: 'physical', name: 'Hafenstau', evidenceClass: 'A', weight: 0.25,
        unit: 'Schiffe', plain: 'Wie viele Schiffe vor Rotterdam und der Elbe vor Anker auf Einfahrt warten (Stichprobe).',
        banalCauses: ['Wetter', 'Streik', 'Saison'] },
      { ...common, id: SIG_CABLE, scenarios: ['cyber'], domain: 'attention', name: 'Kabelleger und Schiffsaggregate', evidenceClass: 'D',
        manipulability: 'high', weight: 0.3, unit: 'Schiffe',
        plain: 'Wie viele Schiffe über Ostsee-Kabeltrassen fast stillstehen (nur Gesamtzahl, keine Einzelschiffe).',
        banalCauses: ['Fischerei', 'Wetter', 'Ankern vor Häfen (Helsinki, Tallinn)'] },
    ],
    async collect(ctx) {
      const key = expect(ctx.key(KEY_ENV), KEY_ENV);
      const Ws = expect(getWs(), 'globales WebSocket (Node 22)');
      const msgs = await runSession(Ws, key, sessionMs, ctx.log);
      return { observations: toObservations(aggregate(parseMessages(msgs)), ctx.now) };
    },
  };
}

export default createCollector(() => (globalThis as { WebSocket?: WsCtor }).WebSocket);
