// Signal Radar – Globus-Fassung. Statisch, kein Build, keine Anfragen an fremde Hosts außer dem Snapshot-Abruf.
// Datenvertrag: Snapshot aus src/core/types.ts. Oberflächen-Texte: js/texte.js.
import { T } from './js/texte.js';
import { ladeAtlas, erstelleGlobus } from './js/globus.js';

// ---------- Sprache ----------
const SPRACHE_KEY = 'sr-sprache';
let sprache = 'de';
try { const s = localStorage.getItem(SPRACHE_KEY); if (s === 'de' || s === 'en') sprache = s; } catch { /* kein Speicher */ }
let L = T[sprache];

const DOMAIN_ACTIVE = 0.25; // src/engine/score.ts
const SIGNAL_AUF = 0.25; // Messung gilt als ungewöhnlich ab diesem Anteil (nach Abschwächung)
const DEMOS = ['calm', 'rumor', 'single', 'elevated', 'acute', 'multi', 'sparse'];
const STALE_H = 3;
const SNAPSHOT_REMOTE = 'https://raw.githubusercontent.com/TRW123123/signal-radar/master/frontend/data/snapshot.json';

// ISO 3166-1 alpha-2 → numerisch (world-atlas `id`), nur für Länder, die als Messort vorkommen können.
const ISO_NUM = {
  AF: '004', AL: '008', DZ: '012', AO: '024', AR: '032', AM: '051', AU: '036', AT: '040', AZ: '031', BD: '050', BY: '112', BE: '056',
  BO: '068', BA: '070', BR: '076', BG: '100', MM: '104', CA: '124', CL: '152', CN: '156', TW: '158', CO: '170', CD: '180', HR: '191',
  CU: '192', CY: '196', CZ: '203', DK: '208', EC: '218', EG: '818', EE: '233', ET: '231', FI: '246', FR: '250', GE: '268', DE: '276',
  GH: '288', GR: '300', HT: '332', HU: '348', IS: '352', IN: '356', ID: '360', IR: '364', IQ: '368', IE: '372', IL: '376', IT: '380',
  JP: '392', JO: '400', KZ: '398', KE: '404', KP: '408', KR: '410', XK: '-99', KW: '414', LV: '428', LB: '422', LY: '434', LT: '440',
  LU: '442', MY: '458', ML: '466', MX: '484', MD: '498', MN: '496', ME: '499', MA: '504', MZ: '508', NL: '528', NZ: '554', NE: '562',
  NG: '566', MK: '807', NO: '578', OM: '512', PK: '586', PS: '275', PA: '591', PE: '604', PH: '608', PL: '616', PT: '620', QA: '634',
  RO: '642', RU: '643', SA: '682', RS: '688', SK: '703', SI: '705', SO: '706', ZA: '710', SS: '728', ES: '724', LK: '144', SD: '729',
  SE: '752', CH: '756', SY: '760', TJ: '762', TH: '764', TN: '788', TR: '792', TM: '795', UG: '800', UA: '804', AE: '784', GB: '826',
  US: '840', UY: '858', UZ: '860', VE: '862', VN: '704', YE: '887', ZM: '894', ZW: '716', GL: '304', SN: '686', CM: '120', CI: '384',
};

// ---------- Formatierung ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function nf(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  return new Intl.NumberFormat(L.locale, { maximumFractionDigits: a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3 }).format(v);
}
const mitEinheit = (v, unit) => `${nf(v)}${unit === 'x normal' ? '-fach' : unit ? ' ' + unit : ''}`;
const zeit = (iso) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
const kurz = (iso) => (iso ? new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '–');
const tag = (ms) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'numeric' }).format(new Date(ms));
const extern = (url, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" rel="noopener noreferrer external">${text}<span class="nur-vorleser"> ${esc(L.karte.extern)}</span></a>`;

// ---------- Laden ----------
const params = new URLSearchParams(location.search);
const demo = params.get('demo');
class LadeFehler extends Error { constructor(art, status) { super(art); this.art = art; this.status = status; } }
let ersatzkopie = false;

const pruefe = (s) => !!s && s.schema === 1 && Array.isArray(s.scenarios) && s.scenarios.length > 0 && Number.isFinite(Date.parse(s.generatedAt));

async function holeJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try { res = await fetch(url, { cache: 'no-store', signal: ctrl.signal }); } catch { throw new LadeFehler('netz'); } finally { clearTimeout(timer); }
  if (!res.ok) throw new LadeFehler('http', res.status);
  try { return await res.json(); } catch { throw new LadeFehler('format'); }
}

async function laden() {
  if (demo != null && !DEMOS.includes(demo)) throw new LadeFehler('demo');
  // Einzeldatei-Fassung: Snapshot eingebettet
  const eingebettet = !demo && globalThis.__SR_SNAPSHOT__;
  if (eingebettet) { if (!pruefe(eingebettet)) throw new LadeFehler('format'); return eingebettet; }
  // Live-Seite lädt den Snapshot direkt aus dem Repo; fällt die Quelle aus, gilt die mitgelieferte Kopie.
  const lokal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const quellen = demo ? [`data/demo-${demo}.json`] : lokal ? ['data/snapshot.json'] : [SNAPSHOT_REMOTE, 'data/snapshot.json'];
  let letzter;
  for (const url of quellen) {
    try {
      const snap = await holeJson(url);
      if (pruefe(snap)) { ersatzkopie = !demo && !lokal && url === 'data/snapshot.json'; return snap; }
      letzter = new LadeFehler('format');
    } catch (e) { letzter = e; }
  }
  throw letzter;
}

async function ladeGeruechte() {
  try {
    const r = await fetch('data/rumors.json', { cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j.filter((x) => x && x.id && x.title) : [];
  } catch { return []; }
}

// ---------- Ableitungen ----------
const gebaut = (sigs) => sigs.filter((s) => s.status === 'active');
const hatDaten = (d) => d.signals.some((s) => s.status === 'active' && s.fresh);
const zuWenig = (sc) => (sc.coverage?.domainsWithData ?? 0) < 3;
const linsenName = (sc) => L.linsenName[sc.id] ?? sc.title;
// Daten-Texte aus dem Katalog: einzelne Fachwörter für die Anzeige ersetzen (Wörterbuch im Auftrag)
const klar = (t) => String(t ?? '').replace(/Telemetrie/g, 'Messdaten').replace(/Messreihen?/g, 'Messung');
const stufenName = (sc) => (zuWenig(sc) ? L.zuWenig : L.stufen[sc.level] ?? L.stufen[0]);
const staerke = (s) => s.anomaly * (s.damp?.factor ?? 1);
function zustandVon(s) {
  if (!s.fresh || s.value == null) return 'leer';
  return staerke(s) >= SIGNAL_AUF ? 'auf' : 'ruhig';
}
function stufenFarbe(k) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--l${Math.max(1, Math.min(4, k))}`).trim();
}

/** Alle gebauten Messungen der Linse mit Bereich und Zustand */
function messungen(sc) {
  const out = [];
  for (const d of sc.domains) for (const s of gebaut(d.signals)) out.push({ s, d, zustand: zustandVon(s) });
  return out;
}

// ---------- Zustand ----------
const zustand = { snap: null, id: null, geruechte: [], globus: null, atlasFehler: false, hinweisGezeigt: false, karteVon: null };
const aktuell = () => zustand.snap.scenarios.find((x) => x.id === zustand.id) ?? zustand.snap.scenarios[0];
const signalIndex = new Map();

// ---------- Kopf ----------
function renderKopf() {
  const snap = zustand.snap;
  document.documentElement.lang = sprache;
  document.title = L.titel;
  $('satz').textContent = L.satz;
  $('sprung').textContent = L.sprung;
  for (const b of document.querySelectorAll('[data-sprache]')) b.setAttribute('aria-pressed', String(b.dataset.sprache === sprache));
  $('sprachwahl').setAttribute('aria-label', L.sprache);
  if (!snap) return;
  const live = snap.mode === 'live';
  const alter = Math.max(0, (Date.now() - Date.parse(snap.generatedAt)) / 3600000);
  $('stand').innerHTML = `${live ? `<span class="live-marke">${esc(L.live)}</span>` : ''}<time datetime="${esc(snap.generatedAt)}">${esc(L.stand(zeit(snap.generatedAt)))}</time> <span class="stand-alter">· ${esc(L.vor(Math.floor(alter)))}</span>`;
  const veraltet = live && alter > STALE_H;
  $('hinweise').innerHTML = (ersatzkopie ? `<p class="warnung" role="status">${esc(L.ersatz)}</p>` : '')
    + (veraltet ? `<p class="warnung" role="status">${esc(L.veraltet(Math.floor(alter)))}</p>` : '')
    + (sprache === 'en' && !zustand.hinweisGezeigt ? `<p class="hinweis" role="status">${esc(L.nurDeutsch)}</p>` : '');
  const b = $('betrieb');
  const m = L.betrieb[snap.mode];
  b.hidden = !m;
  if (m) b.innerHTML = `<p><strong>${esc(m[0])}</strong> ${esc(m[1])}${snap.note && sprache === 'de' ? ` <span class="betrieb-notiz">${esc(snap.note)}</span>` : ''}</p>`;
}

// ---------- Linsen ----------
function renderLinsen() {
  const nav = $('linsen');
  const scs = zustand.snap.scenarios;
  nav.hidden = false;
  nav.innerHTML = `<p class="linsen-frage" id="linsen-frage">${esc(L.linsen)}</p>
    <div class="linsen-reihe" role="tablist" aria-labelledby="linsen-frage">${scs.map((sc) => {
      const an = sc.id === aktuell().id;
      const lv = zuWenig(sc) ? 'x' : sc.level;
      return `<button type="button" role="tab" class="linse z-l${lv}" id="tab-${esc(sc.id)}" data-id="${esc(sc.id)}" aria-selected="${an}" aria-controls="antwort" tabindex="${an ? 0 : -1}">
        <span class="linse-name">${esc(linsenName(sc))}</span>
        <span class="linse-zustand"><i class="lampe-klein" aria-hidden="true"></i>${esc(stufenName(sc))}</span>
      </button>`;
    }).join('')}</div>`;
  const tabs = [...nav.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => waehle(tab.dataset.id, true));
    tab.addEventListener('keydown', (e) => {
      const ziel = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (ziel == null) return;
      e.preventDefault();
      const t = tabs[(ziel + tabs.length) % tabs.length];
      t.focus();
      waehle(t.dataset.id, true);
    });
  });
}

function waehle(id, nutzer) {
  if (!zustand.snap.scenarios.some((s) => s.id === id) || id === zustand.id) return;
  zustand.id = id;
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
  for (const t of document.querySelectorAll('.linse')) {
    const an = t.dataset.id === id;
    t.setAttribute('aria-selected', String(an));
    t.tabIndex = an ? 0 : -1;
  }
  renderLinse();
  if (nutzer) $('ansage').textContent = L.ansage(linsenName(aktuell()), stufenName(aktuell()));
}

// ---------- Antwort ----------
function antwort(sc) {
  const A = L.antwort;
  const mit = sc.coverage?.domainsWithData ?? sc.domains.filter(hatDaten).length;
  const alle = sc.coverage?.domainsTotal ?? sc.domains.length;
  const aktiv = sc.domains.filter((d) => d.active);
  const namen = aktiv.map((d) => klar(d.title)).join(', ');
  let satz;
  if (zuWenig(sc)) satz = A.zuWenig(mit, alle);
  else if (!aktiv.length || sc.level === 0) satz = A.ruhig(mit);
  else if (aktiv.length === 1) satz = A.eins(mit, namen);
  else satz = A.mehr(mit, aktiv.length, namen);
  const lv = zuWenig(sc) ? 'x' : sc.level;
  return `<div class="antwort a-l${lv}" id="antwort" role="tabpanel" aria-labelledby="tab-${esc(sc.id)}">
      <p class="antwort-frage">${esc(sc.question)}</p>
      <h1 class="antwort-stufe"><i class="lampe-gross" aria-hidden="true"></i>${esc(stufenName(sc))}.</h1>
      <p class="antwort-satz">${esc(satz)}</p>
    </div>`;
}

// ---------- Globus und Weltweit ----------
function punktLabel(m) {
  return `${m.s.geo ? m.s.geo.label + ' – ' : ''}${m.s.name}: ${L.globus.zustand[m.zustand]}`;
}

function globusBlock(sc, ms) {
  const G = L.globus;
  const c = sc.coverage ?? { fresh: 0, active: 0 };
  const zusatz = `<div class="antwort-zusatz"><p class="antwort-messbar">${esc(L.antwort.messbar(c.fresh, c.active))}</p><p class="antwort-klein">${esc(L.antwort.keineVorhersage)}</p></div>`;
  const mitOrt = ms.filter((m) => m.s.geo);
  const ohneOrt = ms.filter((m) => !m.s.geo);
  const auf = mitOrt.filter((m) => m.zustand === 'auf').length;
  const reihen = (a) => [...a].sort((x, y) => ({ auf: 0, leer: 1, ruhig: 2 }[x.zustand] - { auf: 0, leer: 1, ruhig: 2 }[y.zustand]) || staerke(y.s) - staerke(x.s));
  const liste = reihen(mitOrt).map((m) => `<li><button type="button" class="ort z-${m.zustand}" data-sig="${esc(m.s.id)}"><i aria-hidden="true"></i><span class="ort-name">${esc(m.s.geo.label)}</span> <span class="ort-mess">${esc(klar(m.s.name))}</span> <span class="ort-zustand">${esc(G.zustand[m.zustand])}</span></button></li>`).join('');
  const benannt = reihen(ohneOrt.filter((m) => m.zustand !== 'ruhig'));
  const ruhig = ohneOrt.filter((m) => m.zustand === 'ruhig');
  const weltweit = ohneOrt.length ? `<section class="weltweit" aria-labelledby="ww-titel">
      <h2 id="ww-titel" class="klein-titel"><span class="ww-zeichen" aria-hidden="true"></span>${esc(G.weltweit)} <span class="zahl">${ohneOrt.length}</span></h2>
      <p class="ww-erkl">${esc(G.weltweitErkl)}</p>
      ${benannt.length ? `<ul class="ww-liste">${benannt.map((m) => `<li><button type="button" class="ort z-${m.zustand}" data-sig="${esc(m.s.id)}"><i aria-hidden="true"></i><span class="ort-mess">${esc(klar(m.s.name))}</span> <span class="ort-zustand">${esc(G.zustand[m.zustand])}</span></button></li>`).join('')}</ul>` : ''}
      ${ruhig.length ? `<div class="ww-punkte"><span class="ww-reihe">${ruhig.map((m) => `<button type="button" class="ww-punkt" tabindex="-1" data-sig="${esc(m.s.id)}" aria-label="${esc(punktLabel(m))}" title="${esc(klar(m.s.name))}"></button>`).join('')}</span><span class="ww-zahl">${esc(G.weltweitRuhig(ruhig.length))}</span></div>` : ''}
    </section>` : '';
  return `<figure class="globus-feld">
      <div class="globus-rahmen">
        <canvas id="globus" class="globus" role="img" aria-label="${esc(G.label(mitOrt.length, auf))}"></canvas>
        ${mitOrt.length ? '' : `<p class="globus-leer">${esc(G.leer)}</p>`}
      </div>
      <figcaption class="globus-legende">
        <span class="leg leg-ruhig"><i aria-hidden="true"></i>${esc(G.legende[0])}</span>
        <span class="leg leg-auf l-${Math.max(1, sc.level)}"><i aria-hidden="true"></i>${esc(G.legende[1])}</span>
        <span class="leg leg-leer"><i aria-hidden="true"></i>${esc(G.legende[2])}</span>
        <span class="leg-hilfe">${esc(G.ziehen)}</span>
      </figcaption>
    </figure>
    <div class="globus-neben">
      ${zusatz}
      ${mitOrt.length ? `<details class="ortsliste"><summary>${esc(G.liste(mitOrt.length))}</summary><ul>${liste}</ul></details>` : ''}
      ${weltweit}
    </div>`;
}

function globusDaten(sc, ms) {
  const farbe = stufenFarbe(Math.max(1, sc.level));
  const belegt = new Map();
  const punkte = [];
  const laender = new Map();
  for (const m of ms) {
    const g = m.s.geo;
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
    const key = `${g.lat.toFixed(1)},${g.lon.toFixed(1)}`;
    const k = belegt.get(key) ?? 0;
    belegt.set(key, k + 1);
    // gleiche Stelle: kleine Spirale, damit jeder Punkt antippbar bleibt
    const w = k * 2.4;
    const r = k ? 1.1 * Math.sqrt(k) : 0;
    punkte.push({ id: m.s.id, lon: g.lon + r * Math.cos(w), lat: g.lat + r * Math.sin(w), zustand: m.zustand, farbe });
    if (g.kind === 'country' && g.cc && ISO_NUM[g.cc.toUpperCase()]) {
      const id = ISO_NUM[g.cc.toUpperCase()];
      const z = laender.get(id) ?? { auf: false, farbe };
      if (m.zustand === 'auf') z.auf = true;
      laender.set(id, z);
    }
  }
  return { punkte, laender };
}

function startOrt(ms) {
  const auf = ms.filter((m) => m.s.geo && m.zustand === 'auf');
  if (!auf.length) return [10, 28];
  // Mittelpunkt der ungewöhnlichen Orte (über Einheitsvektoren)
  let x = 0, y = 0, z = 0;
  for (const m of auf) {
    const la = (m.s.geo.lat * Math.PI) / 180, lo = (m.s.geo.lon * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la);
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, Math.max(-40, Math.min(45, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI))];
}

// ---------- Regel ----------
function regel(sc) {
  const R = L.regel;
  const doms = sc.domains;
  const k = zuWenig(sc) ? 0 : sc.activeDomains;
  const lampen = doms.map((d) => {
    const z = !hatDaten(d) ? 'leer' : d.active ? 'auf' : 'ruhig';
    return `<li class="lampe z-${z}"><i aria-hidden="true"></i><span>${esc(klar(d.title))}</span><span class="nur-vorleser"> ${esc(L.globus.zustand[z])}</span></li>`;
  }).join('');
  const leiter = [1, 2, 3, 4].map((n) => {
    const an = Math.min(k, 4) === n;
    return `<li class="sprosse${an ? ' an' : ''}${k >= n ? ' erreicht' : ''} s-${n}"${an ? ' aria-current="true"' : ''}><span class="sprosse-zahl">${esc(R.stufe(n))}</span><span class="sprosse-stufe">${esc(R.hoechstens(L.stufen[n]))}</span></li>`;
  }).join('');
  return `<section class="regel abschnitt l-${Math.max(1, sc.level)}" aria-labelledby="regel-titel">
      <h2 id="regel-titel" class="abschnitt-titel">${esc(R.titel)}</h2>
      <p class="regel-satz">${esc(R.satz)}</p>
      <ul class="lampen" aria-label="${esc(R.lampen)}">${lampen}</ul>
      <p class="regel-jetzt">${esc(R.jetzt(k))}</p>
      <ol class="leiter" aria-label="${esc(R.leiter)}">${leiter}</ol>
    </section>`;
}

// ---------- Gerede gegen Messung ----------
function gerede(sc) {
  const G = L.gerede;
  const att = (sc.attentionSignals ?? []).some((s) => s.status === 'active' && s.fresh);
  const netz = att ? G.netzWort(sc.attention ?? 0) : G.netzKeine;
  const daten = zuWenig(sc) ? G.datenWenig : sc.level === 0 ? G.daten0 : G.datenN(L.stufen[sc.level], sc.activeDomains);
  const luecke = att && !zuWenig(sc) ? G.luecke[sc.rumorGap] ?? '' : '';
  const viel = att && (sc.attention ?? 0) >= 0.35;
  return `<section class="gerede abschnitt" aria-labelledby="gerede-titel">
      <h2 id="gerede-titel" class="abschnitt-titel">${esc(G.titel)}</h2>
      <dl class="gerede-zeilen">
        <div class="gz gz-netz${viel ? ' viel' : ''}"><dt>${esc(G.netz)}</dt><dd>${esc(netz)}</dd></div>
        <div class="gz gz-daten a-l${zuWenig(sc) ? 'x' : sc.level}"><dt>${esc(G.daten)}</dt><dd>${esc(daten)}</dd></div>
      </dl>
      ${luecke ? `<p class="gerede-luecke">${esc(luecke)}</p>` : ''}
      <p class="gerede-hinweis">${esc(G.hinweis)}</p>
    </section>`;
}

// ---------- Gerüchte ----------
function geruechte() {
  const liste = zustand.geruechte;
  if (!liste.length) return '';
  const G = L.geruechte;
  const sc = aktuell();
  const sortiert = [...liste].sort((a, b) => (b.scenario === sc.id) - (a.scenario === sc.id) || String(b.date).localeCompare(String(a.date)));
  return `<section class="geruechte abschnitt" aria-labelledby="ger-titel">
      <h2 id="ger-titel" class="abschnitt-titel">${esc(G.titel)}</h2>
      <p class="abschnitt-erkl">${esc(G.erkl)}</p>
      <ul class="ger-liste">${sortiert.map((r) => {
        const ziel = zustand.snap.scenarios.find((x) => x.id === r.scenario);
        const st = r.status ? { 'kein Beleg in den Daten': 'kein', teilweise: 'teil', offen: 'offen' }[r.status] ?? 'offen' : 'ohne';
        return `<li class="ger ger-${st}" id="geruecht-${esc(r.id)}">
          <p class="ger-kopf"><span class="ger-status">${r.status ? esc(G.status[r.status] ?? r.status) : esc(linsenName(ziel ?? { id: r.scenario, title: '' }))}</span>${r.date ? `<time datetime="${esc(r.date)}">${esc(tag(Date.parse(r.date)))}</time>` : ''}</p>
          <h3>${esc(r.title)}</h3>
          ${r.claim ? `<p class="ger-claim"><span>${esc(G.behauptung)}:</span> ${esc(r.claim)}</p>` : ''}
          ${r.factcheck ? `<p class="ger-claim"><span>${esc(G.faktencheck)}:</span> ${esc(r.factcheck)}</p>` : ''}
          ${r.outcome ? `<p class="ger-claim"><span>${esc(G.danach)}:</span> ${esc(r.outcome)}</p>` : ''}
          ${r.summary ? `<p>${esc(r.summary)}</p>` : ''}
          ${Array.isArray(r.sources) && r.sources.length ? `<details class="ger-quellen"><summary>${esc(G.quellen)} (${r.sources.length})</summary><ul>${r.sources.filter((q) => q?.url).map((q) => `<li>${extern(q.url, esc(q.title || q.url))}</li>`).join('')}</ul></details>` : ''}
          ${ziel && ziel.id !== sc.id ? `<p><button type="button" class="text-knopf" data-linse="${esc(ziel.id)}">${esc(G.zurLinse(linsenName(ziel)))}</button></p>` : ''}
        </li>`;
      }).join('')}</ul>
    </section>`;
}

// ---------- Für Neugierige ----------
const SW = 1000, SH = 40;
function spurSvg(hist, id, lvlCls) {
  const t = hist.map((h) => Date.parse(h.t));
  const t0 = t[0], t1 = t[t.length - 1];
  const x = (ms) => (t1 > t0 ? ((ms - t0) / (t1 - t0)) * SW : SW);
  const y = (v) => SH - Math.min(Math.max(v, 0), 1) * (SH - 4);
  let rects = '';
  let line = `M0 ${SH}`;
  for (let i = 1; i < hist.length; i++) {
    const s = hist[i].d?.[id] ?? 0;
    const v = Math.max(s, DOMAIN_ACTIVE * (hist[i].u?.[id] ?? 0));
    const x0 = x(t[i - 1]), x1 = x(t[i]);
    line += ` L${x0.toFixed(1)} ${y(v).toFixed(1)} L${x1.toFixed(1)} ${y(v).toFixed(1)}`;
    if (s >= DOMAIN_ACTIVE) rects += `<rect class="sp-auf f-l${Math.max(1, hist[i].level ?? 1)}" x="${x0.toFixed(1)}" y="${y(s).toFixed(1)}" width="${(x1 - x0 + 0.5).toFixed(1)}" height="${(SH - y(s)).toFixed(1)}"/>`;
  }
  return `<svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true" focusable="false" class="${lvlCls}">
    <line class="sp-grenze" x1="0" x2="${SW}" y1="${y(DOMAIN_ACTIVE).toFixed(1)}" y2="${y(DOMAIN_ACTIVE).toFixed(1)}"/>${rects}<path class="sp-linie" d="${line}"/></svg>`;
}

function neugierig(sc, ms) {
  const N = L.neugierig;
  const hist = (sc.history ?? []).filter((h) => Number.isFinite(Date.parse(h.t)));
  const spuren = hist.length > 1 ? `<div class="spuren"><p class="klein">${esc(N.spurenErkl)}</p>
      <ul>${sc.domains.map((d) => `<li class="spur${d.active ? ' aktiv' : ''}"><span class="spur-name">${esc(klar(d.title))}</span>${hatDaten(d) ? spurSvg(hist, d.id, '') : `<span class="spur-leer">${esc(N.ohneDaten)}</span>`}</li>`).join('')}</ul>
      <p class="spur-achse" aria-hidden="true"><span>${esc(tag(Date.parse(hist[0].t)))}</span><span>${esc(tag(Date.parse(hist[hist.length - 1].t)))}</span></p></div>`
    : `<p>${esc(N.keinVerlauf)}</p>`;
  const geplant = sc.domains.flatMap((d) => d.signals).filter((s) => s.status !== 'active').length;
  const alle = sc.domains.map((d) => {
    const g = ms.filter((m) => m.d.id === d.id);
    if (!g.length) return '';
    return `<h4>${esc(klar(d.title))}</h4><ul class="alle-liste">${g.map((m) => `<li class="z-${m.zustand}"><button type="button" class="ort z-${m.zustand}" data-sig="${esc(m.s.id)}"><i aria-hidden="true"></i><span class="ort-mess">${esc(klar(m.s.name))}</span> <span class="ort-zustand">${esc(m.s.fresh && m.s.value != null ? mitEinheit(m.s.value, m.s.unit) : L.globus.zustand.leer)}</span></button>${m.s.sourceUrl ? extern(m.s.sourceUrl, esc(L.karte.roh), 'roh') : ''}</li>`).join('')}</ul>`;
  }).join('');
  const kontext = (sc.context ?? []).length ? `<details><summary>${esc(N.kontext)}</summary><ul class="kontext">${sc.context.map((c) => `<li>${extern(c.url, esc(c.title))} <span class="klein">${esc(c.source)} · ${esc(kurz(c.ts))}</span></li>`).join('')}</ul></details>` : '';
  return `<section class="neugierig abschnitt" aria-labelledby="neu-titel">
      <h2 id="neu-titel" class="abschnitt-titel">${esc(N.titel)}</h2>
      <details><summary>${esc(N.spuren)}</summary>${spuren}</details>
      <details><summary>${esc(N.alle)}</summary><div class="alle">${alle}${geplant ? `<p class="klein">${esc(N.geplant(geplant))}</p>` : ''}</div></details>
      <details><summary>${esc(N.rechnen)}</summary><div class="text">${N.rechnenText.map((p) => `<p>${esc(p)}</p>`).join('')}
        <h4>${esc(N.beispieleTitel)}</h4><ul class="punkte">${N.beispiele.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p class="klein">${esc(N.empfindlich[zustand.snap.sensitivity] ?? '')}</p></div></details>
      ${kontext}
      <details><summary>${esc(N.vorsorgeTitel)}</summary><div class="text"><p>${esc(N.vorsorge)}</p><p>${extern('https://www.bbk.bund.de/', esc(N.vorsorgeLink))}</p></div></details>
      <details><summary>${esc(N.quellen)}</summary><div class="text">${quellenBlock()}</div></details>
    </section>`;
}

// ---------- Quellen (Registry: src/core/attribution.ts, im Snapshot als snap.attributions) ----------
function quellenEintrag(sig) {
  const liste = zustand.snap?.attributions ?? [];
  if (sig.collector) { const a = liste.find((x) => x.collectors?.includes(sig.collector)); if (a) return a; }
  return liste.find((x) => sig.sourceName && x.sourceNameHints?.some((h) => sig.sourceName.includes(h))) ?? null;
}
const quellenLink = (a) => (a.attributionUrl ? extern(a.attributionUrl, esc(a.attribution)) : esc(a.attribution));
function quellenBlock() {
  const liste = zustand.snap?.attributions;
  if (!Array.isArray(liste) || !liste.length) return `<p>${esc(L.neugierig.quellenOhne)}</p>`;
  const hinweise = [...new Set(liste.flatMap((a) => a.footerNotices ?? []))];
  return `<ul class="quellen">${liste.map((a) => `<li>${quellenLink(a)}</li>`).join('')}</ul>${hinweise.map((h) => `<p class="klein">${esc(h)}</p>`).join('')}`;
}

// ---------- Karte „Was wird hier gemessen?" ----------
function seltenheit(s) {
  const S = L.karte.selten;
  const r = s.rarity;
  if (!r || !(r.n >= 10) || !s.fresh) return S.unbekannt;
  if (r.share <= 0) return S.nie(r.n);
  if (r.share > 0.3) return S.gewoehnlich;
  const k = Math.max(2, Math.round(1 / r.share));
  return r.share <= 0.1 ? S.einVon(k) : S.oft(k);
}

function sparkSvg(s) {
  const v = s.spark;
  if (!v || v.length < 2) return '';
  const w = 320, h = 64;
  const reif = !!s.baseline?.mature;
  const alle = v.concat(reif ? [s.baseline.center] : []);
  let lo = Math.min(...alle), hi = Math.max(...alle);
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (i) => (i / (v.length - 1)) * (w - 8) + 2;
  const y = (q) => h - 5 - ((q - lo) / (hi - lo)) * (h - 10);
  const d = v.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(q).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${reif ? `<line class="spark-normal" x1="0" x2="${w}" y1="${y(s.baseline.center).toFixed(1)}" y2="${y(s.baseline.center).toFixed(1)}"/>` : ''}<path class="spark-linie" d="${d}"/><circle class="spark-punkt" cx="${x(v.length - 1).toFixed(1)}" cy="${y(v[v.length - 1]).toFixed(1)}" r="3.5"/></svg>`;
}

function oeffneKarte(id) {
  const eintrag = signalIndex.get(id);
  if (!eintrag) return;
  const { s, d, zustand: z } = eintrag;
  const K = L.karte;
  const sc = aktuell();
  const dlg = $('karte');
  const normal = s.baseline ? (s.baseline.mature ? mitEinheit(s.baseline.center, s.unit) : K.lernt(s.baseline.n)) : K.lernt(0);
  const a = quellenEintrag(s);
  $('karte-inhalt').innerHTML = `
    <p class="karte-frage">${esc(K.frage)}</p>
    <h2 id="karte-titel">${esc(klar(s.name))}</h2>
    <p class="karte-ort"><span>${esc(s.geo ? s.geo.label : L.globus.weltweit)}</span> · <span>${esc(K.bereich)}: ${esc(klar(d.title))}</span></p>
    <p class="karte-zustand z-${z} l-${Math.max(1, sc.level)}"><i aria-hidden="true"></i>${esc(K.zustand[z])}</p>
    <p class="karte-plain">${esc(klar(s.plain))}</p>
    ${z === 'leer' ? `<p class="karte-alt">${esc(K.alt(s.ts ? kurz(s.ts) : ''))}</p>` : `<dl class="karte-werte">
      <div><dt>${esc(K.jetzt)}</dt><dd>${esc(mitEinheit(s.value, s.unit))}</dd></div>
      <div><dt>${esc(K.normal)}</dt><dd>${esc(normal)}</dd></div></dl>
      <p class="karte-selten">${esc(seltenheit(s))}</p>`}
    ${s.spark?.length > 1 ? `<figure class="karte-verlauf">${sparkSvg(s)}<figcaption>${esc(K.verlauf(kurz(s.sparkStart), kurz(s.sparkEnd)))}</figcaption></figure>` : ''}
    ${s.damp ? `<p class="karte-daempf">${esc(K.daempf(s.damp.reason))}</p>` : ''}
    <p class="karte-art"><span>${esc(K.art)}:</span> ${esc(K.klasse[s.evidenceClass] ?? s.evidenceClass)}</p>
    ${s.sourceUrl ? `<p class="karte-roh">${extern(s.sourceUrl, `${esc(K.roh)}: ${esc(s.sourceName || s.sourceUrl)}`)}</p>` : ''}
    ${a && s.ts ? `<p class="karte-pflicht">${esc(K.pflicht)} ${quellenLink(a)}</p>` : ''}`;
  $('karte-zu').setAttribute('aria-label', K.schliessen);
  zustand.karteVon = document.activeElement;
  zustand.globus?.waehle(s.geo ? id : null);
  zustand.globus?.pause();
  if (!dlg.open) dlg.showModal();
  $('karte-zu').focus();
}

function karteZu() {
  const dlg = $('karte');
  if (dlg.open) dlg.close();
}

// ---------- Linse zeichnen ----------
async function renderLinse() {
  const sc = aktuell();
  const ms = messungen(sc);
  signalIndex.clear();
  for (const m of ms) signalIndex.set(m.s.id, m);
  zustand.globus?.zerstoere();
  zustand.globus = null;
  const main = $('inhalt');
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = `<section class="buehne">
      ${antwort(sc)}
      ${globusBlock(sc, ms)}
    </section>
    ${regel(sc)}
    ${gerede(sc)}
    ${geruechte()}
    ${neugierig(sc, ms)}`;
  main.querySelectorAll('[data-sig]').forEach((b) => {
    b.addEventListener('click', () => oeffneKarte(b.dataset.sig));
    if (b.classList.contains('ort')) b.addEventListener('focus', () => { const m = signalIndex.get(b.dataset.sig); if (m?.s.geo) zustand.globus?.zuOrt(m.s.geo.lon, m.s.geo.lat); });
  });
  main.querySelectorAll('[data-linse]').forEach((b) => b.addEventListener('click', () => { waehle(b.dataset.linse, true); $(`tab-${b.dataset.linse}`)?.focus(); scrollTo({ top: 0 }); }));
  renderFuss();
  if (zustand.atlasFehler) return;
  try {
    await ladeAtlas();
  } catch (e) {
    zustand.atlasFehler = true;
    console.warn('Kartendaten nicht geladen', e);
    return;
  }
  const canvas = $('globus');
  if (!canvas || aktuell() !== sc || zustand.globus) return;
  zustand.globus = erstelleGlobus(canvas, { onPick: oeffneKarte, start: startOrt(ms) });
  const { punkte, laender } = globusDaten(sc, ms);
  zustand.globus.setze(punkte, laender);
}

function renderFuss() {
  $('fuss').innerHTML = `<p>${esc(L.projekt)}</p>`;
}

// ---------- Fehler ----------
function renderFehler(e) {
  const F = L.fehler;
  const main = $('inhalt');
  main.setAttribute('aria-busy', 'false');
  $('linsen').hidden = true;
  const grund = e instanceof LadeFehler ? (e.art === 'http' ? F.http(e.status) : F[e.art] ?? F.format) : F.format;
  main.innerHTML = `<section class="fehler" role="alert"><h1>${esc(F.titel)}</h1><p>${esc(grund)} ${esc(F.text)}</p>
    <p class="fehler-aktionen"><button type="button" id="erneut" class="knopf">${esc(F.erneut)}</button> <a href="?demo=calm">${esc(F.zurDemo)}</a></p></section>`;
  $('erneut').addEventListener('click', () => location.reload());
  if (!(e instanceof LadeFehler)) console.warn(e);
}

// ---------- Sprache umschalten ----------
function setzeSprache(neu) {
  if (neu === sprache) return;
  sprache = neu;
  L = T[sprache];
  try { localStorage.setItem(SPRACHE_KEY, sprache); } catch { /* ignorieren */ }
  renderKopf();
  if (sprache === 'en') zustand.hinweisGezeigt = true;
  if (!zustand.snap) return;
  renderLinsen();
  renderLinse();
}

// ---------- Start ----------
async function start() {
  for (const b of document.querySelectorAll('[data-sprache]')) b.addEventListener('click', () => setzeSprache(b.dataset.sprache));
  const dlg = $('karte');
  $('karte-zu').addEventListener('click', karteZu);
  // Schließen per Hintergrund nur, wenn der Druck auch dort begann (sonst schließt ein nachgereichter Klick sofort)
  let druckAufHintergrund = false;
  dlg.addEventListener('pointerdown', (e) => { druckAufHintergrund = e.target === dlg; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && druckAufHintergrund) karteZu(); druckAufHintergrund = false; });
  dlg.addEventListener('close', () => {
    zustand.globus?.waehle(null);
    zustand.globus?.weiter();
    const z = zustand.karteVon;
    if (z && document.contains(z)) z.focus({ preventScroll: true });
  });
  renderKopf();
  try {
    const [snap, ger] = await Promise.all([laden(), ladeGeruechte()]);
    zustand.snap = snap;
    zustand.geruechte = ger;
    const wunsch = decodeURIComponent(location.hash.slice(1));
    zustand.id = snap.scenarios.some((s) => s.id === wunsch) ? wunsch : snap.scenarios[0].id;
    renderKopf();
    if (sprache === 'en') zustand.hinweisGezeigt = true;
    renderLinsen();
    await renderLinse();
    if (snap.mode === 'live') setInterval(renderKopf, 60000);
    window.addEventListener('hashchange', () => waehle(decodeURIComponent(location.hash.slice(1)), false));
  } catch (e) {
    renderFehler(e);
  }
}

start();
