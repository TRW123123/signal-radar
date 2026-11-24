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
  let eigen = true; // Eigendrehung erlaubt (aus im Rückblick)
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
      nacht: v('--g-nacht'), schicht: v('--g-schicht'), schicht2: v('--g-schicht2') || v('--g-schicht'), auf: v('--g-auf'), zahl: v('--g-zahl') || '#05080f', tinte: v('--tinte'), grund: v('--grund'), schrift: cs.fontFamily,
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
    if (gross && bewegt()) {
      const k = ((t / 2200 + ph / (2 * Math.PI)) % 1);
      ctx.strokeStyle = farbe; ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = 1.5;
      kreis(x, y, pr * (1.6 + k * (gross ? 6 : 4))); ctx.stroke();
    }
    const hof = ctx.createRadialGradient(x, y, 0, x, y, pr * (gross ? 6 : 4));
    hof.addColorStop(0, farbe); hof.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5; ctx.fillStyle = hof; kreis(x, y, pr * (gross ? 6 : 4)); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = farbe; kreis(x, y, pr * (gross ? 1.6 : 1.25)); ctx.fill();
    ctx.strokeStyle = farbe; ctx.lineWidth = 1.4; kreis(x, y, pr * (gross ? 2.4 : 2)); ctx.stroke();
    if (gross) { ctx.globalAlpha = 0.6; ctx.lineWidth = 1; kreis(x, y, pr * 3.3); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = farben.kern; kreis(x, y, pr * 0.55); ctx.fill();
  }

  function etikett(x, y, cx, cy, p, w, belegt, immer) {
    const name = p.marke || p.titel || '';
    // Zählt Messungen am selben Ort, nicht alle auffälligen Messungen: so sagen, damit es nicht der Überschrift widerspricht
    const amOrt = /^en/i.test(document.documentElement.lang || '') ? 'at this place' : 'am selben Ort';
    const kopf = p.anzahl > 1 ? `${name} (+${p.anzahl - 1} ${amOrt})` : name;
    const maxB = Math.max(120, w * 0.56) - 14;
    // Überschrift auf höchstens zwei Zeilen umbrechen statt abschneiden
    ctx.font = `700 12px ${farben.schrift}`;
    const oben = [];
    let rest = kopf.split(/\s+/).filter(Boolean);
    while (rest.length && oben.length < 2) {
      let n = rest.length;
      while (n > 1 && ctx.measureText(rest.slice(0, n).join(' ')).width > maxB) n--;
      oben.push(rest.slice(0, n).join(' '));
      rest = rest.slice(n);
    }
    if (rest.length && oben.length) oben[oben.length - 1] += ' ' + rest.join(' ');
    // Infozeile ebenfalls umbrechen (höchstens zwei Zeilen), damit nichts abgeschnitten wird
    ctx.font = `400 11px ${farben.schrift}`;
    const unten = [];
    let wr = String(p.info ?? '').split(/\s+/).filter(Boolean);
    while (wr.length && unten.length < 2) {
      let n = wr.length;
      while (n > 1 && ctx.measureText(wr.slice(0, n).join(' ')).width > maxB) n--;
      unten.push(wr.slice(0, n).join(' '));
      wr = wr.slice(n);
    }
    if (wr.length && unten.length) unten[unten.length - 1] += ' ' + wr.join(' ');
    const zeilen = [...oben, ...unten].filter(Boolean);
    if (!zeilen.length) return;
    const nOben = oben.length;
    const breiten = zeilen.map((z, i) => { ctx.font = i < nOben ? `700 12px ${farben.schrift}` : `400 11px ${farben.schrift}`; return ctx.measureText(z).width; });
    const bw = Math.min(Math.max(...breiten) + 14, maxB + 14);
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
    ctx.globalAlpha = 0.92; ctx.fillStyle = farben.grund;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, bw, bh, 6) : ctx.rect(lx, ly, bw, bh); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = p.farbe || farben.rand; ctx.stroke();
    ctx.fillStyle = farben.tinte; ctx.textBaseline = 'top';
    const kuerze = (s, max) => { if (ctx.measureText(s).width <= max) return s; while (s.length > 3 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; };
    zeilen.forEach((z, i) => { ctx.font = i < nOben ? `700 12px ${farben.schrift}` : `400 11px ${farben.schrift}`; ctx.fillText(kuerze(z, bw - 14), lx + 7, ly + 5 + i * 15); });
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
    const saum = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.22);
    saum.addColorStop(0, farben.hof); saum.addColorStop(0.25, farben.hof); saum.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.9; ctx.fillStyle = saum; kreis(cx, cy, r * 1.22); ctx.fill(); ctx.globalAlpha = 1;

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
      ctx.globalAlpha = z.auf ? 0.38 : 0.16;
      ctx.fillStyle = z.auf ? farben.auf || z.farbe : farben.ruhig;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); path(atlas.grenzen); ctx.strokeStyle = farben.grenze; ctx.lineWidth = 0.5; ctx.stroke();
    // Nachtseite: zwei Stufen für einen weichen Übergang
    if (nacht) {
      ctx.fillStyle = farben.nacht;
      for (const n of nacht) { ctx.beginPath(); path(n); ctx.fill(); }
    }
    // Lichtkante der Atmosphäre
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.strokeStyle = farben.rand; ctx.lineWidth = 1.6; ctx.stroke();
    const glanz = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, 0, cx - r * 0.45, cy - r * 0.5, r * 1.1);
    glanz.addColorStop(0, 'rgba(160,210,255,0.10)'); glanz.addColorStop(1, 'rgba(160,210,255,0)');
    ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = glanz; ctx.fill();

    const pr = Math.max(3.2, w / 125);

    // Orientierungs-Schichten (zählen nicht zur Bewertung): dezente Rauten
    for (const p of schicht) {
      if (!istVorne(p)) { p.xy = null; continue; }
      const [x, y] = proj([p.lon, p.lat]);
      p.xy = [x, y];
      const s = pr * (1.05 + (p.staerke ?? 0.3) * 0.9);
      ctx.globalAlpha = 0.6 + 0.25 * (p.staerke ?? 0.3);
      ctx.fillStyle = p.form === 'dreieck' ? farben.schicht2 : farben.schicht;
      ctx.strokeStyle = farben.zahl; ctx.lineWidth = 1;
      ctx.beginPath();
      if (p.form === 'dreieck') { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s, y + s * 0.75); ctx.lineTo(x - s, y + s * 0.75); }
      else { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (zeiger === p) { ctx.globalAlpha = 1; ctx.strokeStyle = farben.kern; ctx.lineWidth = 1.5; kreis(x, y, s * 1.8); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    // Messorte, nahe Punkte zu einem Punkt mit Zahl gebündelt (wichtigster Zustand zeigt sich)
    const rang = { leer: 0, ruhig: 1, erhoeht: 2, auf: 3 };
    const sortiert = [...punkte].sort((a, b) => rang[b.zustand] - rang[a.zustand] || (b.staerke ?? 0) - (a.staerke ?? 0));
    const gruppen = [];
    const nah = (pr * 3.2) ** 2;
    for (const p of sortiert) {
      p.anzahl = 0;
      if (!istVorne(p)) { p.xy = null; continue; }
      const [x, y] = proj([p.lon, p.lat]);
      const g = gruppen.find((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < nah);
      if (g) { g.n++; g.ids.push(p.id); p.xy = null; if (auswahl === p.id) g.wahl = true; continue; }
      p.xy = [x, y];
      gruppen.push({ p, x, y, n: 1, ids: [p.id], wahl: auswahl === p.id });
    }
    for (const g of gruppen.reverse()) {
      const { p, x, y } = g;
      p.anzahl = g.n;
      p.gruppe = g.ids;
      const k = g.n > 1 ? 1 + 0.12 * Math.min(5, g.n - 1) : 1;
      if (p.zustand === 'auf') leuchtpunkt(x, y, pr * k, farben.auf || p.farbe, t, p.ph, true);
      else if (p.zustand === 'erhoeht') leuchtpunkt(x, y, pr * 0.85 * k, farben.etwas, t, p.ph, false);
      else if (p.zustand === 'leer') { ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6 + 0.25 * welle(p.ph); kreis(x, y, pr * 1.1 * k); ctx.stroke(); }
      else {
        const a = welle(p.ph, 1400);
        const hof = ctx.createRadialGradient(x, y, 0, x, y, pr * (3.2 + 0.8 * a) * k);
        hof.addColorStop(0, farben.ruhig); hof.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.42 + 0.22 * a; ctx.fillStyle = hof; kreis(x, y, pr * (3.2 + 0.8 * a) * k); ctx.fill();
        if (bewegt()) {
          // leiser Ring, der langsam nach außen läuft
          const kk = ((t / 3600 + p.ph / (2 * Math.PI)) % 1);
          ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1; ctx.globalAlpha = 0.45 * (1 - kk);
          kreis(x, y, pr * (1.2 + kk * 3.2) * k); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.fillStyle = farben.ruhig; kreis(x, y, pr * (0.95 + 0.12 * a) * k); ctx.fill();
        ctx.fillStyle = farben.kern; ctx.globalAlpha = 0.8; kreis(x, y, pr * 0.35 * k); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (g.n > 1) {
        const bx = x + pr * 1.7 * k, by = y - pr * 1.7 * k;
        const txt = String(g.n);
        ctx.font = `700 10px ${farben.schrift}`;
        const bw = Math.max(15, ctx.measureText(txt).width + 8);
        ctx.fillStyle = farben.zahl; ctx.strokeStyle = p.zustand === 'auf' ? farben.auf : p.zustand === 'erhoeht' ? farben.etwas : farben.ruhig; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - bw / 2, by - 7.5, bw, 15, 7.5) : ctx.rect(bx - bw / 2, by - 7.5, bw, 15); ctx.fill(); ctx.stroke();
        ctx.fillStyle = farben.kern; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx, by + 0.5); ctx.textAlign = 'start';
      }
      if (g.wahl) { ctx.strokeStyle = farben.kern; ctx.lineWidth = 2; kreis(x, y, pr * 3.4 * k); ctx.stroke(); }
    }

    // Weltweite Messungen als Punktring um die Kugel; dreht leise mit
    if (ring.length) {
      const R = r * 1.1;
      const off = (-rot[0] * Math.PI) / 180 * 0.25 - Math.PI / 2;
      ring.forEach((p, i) => {
        const wkl = off + (i / ring.length) * 2 * Math.PI;
        const x = cx + R * Math.cos(wkl), y = cy + R * Math.sin(wkl);
        p.xy = [x, y];
        if (p.zustand === 'auf') leuchtpunkt(x, y, pr * 0.8, farben.auf || p.farbe, t, p.ph, false);
        else if (p.zustand === 'erhoeht') { ctx.fillStyle = farben.etwas; ctx.globalAlpha = 0.95; kreis(x, y, pr * 0.7); ctx.fill(); ctx.strokeStyle = farben.etwas; ctx.lineWidth = 1; kreis(x, y, pr * 1.2); ctx.stroke(); }
        else if (p.zustand === 'leer') { ctx.strokeStyle = farben.ruhig; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; kreis(x, y, pr * 0.5); ctx.stroke(); }
        else { const a = welle(p.ph, 1500); ctx.fillStyle = farben.ruhig; ctx.globalAlpha = 0.55 + 0.25 * a; kreis(x, y, pr * (0.42 + 0.08 * a)); ctx.fill(); }
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
  const darfDrehen = () => eigen && bewegt() && performance.now() - letzteBenutzung > RUHE_MS;
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
  // Messpunkte haben Vorrang: Orientierungspunkte nur, wenn kein Messpunkt in Reichweite liegt
  function naechster(x, y, max) {
    const suche = (liste) => {
      let best = null;
      let bd = max * max;
      for (const p of liste) {
        if (!p.xy) continue;
        const d = (p.xy[0] - x) ** 2 + (p.xy[1] - y) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    };
    return suche([...punkte, ...ring]) ?? suche(schicht);
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
    if (p.id && onPick) onPick(p.id, (p.gruppe ?? []).filter(Boolean));
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
    /** Eigendrehung an/aus (im Rückblick aus) */
    drehen(an) { eigen = !!an; if (an) anfordern(); },
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
