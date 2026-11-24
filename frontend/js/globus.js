// Globus: d3-geo (orthografisch) auf Canvas. Zeichnet nur bei Änderung oder Drehung neu.
// Farben kommen aus CSS-Variablen am Canvas (--g-*), damit helle und dunkle Fassung gleichwertig bleiben.
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate } from '../assets/vendor/d3-geo.min.js';
import feature from '../assets/vendor/topojson-client/feature.js';
import mesh from '../assets/vendor/topojson-client/mesh.js';

let atlas = null;
export async function ladeAtlas() {
  if (atlas) return atlas;
  const res = await fetch('assets/vendor/countries-110m.json');
  if (!res.ok) throw new Error(`atlas ${res.status}`);
  const topo = await res.json();
  atlas = {
    laender: feature(topo, topo.objects.countries).features,
    land: feature(topo, topo.objects.land),
    grenzen: mesh(topo, topo.objects.countries, (a, b) => a !== b),
    netz: geoGraticule10(),
  };
  return atlas;
}

const GRAD_S = 4; // Eigendrehung in Grad pro Sekunde
const RUHE_MS = 5000; // nach Benutzer-Drehung so lange keine Eigendrehung

export function erstelleGlobus(canvas, { onPick, start = [10, 25] }) {
  const ctx = canvas.getContext('2d');
  const proj = geoOrthographic().clipAngle(90).precision(0.6);
  const path = geoPath(proj, ctx);
  const ruhigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
  let rot = [-start[0], -start[1], 0];
  let punkte = [];
  let laender = new Map();
  let auswahl = null;
  let groesse = 0;
  let dpr = 1;
  let farben = {};
  let sichtbar = true;
  let letzteBenutzung = -1e9;
  let anim = null; // { von, nach, t0, dauer }
  let raf = 0;
  let tLetzt = 0;
  let zug = null;
  let aus = false;
  let tippZiel = null;
  const beobachter = [];

  function leseFarben() {
    const cs = getComputedStyle(canvas);
    const v = (n) => cs.getPropertyValue(n).trim();
    farben = { meer: v('--g-meer'), land: v('--g-land'), grenze: v('--g-grenze'), netz: v('--g-netz'), ruhig: v('--g-ruhig'), hof: v('--g-hof'), rand: v('--g-rand'), kern: v('--g-kern') };
  }

  function messen() {
    const w = Math.round(canvas.parentElement.getBoundingClientRect().width);
    if (!w || w === groesse) return false;
    groesse = w;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    proj.translate([w / 2, w / 2]).scale(w / 2 - Math.max(6, w * 0.035));
    return true;
  }

  const mitte = () => [-rot[0], -rot[1]];
  const istVorne = (p) => geoDistance([p.lon, p.lat], mitte()) < Math.PI / 2 - 0.03;

  function zeichnen() {
    if (!atlas || !groesse) return;
    proj.rotate(rot);
    const w = groesse;
    const r = proj.scale();
    const [cx, cy] = proj.translate();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);

    // Lufthülle: schmaler Lichtsaum, kein Effekt-Feuerwerk
    const saum = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.07);
    saum.addColorStop(0, farben.hof);
    saum.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = saum;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.07, 0, 2 * Math.PI); ctx.fill();

    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = farben.meer; ctx.fill();
    ctx.beginPath(); path(atlas.netz); ctx.strokeStyle = farben.netz; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(atlas.land); ctx.fillStyle = farben.land; ctx.fill();

    for (const f of atlas.laender) {
      const z = laender.get(f.id);
      if (!z) continue;
      ctx.beginPath(); path(f);
      ctx.globalAlpha = z.auf ? 0.34 : 0.16;
      ctx.fillStyle = z.auf ? z.farbe : farben.ruhig;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); path(atlas.grenzen); ctx.strokeStyle = farben.grenze; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = farben.rand; ctx.lineWidth = 1; ctx.stroke();

    const pr = Math.max(2.6, w / 190);
    const sortiert = [...punkte].sort((a, b) => (a.zustand === 'auf') - (b.zustand === 'auf'));
    for (const p of sortiert) {
      if (!istVorne(p)) { p.xy = null; continue; }
      const [x, y] = proj([p.lon, p.lat]);
      p.xy = [x, y];
      if (p.zustand === 'auf') {
        const hof = ctx.createRadialGradient(x, y, 0, x, y, pr * 7);
        hof.addColorStop(0, p.farbe);
        hof.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55; ctx.fillStyle = hof;
        ctx.beginPath(); ctx.arc(x, y, pr * 7, 0, 2 * Math.PI); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = p.farbe;
        ctx.beginPath(); ctx.arc(x, y, pr * 1.6, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = farben.kern;
        ctx.beginPath(); ctx.arc(x, y, pr * 0.6, 0, 2 * Math.PI); ctx.fill();
      } else if (p.zustand === 'leer') {
        ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, pr * 1.25, 0, 2 * Math.PI); ctx.stroke();
      } else {
        ctx.fillStyle = farben.ruhig;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, 2 * Math.PI); ctx.fill();
      }
      if (auswahl === p.id) {
        ctx.strokeStyle = farben.kern; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, pr * 3.2, 0, 2 * Math.PI); ctx.stroke();
      }
    }
  }

  // ---------- Bewegung ----------
  const darfDrehen = () => !ruhigBewegung.matches && sichtbar && !document.hidden && performance.now() - letzteBenutzung > RUHE_MS;

  function schleife(t) {
    raf = 0;
    if (aus || !canvas.isConnected) return;
    const dt = tLetzt ? Math.min(t - tLetzt, 100) : 16;
    tLetzt = t;
    let weiter = false;
    if (anim) {
      const k = Math.min(1, (t - anim.t0) / anim.dauer);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = anim.interp(e);
      rot = [-p[0], -p[1], 0];
      if (k >= 1) anim = null;
      weiter = true;
    } else if (darfDrehen()) {
      rot[0] += (GRAD_S * dt) / 1000;
      weiter = true;
    }
    zeichnen();
    if (weiter || (!ruhigBewegung.matches && sichtbar && !document.hidden)) anfordern();
    else tLetzt = 0;
  }
  function anfordern() { if (!raf) raf = requestAnimationFrame(schleife); }

  function zuOrt(lon, lat) {
    const ziel = [lon, Math.max(-50, Math.min(50, lat))];
    letzteBenutzung = performance.now();
    if (ruhigBewegung.matches) { rot = [-ziel[0], -ziel[1], 0]; zeichnen(); return; }
    anim = { interp: geoInterpolate(mitte(), ziel), t0: performance.now(), dauer: 700 };
    anfordern();
  }

  // ---------- Zeiger ----------
  function naechster(x, y, max) {
    let best = null;
    let bd = max * max;
    for (const p of punkte) {
      if (!p.xy) continue;
      const d = (p.xy[0] - x) ** 2 + (p.xy[1] - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  const lokal = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  canvas.addEventListener('pointerdown', (e) => {
    zug = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), id: e.pointerId };
    letzteBenutzung = performance.now();
    anim = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!zug || e.pointerId !== zug.id) {
      if (e.pointerType === 'mouse') canvas.style.cursor = naechster(...lokal(e), 16) ? 'pointer' : 'grab';
      return;
    }
    const k = 180 / (Math.PI * proj.scale());
    if (Math.abs(e.clientX - zug.x0) + Math.abs(e.clientY - zug.y0) > 4 && !zug.gefangen) {
      zug.gefangen = true;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignorieren */ }
    }
    rot[0] += (e.clientX - zug.x) * k;
    if (e.pointerType === 'mouse') rot[1] = Math.max(-60, Math.min(60, rot[1] - (e.clientY - zug.y) * k));
    zug.x = e.clientX; zug.y = e.clientY;
    letzteBenutzung = performance.now();
    zeichnen();
  });
  const ende = (e) => {
    if (!zug || e.pointerId !== zug.id) return;
    const weg = Math.abs(e.clientX - zug.x0) + Math.abs(e.clientY - zug.y0);
    if (e.type === 'pointerup' && weg < 8 && performance.now() - zug.t < 600) {
      // Öffnen erst beim folgenden click: sonst träfe der nachgereichte Klick einer Berührung schon die geöffnete Karte
      tippZiel = naechster(...lokal(e), e.pointerType === 'mouse' ? 16 : 24)?.id ?? null;
    }
    zug = null;
    letzteBenutzung = performance.now();
    anfordern();
  };
  canvas.addEventListener('pointerup', ende);
  canvas.addEventListener('click', () => { const id = tippZiel; tippZiel = null; if (id) onPick?.(id); });
  canvas.addEventListener('pointercancel', ende);

  // ---------- Sichtbarkeit, Größe, Farbschema ----------
  const io = new IntersectionObserver((es) => { sichtbar = es.some((x) => x.isIntersecting); if (sichtbar) anfordern(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => { if (messen()) zeichnen(); });
  ro.observe(canvas.parentElement);
  beobachter.push(io, ro);
  const beiSichtbar = () => { if (!document.hidden) anfordern(); };
  const beiSchema = () => { leseFarben(); zeichnen(); };
  const schema = matchMedia('(prefers-color-scheme: dark)');
  document.addEventListener('visibilitychange', beiSichtbar);
  schema.addEventListener('change', beiSchema);
  ruhigBewegung.addEventListener('change', anfordern);

  leseFarben();
  messen();

  return {
    setze(neuePunkte, neueLaender) {
      punkte = neuePunkte.map((p) => ({ ...p, xy: null }));
      laender = neueLaender;
      leseFarben();
      zeichnen();
      anfordern();
    },
    zuOrt,
    waehle(id) {
      auswahl = id;
      const p = punkte.find((x) => x.id === id);
      if (p) zuOrt(p.lon, p.lat); else zeichnen();
    },
    pause() { letzteBenutzung = performance.now() + 60_000; },
    weiter() { letzteBenutzung = performance.now() - RUHE_MS + 1500; anfordern(); },
    zeichnen,
    zerstoere() {
      aus = true;
      if (raf) cancelAnimationFrame(raf);
      beobachter.forEach((b) => b.disconnect());
      document.removeEventListener('visibilitychange', beiSichtbar);
      schema.removeEventListener('change', beiSchema);
      ruhigBewegung.removeEventListener('change', anfordern);
    },
  };
}
