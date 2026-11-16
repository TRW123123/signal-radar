# BRIEF — Signal Radar Frontend (nur Fakten)

Skill: `elite-ui-ux` aus `/home/claude/elite-ui-ux-audit/skill/elite-ui-ux/` (Stand des Repos: Commit f8acb28).

## Produkt

Signal Radar ist ein Open-Source-Anomalie-Radar. Es sammelt öffentlich messbare Rohdaten (Messnetze, Register,
Pflichtmeldungen, Marktdaten) und zeigt pro Krisen-Szenario, **wie ungewöhnlich die Messwerte gerade sind**.
Offizielle Aussagen und Medienberichte zählen nicht als Beleg. Der Normalzustand ist „Ruhig“.

Oberflächen-Typ nach Skill Schritt 1: **operative Web-App** (öffentliches Dashboard), keine Marketing-Seite.
Kein Hero, keine Feature-Liste, kein Tutorial vor der eigentlichen Anzeige.

## Publikum und Anlass

1. **Otto Normalverbraucher**, deutschsprachig, meist am Handy. Hat ein Gerücht gehört (aktueller Anlass: die
   „17.-November-Verschwörung“ über einen weltweiten Cyberangriff) und will in wenigen Sekunden wissen, ob die
   Messwerte etwas zeigen. Kennt keine Fachbegriffe.
2. **Skeptische Selbstprüfer**: wollen jede Zahl bis zur Rohdatenquelle nachverfolgen.
3. **Journalisten, Technik-Publikum**: wollen die Methode verstehen und zitieren können.

Wiederkehr: bei jedem neuen Gerücht oder Ereignis. Unterbrechungsrisiko hoch, die Kernaussage muss ohne Scrollen stehen.

## Was die Anzeige leisten muss

- Pro Szenario: Stufe 0–4 (`Ruhig`, `Leicht erhöht`, `Erhöht`, `Hoch`, `Akut`) und ein Satz in Alltagssprache (`verdict`).
- Der Wert ist **keine Wahrscheinlichkeit** und keine Vorhersage. Er sagt, wie stark Messwerte vom eigenen Normalwert abweichen.
- **Konvergenz-Prinzip:** Ein einzelner Ausschlag ist Rauschen. Die Stufe steigt nur, wenn mehrere unabhängige
  Bereiche gleichzeitig abweichen (1 Bereich höchstens Stufe 1, 2 Bereiche höchstens 2, 3 höchstens 3, ab 4 Stufe 4 möglich).
- **Gerede gegen Messung:** Aufmerksamkeit der Öffentlichkeit (`attention`, 0–1) wird getrennt von den Messwerten
  (`score`, 0–1) geführt. `rumorGap` benennt den Unterschied (`talk-no-data`: viel Gerede, Messwerte ruhig;
  `data-no-talk`: Messwerte auffällig, kaum Gerede).
- **Vertrauen** (`confidence`) und Abdeckung (`coverage`: wie viele Signale liefern frische Daten, wie viele sind geplant).
- Bekannte harmlose Ursachen dämpfen einen Ausschlag und werden als Grund genannt (`damp.reason`).
- Jedes Signal: Name, Ein-Satz-Erklärung, aktueller Wert, Normalwert, Abweichung, Verlauf (`spark`), Link zur Rohdatenquelle.
- Szenario-Auswahl: heute 1 Szenario mit Daten (Cyberangriff), weitere folgen (Kriegseskalation, Blackout/Energie,
  KI-Vorfall, Finanzkrise, Nuklear, Pandemie). Die Auswahl muss mit 1 bis 8 Szenarien funktionieren.
- Betriebsart sichtbar: `mode` = `demo` (erfundene Daten), `snapshot` (aufgezeichnete echte Antworten, kein Live-Betrieb), `live`.
- Kein Alarmismus: keine Sirenen-Optik im Normalzustand, keine Schlagzeilen, keine Countdown-Dramaturgie.
- Hinweis für den Ernstfall bleibt sachlich: allgemeine Vorsorge nach Empfehlung des BBK, kein Hamstern.

## Datenvertrag

`frontend/data/snapshot.json`, Typ `Snapshot` in `src/core/types.ts`. Zustands-Beispiele mit erfundenen Daten:
`frontend/data/demo-calm.json`, `demo-rumor.json`, `demo-single.json`, `demo-elevated.json`, `demo-acute.json`
(erzeugt mit `node scripts/demo-snapshot.ts`).

## Zustände

Ruhig (Normalfall), Gerücht ohne Messwerte, ein Bereich, mehrere Bereiche, akut, zu wenig Daten (`confidence < 0.15`),
Laden, Snapshot nicht erreichbar, veraltete Daten (`generatedAt` älter als 3 Stunden im Live-Betrieb).

## Technische Grenzen

- Statisches HTML, CSS, wenig JavaScript, **kein Build-Schritt**, keine Frameworks.
- **Keine externen Anfragen**: keine CDN-Skripte, keine Web-Fonts von Dritten, keine Tracker. Besucher-IP geht an niemanden.
- Läuft ab 320 px Breite, Tastaturbedienung, sichtbarer Fokus, Kontrast AA, `prefers-reduced-motion`.
- Deutsch. Texte in einer zentralen Tabelle, damit später Englisch ergänzt werden kann.

## Material

Keine vorhandenen Marken-Assets, kein Logo, keine Fotos. Bildgenerierung steht in dieser Umgebung nicht zur Verfügung.
Die Oberfläche ist eine datenlastige Arbeitsfläche; das Material sind die Messreihen selbst.

## Offen

- Name und Marke sind vorläufig („Signal Radar“).
- Lizenz und Impressum fehlen noch (Projekt ist vorerst privat).
