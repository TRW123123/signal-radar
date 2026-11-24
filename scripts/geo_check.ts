// Prüft catalog/geo.json: Wertebereiche, Abdeckung je Szenario, Liste der ortlosen Signale und aller Zuordnungen.
// Aufruf: node scripts/geo_check.ts
import { loadCatalog } from '../src/core/catalog.ts';
import { activate, discoverCollectors } from '../src/core/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const catalog = loadCatalog(root);
const all = activate(catalog, await discoverCollectors(root), process.env).signals;
const active = all.filter((s) => s.collector && s.status !== 'planned' && s.status !== 'license-unclear');

const errors: string[] = [];
for (const r of catalog.geo) {
  const where = `${r.label} [${r.appliesTo[0]}]`;
  if (!(r.lat >= -90 && r.lat <= 90)) errors.push(`lat außerhalb: ${where}`);
  if (!(r.lon >= -180 && r.lon <= 180)) errors.push(`lon außerhalb: ${where}`);
  if (r.kind === 'country' && !/^[A-Z]{2}$/.test(r.cc ?? '')) errors.push(`cc fehlt/ungültig: ${where}`);
  if (r.kind !== 'country' && r.cc) errors.push(`cc bei Nicht-Land: ${where}`);
  if (!r.label || !r.appliesTo.length) errors.push(`leer: ${where}`);
}
console.log(`Regeln: ${catalog.geo.length}`);

const scenarios = [...new Set(active.map((s) => s.id.split('.')[0]))];
for (const sc of scenarios) {
  const xs = active.filter((s) => s.id.startsWith(sc + '.'));
  console.log(`${sc}: ${xs.filter((s) => s.geo).length} von ${xs.length} aktiven Signalen mit Ort`);
}
console.log(`gesamt aktiv: ${active.filter((s) => s.geo).length} von ${active.length}`);
const catalogOnly = all.filter((s) => !active.includes(s));
console.log(`nur katalogisiert: ${catalogOnly.filter((s) => s.geo).length} von ${catalogOnly.length} mit Ort`);

console.log('\n--- aktive Signale OHNE Ort ---');
for (const s of active.filter((s) => !s.geo)) console.log(s.id);
console.log('\n--- Zuordnungen (aktiv) ---');
for (const s of active.filter((s) => s.geo)) console.log(`${s.id} -> ${s.geo!.label} (${s.geo!.kind}, ${s.geo!.lat}, ${s.geo!.lon})`);
console.log('\n--- Zuordnungen (nur katalogisiert) ---');
for (const s of catalogOnly.filter((s) => s.geo)) console.log(`${s.id} -> ${s.geo!.label} (${s.geo!.kind}, ${s.geo!.lat}, ${s.geo!.lon})`);

const dead = catalog.geo.filter((r) => !all.some((s) => r.appliesTo.some((p) => globRe(p).test(s.id))));
if (dead.length) console.log('\nRegeln ohne Treffer: ' + dead.map((r) => r.label).join('; '));
function globRe(p: string): RegExp {
  return new RegExp('^' + p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}
if (errors.length) {
  console.error('\nFEHLER:\n' + errors.join('\n'));
  process.exit(1);
}
