# Auftrag: Signal-Katalog eines Szenarios konsolidieren

Arbeitsverzeichnis: /home/claude/signal-radar. Du konsolidierst den Katalog für **ein** Szenario `<S>` (steht im
Auftrag), nach dem Muster der fertigen Szenarien `cyber` und `war`.

Eingaben: `src/core/types.ts` (Schema `SignalDef`), `docs/RESEARCH-BRIEF.md`, `scripts/consolidate_war.py` (Vorlage:
lies sie und übernimm Aufbau, Tabellen-Stil und Selbstprüfung), `catalog/research/<S>-all.json` (Recherche mit
`signals` und `scenario_def`), `catalog/research/github-hosted-datasets.json`, `ls src/collectors/`.

Arbeite token-effizient: Schreibe `scripts/consolidate_<S>.py` (`python3 -I`, nur Standardbibliothek). Dein Urteil
steckt in kleinen Tabellen im Skript. Lies die Recherche-Datei nicht komplett in den Kontext, sondern lass dir kompakte
Übersichten ausgeben.

Ausgaben (nur diese Dateien anlegen, **keine** bestehenden Dateien ändern):
1. `catalog/signals/<S>.json`: Array im `SignalDef`-Format, alle Signale (Duplikate verschmelzen), `scenarios: ["<S>"]`,
   IDs mit Präfix `<S>.`. `domain` nur aus den Domains der `scenario_def` plus `attention` (alles mit Evidenzklasse D)
   und `context` (reine Störfaktor-Filter, Gewicht 0). Gewichts-Rubrik: 0,8–0,9 sehr spezifisch für das Szenario und
   schwer zu fälschen; 0,5–0,7 mäßig spezifisch; 0,2–0,4 generisch (z. B. Gold, VIX); Klasse D 0,3–0,7; Klasse C
   (Aussagen von Behörden, Firmen, Konfliktparteien, auch als CSV) höchstens 0,2. Felder wie im Vorlage-Skript:
   name, plain (deutsch, echte Umlaute, ein Satz für Laien), evidenceClass, direction, kind, manipulability,
   independenceGroup, collector (kebab-case; nutzt das Signal einen vorhandenen Collector, dann dessen Name),
   unit, intervalMinutes, baseline, status (`needs-key`, `license-unclear` oder `planned`), sourceName, sourceUrl,
   license, rationale, banalCauses und die Zusatzfelder endpoint, auth, history, priority, verified, leadTime, format,
   notes, extends.
2. `catalog/research/<S>-scenario-def.json`: der geprüfte Szenario-Eintrag im Format von `catalog/scenarios.json`
   (id, order, title, question und tagline in Alltagssprache, domains mit title, weight, plain; ohne attention/context).
   Höchstens 9 Domains; Domains mit weniger als 3 Signalen einer verwandten Domain zuschlagen.
3. `catalog/<S>-build-order.json`: Rangliste der 20 Collectors, die zuerst gebaut werden. Kriterien in dieser
   Reihenfolge: (a) Quelle auf raw.githubusercontent.com (oder pypi.org / registry.npmjs.org) und als aktuell verifiziert,
   denn nur diese sind in der Bau-Umgebung live prüfbar: Feld `live: true`; (b) Erweiterung eines vorhandenen Collectors:
   Feld `extends: "<collector>"` mit konkreter Angabe, was zu ergänzen ist (Länder, Symbole, Begriffe, Artikel);
   (c) ohne Key, JSON/CSV, Antwort unter 6000 Zeichen, mit Historie; (d) hoher Signalwert. Jede Domain mit mindestens
   2 Einträgen, soweit möglich. Felder pro Eintrag: rank, collector, domain, signals[], endpoints[], format, history,
   verified, live, extends, uncertainty, why.
4. `catalog/research/<S>-sources.json`: deduplizierte Quellen-Matrix dieses Szenarios im Format der Einträge von
   `catalog/sources.json`.
5. `catalog/research/<S>-keys.md` und `catalog/research/<S>-license-todo.md`: Tabellen wie in `docs/KEYS-NEEDED.md`
   bzw. `docs/LICENSE-TODO.md`, nur für dieses Szenario.

Qualitätsregeln: nichts erfinden; unsichere Endpunkte bleiben `verified: false`. Sachlich und neutral. Die
Selbstprüfung im Skript: gültiges JSON, eindeutige IDs (auch gegenüber allen anderen `catalog/signals/*.json`),
jede Domain belegt, jedes Signal hat sourceUrl und collector. `catalog/scenarios.json` nicht ändern.

Antwort an mich, maximal 100 Wörter: Signale gesamt und je Domain, nach Status, die ersten 10 der Bau-Reihenfolge mit
Markierung live/extends, Probleme.
