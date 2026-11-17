// Kontaktbogen einer Skizze: links Desktop (oberer Teil), rechts drei Handy-Ansichten nebeneinander (oberer Teil).
// Aufruf: node scripts/kontakt.mjs <h1|h2|h3> [renderDir=frontend/design/renders/skizzen]
import sharp from '/opt/npm-tools/node_modules/sharp/dist/index.cjs';

const h = process.argv[2];
const dir = process.argv[3] ?? 'frontend/design/renders/skizzen';
const W = 1600, M = 20, TOP = 44;
const LW = 860; // Breite Desktop-Spalte
const PW = Math.floor((W - LW - M * 5) / 3); // Breite je Handy
const DESK_CROP = 1000, PHONE_CROP = 1900;

async function crop(file, cropH, width) {
  const img = sharp(file);
  const meta = await img.metadata();
  const hgt = Math.min(cropH, meta.height);
  const buf = await img.extract({ left: 0, top: 0, width: meta.width, height: hgt }).resize({ width }).png().toBuffer();
  const m2 = await sharp(buf).metadata();
  return { buf, h: m2.height, full: meta.height };
}

const desk = await crop(`${dir}/${h}-elevated-desktop.png`, DESK_CROP, LW);
const phones = [];
for (const s of ['calm', 'rumor', 'elevated']) phones.push({ s, ...(await crop(`${dir}/${h}-${s}-handy.png`, PHONE_CROP, PW)) });
const H = Math.min(1400, TOP + Math.max(desk.h, ...phones.map((p) => p.h)) + M);

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (x, t) => `<text x="${x}" y="30" font-family="sans-serif" font-size="16" fill="#111">${esc(t)}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${label(M, `${h.toUpperCase()} · Desktop 1440 · elevated (oberer Teil, ${Math.min(DESK_CROP, desk.full)} von ${desk.full} px)`)}
  ${phones.map((p, i) => label(LW + M * 2 + i * (PW + M), `Handy 390 · ${p.s}`)).join('')}
  <rect x="${M - 1}" y="${TOP - 1}" width="${LW + 2}" height="${desk.h + 2}" fill="none" stroke="#999"/>
  ${phones.map((p, i) => `<rect x="${LW + M * 2 + i * (PW + M) - 1}" y="${TOP - 1}" width="${PW + 2}" height="${Math.min(p.h, H - TOP - M) + 2}" fill="none" stroke="#999"/>`).join('')}
</svg>`;

const comps = [
  { input: Buffer.from(svg), left: 0, top: 0 },
  { input: desk.buf, left: M, top: TOP },
  ...phones.map((p, i) => ({ input: p.h > H - TOP - M ? null : p.buf, raw: p, left: LW + M * 2 + i * (PW + M), top: TOP })),
];
for (const c of comps) {
  if (c.raw) {
    c.input = c.input ?? (await sharp(c.raw.buf).extract({ left: 0, top: 0, width: PW, height: H - TOP - M }).toBuffer());
    delete c.raw;
  }
}
const out = `${dir}/kontakt-${h}.png`;
await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(out);
console.log(out, `${W}x${H}`);
