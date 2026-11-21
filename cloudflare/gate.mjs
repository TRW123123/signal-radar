#!/usr/bin/env node
// Gate nach dem Deploy: prüft die workers.dev-Adresse. Rot = Exit 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(HIER, 'seite.json'), 'utf8'));
const dist = path.join(HIER, '..', cfg.dist);
const toml = fs.readFileSync(path.join(HIER, '..', 'netlify.toml'), 'utf8');
const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
const schrift = fs.readdirSync(path.join(dist, 'assets/fonts')).find((f) => f.endsWith('.woff2'));
const nr = String(process.env.GITHUB_RUN_ID || Date.now());
const get = async (p) => {
  const u = new URL(p, cfg.vorschau); u.searchParams.set('gate', nr);
  const res = await fetch(u, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
  return { res, text: await res.text() };
};
const pruefungen = [
  ['Startseite 200 mit Titel', '/', ({ res, text }) => res.status === 200 && /<title>Signal Radar/i.test(text)],
  ['Content-Security-Policy gleich netlify.toml', '/', ({ res }) => !!csp && res.headers.get('content-security-policy') === csp],
  ['nosniff und Referrer-Policy gesetzt', '/', ({ res }) => res.headers.get('x-content-type-options') === 'nosniff' && res.headers.get('referrer-policy') === 'no-referrer'],
  ['app.js 200', '/app.js', ({ res }) => res.status === 200 && /javascript/.test(res.headers.get('content-type') || '')],
  ['app.css 200', '/app.css', ({ res }) => res.status === 200],
  ['snapshot.json 200, gültig, Cache 60 s', '/data/snapshot.json', ({ res, text }) => { try { return res.status === 200 && !!JSON.parse(text).scenarios && /max-age=60/.test(res.headers.get('cache-control') || ''); } catch { return false; } }],
  ['Schrift 200, lang gecacht', `/assets/fonts/${schrift}`, ({ res }) => res.status === 200 && /immutable/.test(res.headers.get('cache-control') || '')],
  ['unbekannte Adresse 404', '/gibtsnicht/', ({ res }) => res.status === 404],
];
let rot = 0;
for (const [name, p, ok] of pruefungen) {
  let bestanden = false, detail = '';
  // Die Verteilung an die Cloudflare-Rechenzentren braucht manchmal einige Sekunden.
  for (let i = 0; i < 8 && !bestanden; i++) {
    try { const a = await get(p); bestanden = ok(a); detail = `HTTP ${a.res.status}`; } catch (e) { detail = e.message; }
    if (!bestanden) await new Promise((r) => setTimeout(r, 10000));
  }
  console.log(`${bestanden ? 'GRUEN' : 'ROT  '} ${name} (${detail})`);
  if (!bestanden) rot++;
}
console.log(rot ? `GATE ROT: ${rot} Prüfung(en) durchgefallen` : 'GATE GRUEN');
process.exit(rot ? 1 : 0);
