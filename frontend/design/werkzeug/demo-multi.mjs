// Baut frontend/data/demo-multi.json aus den vorhandenen Demo-Dateien (alle mit erfundenen Daten).
// Fünf Szenarien in verschiedenen Zuständen, nur zum Testen der Szenario-Wahl. Aufruf:
//   node frontend/design/werkzeug/demo-multi.mjs
// Die Bereiche und Messreihen stammen aus der Cyber-Demo und sind in den anderen Szenarien reine Platzhalter.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');
const load = (s) => JSON.parse(readFileSync(join(dataDir, `demo-${s}.json`), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const base = load('calm');
const take = (state, patch) => ({ ...clone(load(state).scenarios[0]), ...patch });

const cyber = take('elevated', {});
// Ein gedämpfter Ausschlag, damit der Dämpfungsgrund in der Oberfläche geprüft werden kann (Demo, erfunden).
for (const d of cyber.domains) for (const s of d.signals) {
  if (s.id === 'cyber.services.demo_8k') s.damp = { factor: 0.5, reason: 'Demo: Quartalsende, an dem viele Firmen gesammelt melden' };
}

const blackout = take('calm', {
  id: 'blackout', title: 'Blackout / Energie', question: 'Droht gerade ein großer Stromausfall?',
  tagline: 'Demo-Platzhalter: Bereiche aus der Cyber-Demo',
});
const krieg = take('rumor', {
  id: 'krieg', title: 'Kriegseskalation', question: 'Eskaliert gerade ein bewaffneter Konflikt?',
  tagline: 'Demo-Platzhalter: Bereiche aus der Cyber-Demo',
});
const finanz = take('acute', {
  id: 'finanz', title: 'Finanzkrise', question: 'Bahnt sich gerade eine Finanzkrise an?',
  tagline: 'Demo-Platzhalter: Bereiche aus der Cyber-Demo',
});

// Zu wenig Daten: nur zwei Bereiche liefern frische Messwerte, alle übrigen bleiben leer.
const ki = take('calm', {
  id: 'ki', title: 'KI-Vorfall', question: 'Läuft gerade ein schwerer Vorfall mit KI-Systemen?',
  tagline: 'Demo-Platzhalter: Bereiche aus der Cyber-Demo',
});
const keep = new Set(['routing', 'outages']);
let fresh = 0;
for (const d of ki.domains) {
  for (const s of d.signals) {
    if (s.status !== 'active') continue;
    if (keep.has(d.id)) { fresh += 1; continue; }
    Object.assign(s, { value: null, ts: null, fresh: false, baseline: null, z: null, anomaly: 0, contribution: 0, spark: [], sparkStart: null, sparkEnd: null });
  }
  if (!keep.has(d.id)) { d.score = 0; d.active = false; }
}
for (const h of ki.history) {
  for (const id of Object.keys(h.d)) if (!keep.has(id)) h.d[id] = 0;
  h.activeDomains = Object.entries(h.d).filter(([id, v]) => keep.has(id) && v >= 0.25).length;
  h.level = Math.min(h.level, h.activeDomains);
  h.score = h.activeDomains ? h.score : 0;
}
ki.coverage = { ...ki.coverage, fresh, domainsWithData: keep.size };
ki.confidence = Math.round((fresh / ki.coverage.active) * 100) / 100;
ki.verdict = 'Noch zu wenig Messdaten für eine belastbare Aussage.';
ki.attention = 0; ki.rumorGap = 'none'; ki.activeDomains = 0; ki.anomalies = [];
for (const s of ki.attentionSignals) if (s.status === 'active') Object.assign(s, { value: null, ts: null, fresh: false, baseline: null, z: null, anomaly: 0, contribution: 0, spark: [], sparkStart: null, sparkEnd: null });
for (const h of ki.history) h.attention = 0;

const snap = {
  ...base,
  note: 'DEMO mit erfundenen Daten: fünf Beispiel-Szenarien. Bereiche und Messreihen stammen aus der Cyber-Demo und sind außerhalb von „Cyberangriff“ nur Platzhalter.',
  scenarios: [cyber, blackout, krieg, finanz, ki],
};
writeFileSync(join(dataDir, 'demo-multi.json'), JSON.stringify(snap, null, 1));
console.log('demo-multi.json', snap.scenarios.map((s) => `${s.id}:${s.level}`).join(' '), 'ki confidence', ki.confidence);
