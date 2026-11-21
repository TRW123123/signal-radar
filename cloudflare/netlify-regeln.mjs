// Übersetzt [[redirects]] und [[headers]] aus einer netlify.toml in Cloudflare-Dateien
// _redirects und _headers. Nur die Formen, die unsere Seiten tatsächlich nutzen
// (feste Pfade, Splat am Ende, Status 200/301/302). Unbekanntes wird gemeldet, nicht
// still verworfen.
import fs from 'node:fs';

function bloecke(toml, name) {
  const out = [];
  const teile = toml.split(/^\s*\[\[/m).slice(1);
  for (const t of teile) {
    const kopf = t.slice(0, t.indexOf(']]'));
    if (kopf.trim() !== name) continue;
    const koerper = t.slice(t.indexOf(']]') + 2);
    const obj = { werte: {} };
    let inValues = false;
    for (const zeile of koerper.split(/\r?\n/)) {
      const z = zeile.trim();
      if (!z || z.startsWith('#')) continue;
      if (/^\[headers\.values\]/.test(z)) { inValues = true; continue; }
      if (/^\[/.test(z)) break;
      const m = z.match(/^("?)([A-Za-z0-9_.-]+)\1\s*=\s*(.+)$/);
      if (!m) continue;
      let wert = m[3].trim();
      if (wert.startsWith('"')) wert = JSON.parse(wert.replace(/\s+#.*$/, ''));
      else if (wert === 'true' || wert === 'false') wert = wert === 'true';
      else if (/^\d+$/.test(wert)) wert = Number(wert);
      if (inValues) obj.werte[m[2]] = wert; else obj[m[2]] = wert;
    }
    out.push(obj);
  }
  return out;
}

// Pfad ohne ".html", ohne "/index.html" und ohne Schlussstrich (Vergleichsform).
const sauber = (p) => p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1');

// rewrites: true = Netlify-Umschreibungen (Status 200 auf einen eigenen Pfad) abbilden:
// "/agb -> /agb.html" ist bei Cloudflare überflüssig (html_handling liefert agb.html unter /agb
// aus) und würde mit der Gegenregel "/agb.html -> /agb 301" eine Schleife bilden. Echte
// Umschreibungen mit Sternchen ("/v/* -> /v.html") übernimmt der Worker (Liste "umschreibungen").
export function netlifyZuCloudflare(tomlPfad, { extraHeaders = '', rewrites = false } = {}) {
  const toml = fs.readFileSync(tomlPfad, 'utf8');
  const warnungen = [];
  const umschreibungen = [];

  const redirects = [];
  const gesehen = new Set();
  for (const r of bloecke(toml, 'redirects')) {
    if (!r.from || !r.to) { warnungen.push('Weiterleitung ohne from/to'); continue; }
    if (r.from === r.to) continue; // Netlify-Selbstverweis (robots.txt usw.) – auf Cloudflare unnötig
    const status = r.status || 301;
    if (rewrites && status === 200 && !/^https?:/.test(r.to) && !/^https?:/.test(r.from)) {
      if (r.from.includes('*')) { umschreibungen.push({ von: r.from.replace(/\*$/, ''), nach: sauber(r.to) }); continue; }
      if (sauber(r.to) === sauber(r.from)) continue; // erledigt html_handling
      // Feste Quelle auf anderes Ziel ("/mcp/docs -> /mcp/"): der Worker liefert das Ziel unter der Quell-Adresse aus.
      umschreibungen.push({ von: r.from, nach: r.to, exakt: true });
      continue;
    }
    if (![200, 301, 302, 307, 308].includes(status)) { warnungen.push(`Status ${status} bei ${r.from}`); continue; }
    // Regeln mit Host in der Quelle (https://www.… -> …) kennt _redirects nicht; sie gehören als Redirect Rule in die Zone.
    if (/^https?:/.test(r.from)) { warnungen.push(`Host-Regel gehört in die Zone (Redirect Rule): ${r.from} -> ${r.to}`); continue; }
    if (status === 200 && /^https?:/.test(r.to)) { warnungen.push(`Fremd-Proxy nicht möglich: ${r.from}`); continue; }
    // Cloudflare lehnt doppelte Quellen ab (Fehler 100324): die erste Regel gewinnt, wie bei Netlify.
    const neu = (von, z) => { if (gesehen.has(von)) return; gesehen.add(von); redirects.push(z); };
    neu(r.from, `${r.from} ${r.to} ${status}`);
    // Netlify nimmt feste Quellen auch mit Schlussstrich an ("/a -> /b" gilt für "/a/"), Cloudflare nicht.
    if (!/[*:]/.test(r.from) && !r.from.endsWith('/') && r.to !== r.from + '/') neu(`${r.from}/`, `${r.from}/ ${r.to} ${status}`);
  }
  const statisch = redirects.filter((z) => !/[*:]/.test(z.split(' ')[0]));
  const dynamisch = redirects.filter((z) => /[*:]/.test(z.split(' ')[0]));
  if (statisch.length > 2000 || dynamisch.length > 100) warnungen.push('Cloudflare-Grenze für Weiterleitungen überschritten');

  // Header: Netlify lässt eine spezifischere Regel denselben Header ersetzen (live geprüft
  // an /tools/: nur die Tools-CSP kommt an). Cloudflare würde beide Werte verbinden,
  // deshalb wird der globale Wert dort erst entfernt (! Name).
  const hb = bloecke(toml, 'headers');
  const global = hb.find((h) => h.for === '/*')?.werte || {};
  const zeilen = [];
  for (const h of hb) {
    zeilen.push(h.for);
    for (const [name, wert] of Object.entries(h.werte)) {
      if (h.for !== '/*' && name in global) zeilen.push(`  ! ${name}`);
      zeilen.push(`  ${name}: ${wert}`);
    }
  }
  const headers = zeilen.join('\n') + '\n' + extraHeaders;
  return { redirects: [...statisch, ...dynamisch].join('\n') + '\n', headers, warnungen, anzahl: redirects.length, umschreibungen };
}
