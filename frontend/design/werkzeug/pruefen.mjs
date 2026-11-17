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

const states = ['calm', 'rumor', 'single', 'elevated', 'acute', 'multi', 'sparse'];
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
  const { ctx, page } = await seite(`${B}?demo=multi#finance`, { w: 1440 });
  const sel = await page.getAttribute('[aria-selected="true"]', 'id');
  log(sel === 'tab-finance', `#finance beim Laden gewählt: ${sel}`);
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
// 8 Szenarien: Desktop eine Zeile, Handy waagerecht verschiebbar, „In Vorbereitung“ nach id
{
  const multi = JSON.parse(readFileSync(new URL('../../data/demo-multi.json', import.meta.url)));
  const ids = ['cyber', 'war', 'blackout', 'ai', 'finance', 'nuclear', 'bio', 'space'];
  const scs = ids.map((id, i) => ({ ...multi.scenarios[i % multi.scenarios.length], id, title: { cyber: 'Cyberangriff', war: 'Kriegseskalation', blackout: 'Blackout / Energie', ai: 'KI-Vorfall', finance: 'Finanzkrise', nuclear: 'Nuklear', bio: 'Pandemie', space: 'Weltraumwetter' }[id] }));
  const body = JSON.stringify({ ...multi, scenarios: scs });
  for (const w of [1440, 390, 320]) {
    const { ctx, page, err } = await seite(B, { w, route: (r) => r.fulfill({ status: 200, contentType: 'application/json', body }) });
    const r = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role=tab]')];
      const wahl = document.querySelector('.wahl');
      return { reihen: new Set(tabs.map((t) => t.offsetTop)).size, n: tabs.length, scroll: wahl.scrollWidth > wahl.clientWidth, kommend: !!document.querySelector('.wahl-kommend'), ov: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const ok = r.n === 8 && r.reihen === 1 && !r.kommend && r.ov <= 0 && !err.length && (w === 1440 ? !r.scroll : r.scroll);
    log(ok, `8 Szenarien bei ${w}: ${r.reihen} Zeile, verschiebbar ${r.scroll}, „In Vorbereitung“ ${r.kommend}, Überlauf ${r.ov}`);
    await ctx.close();
  }
}
// Zwillings-Pegel im Gerücht-Fall über der Falz (390 × 844)
{
  const { ctx, page } = await seite(`${B}?demo=rumor`, { w: 390, h: 844 });
  const b = await page.evaluate(() => document.querySelector('.zw-att').getBoundingClientRect().bottom);
  const wort = await page.textContent('.zw-att .zw-wort');
  log(b < 844, `Gerücht 390: Gerede-Pegel endet bei ${Math.round(b)} px (Falz 844), Wort „${wort}“`);
  await ctx.close();
}
// Kontext-Abschnitt und Dämpfung (multi, cyber)
{
  const { ctx, page } = await seite(`${B}?demo=multi`, { w: 1440 });
  const k = await page.$$eval('.kontext li', (l) => l.length);
  const d = await page.$$eval('.mr-daempf', (l) => l.map((x) => x.textContent));
  log(k === 2 && d.some((t) => t.startsWith('Zählt weniger, weil:')), `Kontext ${k} Meldungen, Dämpfung: ${d[0]}`);
  await ctx.close();
  const c = await seite(`${B}?demo=calm`, { w: 1440 });
  log(!(await c.page.$('.kontext')), 'Kontext-Abschnitt fehlt bei leerem context');
  await c.ctx.close();
}
// Dünne Daten: Lücken benannt
{
  const { ctx, page } = await seite(`${B}?demo=sparse`, { w: 390 });
  await page.$$eval('.spur-knopf', (bs) => bs.forEach((b) => b.click()));
  const t = await page.textContent('#inhalt');
  const muss = ['noch keine Messreihe', 'keine frischen Daten', 'wird noch gelernt (bisher 11 Vergleichswerte)', 'noch nicht bewertbar', 'Noch keine Daten', 'NaN', 'undefined', 'null'];
  const r = muss.map((m) => [m, t.includes(m)]);
  log(r.slice(0, 5).every(([, x]) => x) && r.slice(5).every(([, x]) => !x), `sparse: ${r.map(([m, x]) => `${m}=${x}`).join(', ')}`);
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} Prüfungen fehlgeschlagen` : '\nAlle Prüfungen bestanden');
