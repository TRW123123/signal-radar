// Signal Radar – Anzeige. Statisch, kein Build, keine externen Anfragen.
// Datenvertrag: Snapshot aus src/core/types.ts. Alle sichtbaren Texte stehen in T.

const T = {
  de: {
    marke: 'Signal Radar',
    laden: 'Messwerte werden geladen …',
    betrieb: {
      demo: { kurz: 'Demo', lang: 'Erfundene Daten. Zeigt keine echte Lage.' },
      snapshot: { kurz: 'Aufzeichnung', lang: 'Echte, aufgezeichnete Antworten der Quellen. Kein Live-Betrieb.' },
      live: { kurz: 'Live', lang: '' },
    },
    stand: (zeit) => `Stand: ${zeit}`,
    veraltet: (dauer) => `Veraltet: Der letzte Stand ist ${dauer} alt. Die Anzeige zeigt deshalb nicht die aktuelle Lage.`,
    dauer: (h) => (h < 48 ? `${h} Stunden` : `${Math.round(h / 24)} Tage`),
    fehler: {
      titel: 'Die Messdaten sind gerade nicht erreichbar.',
      text: 'Ohne Messdaten zeigt diese Seite nichts an, auch keine Entwarnung.',
      grund: { http: (s) => `Die Datei wurde nicht gefunden (Antwort ${s}).`, format: 'Die Datei ist nicht im erwarteten Format.', netz: 'Keine Verbindung zum Server.', demo: 'Diese Demo gibt es nicht.' },
      erneut: 'Erneut laden',
      demo: 'Stattdessen die Demo mit erfundenen Daten ansehen',
    },
    szenarien: 'Szenario wählen',
    inVorbereitung: (liste) => `In Vorbereitung: ${liste}.`,
    kommend: { war: 'Kriegseskalation', blackout: 'Blackout / Energie', ai: 'KI-Vorfall', finance: 'Finanzkrise', nuclear: 'Nuklear', bio: 'Pandemie' },
    zwilling: {
      label: 'Messung und Gerede im Vergleich',
      messung: 'Messung',
      gerede: 'Gerede im Netz',
      messWort: (lvl, name) => (lvl === 0 ? 'ruhig' : name.toLowerCase()),
      geredeWort: (a) => (a >= 0.35 ? 'viel' : a >= 0.1 ? 'etwas' : 'wenig'),
      keineDaten: 'keine Daten',
      hinweis: 'Gerede zählt nicht als Beleg.',
      zurSpur: 'Zur Gerede-Spur',
    },
    stufen: ['Ruhig', 'Leicht erhöht', 'Erhöht', 'Hoch', 'Akut'],
    stufe: (n) => `Stufe ${n}`,
    stufeKurz: (n, name) => `Stufe ${n} · ${name}`,
    wenigDaten: 'Zu wenig Daten',
    wenigDatenStufe: 'Keine Stufe',
    wenigDatenText: 'Für eine Aussage müssen mindestens 3 Bereiche frische Messwerte liefern.',
    zahlTextWenig: (alle) => `von ${alle} Bereichen liefern frische Messwerte`,
    zahlText: (alle) => `von ${alle} Bereichen weichen gleichzeitig ab`,
    zahlOhneDaten: (n) => (n === 1 ? '1 Bereich liefert noch keine Daten.' : `${n} Bereiche liefern noch keine Daten.`),
    lageTitel: (titel) => `Lage: ${titel}`,
    pegelLabel: (n) => `Stufe ${n} von 4`,
    pegelErkl: 'Jede Stufe braucht mindestens so viele Bereiche, die gleichzeitig abweichen: Stufe 2 also mindestens 2. Ein einzelner Ausschlag ist meist Zufall.',
    gerede: {
      'talk-no-data': 'Die Aufmerksamkeit im Netz steht unten als eigene Spur. Sie zählt nicht als Beleg.',
      'data-no-talk': 'Die Messwerte weichen ab, im Netz wird darüber kaum gesprochen.',
      both: 'Die Messwerte weichen ab, und im Netz wird viel darüber gesprochen.',
      none: '',
    },
    spuren: 'Spuren der unabhängigen Bereiche',
    spurenSub: 'letzte 14 Tage, rechts ist jetzt',
    jetzt: 'jetzt',
    normal: 'normal',
    ausschlag: 'Ausschlag',
    keineDaten: 'keine Daten',
    keineReihe: 'noch keine Messreihe',
    keineFrischen: 'keine frischen Daten',
    keinVerlauf: 'kein Verlauf vorhanden',
    reihen: (n) => (n === 1 ? '1 Messreihe' : `${n} Messreihen`),
    geplant: (n) => `${n} geplant`,
    spurLabel: (titel, zustand, n) => `${titel}: ${zustand}. ${n}.`,
    gleichzeitig: 'Gleichzeitig',
    gleichzeitigSub: 'Zahl der Bereiche im Ausschlag',
    gleichzeitigLabel: (jetzt, max) => `Gleichzeitig abweichende Bereiche: jetzt ${jetzt}, höchstens ${max} in den letzten 14 Tagen.`,
    legende: {
      grenze: 'Ausschlag-Grenze: darüber zählt ein Bereich als abweichend.',
      unruhe: 'Unter der Grenze: normales Schwanken. Je näher an der Linie, desto unruhiger.',
      farbe: 'Farbe: die Stufe, die zu diesem Zeitpunkt galt. Grau heißt Stufe 0.',
      tippen: 'Spur antippen: Messreihen mit Rohdaten.',
    },
    aufmerksamkeit: 'Aufmerksamkeit im Netz',
    aufmerksamkeitTag: 'zählt nicht als Beleg',
    aufmerksamkeitErkl: 'Wie viel über das Thema gesucht und geschrieben wird. Gerede ist keine Messung und verschiebt die Stufe nicht.',
    aufmerksamkeitGrenze: 'Gestrichelt: ab hier gilt die Aufmerksamkeit als auffällig hoch.',
    attViel: 'auffällig viel',
    attNormal: 'normal',
    belege: 'Was gerade ausschlägt',
    belegeLeer: 'Kein Bereich schlägt gerade aus. Jede Spur lässt sich antippen und zeigt ihre Messreihen mit Link zu den Rohdaten.',
    belegeWenig: 'Keine belastbare Aussage, weil zu wenige Bereiche Daten liefern.',
    messreihenAus: 'Messreihen anzeigen',
    messreihenEin: 'Messreihen ausblenden',
    weitereGeplant: (n, schluessel) => `${n} weitere Messreihen sind im Katalog geplant${schluessel ? `, ${schluessel} davon brauchen einen Zugangsschlüssel` : ''}.`,
    nurGeplant: 'Für diesen Bereich ist noch keine Messreihe gebaut.',
    klasse: { A: 'unabhängige Messung', B: 'Pflichtmeldung/Statusseite', C: 'offizielle Mitteilung', D: 'Aufmerksamkeit' },
    wertJetzt: 'Jetzt',
    wertNormal: 'Normal',
    wertAbw: 'Abweichung',
    normalImAufbau: (n) => (n ? `wird noch gelernt (bisher ${n} Vergleichswerte)` : 'wird noch gelernt'),
    normalFehlt: 'wird noch gelernt',
    abwNichtBewertbar: 'noch nicht bewertbar, weil der Normalwert noch gelernt wird',
    abw: {
      mal: (f) => `${f}-mal so viel wie normal`,
      weniger: (p) => `${p} % weniger als normal`,
      mehr: (p) => `${p} % mehr als normal`,
      etwa: 'etwa wie normal',
      unbekannt: 'nicht berechenbar',
    },
    schwankung: {
      ruhig: 'im Rahmen der üblichen Schwankung',
      vielfach: (n) => `${n}-mal so weit vom Normalwert wie üblich`,
    },
    verlauf: (von, bis, normal) => `Verlauf ${von} bis ${bis}.${normal ? ' Gestrichelt: Normalwert.' : ''}`,
    gedaempft: (grund) => `Zählt weniger, weil: ${grund}`,
    rohdaten: (quelle) => `Rohdaten: ${quelle}`,
    externHinweis: '(externe Seite)',
    nichtFrisch: (zeit) => (zeit ? `Keine frischen Daten, letzter Wert vom ${zeit}.` : 'Noch keine Daten.'),
    fuss: {
      vertrauen: 'Vertrauen in die Anzeige',
      vertrauenErkl: 'Anteil der gebauten Messreihen, die frische Daten mit genug Vorgeschichte liefern.',
      abdeckung: 'Abdeckung',
      abdeckungText: (c) => `${c.fresh} von ${c.active} gebauten Messreihen liefern frische Daten. ${c.planned} weitere sind im Katalog geplant. Bereiche mit Daten: ${c.domainsWithData} von ${c.domainsTotal}.`,
      keineWkt: 'Die Stufe ist keine Wahrscheinlichkeit und keine Vorhersage. Sie sagt nur, wie stark Messwerte gerade von ihrem eigenen Normalwert abweichen.',
      methodeTitel: 'So entsteht die Anzeige',
      methode: [
        'Jede Messreihe wird mit ihrem eigenen Normalwert der letzten Wochen verglichen; offizielle Aussagen und Medienberichte zählen nicht als Beleg.',
        'Ein Bereich schlägt aus, wenn seine Messreihen deutlich vom Normalwert abweichen. Bekannte harmlose Ursachen wie Feiertage oder Wartungen werden abgeschwächt.',
        'Die Stufe steigt nur, wenn mehrere unabhängige Bereiche gleichzeitig ausschlagen.',
      ],
      empfindlichkeit: { high: 'Eingestellt: hohe Empfindlichkeit, kleinere Abweichungen zählen schon.', normal: 'Eingestellt: normale Empfindlichkeit.' },
      vorsorgeTitel: 'Für den Ernstfall',
      vorsorge: 'Es gilt die allgemeine Vorsorge-Empfehlung des Bundesamts für Bevölkerungsschutz und Katastrophenhilfe (BBK). Hamsterkäufe sind nicht nötig.',
      vorsorgeLink: 'Vorsorge-Hinweise beim BBK',
      projekt: 'Signal Radar ist ein Open-Source-Projekt im Aufbau. Name vorläufig.',
    },
    kontext: 'Offizielle Meldungen (zählen nicht als Beleg)',
    kontextErkl: 'Was Behörden und Unternehmen selbst sagen. Steht hier zur Einordnung und fließt nicht in die Stufe ein.',
    ansageWahl: (titel, stufe) => `${titel}: ${stufe}`,
  },
};

const L = T.de;
const LOCALE = 'de-DE';
const DOMAIN_ACTIVE = 0.25; // src/engine/score.ts
const ATT_HIGH = 0.35; // src/engine/score.ts, Gerede-Lücke
const DEMOS = ['calm', 'rumor', 'single', 'elevated', 'acute', 'multi', 'sparse'];
const STALE_H = 3;

// ---------- Formatierung ----------
const nfCache = new Map();
function nf(v, digits) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  const d = digits ?? (a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  if (!nfCache.has(d)) nfCache.set(d, new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d }));
  return nfCache.get(d).format(v);
}
const pctFmt = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });
const zeitFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const kurzFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const tagFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric' });
const zeit = (iso) => (iso ? zeitFmt.format(new Date(iso)) : '–');
const kurz = (iso) => (iso ? kurzFmt.format(new Date(iso)) : '–');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mitEinheitRoh = (v, unit) => `${nf(v)}${unit && unit !== 'x normal' ? ' ' + unit : unit === 'x normal' ? '-fach' : ''}`;
const mitEinheit = (v, unit) => `${nf(v)}${unit && unit !== 'x normal' ? ' ' + esc(unit) : unit === 'x normal' ? '-fach' : ''}`;

// ---------- Laden ----------
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const demo = params.get('demo');

class LadeFehler extends Error { constructor(grund) { super(grund); this.grund = grund; } }

async function laden() {
  if (demo != null && !DEMOS.includes(demo)) throw new LadeFehler(L.fehler.grund.demo);
  // Einzeldatei-Fassung (scripts/build_single.py): der Snapshot ist in die Seite eingebettet, kein Abruf nötig.
  const eingebettet = !demo && globalThis.__SR_SNAPSHOT__;
  if (eingebettet) {
    if (eingebettet.schema !== 1 || !Array.isArray(eingebettet.scenarios) || !eingebettet.scenarios.length) throw new LadeFehler(L.fehler.grund.format);
    return eingebettet;
  }
  // Live-Seite: den Snapshot direkt aus dem Repo laden (raw.githubusercontent.com), damit die 15-Minuten-Daten-Commits
  // keinen Netlify-Deploy auslösen. Fällt die Quelle aus, gilt die mitgelieferte Kopie derselben Seite. Lokal und in Demos nur eigene Dateien.
  const lokal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const quellen = demo ? [`data/demo-${demo}.json`] : lokal ? ['data/snapshot.json'] : [SNAPSHOT_REMOTE, 'data/snapshot.json'];
  let snap;
  let letzter;
  for (const url of quellen) {
    try {
      snap = await holeJson(url);
      if (pruefeSnapshot(snap)) break;
      letzter = new LadeFehler(L.fehler.grund.format);
    } catch (e) {
      letzter = e;
    }
    snap = undefined;
  }
  if (!snap) throw letzter;
  return snap;
}

const SNAPSHOT_REMOTE = 'https://raw.githubusercontent.com/TRW123123/signal-radar/master/frontend/data/snapshot.json';

const pruefeSnapshot = (snap) => !!snap && snap.schema === 1 && Array.isArray(snap.scenarios) && snap.scenarios.length > 0 && !!snap.generatedAt;

async function holeJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
  } catch {
    throw new LadeFehler(L.fehler.grund.netz);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new LadeFehler(L.fehler.grund.http(res.status));
  try { return await res.json(); } catch { throw new LadeFehler(L.fehler.grund.format); }
}

// ---------- Ableitungen ----------
const hatDaten = (d) => d.signals.some((s) => s.status === 'active' && s.fresh);
const gebaut = (sigs) => sigs.filter((s) => s.status === 'active');
const wenigDaten = (sc) => sc.confidence < 0.15 || (sc.coverage?.domainsWithData ?? 99) < 3;
const stufeName = (sc) => L.stufen[sc.level] ?? sc.levelLabel;

function sortiere(domains) {
  return domains
    .map((d, i) => ({ d, i, daten: hatDaten(d) }))
    .sort((a, b) => (b.d.active - a.d.active) || (b.daten - a.daten) || (b.d.score - a.d.score) || (a.i - b.i))
    .map((x) => x.d);
}

// ---------- Spuren (SVG) ----------
const W = 1000;
const H = 100;
const PAD = 8; // Luft oben

function zeitachse(history) {
  const t = history.map((h) => Date.parse(h.t));
  const t0 = t[0];
  const t1 = t[t.length - 1];
  const x = (ms) => (t1 > t0 ? ((ms - t0) / (t1 - t0)) * W : W);
  return { t, t0, t1, x };
}

/** Tagesgrenzen (Mitternacht Ortszeit) zwischen t0 und t1 */
function tage(t0, t1) {
  const out = [];
  const d = new Date(t0);
  d.setHours(24, 0, 0, 0);
  while (d.getTime() < t1) { out.push(d.getTime()); d.setDate(d.getDate() + 1); }
  return out;
}

function rasterSvg(ax) {
  return tage(ax.t0, ax.t1).map((ms) => `<line class="tag" x1="${ax.x(ms).toFixed(1)}" x2="${ax.x(ms).toFixed(1)}" y1="0" y2="${H}"/>`).join('');
}

/** Stufen-Treppe: der Wert eines Punktes gilt für das Intervall, das an ihm endet. */
function spurSvg(history, ax, wert, opt = {}) {
  // wert(h) liefert den Spurwert 0..1; für Bereiche max(0,25 × Unruhe, Score)
  const grenze = opt.grenze ?? DOMAIN_ACTIVE;
  const y = (v) => H - (Math.min(Math.max(v, 0), 1) * (H - PAD));
  let rects = '';
  let line = `M0 ${H}`;
  for (let i = 1; i < history.length; i++) {
    const v = wert(history[i]) ?? 0;
    const x0 = ax.x(ax.t[i - 1]);
    const x1 = ax.x(ax.t[i]);
    line += ` L${x0.toFixed(1)} ${y(v).toFixed(1)} L${x1.toFixed(1)} ${y(v).toFixed(1)}`;
    if (v <= 0.002) continue;
    const cls = opt.aufmerksamkeit
      ? (v >= grenze ? 'f-att' : 'f-att-leicht')
      : (v >= grenze ? `f-l${history[i].level ?? 0}` : 'f-ruhig');
    rects += `<rect class="${cls}" x="${x0.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(x1 - x0 + 0.4).toFixed(1)}" height="${(H - y(v)).toFixed(1)}"/>`;
  }
  const muster = opt.aufmerksamkeit
    ? `<defs><pattern id="schraffur" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="schraffur-grund" width="7" height="7"/><line class="schraffur" x1="0" y1="0" x2="0" y2="7"/></pattern></defs>`
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${muster}
    ${rasterSvg(ax)}
    <line class="grenze${opt.aufmerksamkeit ? ' grenze-att' : ''}" x1="0" x2="${W}" y1="${y(grenze).toFixed(1)}" y2="${y(grenze).toFixed(1)}"/>
    ${rects}
    <path class="${opt.aufmerksamkeit ? 'linie-att' : 'linie'}" d="${line}"/>
    <line class="grund" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/>
  </svg>`;
}

function leerSvg(ax) {
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    ${ax ? rasterSvg(ax) : ''}<line class="leer-linie" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/></svg>`;
}

function summeSvg(history, ax, max) {
  const y = (c) => H - (c / max) * (H - PAD);
  let bars = '';
  for (let i = 1; i < history.length; i++) {
    const c = history[i].activeDomains ?? 0;
    if (!c) continue;
    const x0 = ax.x(ax.t[i - 1]);
    const x1 = ax.x(ax.t[i]);
    bars += `<rect class="f-l${history[i].level ?? 0}" x="${x0.toFixed(1)}" y="${y(c).toFixed(1)}" width="${(x1 - x0 + 0.4).toFixed(1)}" height="${(H - y(c)).toFixed(1)}"/>`;
  }
  const lines = Array.from({ length: max }, (_, k) => `<line class="stufe-linie" x1="0" x2="${W}" y1="${y(k + 1).toFixed(1)}" y2="${y(k + 1).toFixed(1)}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rasterSvg(ax)}${lines}${bars}<line class="grund" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/></svg>`;
}

function sparkSvg(sig) {
  const s = sig.spark;
  if (!s || s.length < 2) return '';
  const w = 240;
  const h = 48;
  const reif = !!sig.baseline?.mature;
  const vals = s.concat(reif ? [sig.baseline.center] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (i) => (i / (s.length - 1)) * (w - 6) + 1;
  const y = (v) => h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
  const d = s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const base = reif ? `<line class="spark-normal" x1="0" x2="${w}" y1="${y(sig.baseline.center).toFixed(1)}" y2="${y(sig.baseline.center).toFixed(1)}"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${base}<path class="spark-linie" d="${d}"/><circle class="spark-punkt" cx="${x(s.length - 1).toFixed(1)}" cy="${y(s[s.length - 1]).toFixed(1)}" r="3"/></svg>`;
}

// ---------- Messreihen ----------
function abweichung(sig) {
  if (!sig.baseline || !sig.baseline.mature) return L.abwNichtBewertbar;
  if (sig.value == null) return L.abw.unbekannt;
  const c = sig.baseline.center;
  if (!c) return L.abw.unbekannt;
  const f = sig.value / c;
  if (!Number.isFinite(f)) return L.abw.unbekannt;
  if (f >= 1.5) return L.abw.mal(nf(f, 1));
  const p = Math.round((f - 1) * 100);
  if (Math.abs(p) < 3) return L.abw.etwa;
  return p < 0 ? L.abw.weniger(nf(-p, 0)) : L.abw.mehr(nf(p, 0));
}

function schwankung(sig) {
  if (sig.z == null || !sig.baseline || !sig.baseline.mature) return '';
  const z = Math.abs(sig.z);
  return z < 2 ? L.schwankung.ruhig : L.schwankung.vielfach(nf(Math.round(z), 0));
}

function messreihe(sig, stufe) {
  const auf = sig.anomaly > 0 && sig.fresh;
  const klasse = L.klasse[sig.evidenceClass] ?? sig.evidenceClass;
  let werte;
  if (sig.fresh && sig.value != null) {
    const normal = sig.baseline
      ? (sig.baseline.mature ? mitEinheitRoh(sig.baseline.center, sig.unit) : L.normalImAufbau(sig.baseline.n))
      : L.normalFehlt;
    const schw = schwankung(sig);
    werte = `<dl class="mr-werte">
        <div><dt>${L.wertJetzt}</dt><dd class="zahl-mono">${mitEinheit(sig.value, sig.unit)}</dd></div>
        <div><dt>${L.wertNormal}</dt><dd class="${sig.baseline?.mature ? 'zahl-mono' : 'mr-lernt'}">${esc(normal)}</dd></div>
        <div class="mr-abw"><dt>${L.wertAbw}</dt><dd>${esc(abweichung(sig))}${schw ? `<span class="mr-schw">${esc(schw)}</span>` : ''}</dd></div>
      </dl>`;
  } else {
    werte = `<p class="mr-alt">${esc(L.nichtFrisch(sig.ts ? kurz(sig.ts) : ''))}</p>`;
  }
  const spark = sparkSvg(sig);
  const verlauf = spark ? `<figure class="mr-verlauf">${spark}<figcaption>${esc(L.verlauf(kurz(sig.sparkStart), kurz(sig.sparkEnd), !!sig.baseline?.mature))}</figcaption></figure>` : '';
  const daempf = sig.damp ? `<p class="mr-daempf">${esc(L.gedaempft(sig.damp.reason))}</p>` : '';
  const quelle = sig.sourceUrl
    ? `<p class="mr-quelle"><a href="${esc(sig.sourceUrl)}" rel="noopener noreferrer external">${esc(L.rohdaten(sig.sourceName || sig.sourceUrl))}<span class="nur-vorleser"> ${L.externHinweis}</span></a></p>`
    : '';
  return `<article class="mr${auf ? ` mr-aus mr-l${stufe}` : ''}${sig.evidenceClass === 'D' ? ' mr-att' : ''}">
      <header class="mr-kopf"><h4 class="mr-name">${esc(sig.name)}</h4><span class="mr-klasse">${esc(klasse)}</span></header>
      <p class="mr-plain">${esc(sig.plain)}</p>
      ${werte}${verlauf}${daempf}${quelle}
    </article>`;
}

function messreihenBlock(sigs, stufe, opt = {}) {
  const g = gebaut(sigs).sort((a, b) => (b.anomaly - a.anomaly) || (b.fresh - a.fresh));
  const rest = sigs.filter((s) => s.status !== 'active');
  const schluessel = rest.filter((s) => s.status === 'needs-key').length;
  const karten = g.map((s) => messreihe(s, stufe)).join('');
  const leer = g.length ? '' : `<p class="mr-alt">${L.nurGeplant}</p>`;
  const geplant = rest.length && !opt.ohneGeplant ? `<p class="mr-geplant">${esc(L.weitereGeplant(rest.length, schluessel))}</p>` : '';
  return `${leer}<div class="mr-raster">${karten}</div>${geplant}`;
}

// ---------- Zustand ----------
const zustand = { snap: null, id: null, offen: new Set(), erstesBild: true };

function aktuellesSzenario() {
  const s = zustand.snap.scenarios;
  return s.find((x) => x.id === zustand.id) ?? s[0];
}

// ---------- Kopf, Hinweise, Wahl ----------
function renderBetrieb(snap) {
  const b = $('betrieb');
  const m = L.betrieb[snap.mode] ?? L.betrieb.live;
  if (snap.mode === 'live') { b.hidden = true; return; }
  b.hidden = false;
  b.className = `betrieb betrieb-${snap.mode}`;
  b.innerHTML = `<p><strong>${esc(m.kurz)}</strong> <span>${esc(m.lang)}</span>${snap.note ? ` <span class="betrieb-notiz">${esc(snap.note)}</span>` : ''}</p>`;
}

function renderKopf(snap) {
  const live = snap.mode === 'live';
  $('stand').innerHTML = `${live ? `<span class="live-marke">${esc(L.betrieb.live.kurz)}</span> ` : ''}<time datetime="${esc(snap.generatedAt)}">${esc(L.stand(zeit(snap.generatedAt)))}</time>`;
  const h = (Date.now() - Date.parse(snap.generatedAt)) / 3600000;
  $('hinweise').innerHTML = live && h > STALE_H
    ? `<p class="veraltet" role="status">${esc(L.veraltet(L.dauer(Math.floor(h))))}</p>`
    : '';
  document.body.classList.toggle('ist-veraltet', live && h > STALE_H);
}

function miniPegel(sc) {
  const wenig = wenigDaten(sc);
  return `<span class="mini${wenig ? ' mini-wenig' : ''}" aria-hidden="true">${[1, 2, 3, 4].map((k) => `<i class="${!wenig && sc.level >= k ? `an f-bg-l${sc.level}` : ''}"></i>`).join('')}</span>`;
}

function renderWahl(snap) {
  const nav = $('wahl');
  nav.hidden = false;
  const ids = new Set(snap.scenarios.map((s) => s.id));
  const kommend = Object.entries(L.kommend).filter(([id]) => !ids.has(id)).map(([, name]) => name);
  nav.innerHTML = `<div class="wahl" role="tablist" aria-label="${esc(L.szenarien)}">
      ${snap.scenarios.map((sc) => {
        const wenig = wenigDaten(sc);
        const an = sc.id === aktuellesSzenario().id;
        return `<button type="button" role="tab" class="wahl-knopf w-l${wenig ? 'x' : sc.level}" id="tab-${esc(sc.id)}" aria-selected="${an}" aria-controls="lage" tabindex="${an ? 0 : -1}" data-id="${esc(sc.id)}">
          <span class="wahl-titel">${esc(sc.title)}</span>
          <span class="wahl-stufe">${miniPegel(sc)}<span>${esc(wenig ? L.wenigDaten : L.stufeKurz(sc.level, stufeName(sc)))}</span></span>
        </button>`;
      }).join('')}
    </div>
    ${kommend.length ? `<p class="wahl-kommend">${esc(L.inVorbereitung(kommend.join(', ')))}</p>` : ''}`;

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
  zustand.offen.clear();
  zustand.erstesBild = false;
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
  for (const t of document.querySelectorAll('[role="tab"]')) {
    const an = t.dataset.id === id;
    t.setAttribute('aria-selected', String(an));
    t.tabIndex = an ? 0 : -1;
  }
  renderLage();
  renderFuss();
  if (nutzer) {
    const sc = aktuellesSzenario();
    $('ansage').textContent = L.ansageWahl(sc.title, wenigDaten(sc) ? L.wenigDaten : L.stufeKurz(sc.level, stufeName(sc)));
  }
}

// ---------- Lage ----------
function aussage(sc) {
  const wenig = wenigDaten(sc);
  const alle = sc.domains.length;
  const ohne = sc.domains.filter((d) => !hatDaten(d)).length;
  const lvl = wenig ? 'x' : sc.level;
  const gap = L.gerede[sc.rumorGap] ?? '';
  return `<div class="aussage a-l${lvl}">
      <h2 class="nur-vorleser">${esc(L.lageTitel(sc.title))}</h2>
      <p class="zaehler"><span class="zahl">${wenig ? sc.coverage.domainsWithData : sc.activeDomains}</span><span class="zahl-text">${esc(wenig ? L.zahlTextWenig(alle) : L.zahlText(alle))}</span></p>
      ${ohne && !wenig ? `<p class="ohne-daten">${esc(L.zahlOhneDaten(ohne))}</p>` : ''}
      <p class="stufe"><span class="stufe-nr">${esc(wenig ? L.wenigDatenStufe : L.stufe(sc.level))}</span><span class="stufe-name">${esc(wenig ? L.wenigDaten : stufeName(sc))}</span></p>
      <p class="satz">${esc(sc.verdict)}</p>
      ${wenig ? `<p class="wenig-text">${esc(L.wenigDatenText)}</p>` : ''}
      ${zwilling(sc, wenig, gap)}
      <div class="pegel" role="img" aria-label="${esc(wenig ? L.wenigDaten : L.pegelLabel(sc.level))}">
        ${[1, 2, 3, 4].map((k) => `<span class="pegel-feld${!wenig && sc.level >= k ? ` an f-bg-l${sc.level}` : ''}"><i></i><b>${k}</b><small>${esc(L.stufen[k])}</small></span>`).join('')}
      </div>
      <p class="pegel-erkl">${esc(L.pegelErkl)}</p>

      <p class="frage">${esc(sc.question)}</p>
    </div>`;
}

function zwilling(sc, wenig, gap) {
  const Z = L.zwilling;
  const attDaten = (sc.attentionSignals ?? []).some((s) => s.status === 'active' && s.fresh);
  const m = wenig ? 0 : Math.max(0, Math.min(1, sc.score));
  const a = attDaten ? Math.max(0, Math.min(1, sc.attention)) : 0;
  const mWort = wenig ? Z.keineDaten : Z.messWort(sc.level, stufeName(sc));
  const aWort = attDaten ? Z.geredeWort(sc.attention) : Z.keineDaten;
  return `<div class="zwilling">
      <dl class="zwilling-liste" aria-label="${esc(Z.label)}">
        <div class="zw-zeile zw-mess"><dt>${Z.messung}</dt><dd><span class="zw-bahn" aria-hidden="true"><span class="zw-wert f-bg-l${wenig ? 0 : sc.level}" data-w="${(m * 100).toFixed(1)}"></span></span><span class="zw-wort">${esc(mWort)}</span></dd></div>
        <div class="zw-zeile zw-att"><dt>${Z.gerede}</dt><dd><span class="zw-bahn" aria-hidden="true"><span class="zw-wert" data-w="${(a * 100).toFixed(1)}"></span></span><span class="zw-wort">${esc(aWort)}</span></dd></div>
      </dl>
      <p class="zw-hinweis">${gap && sc.rumorGap !== 'talk-no-data' ? `${esc(gap)} ` : ''}${Z.hinweis} <a href="#att-titel">${Z.zurSpur}</a></p>
    </div>`;
}

function achse(ax) {
  if (!ax) return '';
  const ticks = tage(ax.t0, ax.t1).map((ms) => {
    const d = new Date(ms);
    const pos = (ax.x(ms) / W) * 100;
    const k = d.getDate() % 4 === 0 ? ' k4' : d.getDate() % 2 === 0 ? ' k2' : '';
    const nahJetzt = pos > 90 || pos < 4 ? ' nah' : '';
    return `<span class="tick${k}${nahJetzt}" data-pos="${pos.toFixed(2)}"><span class="tick-lab">${esc(tagFmt.format(d))}</span></span>`;
  }).join('');
  return `<div class="achse" aria-hidden="true"><span class="achse-name"></span><span class="achse-zeit">${ticks}</span><span class="achse-jetzt">${L.jetzt}</span></div>`;
}

function spur(d, sc, ax) {
  const daten = hatDaten(d);
  const g = gebaut(d.signals).length;
  const geplant = d.signals.length - g;
  const zust = !daten ? (g ? L.keineFrischen : L.keineReihe) : d.active ? L.ausschlag : L.normal;
  const jetztKurz = !daten ? L.keineDaten : d.active ? L.ausschlag : L.normal;
  const sub = [g ? L.reihen(g) : '', geplant ? L.geplant(geplant) : ''].filter(Boolean).join(' · ');
  const offen = zustand.offen.has(d.id);
  const lvl = sc.level;
  const bahn = daten && ax ? spurSvg(sc.history, ax, (h) => Math.max(DOMAIN_ACTIVE * (h.u?.[d.id] ?? 0), h.d?.[d.id] ?? 0)) : leerSvg(ax);
  return `<li class="spur${d.active ? ` aus s-l${lvl}` : ''}${daten ? '' : ' leer'}">
      <button type="button" class="spur-knopf" aria-expanded="${offen}" aria-controls="mr-${esc(d.id)}" aria-label="${esc(L.spurLabel(d.title, zust, g ? L.reihen(g) : L.keineReihe))}">
        <span class="spur-name"><span class="spur-titel">${esc(d.title)}<i class="pfeil" aria-hidden="true"></i></span><span class="spur-sub">${esc(sub)}</span></span>
        <span class="spur-bahn">${bahn}${daten ? '' : `<span class="leer-text">${esc(zust)}</span>`}</span>
        <span class="spur-jetzt">${esc(jetztKurz)}</span>
      </button>
      <div class="messreihen" id="mr-${esc(d.id)}"${offen ? '' : ' hidden'}>
        ${d.plain ? `<p class="bereich-erkl">${esc(d.plain)}</p>` : ''}
        ${messreihenBlock(d.signals, lvl)}
      </div>
    </li>`;
}

function summe(sc, ax) {
  if (!ax) return '';
  const counts = sc.history.map((h) => h.activeDomains ?? 0);
  const max = Math.max(4, ...counts);
  const maxVorher = Math.max(...counts);
  return `<div class="spur summe s-l${sc.level}" role="img" aria-label="${esc(L.gleichzeitigLabel(sc.activeDomains, maxVorher))}">
      <span class="spur-name"><span class="spur-titel">${L.gleichzeitig}</span><span class="spur-sub">${L.gleichzeitigSub}</span></span>
      <span class="spur-bahn">${summeSvg(sc.history, ax, max)}</span>
      <span class="spur-jetzt"><b>${wenigDaten(sc) ? '–' : sc.activeDomains}</b></span>
    </div>`;
}

function legende() {
  return `<ul class="legende">
      <li><svg viewBox="0 0 28 10" aria-hidden="true"><line class="grenze" x1="0" x2="28" y1="5" y2="5"/></svg>${esc(L.legende.grenze)}</li>
      <li><svg viewBox="0 0 28 10" aria-hidden="true"><path class="linie" d="M0 9 L5 9 L5 6 L10 6 L10 8 L16 8 L16 4 L21 4 L21 9 L28 9"/></svg>${esc(L.legende.unruhe)}</li>
      <li><span class="legende-farben" aria-hidden="true"><i class="f-bg-l0"></i><i class="f-bg-l1"></i><i class="f-bg-l2"></i><i class="f-bg-l3"></i><i class="f-bg-l4"></i></span>${esc(L.legende.farbe)}</li>
      <li class="legende-tippen">${esc(L.legende.tippen)}</li>
    </ul>`;
}

function aufmerksamkeit(sc, ax) {
  const sigs = sc.attentionSignals ?? [];
  const daten = sigs.some((s) => s.status === 'active' && s.fresh);
  const viel = sc.attention >= ATT_HIGH;
  const zust = !daten ? L.keineDaten : viel ? L.attViel : L.attNormal;
  const offen = zustand.offen.has('__att');
  const g = gebaut(sigs).length;
  const bahn = daten && ax ? spurSvg(sc.history, ax, (h) => h.attention, { aufmerksamkeit: true, grenze: ATT_HIGH }) : leerSvg(ax);
  return `<section class="gerede" aria-labelledby="att-titel">
      <h3 class="gerede-titel" id="att-titel">${L.aufmerksamkeit} <span class="gerede-tag">${L.aufmerksamkeitTag}</span></h3>
      <p class="gerede-erkl">${esc(L.aufmerksamkeitErkl)}</p>
      <ul class="spurliste">
        <li class="spur spur-att${viel && daten ? ' aus' : ''}${daten ? '' : ' leer'}">
          <button type="button" class="spur-knopf" aria-expanded="${offen}" aria-controls="mr-att" aria-label="${esc(L.spurLabel(L.aufmerksamkeit, zust, g ? L.reihen(g) : L.keineReihe))}">
            <span class="spur-name"><span class="spur-titel">${L.aufmerksamkeit}<i class="pfeil" aria-hidden="true"></i></span><span class="spur-sub">${esc(g ? L.reihen(g) : L.keineReihe)}</span></span>
            <span class="spur-bahn">${bahn}${daten ? '' : `<span class="leer-text">${esc(L.keineDaten)}</span>`}</span>
            <span class="spur-jetzt">${esc(zust)}</span>
          </button>
          <div class="messreihen" id="mr-att"${offen ? '' : ' hidden'}>${messreihenBlock(sigs, 0)}</div>
        </li>
      </ul>
      <p class="gerede-grenze"><svg viewBox="0 0 28 10" aria-hidden="true"><line class="grenze grenze-att" x1="0" x2="28" y1="5" y2="5"/></svg>${esc(L.aufmerksamkeitGrenze)}</p>
    </section>`;
}

function belege(sc) {
  const wenig = wenigDaten(sc);
  const aktiv = sc.domains.filter((d) => d.active);
  let inhalt;
  if (wenig) inhalt = `<p class="belege-leer">${esc(L.belegeWenig)}</p>`;
  else if (!aktiv.length) inhalt = `<p class="belege-leer">${esc(L.belegeLeer)}</p>`;
  else {
    inhalt = sortiere(aktiv).map((d) => {
      const sigs = gebaut(d.signals).filter((s) => s.anomaly > 0 && s.fresh);
      return `<section class="belege-bereich"><h3>${esc(d.title)}</h3><div class="mr-raster">${sigs.map((s) => messreihe(s, sc.level)).join('')}</div></section>`;
    }).join('');
  }
  return `<section class="belege" aria-labelledby="belege-titel"><h2 id="belege-titel" class="abschnitt">${L.belege}</h2>${inhalt}</section>`;
}

function kontext(sc) {
  const items = sc.context ?? [];
  if (!items.length) return '';
  return `<section class="kontext" aria-labelledby="kontext-titel">
      <h2 id="kontext-titel" class="abschnitt">${esc(L.kontext)}</h2>
      <p class="kontext-erkl">${esc(L.kontextErkl)}</p>
      <ul>${items.map((c) => `<li><a href="${esc(c.url)}" rel="noopener noreferrer external">${esc(c.title)}<span class="nur-vorleser"> ${L.externHinweis}</span></a><span class="kontext-meta">${esc(c.source)} · ${esc(kurz(c.ts))}</span></li>`).join('')}</ul>
    </section>`;
}

function renderLage() {
  const sc = aktuellesSzenario();
  const ax = sc.history && sc.history.length > 1 ? zeitachse(sc.history) : null;
  const doms = sortiere(sc.domains);
  const main = $('inhalt');
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = `<div class="lage${zustand.erstesBild ? ' zeichnen' : ''}" id="lage" role="tabpanel" aria-labelledby="tab-${esc(sc.id)}">
      ${aussage(sc)}
      <section class="spuren" aria-labelledby="spuren-titel">
        <h2 class="abschnitt" id="spuren-titel">${L.spuren} <span class="abschnitt-sub">${L.spurenSub}</span></h2>
        ${ax ? '' : `<p class="mr-alt">${L.keinVerlauf}</p>`}
        ${achse(ax)}
        <ul class="spurliste">${doms.map((d) => spur(d, sc, ax)).join('')}</ul>
        ${summe(sc, ax)}
        ${legende()}
        ${aufmerksamkeit(sc, ax)}
      </section>
      ${belege(sc)}
      ${kontext(sc)}
    </div>`;
  for (const t of main.querySelectorAll('.tick')) t.style.left = `${t.dataset.pos}%`;
  for (const w of main.querySelectorAll('.zw-wert')) w.style.width = `${Math.max(Number(w.dataset.w), 1.5)}%`;
  for (const b of main.querySelectorAll('.spur-knopf')) b.addEventListener('click', () => umschalten(b));
}

function umschalten(b) {
  const panel = $(b.getAttribute('aria-controls'));
  const auf = panel.hidden;
  panel.hidden = !auf;
  b.setAttribute('aria-expanded', String(auf));
  const key = b.getAttribute('aria-controls') === 'mr-att' ? '__att' : b.getAttribute('aria-controls').slice(3);
  if (auf) zustand.offen.add(key); else zustand.offen.delete(key);
}

// ---------- Fuß ----------
function renderFuss() {
  const snap = zustand.snap;
  const sc = aktuellesSzenario();
  const F = L.fuss;
  $('fuss').innerHTML = `
    <div class="fuss-raster">
      <div class="fuss-block">
        <p class="fuss-zahl"><span class="zahl-mono">${pctFmt.format(sc.confidence)}</span> ${F.vertrauen}</p>
        <p>${esc(F.vertrauenErkl)}</p>
        <p class="fuss-zahl"><span class="zahl-mono">${sc.coverage.fresh}/${sc.coverage.active}</span> ${F.abdeckung}</p>
        <p>${esc(F.abdeckungText(sc.coverage))}</p>
      </div>
      <div class="fuss-block">
        <h2 class="fuss-titel">${F.methodeTitel}</h2>
        <p class="fuss-wichtig">${esc(F.keineWkt)}</p>
        <p>${F.methode.map(esc).join(' ')}</p>
        <p>${esc(F.empfindlichkeit[snap.sensitivity] ?? '')}</p>
      </div>
      <div class="fuss-block">
        <h2 class="fuss-titel">${F.vorsorgeTitel}</h2>
        <p>${esc(F.vorsorge)}</p>
        <p><a href="https://www.bbk.bund.de/" rel="noopener noreferrer external">${F.vorsorgeLink}<span class="nur-vorleser"> ${L.externHinweis}</span></a></p>
      </div>
    </div>
    <p class="fuss-projekt">${esc(F.projekt)}</p>`;
}

// ---------- Fehler ----------
function renderFehler(e) {
  const main = $('inhalt');
  main.setAttribute('aria-busy', 'false');
  $('wahl').hidden = true;
  $('stand').textContent = '';
  const grund = e instanceof LadeFehler ? e.grund : L.fehler.grund.format;
  main.innerHTML = `<section class="fehler" role="alert">
      <h2>${esc(L.fehler.titel)}</h2>
      <p>${esc(grund)} ${esc(L.fehler.text)}</p>
      <p class="fehler-aktionen"><button type="button" id="erneut" class="knopf">${esc(L.fehler.erneut)}</button>
      <a href="?demo=calm" class="fehler-demo">${esc(L.fehler.demo)}</a></p>
    </section>`;
  $('erneut').addEventListener('click', () => location.reload());
  if (!(e instanceof LadeFehler)) console.warn(e);
}

// ---------- Start ----------
async function start() {
  try {
    const snap = await laden();
    zustand.snap = snap;
    const wunsch = decodeURIComponent(location.hash.slice(1));
    zustand.id = snap.scenarios.some((s) => s.id === wunsch) ? wunsch : snap.scenarios[0].id;
    renderBetrieb(snap);
    renderKopf(snap);
    renderWahl(snap);
    renderLage();
    renderFuss();
    window.addEventListener('hashchange', () => waehle(decodeURIComponent(location.hash.slice(1)), false));
  } catch (e) {
    renderFehler(e);
  }
}

start();
