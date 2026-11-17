# DESIGN — Signal Radar Anzeige

Richtung: H3 „Konvergenz-Streifen“, Leitbild Messschreiber (siehe `ART-DIRECTION.md`). Skill `elite-ui-ux`, Repo-Stand f8acb28.
Quelle der Wahrheit für Werte: `frontend/app.css` (`:root`). Diese Datei nennt die Regeln dahinter.

## Organisierende Idee

Eine Spur je unabhängigem Bereich auf gemeinsamer Zeitachse (14 Tage, `history[].d`), rechter Rand = jetzt.
Die Zahl der Spuren, die jetzt über der Ausschlag-Grenze liegen, **ist** die große Zahl in der Aussage und die
Summenspur „Gleichzeitig“ (`history[].activeDomains`). Aufmerksamkeit (`history[].attention`) ist eine eigene,
anders gezeichnete Spur unter einem Trenner, mit dem Etikett „zählt nicht als Beleg“.

## Farbe ist Signal

| Rolle | hell (Papier) | dunkel (Nachtschicht) | Regel |
|---|---|---|---|
| `--papier` Fläche | #f4f1ea | #121519 | |
| `--band` Spurband | #ebe7dc | #191d22 | Papierband des Schreibers, nur unter Spuren und Sparklines |
| `--tinte` Text, Jetzt-Linie | #1c1f23 | #e9e5dc | |
| `--grau` Nebentext | #575d63 | #a4aab0 | Kontrast ≥ 5,3:1 auf Papier und Band |
| `--l0` Stufe 0 | #5f656b | #9aa0a6 | grau: auch ein Ausschlag ohne Stufenwirkung bleibt farblos |
| `--l1` Leicht erhöht | #1f6a8a (Petrol) | #6db4d8 | kühl |
| `--l2` Erhöht | #8a5a00 (Ocker) | #dfa73e | |
| `--l3` Hoch | #b1431a (Rost) | #f08454 | |
| `--l4` Akut | #a3162b (Karmin) | #ff7a88 | warm |
| `--att` Aufmerksamkeit | #6e3a9a (Violett) | #c4a0ee | eigene Farbfamilie, immer mit Schraffur |

- Im Ruhezustand ist die Seite einfarbig (Papier, Graphit). Farbe erscheint nur an Ausschlägen.
- **Ein Ausschlag trägt die Farbe der Stufe, die zu diesem Zeitpunkt galt** (`history[i].level`). Ein einzelner
  früherer Ausschlag bleibt daher kühl (Stufe 1), gleichzeitige Ausschläge werden warm. Das zeigt die Konvergenz-Regel im Bild.
- Stufe ist nie nur Farbe: immer Zahl und Wort („Stufe 2 · Erhöht“), Pegel mit Ziffern.
- Weißer Text auf Stufenfarbe (hell) bzw. dunkler Text auf Stufenfarbe (dunkel): alle Paare ≥ 5,7:1.
- Zu wenig Daten: gestrichelte Pegel, grau, „Keine Stufe“.

## Schrift

- **Atkinson Hyperlegible Next** (variabel 200–800) für Sätze und Namen: für Lesbarkeit bei schwacher Sicht
  entworfen, eindeutige Zeichen; passt zum Laien-Publikum.
- **Martian Mono** (variabel, Breite 87,5 %) für Zahlen, Achsen, Etiketten, Betriebsart: Instrumenten-Charakter,
  feste Ziffernbreite. Nur dort, wo gemessen oder beschriftet wird, nie für Fließtext.
- Größen (rem): 0,75 / 0,875 / 1 / 1,125 / 1,375 / 1,75; große Zahl `clamp(4rem, 2.6rem + 6vw, 7.5rem)`.
  Kleinste Schrift 12 px (Etiketten), Fließtext ≥ 14 px.

## Raum und Raster

- Abstände 4 / 8 / 12 / 16 / 24 / 32 / 48 px; Seitenrand `clamp(12px, …, 40px)`; Inhalt max. 1440 px.
- Desktop ≥ 1088 px: Spuren links (Spalten Name 13,5 rem | Spur | Jetzt 7,25 rem), Aussage rechts 21 rem,
  klebend, mit Tintenlinie links. Die Jetzt-Spalte der Spuren liegt direkt vor der großen Zahl.
- 768–1087 px: Aussage oben zweispaltig (Zahl links, Text rechts), Spuren volle Breite.
- < 768 px: Aussage zuerst (Zahl, Stufe, Satz, Pegel über der Falz bei 390 × 844), dann Spuren mit Namen und
  Zustand über der Spur, Spur volle Breite, rechter Rand als Jetzt-Linie (bei Ausschlag 5 px in Stufenfarbe).
- Radien: 3 px nur an Knöpfen; sonst Kanten. Keine Schatten, keine Karten mit Rahmen.
- Tagesraster: feine senkrechte Linien je Mitternacht (Ortszeit) in jeder Spur; Achse beschriftet jeden 2. bzw. 4. Tag
  (Container-Abfrage).

## Spuren

- Treppenlinie: der Wert eines Punktes gilt für das Intervall, das an ihm endet. Skala 0–1 (Bereichs-Score).
- Grenze 0,25 (`DOMAIN_ACTIVE`, src/engine/score.ts) als feine gestrichelte Linie. Aufmerksamkeit: Grenze 0,35.
- Reihenfolge: ausschlagend, dann mit Daten, dann ohne Daten. Bereiche ohne frische Messreihe: gestrichelte leere
  Spur mit „noch keine Messreihe“ / „keine frischen Daten“.
- Jede Spur ist ein `<button aria-expanded>` mit `aria-label` „Name: Zustand. n Messreihen.“; das SVG ist `aria-hidden`.
- Aufgeklappt: Messreihen mit Wert, Normalwert, Abweichung (Vielfaches oder Prozent) und Abstand zur üblichen
  Schwankung in Alltagssprache („46-mal so weit vom Normalwert wie üblich“), Sparkline mit Zeitraum, Dämpfungsgrund,
  Rohdaten-Link, Evidenzklasse als Wort. Geplante Messreihen nur als Zahl.

## Ergänzungen (Nacharbeit 2)

- **Unruhe:** Spurwert = max(0,25 × `history[].u[bereich]`, `history[].d[bereich]`). Unter der Grenze feine Tintenspur mit
  heller Füllung (normales Schwanken), darüber Stufenfarbe. Reine Anzeige, zählt nicht.
- **Zwillings-Pegel** unter dem Satz: „Messung“ (Balken aus `score`, Stufenfarbe, Wort = Stufenname bzw. „ruhig“) und
  „Gerede im Netz“ (Balken aus `attention`, violett schraffiert, Wort „wenig“ < 0,1 ≤ „etwas“ < 0,35 ≤ „viel“).
- **Jetzt-Rand Handy:** 12 px in Stufenfarbe bei Ausschlag, sonst 2 px Tinte.
- **Lücken:** „noch keine Messreihe“, „keine frischen Daten“, „Normalwert wird noch gelernt (bisher n Vergleichswerte)“,
  „noch nicht bewertbar“; keine Normallinie in der Sparkline bei unreifem Normalwert.
- **Offizielle Meldungen:** eigener Abschnitt mit gestricheltem Rahmen unter den Belegen, nur wenn `context` nicht leer.

## Bewegung

Einzige Bewegung: beim ersten Laden schreiben sich die Spuren einmal von links nach rechts (`clip-path`, 900 ms,
leicht gestaffelt). Kein Blinken, kein Pulsieren. Unter `prefers-reduced-motion: reduce` gibt es keine Animation
(geprüft: `document.getAnimations().length === 0`). Inhalt ist ohne Animation sofort vollständig.

## Texte und Zahlen

- Alle Texte in `T.de` in `app.js`. Ausnahme: Ladehinweis und `<noscript>` stehen statisch in `index.html`, weil sie
  vor bzw. ohne JavaScript sichtbar sein müssen.
- Zahlen über `Intl.NumberFormat('de-DE')`, Zeiten über `Intl.DateTimeFormat('de-DE')` in Ortszeit mit Datum und Zone.
- Wörter, die nie sichtbar sind: „z-Score“, „Baseline“, „Konfidenz“.

## Zustände

Laden (statisch im HTML), Fehler (Datei fehlt, Netz, falsches Format, unbekannte Demo; mit „Erneut laden“ und
Demo-Link), zu wenig Daten (`confidence < 0,15` oder `< 3` Bereiche mit Daten, wie `verdictOf`), veraltet (nur `live`,
älter als 3 h), Betriebsart-Band für `demo` und `snapshot`.

## Technik

Statisch, ES-Modul, kein Build. CSP im `<meta>`: nur `'self'`. Fonts vorab geladen (≈ 72 KB), app.js ≈ 10,6 KB gzip.
Szenario in der URL (`#cyber`), Wahl als ARIA-Tabs mit Pfeiltasten, Pos1, Ende.
