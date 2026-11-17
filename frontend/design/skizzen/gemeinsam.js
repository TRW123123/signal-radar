// Gemeinsame Hilfen der drei Low-Fi-Skizzen. Keine externen Anfragen, kein Build-Schritt.
// Nur Daten laden, formatieren, einfache Geometrie. Keine Gestaltungsentscheidungen.

const SR = (() => {
  const q = new URLSearchParams(location.search);
  const state = q.get('state') || 'calm';
  const variant = q.get('v') || '';

  // Zentrale Texttabelle (später Englisch ergänzbar)
  const T = {
    folgt: 'folgt',
    modes: { demo: 'Demo: erfundene Daten', snapshot: 'Aufzeichnung: echte Antworten, kein Live-Betrieb', live: 'Live' },
    levels: ['Ruhig', 'Leicht erhöht', 'Erhöht', 'Hoch', 'Akut'],
    keineWahrscheinlichkeit: 'Die Stufe ist keine Wahrscheinlichkeit und keine Vorhersage. Sie sagt, wie stark Messwerte von ihrem eigenen Normalwert abweichen.',
    vorsorge: 'Allgemeine Vorsorge nach Empfehlung des BBK. Kein Hamstern.',
    laden: 'Daten werden geladen …',
    fehler: 'Daten nicht erreichbar.',
  };

  // Szenarien ohne Daten: nur Titel und Frage-Platzhalter aus dem Briefing (keine Werte).
  const KOMMEND = [
    { title: 'Kriegseskalation', question: 'Eskaliert gerade ein Krieg?' },
    { title: 'Blackout / Energie', question: 'Droht ein großer Stromausfall?' },
    { title: 'KI-Vorfall', question: 'Läuft gerade ein schwerer KI-Vorfall?' },
    { title: 'Finanzkrise', question: 'Bahnt sich eine Finanzkrise an?' },
    { title: 'Nuklear', question: 'Gibt es einen nuklearen Zwischenfall?' },
    { title: 'Pandemie', question: 'Breitet sich gerade eine Pandemie aus?' },
  ];

  // Schwellen aus src/engine (anomaly.ts, score.ts), nur zur Darstellung gespiegelt.
  const SENS = { normal: { z0: 3.5 }, high: { z0: 2.5 } };
  const LEVEL_THRESHOLDS = [0.12, 0.3, 0.55, 0.78];
  const GAP = { attention: 0.35, score: 0.3 };

  async function load() {
    const res = await fetch('../../data/demo-' + state + '.json');
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  const nf = (v) => {
    if (v == null) return '–';
    const a = Math.abs(v);
    const d = a >= 1000 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return v.toLocaleString('de-DE', { maximumFractionDigits: d });
  };
  const pct = (v) => Math.round(v * 100) + ' %';
  const zeit = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Abweichung in Normal-Einheiten (Betrag) je Verlaufspunkt eines Signals. */
  function zs(sig) {
    if (!sig.baseline || !sig.baseline.scale) return sig.spark.map(() => 0);
    return sig.spark.map((v) => Math.abs(v - sig.baseline.center) / sig.baseline.scale);
  }

  /** Verlauf als SVG-Linie, Normalwert als waagerechte Linie. */
  function spark(sig, w = 160, h = 32) {
    const s = sig.spark;
    if (!s || !s.length) return '';
    const vals = s.concat(sig.baseline ? [sig.baseline.center] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { hi += 1; lo -= 1; }
    const x = (i) => (i / (s.length - 1)) * (w - 2) + 1;
    const y = (v) => h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
    const d = s.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const base = sig.baseline ? `<line x1="0" x2="${w}" y1="${y(sig.baseline.center)}" y2="${y(sig.baseline.center)}" stroke="#999" stroke-dasharray="2 3"/>` : '';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${base}<path d="${d}" fill="none" stroke="#111" stroke-width="1.5"/><circle cx="${x(s.length - 1)}" cy="${y(s[s.length - 1])}" r="2.5" fill="#111"/></svg>`;
  }

  function abweichung(sig) {
    if (!sig.baseline || sig.value == null) return '–';
    const f = sig.value / sig.baseline.center;
    if (!isFinite(f)) return '–';
    if (f >= 1.5 || f <= 0.67) return f.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + '× normal';
    const p = Math.round((f - 1) * 100);
    return (p > 0 ? '+' : '') + p + ' %';
  }

  function stateBar() {
    const states = ['calm', 'rumor', 'single', 'elevated', 'acute'];
    return '<nav class="sk-states" aria-label="Skizzen-Zustand">Skizzen-Zustand: ' + states.map((s) => s === state ? `<b>${s}</b>` : `<a href="?state=${s}${variant ? '&v=' + variant : ''}">${s}</a>`).join(' · ') + '</nav>';
  }

  return { state, variant, T, KOMMEND, SENS, LEVEL_THRESHOLDS, GAP, load, nf, pct, zeit, esc, zs, spark, abweichung, stateBar };
})();
