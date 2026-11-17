# Benötigte Keys, Konten und Bezahlzugänge (Szenario finance)

Automatisch erzeugt von `scripts/consolidate_finance.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| Destatis GENESIS-Online | Deutsche Regelinsolvenzen (Frühindikator) | free (kostenloser Key/Konto) | https://www-genesis.destatis.de/datenbank/online | `SR_DESTATIS_KEY` | 1 |
| FRED API (St. Louis Fed) | Fed: sonstige Kredite an Institute; Euro-Banken-Anleihen: Aufschlag; Euro-Hochzins-Aufschlag; Investment-Grade-Aufschlag … | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/docs/api/fred/series_observations.html | `SR_FRED_KEY` | 9 (+4 als Alternative) |
