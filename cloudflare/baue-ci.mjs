#!/usr/bin/env node
// Veröffentlichungsweg signal-radar (Cloudflare Worker "site-signal-radar", nur Dateien, keine Funktionen).
// Läuft in der GitHub Action .github/workflows/deploy-cloudflare.yml, geht aber auch lokal.
// Gleiche Schritte wie cf-umzug/baue.mjs mit "nurAssets": netlify.toml -> frontend/_headers und _redirects,
// wrangler.jsonc, dann Deploy. Es gibt keinen Build-Schritt: frontend/ wird so ausgeliefert, wie es eingecheckt ist.
// Deploy läuft nur auf die workers.dev-Adresse; Routen auf eine eigene Domain gibt es nicht.
//
//   node cloudflare/baue-ci.mjs              vorbereiten und deployen
//   node cloudflare/baue-ci.mjs --nur-bauen  nur vorbereiten (PR-Prüfung)
// Deploy braucht CLOUDFLARE_API_TOKEN und CLOUDFLARE_ACCOUNT_ID in der Umgebung.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { netlifyZuCloudflare } from './netlify-regeln.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HIER, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(HIER, 'seite.json'), 'utf8'));
const dist = path.join(REPO, cfg.dist);
const WRANGLER = ['--yes', 'wrangler@4.165.0'];

if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error(`${cfg.dist}/ fehlt oder leer.`); process.exit(1); }

const vorschauNoindex = `https://${cfg.worker}.safak-t.workers.dev/*\n  X-Robots-Tag: noindex\n`;
// Textdateien (Schrift-Lizenzen mit Umlauten) brauchen den Zeichensatz im Header; Netlify setzt ihn, Cloudflare nicht.
const textHeader = fs.readdirSync(dist, { recursive: true })
  .map((f) => String(f).replace(/\\/g, '/')).filter((f) => f.endsWith('.txt')).slice(0, 60)
  .map((f) => `/${f}\n  Content-Type: text/plain; charset=utf-8\n`).join('');
const regeln = netlifyZuCloudflare(path.join(REPO, 'netlify.toml'), { extraHeaders: vorschauNoindex + textHeader });
fs.writeFileSync(path.join(dist, '_redirects'), regeln.redirects);
fs.writeFileSync(path.join(dist, '_headers'), regeln.headers);
for (const w of regeln.warnungen) console.log('WARNUNG', w);
const dateien = fs.readdirSync(dist, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length;
console.log(`${dateien} Dateien, ${regeln.anzahl} Weiterleitungen`);
if (dateien > 20000) { console.error('Über 20.000 Dateien: Cloudflare-Gratisgrenze'); process.exit(1); }
if (!/Content-Security-Policy/.test(regeln.headers)) { console.error('Sicherheits-Header fehlen: netlify.toml nicht gelesen?'); process.exit(1); }

const wrangler = {
  name: cfg.worker,
  compatibility_date: '2026-11-01',
  workers_dev: true,
  preview_urls: false,
  assets: { directory: `../${cfg.dist}`, html_handling: 'auto-trailing-slash', not_found_handling: 'none' },
  observability: { enabled: true },
};
fs.writeFileSync(path.join(HIER, 'wrangler.jsonc'), JSON.stringify(wrangler, null, 2));
console.log(`Modus: nur ${cfg.vorschau} (keine Routen)`);

if (process.argv.includes('--nur-bauen')) { console.log('vorbereitet, nicht deployt'); process.exit(0); }
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID fehlen.'); process.exit(1);
}
const r = spawnSync('npx', [...WRANGLER, 'deploy'], { cwd: HIER, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const aus = (r.stdout || '') + (r.stderr || '');
console.log(aus.split(/\r?\n/).filter((z) => /Uploaded|https:\/\/|Current Version|Total Upload|assets|ERROR|error/i.test(z)).join('\n'));
if (r.status !== 0) { console.error('wrangler deploy fehlgeschlagen'); process.exit(1); }
