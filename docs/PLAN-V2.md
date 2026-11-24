# Plan V2: Von der Instrumententafel zum Durchbruch

Stand 23.11.2026. Grundlage: Durchsicht der Live-Seite (Desktop und Handy), des Repos (81 Collectors, 258 Signale
mit Daten, 862 im Katalog), des Live-Snapshots und des Backtest-Berichts.

## 1. Befund

**Was steht:** Der Messkern ist solide (Normalwert je Reihe, harmlose Ursachen, Konvergenz, gemeinsame Quellen zählen
einmal). 81 Collectors laufen alle 15 Minuten, 7 Szenarien, Deploy auf Cloudflare.

**Warum es trotzdem nicht in der Liga von God's Eye spielt:**

| Lücke | Beleg |
|---|---|
| Kein Bild der Welt | Signale haben im Schema keinen Ort. Es gibt nichts zu *sehen*, nur Balken und Zahlen. |
| Die Seite beantwortet eine Frage, die niemand stellt | „Wie ungewöhnlich sind die Messwerte?" Besucher kommen mit „Stimmt das Gerücht?" oder „Was ist gerade los?". |
| Zahlen ohne Bedeutung | 0,25, 0,5, „Datenqualität 73 %", „103/108 Abdeckung". Die Schwelle 0,25 ist gesetzt, nicht aus Daten hergeleitet, und nirgends erklärt. |
| Fachsprache | „Messlage", „Telemetrie", „Messreihen", „Ausschlag". |
| Kein Beweis | Der Backtest stammt vom 17.11. vor den Engine-Korrekturen und zeigte keine Vorhersagekraft. Niemand kann sehen, dass das Radar bei einem echten Ereignis angeschlagen hätte. |
| Dünne Szenarien | Pandemie 1 Signal mit Daten, Blackout 8, KI 10. Drei von sieben Szenarien sagen „zu wenig Daten". |
| Nichts zum Teilen | Kein Bild für Social Media, keine Seite pro Gerücht, nur Deutsch, `noindex`. |

## 2. Zielbild

**Ein Satz:** „Gerüchte gibt es viele. Signal Radar zeigt live, ob in den Messdaten der Welt wirklich etwas passiert."

Drei Dinge machen den Unterschied:

1. **Der Globus als Einstieg.** Jede Messung hat einen echten Ort: Internet je Land, Luftalarme, Brände, Erdbeben,
   Meerengen, Stromnetze, Strahlungs-Messstellen. Ruhige Punkte sind grau, ungewöhnliche leuchten. Das Szenario ist
   eine Linse auf denselben Globus. Man versteht ohne Text, was man sieht.
2. **Der Gerüchte-Check.** Pro kursierendem Gerücht eine eigene, teilbare Ansicht: „Im Netz: viel Gerede. In den
   Daten: ruhig." Das ist der Mehrwert, den es sonst nirgends gibt, und der Grund, die Seite weiterzuschicken.
3. **Die Zeitmaschine als Beweis.** Ein Regler spult das Radar durch echte Ereignisse (CrowdStrike-Ausfall,
   Facebook-Ausfall, Eskalationen). Man sieht, wie der Globus damals aufleuchtete. Das ersetzt jede Erklärung.

**Zahlen in Alltagssprache:** Statt „0,25" steht da „ungewöhnlicher als an 19 von 20 Tagen". Die Schwellen werden aus
der eigenen Historie der Daten hergeleitet und auf der Seite mit einem Beispiel gezeigt.

## 3. Arbeitspakete und wer sie macht

Rollen: **Mythos** (ich) orchestriert, entscheidet Produkt und Methode, nimmt ab. **Opus** für Entwurf, Globus,
Engine, unabhängige Kritik. **Sonnet** für Collectors, Anreicherung, Tests, Doku.

| # | Paket | Inhalt | Modell |
|---|---|---|---|
| A | Produkt und Sprache | Ein-Satz-Versprechen, Seitenaufbau, Wörterbuch (jedes Fachwort ersetzt), Texte DE und EN | Mythos, Texte Sonnet |
| B | Orts-Schicht | Schema um `geo` erweitern (Punkt, Land, Region, Route). Collectors liefern Werte je Ort statt einer Summe. Katalog anreichern. | Opus Schema, 4–6 Sonnet parallel je Collector-Gruppe |
| C | Globus-Frontend | Nach elite-ui-ux: drei lauffähige Skizzen (Globus, flache Lagekarte, Gerüchte-Check zuerst), Auswahl am Render, Umsetzung. Ohne Fremd-Server: eigene Kartendaten (Natural Earth, gemeinfrei), Canvas/WebGL, flüssig auf dem Handy. | Opus, Abnahme Mythos |
| D | Schwellen herleiten und erklären | Schwellen je Signal und je Stufe aus der Historie kalibrieren (Ziel: Fehlalarm-Rate festlegen, dann Schwelle ableiten). Erklär-Element „Warum leuchtet das?" an jedem Punkt. | Mythos Methode, Opus Umsetzung |
| E | Zeitmaschine und Beweis | Historische Daten nachladen (über GitHub Actions, dort gibt es Internet), Backtest neu, Ereignis-Wiedergaben fürs Frontend, ehrlicher Bericht: was erkannt, was nicht. | Opus Gerüst, Sonnet Nachlade-Jobs |
| F | Quellen ausbauen | Dünne Szenarien füllen (Pandemie, Blackout, KI), Deutschland-Linse, Ergebnisse der Gemini-Recherche einspielen, tote Quellen ersetzen. | 5–7 Sonnet je Szenario, Konsolidierung Opus |
| G | Gerüchte-Seiten und Teilen | Gerüchte-Register (Datum, Behauptung, zugehörige Signale), Seite je Gerücht, Vorschaubild, Einbett-Widget, EN, Indexierung freigeben. | Sonnet, Texte Mythos |
| H | Offenheit | Jede Zahl bis zur Rohquelle, Methodenseite mit Beispielen, offene Daten-Schnittstelle, README mit Demo-GIF. | Sonnet |

**Reihenfolge:** A → B und D parallel → C → E → F und G parallel → H. Nach C gibt es die erste sichtbar neue Fassung.

**Grenze der Bau-Umgebung:** Meine Cloud-Umgebung hat kein freies Internet. Alles, was echte Daten braucht (Nachladen
von Historie, Prüfen von Endpunkten), läuft als GitHub-Actions-Job im Repo, den ich schreibe und auswerte.

## 4. Verbesserungs-Schleife

Jede Runde hat denselben Ablauf und endet mit einem fertigen, ausgelieferten Stand:

1. **Messen.** Punktekarte neu erheben (siehe unten).
2. **Auswählen.** Die drei Lücken mit der größten Wirkung, nicht mehr.
3. **Bauen.** Höchstens sechs Unteragenten gleichzeitig, jeder mit abgegrenztem Auftrag und eigener Datei.
4. **Prüfen.** Tests, Render auf Desktop und Handy, unabhängiger Kritiker (Opus, hat den Bau nicht gesehen).
5. **Ausliefern.** Commit, Push, Deploy, `PROGRESS.md` aktualisieren. Dann nächste Runde.

**Punktekarte (Ziel in Klammern):**

- 5-Sekunden-Test: Fünf Test-Leser (Agenten mit Laien-Rollen, sehen nur den ersten Bildschirm) sagen, worum es geht (5 von 5)
- Zeit bis zur Antwort auf „Stimmt Gerücht X?" (unter 10 Sekunden, ohne Scrollen)
- Fachwörter ohne Erklärung auf der Startseite (0)
- Szenarien mit Daten in mindestens 3 Bereichen (7 von 7)
- Signale mit Ort (über 70 %)
- Fehlalarm-Rate in ruhigen Zeiträumen (unter 5 % der Zeit ab Stufe 2)
- Wiedergegebene echte Ereignisse, bei denen das Radar anschlägt (mindestens 5, ehrlich ausgewiesen)
- Ladezeit Handy, Zugänglichkeit AA, keine Fremd-Anfragen

Die Schleife läuft, bis das Kontingent aufgebraucht ist. Weil jede Runde ausgeliefert endet, bleibt nie halbe Arbeit liegen.

## 5. Entscheidungen, die ich vorab brauche

1. **Globus als Hauptbild:** ja? (Meine Empfehlung. Alternative: flache Karte, leichter, weniger Wow.)
2. **Push auf `master` mit automatischem Deploy** in jeder Runde: freigegeben?
3. **Englisch zusätzlich zu Deutsch:** ja? (Für Reichweite wie God's Eye nötig.)
4. **Suchmaschinen freigeben** (`noindex` entfernen), sobald die neue Fassung steht?
