import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import collector, { parseTotal, targetDay, searchUrl } from '../../src/collectors/sam-gov.ts';
import { runCollectors } from '../../src/pipeline/collect.ts';
import { activate } from '../../src/core/registry.ts';
import { fileStore } from '../../src/core/store.ts';
import type { HttpClient } from '../../src/core/types.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
// Nach Doku nachgebaut (open.gsa.gov Beispiel 1, gekürzt, ohne Kontaktdaten)
const SAMPLE = { totalRecords: 34, limit: 1, offset: 0, opportunitiesData: [{ noticeId: '5b345bbb7127b91a3ad577b203fc6f68', title: 'Historic Office Renovation',
  postedDate: '2018-05-04', type: 'Award Notice', naicsCode: '236220' }], links: [] };

test('parseTotal: Normalfall, leer, fehlendes Feld, Fehlerobjekt', () => {
  assert.equal(parseTotal(SAMPLE), 34);
  assert.equal(parseTotal({ totalRecords: 0, limit: 1, offset: 0, opportunitiesData: [] }), 0);
  assert.throws(() => parseTotal({ opportunitiesData: [] }), /totalRecords/);
  assert.throws(() => parseTotal({ error: { code: 'API_KEY_INVALID', message: 'An invalid api_key was supplied.' } }), /invalid api_key/);
});
test('targetDay: Tag ist auch an der US-Ostküste vorbei', () => {
  assert.deepEqual(targetDay(new Date('2026-11-20T05:30:00Z')), { iso: '2026-11-18', us: '11/18/2026' });
  assert.deepEqual(targetDay(new Date('2026-11-20T06:30:00Z')), { iso: '2026-11-19', us: '11/19/2026' });
});
test('collect: zwei Requests, Tageswert, Key in Logs geschwärzt', async () => {
  const urls: string[] = [];
  const logs: string[] = [];
  const res = await collector.collect({ now: NOW, key: () => 'SECRETKEY', log: (m) => logs.push(m),
    http: { json: async (u: string) => { urls.push(u); if (u.includes('332993')) throw new Error(`HTTP 500 ${u}`); return SAMPLE as never; }, text: async () => '' } });
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith(searchUrl('SECRETKEY', '11/19/2026', 'ptype=u&ncode=541512').slice(0, 60)));
  assert.deepEqual(res.observations.map((o) => [o.signalId, o.ts, o.value]), [['cyber.services.sam_gov_justifications', '2026-11-19T00:00:00.000Z', 34]]);
  assert.ok(logs[0].includes('REDACTED') && !logs[0].includes('SECRETKEY'));
});
test('ohne Key: Runner überspringt, Signale needs-key', async () => {
  const [r] = await runCollectors([collector], fileStore(mkdtempSync(join(tmpdir(), 'sr-sam-'))), { now: NOW, http: {} as HttpClient, env: {} });
  assert.equal(r.skipped, 'kein Key (SR_SAM_GOV_KEY)');
  assert.ok(activate({ signals: [] } as never, [collector], {}).signals.every((s) => s.status === 'needs-key'));
});
