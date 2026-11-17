# ART-DIRECTION — Signal Radar

Skill `elite-ui-ux` (Repo-Stand f8acb28), Schritte 2 bis 4. Auswahl am 17.11.2026 durch den Orchestrator anhand der
gerenderten Skizzen (`renders/skizzen/kontakt-h1.png`, `-h2.png`, `-h3.png`), nicht anhand der Absicht.

## Anker-Ledger

- **Fakten:** Stufe 0–4, Konvergenz-Prinzip, Trennung Gerede/Messung, Vertrauen, Abdeckung, Rohdaten-Link je Messreihe,
  Normalzustand ruhig, kein Alarmismus, keine externen Requests, kein Build.
- **Freigegebene Marken-Vorgaben:** keine. Name „Signal Radar“ vorläufig.
- **Optionale Assoziationen:** Messschreiber, Seismograf, Leitstand, Wetterkarte.
- **Unbelegte Annahmen (nicht verwendet):** „Hacker-Optik“, Weltkugel als Pflicht, Sirenenfarben, Countdown.

## Arbeitshistorie (Wiederholungskontrolle)

Bisherige Arbeiten des Auftraggebers mit dem Skill sind Marketing- und Landingpages (Split-Hero, Bento-Raster,
nummerierte Zeilen, helle gedämpfte Flächen). Für eine Messanzeige gibt es keinen Vorläufer. Wiederholungsgefahr
besteht bei H1 (Frage-Überschrift, erklärender Absatz, nummerierte Zeilen): das ist die Kombination, vor der der Skill warnt.

## Die drei Hypothesen

| | Besucher-Motiv | Organisierender Mechanismus | Beobachtung im Render |
|---|---|---|---|
| H1 Die Antwort zuerst | „Muss ich mir Sorgen machen?“ | Satz in der Zeile seiner Stufe | Antwort in 2 Sekunden lesbar, auf dem Handy über der Falz. Aber: Textseite, Messreihen erst ab ca. 950 px, wirkt wie eine beliebige Statusseite. |
| H2 Gerede gegen Messung | „Stimmt das Gerücht?“ | Feld mit vier Zonen, Szenario als Punkt | Gerücht-Fall sofort lesbar. Aber: im Normalzustand leer, ein Streudiagramm verlangt Laien zwei Achsen ab, die Stufe wird zur Nebensache. |
| H3 Konvergenz-Streifen | „Ich will sehen, was die Instrumente zeigen.“ | Eine Spur pro unabhängigem Bereich, gemeinsame Zeitachse, Summe am rechten Rand | Die Zahl der ausschlagenden Spuren **ist** die Stufe. Das Bild erklärt die Methode ohne Text. Die schraffierte Aufmerksamkeits-Spur zeigt den Gerücht-Fall in derselben Bildsprache. Aber: neun Spuren sind auf dem Handy lang, die Zeitachse war in der Skizze noch nicht echt. |

## Auswahl: H3 Konvergenz-Streifen

**Begründung aus dem Render:** H3 ist die einzige Hypothese, deren Bild die Produktwahrheit trägt: ein einzelner
Ausschlag ist Rauschen, mehrere gleichzeitige sind die Warnung. Entfernt man Schrift und Farbe, bleibt die Idee
erkennbar (mehrere Spuren, rechter Rand, Summe). Bei H1 und H2 bleibt dann eine Textseite bzw. ein leeres Feld.
Die Spuren sind zugleich das charakteristische Material: echte Messreihen, kein Dekor.

**Übernommen aus den verworfenen Hypothesen (als Bedienelemente, nicht als Ordnungsidee):**

- aus H1: Der Satz (`verdict`) steht zusammen mit Zahl und Stufe ganz oben und auf dem Handy immer über der Falz.
  Wer nur drei Sekunden hat, liest ihn und geht.
- aus H2: Die Unterscheidung Gerede/Messung bleibt, aber als eigene, anders gezeichnete Spur unter den Mess-Spuren
  („zählt nicht als Beleg“), nicht als zweites Diagramm.

**Verworfen:** H1 als Ordnungsidee (wiederholt das Statusseiten-Muster, Material zu spät). H2 als Ordnungsidee
(leer im Normalfall, zwei Achsen für Laien, verdrängt die Stufe).

**Zielkonflikt, bewusst eingegangen:** H3 ist dichter als H1. Dafür trägt es die Methode. Die Einfachheit kommt
über die Reihenfolge: erst Zahl, Stufe und Satz, dann die Spuren, dann Belege auf Antippen.

## Festgelegte Struktur (vor Tokens eingefroren)

1. **Kopf:** Betriebsart (`demo`, `snapshot`, `live`) und Stand. Bei `demo` und `snapshot` unübersehbar, sachlich.
2. **Szenario-Wahl:** eine Zeile, jedes Szenario mit eigenem Mini-Pegel (0–4), damit alle Stufen auf einen Blick
   sichtbar sind. Funktioniert mit 1 bis 8 Szenarien, auf dem Handy waagerecht verschiebbar.
3. **Aussage:** große Zahl „n von m Bereichen weichen gleichzeitig ab“, Stufe mit Namen, Satz, Vier-Schritt-Pegel
   (1 Bereich höchstens Stufe 1 … ab 4 Stufe 4 möglich). Darunter klein die Frage des Szenarios.
4. **Spuren:** je Bereich eine waagerechte Spur über die letzten 14 Tage (`history[].d[bereich]`), rechter Rand = jetzt,
   Ausschlag-Schwelle als feine Linie bei 0,25, Zustand am Rand („normal“ / „Ausschlag“). Reihenfolge: ausschlagende
   Spuren oben. Darunter die Summenspur „Gleichzeitig“ (`history[].activeDomains`). Getrennt und anders gezeichnet:
   die Spur „Aufmerksamkeit im Netz“ (`history[].attention`), mit dem Hinweis, dass sie nicht als Beleg zählt.
   Bereiche ohne Daten bleiben als leere Spur sichtbar („noch keine Messreihe“), damit Lücken ehrlich sichtbar sind.
5. **Belege:** Antippen einer Spur öffnet ihre Messreihen: Name, Ein-Satz-Erklärung, Wert jetzt, Normalwert,
   Abweichung, Verlauf (`spark` mit `sparkStart`/`sparkEnd`), Dämpfungsgrund falls vorhanden, Link zur Rohdatenquelle.
   Ausschlagende Messreihen stehen ohne Antippen offen.
6. **Fuß:** Vertrauen, Abdeckung („x von y gebauten Messreihen frisch, z weitere im Katalog geplant“,
   „Bereiche mit Daten“), „Keine Wahrscheinlichkeit, keine Vorhersage“, Methode in drei Sätzen, Vorsorge-Hinweis (BBK).

Handy: Zahl, Stufe, Satz und Pegel über der Falz; Spuren kompakt (Name über der Spur, Zustand am rechten Rand);
Belege als ausklappbare Abschnitte. Kein bloßes Stapeln der Desktop-Spalten.

## Richtung für Tokens und Handwerk (nach der Kompositions-Entscheidung)

**Leitbild: Messschreiber.** Papierband eines Schreibers bzw. Seismografen: ruhige Fläche, feines Raster, Tintenspur.
Abgrenzung zur Genre-Gewohnheit „schwarzer Hacker-Leitstand mit Neon“: Die Anzeige soll beruhigen und Vertrauen in
die Messung erzeugen, nicht Bedrohung inszenieren.

- **Farbe ist Signal.** Im Normalzustand ist die Seite nahezu einfarbig (Papier, Graphit). Farbe erscheint nur dort,
  wo etwas abweicht. Stufen-Skala von kühl nach warm, jede Stufe zusätzlich durch Zahl und Wort lesbar (nie nur Farbe).
  Aufmerksamkeit bekommt eine eigene, deutlich andere Farbfamilie und Schraffur.
- **Zwei Fassungen:** hell (Papier) als Standard und dunkel (Nachtschicht) über `prefers-color-scheme`, beide
  gleichwertig ausgearbeitet, gleiche Semantik.
- **Schrift:** keine Fremd-Requests. Selbst gehostete, frei lizenzierte Schrift mit Instrumenten-Charakter für Zahlen
  und Beschriftung (tabellarische Ziffern) plus gut lesbare Grotesk für Sätze; Auswahl im Handwerks-Schritt, Dateien
  per npm-Paket (`@fontsource/...`) beziehen und lokal ablegen, Lizenz in `assets/HERKUNFT.md`.
- **Bewegung:** sparsam und bedeutungstragend. Die Spuren dürfen sich beim Laden einmal von links nach rechts
  zeichnen (Schreiber-Metapher). Kein Blinken, kein Pulsieren im Normalzustand. `prefers-reduced-motion` schaltet alles ab.
- **Bildfrei mit Begründung:** datenlastige Arbeitsfläche, das Material sind die Messreihen. Bildgenerierung ist in
  dieser Umgebung nicht verfügbar; es gibt keinen Bildplan, der dadurch entfällt.

## Grenzen der Erkundung

- **Visuelle Referenz-Recherche (Skill Schritt 2) ist unvollständig:** Es wurden keine echten Referenzseiten oder
  Geräte-Abbildungen angesehen. Die Messschreiber-Richtung stützt sich auf Vorwissen, nicht auf geprüftes Bildmaterial.
- Die Skizzen wurden von einem Builder erstellt, nicht von drei isolierten. Das ist eine geführte Erkundung, kein
  unabhängiger Gleich-Briefing-Test.
- Urteile stammen von Modellen, nicht aus Nutzerforschung.
