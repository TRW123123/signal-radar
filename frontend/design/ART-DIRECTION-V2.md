# Art Direction V2: Globus-Fassung

Stand 24.11.2026.

## Entscheidung und Herkunft

Die Komposition (Globus als Hauptbild) hat der Auftraggeber am 24.11.2026 festgelegt (`docs/FRONTEND-V2-BRIEF.md`,
`docs/PLAN-V2.md`). **Diesmal wurden keine drei Skizzen gerendert und verglichen.** Die Schritte 2 bis 4 von
elite-ui-ux (Hypothesen, Skizzen, Auswahl am Render) sind damit übersprungen. Ob eine flache Lagekarte oder
„Gerüchte-Check zuerst“ für Besucher verständlicher wäre, ist ungeprüft.

## Leitgedanke

**Die Erde bei Nacht als ruhige Bühne, Licht nur dort, wo etwas ungewöhnlich ist.**

- Ruhig = gedämpfter grauer Punkt. Ungewöhnlich = leuchtender Punkt in der Stufenfarbe mit weichem Hof.
  Ohne frische Werte = hohler Ring. Länder-Messungen färben das Land leicht ein (ungewöhnlich in Stufenfarbe).
- Im Normalzustand gibt es nichts, das leuchtet. Die einzige Bewegung ist eine langsame Eigendrehung (4° pro Sekunde),
  die bei `prefers-reduced-motion`, verborgenem Tab, Globus außerhalb des Sichtbereichs und für 5 s nach eigener
  Drehung ruht.
- Messungen ohne Ort sind keine zweite Klasse: Gruppe „Weltweit“ neben bzw. unter dem Globus mit derselben Punkt-Logik.

## Aufbau

1. Kopf: Name, Versprechen in einem Satz, DE/EN, Stand der Daten.
2. Bühne: Linsen (Szenarien) als Reihe, darunter links die Antwort in Alltagssprache (große Stufe mit Lämpchen,
   ein Satz), rechts der Globus. Handy: Antwort über dem Globus, Globus randlos auf volle Breite.
3. Weltweit-Gruppe und Ortsliste (gleichwertige Textliste des Globus).
4. Die Regel in einem Bild: ein Lämpchen pro Bereich und eine Treppe mit vier Stufen (Deckelung).
5. Gerede gegen Messung: zwei Zeilen.
6. Gerüchte-Check aus `data/rumors.json` (entfällt ohne Datei).
7. Für Neugierige (eingeklappt): Verlauf je Bereich, alle Messungen mit Rohdaten, So rechnen wir, offizielle
   Meldungen, Vorsorge (BBK), Quellen.

## Material

- Dunkel ist Standard: Nachtgrund `#0a0e13`, Meer `#0e1721`, Land `#243140`, Grenzen sehr leise.
  Hell (über `prefers-color-scheme`): Papiergrund `#f4f1ea`, Meer hellgrau-blau, Land fast weiß, wie ein Papier-Globus.
- Stufenfarben von kühl nach warm aus V1 übernommen (`--l1` bis `--l4`), Aufmerksamkeit behält Violett (`--att`).
- Schriften unverändert: Atkinson Hyperlegible Next für Text, Martian Mono nur für Marke, Werte und Sprachwahl.
- Kein Hacker-Kitsch (kein Raster-Grün, keine Scanlinien, kein Radar-Sweep), kein Alarmrot im Ruhezustand.
