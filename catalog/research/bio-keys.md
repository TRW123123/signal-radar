# Benötigte Keys, Konten und Bezahlzugänge (Szenario bio)

Automatisch erzeugt von `scripts/consolidate_bio.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. FRED), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet. "Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| CMU Delphi Epidata API (FluView, ILINet, Nowcasts) | USA: FluView ILINet und Labor-Positivrate | free (kostenloser Key/Konto) | https://cmu-delphi.github.io/delphi-epidata/ | `SR_DELPHI_EPIDATA_KEY` | 1 |
| FRED: Eier Verbraucherpreis (APU0000708111) | nur Alternativquelle für: poultry_stocks | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/series/APU0000708111 | `SR_FRED_KEY` | 0 |
| GISAID EpiCoV/EpiFlu | GISAID Sequenzzahlen | free (kostenloser Key/Konto) | https://gisaid.org/ | `SR_GISAID_KEY` | 1 |
