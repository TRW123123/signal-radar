// Zeigt, welche Requests ein Collector für now = capturedAt (fixtures/META.json) stellt, und welche davon in
// fixtures/queue/<collector>.json fehlen bzw. dort überzählig sind. Ruft keine Quelle ab (alle Requests schlagen offline fehl).
//   node scripts/queue-requests.ts <collector-id> [...]          Vergleich ausgeben
//   node scripts/queue-requests.ts --missing <collector-id> [...]  nur fehlende Einträge als JSON (maxChars bitte anpassen)
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { discoverCollectors } from '../src/core/registry.ts';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const onlyMissing = args[0] === '--missing';
const ids = onlyMissing ? args.slice(1) : args;
if (!ids.length) { console.error('Aufruf: node scripts/queue-requests.ts [--missing] <collector-id> [...]'); process.exit(1); }

const now = new Date(JSON.parse(readFileSync(join(root, 'fixtures', 'META.json'), 'utf8')).capturedAt);
const collectors = await discoverCollectors(root);
for (const id of ids) {
  const c = collectors.find((x) => x.id === id);
  if (!c) { console.error(`unbekannter Collector ${id}`); process.exitCode = 1; continue; }
  const reqs: { fixture: string; url: string }[] = [];
  const raw = async (url: string, init?: { fixture?: string }) => {
    if (!reqs.some((r) => r.url === url)) reqs.push({ fixture: init?.fixture ?? '', url });
    if (url.includes('/outages/events')) return '{"data":[]}'; // ioda: alle Abschnitte der Ereignisliste durchlaufen
    throw new Error('offline');
  };
  const http = { text: raw, json: async (u: string, i?: { fixture?: string }) => JSON.parse(await raw(u, i)) };
  try { await c.collect({ now, http, key: () => undefined, log: () => {} }); } catch { /* offline */ }
  const qFile = join(root, 'fixtures', 'queue', `${id}.json`);
  const queue: { fixture: string; url: string }[] = existsSync(qFile) ? JSON.parse(readFileSync(qFile, 'utf8')) : [];
  const missing = reqs.filter((r) => !queue.some((q) => q.url === r.url && q.fixture === r.fixture));
  const extra = queue.filter((q) => !reqs.some((r) => q.url === r.url && q.fixture === r.fixture));
  if (onlyMissing) { console.log(JSON.stringify(missing.map((m) => ({ ...m, maxChars: 6000 })), null, 2)); continue; }
  console.log(`${id}: ${reqs.length} Requests für ${now.toISOString()}, ${missing.length} fehlen in der Queue, ${extra.length} überzählig`);
  for (const m of missing) console.log(`  fehlt       ${m.fixture}  ${m.url}`);
  for (const e of extra) console.log(`  überzählig  ${e.fixture}  ${e.url}`);
}
