# Herkunft der Assets

Alle Dateien liegen lokal; zur Laufzeit gibt es keine Anfragen an Dritte.

| Datei | Herkunft | Lizenz | SHA-256 |
|---|---|---|---|
| `fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2` | npm-Paket `@fontsource-variable/atkinson-hyperlegible-next@5.3.0` (bezogen per `npm pack` am 17.11.2026), Datei `files/atkinson-hyperlegible-next-latin-wght-normal.woff2` unverändert. Schrift: Atkinson Hyperlegible Next, Braille Institute / googlefonts. | SIL Open Font License 1.1, siehe `fonts/LICENSE-atkinson-hyperlegible-next.txt` | 18b2a1a39a2fa298b0ba5390aca68462669826c90925656f1c1f6796e0e1bbaf |
| `fonts/martian-mono-latin-standard-normal.woff2` | npm-Paket `@fontsource-variable/martian-mono@5.3.0` (bezogen per `npm pack` am 17.11.2026), Datei `files/martian-mono-latin-standard-normal.woff2` (Achsen Gewicht und Breite) unverändert. Schrift: Martian Mono, Evil Martians. | SIL Open Font License 1.1, siehe `fonts/LICENSE-martian-mono.txt` | f9c1655c2c9d1ed5bb8b301a57d1169a1123ffef1a588dc50a7a487810f7d732 |

Nur die Untermenge „latin“ (deckt Deutsch ab) wurde kopiert; latin-ext, kyrillisch und kursiv nicht.
`favicon.svg` und das Zeichen im Kopf sind eigene, einfache Geometrie (drei Spuren, zwei mit Ausschlag, Jetzt-Linie).
Keine Fotos, keine generierten Bilder.

## Globus (seit Frontend V2, 24.11.2026)

Bibliotheken und Kartendaten liegen unter `vendor/`, bezogen per `npm pack` (Pakete entpackt unter `/tmp/vend/`).
Zur Laufzeit gibt es auch hier keine Anfragen an Dritte.

| Datei | Herkunft | Lizenz |
|---|---|---|
| `vendor/d3-geo.min.js` | npm `d3-geo@3.1.2`, `dist/d3-geo.min.mjs`. **Eine Änderung:** die Import-Zeile `from"d3-array"` lautet `from"./d3-array.min.js"` (statt Import-Map, die die CSP als Inline-Skript verbieten würde). Endung `.mjs` → `.js`, damit jeder Server sie als JavaScript ausliefert. | ISC, `vendor/LICENSE-d3-geo.txt` |
| `vendor/d3-array.min.js` | npm `d3-array@3.2.5`, `dist/d3-array.min.mjs`, unverändert (nur Endung). | ISC, `vendor/LICENSE-d3-array.txt` |
| `vendor/topojson-client/*.js` | npm `topojson-client@3.1.0`, Quelldateien `src/feature.js, mesh.js, stitch.js, transform.js, reverse.js, identity.js` unverändert (ES-Module; das Paket liefert kein gebündeltes ESM). | ISC, `vendor/LICENSE-topojson-client.txt` |
| `vendor/countries-110m.json` | npm `world-atlas@2.0.2`, unverändert. Kartendaten: Natural Earth 1:110m (gemeinfrei), `id` = ISO 3166-1 numerisch. | Paket ISC, Daten Public Domain (Natural Earth), `vendor/LICENSE-world-atlas.txt` |

SHA-256:

| Datei | SHA-256 |
|---|---|
| `vendor/d3-array.min.js` | 4e24ca07df2a535953796a9b4e4b07c475b64c002048b984d3e933832dd6f5c8 |
| `vendor/d3-geo.min.js` | fe1dcde2f37bb5241faad2053d1f6ff8c0b304ae2c690a75fb7bba127c474e74 |
| `vendor/countries-110m.json` | 2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8 |
| `vendor/topojson-client/feature.js` | 7cf92b3e527487873f167b20581dbfb4671916e5db184ca16d6d555faf0d49ad |
| `vendor/topojson-client/identity.js` | 38f849a76a9268107d92965eafa07e7cb0fef759c9b9fcde23e6cd6846009827 |
| `vendor/topojson-client/mesh.js` | 0f2ac01b8f25240ac1a2245a54a542d1e34823b4e3a441c40c0bc36082763e3e |
| `vendor/topojson-client/reverse.js` | 4f53edde50801ca59dae516674c87ae42ec29ac594b8f8e517c7804370f0ad95 |
| `vendor/topojson-client/stitch.js` | e4648a939f439c5d15a2d65a27649c51f5854a458ee660e5f857018a8888cc61 |
| `vendor/topojson-client/transform.js` | af3f04ceed8f05cf3d2007fe435223f0089ef322812fca78b62826ae4ce0997c |
