import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { HOSTS, INCIDENT_HOSTS, aggregate, incidentSeries, isStatusHost, parseIncidents, parseIndicator, statusUrl } from '../../src/collectors/statuspage.ts';
import type { HostResult } from '../../src/collectors/statuspage.ts';

// Echte Antwort (gekürzt, 17.11.2026, status.circle.com): major; Gegenstück mit Fremdnamen siehe SendGrid-Umleitung (page.name Twilio).
const REAL = { page: { id: 'x', name: 'Circle', url: 'https://status.circle.com', updated_at: '2026-11-17T00:10:00Z' }, status: { description: 'Major System Outage', indicator: 'major' } };

// Beispiel nach Doku nachgebaut (Atlassian Statuspage status.json).
const SAMPLE = { page: { id: 'kctbh9vrtdwd', name: 'GitHub', url: 'https://www.githubstatus.com' }, status: { indicator: 'minor', description: 'Minor Service Outage' } };

test('parseIndicator: Normalfall', () => {
  assert.equal(parseIndicator(SAMPLE), 'minor');
  assert.equal(parseIndicator({ status: { indicator: 'none' } }), 'none');
  assert.equal(parseIndicator({ status: { indicator: 'maintenance' } }), 'none');
});
test('parseIndicator: leere Antwort und fehlendes Feld', () => {
  assert.throws(() => parseIndicator({} as never), /status/);
  assert.throws(() => parseIndicator({ status: {} }), /indicator/);
  assert.throws(() => parseIndicator({ status: { indicator: 'weird' } }), /indicator/);
});
test('Hostliste: mindestens 40, höchstens 60, eindeutig', () => {
  assert.ok(HOSTS.length >= 40 && HOSTS.length <= 60);
  assert.equal(new Set(HOSTS.map((h) => h.host)).size, HOSTS.length);
});
const mk = (category: string, indicator: HostResult['indicator'], i: number): HostResult => ({ host: `h${i}`, category, indicator });
test('aggregate: Anteile und Kategorien', () => {
  const r = [mk('cloud', 'none', 1), mk('cloud', 'major', 2), mk('payment', 'minor', 3), mk('payment', 'none', 4), mk('saas', 'none', 5)];
  const a = aggregate(r, 5)!;
  assert.equal(a.disruptionPct, 40);
  assert.equal(a.majorPct, 20);
  assert.equal(a.byCategory.cloud.pct, 50);
  assert.equal(a.byCategory.payment.n, 2);
});
test('aggregate: unter 60 % Antworten keine Meldung, leer ebenso', () => {
  assert.equal(aggregate([mk('cloud', 'none', 1)], 5), null);
  assert.equal(aggregate([], 5), null);
});
test('collect: ein Host fällt aus, Rest zählt; zu wenige Antworten ergeben keine Beobachtung', async () => {
  const mkCtx = (fail: (u: string) => boolean) => ({
    now: new Date('2026-11-17T00:07:00Z'), key: () => undefined, log: () => {},
    http: { json: async (u: string) => { if (fail(u)) throw new Error('HTTP 404'); return { status: { indicator: u.includes('cloudflare') ? 'major' : 'none' } }; }, text: async () => '' },
  });
  const ok = await collector.collect(mkCtx((u) => u.includes('status.npmjs.org/api/v2/status')) as never);
  const major = ok.observations.find((o) => o.signalId === 'cyber.services.statuspage_incident_rate')!;
  assert.equal(major.ts, '2026-11-17T00:00:00.000Z');
  assert.ok(major.value > 0 && major.value < 5);
  assert.equal(ok.observations.length, 4);
  const bad = await collector.collect(mkCtx((u) => !u.includes('github')) as never);
  assert.equal(bad.observations.length, 0);
});

test('parseIndicator: echte Antwort (Circle, major)', () => {
  assert.equal(parseIndicator(REAL), 'major');
});
test('Hostliste: nur bereinigte Hosts, keine Umleitung auf fremde Seite', () => {
  assert.ok(!HOSTS.some((h) => h.host === 'status.sendgrid.com'));
});

test('isStatusHost: nur DNS-Namen, statusUrl bleibt auf dem Host', () => {
  assert.equal(isStatusHost('www.githubstatus.com'), true);
  assert.equal(isStatusHost('127.0.0.1'), false);
  assert.equal(isStatusHost('localhost'), false);
  assert.equal(isStatusHost('status.example.com@evil.com'), false);
  assert.equal(isStatusHost('evil.com/api'), false);
  assert.equal(isStatusHost('a.b'), true);
  assert.ok(HOSTS.every((h) => isStatusHost(h.host)));
  assert.ok(INCIDENT_HOSTS.every((h) => isStatusHost(h)));
  assert.equal(statusUrl('status.circle.com', 'status'), 'https://status.circle.com/api/v2/status.json');
  assert.equal(statusUrl('www.githubstatus.com', 'incidents'), 'https://www.githubstatus.com/api/v2/incidents.json');
  assert.throws(() => statusUrl('127.0.0.1', 'status'), /ungueltiger Host/);
  assert.throws(() => statusUrl('user:pass@status.circle.com', 'status'), /ungueltiger Host/);
});

// Form nach Doku nachgebaut (incidents.json), Fixture noch nicht aufgezeichnet.
const inc = (day: string, impact: string) => ({ created_at: `${day}T10:00:00.000Z`, impact });
test('parseIncidents: zählt nur Störungen mit Wirkung, erkennt volle Liste', () => {
  const l = parseIncidents({ incidents: [inc('2026-11-10', 'major'), inc('2026-11-11', 'minor'), inc('2026-11-12', 'none')] });
  assert.equal(l.starts.length, 2);
  assert.equal(l.starts.filter((s) => s.major).length, 1);
  assert.equal(l.full, false);
  assert.throws(() => parseIncidents({} as never), /incidents/);
});
test('incidentSeries: nur mit allen Antworten, volle Tage, getrennt major', () => {
  const now = new Date('2026-11-17T00:16:00Z');
  const a = parseIncidents({ incidents: [inc('2026-11-10', 'critical'), inc('2026-11-10', 'minor'), inc('2026-11-17', 'major')] });
  const s = incidentSeries([a, parseIncidents({ incidents: [] })], now)!;
  assert.equal(s[s.length - 1].day, '2026-11-16');
  assert.deepEqual(s.find((d) => d.day === '2026-11-10'), { day: '2026-11-10', all: 2, major: 1 });
  assert.equal(incidentSeries([a, null], now), null);
  const full = parseIncidents({ incidents: Array.from({ length: 50 }, () => inc('2026-11-15', 'minor')) });
  assert.equal(incidentSeries([a, full], now), null); // Historie nur 1 Tag
});

// --- Signale je Kategorie aus der Szenario-Konfiguration ---
import { STATUS_SIGNALS, INCIDENT_SIGNALS, MIN_CATEGORY_RESPONDERS } from '../../src/collectors/statuspage.ts';

test('aggregate: je Kategorie auch Anteil schwerer Störungen', () => {
  const r: HostResult[] = [
    { host: 'a', category: 'ai', indicator: 'major' }, { host: 'b', category: 'ai', indicator: 'minor' },
    { host: 'c', category: 'ai', indicator: 'none' }, { host: 'd', category: 'ai', indicator: 'critical' },
  ];
  const a = aggregate(r, 4)!;
  assert.equal(a.byCategory.ai.major, 2);
  assert.equal(a.byCategory.ai.majorPct, 50);
  assert.equal(a.byCategory.ai.pct, 75);
});

test('collect: Kategorie-Signale aus der Konfiguration (payment, cloud), Requests unabhängig von der Zahl der Signale', async () => {
  assert.deepEqual(STATUS_SIGNALS.filter((e) => e.category).map((e) => [e.signal.id, e.category, e.measure]), [
    ['cyber.finance.statuspage_payment_disruption', 'payment', 'disrupted-share'],
    ['cyber.services.statuspage_cloud_disruption', 'cloud', 'disrupted-share'],
  ]);
  assert.equal(INCIDENT_SIGNALS.length, 2);
  assert.equal(MIN_CATEGORY_RESPONDERS, 3);
  const urls: string[] = [];
  const ctx = {
    now: new Date('2026-11-17T00:16:13Z'), key: () => undefined, log: () => {},
    http: { text: async () => '', json: async (u: string) => {
      urls.push(u);
      if (u.endsWith('/incidents.json')) throw new Error('offline');
      const h = HOSTS.find((x) => u.includes(x.host))!;
      return { status: { indicator: h.category === 'cloud' ? 'major' : 'none' } };
    } },
  };
  const r = await collector.collect(ctx as never);
  assert.equal(urls.length, HOSTS.length + 8);
  const cloud = r.observations.find((o) => o.signalId === 'cyber.services.statuspage_cloud_disruption')!;
  assert.equal(cloud.value, 100);
  assert.equal(r.observations.find((o) => o.signalId === 'cyber.finance.statuspage_payment_disruption')!.value, 0);
  const cloudN = HOSTS.filter((h) => h.category === 'cloud').length;
  assert.deepEqual(cloud.meta, { responders: cloudN, disrupted: cloudN });
  assert.equal(r.observations.find((o) => o.signalId === 'cyber.services.statuspage_incident_rate')!.value, (100 * cloudN) / HOSTS.length);
  assert.ok(!r.observations.some((o) => o.signalId.endsWith('_starts_day')));
});
