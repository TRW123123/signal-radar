// Signal Radar – Globus-Fassung. Statisch, kein Build, keine Anfragen an fremde Hosts außer dem Snapshot-Abruf.
// Datenvertrag: Snapshot aus src/core/types.ts. Oberflächen-Texte: js/texte.js. Englische Daten-Texte: data/i18n-en.json.
import { T, ORTE_EN } from './js/texte.js';
import { ladeAtlas, erstelleGlobus } from './js/globus.js';

const params = new URLSearchParams(location.search);

// ---------- Sprache: ?lang= vor gespeicherter Wahl vor Browsersprache ----------
const SPRACHE_KEY = 'sr-sprache';
function startSprache() {
  const q = params.get('lang');
  if (q === 'de' || q === 'en') return q;
  try { const s = localStorage.getItem(SPRACHE_KEY); if (s === 'de' || s === 'en') return s; } catch { /* kein Speicher */ }
  return String(navigator.language || 'de').toLowerCase().startsWith('en') ? 'en' : 'de';
}
let sprache = startSprache();
let L = T[sprache];
let EN = null; // englische Daten-Texte, nur bei Bedarf geladen

const SIGNAL_AUF = 0.25; // Messung gilt als ungewöhnlich ab diesem Anteil (nach Abschwächung)
const DOMAIN_ACTIVE = 0.25; // src/engine/score.ts
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
// Zählwerte (Länder, Meldungen, Adressen …) immer ganzzahlig; Mio./Mrd.-Angaben in die passende Größenordnung
const ZAEHL = /^(Routen|Länder|Regionen|Meldungen|Flughäfen|Anbieter|Knoten|\/24-Netze|Probes|IPs|IP-Adressen|Anzahl|Anträge|Patienten|Plätze|Bundesländer|Stationen.*|CVEs|Präfixe|Opfer|Gruppen|Alarme|Ereignisse)(\/.*| pro .*)?$|^(IOCs|Samples|URLs|Advisories|Releases|Commits|Pull Requests|Repos|Einträge|Dokumente|Störungen|schwere Störungen|Zertifikate|Hitzepunkte|Alarmwellen|Ortschaften|Nutzer|Projekte|Modelle)[\/ ]/;
const GROESSE = { 'Tsd.': 1e3, 'Mio.': 1e6, 'Mrd.': 1e9 };
function mitEinheit(v, unit, roh = unit) {
  const m = /^(Tsd\.|Mio\.|Mrd\.)\s+(.+)$/.exec(String(roh ?? ''));
  if (m && Number.isFinite(v)) {
    const x = v * GROESSE[m[1]];
    const st = (sprache === 'en' ? [[1e12, 'tn'], [1e9, 'bn'], [1e6, 'm']] : [[1e12, 'Bio.'], [1e9, 'Mrd.'], [1e6, 'Mio.']]).find(([f]) => Math.abs(x) >= f);
    return st ? `${nf(x / st[0])} ${st[1]} ${m[2]}` : `${nf(x)} ${m[2]}`;
  }
  const w = ZAEHL.test(String(roh ?? '')) && Number.isFinite(v) ? Math.round(v) : v;
  return `${nf(w)}${unit === 'x normal' ? (sprache === 'en' ? '× normal' : '-fach') : unit ? ' ' + unit : ''}`;
}
const zeit = (iso) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
const kurz = (iso) => (iso ? new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '–');
/** Datum eines Gerüchts: 17.11.2026 bzw. 17 Nov 2026 */
const tagJahr = (ms) => new Intl.DateTimeFormat(L.locale, sprache === 'en' ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
const tag = (ms) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'numeric' }).format(new Date(ms));
const datum = (iso) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
const prozent = (x) => new Intl.NumberFormat(L.locale, { style: 'percent', maximumFractionDigits: x < 0.1 ? 1 : 0 }).format(x);
const extern = (url, text, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}" rel="noopener noreferrer external">${text}<span class="nur-vorleser"> ${esc(L.karte.extern)}</span></a>`;
const ersterSatz = (t) => String(t ?? '').split(/(?<![0-9])[.!?]\s+(?=[A-ZÄÖÜ])/)[0].replace(/[.!?]?$/, '.');

// ---------- Laden ----------
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

/** Optionale Begleitdateien: fehlen sie, entfällt der Abschnitt ohne Lücke */
async function ladeOptional(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function ladeEn() {
  if (EN || sprache !== 'en') return;
  const j = await ladeOptional('data/i18n-en.json');
  EN = j && typeof j === 'object' ? j : {};
}

// ---------- Daten-Texte (DE aus dem Snapshot, EN aus i18n-en.json) ----------
// Fachwörter aus dem Katalog für die Anzeige ersetzen (Wörterbuch im Auftrag)
const klar = (t) => String(t ?? '').replace(/Telemetrie/g, 'Messdaten').replace(/Messreihen/g, 'Messungen').replace(/Messreihe/g, 'Messung')
  .replace(/schlagen (\w+ )?aus/g, 'weichen $1ab').replace(/ausschlägt/g, 'abweicht').replace(/Ausschlag/g, 'Abweichung');
const en = () => sprache === 'en' && EN;
const klarEn = (t) => (t ? String(t).replace(/[Tt]elemetry/g, (m) => (m[0] === 'T' ? 'Sensor data' : 'sensor data')) : t);
const sName = (s) => klarEn(en() && EN.signals?.[s.id]?.name) || klar(s.name);
const sPlain = (s) => klarEn(en() && EN.signals?.[s.id]?.plain) || klar(s.plain);
const sUnit = (s) => (en() && EN.signals?.[s.id]?.unit) || s.unit;
/** Alltagsbeschreibung als Überschrift: Klammern und Fachzusatz nach „;" weg */
// Fachkürzel in den Beschreibungen: [Muster, deutsch, englisch]
const KUERZEL = [
  [/\s*(mit|with an?) CVE[- ](Nummer|number)/g, '', ''],
  [/\bCVE[- ]?(Einträge|entries)/g, 'Einträge zu Sicherheitslücken', 'security flaw entries'],
  [/\bCVEs?\b/g, 'Sicherheitslücken', 'security flaws'],
  [/\b(das |the )?RIPE[- ]?(Messnetz|measurement network)/g, 'ein Messnetz', 'a measurement network'],
  [/\b(der )?RIPE[- ]?(Messgeräte|measurement devices)/g, 'Messgeräte', 'measurement devices'],
  [/\bIODA\b/g, 'ein Messdienst', 'a monitoring service'],
  [/\bBGP\b/g, 'Internet-Wegweiser', 'internet routing'],
  [/\bIOCs?\b/g, 'Schadsoftware-Hinweise', 'malware leads'],
  [/\bPräfixe\b/g, 'Netzblöcke', 'address blocks'],
];
const alltag = (s) => {
  let t = String(sPlain(s) || '').replace(/\s*\([^)]*\)/g, '').split(/;\s|(?<=[a-zäöü])\.\s/)[0].trim().replace(/[.:]?$/, '');
  for (const [re, de, enT] of KUERZEL) t = t.replace(re, sprache === 'en' ? enT : de);
  t = t
    .replace(/Cyber-Sicherheits-ETFs/g, 'Aktienfonds für IT-Sicherheit').replace(/\b[Cc]ybersecurity ETFs\b/g, 'IT security funds').replace(/\bETFs?\b/g, sprache === 'en' ? 'funds' : 'Fonds');
  return t || sName(s);
};
// Einheiten in Alltagssprache (Schlüssel: Einheit aus dem Katalog). null = Einheit weglassen, Vergleich mit „sonst".
const EINHEIT = {
  'IOCs/Stunde': ['neue Schadsoftware-Hinweise pro Stunde', 'new malware leads per hour'],
  'CVEs/Tag': ['Sicherheitslücken pro Tag', 'security flaws per day'],
  CVEs: ['Sicherheitslücken', 'security flaws'],
  'Advisories/Tag': ['Sicherheitswarnungen pro Tag', 'security warnings per day'],
  'Samples/Stunde': ['Schadsoftware-Proben pro Stunde', 'malware samples per hour'],
  'URLs/Stunde': ['Webadressen pro Stunde', 'web addresses per hour'],
  IPs: ['Internet-Adressen', 'internet addresses'],
  'IP-Adressen': ['Internet-Adressen', 'internet addresses'],
  'IPs/7 Tage': ['Internet-Adressen in 7 Tagen', 'internet addresses in 7 days'],
  Probes: ['Messgeräte', 'measuring devices'],
  '/24-Netze': ['Netzblöcke', 'network blocks'],
  Präfixe: ['Netzblöcke', 'network blocks'],
  'Releases/Tag': ['Updates pro Tag', 'updates per day'],
  'Releases/Stunde': ['Updates pro Stunde', 'updates per hour'],
  'Releases/Tag (Maximum eines Pakets)': ['Updates pro Tag', 'updates per day'],
  'Pull Requests/Tag': ['Code-Änderungen pro Tag', 'code changes per day'],
  'Commits/Tag': ['Code-Änderungen pro Tag', 'code changes per day'],
  'Repos/Woche': ['Projekte pro Woche', 'projects per week'],
  'Einträge/7 Tage': ['Einträge in 7 Tagen', 'entries in 7 days'],
  'x Median 10 Tage': ['x normal', 'x normal'],
  'x Vorjahresmittel': ['x normal', 'x normal'],
};
const OHNE_EINHEIT = new Set(['Index 0-1', 'Anteil (0 bis 1)', 'MvB', 'sat/vB', 'Verhältnis VIX/VIX3M', 'Kp', 'Viruslast (normalisiert)', 'Index', 'Punkte', 'Indexpunkte', 'Basispunkte', 'Prozentpunkte', '% (Betrag)', '% (Tagesrendite, Betrag)', 'USD je MMBtu', 'USD/MMBtu', 'mHz', 'µSv/h']);
/** Wert einer Messung für Laien: Zahl mit Alltags-Einheit oder Vergleich mit dem Normalwert */
function wertText(s) {
  if (!s.fresh || s.value == null) return L.globus.zustand.leer;
  if (ZEIGBAR.has(s.unit)) return mitEinheit(s.value, sUnit(s), s.unit);
  if (OHNE_EINHEIT.has(s.unit)) {
    if (staerke(s) < SIGNAL_AUF) return L.vergleich.wie;
    const c = s.baseline?.center;
    return Number.isFinite(c) && s.value < c ? L.vergleich.tiefer : L.vergleich.hoeher;
  }
  const e = EINHEIT[s.unit];
  return mitEinheit(s.value, e ? e[sprache === 'en' ? 1 : 0] : sUnit(s), s.unit);
}
// Einheiten ohne Alltagswort, deren Zahl trotzdem lesbar ist (Börsenpunkte, Preise, Frequenz …)
const ZEIGBAR = new Set(['Punkte', 'Indexpunkte', 'Basispunkte', 'Prozentpunkte', 'USD je MMBtu', 'USD/MMBtu', 'mHz', 'µSv/h', 'Index']);
/** Zahl für die Messungs-Karte: immer eine Zahl, Einheit nur, wenn sie für Laien etwas sagt */
function zahlText(s, v) {
  if (!Number.isFinite(v)) return '–';
  if (OHNE_EINHEIT.has(s.unit)) return ZEIGBAR.has(s.unit) ? mitEinheit(v, sUnit(s), s.unit) : nf(v);
  const e = EINHEIT[s.unit];
  return mitEinheit(v, e ? e[sprache === 'en' ? 1 : 0] : sUnit(s), s.unit);
}
/** Quelle mit ungeklärter Lizenz: kein öffentlicher Rohdaten-Link, kein interner Vermerk */
const lizenzOffen = (s) => /unklar|klären|inoffiziell/i.test(`${s.license ?? ''} ${s.sourceName ?? ''}`);
const quellName = (s) => String(s.sourceName || s.sourceUrl || '').replace(/\s*\([^)]*\)/g, '').trim();
const dTitel = (sc, d) => klarEn(en() && EN.scenarios?.[sc.id]?.domains?.[d.id]?.title) || klar(d.title);
const scFrage = (sc) => (en() && EN.scenarios?.[sc.id]?.question) || sc.question;

// ---------- Ableitungen ----------
const gebaut = (sigs) => sigs.filter((s) => s.status === 'active');
const hatDaten = (d) => d.signals.some((s) => s.status === 'active' && s.fresh);
const zuWenig = (sc) => (sc.coverage?.domainsWithData ?? 0) < 3;
const linsenName = (sc) => L.linsenName[sc.id] ?? sc.title;
const stufenName = (sc) => (zuWenig(sc) ? L.zuWenig : L.stufen[sc.level] ?? L.stufen[0]);
const staerke = (s) => s.anomaly * (s.damp?.factor ?? 1);
const ortName = (g) => (sprache === 'en' && ORTE_EN[g?.label]) || g?.label || '';
const hatOrt = (s) => Number.isFinite(s.geo?.lat) && Number.isFinite(s.geo?.lon);

/** Die eine Zählung der Messungen: überall dieselbe (Kopf, Globus-Legende, Liste, Fuß) */
function zaehlung(sc) {
  const ms = messungen(sc);
  const mitOrt = ms.filter((m) => hatOrt(m.s)).length;
  return { alle: ms.length, mitOrt, weltweit: ms.length - mitOrt, frisch: ms.filter((m) => m.s.fresh && m.s.value != null).length };
}
// Gerüchte-Texte je Sprache
const rT = (r, k) => (sprache === 'en' && r[`${k}_en`] !== undefined ? r[`${k}_en`] : r[k]);

/** Zustand einer Messung. „ungewöhnlich" nur, wenn ihr Bereich zählt; sonst „etwas erhöht" (zählt allein nicht). */
function zustandVon(sc, s, d) {
  if (!s.fresh || s.value == null) return 'leer';
  if (staerke(s) < SIGNAL_AUF) return 'ruhig';
  return d.active && !zuWenig(sc) ? 'auf' : 'erhoeht';
}

/** Die einzige Zählung ungewöhnlicher Bereiche: Satz, Liste, Lämpchen und Globus nutzen genau diese. */
function ungewoehnlicheBereiche(sc) {
  if (zuWenig(sc)) return [];
  return sc.domains.filter((d) => d.active).map((d) => ({ d, signale: gebaut(d.signals).filter((s) => zustandVon(sc, s, d) === 'auf') }));
}

function stufenFarbe(k) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--l${Math.max(1, Math.min(4, k))}`).trim();
}

/** Alle gebauten Messungen der Linse mit Bereich und Zustand */
function messungen(sc) {
  const out = [];
  for (const d of sc.domains) for (const s of gebaut(d.signals)) out.push({ s, d, zustand: zustandVon(sc, s, d) });
  return out;
}

function seltenheit(s) {
  const S = L.karte.selten;
  const r = s.rarity;
  if (!r || !(r.n >= 10) || !s.fresh || !Number.isFinite(r.share)) return '';
  if (r.share <= 0 && staerke(s) < SIGNAL_AUF) {
    const c = s.baseline?.center;
    return S.nieNormal(r.n, !(Number.isFinite(c) && s.value < c));
  }
  if (r.share <= 0) return S.nie(r.n);
  return S.anteil(r.n, prozent(r.share));
}

// ---------- Zustand ----------
const zustand = { schichtWahl: new Map(), snap: null, id: null, geruechte: [], erklaerung: null, replays: [], globus: null, zm: null, atlasFehler: false, karteVon: null, kurz: '' };
const aktuell = () => zustand.snap.scenarios.find((x) => x.id === zustand.id) ?? zustand.snap.scenarios[0];
const signalIndex = new Map();
let signalAlle = null;
/** Alle Messungen aller Szenarien nach id (für Namen in der Wiedergabe) */
function alleSignale() {
  if (!signalAlle) { signalAlle = new Map(); for (const sc of zustand.snap?.scenarios ?? []) for (const d of sc.domains) for (const s of d.signals) signalAlle.set(s.id, s); }
  return signalAlle;
}

// ---------- Kopf ----------
function standText() {
  const snap = zustand.snap;
  const min = Math.max(0, (Date.now() - Date.parse(snap.generatedAt)) / 60000);
  return min < 60 ? L.vorMin(Math.floor(min)) : L.vor(Math.floor(min / 60));
}
function renderKopf() {
  const snap = zustand.snap;
  document.documentElement.lang = sprache;
  if (!snap) document.title = L.titel;
  $('satz').innerHTML = `<span class="satz-lang">${esc(L.satz)}</span><span class="satz-kurz">${esc(L.satzKurz ?? L.satz)}</span>`;
  $('sprung').textContent = L.sprung;
  for (const b of document.querySelectorAll('[data-sprache]')) b.setAttribute('aria-pressed', String(b.dataset.sprache === sprache));
  $('sprachwahl').setAttribute('aria-label', L.sprache);
  if (!snap) return;
  const live = snap.mode === 'live';
  const alterH = Math.max(0, (Date.now() - Date.parse(snap.generatedAt)) / 3600000);
  const veraltet = alterH > STALE_H;
  // Nie „Live" und „veraltet" gleichzeitig: alte Daten bekommen nur die sachliche Zeitangabe.
  if (!zustand.zm) $('stand').innerHTML = `${live && !veraltet ? `<span class="live-marke">${esc(L.live)}</span>` : ''}<time datetime="${esc(snap.generatedAt)}" title="${esc(zeit(snap.generatedAt))}">${esc(L.stand(standText()))}</time>`;
  $('stand').classList.toggle('stand-alt', live && veraltet);
  $('herkunft').innerHTML = herkunftHtml();
  $('herkunft').hidden = false;
  $('hinweise').innerHTML = ersatzkopie ? `<p class="hinweis" role="status">${esc(L.ersatz)}</p>` : '';
  const b = $('betrieb');
  const m = L.betrieb[snap.mode];
  b.hidden = !m;
  if (m) b.innerHTML = `<p><strong>${esc(m[0])}</strong> ${esc(m[1])}${snap.note && sprache === 'de' && snap.mode !== 'demo' && !/^demo/i.test(snap.note) ? ` <span class="betrieb-notiz">${esc(snap.note)}</span>` : ''}</p>`;
}

// ---------- Linsen ----------
function renderLinsen() {
  const nav = $('linsen');
  // Themen mit zu wenig Messungen nach hinten
  const scs = [...zustand.snap.scenarios].sort((a, b) => zuWenig(a) - zuWenig(b));
  nav.hidden = false;
  nav.innerHTML = `<p class="linsen-frage" id="linsen-frage">${esc(L.linsen)}</p>
    <div class="linsen-reihe" role="tablist" aria-labelledby="linsen-frage">${scs.map((sc) => {
      const an = sc.id === aktuell().id;
      const lv = zuWenig(sc) ? 'x' : sc.level;
      return `<button type="button" role="tab" class="linse z-l${lv}" id="tab-${esc(sc.id)}" data-id="${esc(sc.id)}" aria-selected="${an}" aria-controls="antwort" tabindex="${an ? 0 : -1}">
        <span class="linse-name">${esc(linsenName(sc))}</span>
        <span class="linse-zustand"><i class="lampe-klein" aria-hidden="true"></i>${esc(stufenName(sc))}</span>
      </button>`;
    }).join('')}</div>
    <button type="button" class="linsen-mehr" id="linsen-mehr" tabindex="-1" aria-hidden="true">${esc(L.globus.mehrThemen)}&nbsp;→</button>`;
  // Handy: Hinweis, dass rechts weitere Themen liegen; verschwindet am Ende der Reihe
  const reihe = nav.querySelector('.linsen-reihe');
  const mehr = $('linsen-mehr');
  const pruefeMehr = () => {
    const rest = reihe.scrollWidth - reihe.clientWidth - reihe.scrollLeft;
    const zeigen = reihe.scrollWidth > reihe.clientWidth + 4 && rest > 8;
    mehr.hidden = !zeigen;
    reihe.classList.toggle('hat-mehr', zeigen);
  };
  reihe.addEventListener('scroll', pruefeMehr, { passive: true });
  addEventListener('resize', pruefeMehr, { passive: true });
  mehr.addEventListener('click', () => reihe.scrollBy({ left: reihe.clientWidth * 0.7, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  requestAnimationFrame(pruefeMehr);
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
  if (nutzer) $('ansage').textContent = zustand.kurz;
}

// ---------- Antwort (Ja/Nein in einem Satz) ----------
function antwortTexte(sc) {
  const K = L.kopf;
  const ub = ungewoehnlicheBereiche(sc);
  const namen = ub.map((b) => dTitel(sc, b.d)).join(', ');
  const mit = sc.coverage?.domainsWithData ?? sc.domains.filter(hatDaten).length;
  const alle = sc.coverage?.domainsTotal ?? sc.domains.length;
  if (zuWenig(sc)) return { art: 'offen', wort: K.offen, satz: K.offenSatz, zusatz: K.zuWenig(mit, alle), k: 0, mit };
  const k = ub.length;
  if (sc.level <= 1 || k === 0) {
    return { art: 'nein', wort: K.nein, satz: K.neinSatz[sc.id] ?? K.neinSatz._, zusatz: k === 1 ? K.eins(namen) : k > 1 ? K.mehr(k, namen) : '', k, mit };
  }
  if (sc.level === 2) return { art: 'unklar', wort: K.unklar, satz: K.unklarSatz, zusatz: K.mehr(k, namen), k, mit };
  return { art: 'ja', wort: K.ja, satz: K.jaSatz, zusatz: K.jaZusatz(k, namen), k, mit };
}

function aktuellesGeruecht(sc) {
  const eigene = zustand.geruechte.filter((r) => r.scenario === sc.id);
  return [...eigene].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null;
}
const geruechtLevel = (r) => zustand.snap.scenarios.find((x) => x.id === r.scenario)?.level ?? 0;

function antwort(sc) {
  const a = antwortTexte(sc);
  zustand.kurz = `${a.wort} ${a.satz}`;
  const lv = zuWenig(sc) ? 'x' : sc.level;
  const r = istDemo() ? null : aktuellesGeruecht(sc);
  const aufl = r ? ersterSatz(rT(r, 'factcheck') || rT(r, 'outcome') || '') : '';
  const zeile = r ? `<a class="gehoert lv-${geruechtLevel(r)}" href="#geruecht-${esc(r.id)}" data-zu-geruecht="${esc(r.id)}">
      <span class="gehoert-wort">${esc(L.gehoert.wort)}${r.date && Number.isFinite(Date.parse(r.date)) ? ` · ${esc(tagJahr(Date.parse(r.date)))}` : ''}</span>
      <span class="gehoert-text"><strong>${esc(rT(r, 'title'))}?</strong> ${esc(aufl)}</span>
      <span class="gehoert-daten">${esc(L.gehoert.daten(geruechtLevel(r)))} <span aria-hidden="true">→</span><span class="nur-vorleser"> ${esc(L.gehoert.mehr)}</span></span>
    </a>` : '';
  return `<div class="antwort a-l${lv} art-${a.art}" id="antwort" role="tabpanel" aria-labelledby="tab-${esc(sc.id)}">
      <p class="antwort-frage">${esc(scFrage(sc))}</p>
      <h1 class="antwort-kopf"><span class="antwort-wort">${esc(a.wort)}</span> ${esc(a.satz)}</h1>
      ${a.zusatz ? `<p class="antwort-satz">${esc(a.zusatz)}</p>` : ''}
      <p class="antwort-stufe"><i class="lampe-klein" aria-hidden="true"></i>${esc(zuWenig(sc) ? L.zuWenig : L.kopf.stufe(stufenName(sc), a.k, a.mit))}
        <button type="button" class="teilen" id="teilen"${istDemo() ? ` disabled title="${esc(L.kopf.demoGesperrt)}"` : ''}><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(L.kopf.teilen)}</button></p>
      ${zeile}
    </div>`;
}

const istDemo = () => demo != null || zustand.snap?.mode === 'demo';

/** Teilen-Inhalt: Frage (oder Gerücht) + Antwort + Stand; Adresse ist die Gerüchte-Seite, wenn eines zum Thema gehört */
function teilInhalt() {
  const snap = zustand.snap;
  const sc = aktuell();
  const r = aktuellesGeruecht(sc);
  const frage = r ? `${String(rT(r, 'title')).replace(/[?.!]+$/, '')}?` : scFrage(sc);
  const text = L.kopf.teilText(frage, zustand.kurz, kurz(snap.generatedAt));
  const basis = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  const url = r && /^[a-z0-9-]+$/.test(r.id) ? `${basis}g/${r.id}/` : `${location.origin}${location.pathname}${sprache === 'en' ? '?lang=en' : ''}#${encodeURIComponent(sc.id)}`;
  return { text, url };
}

async function teilen() {
  if (istDemo()) { $('ansage').textContent = L.kopf.demoGesperrt; return; }
  const { text, url } = teilInhalt();
  if (navigator.share) {
    try { await navigator.share({ title: document.title, text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    const b = $('teilen');
    if (b) { b.classList.add('ok'); b.lastChild.textContent = L.kopf.kopiert; setTimeout(() => { b.classList.remove('ok'); b.lastChild.textContent = L.kopf.teilen; }, 2500); }
    $('ansage').textContent = L.kopf.kopiert;
  } catch {
    window.prompt(L.kopf.teilen, `${text} ${url}`);
  }
}

// ---------- Globus und Liste ----------
/** „Letzte Messung vor 2 Minuten: …" aus dem jüngsten Zeitstempel der Linse */
function pulsText(sc) {
  const ms = messungen(sc).filter((m) => m.s.fresh && Number.isFinite(Date.parse(m.s.ts ?? '')));
  if (!ms.length) return '';
  const m = ms.reduce((a, b) => (Date.parse(b.s.ts) > Date.parse(a.s.ts) ? b : a));
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(m.s.ts)) / 60000));
  const wann = min < 60 ? L.vorMin(min) : L.vor(Math.floor(min / 60));
  return `<i aria-hidden="true"></i>${esc(L.globus.puls(wann, `${alltag(m.s)}${m.s.geo ? ` (${ortName(m.s.geo)})` : ''}`, L.globus.zustand[m.zustand]))}`;
}

function globusBlock(sc, ms, schichten) {
  const G = L.globus;
  const z = zaehlung(sc);
  const auf = ms.filter((m) => m.zustand === 'auf').length;
  return `<figure class="globus-feld">
      <p class="globus-erkl">${esc(G.erkl)}${schichten.some((x) => x.an) ? ` ${esc(G.erklSchicht)}` : ''}</p>
      <div class="globus-rahmen">
        <canvas id="globus" class="globus" role="img" aria-label="${esc(G.label(z.mitOrt, auf))}"></canvas>
        <p class="puls-zeile" id="puls-zeile">${pulsText(sc)}</p>
      </div>
      ${vergleichKnopf(sc)}
      ${zeitleiste(sc)}
      <figcaption class="globus-legende">
        <span class="leg leg-ruhig"><i aria-hidden="true"></i>${esc(G.legende4[0])}</span>
        <span class="leg leg-auf l-${Math.max(1, sc.level)}"><i aria-hidden="true"></i>${esc(G.legende4[1])}</span>
        <span class="leg leg-etwas"><i aria-hidden="true"></i>${esc(G.legende4[2])}</span>
        <span class="leg-zahl">${esc(G.alltag)}</span>
      </figcaption>
      ${schichten.length ? `<div class="schichten" role="group" aria-label="${esc(G.schicht)}">${schichten.map((x) => `<button type="button" class="schalter" data-schicht="${esc(x.l.id)}" aria-pressed="${x.an}" title="${esc(schichtTitel(x.l))}"><i class="form ${x.form}" aria-hidden="true"></i>${esc(schichtKurz(x.l))} <span class="an-aus" aria-hidden="true">${x.an ? esc(G.an) : esc(G.aus)}</span></button>`).join('')}<span class="schichten-hinweis">${esc(G.schichtHinweis)}</span></div>` : ''}
    </figure>`;
}

function ortKnopf(sc, m, mitSelten) {
  const wert = wertText(m.s);
  return `<button type="button" class="ort z-${m.zustand}" data-sig="${esc(m.s.id)}"><i aria-hidden="true"></i><span class="ort-mess">${m.s.geo ? `<span class="ort-name">${esc(ortName(m.s.geo))}</span> · ` : ''}${esc(alltag(m.s))}</span> <span class="ort-zustand">${esc(wert)} · ${esc(L.globus.zustand[m.zustand])}</span>${mitSelten && seltenheit(m.s) ? `<span class="ort-selten">${esc(seltenheit(m.s))}</span>` : ''}</button>`;
}

function listeBlock(sc, ms) {
  const Li = L.liste;
  const ub = ungewoehnlicheBereiche(sc);
  const etwas = ms.filter((m) => m.zustand === 'erhoeht').sort((a, b) => staerke(b.s) - staerke(a.s));
  const bereiche = ub.length
    ? `<ul class="bereiche">${ub.map((b) => `<li class="bereich"><p class="bereich-name"><i aria-hidden="true"></i>${esc(dTitel(sc, b.d))}</p>
        <ul>${b.signale.map((s) => `<li>${ortKnopf(sc, { s, d: b.d, zustand: 'auf' }, true)}</li>`).join('')}</ul></li>`).join('')}</ul>`
    : `<p class="liste-keine">${esc(Li.keine)}</p>`;
  const alle = sc.domains.map((d) => {
    const g = ms.filter((m) => m.d.id === d.id);
    return g.length ? `<li><p class="alle-bereich">${esc(dTitel(sc, d))}</p><ul>${g.map((m) => `<li>${ortKnopf(sc, m, false)}</li>`).join('')}</ul></li>` : '';
  }).join('');
  return `<div class="globus-neben">
      <section class="abweichung" aria-labelledby="ab-titel">
        <h2 id="ab-titel" class="klein-titel">${esc(Li.titel)} <span class="zahl">${ub.length}</span></h2>
        ${bereiche}
        ${etwas.length ? `<p class="liste-etwas">${esc(Li.etwas)}</p><ul class="etwas-liste">${etwas.map((m) => `<li>${ortKnopf(sc, m, false)}</li>`).join('')}</ul>` : ''}
      </section>
      <details class="ortsliste"><summary>${esc(Li.alle(ms.length))}</summary><ul class="alle-orte">${alle}</ul></details>
      <p class="antwort-klein">${esc(L.zaehl.frisch(zaehlung(sc)))} ${esc(L.antwort.keineVorhersage)}</p>
    </div>`;
}

/** Alle Kartenschichten mit Punkten; `an` je Szenario: Standard an, wenn die Schicht zum Szenario gehört, sonst per Schalter */
function sichtbareSchichten(sc) {
  const ls = Array.isArray(zustand.snap.layers) ? zustand.snap.layers : [];
  return ls.filter((l) => l && typeof l.id === 'string' && Array.isArray(l.points) && l.points.length).map((l, i) => {
    const passt = !Array.isArray(l.scenarios) || !l.scenarios.length || l.scenarios.includes(sc.id);
    const wahl = zustand.schichtWahl.get(`${sc.id}:${l.id}`);
    return { l, form: i % 2 ? 'dreieck' : 'raute', an: wahl ?? passt };
  });
}
const schichtTitel = (l) => (sprache === 'en' && l.title_en) || l.title;
const schichtKurz = (l) => L.globus.schichtKurz?.[l.id] ?? schichtTitel(l);

/** Wert eines Orientierungspunkts in Worten: Zahl nur mit Einheit (Erdbeben: „Stärke 6,1"), sonst leicht/deutlich/stark */
function schichtWert(p, st) {
  const v = Number(p.value);
  if (p.unit && p.value != null && Number.isFinite(v)) {
    const zahl = new Intl.NumberFormat(L.locale, { maximumFractionDigits: 1 }).format(v);
    return p.unit === 'M' ? L.globus.magnitude(zahl) : `${zahl} ${p.unit}`;
  }
  if (st == null) return '';
  return L.globus.staerkeWort[st < 0.4 ? 0 : st < 0.75 ? 1 : 2];
}

function punktInfo(m) {
  const wert = m.s.fresh && m.s.value != null ? wertText(m.s) : '';
  return [wert, L.globus.zustand[m.zustand]].filter(Boolean).join(' · ');
}

function globusDaten(sc, ms, schichten) {
  const farbe = stufenFarbe(Math.max(1, sc.level));
  const punkte = [];
  const ring = [];
  const laender = new Map();
  for (const m of ms) {
    const g = m.s.geo;
    const basis = { id: m.s.id, zustand: m.zustand, farbe, staerke: staerke(m.s), info: punktInfo(m) };
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) { ring.push({ ...basis, titel: alltag(m.s) }); continue; }
    // gleiche oder nahe Orte bündelt der Globus selbst zu einem Punkt mit Zahl
    punkte.push({ ...basis, lon: g.lon, lat: g.lat, titel: `${ortName(g)} · ${alltag(m.s)}`, marke: ortName(g) });
    if (g.kind === 'country' && g.cc && ISO_NUM[g.cc.toUpperCase()]) {
      const id = ISO_NUM[g.cc.toUpperCase()];
      const z = laender.get(id) ?? { auf: false, farbe };
      if (m.zustand === 'auf') z.auf = true;
      laender.set(id, z);
    }
  }
  const schicht = [];
  for (const { l, form, an } of schichten) {
    if (!an) continue;
    const lt = schichtKurz(l);
    for (const p of l.points) {
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) continue;
      const st = Number.isFinite(p.strength) ? Math.max(0, Math.min(1, p.strength)) : null;
      schicht.push({ form, lon: p.lon, lat: p.lat, staerke: st ?? 0.3, titel: p.label || lt, info: [lt, schichtWert(p, st)].filter(Boolean).join(': ') });
    }
  }
  return { punkte, ring, schicht, laender };
}

/** Startansicht: dorthin, wo die ungewöhnlichen, sonst die etwas erhöhten, sonst die meisten Messorte liegen */
function startOrt(ms) {
  const mitGeo = ms.filter((m) => Number.isFinite(m.s.geo?.lat) && Number.isFinite(m.s.geo?.lon));
  const vek = (m) => { const la = (m.s.geo.lat * Math.PI) / 180, lo = (m.s.geo.lon * Math.PI) / 180; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
  let auf = mitGeo.filter((m) => m.zustand === 'auf');
  if (!auf.length && mitGeo.length) {
    // Ruhezustand: die Seite der Kugel, auf der die meisten Messorte liegen (innerhalb von 70° um einen Messort)
    const v = mitGeo.map(vek);
    const grenze = Math.cos((70 * Math.PI) / 180);
    let best = [];
    for (const a of v) { const nah = mitGeo.filter((_, j) => a[0] * v[j][0] + a[1] * v[j][1] + a[2] * v[j][2] >= grenze); if (nah.length > best.length) best = nah; }
    auf = best;
  }
  if (!auf.length) return [10, 28];
  let x = 0, y = 0, z = 0;
  for (const m of auf) {
    const la = (m.s.geo.lat * Math.PI) / 180, lo = (m.s.geo.lon * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la);
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, Math.max(-40, Math.min(45, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI))];
}

// ---------- Regel + „Warum ungewöhnlich?" ----------
function warum() {
  const e = zustand.erklaerung;
  if (!e) return '';
  const W = L.warum;
  const feld = sprache === 'en' ? 'text_en' : 'text_de';
  const t = (r) => (r && typeof r[feld] === 'string' ? klar(r[feld]).replace(/[„“"]?(Leicht erhöht|slightly raised)[“”"]?/gi, sprache === 'en' ? `“${L.stufen[1]}”` : `„${L.stufen[1]}“`) : '');
  const teile = [[W.messung, t(e.signalRule)], [W.bereich, t(e.domainRule)], [W.stufe, t(e.convergenceRule)]].filter((x) => x[1]);
  if (!teile.length) return '';
  const b = e.basis;
  return `<details class="warum"><summary>${esc(W.titel)}</summary><div class="text">
      ${teile.map(([k, v]) => `<p><strong>${esc(k)}:</strong> ${esc(v)}</p>`).join('')}
      ${b && Number.isFinite(b.days) && Number.isFinite(b.signals) ? `<p class="klein">${esc(W.basis(b.days, b.signals))}</p>` : ''}
    </div></details>`;
}

function regel(sc) {
  const R = L.regel;
  const k = ungewoehnlicheBereiche(sc).length;
  const lampen = sc.domains.map((d) => {
    const z = !hatDaten(d) ? 'leer' : d.active && !zuWenig(sc) ? 'auf' : 'ruhig';
    return `<li class="lampe z-${z}"><i aria-hidden="true"></i><span>${esc(dTitel(sc, d))}</span><span class="nur-vorleser"> ${esc(L.globus.zustand[z])}</span></li>`;
  }).join('');
  const leiter = [1, 2, 3, 4].map((n) => {
    const an = Math.min(k, 4) === n;
    return `<li class="sprosse${an ? ' an' : ''}${k >= n ? ' erreicht' : ''} s-${n}"${an ? ' aria-current="true"' : ''}><span class="sprosse-zahl">${esc(R.stufe(n))}</span><span class="sprosse-stufe">${esc(R.hoechstens(L.stufen[n]))}</span></li>`;
  }).join('');
  return `<section class="regel abschnitt l-${Math.max(1, sc.level)}" aria-labelledby="regel-titel">
      <h2 id="regel-titel" class="abschnitt-titel">${esc(R.titel)}</h2>
      <p class="regel-satz">${esc(R.satz)}</p>
      <ul class="lampen" aria-label="${esc(R.lampen)}">${lampen}</ul>
      <ol class="leiter" aria-label="${esc(R.leiter)}">${leiter}</ol>
      ${warum()}
    </section>`;
}

// ---------- Gerede gegen Messung ----------
function gerede(sc) {
  const G = L.gerede;
  const att = (sc.attentionSignals ?? []).some((s) => s.status === 'active' && s.fresh);
  const netz = att ? G.netzWort(sc.attention ?? 0) : G.netzKeine;
  const k = ungewoehnlicheBereiche(sc).length;
  const daten = zuWenig(sc) ? G.datenWenig : k === 0 ? G.daten0 : `${L.stufen[sc.level]}.`;
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
  if (!liste.length || istDemo()) return '';
  const G = L.geruechte;
  const sc = aktuell();
  const oben = aktuellesGeruecht(sc);
  const neu = (a, b) => String(b.date).localeCompare(String(a.date));
  const eigene = liste.filter((r) => r.scenario === sc.id).sort(neu);
  const andere = liste.filter((r) => r.scenario !== sc.id).sort(neu);
  const karte = (r) => {
    const ziel = zustand.snap.scenarios.find((x) => x.id === r.scenario);
    const lv = geruechtLevel(r);
    const fc = rT(r, 'factcheck');
    // Das Gerücht aus dem Kasten oben steht dort schon mit Kurzfassung: hier nur Titel und „Mehr dazu"
    const kurzText = r === oben ? '' : fc ? ersterSatz(fc) : '';
    const mehr = [fc ? `<p><strong>${esc(G.faktencheck)}:</strong> ${esc(fc)}</p>` : '', rT(r, 'outcome') ? `<p><strong>${esc(G.danach)}:</strong> ${esc(rT(r, 'outcome'))}</p>` : '', rT(r, 'claim') ? `<p><strong>${esc(G.behauptung)}:</strong> ${esc(rT(r, 'claim'))}</p>` : '',
      Array.isArray(r.sources) && r.sources.length ? `<p><strong>${esc(G.quellen)}:</strong></p><ul>${r.sources.filter((q) => q?.url).map((q) => `<li>${extern(q.url, esc(q.title || q.url))}</li>`).join('')}</ul>` : ''].join('');
    return `<li class="ger ${lv <= 1 ? 'ger-kein' : 'ger-teil'}" id="geruecht-${esc(r.id)}" tabindex="-1">
          <p class="ger-kopf"><span class="ger-status">${esc(ziel ? linsenName(ziel) : '')}</span>${r.date && Number.isFinite(Date.parse(r.date)) ? `<time datetime="${esc(r.date)}">${esc(tagJahr(Date.parse(r.date)))}</time>` : ''}</p>
          <h3>${esc(rT(r, 'title'))}</h3>
          ${kurzText ? `<p class="ger-claim">${esc(kurzText)}</p>` : ''}
          <p class="ger-daten">${esc(L.gehoert.daten(lv))}</p>
          ${mehr ? `<details class="ger-quellen"${r === oben ? ' data-oben' : ''}><summary>${esc(G.mehr)}</summary>${mehr}</details>` : ''}
          ${ziel && ziel.id !== sc.id ? `<p><button type="button" class="text-knopf" data-linse="${esc(ziel.id)}">${esc(G.zurLinse(linsenName(ziel)))}</button></p>` : ''}
        </li>`;
  };
  return `<section class="geruechte abschnitt" aria-labelledby="ger-titel">
      <h2 id="ger-titel" class="abschnitt-titel">${esc(G.titel)}</h2>
      ${eigene.length ? `<ul class="ger-liste">${eigene.map(karte).join('')}</ul>` : `<p class="abschnitt-erkl">${esc(G.keineEigenen(linsenName(sc)))}</p>`}
      ${andere.length ? `<details class="zm-mehr"><summary>${esc(G.weitere(andere.length))}</summary><ul class="ger-liste">${andere.map(karte).join('')}</ul></details>` : ''}
      <p class="ger-alle"><a href="${sprache === 'en' ? 'g/en/' : 'g/'}">${esc(G.alleSeite)}</a></p>
    </section>`;
}

// ---------- Zeitmaschine ----------
const SAW = { ja: 'ja', yes: 'ja', teilweise: 'teilweise', partly: 'teilweise', nein: 'nein', no: 'nein' };
const gueltigeReplays = () => zustand.replays.filter((r) => r && typeof r.id === 'string' && /^[a-z0-9-]+$/.test(r.id) && (r.title_de || r.title_en));
const sawVon = (r) => SAW[String(r?.sawIt ?? '').toLowerCase()];

/** Zeitangabe aus dem Rücktest. Der Rücktest rechnet alle 3 Stunden: darunter nur „innerhalb der ersten 3 Stunden". */
const zmZeit = (h) => (h < 3 ? L.zeitmaschine.ersteDrei : h < 48 ? L.zeitmaschine.nachStunden(Math.round(h)) : L.zeitmaschine.nachTagen(Math.round(h / 24)));

/** Kartentext aus den Feldern gebildet (die mitgelieferten Zusammenfassungen enthalten Fachwörter) */
function zmText(r) {
  const Z = L.zeitmaschine;
  const lv = Number.isFinite(r.maxLevel) ? Math.max(0, Math.min(4, r.maxLevel)) : 0;
  if (r.kind === 'control') return Z.textRuhig;
  if (r.kind === 'recent') return Z.textRecent(L.stufen[lv]);
  const saw = sawVon(r);
  const wann = Number.isFinite(r.firstSeenHours) && r.firstSeenHours >= 0 ? zmZeit(r.firstSeenHours) : null;
  if (saw === 'ja') return Z.textJa(L.stufen[lv], wann);
  if (saw === 'teilweise') return lv ? Z.textTeil(L.stufen[lv], wann) : Z.textTeil0;
  return Z.textNein;
}

/** Sprungmarken: zuerst gesehene Ereignisse (höchste Stufe zuerst), dann ein ehrliches „nicht gesehen" */
function rbMarken() {
  const ev = gueltigeReplays().filter((r) => r.kind === 'event');
  const neu = (a, b) => String(b.date).localeCompare(String(a.date));
  const ja = ev.filter((r) => sawVon(r) === 'ja').sort((a, b) => (b.maxLevel ?? 0) - (a.maxLevel ?? 0) || neu(a, b)).slice(0, 3);
  const nein = ev.filter((r) => sawVon(r) === 'nein').sort(neu).slice(0, 1);
  return [...ja, ...nein];
}
const rbTitel = (r) => L.rb.kurz[r.id] ?? ((sprache === 'en' && r.title_en) || r.title_de || r.id);
const monat = (iso) => new Intl.DateTimeFormat(L.locale, { month: 'long', year: 'numeric' }).format(new Date(iso));
const tagLang = (iso) => new Intl.DateTimeFormat(L.locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Zeitleiste unter dem Globus: „Jetzt (live)" und Sprungmarken echter Ereignisse */
function zeitleiste(sc) {
  const R = L.rb;
  const marken = rbMarken();
  if (!marken.length) return '';
  return `<div class="zeitleiste" id="zeitleiste">
      <p class="zl-satz">${esc(L.ernstfall.satz[sc.id] ?? L.ernstfall.satz._)} ${esc(R.frage)}</p>
      <div class="zl-marken-wrap"><div class="zl-marken" role="group" aria-label="${esc(R.marken)}">
        <button type="button" class="zl-marke zl-jetzt" id="zl-jetzt" aria-pressed="true"><i aria-hidden="true"></i><span>${esc(R.jetztLive)}</span></button>
        ${marken.map((r) => `<button type="button" class="zl-marke saw-${esc(sawVon(r) ?? 'nein')}" data-rb="${esc(r.id)}" aria-pressed="false"><span class="zl-name">${esc(rbTitel(r))}</span><span class="zl-saw">${esc(R.saw[sawVon(r)] ?? '')}</span></button>`).join('')}
      </div><button type="button" class="zl-mehr" id="zl-mehr" tabindex="-1" aria-hidden="true" hidden>${esc(L.globus.mehrThemen)}&nbsp;→</button></div>
      <div class="zl-steuer" id="zl-steuer" hidden></div>
    </div>`;
}

/** Wohin der Globus im Rückblick schaut: Länder mit Abweichung nach Ereignisbeginn, sonst alle Orte */
function rbOrt(daten, frames) {
  const ev = Date.parse(daten.eventStart ?? '') || 0;
  const geo = (f) => (Array.isArray(f.signals) ? f.signals : []).filter((s) => Number.isFinite(s?.geo?.lat) && Number.isFinite(s?.geo?.lon));
  const nach = frames.filter((f) => Date.parse(f.t) >= ev).flatMap(geo).filter((s) => (Number(s.anomaly) || 0) >= SIGNAL_AUF);
  const wahl = [nach.filter((s) => s.geo.kind === 'country'), nach, geo(frames[0])].find((g) => g.length) ?? [];
  return startOrt(wahl.map((s) => ({ s })));
}

// Kurznamen für Messungen in der Wiedergabe: [Muster auf die id, deutsch, englisch]; {o} = Ort
const RB_NAMEN = [
  [/oref|alert/, 'Luftalarme {in} {o}', 'Air-raid alerts in {o}'],
  [/ioda_.*ping/, 'Erreichbare Netze {in} {o}', 'Reachable networks in {o}'],
  [/ioda_/, 'Internet-Verbindungen {in} {o}', 'Internet connections in {o}'],
  [/ooni_anomaly/, 'Gestörte Webseiten {in} {o}', 'Blocked websites in {o}'],
  [/grid\.load_/, 'Stromverbrauch {in} {o}', 'Power use in {o}'],
  [/oil_volatility/, 'Schwankung des Ölpreises', 'Oil price swings'],
  [/vix/, 'Angst an der Börse', 'Stock market fear'],
  [/brent|wti/, 'Ölpreis', 'Oil price'],
  [/gold/, 'Goldpreis', 'Gold price'],
  [/bgp_updates|prefix_visibility/, 'Internet-Wegweiser {in} {o}', 'Internet routing in {o}'],
  [/sofr/, 'US-Geldmarkt', 'US money market'],
  [/kev/, 'Neue Sicherheitslücken', 'New security flaws'],
  [/sec_8k/, 'Pflichtmeldungen zu Cyberangriffen', 'Mandatory cyber-attack reports'],
  [/etf/, 'Aktienfonds für IT-Sicherheit', 'IT security funds'],
];
const IM = new Set(['Iran', 'Irak', 'Libanon', 'Jemen', 'Sudan', 'Niger', 'Tschad']);
function rbName(s) {
  const ort = ortName(s.geo).split(/\s*[(,]/)[0].trim();
  const regel = RB_NAMEN.find(([re]) => re.test(s.id));
  if (regel && (ort || !regel[1].includes('{o}'))) {
    return regel[sprache === 'en' ? 2 : 1].replace('{in}', IM.has(ort) ? 'im' : 'in').replace('{o}', ort);
  }
  return klar(String(s.name ?? s.id).replace(/^IODA:\s*/, '').replace(/\s*\([^)]*\)/g, '').replace(/anpingbare Netze/, 'erreichbare Netze'));
}

/** Satz für einen Zeitpunkt: „Tag 3: Luftalarme in Israel weit über normal." */
const aktivIn = (f, s) => (Array.isArray(f.activeDomains) && f.activeDomains.includes(s.domain) ? 1 : 0);
function rbSatz(daten, f) {
  const R = L.rb;
  const ev = Date.parse(daten.eventStart ?? '');
  const t = Date.parse(f.t);
  let wann = '';
  if (Number.isFinite(ev)) {
    const d = (t - ev) / 864e5;
    wann = d >= 0 ? R.tag(Math.floor(d) + 1) : R.vorher(Math.ceil(-d));
  }
  // Gerede (Aufmerksamkeit im Netz) zählt nie als Beleg: nicht in die Schlagzeile
  const auf = (Array.isArray(f.signals) ? f.signals : []).filter((s) => s?.domain !== 'attention' && (Number(s?.anomaly) || 0) >= SIGNAL_AUF)
    .sort((a, b) => (aktivIn(f, b) - aktivIn(f, a)) || b.anomaly - a.anomaly);
  if (!auf.length) return `${wann}: ${R.ruhig}`;
  const s = auf[0];
  const name = rbName(s);
  const z = Number(s.z) || 0;
  // Zählt der Bereich damals nicht, heißt es „etwas erhöht" – passend zu „Stufe damals: Ruhig"
  const richtung = !aktivIn(f, s) ? R.richtung[z < 0 ? 'etwasUnter' : 'etwasUeber'] : R.richtung[s.anomaly >= 0.75 ? 'weit' : 'abweichend'];
  // Die Wiedergabe-Dateien tragen die Größe der Abweichung, keine verlässliche Richtung (ein Netz-Einbruch hat dort ein positives z): neutral bleiben
  return `${wann}: ${name} ${richtung}${auf.length > 1 ? R.weitere(auf.length - 1) : ''}.`;
}

/** Index des Höhepunkts: `peakAt` aus der Datei, sonst das erste Bild mit der höchsten Stufe */
function rbGipfel(daten, frames) {
  const lv = (f) => Math.max(0, Math.min(4, Number(f.level) || 0));
  const pT = Date.parse(daten?.peakAt ?? '');
  if (Number.isFinite(pT)) {
    const i = frames.findIndex((f) => Date.parse(f.t) >= pT);
    if (i >= 0) return i;
  }
  const max = Math.max(...frames.map(lv));
  // bevorzugt der Höhepunkt ab Ereignisbeginn (eine frühere Einzelspitze gehört nicht unbedingt dazu)
  const ab = rbAbBeginn(daten);
  const nach = frames.findIndex((f) => lv(f) === max && Date.parse(f.t) >= ab);
  return nach >= 0 ? nach : Math.max(0, frames.findIndex((f) => lv(f) === max));
}
/** Ereignisbeginn mit 3 Stunden Spielraum (so grob rechnet der Rücktest); ohne Angabe: Anfang der Datei */
const rbAbBeginn = (daten) => { const t = Date.parse(daten?.eventStart ?? ''); return Number.isFinite(t) ? t - 3 * 36e5 : -Infinity; };

/** Fazit in einem Satz, nur aus den gezeigten Bildern berechnet (kein Widerspruch zur Wiedergabe) */
function rbErgebnis(daten, frames) {
  const R = L.rb;
  const lv = (f) => Math.max(0, Math.min(4, Number(f.level) || 0));
  const ab = rbAbBeginn(daten);
  const frueh = frames.findIndex((f) => lv(f) >= 1);
  if (frueh < 0) return R.nieAuffaellig;
  const spaeter = frames.findIndex((f) => lv(f) >= 1 && Date.parse(f.t) >= ab);
  const erst = spaeter >= 0 ? spaeter : frueh;
  const zuvor = spaeter >= 0 && frueh < spaeter;
  const gi = rbGipfel(daten, frames);
  const g = frames[gi], e = frames[erst];
  const evT = Date.parse(daten?.eventStart ?? '');
  const tE = Date.parse(e.t);
  let tage = '', vorher = false;
  if (Number.isFinite(evT)) {
    const d = (tE - evT) / 864e5;
    if (d <= -0.5) { vorher = true; tage = R.tageVor(Math.round(-d)); } else tage = R.tageNach(Math.max(0, Math.round(d)));
  }
  const hoch = lv(g) > lv(e) ? R.amTag(tag(Date.parse(g.t))) : '';
  const satz = R.ergebnis(R.amTag(tag(tE)), tage, hoch ? L.stufen[lv(g)] : '', hoch);
  return `${satz}${zuvor ? ` ${R.zuvor}` : Number.isFinite(evT) && !vorher ? ` ${R.keineVorwarnung}` : ''}`;
}

/** Vergleichs-Ereignis je Thema: gesehenes Ereignis mit der höchsten Stufe; sonst das thematisch nächste */
const NAEHE = { ai: ['cyber'], nuclear: ['war', 'blackout'], bio: ['blackout', 'war'], cyber: ['blackout'], finance: ['cyber'], war: ['blackout'], blackout: ['cyber'] };
function vergleichsEreignis(sc) {
  const ev = gueltigeReplays().filter((r) => r.kind === 'event' && sawVon(r) === 'ja' && (Number(r.maxLevel) || 0) >= 1);
  const best = (th) => ev.filter((r) => r.scenario === th).sort((a, b) => (b.maxLevel ?? 0) - (a.maxLevel ?? 0) || String(b.date).localeCompare(String(a.date)))[0];
  for (const th of [sc.id, ...(NAEHE[sc.id] ?? [])]) { const r = best(th); if (r) return { r, eigen: th === sc.id }; }
  const r = [...ev].sort((a, b) => (b.maxLevel ?? 0) - (a.maxLevel ?? 0))[0];
  return r ? { r, eigen: false } : null;
}
function vergleichKnopf(sc) {
  const v = vergleichsEreignis(sc);
  if (!v) return '';
  const G = L.globus;
  const ziel = zustand.snap.scenarios.find((x) => x.id === v.r.scenario);
  const text = v.eigen || !ziel ? G.vergleichKnopf(rbTitel(v.r)) : G.vergleichNah(rbTitel(v.r), linsenName(ziel));
  return `<button type="button" class="vergleich-knopf" id="vergleich" data-vergleich="${esc(v.r.id)}"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg><span>${esc(text)}</span></button>`;
}

/** Rückblick auf der Hauptbühne starten; `vergleich`: schneller Zeitraffer bis zum Höhepunkt mit Vergleichssatz */
async function rueckblick(id, { vergleich = false } = {}) {
  const heute = ungewoehnlicheBereiche(aktuell()).length;
  const R = L.rb, Z = L.zeitmaschine;
  const r = zustand.replays.find((x) => x.id === id);
  const steuer = $('zl-steuer');
  if (!r || !steuer) return;
  zmStopp();
  const z = { timer: 0, i: 0, id, r, frames: [], daten: null };
  zustand.zm = z;
  document.querySelectorAll('.zl-marke').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rb === id)));
  steuer.hidden = false;
  steuer.innerHTML = `<p class="klein">${esc(Z.laedt)}</p>`;
  const daten = await ladeOptional(`data/replays/${encodeURIComponent(id)}.json`);
  if (zustand.zm !== z) return;
  const frames = Array.isArray(daten?.frames) ? daten.frames.filter((f) => f && Number.isFinite(Date.parse(f.t))) : [];
  if (!frames.length) { steuer.innerHTML = `<p class="klein">${esc(Z.fehler)}</p>`; return; }
  z.frames = frames; z.daten = daten;
  const n = frames.length;
  const gipfel = rbGipfel(daten, frames);
  const endI = vergleich ? gipfel : n - 1;
  const t0 = Date.parse(frames[0].t), t1 = Date.parse(frames[n - 1].t);
  const x = (t) => (t1 > t0 ? ((t - t0) / (t1 - t0)) * 1000 : 0);
  const bw = 1000 / n;
  const streifen = frames.map((f, i) => { const lv = Math.max(0, Math.min(4, Number(f.level) || 0)); const k = (Array.isArray(f.signals) ? f.signals : []).filter((s) => (Number(s?.anomaly) || 0) >= SIGNAL_AUF).length; const hh = 4 + lv * 9 + Math.min(k, 4) * 2; return `<rect class="zm-l f-l${Math.max(1, lv)}${lv ? '' : k ? ' etwas' : ' null'}" x="${(i * bw).toFixed(1)}" width="${(bw + 0.5).toFixed(1)}" y="${44 - hh}" height="${hh}"/>`; }).join('');
  const evT = Date.parse(daten.eventStart ?? '');
  const ev = Number.isFinite(evT) ? x(evT) : null;
  document.body.classList.add('im-rueckblick');
  $('inhalt').querySelector('.buehne')?.classList.add('rb-an');
  $('zl-jetzt').innerHTML = `<i aria-hidden="true"></i><span>${esc(R.zurueck)}</span>`;
  $('zl-jetzt').setAttribute('aria-pressed', 'false');
  steuer.innerHTML = `<div class="zl-knoepfe">
        <button type="button" class="knopf zl-spiel" id="zm-spiel"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg><span>${esc(Z.abspielen)}</span></button>
        <p id="zm-datum" class="zl-datum" aria-live="off"></p>
      </div>
      <div class="zl-bahn">
        <svg class="zm-streifen" viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">${streifen}${ev != null ? `<line class="zm-ereignis" x1="${ev.toFixed(1)}" x2="${ev.toFixed(1)}" y1="0" y2="44"/>` : ''}<line id="zm-marke" class="zm-marke" x1="0" x2="0" y1="0" y2="44"/></svg>
        <label class="nur-vorleser" for="zm-regler">${esc(Z.regler)}</label><input type="range" id="zm-regler" min="0" max="${n - 1}" value="0" step="1">
        <p class="zm-achse klein"><span>${esc(tag(t0))}</span>${ev != null ? `<span class="zm-ev">${esc(Z.beginn)}</span>` : ''}<span>${esc(tag(t1))}</span></p>
      </div>
      <p class="zl-hinweis klein">${esc(R.hinweis(Number.isFinite(Number(daten.stepHours)) && Number(daten.stepHours) > 0 ? Number(daten.stepHours) : 6))}</p>`;
  const farbeVon = (lv) => stufenFarbe(Math.max(1, lv));
  const kopf = $('antwort');
  if (kopf) {
    kopf.innerHTML = '<div id="rb-text" aria-live="polite"></div>';
    // Breite Ansicht: Steuerung neben den Globus, damit Regler und Abspielen ohne Scrollen sichtbar sind
    if (matchMedia('(min-width: 60rem)').matches) kopf.append(steuer);
  }
  const rbText = $('rb-text');
  const scR = zustand.snap.scenarios.find((x) => x.id === r.scenario);
  const bereichName = (id) => { const d = scR?.domains.find((x) => x.id === id); return d ? dTitel(scR, d) : id; };
  function endText(f) {
    const aktiv = Array.isArray(f.activeDomains) ? f.activeDomains : [];
    const vs = vergleich ? `<strong>${esc(L.globus.vergleichSatz(heute, aktiv.length, aktiv.map(bereichName).join(', ')))}</strong> ` : '';
    return `<p class="rb-fazit" id="rb-fazit">${vs}<span>${esc(R.fazit)} ${esc(rbErgebnis(daten, frames))}</span>
      <button type="button" class="knopf rb-zurueck" id="rb-zurueck">${esc(R.zurueck)}</button></p>`;
  }
  function zeige(i) {
    z.i = i;
    const f = frames[i];
    const lv = Math.max(0, Math.min(4, Number(f.level) || 0));
    $('zm-regler').value = String(i);
    const mx = x(Date.parse(f.t));
    $('zm-marke').setAttribute('x1', mx.toFixed(1)); $('zm-marke').setAttribute('x2', mx.toFixed(1));
    $('zm-datum').textContent = tagLang(f.t);
    const aktiv = Array.isArray(f.activeDomains) ? f.activeDomains : [];
    const satz = rbSatz(daten, f);
    if (kopf && rbText) {
      kopf.className = `antwort a-l${lv} art-rb`;
      rbText.innerHTML = `<p class="antwort-frage"><span class="rb-marke">${esc(R.marke)}</span> ${esc(R.kopf(rbTitel(r).replace(/\s*\d{4}$/, ''), monat(r.date)))}</p>
        <h1 class="antwort-kopf rb-kopf">${esc(satz)}</h1>
        <p class="antwort-stufe"><i class="lampe-klein" aria-hidden="true"></i>${esc(R.stufe(L.stufen[lv], aktiv.length))}</p>
        ${i >= endI ? endText(f) : ''}`;
      if (i >= endI) {
        $('rb-zurueck')?.addEventListener('click', zurueckZuJetzt);
        // Fazit sichtbar machen, ohne den Globus aus dem Blick zu schieben
        const el = $('rb-fazit');
        if (el && z.gespielt) { const b = el.getBoundingClientRect(); if (b.top < 0 || b.bottom > innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
      }
    }
    $('stand').innerHTML = `<span class="rb-stand">${esc(R.stand(tagLang(f.t)))}</span>`;
    const g = zustand.globus;
    if (!g) return;
    const farbe = farbeVon(lv);
    const punkte = [], ring = [];
    for (const s of Array.isArray(f.signals) ? f.signals : []) {
      if (!s || !s.id) continue;
      const a = Number(s.anomaly) || 0;
      const zst = s.value == null ? 'leer' : a >= SIGNAL_AUF ? (aktiv.includes(s.domain) ? 'auf' : 'erhoeht') : 'ruhig';
      const bekannt = alleSignale().get(s.id);
      const name = bekannt ? alltag(bekannt) : (en() && EN.signals?.[s.id]?.name) || klar(s.name ?? s.id);
      const p = { id: `rb:${s.id}`, zustand: zst, farbe, staerke: a, titel: rbName(s), info: L.globus.zustand[zst] };
      if (s.geo && Number.isFinite(s.geo.lat) && Number.isFinite(s.geo.lon)) punkte.push({ ...p, lon: s.geo.lon, lat: s.geo.lat });
      else ring.push(p);
    }
    g.setzeZeit(new Date(f.t));
    g.setze({ punkte, ring });
  }
  z.zeige = zeige;
  const spiel = $('zm-spiel');
  const knopfText = (t, laeuft) => {
    spiel.lastElementChild.textContent = t;
    spiel.querySelector('path').setAttribute('d', laeuft ? 'M5 4h3.5v12H5zM11.5 4H15v12h-3.5z' : 'M6 4l10 6-10 6z');
  };
  const halt = () => { clearTimeout(z.timer); z.timer = 0; knopfText(Z.abspielen, false); };
  z.halt = halt;
  // Vergleich: etwa 12 Sekunden von Ruhe bis zum Höhepunkt, egal wie viele Bilder die Datei hat
  let takt = 750;
  const schritt = () => {
    if (zustand.zm !== z) return;
    if (z.i >= endI) return halt();
    z.gespielt = true;
    zeige(z.i + 1);
    if (z.i >= endI) return halt();
    const wechsel = (frames[z.i].level ?? 0) !== (frames[z.i - 1]?.level ?? 0);
    z.timer = setTimeout(schritt, wechsel ? (vergleich ? Math.min(1200, takt * 3) : 1800) : takt);
  };
  const los = () => { knopfText(Z.anhalten, true); z.timer = setTimeout(schritt, takt); };
  // Start kurz vor Ereignisbeginn, nicht bei Wochen der Ruhe
  const evI = Number.isFinite(evT) ? frames.findIndex((f) => Date.parse(f.t) >= evT) : -1;
  let startI = Math.min(evI > 0 ? Math.max(0, evI - 2) : 0, endI);
  if (vergleich) {
    // von Ruhe an: zurück bis vor den Anstieg zum Höhepunkt, mindestens 8 Bilder Anlauf
    let a = endI;
    while (a > 0 && (Number(frames[a - 1].level) || 0) > 0) a--;
    startI = Math.max(0, Math.min(a - 2, endI - 8));
  }
  if (vergleich) takt = Math.max(120, Math.min(1500, 12000 / Math.max(1, endI - startI)));
  spiel.addEventListener('click', () => {
    if (z.timer) return halt();
    if (z.i >= endI) zeige(startI);
    los();
  });
  $('zm-regler').addEventListener('input', (e) => { halt(); z.gespielt = false; zeige(Number(e.target.value)); });
  const g = zustand.globus;
  if (g) { g.drehen(false); const [lon, lat] = rbOrt(daten, frames); g.zuOrt(lon, lat); }
  zeige(startI);
  los();
  $('ansage').textContent = R.ansage(rbTitel(r));
}

function zmStopp() {
  const z = zustand.zm;
  if (!z) return;
  clearTimeout(z.timer);
  zustand.zm = null;
}

/** Rückblick beenden: Bühne zeigt wieder die Gegenwart */
function zurueckZuJetzt() {
  if (!zustand.zm && !document.body.classList.contains('im-rueckblick')) return;
  const y = scrollY;
  renderLinse().then(() => { scrollTo({ top: y }); $('zl-jetzt')?.focus({ preventScroll: true }); });
}

/** Ehrliche Bilanz: große Ereignisse, wie viele sichtbar */
function zmBilanz() {
  const ev = gueltigeReplays().filter((r) => r.kind === 'event');
  if (!ev.length) return '';
  const mitZeit = ev.filter((r) => Number.isFinite(r.firstSeenHours));
  const keinesVorher = mitZeit.length > 0 && mitZeit.every((r) => r.firstSeenHours >= 0);
  return L.zeitmaschine.bilanz(ev.filter((r) => sawVon(r) === 'ja').length, ev.filter((r) => sawVon(r) === 'teilweise').length, ev.length, keinesVorher);
}

function zmKarte(r) {
  const Z = L.zeitmaschine;
  const saw = r.kind === 'event' ? sawVon(r) : null;
  const marke = r.kind === 'control' || r.control === 'quiet' ? `<span class="zm-saw saw-ruhig">${esc(Z.ruhigGeblieben)}</span>` : r.kind === 'recent' ? `<span class="zm-saw saw-nein">${esc(Z.verlaufMarke)}</span>` : saw ? `<span class="zm-saw saw-${saw}">${esc(Z.saw[saw])}</span>` : '';
  const titel = (sprache === 'en' && r.title_en) || r.title_de || r.title_en;
  return `<li><button type="button" class="zm-eintrag" data-rb="${esc(r.id)}">
          ${marke}<span class="zm-titel">${esc(titel)}</span>
          <span class="zm-meta">${r.date && Number.isFinite(Date.parse(r.date)) ? esc(datum(r.date)) + ' · ' : ''}${esc(zmText(r))}</span>
        </button></li>`;
}

/** Kurze Liste unten; jede Zeile steuert dieselbe Bühne oben */
function zeitmaschine(sc) {
  const Z = L.zeitmaschine;
  const alle = gueltigeReplays();
  if (!alle.length) return '';
  const neu = (a, b) => String(b.date).localeCompare(String(a.date));
  const rang = { ja: 0, teilweise: 1, nein: 2 };
  const ev = alle.filter((r) => r.kind === 'event').sort((a, b) => (rang[sawVon(a)] ?? 3) - (rang[sawVon(b)] ?? 3) || neu(a, b));
  const sonst = [...alle.filter((r) => r.kind === 'recent' && r.scenario === sc.id), ...alle.filter((r) => r.kind === 'control').sort(neu)];
  const bilanz = zmBilanz();
  return `<section class="zeitmaschine abschnitt" aria-labelledby="zm-titel">
      <h2 id="zm-titel" class="abschnitt-titel">${esc(Z.titel)}</h2>
      ${bilanz ? `<p class="zm-bilanz">${esc(bilanz)}</p>` : ''}
      <details class="zm-mehr"><summary>${esc(Z.alleEreignisse(ev.length))}</summary><ul class="zm-liste">${ev.map(zmKarte).join('')}</ul></details>
      ${sonst.length ? `<details class="zm-mehr"><summary>${esc(Z.vergleich(sonst.length))}</summary><ul class="zm-liste">${sonst.map(zmKarte).join('')}</ul></details>` : ''}
    </section>`;
}

// ---------- Für Neugierige ----------
const SW = 1000, SH = 40;
function spurSvg(hist, id) {
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
  return `<svg viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <line class="sp-grenze" x1="0" x2="${SW}" y1="${y(DOMAIN_ACTIVE).toFixed(1)}" y2="${y(DOMAIN_ACTIVE).toFixed(1)}"/>${rects}<path class="sp-linie" d="${line}"/></svg>`;
}

function neugierig(sc, ms) {
  const N = L.neugierig;
  const hist = (sc.history ?? []).filter((h) => Number.isFinite(Date.parse(h.t)));
  const spuren = hist.length > 1 ? `<div class="spuren"><p class="klein">${esc(N.spurenErkl)}</p>
      <ul>${sc.domains.map((d) => `<li class="spur${d.active ? ' aktiv' : ''}"><span class="spur-name">${esc(dTitel(sc, d))}</span>${hatDaten(d) ? spurSvg(hist, d.id) : `<span class="spur-leer">${esc(N.ohneDaten)}</span>`}</li>`).join('')}</ul>
      <p class="spur-achse" aria-hidden="true"><span>${esc(tag(Date.parse(hist[0].t)))}</span><span>${esc(tag(Date.parse(hist[hist.length - 1].t)))}</span></p></div>`
    : `<p>${esc(N.keinVerlauf)}</p>`;
  const geplant = sc.domains.flatMap((d) => d.signals).filter((s) => s.status !== 'active').length;
  const alle = sc.domains.map((d) => {
    const g = ms.filter((m) => m.d.id === d.id);
    if (!g.length) return '';
    return `<h4>${esc(dTitel(sc, d))}</h4><ul class="alle-liste">${g.map((m) => `<li class="z-${m.zustand}"><button type="button" class="ort z-${m.zustand}" data-sig="${esc(m.s.id)}"><i aria-hidden="true"></i><span class="ort-mess">${esc(sName(m.s))}</span> <span class="ort-zustand">${esc(m.s.fresh && m.s.value != null ? zahlText(m.s, m.s.value) : L.globus.zustand.leer)}</span></button>${m.s.sourceUrl && !lizenzOffen(m.s) ? extern(m.s.sourceUrl, esc(L.karte.roh), 'roh') : ''}</li>`).join('')}</ul>`;
  }).join('');
  const kontext = (sc.context ?? []).length ? `<details><summary>${esc(N.kontext)}</summary><ul class="kontext">${sc.context.map((c) => `<li>${extern(c.url, esc(c.title))} <span class="klein">${esc(c.source)} · ${esc(kurz(c.ts))}</span></li>`).join('')}</ul></details>` : '';
  return `<section class="neugierig abschnitt" aria-labelledby="neu-titel">
      <h2 id="neu-titel" class="abschnitt-titel">${esc(N.titel)}</h2>
      <details><summary>${esc(N.spuren)}</summary>${spuren}</details>
      <details><summary>${esc(N.rechnen)}</summary><div class="text">${N.rechnenText.map((p) => `<p>${esc(p)}</p>`).join('')}
        <h4>${esc(N.beispieleTitel)}</h4><ul class="punkte">${N.beispiele.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p class="klein">${esc(N.empfindlich[zustand.snap.sensitivity] ?? '')}</p></div></details>
      ${kontext}
      <details><summary>${esc(N.vorsorgeTitel)}</summary><div class="text"><p>${esc(N.vorsorge)}</p><p>${extern('https://www.bbk.bund.de/', esc(N.vorsorgeLink))}</p></div></details>
      <details id="quellen"><summary>${esc(N.quellen)}</summary><div class="text">${quellenBlock()}</div></details>
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
  const kopf = sprache === 'en' && hinweise.length ? `<p class="klein"><strong>${esc(L.globus.pflichtDe)}</strong></p>` : '';
  return `<ul class="quellen">${liste.map((a) => `<li>${quellenLink(a)}</li>`).join('')}</ul>${kopf}${hinweise.map((h) => `<p class="klein" lang="de">${esc(h)}</p>`).join('')}`;
}

// ---------- Karte „Was wird hier gemessen?" ----------
const MIN_BAND = 12; // so viele Verlaufswerte braucht das Normal-Band mindestens
function sparkBand(s) {
  const v = (s.spark ?? []).filter(Number.isFinite);
  if (v.length < MIN_BAND) return null;
  const sortiert = [...v].sort((a, b) => a - b);
  const q = (p) => sortiert[Math.min(sortiert.length - 1, Math.max(0, Math.round(p * (sortiert.length - 1))))];
  return [q(0.05), q(0.95)];
}
function sparkSvg(s) {
  const v = (s.spark ?? []).filter(Number.isFinite);
  if (v.length < 2) return '';
  const w = 320, h = 64;
  const sortiert = [...v].sort((a, b) => a - b);
  const band = sparkBand(s);
  let lo = sortiert[0], hi = sortiert[sortiert.length - 1];
  if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (i) => (i / (v.length - 1)) * (w - 12) + 4;
  const y = (z) => h - 4 - ((z - lo) / (hi - lo)) * (h - 8);
  const d = v.map((z, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(z).toFixed(1)}`).join(' ');
  const bandRect = band ? `<rect class="spark-band" x="0" width="${w}" y="${y(band[1]).toFixed(1)}" height="${Math.max(2, y(band[0]) - y(band[1])).toFixed(1)}"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">${bandRect}<path class="spark-linie" d="${d}"/><circle class="spark-punkt" cx="${x(v.length - 1).toFixed(1)}" cy="${y(v[v.length - 1]).toFixed(1)}" r="4"/></svg>`;
}

/** Gruppe (Punkt mit Zahl): ganze Liste der Messungen an diesem Ort, jede antippbar */
function oeffneGruppe(ids) {
  const ms = ids.map((i) => signalIndex.get(i)).filter(Boolean);
  if (!ms.length) return;
  const K = L.karte;
  const sc = aktuell();
  const ort = ms.find((m) => m.s.geo)?.s.geo;
  const zahl = {};
  for (const m of ms) zahl[m.zustand] = (zahl[m.zustand] ?? 0) + 1;
  const teile = ['auf', 'erhoeht', 'ruhig', 'leer'].filter((k) => zahl[k]).map((k) => `${zahl[k]} ${L.globus.zustand[k]}`).join(', ');
  const rang = { auf: 0, erhoeht: 1, ruhig: 2, leer: 3 };
  $('karte-inhalt').innerHTML = `
    <p class="karte-frage">${esc(K.frage)}</p>
    <h2 id="karte-titel">${esc(K.gruppe(ms.length, ort ? ortName(ort) : L.globus.weltweit))}</h2>
    <p class="karte-ort">${esc(teile)}</p>
    <ul class="gruppe-liste">${[...ms].sort((a, b) => rang[a.zustand] - rang[b.zustand]).map((m) => `<li>${ortKnopf(sc, m, false)}</li>`).join('')}</ul>`;
  $('karte-zu').setAttribute('aria-label', K.schliessen);
  zeigeKarte(null);
}

function zeigeKarte(id) {
  const dlg = $('karte');
  if (!dlg.open) zustand.karteVon = document.activeElement;
  if (id) zustand.globus?.waehle(id);
  zustand.globus?.pause();
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  $('karte-zu').focus();
}

function oeffneKarte(id, gruppe) {
  if (Array.isArray(gruppe) && gruppe.length > 1) return oeffneGruppe(gruppe);
  const eintrag = signalIndex.get(id);
  if (!eintrag) return;
  const { s, d, zustand: z } = eintrag;
  const K = L.karte;
  const sc = aktuell();
  const band = sparkBand(s);
  // „Normal ist etwa": derselbe graue Bereich wie im Bild, sonst der Normalwert; ohne beides entfällt die Zeile
  const bereich = (lo, hi) => { const a = zahlText(s, lo), b = zahlText(s, hi), i = b.indexOf(' '); const e = i > 0 ? b.slice(i) : ''; return K.bandWert(e && a.endsWith(e) ? a.slice(0, -e.length) : a, b); };
  const normal = band ? bereich(band[0], band[1]) : s.baseline?.mature && Number.isFinite(s.baseline.center) ? zahlText(s, s.baseline.center) : s.baseline && !s.baseline.mature ? K.lernt(s.baseline.n) : '';
  const letzter = (s.spark ?? []).filter(Number.isFinite).at(-1);
  const aussen = band && z === 'ruhig' && Number.isFinite(letzter) && (letzter > band[1] || letzter < band[0]);
  // Engine sagt „etwas erhöht", der Wert liegt aber im grauen Bereich: ehrlich erklären statt widersprechen
  const imBand = band && z === 'erhoeht' && Number.isFinite(letzter) && letzter >= band[0] && letzter <= band[1];
  const mitte = band ? (band[0] + band[1]) / 2 : 0;
  const rand = imBand ? K.bandRand(Number.isFinite(s.z) ? s.z >= 0 : letzter >= mitte) : '';
  const tsMs = Date.parse(s.ts ?? '');
  const alt = Number.isFinite(tsMs) && Date.now() - tsMs > 864e5;
  const wannLabel = !s.ts ? esc(K.jetzt) : alt ? esc(K.wertVom(tag(tsMs))) : `${esc(K.jetzt)} <span class="karte-wann">${esc(kurz(s.ts))}</span>`;
  const selten = seltenheit(s);
  const a = quellenEintrag(s);
  $('karte-inhalt').innerHTML = `
    <p class="karte-frage">${esc(K.frage)}</p>
    <h2 id="karte-titel">${esc(alltag(s))}</h2>
    <p class="karte-fach">${esc(K.fachname)}: ${esc(sName(s))}</p>
    <p class="karte-ort"><span>${esc(s.geo ? ortName(s.geo) : L.globus.weltweit)}</span> · <span>${esc(K.bereich)}: ${esc(dTitel(sc, d))}</span></p>
    <p class="karte-zustand z-${z} l-${Math.max(1, sc.level)}"><i aria-hidden="true"></i>${esc(K.zustand[z])}</p>
    ${z === 'leer' ? `<p class="karte-alt">${esc(K.alt(s.ts ? kurz(s.ts) : ''))}</p>` : `<dl class="karte-werte">
      <div><dt>${wannLabel}</dt><dd>${esc(zahlText(s, s.value))}</dd></div>
      ${normal ? `<div><dt>${esc(K.normal)}</dt><dd${band || s.baseline?.mature ? '' : ' class="wort"'}>${esc(normal)}</dd></div>` : ''}</dl>
      ${rand ? `<p class="karte-selten">${esc(rand)}</p>` : ''}
      ${selten ? `<p class="karte-selten">${esc(selten)}</p>` : ''}`}
    ${s.spark?.length > 1 ? `<figure class="karte-verlauf">${sparkSvg(s)}<figcaption>${esc(K.verlauf(kurz(s.sparkStart), kurz(s.sparkEnd)))}${band ? ` ${esc(K.band)}` : ''}${aussen && !selten ? ` ${esc(K.bandAussen(letzter > band[1]))}` : ''}</figcaption></figure>` : ''}
    ${s.damp ? `<p class="karte-daempf">${esc(K.daempf(s.damp.reason))}</p>` : ''}
    <p class="karte-art"><span>${esc(K.art)}:</span> ${esc(K.klasse[s.evidenceClass] ?? s.evidenceClass)}</p>
    ${s.sourceUrl && !lizenzOffen(s) ? `<p class="karte-roh">${extern(s.sourceUrl, `${esc(K.roh)}: ${esc(quellName(s))}`)}</p>` : ''}
    ${a && s.ts ? `<p class="karte-pflicht">${esc(K.pflicht)} ${quellenLink(a)}</p>` : ''}`;
  $('karte-zu').setAttribute('aria-label', K.schliessen);
  zeigeKarte(id);
}

function karteZu() {
  const dlg = $('karte');
  if (dlg.open) dlg.close();
}

// ---------- Metadaten für Teilen und Vorschau ----------
function setzeMeta() {
  document.title = L.kopf.titel(`${linsenName(aktuell())}: ${zustand.kurz}`);
  const beschr = `${zustand.kurz} ${L.satz}`;
  for (const sel of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(sel)?.setAttribute('content', beschr);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
}

// ---------- Linse zeichnen ----------
/** Handy: „mehr →" am Ende einer waagerecht scrollbaren Reihe, solange rechts noch etwas liegt */
function mehrHinweis(reihe, mehr) {
  if (!reihe || !mehr) return;
  const pruefe = () => {
    if (!reihe.isConnected) return removeEventListener('resize', pruefe);
    const rest = reihe.scrollWidth - reihe.clientWidth - reihe.scrollLeft;
    const zeigen = reihe.scrollWidth > reihe.clientWidth + 4 && rest > 8;
    mehr.hidden = !zeigen;
    reihe.classList.toggle('hat-mehr', zeigen);
  };
  reihe.addEventListener('scroll', pruefe, { passive: true });
  addEventListener('resize', pruefe, { passive: true });
  mehr.addEventListener('click', () => reihe.scrollBy({ left: reihe.clientWidth * 0.7, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  requestAnimationFrame(pruefe);
  // Knopftexte ändern sich (z. B. „Zurück zu jetzt" im Rückblick): dann neu prüfen
  new ResizeObserver(pruefe).observe(reihe.firstElementChild ?? reihe);
}

async function renderLinse() {
  const sc = aktuell();
  const ms = messungen(sc);
  const schichten = sichtbareSchichten(sc);
  signalIndex.clear();
  for (const m of ms) signalIndex.set(m.s.id, m);
  zustand.globus?.zerstoere();
  zustand.globus = null;
  zmStopp();
  document.body.classList.remove('im-rueckblick');
  renderKopf(); // Kopfzeile zurück auf „Live · Stand", Absender-Zahl zum Thema
  const main = $('inhalt');
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = `<section class="buehne">
      ${antwort(sc)}
      ${globusBlock(sc, ms, schichten)}
      ${listeBlock(sc, ms)}
    </section>
    ${geruechte()}
    ${regel(sc)}
    ${zeitmaschine(sc)}
    ${gerede(sc)}
    ${neugierig(sc, ms)}`;
  setzeMeta();
  main.querySelectorAll('[data-sig]').forEach((b) => {
    b.addEventListener('click', () => oeffneKarte(b.dataset.sig));
    b.addEventListener('focus', () => { const m = signalIndex.get(b.dataset.sig); if (m?.s.geo) zustand.globus?.zuOrt(m.s.geo.lon, m.s.geo.lat); });
  });
  main.querySelectorAll('[data-linse]').forEach((b) => b.addEventListener('click', () => { waehle(b.dataset.linse, true); $(`tab-${b.dataset.linse}`)?.focus(); scrollTo({ top: 0 }); }));
  main.querySelectorAll('[data-zu-geruecht]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const ziel = $(`geruecht-${a.dataset.zuGeruecht}`);
    if (!ziel) return;
    const d = ziel.querySelector('details[data-oben]');
    if (d) d.open = true;
    ziel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    ziel.focus({ preventScroll: true });
  }));
  main.querySelectorAll('[data-schicht]').forEach((b) => b.addEventListener('click', () => {
    const an = b.getAttribute('aria-pressed') !== 'true';
    zustand.schichtWahl.set(`${sc.id}:${b.dataset.schicht}`, an);
    b.setAttribute('aria-pressed', String(an));
    b.querySelector('.an-aus').textContent = an ? L.globus.an : L.globus.aus;
    zustand.globus?.setze(globusDaten(sc, ms, sichtbareSchichten(sc)));
  }));
  main.querySelectorAll('[data-rb]').forEach((b) => b.addEventListener('click', () => {
    const oben = !b.closest('.zeitleiste');
    rueckblick(b.dataset.rb);
    if (oben) $('globus')?.closest('.globus-feld')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  $('zl-jetzt')?.addEventListener('click', zurueckZuJetzt);
  mehrHinweis(main.querySelector('.zl-marken'), $('zl-mehr'));
  $('vergleich')?.addEventListener('click', (e) => {
    rueckblick(e.currentTarget.dataset.vergleich, { vergleich: true });
    $('antwort')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  $('teilen')?.addEventListener('click', teilen);
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
  zustand.globus = erstelleGlobus(canvas, { onPick: oeffneKarte, start: startOrt(ms), beschriften: innerWidth < 480 ? 2 : 3 });
  zustand.globus.setze(globusDaten(sc, ms, schichten));
}

const REPO = 'https://github.com/TRW123123/signal-radar';
// Absender: „Unabhängiges Open-Source-Projekt · 97 öffentliche Messungen"; der Projektname führt zum Quellcode
const herkunftHtml = () => {
  const [vor, projekt, zahl] = L.herkunft.absender;
  return `${esc(vor)} ${extern(REPO, esc(projekt))} · ${esc(zahl(zustand.snap ? zaehlung(aktuell()).alle : 0))}<span class="herkunft-quellen"> · ${extern(REPO, esc(L.herkunft.code))} · <a href="#quellen" data-quellen>${esc(L.herkunft.quellen)}</a></span>`;
};
function oeffneQuellen(e) {
  const d = $('quellen');
  if (!d) return;
  e.preventDefault();
  d.open = true;
  d.scrollIntoView({ block: 'start' });
  d.querySelector('summary')?.focus({ preventScroll: true });
}
function renderFuss() {
  $('fuss').innerHTML = `<p>${herkunftHtml()}</p><p>${esc(L.projekt)}</p>${sprache === 'en' ? `<p>${esc(L.nurDeutsch)}</p>` : ''}`;
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
async function setzeSprache(neu) {
  if (neu === sprache) return;
  sprache = neu;
  L = T[sprache];
  try { localStorage.setItem(SPRACHE_KEY, sprache); } catch { /* ignorieren */ }
  if (params.has('lang')) { params.set('lang', sprache); history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`); }
  await ladeEn();
  renderKopf();
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
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-quellen]')) oeffneQuellen(e); });
  $('karte-inhalt').addEventListener('click', (e) => { const b = e.target.closest?.('[data-sig]'); if (b) oeffneKarte(b.dataset.sig); });
  renderKopf();
  try {
    const [snap, ger, erkl, rep] = await Promise.all([laden(), ladeOptional('data/rumors.json'), ladeOptional('data/explain.json'), ladeOptional('data/replays/index.json'), ladeEn()]);
    zustand.snap = snap;
    zustand.geruechte = Array.isArray(ger) ? ger.filter((x) => x && x.id && x.title) : [];
    zustand.erklaerung = erkl && typeof erkl === 'object' ? erkl : null;
    zustand.replays = Array.isArray(rep) ? rep : [];
    const wunsch = decodeURIComponent(location.hash.slice(1));
    zustand.id = snap.scenarios.some((s) => s.id === wunsch) ? wunsch : snap.scenarios[0].id;
    renderKopf();
    renderLinsen();
    await renderLinse();
    if (snap.mode === 'live') setInterval(() => { renderKopf(); const p = $('puls-zeile'); if (p && !zustand.zm) p.innerHTML = pulsText(aktuell()); }, 60000);
    window.addEventListener('hashchange', () => waehle(decodeURIComponent(location.hash.slice(1)), false));
  } catch (e) {
    renderFehler(e);
  }
}

start();
