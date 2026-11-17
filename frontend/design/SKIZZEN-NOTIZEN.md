# Skizzen-Notizen — Signal Radar Frontend (Low-Fi, Skill-Schritte 2 bis 4)

Stand 2026-11-17. Drei lauffähige Skizzen, nur Geometrie und Hierarchie (Graustufen, Systemschrift, keine Radien,
keine Farbe). Alle laden echte Zustandsdaten aus `frontend/data/demo-<state>.json` (`?state=calm|rumor|single|elevated|acute`).
Keine Auswahl getroffen.

- Skizzen: `frontend/design/skizzen/h1.html`, `h2.html`, `h3.html`, gemeinsame Hilfen in `gemeinsam.js`
  (Laden, Formatierung, Verlaufslinie, Texttabelle, Platzhalter für 6 Szenarien „folgt“).
- Jede Skizze enthält beide Fassungen der Herausforderung: Standard ist die behaltene Fassung, `?v=a` bzw. `?v=b` zeigt die andere.
- Renders: `frontend/design/renders/skizzen/<h>-<calm|rumor|elevated>-<desktop|handy>.png` (1440×900 und 390×844, fullPage),
  Kontaktbögen `kontakt-h1.png`, `kontakt-h2.png`, `kontakt-h3.png`.
- Werkzeuge: `scripts/shoot.mjs` (Einzelaufnahme oder `--batch jobs.json`), `scripts/kontakt.mjs <h1|h2|h3>`.
- Zusätzlich geprüft, nicht abgelegt: `acute` auf H1 (Handy) und H3 (Desktop).

Grenzen dieser Runde: keine visuelle Recherche (Skill Schritt 2 verlangt sie nach den ersten Hypothesen; nicht Teil
dieses Auftrags), keine Werkhistorie geprüft, kein unabhängiger Reviewer. Die Beobachtungen unten stammen aus meinem
eigenen Blick auf die Renders.

Gemeinsame Datenbeobachtungen (betreffen alle drei):
- `coverage.total` = 17 zählt die 2 Aufmerksamkeits-Reihen mit, die Bereiche haben 15 Messreihen. Sichtbar als
  „17 von 17 frisch“ neben „15 Messreihen“ (H1). Entscheidung nötig, welche Zahl gezeigt wird.
- `history` ist in allen Demo-Zuständen bis auf den letzten Punkt 0: jeder Verlauf zeigt einen Sprung aus dem Nichts.
- `spark` hat 48 Punkte ohne Zeitstempel, und die Reihen haben unterschiedliche Takte (pro Stunde, pro Tag, pro Woche).
  Eine echte gemeinsame Zeitachse (H3) braucht Zeitstempel je Verlaufspunkt im Datenvertrag. H3 schreibt deshalb ehrlich
  „48 Messpunkte je Reihe zurück“ statt Datumsangaben.
- Quellen-Links zeigen in den Demo-Daten alle auf `example.org/demo` („Demo-Daten“).

---

## H1 „Die Antwort zuerst“

**Motiv:** „Muss ich mir Sorgen machen?“

**Einstiegserlebnis:** Man sieht oben die Frage des Szenarios in Grau und darunter eine fünfzeilige Skala
(0 Ruhig bis 4 Akut). Der `verdict`-Satz steht groß **in der Zeile seiner Stufe**, die anderen vier Zeilen sind
dünne, leere Linien mit Beschriftung.

**Lesereihenfolge:** Satz → Stufe (Lage des Satzes in der Skala) → Vertrauen / Abdeckung / „x von 9 Bereichen weichen ab“
→ Hinweis „keine Wahrscheinlichkeit“ → „Darum“ (nur abweichende Bereiche als Balken mit Zähl-Grenze bei 25 %, ruhige
Bereiche als eine Zeile, Aufmerksamkeit als gestrichelter Kasten „zählt nicht als Beleg“) → „Belege“ (Tabelle: Messreihe,
jetzt, normal, Abweichung, Verlauf, Rohdaten-Link; alle Reihen aufklappbar). Szenario-Wahl als Liste von Fragen in einer
linken Spalte.

**Kompositions-Operation:** Der Satz ist die Markierung auf der Skala. Je höher die Stufe, desto tiefer rutscht er;
im Normalfall steht er ganz oben.

**Herausforderung (Maßstab und Materialplatzierung):** Erste Fassung (`?v=a`): Satz links groß, daneben ein kleiner
Pegel mit 5 Feldern. Geändert zu: Pegel und Satz zu einem Material verschmolzen, der Satz sitzt in der Stufenzeile.
**Behalten: die herausgeforderte Fassung (b).** Im Render von a waren Satz und Pegel zwei getrennte Dinge, der Pegel las
sich wie eine Navigationsliste. In b ist die Stufe ohne Legende ablesbar.

**Stärken im Render:**
- Auf dem Handy steht der Satz in allen drei Zuständen innerhalb der ersten ~400 px, auch bei `acute` (Satz bei ~300–450 px).
- „Ruhig“ sieht ruhig aus: ein Satz in der obersten Zeile, darunter leere Linien, keine Ausschläge, nichts Alarmierendes.
- `rumor` wird gut erklärt: Satz „Viel Aufmerksamkeit …, aber die Messwerte sind unauffällig“, Kasten „zählt nicht als Beleg“
  steht direkt unter der Bereichsliste.

**Schwächen im Render:**
- Auf dem Desktop beginnen die Belege erst bei ~950 px (elevated); die Messreihen selbst sind unter der Falz.
- Die Szenario-Spalte links ist im Desktop fast so auffällig wie der aktuelle Inhalt; sechs graue „folgt“-Fragen nehmen viel Höhe.
- Handy-Belege als Karten sind lang: `elevated` 2.752 px, `acute` 4.404 px Seitenhöhe.
- Das Material ist überwiegend Text. Die Verläufe sind klein und erst in den Belegen sichtbar; die Skizze zeigt kaum,
  dass es ein Messinstrument ist.
- Leere Skalenzeilen über dem Satz (bei Stufe 2 bis 4) schieben den Satz nach unten; bei Stufe 4 kostet das ~100 px.

**Handy:** Frage-Spalte wandert unter die Antwort (Fragen werden zum Abschluss, nicht zum Einstieg). Die Skala bleibt
senkrecht, die leeren Zeilen schrumpfen auf Beschriftungshöhe. Vertrauen/Abdeckung brechen in zwei Zeilen um.
Belege-Tabelle wird zu Karten mit Verlauf über volle Breite.

---

## H2 „Gerede gegen Messung“

**Motiv:** „Ich habe ein Gerücht gehört. Stimmt das?“

**Einstiegserlebnis:** Ein quadratisches Feld: waagerecht Messwerte (`score`), senkrecht Aufmerksamkeit (`attention`).
Vier benannte Zonen (Ruhig · Gerede ohne Messung · Messung ohne Gerede · Gerede und Messung), getrennt an den Schwellen
der Engine (score 0,30, attention 0,35). Das Szenario ist ein schwarzer Punkt, eine gestrichelte Spur zeigt die letzten
14 Tage aus `history`. Unter der Messachse ein Band mit den Stufen 0–4 an den Engine-Schwellen.

**Lesereihenfolge:** Lage des Punkts → Zonen-Name groß rechts → `verdict` → „Daraus folgt: Stufe x“ mit Begründung
(„Die Aufmerksamkeit verschiebt die Stufe nicht“) → Vertrauen/Abdeckung → Szenarien → unten zwei Spalten an einer
Mittelachse: links „Gerede · zählt nicht als Beleg“ (rechtsbündig), rechts „Messung“ (abweichende Bereiche mit Reihen,
ruhige als Zeile, Rest aufklappbar).

**Kompositions-Operation:** Gerücht und Messung als zwei Achsen eines Raums; die Stufe ist eine Projektion des Punkts
auf die Messachse, nicht eine eigene Anzeige.

**Herausforderung (Materialplatzierung und Interaktion):** Gegenentwurf (`?v=b`): statt des Felds gegeneinander
gestellte Skalen, eine Zeile pro Szenario (links Gerede nach links, rechts Messung nach rechts, Mitte Name); die Zeilen
sind zugleich die Szenario-Auswahl. **Behalten: die erste Fassung (a, Feld).** Im Render von b bestanden 6 von 7 Zeilen
aus leeren „folgt“-Zeilen, die Lücke zwischen Gerede und Messung war nur zwei Balkenlängen, und die Zonen-Namen fehlten
räumlich. Das Feld zeigt die Lücke als Ort, den man benennen kann. Aus b übernommen: nichts; b bleibt als Fassung
zum Vergleich in der Datei, sinnvoll erst bei mehreren Szenarien mit Daten.

**Stärken im Render:**
- `rumor` ist die stärkste Ansicht aller drei Hypothesen: Punkt oben links in „Gerede ohne Messung“, sofort ohne Text lesbar.
- Die Stufe sitzt sichtbar unter der Messachse; die Aussage „Gerede hebt die Stufe nicht“ ist geometrisch, nicht behauptet.
- Handy: Die Umschaltung „Messung | Gerede“ ist nach Zustand vorbelegt (bei `rumor` steht „Gerede 84 %“ aktiv).

**Schwächen im Render:**
- Bei `calm` liegt der Punkt in der Ecke unten links auf dem Rahmen; Spur und Punkt verschwinden fast, das Feld wirkt leer.
- Die Spur aus `history` ist wegen der Demo-Daten eine einzige Diagonale von 0/0 zum Punkt; sie behauptet einen Verlauf, der nicht existiert.
- Desktop: rechts neben dem Feld bleibt unter der Erklärung eine große leere Fläche (~400 px), die Szenarienliste liegt
  klein unter dem Feld; die Belege beginnen erst bei ~800 px.
- Achsen-Beschriftungen und Zonen-Untertitel sind auf dem Handy 11 px klein.
- Der Ausdruck „Messwerte 52 %“ kann als Wahrscheinlichkeit gelesen werden, obwohl der Hinweis direkt darunter steht.

**Handy:** Das Feld wird eigens schmaler gezeichnet (370×330, eigene Schriftgrößen statt Skalierung) und steht zuerst.
Erklärung und Stufe folgen, die Szenarien danach. Die zwei gegenübergestellten Spalten werden nicht gestapelt, sondern
zu einer klebenden Umschaltung „Messung x % | Gerede y %“.

---

## H3 „Konvergenz-Streifen“

**Motiv:** „Ich will selbst sehen, was die Instrumente zeigen.“

**Einstiegserlebnis:** Neun waagerechte Spuren (eine je Bereich) über einer gemeinsamen Achse bis „jetzt“. Jede Spur
zeigt die größte Abweichung ihrer Reihen in typischen Schwankungen (Fläche) mit Ausschlag-Grenze (gestrichelt,
`z0` je Empfindlichkeit aus `src/engine/anomaly.ts`); Punkte über der Grenze sind schwarze Blöcke am Spurboden.
Rechts der Spur eine „jetzt“-Spalte: schwarz „Ausschlag“ oder „normal“. Daneben groß die Zahl der gleichzeitig
ausschlagenden Spuren, darunter die Stufe und vier Kästen für die Konvergenz-Obergrenzen; der Satz steht daneben.

**Lesereihenfolge:** Bild (welche Spuren schlagen am rechten Rand aus) → Zahl → Stufe → Satz → Vertrauen/Abdeckung
→ getrennte Aufmerksamkeits-Spur → Belege der ausschlagenden Spuren (Tabelle mit Rohdaten-Link). Jede Spur ist ein
Knopf, der ihre Messreihen aufklappt. Szenarien als Reiter oben, 6 deaktivierte „folgt“.

**Kompositions-Operation:** Die Stufe ist eine Zählung von schwarzen Feldern in einer senkrechten Spalte am rechten Rand.

**Herausforderung (Reihenfolge und ein zusätzliches Material):** Erste Fassung (`?v=a`): Spuren in fester Katalog-Reihenfolge.
Geändert zu: Spuren nach Zustand „jetzt“ sortiert (ausschlagende oben zusammen) und eine Summenspur „Gleichzeitig“
unter den Bereichen, die je Zeitpunkt zählt, wie viele Spuren im Ausschlag sind. **Behalten: die herausgeforderte Fassung (b).**
Im Render von a lagen die beiden ausschlagenden Spuren zufällig auch oben; bei anderen Daten wären sie verstreut.
Die Summenspur zeigt die Konvergenz selbst als Verlauf (bei `acute` eine Treppe auf 5) und verbindet die Spuren mit der Zahl rechts.
Preis: feste Reihenfolge geht verloren, eine Spur wechselt beim nächsten Aufruf ihre Position.

**Stärken im Render:**
- Desktop zeigt Bild, Zahl, Stufe, Satz und die ersten Belege ohne Scrollen (elevated, 1440×900).
- `acute` liest sich ohne Text: fünf schwarze Felder übereinander, Summenspur steigt auf 5, rechts „5 … Stufe 4“.
  Dass 5 Spuren nur Stufe 4 ergeben, erklären die vier Kästen.
- `calm` ist ruhig: neun flache Spuren, „0“.
- Getrennte Aufmerksamkeits-Spur macht „Gerede zählt nicht“ räumlich (unter einem Trenner, schraffiert).

**Schwächen im Render:**
- Die Spuren sind in den Demo-Daten bis auf die letzten ~5 Punkte flach; 90 % der Breite zeigen nichts. Mit echten Daten
  und ohne Zeitstempel ist die „gemeinsame Zeitachse“ eine Behauptung (siehe Datenbeobachtungen).
- „Ausschlag“ auf der schraffierten Aufmerksamkeits-Spur ist schlecht lesbar (Text auf Schraffur).
- Bei `rumor` zeigt die große Zahl „0“, der Satz erklärt das Gerücht; das Gerücht selbst steht erst unter neun ruhigen Spuren
  (Handy ~1.270 px). Für das Gerüchte-Motiv ist H3 schwach.
- Die vier Kästen und ihr Kleingedrucktes („1 Spur höchstens Stufe 1 …“) sind auf dem Handy 10 px und eng.
- Fachlich dicht: „typische Schwankungen“, „Ausschlag-Grenze“, „Messpunkte je Reihe“ sind für Otto Normalverbraucher erklärungsbedürftig.

**Handy:** Zahl, Stufe und Kästen werden eine klebende Kopfleiste, die beim Scrollen durch die Spuren stehen bleibt;
der Satz steht direkt darunter. Spuren bekommen den Namen über der Bahn statt links daneben (volle Breite für den Verlauf),
die „jetzt“-Spalte schrumpft auf 64 px. Vertrauen, Hinweise und Vorsorge wandern ans Ende.
