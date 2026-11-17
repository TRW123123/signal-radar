# Übergabe-Prompt: Signal Radar weiterrecherchieren

Du übernimmst die Recherche für das Projekt **Signal Radar**. Das Repository ist angehängt oder verlinkt. Lies vor
allem anderen diese Dateien: `README.md`, `PROGRESS.md`, `docs/MASTER-PROMPT.md`, `docs/SCORING.md`,
`docs/RESEARCH-BRIEF.md`, `docs/STATUS.md`, `docs/OPEN-QUESTIONS.md`, `catalog/scenarios.json`.

## Worum es geht

Signal Radar ist ein Open-Source-Frühwarnsystem. Es führt öffentlich messbare Rohdaten zu einem Anomalie-Radar für
große Ereignisse zusammen. Die Leitfrage lautet: **Wenn etwas Großes bevorsteht und niemand es offen sagt, welche
Spuren hinterlässt es trotzdem in öffentlich messbaren Daten?** Es gibt sieben Szenarien: Cyberangriff,
Kriegseskalation, Blackout/Energie, KI-Vorfall, Finanzkrise, Nuklearer Zwischenfall, Pandemie.

## Grundhaltung (verbindlich)

- **Zero Trust in beide Richtungen.** Statements, Pressemitteilungen und Medienberichte gelten nicht als Beleg.
  Sie sind Evidenzklasse C und erscheinen nur als Kontext. Gewertet werden unabhängige Messungen (A) und
  Pflichtmeldungen bzw. Statusseiten (B). Aufmerksamkeit der Masse (D) läuft getrennt. Genauso streng misstraust du
  deinen eigenen Mustern: Jede Idee braucht einen stabilen Normalzustand, bekannte harmlose Ursachen und eine
  Quelle, die von den übrigen Quellen unabhängig ist.
- **Nur passive Beobachtung öffentlicher Daten.** Kein Scannen, keine Exploits, keine Logins umgehen.
- **Keine Personen.** Nur Aggregate oder Daten zu Organisationen, Infrastruktur und Märkten.
- **Sachlich und neutral.** Keine Wertungen zu politischen Akteuren. Beim Nuklear-Szenario keine technischen Details
  zu Waffen, bei Pandemie nichts über öffentliche Meldezahlen hinaus.
- **Nichts erfinden.** Einen Endpunkt, den du nicht selbst abgerufen hast, markierst du mit `"verified": false`.

## Was bisher passiert ist

Die erste Runde lief in einer Umgebung **ohne freien Internetzugang**. Deshalb:

- Der Katalog umfasst 782 Signale (`catalog/signals/*.json`), die Quellen-Matrix ~430 Quellen (`catalog/sources.json`).
  Die meisten Endpunkte stammen aus dem Gedächtnis und sind `verified: false`.
- ~60 Collectors sind gebaut (`src/collectors/`). Nur ein Teil davon ist gegen echte Antworten geprüft; welcher,
  steht im Kopfkommentar unter `VERIFIED:` und in `docs/STATUS.md`.
- Live prüfbar war fast nur `raw.githubusercontent.com`. Gepflegte GitHub-Spiegel sind deshalb besonders wertvoll
  (`catalog/research/github-hosted-datasets.json`).
- Für fünf Szenarien (Blackout, KI, Finanz, Nuklear, Pandemie) sind Katalog und Bau-Reihenfolge
  (`catalog/<szenario>-build-order.json`) fertig. Die Datenanbindung steht dort aber noch ganz am Anfang.
- Ein erstes Backtesting gab es (`backtest/`). Eine Vorhersagekraft ist noch nicht belegt, weil historische Daten fehlen.

**Du hast Internetzugang. Das ist dein großer Vorteil gegenüber der ersten Runde.**

## Deine Aufgaben, in dieser Reihenfolge

Arbeite in Stufen. Liefere nach jeder Stufe eine fertige Datei, bevor du die nächste beginnst. Lieber eine Stufe
vollständig als drei halb.

**Stufe 1: Endpunkte verifizieren.** Nimm die Bau-Reihenfolgen (`catalog/*-build-order.json`) Szenario für
Szenario durch, angefangen bei Cyber und Krieg. Prüfe jeden Endpunkt mit `verified: false`: Rufe ihn auf und halte
fest, ob er antwortet, welches Format zurückkommt, wie groß die Antwort ist, welches Feld den Messwert trägt, ob
historische Werte abrufbar sind (welche Parameter, wie weit zurück), ob ein Key nötig ist und unter welcher Lizenz die
Daten stehen. Falsche URLs korrigierst du. Tote Quellen markierst du und schlägst Ersatz vor.

**Stufe 2: Neue Signale finden.** Suche je Szenario nach Indikatoren, die noch fehlen, besonders nach zweiter und
dritter Ordnung und nach ungewöhnlichen Proxys. Mit „ungewöhnlich" sind messbare Verhaltensänderungen gut
informierter Akteure gemeint, die sich in Aggregaten zeigen, etwa Geschäftsflugzeug-Bewegungen zu „sicheren Häfen"
als Summe. Prüfe zuerst `catalog/signals/<szenario>.json` und `ideas_without_source` in
`catalog/research/*-all.json`, damit du nichts doppelt einträgst. Jede Idee braucht eine konkrete, öffentlich
abrufbare Quelle.

**Stufe 3: GitHub-Spiegel und Historie.** Suche aktuell gepflegte Datensätze auf GitHub, also CSV/JSON in Repos mit
regelmäßigen Commits, und belege sie mit dem Datum ihres letzten Stands. Suche außerdem historische Daten für die
Backtest-Ereignisse in `backtest/events.json` und für `backtest/history-queue.json`: Welche Quelle hätte zum
jeweiligen Zeitpunkt etwas gezeigt, und wie kommt man an die Vergangenheitswerte?

**Stufe 4: Kritik.** Lies `docs/SCORING.md` und die Signal-Deklarationen und benenne konkret, was methodisch
schwach ist: Welche Signale sind zu laut, welche hängen voneinander ab, welche harmlosen Ursachen fehlen in
`catalog/banal-rules.json`? Belege jeden Punkt.

## Ausgabeformat

Liefere je Stufe eine JSON-Datei, die sich mechanisch zusammenführen lässt. Code änderst du nicht, du lieferst Daten.

- Stufe 1 → `verification-<szenario>.json`: `[{ "collector", "signal_ids": [], "endpoint_tested", "status": "ok|moved|dead|needs-key|blocked", "http_status", "format", "response_bytes", "value_field", "history": "wie, wie weit", "license", "correct_endpoint", "notes", "checked_at" }]`
- Stufe 2 → `new-signals-<szenario>.json`, im Signal-Format aus `docs/RESEARCH-BRIEF.md` (Abschnitt Ausgabeformat), IDs nach dem Schema `<szenario>.<domain>.<name>`; als Domains nur die aus `catalog/scenarios.json` plus `attention` und `context`
- Stufe 3 → `github-datasets-add.json` (Format wie `catalog/research/github-hosted-datasets.json`) und `history-sources.json`: `[{ "event_id", "signal_id", "url", "params", "covers_from", "notes" }]`
- Stufe 4 → `method-review.md`, mit Belegen

Zu jeder Datei schreibst du eine kurze Zusammenfassung: Was ist neu, was ist verifiziert, was ist offen.

## Abschluss

Hör erst auf, wenn alle vier Stufen für alle sieben Szenarien erledigt sind oder wenn weitere Suche nur noch
marginal etwas bringt. In dem Fall schreib dazu, warum du aufgehört hast. Ehrliche Lücken sind besser als
erfundene Vollständigkeit.
