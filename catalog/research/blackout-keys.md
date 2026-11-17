# Benötigte Keys, Konten und Bezahlzugänge (Szenario blackout)

Automatisch erzeugt von `scripts/consolidate_blackout.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. ENTSO-E, AGSI+), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| GIE AGSI+ (Gasspeicher) | Gasspeicherfüllstand Deutschland; Ausspeicherrate Gasspeicher; Füllstand einzelner Großspeicher | free (kostenloser Key/Konto) | https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf | `SR_AGSI_KEY` | 3 |
| GIE ALSI (LNG-Terminals) | LNG-Tankfüllstand Terminals EU | free (kostenloser Key/Konto) | https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf | `SR_ALSI_KEY` | 1 (+1 als Alternative) |
| Cloudflare Radar API | Outage Center mit Stromausfall-Ursachen (Cloudflare Radar) | free (kostenloser Key/Konto) | https://developers.cloudflare.com/api/resources/radar/ | `SR_CF_RADAR_KEY` | 1 |
| ENTSO-E Transparency Platform | Ungeplante Kraftwerksausfälle (ENTSO-E) | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html | `SR_ENTSOE_KEY` | 1 (+6 als Alternative) |
| Fingrid Open Data (Dataset 177 Frequenz) | nur Alternativquelle für: frequency_cross_check_gb_nordic | free (kostenloser Key/Konto) | https://data.fingrid.fi/en/instructions | `SR_FINGRID_KEY` | 0 (+1 als Alternative) |
| Netztransparenz.de (4 ÜNB) | Regelenergie-Abruf Deutschland; Notfallmaßnahmen nach §13 EnWG; Redispatch-Volumen; Ausgleichsenergiepreis reBAP … | free (kostenloser Key/Konto) | https://www.netztransparenz.de/de-de/Systemdienstleistungen/Betriebsfuehrung/Redispatch | `SR_NETZTRANSPARENZ_KEY` | 3 |
| PowerOutage.us | Stromausfall-Zähler USA (EAGLE-I, PowerOutage.us) | paid (bezahlt) | https://poweroutage.us/ | `SR_POWEROUTAGE_US_KEY` | 1 |
