import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const rumors = JSON.parse(readFileSync('frontend/data/rumors.json', 'utf8')) as Array<Record<string, any>>;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('Erzeuger läuft und schreibt für jedes Gerücht eine Seite', () => {
  execFileSync('node', ['scripts/build_rumor_pages.ts'], { stdio: 'pipe' });
  for (const r of rumors) {
    assert.ok(existsSync(`frontend/g/${r.id}/index.html`), `${r.id} fehlt`);
    if (r.title_en && r.claim_en && r.factcheck_en) assert.ok(existsSync(`frontend/g/${r.id}/en/index.html`), `${r.id} en fehlt`);
  }
  assert.ok(existsSync('frontend/g/index.html'));
});

test('Seite enthält Frage, Quellen, Kopfdaten und kein unmaskiertes < aus Daten', () => {
  for (const r of rumors) {
    const h = readFileSync(`frontend/g/${r.id}/index.html`, 'utf8');
    assert.ok(h.includes(`<h1>${esc(r.title)}</h1>`));
    assert.ok(h.includes(`og:title" content="${esc(r.title)}"`));
    assert.ok(h.includes(`rel="canonical"`) && h.includes('og:image') && h.includes('hreflang'));
    for (const s of r.sources) assert.ok(h.includes(`href="${esc(s.url)}" rel="noopener noreferrer"`), s.url);
    for (const f of ['title', 'claim', 'factcheck', 'outcome']) {
      const v = r[f];
      if (typeof v === 'string' && /[<>&"']/.test(v)) assert.ok(!h.includes(v), `${r.id}.${f} unmaskiert`);
    }
    assert.ok(!/<script(?![^>]*src=)/.test(h), 'kein eingebettetes Skript');
    assert.ok(!/Nein\. In den Messdaten/.test(h), 'kein statisches Urteil zur Lage');
  }
});

test('Maskierung: Sonderzeichen in Daten werden maskiert', () => {
  assert.equal(esc('<b>"a" & \'b\'</b>'), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
});

test('Sitemap listet Startseite und alle Gerüchte-Seiten, robots verweist darauf', () => {
  const sm = readFileSync('frontend/sitemap.xml', 'utf8');
  assert.ok(sm.includes('<loc>https://signal-radar.safak-t.workers.dev/</loc>'));
  for (const r of rumors) assert.ok(sm.includes(`/g/${r.id}/</loc>`), r.id);
  assert.match(readFileSync('frontend/robots.txt', 'utf8'), /^Sitemap: https:\/\/signal-radar\.safak-t\.workers\.dev\/sitemap\.xml$/m);
});
