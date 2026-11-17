# REVIEW — finale Anzeige (Skill Schritt 6 und 7)

Stand 17.11.2026. Skill `elite-ui-ux`, Repo-Stand f8acb28. Prüfer: derselbe Builder (Modell), **keine unabhängige Review**.

## Gebunden an diesen Stand

| Datei | SHA-256 |
|---|---|
| index.html | f9557bc5af2da9dd7757fab90eee30621c5ce485a5198dcd18dcf219929fa5a3 |
| app.css | 58995928ef9a258f7e61e80a3915f8b84773dfa5f0db796d973aef044477183e |
| app.js | dcbbf74e80c3df7ec291102d895137f469199f5d15bafd534e36baaebcb2ed99 |
| favicon.svg | 3269c9ac4116ee41ab86ba13ddd8edaa08f0ce9ec409368d22a20cefb3c9c1c4 |
| data/demo-multi.json | 88841e54a7cc8a339b6c6c06083db5f50b5519612ac9660ce1799188a6759f9c |
| scripts/shoot.mjs | bdd257d8750b308cecc1e6d90e1d40ca8fe68168ec95358c786bc0cef9eadb9e |

Schriften: siehe `assets/HERKUNFT.md`. Jede spätere Änderung an diesen Dateien macht die Aufnahmen unten ungültig.

## Was geprüft wurde

**Aufnahmen** (`renders/final/`, Chrome über Playwright, `reducedMotion: reduce`, Zeitzone Europe/Berlin, DPR 1):
Desktop 1440, Handy 390 und 320, je hell und dunkel, für calm, rumor, elevated, acute, multi und Fehler (36 Bilder),
dazu `multi-ki-*` (zu wenig Daten) und `veraltet-live-*` (live, 5 h alt, per umgeleiteter Anfrage).
Kontaktbögen: `kontakt-hell.png` (Desktop elevated, Handy calm/rumor/elevated), `kontakt-dunkel.png` (Desktop acute, Handy multi/acute).
Angesehen wurden die Bögen sowie Einzelbilder (elevated Desktop/390 hell, acute Desktop dunkel, multi 320 dunkel,
multi-ki Desktop dunkel, rumor 390 hell, Fehler 390 hell, veraltet 390 hell).

**Automatisch** (`design/werkzeug/pruefen.mjs`, 73 Prüfungen, alle bestanden):
- 36 Ladevorgänge (6 Demo-Zustände × 1440/390/320 × hell/dunkel): keine Konsolenfehler, keine Anfrage außer an
  localhost, kein waagerechter Überlauf (auch nicht bei 320 px).
- axe-core 4.14.1 (WCAG 2.0/2.1/2.2 A und AA) bei 1440 und 320, hell und dunkel, mit allen Spuren aufgeklappt: keine Verstöße.
- Tastatur: Tab erreicht zuerst die Szenario-Wahl (2. Tab-Halt nach „Zum Inhalt springen“), dann die Spuren; Pfeil rechts
  wechselt Szenario, Fokus und `#hash`; Enter klappt eine Spur auf (`aria-expanded=true`); `#finanz` beim Laden wählt das Szenario.
- `aria-label` der Spuren in der Form „Internet-Routen: Ausschlag. 2 Messreihen.“
- Live 5 h alt → Hinweis „Veraltet“; live 1 h → kein Hinweis; `snapshot` → Aufzeichnungs-Band; falsches Schema → Fehlerzustand.
- Fehlende `data/snapshot.json`: Fehlerzustand; einziger Konsoleneintrag ist der 404 des Browsers für genau diese Datei (erwartet).
- Wurzel-Schriftgröße 200 % bei 640 px Fenster (entspricht 320 px bei 200 % Zoom): kein Überlauf.
- `prefers-reduced-motion: reduce`: 0 laufende Animationen; ohne Einschränkung 11 (Spuren zeichnen sich einmal).
- Kontrast der Farb-Tokens rechnerisch: alle Text-Paare ≥ 4,6:1 (Details in DESIGN.md).

## Beobachtungen aus den Bildern und was geändert wurde

- Erster Render: Grundlinie jeder Spur in voller Tinte wirkte wie ein Gitter → auf 55 % Tinte reduziert.
- Handy: der jetzige Ausschlag ist bei 14 Tagen nur 6 Stunden breit (≈ 5 px) → rechter Spurrand bei Ausschlag 5 px in Stufenfarbe.
- Zu wenig Daten: ein „–“ in Martian Mono erschien als grauer Balken → die große Zahl zeigt jetzt die Bereiche mit Daten
  („2 von 9 Bereichen liefern frische Messwerte“), Stufe „Keine Stufe · Zu wenig Daten“, Pegel gestrichelt.
- Gerücht: Satz und Gerede-Hinweis sagten zweimal dasselbe → der Hinweis verweist jetzt als Link auf die Aufmerksamkeits-Spur.
- Achsenbeschriftung am linken Rand (320 px) abgeschnitten → Beschriftungen unter 4 % und über 90 % der Breite entfallen.

## Offene Einwände (nicht gelöst)

1. **Der jetzige Ausschlag ist schmal.** In den Demo-Daten beginnt er 6 h vor jetzt; auf 14 Tagen sind das 1,8 % der Breite.
   Die Jetzt-Spalte (Desktop) bzw. der farbige rechte Rand (Handy) tragen die Aussage, die Spur selbst kaum. Eine Lupe
   „letzte 48 Stunden“ wäre zu prüfen; mit echten Daten kann sich das Verhältnis ändern.
2. **Gerücht-Fall auf dem Handy:** Die Aufmerksamkeits-Spur liegt bei 390 px erst bei ≈ 1.900 px. Der Satz oben und der
   Link entschärfen das, aber das Gerücht-Motiv bleibt in H3 schwächer als in H2 (bekannt aus den Skizzen).
3. **Neun Spuren sind auf dem Handy lang** (≈ 80 px je Spur). Kompaktere Spuren würden Tippziele verkleinern.
4. **Martian Mono zeichnet die Null mit Punkt** („0“ wirkt fast wie „Ø“). Für Laien bei Stufe 0 eventuell irritierend.
5. **Akut dunkel:** fünf voll gefüllte Jetzt-Felder in Karmin sind die lauteste Stelle der Seite. Bewusst, weil Akut,
   aber gegen „kein Alarmismus“ noch einmal mit Menschen zu prüfen.
6. **Multi-Demo:** Szenarien außer „Cyberangriff“ verwenden Cyber-Bereiche als Platzhalter; das sieht inhaltlich falsch aus
   und ist im Demo-Band so benannt. Die Szenario-Liste „In Vorbereitung“ ist ein fester Text aus dem BRIEF.
7. **Belege doppelt:** Ausschlagende Messreihen stehen unter „Was gerade ausschlägt“ offen und erscheinen beim Aufklappen
   der Spur ein zweites Mal. Bewusst, damit die Spuren-Grafik zusammenhängend bleibt.
8. Rohdaten-Links der Demo zeigen auf `example.org/demo`.

## Grenzen dieser Prüfung

- **Keine unabhängige Review** (Skill Schritt 6 verlangt einen anderen Prüfer); alle Urteile oben stammen vom Builder.
- **Keine echte Geräteprüfung** (kein iOS/Android, kein echter Bildschirmleser, keine Touch-Hardware); nur Chrome-Emulation.
- axe findet nur einen Teil der Barrieren; keine Konformitätsaussage. Kontrast von Text über der Schraffur nicht automatisch prüfbar
  (es steht dort kein Text).
- Kein Tablet-Breakpoint fotografiert (768–1087 px nur durch die 640-px-Prüfung und Code abgedeckt).
- Keine Nutzerforschung; Verständlichkeit für Laien ist angenommen, nicht gemessen.
- Keine echten Daten: `data/snapshot.json` existiert nicht, alle Bilder außer Fehler zeigen Demo-Daten.
- Leistungswerte nur Dateigrößen (Fonts ≈ 72 KB, app.js ≈ 10,6 KB gzip), keine Lab- oder Feldmessung.

## Werkzeuge

`node scripts/serve.ts frontend 4173` · `node scripts/shoot.mjs --batch jobs.json` (neu: `colorScheme`, `reducedMotion`,
`timezoneId`) · `node frontend/design/werkzeug/pruefen.mjs <axe.min.js>` · `node frontend/design/werkzeug/kontakt-final.mjs` ·
`node frontend/design/werkzeug/demo-multi.mjs`.
