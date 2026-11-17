// Automatische Prüfungen der Anzeige (Skill Schritt 6). Server muss laufen: node scripts/serve.ts frontend 4173
// Aufruf: node frontend/design/werkzeug/pruefen.mjs [/pfad/zu/axe.min.js]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const B = 'http://localhost:4173/';
const AXE = process.argv[2];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fails = [];
const log = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };

async function seite(url, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: opt.w ?? 1440, height: opt.h ?? 900 }, colorScheme: opt.cs ?? 'light', reducedMotion: opt.rm ?? 'no-preference', timezoneId: 'Europe/Berlin', locale: 'de-DE', bypassCSP: !!opt.bypass });
  const page = await ctx.newPage();
  const err = []; const fremd = [];
  page.on('pageerror', (e) => err.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173/')) fremd.push(r.url()); });
  if (opt.route) await page.route('**/data/snapshot.json', opt.route);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, err, fremd };
}

const states = ['calm', 'rumor', 'single', 'elevated', 'acute', 'multi'];
for (const cs of ['light', 'dark']) for (const w of [1440, 390, 320]) for (const s of states) {
  const { ctx, page, err, fremd } = await seite(`${B}?demo=${s}`, { w, h: 800, cs, bypass: !!AXE });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log(!err.length && !fremd.length && ov <= 0, `${s} ${w} ${cs}: Konsole ${err.length}, fremde Requests ${fremd.length}, Überlauf ${ov}px`);
  if (AXE && (w === 1440 || w === 320)) {
    await page.addScriptTag({ path: AXE });
    // alle Spuren aufklappen, damit auch Messreihen geprüft werden
    await page.$$eval('.spur-knopf[aria-expanded="false"]', (bs) => bs.forEach((b) => b.click()));
    const r = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0]?.target}`));
    log(!r.length, `axe ${s} ${w} ${cs}: ${r.length ? r.join(' | ') : 'keine Verstöße'}`);
  }
  await ctx.close();
}

// Tastatur-Durchlauf
{
  const { ctx, page } = await seite(`${B}?demo=multi`, { w: 390, h: 844 });
  const seen = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => { const a = document.activeElement; return `${a.tagName}.${a.className}|${a.getAttribute('role') ?? ''}|${(a.getAttribute('aria-label') ?? a.textContent).trim().slice(0, 40)}`; }));
  }
  const tab = seen.findIndex((x) => x.includes('|tab|'));
  const spur = seen.findIndex((x) => x.includes('spur-knopf'));
  log(tab >= 0 && spur > tab, `Tastatur: Szenario-Wahl bei Tab ${tab + 1}, erste Spur bei Tab ${spur + 1}`);
  // Pfeiltasten in der Wahl
  await page.focus('#tab-cyber');
  await page.keyboard.press('ArrowRight');
  const nach = await page.evaluate(() => [location.hash, document.activeElement.id, document.querySelector('.stufe-name').textContent]);
  log(nach[0] === '#blackout' && nach[1] === 'tab-blackout', `Pfeil rechts: Hash ${nach[0]}, Fokus ${nach[1]}, Stufe ${nach[2]}`);
  // Spur mit Enter aufklappen
  await page.focus('.spurliste .spur-knopf');
  await page.keyboard.press('Enter');
  const auf = await page.evaluate(() => { const b = document.querySelector('.spurliste .spur-knopf'); return [b.getAttribute('aria-expanded'), document.getElementById(b.getAttribute('aria-controls')).hidden]; });
  log(auf[0] === 'true' && auf[1] === false, `Enter klappt Spur auf: aria-expanded=${auf[0]}`);
  await ctx.close();
}
// Hash beim Laden
{
  const { ctx, page } = await seite(`${B}?demo=multi#finanz`, { w: 1440 });
  const sel = await page.getAttribute('[aria-selected="true"]', 'id');
  log(sel === 'tab-finanz', `#finanz beim Laden gewählt: ${sel}`);
  const lbl = await page.$$eval('.spurliste .spur-knopf', (bs) => bs.slice(0, 2).map((b) => b.getAttribute('aria-label')));
  log(lbl.every((l) => /: (Ausschlag|normal)/.test(l)), `aria-label der Spuren: ${lbl.join(' / ')}`);
  await ctx.close();
}
// Veraltet (live, 5 h alt) und Aufzeichnung über umgeleitete snapshot.json
import { readFileSync } from 'node:fs';
const calm = JSON.parse(readFileSync(new URL('../../data/demo-calm.json', import.meta.url)));
for (const [mode, alt, erwartet] of [['live', 5, '.veraltet'], ['live', 1, null], ['snapshot', 30, '.betrieb-snapshot']]) {
  const body = JSON.stringify({ ...calm, mode, note: undefined, generatedAt: new Date(Date.now() - alt * 3600e3).toISOString() });
  const { ctx, page, err } = await seite(B, { route: (r) => r.fulfill({ status: 200, contentType: 'application/json', body }) });
  const v = await page.$('.veraltet');
  const ok = erwartet ? !!(await page.$(erwartet)) : !v;
  log(ok && !err.length, `${mode}, ${alt} h alt: ${erwartet ?? 'kein Veraltet-Hinweis'} ${ok ? 'wie erwartet' : 'FALSCH'}`);
  await ctx.close();
}
// Kaputtes Format
{
  const { ctx, page } = await seite(B, { route: (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"schema":2}' }) });
  log(!!(await page.$('.fehler')), 'Falsches Format zeigt Fehlerzustand');
  await ctx.close();
}
// Fehlende Datei: einziger Konsolenfehler ist der 404 des Browsers
{
  const { ctx, page, err, fremd } = await seite(B, { w: 320, h: 640 });
  log(!!(await page.$('.fehler')) && err.every((e) => e.includes('404')) && !fremd.length, `Fehlende snapshot.json: Fehlerzustand, Konsole nur 404 (${err.length})`);
  await ctx.close();
}
// 200 % Text (Wurzel-Schriftgröße 32px) bei 320 px: kein waagerechter Überlauf
for (const s of ['elevated', 'multi']) {
  const { ctx, page } = await seite(`${B}?demo=${s}`, { w: 640, h: 800, bypass: true });
  await page.addStyleTag({ content: 'html{font-size:200%}' });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  log(ov <= 0, `Text 200 % (640 px Fenster) ${s}: Überlauf ${ov}px`);
  await ctx.close();
}
// Reduzierte Bewegung: keine laufenden Animationen
{
  const { ctx, page } = await seite(`${B}?demo=acute`, { rm: 'reduce' });
  const n = await page.evaluate(() => document.getAnimations().length);
  log(n === 0, `prefers-reduced-motion: ${n} Animationen`);
  await ctx.close();
  const b = await seite(`${B}?demo=acute`, { rm: 'no-preference' });
  const m = await b.page.evaluate(() => document.getAnimations().length);
  console.log(`     ohne Einschränkung: ${m} Animationen (Spuren schreiben sich einmal)`);
  await b.ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} Prüfungen fehlgeschlagen` : '\nAlle Prüfungen bestanden');
