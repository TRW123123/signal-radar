# Review V2: Globus-Fassung

Stand 24.11.2026. Selbstprüfung des Bauenden, kein unabhängiger Kritiker.

## Geprüft

- **Renders** (`renders/v2/`): 1440, 390 und 320 px; dunkel und hell; echte Daten (Snapshot `--now 2026-11-23T21:33:00Z`
  mit dem zu diesem Zeitpunkt eingetragenen Teil von `catalog/geo.json`) sowie `?demo=acute`, `rumor`, `calm`.
  Alle Bilder angesehen. Globus sichtbar, scharf (Canvas in Gerätepixeln, höchstens 2×) und zentriert; auf dem Handy
  liegt er im ersten Bildschirm (randlos, unter der Antwort). Kontaktbögen: `renders/v2/kontakt-desktop.png`,
  `renders/v2/kontakt-handy.png`.
- **Automatisch** (Playwright, `scripts/shoot.mjs` meldet jetzt auch fremde Hosts und waagerechten Überlauf):
  keine Konsolenfehler oder -warnungen, keine Anfragen an fremde Hosts, kein waagerechter Überlauf bei 320 px
  (echte Daten, acute, rumor, calm, Fehlerzustand `?demo=nichtda`).
- **Bedienung:** Tab erreicht Sprung-Link, DE/EN, Linsen (Pfeiltasten wechseln, Hash wird gesetzt), Ortsliste,
  Weltweit-Einträge. Karte „Was wird hier gemessen?“ öffnet aus Liste, per Mausklick und per Berührung auf dem
  Globus; Escape schließt, Fokus kehrt zurück. Eigendrehung läuft ohne `reduce` und steht mit `reduce`.
  Sprachwahl bleibt nach Neuladen erhalten.
- **Wörter:** Seitentext aller Linsen (echte Daten und acute, alle Klappen offen) enthält keines der verbotenen Wörter.
  Ein Bereichsname aus dem Katalog („Angriffs-Telemetrie“) wird in der Anzeige zu „Angriffs-Messdaten“ umgeschrieben.
- `npm test`: 489 von 489 grün.

## Offene Einwände

1. **Keine drei Skizzen** (siehe ART-DIRECTION-V2.md): die Globus-Wahl ist nicht gegen Alternativen geprüft,
   kein 5-Sekunden-Test mit Laien.
2. **`data/rumors.json` hat ein anderes Format als im Auftrag** (`factcheck`, `outcome` statt `status`, `summary`).
   Die Karten zeigen beides; ohne `status` steht statt der Einstufung die Linse. Ein Abgleich mit den aktuellen
   Messdaten je Gerücht („In den Daten: ruhig“) fehlt, weil die Gerüchte zurückliegende Tage betreffen und der
   Snapshot nur den jetzigen Stand hat (dafür braucht es die Zeitmaschine).
3. **Echte Daten mit wenig Orten:** Stand des Renders 29 von 76 Cyber-Messungen mit Ort; die übrigen 47 stehen unter
   „Weltweit“. Je mehr `catalog/geo.json` füllt, desto voller der Globus. KI-Vorfall hat noch keinen Ort.
4. **Seltenheit:** `rarity.n` zählt Vergleichswerte, nicht Tage; der Text sagt deshalb „1 von 20 Vergleichswerten“
   statt „Vergleichstagen“. Ist der Normalwert noch nicht gelernt, wird die Seltenheit trotzdem genannt, sobald
   mindestens 10 Vergleichswerte vorliegen.
5. **Ungewöhnliche Einzelmessung ohne ungewöhnlichen Bereich** (echte Daten: Zahlungsdienste) leuchtet auf dem Globus,
   während die Antwort „keiner ungewöhnlich“ sagt. Schwelle für das Leuchten: Anteil ≥ 0,25 nach Abschwächung.
   Ein erklärender Satz dazu fehlt noch.
6. **Einzeldatei-Fassung** entfernt (24.11.2026): `scripts/build_single.py` bettete nur `app.js` ein und passte nicht
   mehr zu den ES-Modulen (`js/`, `assets/vendor/`) und dem Atlas-Abruf. `app.js` liest keinen eingebetteten Snapshot mehr.
7. Der Hinweis „Namen nur auf Deutsch“ verschwindet im EN-Modus beim nächsten Neuzeichnen des Kopfs (spätestens nach
   einer Minute).
8. Konsole: Fehlt `data/rumors.json` auf dem Server, meldet der Browser eine 404 in der Konsole (der Abschnitt entfällt
   trotzdem sauber).

## Grenzen

- Nur Chrome (Playwright) geprüft, kein Safari/Firefox, kein echtes Mittelklasse-Handy (Leistung nur durch Aufbau:
  Neuzeichnen nur bei Drehung oder Änderung, Pause außerhalb des Sichtbereichs und bei verborgenem Tab).
- Kontrast nach Augenmaß und Tokenwerten aus V1, nicht gemessen.
- Kein Vorschaubild (Open Graph ohne Bild, wie beauftragt).
