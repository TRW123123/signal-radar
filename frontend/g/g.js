// Füllt auf den Gerüchte-Seiten (/g/<id>/) den Live-Satz aus dem Snapshot und richtet den Teilen-Knopf ein.
// Texte und Stufenlogik wie auf der Startseite (js/texte.js, app.js antwortTexte); Adresse und Rückfall wie in app.js.
import { T } from '../js/texte.js';

const SNAPSHOT_REMOTE = 'https://raw.githubusercontent.com/TRW123123/signal-radar/master/frontend/data/snapshot.json';
const sprache = document.body.dataset.sprache === 'en' ? 'en' : 'de';
const szenario = document.body.dataset.szenario;
const L = T[sprache];

const pruefe = (s) => !!s && s.schema === 1 && Array.isArray(s.scenarios) && s.scenarios.length > 0 && Number.isFinite(Date.parse(s.generatedAt));

async function holeJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('http');
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function laden() {
  const lokal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const quellen = lokal ? ['/data/snapshot.json'] : [SNAPSHOT_REMOTE, '/data/snapshot.json'];
  for (const url of quellen) {
    try { const s = await holeJson(url); if (pruefe(s)) return s; } catch { /* nächste Quelle */ }
  }
  return null;
}

function satz(sc) {
  const K = L.kopf;
  const mit = sc.coverage?.domainsWithData ?? (sc.domains ?? []).length;
  if (mit < 3) return `${K.offen} ${K.offenSatz}`;
  if (sc.level <= 1) return `${K.nein} ${K.neinSatz[sc.id] ?? K.neinSatz._}`;
  if (sc.level === 2) return `${K.unklar} ${K.unklarSatz}`;
  return `${K.ja} ${K.jaSatz}`;
}

async function live() {
  const el = document.getElementById('live-satz');
  const st = document.getElementById('live-stand');
  if (!el) return;
  const snap = await laden();
  const sc = snap?.scenarios.find((x) => x.id === szenario);
  if (!sc) { el.textContent = L.fehler.titel; if (st) st.textContent = L.fehler.text; return; }
  el.textContent = satz(sc);
  if (st) {
    const z = new Date(snap.generatedAt);
    const zeit = new Intl.DateTimeFormat(L.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(z);
    const alt = (Date.now() - z.getTime()) / 36e5;
    st.textContent = L.stand(zeit) + (alt > 3 ? ` · ${L.veraltet(Math.round(alt))}` : '');
  }
}

function teilen() {
  const b = document.getElementById('teilen');
  if (!b) return;
  b.hidden = false;
  const daten = { title: document.querySelector('h1')?.textContent ?? document.title, url: location.href.split('#')[0] };
  b.addEventListener('click', async () => {
    try {
      if (navigator.share) { await navigator.share(daten); return; }
      await navigator.clipboard.writeText(daten.url);
      const alt = b.textContent;
      b.textContent = sprache === 'en' ? 'Link copied' : 'Link kopiert';
      setTimeout(() => { b.textContent = alt; }, 2500);
    } catch { /* abgebrochen */ }
  });
}

teilen();
live();
