import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributionsForSignals, footerNoticesFor, SOURCE_ATTRIBUTIONS } from '../src/core/attribution.ts';

const FRED = 'This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.';
const NVD = 'This product uses the NVD API but is not endorsed or certified by the NVD.';

test('attribution: match by collector id, including mirrors', () => {
  const ids = attributionsForSignals([{ collector: 'github-gas-storage' }, { collector: 'github-oil-prices' }, { collector: 'threatfox' }]).map((a) => a.id);
  assert.deepEqual(ids, ['abuse-ch', 'agsi', 'eia']);
});

test('attribution: sourceName is the fallback when no collector is given or it is unknown', () => {
  assert.deepEqual(attributionsForSignals([{ sourceName: 'ACLED API' }]).map((a) => a.id), ['acled']);
  assert.deepEqual(attributionsForSignals([{ collector: 'unknown', sourceName: 'NVD CVE API 2.0' }]).map((a) => a.id), ['nvd-cve-api']);
  assert.deepEqual(attributionsForSignals([{ collector: 'ioda', sourceName: 'IODA' }, {}]), []);
});

test('attribution: collector match wins over sourceName hints', () => {
  // the GitHub mirror names AGSI+ in its sourceName, but only the collector decides
  const ids = attributionsForSignals([{ collector: 'github-oil-prices', sourceName: 'GIE AGSI+ and EIA' }]).map((a) => a.id);
  assert.deepEqual(ids, ['eia']);
});

test('attribution: footer notices are unique and in stable order', () => {
  const both = attributionsForSignals([{ collector: 'alsi' }, { collector: 'agsi' }, { collector: 'agsi' }]);
  assert.equal(both.length, 2);
  const notices = footerNoticesFor(both);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /GIE AGSI \/ ALSI platform/);
  const all = footerNoticesFor(SOURCE_ATTRIBUTIONS);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(footerNoticesFor([...SOURCE_ATTRIBUTIONS].reverse()).sort(), [...all].sort());
});

test('attribution: verbatim notices and required credits are present', () => {
  const by = (id: string) => SOURCE_ATTRIBUTIONS.find((a) => a.id === id)!;
  assert.ok(by('fred').footerNotices.includes(FRED));
  assert.ok(by('fred').footerNotices.some((n) => n.includes('https://fred.stlouisfed.org/docs/api/terms_of_use.html')));
  assert.ok(by('nvd-cve-api').footerNotices.includes(NVD));
  assert.equal(by('cf-radar').attribution, 'Cloudflare Radar');
  assert.equal(by('abuse-ch').attribution, 'abuse.ch');
  assert.equal(by('eia').attribution, 'U.S. Energy Information Administration (EIA)');
  assert.equal(by('nasa-firms').attribution, 'NASA FIRMS');
  assert.match(by('acled').attribution, /ACLED/);
  assert.equal(by('acled').attributionUrl, 'https://acleddata.com');
  assert.ok(by('acled').restrictions!.some((r) => /Aggregate/.test(r) && /Rohereignisse/.test(r)));
  assert.equal(by('opensky').status, 'blocked-pending-license');
  assert.equal(by('entsoe').status, 'pending-terms');
  assert.equal(new Set(SOURCE_ATTRIBUTIONS.map((a) => a.id)).size, SOURCE_ATTRIBUTIONS.length);
});

test('attribution: buildSnapshot attaches notices only for signals that show data', async () => {
  const { buildSnapshot } = await import('../src/pipeline/snapshot.ts');
  const def = (id: string, collector: string, sourceName: string, status = 'active') => ({
    id, scenarios: ['cyber'], domain: 'threat', name: id, plain: '', evidenceClass: 'A', direction: 'up', kind: 'count', weight: 0.5,
    manipulability: 'low', independenceGroup: id, collector, baseline: { method: 'rolling', windowDays: 28, minPoints: 5 },
    intervalMinutes: 60, status, sourceName, sourceUrl: 'https://example.org', license: `L-${id}`,
  });
  const catalog = {
    scenarios: [{ id: 'cyber', title: 'C', question: '?', tagline: '', order: 1, domains: { threat: { title: 'T', weight: 1 } } }], rules: [],
    signals: [def('a', 'threatfox', 'abuse.ch ThreatFox'), def('b', 'nvd-cve-api', 'NVD'), def('c', 'acled', 'ACLED', 'planned')],
  };
  const store = {
    read: async (id: string) => (id === 'a' ? [{ signalId: 'a', ts: '2026-11-17T11:00:00Z', value: 3 }] : []),
    getJson: async () => null,
  };
  const snap = await buildSnapshot(catalog as any, store as any, { now: new Date('2026-11-17T12:00:00Z'), sensitivity: 'normal', mode: 'snapshot', historyDays: 0 });
  assert.equal(snap.schema, 1);
  assert.deepEqual(snap.attributions?.map((a) => a.id), ['abuse-ch']);
  const a = snap.scenarios[0].domains[0].signals.find((v) => v.id === 'a')!;
  assert.equal(a.collector, 'threatfox');
  assert.equal(a.license, 'L-a');
});

test('attribution: Pflichtangaben der Welle-1-Quellen (20.11.2026)', () => {
  const by = (id: string) => SOURCE_ATTRIBUTIONS.find((a) => a.id === id)!;
  assert.ok(by('gfw').footerNotices.some((n) => n.startsWith('Powered by Global Fishing Watch.') && n.includes('https://globalfishingwatch.org')));
  assert.ok(by('coingecko').footerNotices.some((n) => n.startsWith('Data provided by CoinGecko') && n.includes('https://www.coingecko.com')));
  assert.ok(by('fingrid').footerNotices.includes('Source: Fingrid, data.fingrid.fi'));
  assert.equal(by('shadowserver').attribution, '© The Shadowserver Foundation');
  assert.equal(by('ghsa').attributionUrl, 'https://github.com/advisories');
  const covered = new Set(SOURCE_ATTRIBUTIONS.flatMap((a) => a.collectors));
  for (const c of ['gfw', 'fingrid', 'nasa-firms', 'nvd-cve-api', 'ghsa', 'github-rest', 'coingecko', 'metaculus', 'reddit-json', 'shadowserver', 'otx',
    'aisstream', 'faa-notam', 'space-track', 'alerts-in-ua', 'fred', 'eia', 'agsi', 'alsi']) assert.ok(covered.has(c), c);
});
