import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { HOSTS, aggregate, parseIndicator } from '../../src/collectors/statuspage.ts';
import type { HostResult } from '../../src/collectors/statuspage.ts';

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
  const ok = await collector.collect(mkCtx((u) => u.includes('status.docker.com')) as never);
  const major = ok.observations.find((o) => o.signalId === 'cyber.services.statuspage_incident_rate')!;
  assert.equal(major.ts, '2026-11-17T00:00:00.000Z');
  assert.ok(major.value > 0 && major.value < 5);
  assert.equal(ok.observations.length, 4);
  const bad = await collector.collect(mkCtx((u) => !u.includes('github')) as never);
  assert.equal(bad.observations.length, 0);
});
