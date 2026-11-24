# Frontend V2: Globus-Fassung (verbindlicher Auftrag)

Entscheidung des Auftraggebers (24.11.2026): **Der Globus ist das Hauptbild.** Vorbild in Verständlichkeit: God's Eye
View (man sieht die Welt und versteht ohne Text, was man sieht). Die bisherige Seite ist eine Instrumententafel für
Eingeweihte; Befund und Zielbild stehen in `docs/PLAN-V2.md` (lesen).

## Besucher und Versprechen

Besucher kommen mit „Stimmt das Gerücht?" oder „Was ist gerade los?". Meist Handy, deutschsprachig, keine Fachkenntnis.
Versprechen in einem Satz (sinngemäß, Wortlaut darf besser werden):
**„Gerüchte gibt es viele. Hier siehst du live, ob in den Messdaten der Welt wirklich etwas passiert."**

## Aufbau (Reihenfolge fest)

1. **Kopf:** Name, ein Satz, Sprache DE/EN, Stand der Daten.
2. **Antwort + Globus (erster Bildschirm, auch auf dem Handy):** Szenario-Linsen als Reihe („Cyberangriff",
   „Krieg", …, jede mit Zustand). Daneben bzw. darüber die Antwort für die gewählte Linse in Alltagssprache
   („Ruhig. 9 Bereiche gemessen, keiner ungewöhnlich."). Der Globus zeigt die Messungen der Linse an ihrem echten Ort:
   ruhig = gedämpfter Punkt, ungewöhnlich = leuchtet in Stufenfarbe, ohne Daten = hohler Ring. Länder-Messungen dürfen
   das Land einfärben. Ziehen dreht, langsame Eigendrehung im Ruhezustand (aus bei `prefers-reduced-motion`),
   Antippen eines Punkts öffnet die Karte „Was wird hier gemessen?".
3. **Messungen ohne Ort** (weltweite Zählungen, Märkte): als eigene, klar benannte Gruppe „Weltweit" am Globus-Rand
   bzw. darunter, gleiche Punkt-Logik, gleiche Karte beim Antippen.
4. **Die Regel in einem Bild:** eine Reihe Lämpchen, eins pro Bereich (`domains`), mit dem Satz
   „Eine einzelne Auffälligkeit ist normal. Erst wenn mehrere unabhängige Bereiche gleichzeitig ungewöhnlich sind,
   steigt die Stufe." Die Deckelung sichtbar machen (1 Bereich → höchstens Stufe 1 … ab 4 → Stufe 4 möglich).
5. **Gerede gegen Messung:** zwei Zeilen: „Im Netz: …" (aus `attention`) und „In den Daten: …" (aus `score`/`level`).
6. **Gerüchte-Check:** Karten aus `data/rumors.json` (wird parallel erstellt; Format:
   `[{ id, title, claim, date, scenario, status: "kein Beleg in den Daten"|"teilweise"|"offen", summary, sources:[{title,url}] }]`).
   Fehlt die Datei oder ist sie leer, entfällt der Abschnitt ohne Lücke.
7. **Für Neugierige (eingeklappt):** die bisherigen Zeit-Spuren je Bereich, alle Messungen mit Rohdaten-Link,
   „So rechnen wir" mit Beispielen, Vorsorge-Hinweis (BBK), Quellen-Nennung (bestehende Attribution übernehmen).

## Karte „Was wird hier gemessen?" (pro Messung)

Name, der Ein-Satz-Text (`plain`), Wert jetzt und „normal ist etwa …" (`baseline.center`), **Seltenheit in
Alltagssprache aus `rarity`** (`share` = Anteil der letzten `n` Vergleichswerte, die mindestens so weit vom Normalwert
lagen): z. B. share 0,05 → „So stark wie etwa an 1 von 20 Vergleichstagen", share 0 → „So stark wie noch nie in den
letzten n Messungen", share > 0,3 → „Ganz gewöhnlich". Verlauf (`spark`), ggf. „Zählt weniger, weil: …" (`damp.reason`),
Art der Quelle in Alltagssprache, Link zur Rohquelle.

## Sprache (Pflicht)

Verboten auf der Seite: Telemetrie, Messlage, Messreihe, Ausschlag, Score, Baseline, z-Wert, Evidenzklasse, Konvergenz,
Domäne, nackte Zahlen wie 0,25 oder 0,5 ohne Satz. Ersetzen: Messreihe → „Messung", Bereich bleibt „Bereich",
Ausschlag → „ungewöhnlich", Datenqualität/Vertrauen → „So viel können wir gerade messen: x von y Messungen liefern
frische Werte". Stufen: 0 „Ruhig", 1 „Einzelne Auffälligkeit", 2 „Mehrere Auffälligkeiten", 3 „Deutliche Häufung",
4 „Starke Häufung" (die Engine liefert `level` 0–4; `levelLabel`/`verdict` der Engine nicht anzeigen, eigene Texte
aus `level`, `activeDomains`, `rumorGap`, `coverage` bilden; bei `coverage.domainsWithData < 3`: „Hier messen wir
noch zu wenig für eine Aussage").
Oberflächen-Texte zweisprachig (DE Standard, EN umschaltbar, Wahl in `localStorage` mit try/catch). Daten-Texte
(Signal-Namen, `plain`) kommen vorerst nur deutsch aus dem Snapshot; im EN-Modus so anzeigen und einmalig darauf hinweisen.

## Technik (Pflicht)

- Statisch, **kein Build, kein Framework**. ES-Module. Dateien: `frontend/index.html`, `app.css`, `app.js`, weitere
  Module unter `frontend/js/` erlaubt.
- Globus mit **d3-geo auf Canvas** (orthografische Projektion), Kartendaten Natural Earth über `world-atlas`
  (`countries-110m.json`, TopoJSON, gemeinfrei). Bibliotheken liegen entpackt unter `/tmp/vend/` (`d3-geo`, `d3-array`,
  `topojson-client`, `world-atlas`): die benötigten Dateien nach `frontend/assets/vendor/` kopieren (ESM bevorzugt;
  d3-geo importiert `d3-array`: Importpfade per Import-Map in `index.html` oder durch Anpassen der Import-Zeile lösen),
  Lizenzen in `frontend/assets/HERKUNFT.md` nachtragen. Länder-Zuordnung über ISO-Nummern in world-atlas
  (`id` = ISO 3166-1 numerisch) zu `geo.cc` (alpha-2): kleine Zuordnungstabelle für die vorkommenden Länder.
- **Keine fremden Anfragen** außer dem bestehenden Snapshot-Abruf von `raw.githubusercontent.com` (CSP in
  `index.html` beibehalten; kein Inline-Script, kein Inline-Style-Attribut, das die CSP verletzt).
- Datenvertrag: `frontend/data/snapshot.json`, Typ `Snapshot` in `src/core/types.ts`. Neu: `SignalView.geo`
  (`{lat, lon, label, kind, cc?}`, fehlt bei weltweiten Messungen) und `SignalView.rarity`. Die Orts-Zuordnung
  (`catalog/geo.json`) wird parallel befüllt: Entwickle gegen `/tmp/s.json`-artige Daten, indem du dir mit
  `node src/cli.ts snapshot --data data --now 2026-11-23T21:33:00Z --out frontend/data/snapshot.json` jederzeit einen
  frischen Snapshot aus echten Daten baust (zeigt die Orte, die bis dahin eingetragen sind). Für leuchtende Zustände
  gibt es `node scripts/demo-snapshot.ts` (Demo-Dateien `frontend/data/demo-*.json`, Aufruf `?demo=acute`); erweitere
  das Skript so, dass die Demo-Signale `geo` und `rarity` tragen (verschiedene Orte auf mehreren Kontinenten,
  zwei ohne Ort).
- Bestehendes Laden (Remote-Snapshot mit Fallback, Demo-Parameter, Fehler-, Lade-, Veraltet-Zustand, Hash je
  Szenario) erhalten. Alte Module, die nicht mehr gebraucht werden, löschen.
- Leistung: Globus flüssig auf einem Mittelklasse-Handy (Canvas in Gerätepixeln begrenzen, nur bei Änderung oder
  Drehung neu zeichnen, Drehung pausiert außerhalb des Sichtbereichs und bei verborgenem Tab).
- Zugänglichkeit: Tastatur (Linsen, Punkte als Liste erreichbar: der Globus hat eine gleichwertige Textliste der
  Orte mit Zustand), sichtbarer Fokus, Kontrast AA, 320 px ohne waagerechtes Scrollen, `prefers-reduced-motion`.
- `robots`: `noindex` entfernen (Freigabe liegt vor), sinnvolle `<title>`/Beschreibung/Open-Graph-Angaben setzen
  (ohne Bild-URL, das Vorschaubild folgt später).

## Gestaltung

Skill `elite-ui-ux` (`/home/claude/elite-ui-ux-audit/skill/elite-ui-ux/SKILL.md`, Schritte 5 bis 7 und die dort
genannten Referenzen für Handwerk, Bewegung, Leitplanken). Die Kompositions-Entscheidung (Globus) hat der Auftraggeber
getroffen; halte das in `frontend/design/ART-DIRECTION-V2.md` fest, ehrlich mit dem Hinweis, dass diesmal keine drei
Skizzen gerendert wurden. Leitgedanke: **die Erde bei Nacht als ruhige Bühne, Licht nur dort, wo etwas ungewöhnlich
ist.** Dunkle Fassung als Standard (Globus wirkt dort), helle Fassung über `prefers-color-scheme` gleichwertig.
Vorhandene Schriften (Atkinson Hyperlegible Next, Martian Mono) und die Stufenfarben von kühl nach warm dürfen bleiben;
Aufmerksamkeit behält ihre eigene Farbfamilie. Kein Hacker-Kitsch, kein Alarmismus im Normalzustand, keine
Deko-Animation ohne Bedeutung. Der erste Bildschirm darf beeindrucken.

## Prüfung und Abgabe

- Rendern mit `scripts/shoot.mjs` (Server `node scripts/serve.ts frontend 4173 &`; Playwright unter
  `/opt/npm-tools/node_modules/playwright`, Chrome `/usr/bin/google-chrome`, `--no-sandbox`; für WebGL-freies
  Canvas reicht das): Desktop 1440 und Handy 390 und 320, dunkel und hell, echte Daten und `?demo=acute`,
  `?demo=rumor`, `?demo=calm`. Bilder selbst ansehen und nachbessern, bis nichts überläuft und der Globus sichtbar,
  scharf und zentriert ist.
- Automatisch prüfen: keine Konsolenfehler, keine Anfragen an fremde Hosts außer raw.githubusercontent.com,
  kein waagerechter Überlauf bei 320 px, Tastatur erreicht Linsen und Ortsliste.
- Zwei Kontaktbögen (je höchstens 1600×1400): `frontend/design/renders/v2/kontakt-desktop.png` (echte Daten dunkel,
  daneben demo=acute) und `kontakt-handy.png` (calm, rumor, acute, hell).
- `frontend/design/REVIEW-V2.md`: was geprüft ist, offene Einwände, Grenzen.
- `npm test` muss grün bleiben. Nur `frontend/`, `scripts/demo-snapshot.ts`, `scripts/shoot.mjs` anfassen. Kein git commit.

Antwort an den Orchestrator, höchstens 120 Wörter: Pfade der Kontaktbögen, Prüfergebnis, offene Einwände.
