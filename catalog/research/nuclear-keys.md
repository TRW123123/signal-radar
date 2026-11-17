# Benötigte Keys, Konten und Bezahlzugänge (Szenario nuclear)

Automatisch erzeugt von `scripts/consolidate_nuclear.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| ENTSO-E Transparency Platform | ENTSO-E: Nichtverfügbarkeit von Kernkraftwerken; ENTSO-E: Erzeugung je Kernkraftwerk; Ukraine: Netz-Lastfluss an der Grenze | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html | `SR_ENTSOE_KEY` | 3 |
| Fingrid Open Data | Finnland: Atomstrom (Fingrid) | free (kostenloser Key/Konto) | https://data.fingrid.fi/en/instructions | `SR_FINGRID_KEY` | 1 |
| FRED series PURANUSDM | IMF-Uranpreis (monatlich, FRED) | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/series/PURANUSDM | `SR_FRED_KEY` | 1 |
| Metaculus API | Metaculus: Fragen zu Nuklearwaffen | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 1 |
| uRADMonitor Data API | uRADMonitor: Sensoren in Europa | free (kostenloser Key/Konto) | https://www.uradmonitor.com/api/ | `SR_URADMONITOR_KEY` | 1 |
