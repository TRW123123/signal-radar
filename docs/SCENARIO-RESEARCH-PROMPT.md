# Auftrag: Signal-Recherche für ein ganzes Szenario

Lies zuerst vollständig `docs/RESEARCH-BRIEF.md` (Regeln, Zugriffswege, Ausgabeformat) und halte dich daran.
Zusätzlich gilt:

- **Vorhandenes nutzen:** `ls src/collectors/` zeigt die schon gebauten Collectors. Kann ein Signal durch Erweitern
  eines vorhandenen Collectors bedient werden (andere Länder, Symbole, Suchbegriffe, Artikel), setze im Signal das
  Zusatzfeld `"extends": "<collector>"`. Solche Signale sind besonders günstig und kommen mit `priority: 1`.
- **GitHub-Spiegel zuerst:** `raw.githubusercontent.com` ist die einzige Quelle, die in der Bau-Umgebung live prüfbar
  ist. Suche gezielt nach aktuell gepflegten Datensätzen auf GitHub (siehe auch
  `catalog/research/github-hosted-datasets.json`), prüfe Aktualität per `curl` und setze `verified: true`.
- **Aktuelle Lage:** `catalog/research/scenario-relevance.json` nennt, was das Thema im November 2026 gerade bewegt.
- Sachlich und neutral, keine Wertungen zu politischen Akteuren. Nur passive öffentliche Daten, keine Personen.
- Aussagen von Behörden, Firmen oder Konfliktparteien sind Evidenzklasse C, auch als CSV. Pflichtmeldungen und
  Statusseiten sind B. Messungen Dritter sind A. Aufmerksamkeit ist D.
- `domain`: nutze genau die im Auftrag genannten Domains des Szenarios (plus `attention` für Klasse D und `context`
  für reine Störfaktor-Filter mit Gewicht 0).

Ziel: 50 bis 80 Signale mit konkreten Quellen, über alle Domains verteilt, dazu `ideas_without_source`.
Ausgabe: eine JSON-Datei `catalog/research/<szenario>-all.json` im Format des Briefs, zusätzlich auf oberster Ebene
`"scenario_def"`: ein Vorschlag im Format der Einträge von `catalog/scenarios.json` (id, order, title, question und
tagline in Alltagssprache, domains mit title, weight, plain). JSON am Ende mit `python3 -I -c "import json;json.load(open('<pfad>'))"` prüfen.

Antwort an mich, maximal 120 Wörter: Dateipfad, Anzahl Signale, davon `extends` und davon live verifiziert, die 6 stärksten Signale, Probleme.
