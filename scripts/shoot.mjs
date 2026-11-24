// Screenshot einer Seite mit Playwright und dem vorhandenen Chrome.
// Aufruf: node scripts/shoot.mjs <url> <ausgabe.png> [breite=1440] [hoehe=900] [fullPage=true] [colorScheme=light]
// Mehrere Aufnahmen in einem Browser: node scripts/shoot.mjs --batch <jobs.json>
//   jobs.json: [{ "url": "...", "out": "...", "width": 390, "height": 844, "fullPage": true,
//                 "colorScheme": "dark", "reducedMotion": "reduce", "timezoneId": "Europe/Berlin", "wait": 150 }, ...]
// colorScheme: light | dark (Standard light). reducedMotion: reduce | no-preference (Standard reduce, damit keine
// halb gezeichnete Animation aufgenommen wird). timezoneId: Standard Europe/Berlin.
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const jobs = args[0] === '--batch'
  ? JSON.parse(readFileSync(args[1], 'utf8'))
  : [{ url: args[0], out: args[1], width: Number(args[2] ?? 1440), height: Number(args[3] ?? 900), fullPage: (args[4] ?? 'true') !== 'false', colorScheme: args[5] ?? 'light' }];

if (!jobs.length || !jobs[0].url || !jobs[0].out) {
  console.error('Aufruf: node scripts/shoot.mjs <url> <ausgabe.png> [breite] [hoehe] [fullPage] [colorScheme]');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const j of jobs) {
    const context = await browser.newContext({
      viewport: { width: j.width ?? 1440, height: j.height ?? 900 },
      deviceScaleFactor: j.deviceScaleFactor ?? 1,
      colorScheme: j.colorScheme ?? 'light',
      reducedMotion: j.reducedMotion ?? 'reduce',
      timezoneId: j.timezoneId ?? 'Europe/Berlin',
      locale: 'de-DE',
    });
    const page = await context.newPage();
    const errors = [];
    const fremd = [];
    page.on('request', (r) => { const h = new URL(r.url()).hostname; if (!['localhost', '127.0.0.1', 'raw.githubusercontent.com'].includes(h) && !r.url().startsWith('data:')) fremd.push(h); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(j.url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(j.wait ?? 150);
    mkdirSync(dirname(j.out), { recursive: true });
    await page.screenshot({ path: j.out, fullPage: j.fullPage ?? true });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const breit = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const probleme = [...errors, ...(fremd.length ? [`fremde Hosts: ${[...new Set(fremd)].join(', ')}`] : []), ...(breit > 0 ? [`waagerechter Überlauf ${breit}px`] : [])];
    console.log(`${j.out}  ${j.width}x${h} ${j.colorScheme ?? 'light'}${probleme.length ? '  FEHLER: ' + probleme.join(' | ') : ''}`);
    await context.close();
  }
} finally {
  await browser.close();
}
