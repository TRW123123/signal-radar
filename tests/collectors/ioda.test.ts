import { test } from 'node:test';
import assert from 'node:assert/strict';
import collector, { parseSignals, hourlyMeans, parseEventStarts } from '../../src/collectors/ioda.ts';

// nach Doku nachgebaut (nicht echt aufgezeichnet)
const SAMPLE = { error: null, data: [[
  { entityType: 'country', entityCode: 'DE', datasource: 'bgp', from: 3600, until: 10800, step: 1800, nativeStep: 300, values: [10, 20, 30, 40] },
  { entityType: 'country', entityCode: 'DE', datasource: 'ping-slash24', from: 3600, until: 10800, step: 1800, nativeStep: 600, values: [1, null, 3, 5] },
]] };

test('Normalfall: Serien und Stundenmittel', () => {
  const s = parseSignals(SAMPLE);
  assert.equal(s.length, 2);
  const h = hourlyMeans(s[0], 10800);
  assert.deepEqual([...h], [[3600, 15], [7200, 35]]);
  // Stunde mit null-Punkt wird verworfen
  assert.deepEqual([...hourlyMeans(s[1], 10800)], [[7200, 4]]);
});
test('laufende Stunde wird nicht gemeldet', () => {
  assert.equal(hourlyMeans(parseSignals(SAMPLE)[0], 9000).size, 1);
});
test('leere Antwort', () => {
  assert.deepEqual(parseSignals({ data: [] }), []);
  assert.deepEqual(parseEventStarts({ data: [] }), []);
});
test('fehlendes Feld', () => {
  assert.throws(() => parseSignals({}), /data/);
  assert.throws(() => parseEventStarts({}), /data/);
  assert.deepEqual(parseSignals({ data: [[{ datasource: 'bgp' }]] }), []);
});
// gekürzter echter Ausschnitt (17.11.2026, Anfang der Antwort; nach Doku ergänzt um die Serie)
const REAL_EVENTS = { type: 'outages.events', requestParameters: { from: '1793059200', until: '1794873600', limit: 500 }, error: null, perf: null,
  data: [{ location: 'country/GU', start: 1792257000, duration: 2616600, uncertainty: null, method: 'median', datasource: 'ping-slash24', status: 0, fraction: null, score: 913365.78, location_name: 'Guam', overlaps_window: true }] };
test('echte Ereignisform', () => assert.deepEqual(parseEventStarts(REAL_EVENTS), [1792257000]));
test('Ereignisse', () => {
  assert.deepEqual(parseEventStarts({ data: [{ start: 100 }, { start: 'x' }, {}] }), [100]);
});
test('collect: Summe nur bei vollständiger Länderliste', async () => {
  const logs: string[] = [];
  const now = new Date('2026-11-17T00:00:00Z');
  const sec = now.getTime() / 1000;
  const ctx = {
    now, key: () => undefined, log: (m: string) => logs.push(m),
    http: {
      text: async () => '',
      json: async (url: string) => {
        if (url.includes('/outages/events')) return { data: [{ start: sec - 86400 + 5 }, { start: sec - 86400 * 3 }] };
        if (url.includes('/country/US')) throw new Error('boom');
        const ds = url.includes('ping-slash24') ? 'ping-slash24' : 'bgp';
        return { data: [[{ datasource: ds, from: sec - 7200, step: 3600, values: [5, 6] }]] };
      },
    },
  };
  const r = await collector.collect(ctx as never);
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.outages.ioda_country_signals_de'));
  assert.ok(!r.observations.some((o) => o.signalId === 'cyber.outages.ioda_bgp_big_countries'));
  assert.ok(r.observations.some((o) => o.signalId === 'cyber.outages.ioda_ping_de'));
  const ev = r.observations.filter((o) => o.signalId === 'cyber.outages.ioda_outage_events_global');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].value, 1); // nur Ereignisse mit Start im letzten vollständigen Tag
  assert.ok(r.observations.every((o) => Number.isFinite(o.value)));
});

// --- Szenario war ---
import { WAR_COUNTRIES, GULF_COUNTRIES } from '../../src/collectors/ioda.ts';

function warCtx(fail: (url: string) => boolean) {
  const now = new Date('2026-11-17T00:00:00Z');
  const sec = now.getTime() / 1000;
  const urls: string[] = [];
  return { urls, ctx: {
    now, key: () => undefined, log: () => {},
    http: { text: async () => '', json: async (url: string) => {
      urls.push(url);
      if (fail(url)) throw new Error('boom');
      if (url.includes('/outages/events')) return { data: [] };
      return { data: [[{ datasource: 'bgp', from: sec - 7200, step: 3600, values: [5, 6] }]] };
    } },
  } };
}

test('war: Länder, URL-Form unverändert (24 Stunden, datasource=bgp), Golf-Summe nur bei allen drei', async () => {
  const { ctx, urls } = warCtx(() => false);
  const r = await collector.collect(ctx as never);
  const sec = 1794873600;
  for (const cc of [...WAR_COUNTRIES.map((c) => c.cc), ...GULF_COUNTRIES]) {
    assert.ok(urls.includes(`https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country/${cc}?from=${sec - 86400}&until=${sec}&datasource=bgp`), cc);
  }
  const gulf = r.observations.filter((o) => o.signalId === 'war.connectivity.gulf_states_internet');
  assert.equal(gulf.length, 2);
  assert.equal(gulf[0].value, 15);
  assert.ok(r.observations.some((o) => o.signalId === 'war.connectivity.ioda_ir'));
  const sigs = collector.signals.filter((s) => s.id.startsWith('war.'));
  assert.deepEqual(sigs.map((s) => s.id).sort(), ['war.connectivity.gulf_states_internet', 'war.connectivity.ioda_il', 'war.connectivity.ioda_ir',
    'war.connectivity.ioda_ru', 'war.connectivity.ioda_tw', 'war.connectivity.ioda_ua']);
  assert.ok(sigs.every((s) => s.domain === 'connectivity' && s.direction === 'down' && s.scenarios!.join() === 'war'));
});

test('war: fehlt ein Golfland, entfällt nur die Summe; fehlt IR, nur das IR-Signal', async () => {
  const { ctx } = warCtx((u) => u.includes('/country/QA?') || u.includes('/country/IR?'));
  const r = await collector.collect(ctx as never);
  const ids = new Set(r.observations.map((o) => o.signalId));
  assert.ok(!ids.has('war.connectivity.gulf_states_internet') && !ids.has('war.connectivity.ioda_ir'));
  assert.ok(ids.has('war.connectivity.ioda_ua') && ids.has('cyber.outages.ioda_country_signals_de') && ids.has('cyber.outages.ioda_bgp_big_countries'));
});
