// Globus: d3-geo (orthografisch) auf Canvas. Ruhige Bühne mit Leben: alle Messorte pulsieren leise,
// ungewöhnliche leuchten mit Ring, Messungen ohne Ort sitzen als Punktring um die Kugel, Tag/Nacht nach Uhrzeit.
// Farben kommen aus CSS-Variablen am Canvas (--g-*), damit helle und dunkle Fassung gleichwertig bleiben.
// Leistung: höchstens ~1500 Punkte, gezeichnet mit höchstens 30 Bildern pro Sekunde, Pause außerhalb des Sichtbereichs.
import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate, geoCircle } from '../assets/vendor/d3-geo.min.js';
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

const GRAD_S = 3; // Eigendrehung in Grad pro Sekunde
const RUHE_MS = 5000; // nach Benutzung so lange keine Eigendrehung
const BILD_MS = 33; // ~30 Bilder pro Sekunde genügen
const MAX_PUNKTE = 1500;

/** Unter-Sonnen-Punkt [lon, lat] für ein Datum (Näherung, genügt für den Schatten) */
function sonne(d) {
  const jahr = Date.UTC(d.getUTCFullYear(), 0, 0);
  const tag = (d.getTime() - jahr) / 864e5;
  const dekl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (tag + 10));
  const std = d.getUTCHours() + d.getUTCMinutes() / 60;
  return [-15 * (std - 12), dekl];
}

const phase = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return ((h >>> 0) % 1000) / 1000 * Math.PI * 2; };

export function erstelleGlobus(canvas, { onPick, start = [10, 25], beschriften = 3 } = {}) {
  const ctx = canvas.getContext('2d');
  const proj = geoOrthographic().clipAngle(90).precision(0.6);
  const path = geoPath(proj, ctx);
  const ruhigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
  let rot = [-start[0], -start[1], 0];
  let punkte = [];
  let ring = [];
  let schicht = [];
  let laender = new Map();
  let auswahl = null;
  let zeiger = null; // Punkt unter Maus oder zuletzt angetippter Orientierungspunkt
  let groesse = 0;
  let dpr = 1;
  let farben = {};
  let sichtbar = true;
  let letzteBenutzung = -1e9;
  let anim = null;
  let raf = 0;
  let tLetzt = 0;
  let tBild = 0;
  let zug = null;
  let aus = false;
  let tippZiel = null;
  let zeit = new Date();
  let nacht = null;
  const beobachter = [];

  function setzeZeit(d) {
    zeit = d;
    const [lon, lat] = sonne(d);
    nacht = [geoCircle().center([lon + 180, -lat]).radius(90)(), geoCircle().center([lon + 180, -lat]).radius(82)()];
  }
  setzeZeit(zeit);

  function leseFarben() {
    const cs = getComputedStyle(canvas);
    const v = (n) => cs.getPropertyValue(n).trim();
    farben = {
      meer: v('--g-meer'), meerHell: v('--g-meer-hell'), land: v('--g-land'), grenze: v('--g-grenze'), netz: v('--g-netz'),
      ruhig: v('--g-ruhig'), etwas: v('--g-etwas'), hof: v('--g-hof'), rand: v('--g-rand'), kern: v('--g-kern'),
      nacht: v('--g-nacht'), schicht: v('--g-schicht'), tinte: v('--tinte'), grund: v('--grund'), schrift: cs.fontFamily,
    };
  }

  function messen() {
    const w = Math.round(canvas.parentElement.getBoundingClientRect().width);
    if (!w || w === groesse) return false;
    groesse = w;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    proj.translate([w / 2, w / 2]).scale((w / 2) * 0.8);
    return true;
  }

  const mitte = () => [-rot[0], -rot[1]];
  const istVorne = (p) => geoDistance([p.lon, p.lat], mitte()) < Math.PI / 2 - 0.03;
  const bewegt = () => !ruhigBewegung.matches;

  function kreis(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, 2 * Math.PI); }

  function leuchtpunkt(x, y, pr, farbe, t, ph, gross) {
    // ausgehender Ring (Puls) + Hof + Kern
    if (bewegt()) {
      const k = ((t / 2200 + ph / (2 * Math.PI)) % 1);
      ctx.strokeStyle = farbe; ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = 1.5;
      kreis(x, y, pr * (1.6 + k * (gross ? 6 : 4))); ctx.stroke();
    }
    const hof = ctx.createRadialGradient(x, y, 0, x, y, pr * (gross ? 6 : 4));
    hof.addColorStop(0, farbe); hof.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5; ctx.fillStyle = hof; kreis(x, y, pr * (gross ? 6 : 4)); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = farbe; kreis(x, y, pr * (gross ? 1.6 : 1.25)); ctx.fill();
    ctx.strokeStyle = farbe; ctx.lineWidth = 1.2; kreis(x, y, pr * (gross ? 2.6 : 2)); ctx.stroke();
    ctx.fillStyle = farben.kern; kreis(x, y, pr * 0.55); ctx.fill();
  }

  function etikett(x, y, cx, cy, p, w, belegt, immer) {
    const zeilen = [p.titel, p.info].filter(Boolean);
    if (!zeilen.length) return;
    ctx.font = `700 12px ${farben.schrift}`;
    const b1 = ctx.measureText(zeilen[0]).width;
    ctx.font = `400 11px ${farben.schrift}`;
    const b2 = zeilen[1] ? ctx.measureText(zeilen[1]).width : 0;
    const bw = Math.min(Math.max(b1, b2) + 14, w * 0.62);
    const bh = zeilen.length * 15 + 8;
    const rechts = x >= cx;
    let lx = rechts ? x + 14 : x - 14 - bw;
    let ly = y + (y < cy ? -bh - 6 : 6);
    lx = Math.max(2, Math.min(w - bw - 2, lx));
    ly = Math.max(2, Math.min(w - bh - 2, ly));
    const stoesst = (yy) => belegt.some((b) => lx < b[0] + b[2] + 4 && lx + bw + 4 > b[0] && yy < b[1] + b[3] + 4 && yy + bh + 4 > b[1]);
    if (stoesst(ly)) {
      const alt = [ly + bh + 8, ly - bh - 8, ly + 2 * (bh + 8), ly - 2 * (bh + 8)].map((v) => Math.max(2, Math.min(w - bh - 2, v))).find((v) => !stoesst(v));
      if (alt == null && !immer) return;
      if (alt != null) ly = alt;
    }
    belegt.push([lx, ly, bw, bh]);
    ctx.globalAlpha = 0.85; ctx.strokeStyle = farben.tinte; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(rechts ? lx : lx + bw, ly + bh / 2); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.fillStyle = farben.grund;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, bw, bh, 6) : ctx.rect(lx, ly, bw, bh); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = p.farbe || farben.rand; ctx.stroke();
    ctx.fillStyle = farben.tinte; ctx.textBaseline = 'top';
    const kuerze = (s, max) => { if (ctx.measureText(s).width <= max) return s; while (s.length > 3 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
    ctx.font = `700 12px ${farben.schrift}`; ctx.fillText(kuerze(zeilen[0], bw - 14), lx + 7, ly + 5);
    if (zeilen[1]) { ctx.font = `400 11px ${farben.schrift}`; ctx.fillText(kuerze(zeilen[1], bw - 14), lx + 7, ly + 20); }
  }

  function zeichnen(t = performance.now()) {
    if (!atlas || !groesse) return;
    proj.rotate(rot);
    const w = groesse;
    const r = proj.scale();
    const [cx, cy] = proj.translate();
    const welle = (ph, sp = 1800) => (bewegt() ? Math.sin(t / sp + ph) : 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);
    ctx.globalAlpha = 1;

    // Lufthülle
    const saum = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r * 1.2);
    saum.addColorStop(0, farben.hof); saum.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = saum; kreis(cx, cy, r * 1.2); ctx.fill();

    // Meer mit leichter Wölbung
    const meer = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    meer.addColorStop(0, farben.meerHell || farben.meer); meer.addColorStop(1, farben.meer);
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = meer; ctx.fill();
    ctx.beginPath(); path(atlas.netz); ctx.strokeStyle = farben.netz; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(atlas.land); ctx.fillStyle = farben.land; ctx.fill();
    for (const f of atlas.laender) {
      const z = laender.get(f.id);
      if (!z) continue;
      ctx.beginPath(); path(f);
      ctx.globalAlpha = z.auf ? 0.34 : 0.14;
      ctx.fillStyle = z.auf ? z.farbe : farben.ruhig;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); path(atlas.grenzen); ctx.strokeStyle = farben.grenze; ctx.lineWidth = 0.5; ctx.stroke();
    // Nachtseite: zwei Stufen für einen weichen Übergang
    if (nacht) {
      ctx.fillStyle = farben.nacht;
      for (const n of nacht) { ctx.beginPath(); path(n); ctx.fill(); }
    }
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = farben.rand; ctx.lineWidth = 1.2; ctx.stroke();

    const pr = Math.max(2.4, w / 200);

    // Orientierungs-Schichten (zählen nicht zur Bewertung): dezente Rauten
    for (const p of schicht) {
      if (!istVorne(p)) { p.xy = null; continue; }
      const [x, y] = proj([p.lon, p.lat]);
      p.xy = [x, y];
      const s = pr * (0.6 + (p.staerke ?? 0.3) * 1.1);
      ctx.globalAlpha = 0.45 + 0.2 * (p.staerke ?? 0.3);
      ctx.fillStyle = farben.schicht;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Messorte
    const rang = { leer: 0, ruhig: 1, erhoeht: 2, auf: 3 };
    const sortiert = [...punkte].sort((a, b) => rang[a.zustand] - rang[b.zustand]);
    for (const p of sortiert) {
      if (!istVorne(p)) { p.xy = null; continue; }
      const [x, y] = proj([p.lon, p.lat]);
      p.xy = [x, y];
      if (p.zustand === 'auf') leuchtpunkt(x, y, pr, p.farbe, t, p.ph, true);
      else if (p.zustand === 'erhoeht') leuchtpunkt(x, y, pr * 0.8, farben.etwas, t, p.ph, false);
      else if (p.zustand === 'leer') { ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.8; kreis(x, y, pr * 1.2); ctx.stroke(); }
      else {
        const a = welle(p.ph);
        ctx.globalAlpha = 0.18 + 0.1 * a; ctx.fillStyle = farben.ruhig; kreis(x, y, pr * (2.4 + 0.5 * a)); ctx.fill();
        ctx.globalAlpha = 0.85 + 0.15 * a; kreis(x, y, pr * 0.95); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (auswahl === p.id) { ctx.strokeStyle = farben.kern; ctx.lineWidth = 2; kreis(x, y, pr * 3.4); ctx.stroke(); }
    }

    // Weltweite Messungen als Punktring um die Kugel; dreht leise mit
    if (ring.length) {
      const R = r * 1.1;
      const off = (-rot[0] * Math.PI) / 180 * 0.25 - Math.PI / 2;
      ring.forEach((p, i) => {
        const wkl = off + (i / ring.length) * 2 * Math.PI;
        const x = cx + R * Math.cos(wkl), y = cy + R * Math.sin(wkl);
        p.xy = [x, y];
        if (p.zustand === 'auf') leuchtpunkt(x, y, pr * 0.9, p.farbe, t, p.ph, false);
        else if (p.zustand === 'erhoeht') { ctx.fillStyle = farben.etwas; ctx.globalAlpha = 0.95; kreis(x, y, pr * 1.05); ctx.fill(); }
        else if (p.zustand === 'leer') { ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; kreis(x, y, pr * 0.7); ctx.stroke(); }
        else { const a = welle(p.ph, 1500); ctx.fillStyle = farben.ruhig; ctx.globalAlpha = 0.6 + 0.3 * a; kreis(x, y, pr * (0.7 + 0.12 * a)); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (auswahl === p.id) { ctx.strokeStyle = farben.kern; ctx.lineWidth = 2; kreis(x, y, pr * 2.6); ctx.stroke(); }
      });
    }

    // Beschriftung: die stärksten ungewöhnlichen Punkte, dazu der Punkt unter dem Zeiger
    const marken = [...punkte, ...ring].filter((p) => p.xy && p.zustand === 'auf').sort((a, b) => (b.staerke ?? 0) - (a.staerke ?? 0)).slice(0, beschriften);
    if (zeiger?.xy && !marken.includes(zeiger)) marken.push(zeiger);
    const belegt = [];
    for (const p of marken) etikett(p.xy[0], p.xy[1], cx, cy, p, w, belegt, p === zeiger);
  }

  // ---------- Bewegung ----------
  const darfDrehen = () => bewegt() && performance.now() - letzteBenutzung > RUHE_MS;
  const laeuft = () => bewegt() && sichtbar && !document.hidden;

  function schleife(t) {
    raf = 0;
    if (aus || !canvas.isConnected) return;
    const dt = tLetzt ? Math.min(t - tLetzt, 100) : 16;
    tLetzt = t;
    if (anim) {
      const k = Math.min(1, (t - anim.t0) / anim.dauer);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const p = anim.interp(e);
      rot = [-p[0], -p[1], 0];
      if (k >= 1) anim = null;
    } else if (darfDrehen() && sichtbar && !document.hidden) {
      rot[0] += (GRAD_S * dt) / 1000;
    }
    if (anim || t - tBild >= BILD_MS) { tBild = t; zeichnen(t); }
    if (anim || laeuft()) anfordern();
    else tLetzt = 0;
  }
  function anfordern() { if (!raf && !aus) raf = requestAnimationFrame(schleife); }

  function zuOrt(lon, lat) {
    const ziel = [lon, Math.max(-50, Math.min(50, lat))];
    letzteBenutzung = performance.now();
    if (!bewegt()) { rot = [-ziel[0], -ziel[1], 0]; zeichnen(); return; }
    anim = { interp: geoInterpolate(mitte(), ziel), t0: performance.now(), dauer: 700 };
    anfordern();
  }

  // ---------- Zeiger ----------
  function naechster(x, y, max) {
    let best = null;
    let bd = max * max;
    for (const p of [...punkte, ...ring, ...schicht]) {
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
      if (e.pointerType === 'mouse') {
        const p = naechster(...lokal(e), 14);
        canvas.style.cursor = p ? 'pointer' : 'grab';
        if (p !== zeiger) { zeiger = p; letzteBenutzung = p ? performance.now() + 60_000 : performance.now() - RUHE_MS + 1500; zeichnen(); anfordern(); }
      }
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
  canvas.addEventListener('pointerleave', () => { if (zeiger && !zug) { zeiger = null; letzteBenutzung = performance.now() - RUHE_MS + 1500; zeichnen(); anfordern(); } });
  const ende = (e) => {
    if (!zug || e.pointerId !== zug.id) return;
    const weg = Math.abs(e.clientX - zug.x0) + Math.abs(e.clientY - zug.y0);
    if (e.type === 'pointerup' && weg < 8 && performance.now() - zug.t < 600) {
      // Öffnen erst beim folgenden click: sonst träfe der nachgereichte Klick einer Berührung schon die geöffnete Karte
      tippZiel = naechster(...lokal(e), e.pointerType === 'mouse' ? 14 : 22) ?? null;
    }
    zug = null;
    letzteBenutzung = performance.now();
    anfordern();
  };
  canvas.addEventListener('pointerup', ende);
  canvas.addEventListener('click', () => {
    const p = tippZiel; tippZiel = null;
    if (!p) { if (zeiger) { zeiger = null; zeichnen(); } return; }
    if (p.id && onPick) onPick(p.id);
    else { zeiger = p; letzteBenutzung = performance.now(); zeichnen(); }
  });
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
  const beiBewegung = () => { zeichnen(); anfordern(); };
  ruhigBewegung.addEventListener('change', beiBewegung);

  leseFarben();
  messen();

  return {
    /** punkte: Messorte, ring: Messungen ohne Ort, schicht: Orientierungspunkte, laender: Map ISO-Nummer → Zustand */
    setze({ punkte: p = [], ring: r = [], schicht: s = [], laender: l = new Map() }) {
      const mitPhase = (x) => ({ ...x, xy: null, ph: phase(String(x.id ?? `${x.lon},${x.lat}`)) });
      punkte = p.map(mitPhase);
      ring = r.map(mitPhase);
      schicht = s.slice(0, Math.max(0, MAX_PUNKTE - punkte.length - ring.length)).map(mitPhase);
      laender = l;
      if (zeiger) zeiger = null;
      leseFarben();
      zeichnen();
      anfordern();
    },
    setzeZeit(d) { setzeZeit(d); zeichnen(); },
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
      ruhigBewegung.removeEventListener('change', beiBewegung);
    },
  };
}
