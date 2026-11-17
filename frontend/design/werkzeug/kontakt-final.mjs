// Kontaktbögen der finalen Anzeige (je höchstens 1600×1400 px).
// Aufruf: node frontend/design/werkzeug/kontakt-final.mjs  (nach den Aufnahmen in design/renders/final/)
import sharp from '/opt/npm-tools/node_modules/sharp/dist/index.cjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../renders/final');
const W = 1600, M = 20, TOP = 44, HMAX = 1400;

async function crop(file, cropH, width) {
  const meta = await sharp(file).metadata();
  const h = Math.min(cropH, meta.height);
  const buf = await sharp(file).extract({ left: 0, top: 0, width: meta.width, height: h }).resize({ width }).png().toBuffer();
  return { buf, h: (await sharp(buf).metadata()).height, full: meta.height, src: h };
}

async function bogen(name, desk, phones, scheme) {
  const LW = phones.length === 3 ? 860 : 960;
  const PW = Math.floor((W - LW - M * (phones.length + 2)) / phones.length);
  const avail = HMAX - TOP - M;
  const d = await crop(`${dir}/${desk}`, Math.round(avail * 1440 / LW), LW);
  const ps = [];
  for (const [f, lab] of phones) ps.push({ lab, ...(await crop(`${dir}/${f}`, Math.round(avail * 390 / PW), PW)) });
  const H = Math.min(HMAX, TOP + Math.max(d.h, ...ps.map((p) => p.h)) + M);
  const bg = scheme === 'dunkel' ? '#0b0d10' : '#ffffff';
  const fg = scheme === 'dunkel' ? '#e9e5dc' : '#111111';
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const label = (x, t) => `<text x="${x}" y="30" font-family="sans-serif" font-size="15" fill="${fg}">${esc(t)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${label(M, `Desktop 1440 · ${desk.split('-')[0]} · ${scheme} (oberer Teil, ${d.src} von ${d.full} px)`)}
    ${ps.map((p, i) => label(LW + M * 2 + i * (PW + M), `Handy 390 · ${p.lab}`)).join('')}
    <rect x="${M - 1}" y="${TOP - 1}" width="${LW + 2}" height="${d.h + 2}" fill="none" stroke="#888"/>
    ${ps.map((p, i) => `<rect x="${LW + M * 2 + i * (PW + M) - 1}" y="${TOP - 1}" width="${PW + 2}" height="${p.h + 2}" fill="none" stroke="#888"/>`).join('')}
  </svg>`;
  const out = `${dir}/${name}`;
  await sharp({ create: { width: W, height: H, channels: 3, background: bg } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, { input: d.buf, left: M, top: TOP }, ...ps.map((p, i) => ({ input: p.buf, left: LW + M * 2 + i * (PW + M), top: TOP }))])
    .png().toFile(out);
  console.log(out, `${W}x${H}`);
}

await bogen('kontakt-hell.png', 'elevated-desktop-hell.png', [['calm-390-hell.png', 'calm'], ['rumor-390-hell.png', 'rumor'], ['elevated-390-hell.png', 'elevated']], 'hell');
await bogen('kontakt-dunkel.png', 'acute-desktop-dunkel.png', [['multi-390-dunkel.png', 'multi'], ['acute-390-dunkel.png', 'acute']], 'dunkel');
