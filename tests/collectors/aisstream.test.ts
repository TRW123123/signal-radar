import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import aisstream, { aggregate, createCollector, parseMessages, subscription, toObservations, SIG_CABLE, SIG_JUMPS, SIG_PORT, type WsLike } from '../../src/collectors/aisstream.ts';
import { fileStore } from '../../src/core/store.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import type { HttpClient } from '../../src/core/types.ts';

// Fixture nach Doku nachgebaut (keine echte Aufzeichnung)
const MSGS = JSON.parse(readFileSync(new URL('../../fixtures/aisstream/doc-sample-messages.json', import.meta.url), 'utf8')).messages as unknown[];
const NOW = new Date('2026-11-20T10:01:00Z');

test('parseMessages + aggregate: Normalfall', () => {
  const fixes = parseMessages(MSGS);
  assert.equal(fixes.length, 6);
  assert.deepEqual(aggregate(fixes), { ships: 5, jumps: 1, anchoredPort: 1, slowCable: 2, fixes: 6 });
  const o = toObservations(aggregate(fixes), NOW);
  assert.deepEqual(o.map((x) => [x.signalId, x.ts, x.value]), [
    [SIG_JUMPS, '2026-11-20T10:00:00.000Z', 1], [SIG_PORT, '2026-11-20T10:00:00.000Z', 1], [SIG_CABLE, '2026-11-20T10:00:00.000Z', 2]]);
});

test('leere Sitzung wirft, fehlende Felder werden übersprungen', () => {
  assert.throws(() => toObservations(aggregate(parseMessages([])), NOW), /keine Positionsmeldung/);
  assert.throws(() => parseMessages(null as never), /Nachrichtenliste/);
  const broken = [{ MessageType: 'PositionReport', MetaData: { MMSI: 1 }, Message: { PositionReport: {} } },
    { MessageType: 'PositionReport', MetaData: { MMSI: 2, Latitude: 91, Longitude: 181, time_utc: '2026-11-20 10:00:00 +0000 UTC' }, Message: { PositionReport: {} } },
    { MessageType: 'ShipStaticData', MetaData: { MMSI: 3 } }];
  assert.equal(parseMessages(broken).length, 0);
  // ohne time_utc gilt die Empfangszeit __t
  assert.equal(parseMessages([{ MessageType: 'PositionReport', __t: 1, MetaData: { MMSI: 4, Latitude: 52, Longitude: 4 }, Message: { PositionReport: { Sog: 1 } } }]).length, 1);
});

test('subscription: Key nur im Abo, Bounding Boxes als [[lat,lon],[lat,lon]]', () => {
  const s = JSON.parse(subscription('K'));
  assert.equal(s.APIKey, 'K');
  assert.equal(s.BoundingBoxes.length, 4);
  assert.deepEqual(s.BoundingBoxes[2], [[51.85, 3.3], [52.15, 4.2]]);
});

// Fake-WebSocket: sendet nach dem Abo die Fixture-Nachrichten als binäre Frames
class FakeWs implements WsLike {
  static last: FakeWs | null = null;
  static closeEarly = false;
  binaryType = 'blob';
  onopen: WsLike['onopen'] = null;
  onmessage: WsLike['onmessage'] = null;
  onerror: WsLike['onerror'] = null;
  onclose: WsLike['onclose'] = null;
  sent: string[] = [];
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeWs.last = this;
    setTimeout(() => this.onopen?.({}), 1);
  }
  send(d: string) {
    this.sent.push(d);
    const enc = new TextEncoder();
    this.onmessage?.({ data: enc.encode(JSON.stringify({ MessageType: 'SubscriptionConfirmation', Message: { CompressionEnabled: true } })).buffer });
    for (const m of MSGS) this.onmessage?.({ data: enc.encode(JSON.stringify(m)).buffer });
    if (FakeWs.closeEarly) setTimeout(() => this.onclose?.({}), 1);
  }
  close() { this.closed = true; }
}

test('collect: Sitzung mit Zeitgrenze, Abo gesendet, Verbindung geschlossen', async () => {
  FakeWs.closeEarly = false;
  const c = createCollector(() => FakeWs, 30);
  const logs: string[] = [];
  const res = await c.collect({ now: NOW, key: () => 'K', log: (m) => logs.push(m), http: {} as HttpClient });
  assert.equal(FakeWs.last?.url, 'wss://stream.aisstream.io/v0/stream');
  assert.equal(JSON.parse(FakeWs.last!.sent[0]).APIKey, 'K');
  assert.equal(FakeWs.last?.closed, true);
  assert.equal(res.observations.length, 3);
  assert.match(logs[0], /Kompression: true/);
});

test('collect: vorzeitiges Schließen durch den Server = Fehler', async () => {
  FakeWs.closeEarly = true;
  const c = createCollector(() => FakeWs, 200);
  await assert.rejects(c.collect({ now: NOW, key: () => 'K', log: () => {}, http: {} as HttpClient }), /geschlossen/);
  FakeWs.closeEarly = false;
});

test('Runner: ohne Key übersprungen (kein Verbindungsaufbau)', async () => {
  assert.equal(aisstream.needsKey, 'SR_AISSTREAM_KEY');
  const store = fileStore(mkdtempSync(join(tmpdir(), 'sr-ais-')));
  const [r] = await runCollectors([aisstream], store, { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_AISSTREAM_KEY)');
});

test('collect im Replay-Modus: Fixture statt WebSocket', async () => {
  const old = process.env.SR_FIXTURES;
  process.env.SR_FIXTURES = 'replay';
  try {
    const c = createCollector(() => { throw new Error('kein WebSocket im Replay'); }, 30);
    const raw = readFileSync(new URL('../../fixtures/aisstream/doc-sample-messages.json', import.meta.url), 'utf8');
    const res = await c.collect({ now: NOW, key: () => 'K', log: () => {}, http: { text: async () => raw } as unknown as HttpClient });
    assert.equal(res.observations.length, 3);
  } finally {
    if (old === undefined) delete process.env.SR_FIXTURES; else process.env.SR_FIXTURES = old;
  }
});
