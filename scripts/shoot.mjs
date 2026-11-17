// Screenshot einer Seite mit Playwright und dem vorhandenen Chrome.
// Aufruf: node scripts/shoot.mjs <url> <ausgabe.png> [breite=1440] [hoehe=900] [fullPage=true]
// Mehrere Aufnahmen in einem Browser: node scripts/shoot.mjs --batch <jobs.json>
//   jobs.json: [{ "url": "...", "out": "...", "width": 390, "height": 844, "fullPage": true }, ...]
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const jobs = args[0] === '--batch'
  ? JSON.parse(readFileSync(args[1], 'utf8'))
  : [{ url: args[0], out: args[1], width: Number(args[2] ?? 1440), height: Number(args[3] ?? 900), fullPage: (args[4] ?? 'true') !== 'false' }];

if (!jobs.length || !jobs[0].url || !jobs[0].out) {
  console.error('Aufruf: node scripts/shoot.mjs <url> <ausgabe.png> [breite] [hoehe] [fullPage]');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.width ?? 1440, height: j.height ?? 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(j.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    mkdirSync(dirname(j.out), { recursive: true });
    await page.screenshot({ path: j.out, fullPage: j.fullPage ?? true });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`${j.out}  ${j.width}x${h}${errors.length ? '  FEHLER: ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
