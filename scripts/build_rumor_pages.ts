// Erzeugt je Gerücht aus frontend/data/rumors.json eine statische, teilbare Seite.
// Aufruf: node scripts/build_rumor_pages.ts   (Node 22, keine Abhängigkeiten)
// Ausgabe: frontend/g/<id>/index.html, frontend/g/<id>/en/index.html, frontend/g/index.html, frontend/sitemap.xml
// Die Seiten enthalten kein Urteil über die aktuelle Lage: der Live-Satz wird im Browser von frontend/g/g.js gefüllt.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FE = join(ROOT, 'frontend');
const BASE = 'https://signal-radar.safak-t.workers.dev';

type Quelle = { title: string; url: string };
type Rumor = {
  id: string; title: string; title_en?: string; claim: string; claim_en?: string; date: string; scenario: string;
  factcheck: string; factcheck_en?: string; outcome?: string | null; outcome_en?: string | null; sources: Quelle[];
};
type Sprache = 'de' | 'en';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const kuerze = (t: string, max = 200): string => {
  const erster = t.split(/(?<![0-9])[.!?]\s+(?=[A-ZÄÖÜ])/)[0].replace(/[.!?]?$/, '.');
  if (erster.length <= max) return erster;
  return erster.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
};

const sicherHttp = (u: string): string => (/^https?:\/\//i.test(u) ? u : '#');

const TXT = {
  de: {
    marke: 'Signal Radar', claim: 'Was behauptet wird', fc: 'Was Faktenprüfer sagen', outcome: 'Was am Ende passiert ist',
    quellen: 'Quellen', jetzt: 'Was die Messdaten jetzt zeigen', noscript: 'Die aktuelle Lage zeigt die Startseite mit den Messdaten:',
    noscriptLink: 'Zum Signal Radar', laden: 'Messdaten werden geladen …', live: 'Live auf dem Globus ansehen', teilen: 'Teilen',
    stand: 'Gerücht vom', alle: 'Alle Gerüchte', start: 'Zur Startseite', andere: 'English version', anderLang: 'en',
    liste: 'Gerüchte-Check', listeSatz: 'Gerüchte, die bei uns geprüft wurden. Jede Seite zeigt, was Faktenprüfer sagen, und was die Messdaten jetzt zeigen.',
    sprache: 'Sprache', locale: 'de-DE', ogLocale: 'de_DE', ogAlt: 'en_GB', skip: 'Zum Inhalt springen',
  },
  en: {
    marke: 'Signal Radar', claim: 'What is being claimed', fc: 'What fact-checkers say', outcome: 'What happened in the end',
    quellen: 'Sources', jetzt: 'What the measurements show now', noscript: 'The current situation is shown on the start page with the measurements:',
    noscriptLink: 'Go to Signal Radar', laden: 'Loading measurements …', live: 'See it live on the globe', teilen: 'Share',
    stand: 'Rumour from', alle: 'All rumours', start: 'Start page', andere: 'Deutsche Version', anderLang: 'de',
    liste: 'Rumour check', listeSatz: 'Rumours we have checked. Each page shows what fact-checkers say and what the measurements show now.',
    sprache: 'Language', locale: 'en-GB', ogLocale: 'en_GB', ogAlt: 'de_DE', skip: 'Skip to content',
  },
} as const;

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://raw.githubusercontent.com; base-uri 'none'; form-action 'none'; object-src 'none'";

const wert = (r: Rumor, f: 'title' | 'claim' | 'factcheck' | 'outcome', l: Sprache): string => {
  const v = l === 'en' ? (r as any)[`${f}_en`] : (r as any)[f];
  return typeof v === 'string' ? v : '';
};
const hatEn = (r: Rumor): boolean => !!(r.title_en && r.claim_en && r.factcheck_en);
const pfad = (id: string, l: Sprache): string => (l === 'en' ? `/g/${id}/en/` : `/g/${id}/`);

function kopf(o: { l: Sprache; titel: string; beschr: string; ogTitel: string; ogBeschr: string; url: string; alt: Array<[string, string]>; typ?: string }): string {
  const t = TXT[o.l];
  const alt = o.alt.map(([h, u]) => `<link rel="alternate" hreflang="${h}" href="${esc(u)}">`).join('\n');
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.titel)}</title>
<meta name="description" content="${esc(o.beschr)}">
<meta name="robots" content="index, follow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f1ea">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0e13">
<meta property="og:type" content="${o.typ ?? 'article'}">
<meta property="og:site_name" content="Signal Radar">
<meta property="og:title" content="${esc(o.ogTitel)}">
<meta property="og:description" content="${esc(o.ogBeschr)}">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:locale:alternate" content="${t.ogAlt}">
<meta property="og:url" content="${esc(o.url)}">
<meta property="og:image" content="${BASE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.ogTitel)}">
<meta name="twitter:description" content="${esc(o.ogBeschr)}">
<meta name="twitter:image" content="${BASE}/assets/og.png">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<link rel="canonical" href="${esc(o.url)}">
${alt}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/g/g.css">`;
}

const marke = (l: Sprache): string =>
  `<p class="marke"><a href="/"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" width="22" height="22"><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 13.5c4 2 8 2.5 11 1.5s7-1.5 11 .5M7 22c3-1.5 6-1.5 9-.5s6 1 9-.5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/></svg><span>${TXT[l].marke}</span></a></p>`;

function seite(r: Rumor, l: Sprache): string {
  const t = TXT[l];
  const titel = wert(r, 'title', l);
  const outcome = wert(r, 'outcome', l);
  const url = BASE + pfad(r.id, l);
  const alt: Array<[string, string]> = [['de', BASE + pfad(r.id, 'de')]];
  if (hatEn(r)) alt.push(['en', BASE + pfad(r.id, 'en')], ['x-default', BASE + pfad(r.id, 'de')]);
  else alt.push(['x-default', BASE + pfad(r.id, 'de')]);
  const fc = wert(r, 'factcheck', l);
  const quellen = r.sources
    .map((s) => `<li><a href="${esc(sicherHttp(s.url))}" rel="noopener noreferrer" target="_blank">${esc(s.title)}</a></li>`)
    .join('\n      ');
  const andereLink = l === 'de' ? (hatEn(r) ? `<a href="${pfad(r.id, 'en')}" hreflang="en" lang="en">English</a>` : '') : `<a href="${pfad(r.id, 'de')}" hreflang="de" lang="de">Deutsch</a>`;
  return `<!doctype html>
<html lang="${l}">
<head>
${kopf({ l, titel: `${titel} · Signal Radar`, beschr: kuerze(fc, 160), ogTitel: titel, ogBeschr: kuerze(fc, 200), url, alt })}
<script type="module" src="/g/g.js"></script>
</head>
<body data-szenario="${esc(r.scenario)}" data-sprache="${l}">
<a class="sprung" href="#inhalt">${t.skip}</a>
<div class="seite">
  <header class="kopf">
    ${marke(l)}
    <p class="sprachen">${andereLink}</p>
  </header>
  <main id="inhalt" class="inhalt">
    <p class="datum">${t.stand} <time datetime="${esc(r.date)}">${esc(r.date)}</time></p>
    <h1>${esc(titel)}</h1>
    <section><h2>${t.claim}</h2><p>${esc(wert(r, 'claim', l))}</p></section>
    <section><h2>${t.fc}</h2><p>${esc(fc)}</p></section>${outcome ? `
    <section><h2>${t.outcome}</h2><p>${esc(outcome)}</p></section>` : ''}
    <section class="live" id="live" aria-live="polite"><h2>${t.jetzt}</h2>
      <p id="live-satz">${t.noscript} <a href="/#${esc(r.scenario)}">${t.noscriptLink}</a></p>
      <p id="live-stand" class="stand"></p>
    </section>
    <p class="knoepfe">
      <a class="knopf knopf-gross" href="/#${esc(r.scenario)}">${t.live}</a>
      <button type="button" class="knopf" id="teilen" hidden>${t.teilen}</button>
    </p>
    <section><h2>${t.quellen}</h2>
    <ul class="quellen">
      ${quellen}
    </ul></section>
  </main>
  <footer class="fuss"><a href="${l === 'en' ? '/g/en/' : '/g/'}">${t.alle}</a> · <a href="/">${t.start}</a></footer>
</div>
</body>
</html>
`;
}

function liste(rumors: Rumor[], l: Sprache): string {
  const t = TXT[l];
  const url = BASE + (l === 'en' ? '/g/en/' : '/g/');
  const eintraege = rumors
    .filter((r) => l === 'de' || hatEn(r))
    .map((r) => `<li><a href="${pfad(r.id, l)}">${esc(wert(r, 'title', l))}</a><span class="datum"> ${esc(r.date)}</span></li>`)
    .join('\n    ');
  const alt: Array<[string, string]> = [['de', BASE + '/g/'], ['en', BASE + '/g/en/'], ['x-default', BASE + '/g/']];
  return `<!doctype html>
<html lang="${l}">
<head>
${kopf({ l, titel: `${t.liste} · Signal Radar`, beschr: t.listeSatz, ogTitel: `${t.liste} · Signal Radar`, ogBeschr: t.listeSatz, url, alt, typ: 'website' })}
</head>
<body>
<a class="sprung" href="#inhalt">${t.skip}</a>
<div class="seite">
  <header class="kopf">
    ${marke(l)}
    <p class="sprachen">${l === 'de' ? '<a href="/g/en/" hreflang="en" lang="en">English</a>' : '<a href="/g/" hreflang="de" lang="de">Deutsch</a>'}</p>
  </header>
  <main id="inhalt" class="inhalt">
    <h1>${t.liste}</h1>
    <p>${t.listeSatz}</p>
    <ul class="liste">
    ${eintraege}
    </ul>
    <p class="knoepfe"><a class="knopf knopf-gross" href="/">${t.start}</a></p>
  </main>
</div>
</body>
</html>
`;
}

function schreibe(datei: string, inhalt: string): void {
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, inhalt);
}

export function baue(): { seiten: string[] } {
  const rumors = JSON.parse(readFileSync(join(FE, 'data/rumors.json'), 'utf8')) as Rumor[];
  const ids = new Set(rumors.map((r) => r.id));
  for (const r of rumors) if (!/^[a-z0-9-]+$/.test(r.id)) throw new Error(`Ungueltige id: ${r.id}`);
  // Verwaiste Seiten entfernen (Gerücht gelöscht)
  const g = join(FE, 'g');
  if (existsSync(g)) for (const e of readdirSync(g, { withFileTypes: true })) if (e.isDirectory() && e.name !== 'en' && !ids.has(e.name)) rmSync(join(g, e.name), { recursive: true });
  const urls: string[] = [`${BASE}/`, `${BASE}/g/`];
  for (const r of rumors) {
    schreibe(join(g, r.id, 'index.html'), seite(r, 'de'));
    urls.push(BASE + pfad(r.id, 'de'));
    if (hatEn(r)) { schreibe(join(g, r.id, 'en', 'index.html'), seite(r, 'en')); urls.push(BASE + pfad(r.id, 'en')); }
  }
  schreibe(join(g, 'index.html'), liste(rumors, 'de'));
  schreibe(join(g, 'en', 'index.html'), liste(rumors, 'en'));
  urls.push(`${BASE}/g/en/`);
  const lastmod = rumors.map((r) => r.date).sort().pop();
  schreibe(join(FE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
  const robots = join(FE, 'robots.txt');
  const alt = readFileSync(robots, 'utf8');
  if (!/^Sitemap:/mi.test(alt)) writeFileSync(robots, alt.replace(/\s*$/, '\n') + `Sitemap: ${BASE}/sitemap.xml\n`);
  return { seiten: urls };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/^(?!\/)/, process.cwd() + '/')) {
  const { seiten } = baue();
  console.log(`${seiten.length} Adressen geschrieben`);
}
