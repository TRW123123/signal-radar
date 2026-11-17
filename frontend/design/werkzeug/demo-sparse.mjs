// Baut frontend/data/demo-sparse.json aus demo-calm.json (erfundene Daten): ein dünn besetzter Snapshot wie im
// echten Betrieb. 4 Bereiche ohne Daten (2 ganz ohne Messreihe, 2 nur mit veralteten), Messreihen mit
// baseline: null, unreifem Normalwert, value: null, fehlender Einheit, leerem/kurzem Verlauf und langem Namen.
// Aufruf: node frontend/design/werkzeug/demo-sparse.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');
const snap = JSON.parse(readFileSync(join(dataDir, 'demo-calm.json'), 'utf8'));
const sc = snap.scenarios[0];
const leer = (s) => Object.assign(s, { value: null, ts: null, fresh: false, baseline: null, z: null, anomaly: 0, contribution: 0, spark: [], sparkStart: null, sparkEnd: null });
const dom = (id) => sc.domains.find((d) => d.id === id);
const ohne = ['markets', 'vuln', 'dns_core', 'threat'];

dom('markets').signals = [];
dom('vuln').signals = [];
for (const s of dom('dns_core').signals) if (s.status === 'active') { leer(s); s.ts = '2026-11-12T09:00:00.000Z'; }
for (const s of dom('threat').signals) if (s.status === 'active') leer(s);
for (const id of ohne) Object.assign(dom(id), { score: 0, active: false, unrest: 0 });
for (const h of sc.history) for (const id of ohne) { h.d[id] = 0; if (h.u) h.u[id] = 0; }

const act = (id) => dom(id).signals.filter((s) => s.status === 'active');
// Normalwert fehlt ganz, Verlauf leer
Object.assign(act('routing')[0], { baseline: null, z: null, spark: [], sparkStart: null, sparkEnd: null });
// Normalwert noch unreif, Verlauf sehr kurz, keine Einheit, langer Name
Object.assign(act('routing')[1], {
  name: 'Zurückgezogene Routen pro Stunde aus dem weltweiten Routing-Austausch (Messpunkte in Europa und Nordamerika)',
  unit: undefined, baseline: { ...act('routing')[1].baseline, mature: false, n: 11 },
});
act('routing')[1].spark = act('routing')[1].spark.slice(-3);
// frisch gemeldet, aber ohne Wert
Object.assign(act('outages')[1], { value: null, z: null });
// unreif ohne Zählerstand
Object.assign(act('finance')[0], { baseline: { center: 0.04, scale: 0.002, n: 0, mature: false } });
delete act('services')[0].unit;

sc.coverage = { ...sc.coverage, fresh: sc.coverage.fresh - 6, domainsWithData: 5 };
sc.confidence = Math.round((sc.coverage.fresh / sc.coverage.active) * 100) / 100;
snap.note = 'DEMO mit erfundenen Daten: dünn besetzter Stand (4 Bereiche ohne Daten, unvollständige Messreihen).';
writeFileSync(join(dataDir, 'demo-sparse.json'), JSON.stringify(snap, null, 1));
console.log('demo-sparse.json', sc.domains.map((d) => `${d.id}:${d.signals.filter((s) => s.fresh).length}`).join(' '));
