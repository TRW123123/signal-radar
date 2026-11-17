# Benötigte Keys, Konten und Bezahlzugänge (Szenario cyber)

Automatisch erzeugt von `scripts/consolidate_cyber.py`. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet. Der Link führt auf die Doku-Seite der Quelle; die Anmeldung ist dort verlinkt. "Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key. Die Spalte „Stand“ ist der Bearbeitungsstand der Zugänge (17.11.2026), ohne Key-Werte. Die Zuordnung liegt in `scripts/key_stand.py`. Kanonisch sind die Namen aus dem Code und den GitHub-Secrets (z. B. `SR_CLOUDFLARE_KEY`, nicht der frühere Generator-Name `SR_CF_RADAR_KEY`). ThreatFox, URLhaus und MalwareBazaar teilen sich `SR_ABUSECH_KEY`; für NASA FIRMS gilt `SR_FIRMS_KEY` (der Workflow setzt zusätzlich den Alias `SR_NASA_FIRMS_KEY`).

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| AbuseIPDB | nur Alternativquelle für: new_ddos_botnet_ips | free (kostenloser Key/Konto) | https://docs.abuseipdb.com/ | `SR_ABUSE_IPDB_KEY` | 0 (+1 als Alternative) | offen |
| Adzuna API | nur Alternativquelle für: incident_response_postings | free (kostenloser Key/Konto) | https://developer.adzuna.com/ | `SR_ADZUNA_KEY` | 0 (+1 als Alternative) | offen |
| AGSI+ Gas Infrastructure Europe | Gasspeicher-Füllstand und Ausspeicherung | free (kostenloser Key/Konto) | https://agsi.gie.eu/api | `SR_AGSI_KEY` | 1 | angelegt 17.11.2026 |
| aisstream.io | AIS-Positionssprünge; Hafenstau; Kabelleger und Schiffsaggregate | free (kostenloser Key/Konto) | https://aisstream.io/documentation | `SR_AISSTREAM_KEY` | 3 | offen |
| Alpha Vantage | nur Alternativquelle für: cyber_etf_volume, cdn_cloud_stress | free (kostenloser Key/Konto) | https://www.alphavantage.co/documentation/ | `SR_ALPHAVANTAGE_KEY` | 0 (+2 als Alternative) | offen |
| ALSI+ LNG Storage | LNG-Terminal Send-out | free (kostenloser Key/Konto) | https://alsi.gie.eu/api | `SR_ALSI_KEY` | 1 | angelegt 17.11.2026 |
| Bundesagentur für Arbeit Jobsuche API | Stellenanzeigen Incident Response | free (kostenloser Key/Konto) | https://jobsuche.api.bund.dev/ | `SR_BUNDESAGENTUR_JOBSUCHE_KEY` | 1 | offen |
| Censys Search/Open Data | Exponierte OT-Protokolle; Exponierte Dienste (Trend) | free (kostenloser Key/Konto) | https://search.censys.io/api | `SR_CENSYS_KEY` | 2 | offen |
| Cloudflare Radar API | SERVFAIL-Rate (Resolver); DNSSEC-Validierungsfehler; DNS-Verkehr und NXDOMAIN-Anteil; Ranking-Volatilität der Top-Domains … | free (kostenloser Key/Konto) | https://developers.cloudflare.com/radar/ | `SR_CLOUDFLARE_KEY` (Generator-Name `SR_CF_RADAR_KEY`) | 15 (+5 als Alternative) | angelegt 17.11.2026 |
| CoinGecko API | nur Alternativquelle für: stablecoin_peg_deviation, bitcoin_vs_gold_divergence | free (kostenloser Key/Konto) | https://docs.coingecko.com/ | `SR_COINGECKO_KEY` | 0 (+2 als Alternative) | offen |
| DB API Marketplace Timetables / StaDa | nur Alternativquelle für: db_cancellation_rate | free (kostenloser Key/Konto) | https://developers.deutschebahn.com/db-api-marketplace/apis/ | `SR_DB_TIMETABLES_KEY` | 0 (+1 als Alternative) | offen |
| Downdetector | Mobilfunk-Störungsmeldungen; Crowd-Störungsmeldungen Strom DE; Bahnfunk-Störungen | paid (bezahlt) | https://downdetector.com/ | `SR_DOWNDETECTOR_KEY` | 3 (+2 als Alternative) | offen |
| US EIA Open Data (Hourly Electric Grid Monitor) | US Last je Balancing Authority | free (kostenloser Key/Konto) | https://www.eia.gov/opendata/ | `SR_EIA_KEY` | 1 | angelegt 17.11.2026 |
| ENTSO-E Transparency Platform | Ungeplante Kraftwerksausfälle EU; Grenzüberschreitende Stromflüsse | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/ | `SR_ENTSOE_KEY` | 2 (+2 als Alternative) | wartet auf Freischaltung (API-Zugang per Mail beantragt) |
| FAA NOTAM API | NOTAMs zu GPS-Ausfall | free (kostenloser Key/Konto) | https://api.faa.gov/s/ | `SR_FAA_NOTAM_KEY` | 1 | offen |
| FlightAware AeroAPI | Flugausfallquote | paid (bezahlt) | https://www.flightaware.com/commercial/aeroapi/ | `SR_FLIGHTAWARE_KEY` | 1 | offen |
| FRED API (St. Louis Fed) | St. Louis Financial Stress Index | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/docs/api/fred/ | `SR_FRED_KEY` | 1 (+4 als Alternative) | angelegt 17.11.2026 |
| GitHub Advisory Database | Security-Meldungen in großen Repos | free (kostenloser Key/Konto) | https://github.com/github/advisory-database | `SR_GHSA_KEY` | 1 (+2 als Alternative) | offen |
| GitHub REST API | Commit-Zeitmuster in öffentlichen Security-Repos | free (kostenloser Key/Konto) | https://docs.github.com/en/rest | `SR_GITHUB_REST_KEY` | 1 | offen |
| GreyNoise Community/Trends | GreyNoise Scanner je CVE-Tag; GreyNoise Gesamt-Rauschen | free (kostenloser Key/Konto) | https://docs.greynoise.io/ | `SR_GREYNOISE_KEY` | 2 (+2 als Alternative) | offen |
| StatusGator / IsDown (Aggregation von Statusseiten) | Crowd-Störungsmeldungen (Downdetector-Ersatz) | paid ab ca. 20 USD/Monat (bezahlt) | https://statusgator.com/ | `SR_ISDOWN_STATUSGATOR_KEY` | 1 | offen |
| abuse.ch MalwareBazaar | Wiper-/Zerstörungs-Malware-Meldungen; MalwareBazaar Samples pro Tag | free (teilweise Konto) | https://bazaar.abuse.ch/api/ | `SR_ABUSECH_KEY` (gemeinsam für ThreatFox, URLhaus, MalwareBazaar) | 1 | angelegt 17.11.2026 |
| Metaculus API | nur Alternativquelle für: metaculus_manifold | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 0 (+1 als Alternative) | offen |
| Metasploit Framework Commits/Releases | Metasploit neue Exploit-Module | free (kostenloser Key/Konto) | https://github.com/rapid7/metasploit-framework | `SR_METASPLOIT_COMMITS_KEY` | 1 | offen |
| M-Lab NDT (BigQuery/Open Data) | M-Lab Durchsatz und Verlust | free (kostenloser Key/Konto) | https://www.measurementlab.net/data/ | `SR_MLAB_KEY` | 1 | offen |
| Microsoft Graph serviceAnnouncement (M365 Service Health) | nur Alternativquelle für: saas_identity_m365 | free (kostenloser Key/Konto) | https://learn.microsoft.com/graph/api/serviceannouncement-list-issues | `SR_MS_GRAPH_SERVICE_HEALTH_KEY` | 0 (+1 als Alternative) | offen |
| ProjectDiscovery nuclei-templates | Nuclei-Templates für neue CVEs | free (kostenloser Key/Konto) | https://github.com/projectdiscovery/nuclei-templates | `SR_NUCLEI_TEMPLATES_KEY` | 1 | offen |
| NVD CVE API 2.0 | Anteil kritischer CVEs (CVSS >= 9) | free (kostenloser Key/Konto) | https://nvd.nist.gov/developers/vulnerabilities | `SR_NVD_KEY` (Generator-Name `SR_NVD_CVE_API_KEY`) | 1 (+1 als Alternative) | angelegt 17.11.2026 |
| OpenINTEL | DNS-Abhängigkeiten großer Anbieter | free (kostenloser Key/Konto) | https://www.openintel.nl/ | `SR_OPENINTEL_KEY` | 1 (+1 als Alternative) | offen |
| OpenSky States | Gleichzeitige Flugzeug-Bodenstopps / Flugausfälle; Flugbewegungen Aggregat; ADS-B Abdeckungsverlust | free (teilweise Konto) | https://openskynetwork.github.io/opensky-api/rest.html | `SR_OPENSKY_KEY` | 2 (+2 als Alternative) | gesperrt bis Lizenz (Anfrage 17.11.2026) |
| AlienVault OTX | nur Alternativquelle für: wiper_reports, ics_malware, threatfox_ioc_volume | free (kostenloser Key/Konto) | https://otx.alienvault.com/api | `SR_OTX_KEY` | 0 (+3 als Alternative) | offen |
| PhishTank | nur Alternativquelle für: openphish_volume | free (kostenloser Key/Konto) | https://phishtank.org/developer_info.php | `SR_PHISHTANK_KEY` | 0 (+1 als Alternative) | offen |
| Polygon.io Options | Optionsaktivität auf Cyber- und Cloud-Werte | free (kostenloser Key/Konto) | https://polygon.io/docs/options | `SR_POLYGON_KEY` | 1 | offen |
| PowerOutage.us | US Stromausfälle (Kunden ohne Strom) | Daten-API kostenpflichtig, unklar (teilweise Konto) | https://poweroutage.us/ | `SR_POWEROUTAGE_US_KEY` | 1 | offen |
| ransomware.live API | Gleichzeitige Opferdichte; Leak-Opfer in kritischer Infrastruktur; Ransomware-Leak-Posts pro Tag; Leak-Opfer in Deutschland … | free (teilweise Konto) | https://www.ransomware.live/api | `SR_RANSOMWARE_LIVE_KEY` | 0 | offen |
| Reddit about.json | Reddit r/sysadmin Aktivität | free (kostenloser Key/Konto) | https://www.reddit.com/dev/api/ | `SR_REDDIT_JSON_KEY` | 1 | offen |
| SAM.gov Opportunities API | SAM.gov Justification-Notices (ohne Wettbewerb) | free (kostenloser Key/Konto) | https://open.gsa.gov/api/get-opportunities-public-api/ | `SR_SAM_GOV_KEY` | 1 | offen |
| Shadowserver Dashboard / API | Offene DDoS-Reflektoren; Shadowserver exponierte verwundbare Hosts; Abbau verwundbarer Hosts | free (kostenloser Key/Konto) | https://dashboard.shadowserver.org/ | `SR_SHADOWSERVER_KEY` | 1 (+1 als Alternative) | offen |
| Shodan Trends / Search API | nur Alternativquelle für: exposed_ot_protocols, shodan_exposed_service_trend, vulnerable_host_decay | ab ca. 49 USD einmalig/Monat, unklar (bezahlt) | https://developer.shodan.io/api | `SR_SHODAN_KEY` | 0 (+3 als Alternative) | offen |
| Space-Track.org API | Satellitenzerfall und Anomalien | free (kostenloser Key/Konto) | https://www.space-track.org/documentation | `SR_SPACE_TRACK_KEY` | 1 (+1 als Alternative) | offen |
| Tankerkönig API | Tankstellen-Ausfälle | free (kostenloser Key/Konto) | https://creativecommons.tankerkoenig.de/ | `SR_TANKERKOENIG_KEY` | 1 | offen |
| VirusTotal Public API | VirusTotal Einreichungsstatistik | free (kostenloser Key/Konto) | https://docs.virustotal.com/reference/overview | `SR_VIRUSTOTAL_KEY` | 1 | offen |
| VulnCheck KEV | nur Alternativquelle für: kev_additions_rate | free (kostenloser Key/Konto) | https://vulncheck.com/kev | `SR_VULNCHECK_KEV_KEY` | 0 (+1 als Alternative) | offen |
| WhoisDS Newly Registered Domains | Neu registrierte Domains mit Krisenbegriffen | free (kostenloser Key/Konto) | https://www.whoisds.com/newly-registered-domains | `SR_WHOISDS_KEY` | 1 (+1 als Alternative) | offen |
| SEC EDGAR | User-Agent mit Kontaktangabe (Fair Access, kein API-Key) | frei (User-Agent Pflicht) | https://www.sec.gov/edgar/search/ | `SR_SEC_USER_AGENT` | Collector `sec-edgar` | angelegt 17.11.2026 |
| abuse.ch ThreatFox | ThreatFox IOC-Volumen (Collector `threatfox`) | free (kostenloser Key/Konto) | https://threatfox.abuse.ch/api/ | `SR_ABUSECH_KEY` (gemeinsam für ThreatFox, URLhaus, MalwareBazaar) | Collector vorhanden | angelegt 17.11.2026 |

## Szenario Kriegseskalation

Automatisch erzeugt von `scripts/consolidate_war.py`. Gleiche Spalten wie oben; Dienste, die schon im Cyber-Abschnitt stehen, nutzen dieselbe Umgebungsvariable.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| ACLED API | ACLED: Ereignisse und Todesopfer pro Woche | free (kostenloser Key/Konto) | https://acleddata.com/acled-api-documentation | `SR_ACLED_KEY` | 1 | Konto angelegt 17.11.2026, Login per E-Mail+Passwort (kein Key), Collector fehlt |
| AGSI+ Gas Infrastructure Europe | EU-Gasspeicher-Füllstand | free (kostenloser Key/Konto) | https://agsi.gie.eu/api | `SR_AGSI_KEY` | 1 | angelegt 17.11.2026 |
| AISHub / MarineTraffic / Datalastic AIS | nur Alternativquelle für: hormuz_transits, baltic_dark_vessels | free (kostenloser Key/Konto) | https://www.aishub.net/api | `SR_AISHUB_KEY` | 0 (+2 als Alternative) | offen |
| aisstream.io | nur Alternativquelle für: baltic_ais_traffic | free (kostenloser Key/Konto) | https://aisstream.io/documentation | `SR_AISSTREAM_KEY` | 0 (+1 als Alternative) | offen |
| alerts.in.ua API | nur Alternativquelle für: ua_air_alerts, baltic_drone_warnings | free (kostenloser Key/Konto) | https://devs.alerts.in.ua/ | `SR_ALERTS_IN_UA_KEY` | 0 (+2 als Alternative) | offen |
| ALSI+ LNG Storage | LNG-Terminal-Sendout und Füllstand | free (kostenloser Key/Konto) | https://alsi.gie.eu/api | `SR_ALSI_KEY` | 1 (+1 als Alternative) | angelegt 17.11.2026 |
| Baltic Exchange (BDI, BDTI, BCTI) | Baltic Dry und Tankerraten | Index-Daten kostenpflichtig, BDI-Schlusswert oeffentlich (bezahlt) | https://www.balticexchange.com/ | `SR_BALTIC_EXCHANGE_KEY` | 1 | offen |
| Cloudflare Radar API | Datenverkehr je Land und Netz (Mobilfunk, Rechenzentren) | free (kostenloser Key/Konto) | https://developers.cloudflare.com/radar/ | `SR_CLOUDFLARE_KEY` (Generator-Name `SR_CF_RADAR_KEY`) | 1 (+7 als Alternative) | angelegt 17.11.2026 |
| Copernicus Data Space (Sentinel-1/2 STAC/OData) | Satellitenbilder Flugplätze | free (kostenloser Key/Konto) | https://documentation.dataspace.copernicus.eu/APIs.html | `SR_COPERNICUS_CDSE_KEY` | 1 | offen |
| DIP Bundestag API | nur Alternativquelle für: mobilization_registers | free (kostenloser Key/Konto) | https://dip.bundestag.de/%C3%BCber-dip/hilfen/api | `SR_DIP_BUNDESTAG_KEY` | 0 (+1 als Alternative) | offen |
| US EIA Open Data (Hourly Electric Grid Monitor) | US-Strategische Ölreserve und Lager | free (kostenloser Key/Konto) | https://www.eia.gov/opendata/ | `SR_EIA_KEY` | 1 (+1 als Alternative) | angelegt 17.11.2026 |
| ENTSO-E Transparency Platform | Stromflüsse Ukraine, Baltikum, Moldau (ENTSO-E) | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/ | `SR_ENTSOE_KEY` | 1 (+1 als Alternative) | wartet auf Freischaltung (API-Zugang per Mail beantragt) |
| FAA NOTAM API | Luftraum-Beschränkungen (NOTAM) an Brennpunkten | free (kostenloser Key/Konto) | https://api.faa.gov/s/ | `SR_FAA_NOTAM_KEY` | 1 (+1 als Alternative) | offen |
| UN Comtrade / Eurostat Munition Handel | Munitions-Außenhandel | free (kostenloser Key/Konto) | https://comtradeapi.un.org/ | `SR_FR_AIS_KEY` | 1 | offen |
| FRED API (St. Louis Fed) | OVX Öl-Volatilität; Inflationserwartung (Breakeven); Kreditspreads Unternehmensanleihen; US-Rendite 10 Jahre | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/docs/api/fred/ | `SR_FRED_KEY` | 4 (+10 als Alternative) | angelegt 17.11.2026 |
| Global Fishing Watch APIs (Events/4Wings) | AIS-Abschaltungen Golfregion; Dunkle Schiffe Ostsee | free (kostenloser Key/Konto) | https://globalfishingwatch.org/our-apis/ | `SR_GFW_KEY` | 2 (+1 als Alternative) | offen |
| Metaculus API | nur Alternativquelle für: prediction_markets_war | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 0 (+1 als Alternative) | offen |
| NASA FIRMS Area API | Hitzepunkte Golf-Energieanlagen; Hotspots Korea (Grenze); Satelliten-Hitzepunkte an Energie- und Militäranlagen; Wärmequellen entlang der Front … | free (kostenloser Key/Konto) | https://firms.modaps.eosdis.nasa.gov/api/area/ | `SR_FIRMS_KEY` (Alias `SR_NASA_FIRMS_KEY`) | 5 | angelegt 17.11.2026 |
| OpenSky States | Luftraumsperrungen und Flugstreichungen in Konfliktregionen; Evakuierungs- und Rückholflüge (Sonderflüge) | free (kostenloser Key/Konto) | https://openskynetwork.github.io/opensky-api/rest.html | `SR_OPENSKY_KEY` | 0 (+6 als Alternative) | gesperrt bis Lizenz (Anfrage 17.11.2026) |
| Google Places API (Live-Auslastung) | Pizza-Index: Lieferandrang an Militärstandorten (schwache Idee) | kostenpflichtig (bezahlt) | https://developers.google.com/maps/documentation/places/web-service/overview | `SR_PLACES_API_KEY` | 1 | offen |
| ReliefWeb API v2 | ReliefWeb: Lagemeldungen je Land und Tag; Schulschließungen in Konfliktgebieten | free (kostenloser Key/Konto) | https://apidoc.reliefweb.int/ | `SR_RELIEFWEB_KEY` | 2 | offen |
| SAM.gov Opportunities API | nur Alternativquelle für: defense_procurement | free (kostenloser Key/Konto) | https://open.gsa.gov/api/get-opportunities-public-api/ | `SR_SAM_GOV_KEY` | 0 (+1 als Alternative) | offen |
| Space-Track.org API | nur Alternativquelle für: sat_maneuvers | free (kostenloser Key/Konto) | https://www.space-track.org/documentation | `SR_SPACE_TRACK_KEY` | 0 (+1 als Alternative) | offen |
| UCDP Candidate Events API | UCDP Candidate Events: Todesopfer je Land | free (kostenloser Key/Konto) | https://ucdp.uu.se/apidocs/ | `SR_UCDP_KEY` | 1 (+1 als Alternative) | offen |
| IRIS/CTBTO IMS Infraschall (IDC, vDEC) | nur Alternativquelle für: explosions | free (kostenloser Key/Konto) | https://www.ctbto.org/our-work/international-monitoring-system | `SR_USGS_INFRASOUND_KEY` | 0 (+1 als Alternative) | offen |


<!-- szenario:blackout -->
## Szenario blackout


Automatisch erzeugt von `scripts/consolidate_blackout.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. ENTSO-E, AGSI+), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| GIE AGSI+ (Gasspeicher) | Gasspeicherfüllstand Deutschland; Ausspeicherrate Gasspeicher; Füllstand einzelner Großspeicher | free (kostenloser Key/Konto) | https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf | `SR_AGSI_KEY` | 3 | angelegt 17.11.2026 |
| GIE ALSI (LNG-Terminals) | LNG-Tankfüllstand Terminals EU | free (kostenloser Key/Konto) | https://www.gie.eu/transparency-platform/GIE_API_documentation_v007.pdf | `SR_ALSI_KEY` | 1 (+1 als Alternative) | angelegt 17.11.2026 |
| Cloudflare Radar API | Outage Center mit Stromausfall-Ursachen (Cloudflare Radar) | free (kostenloser Key/Konto) | https://developers.cloudflare.com/api/resources/radar/ | `SR_CLOUDFLARE_KEY` (Generator-Name `SR_CF_RADAR_KEY`) | 1 | angelegt 17.11.2026 |
| ENTSO-E Transparency Platform | Ungeplante Kraftwerksausfälle (ENTSO-E) | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html | `SR_ENTSOE_KEY` | 1 (+6 als Alternative) | wartet auf Freischaltung (API-Zugang per Mail beantragt) |
| Fingrid Open Data (Dataset 177 Frequenz) | nur Alternativquelle für: frequency_cross_check_gb_nordic | free (kostenloser Key/Konto) | https://data.fingrid.fi/en/instructions | `SR_FINGRID_KEY` | 0 (+1 als Alternative) | offen |
| Netztransparenz.de (4 ÜNB) | Regelenergie-Abruf Deutschland; Notfallmaßnahmen nach §13 EnWG; Redispatch-Volumen; Ausgleichsenergiepreis reBAP … | free (kostenloser Key/Konto) | https://www.netztransparenz.de/de-de/Systemdienstleistungen/Betriebsfuehrung/Redispatch | `SR_NETZTRANSPARENZ_KEY` | 3 | offen |
| PowerOutage.us | Stromausfall-Zähler USA (EAGLE-I, PowerOutage.us) | paid (bezahlt) | https://poweroutage.us/ | `SR_POWEROUTAGE_US_KEY` | 1 | offen |


<!-- szenario:ai -->
## Szenario ai


Automatisch erzeugt von `scripts/consolidate_ai.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. Cloudflare Radar, abuse.ch, GitHub), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| Cloudflare Radar API (AI Insights) | Anteil KI-Crawler am Web-Verkehr; Crawl-zu-Verweis-Verhältnis; Layer-7-Angriffe als Begleiter; Gesamt-Bot-Anteil am Web-Verkehr … | free (kostenloser Key/Konto) | https://developers.cloudflare.com/radar/ | `SR_CLOUDFLARE_KEY` (Generator-Name `SR_CF_RADAR_KEY`) | 5 | angelegt 17.11.2026 |
| EIA Open Data (Strom stündlich) | Stromlast Virginia/PJM | free (kostenloser Key/Konto) | https://www.eia.gov/opendata/ | `SR_EIA_KEY` | 1 | angelegt 17.11.2026 |
| GitHub Advisory Database REST | nur Alternativquelle für: osv_malware_ai | free (kostenloser Key/Konto) | https://docs.github.com/en/rest/security-advisories/global-advisories | `SR_GHSA_KEY` | 0 (+1 als Alternative) | offen |
| GitHub Search API (Repositories) | Neue Repositories zu MCP-Servern; Pull-Requests durch Coding-Agenten pro Tag; Commits mit KI-Co-Autor-Zeile | free (kostenloser Key/Konto) | https://docs.github.com/en/rest/search/search | `SR_GITHUB_REST_KEY` | 3 | offen |
| GreyNoise Tags API | GreyNoise-Tags zu KI-Diensten | free (Community, begrenzt) (kostenloser Key/Konto) | https://docs.greynoise.io/ | `SR_GREYNOISE_KEY` | 1 | offen |
| Metaculus API | nur Alternativquelle für: prediction_ai_incident | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 0 (+1 als Alternative) | offen |
| NVD CVE API 2.0 | nur Alternativquelle für: cve_ai_keywords | free (kostenloser Key/Konto) | https://nvd.nist.gov/developers/vulnerabilities | `SR_NVD_KEY` (Generator-Name `SR_NVD_CVE_API_KEY`) | 0 (+1 als Alternative) | angelegt 17.11.2026 |
| Reddit r/LocalLLaMA und r/ChatGPT (JSON) | Aktivität der Community um lokale Modelle | free (kostenloser Key/Konto) | https://www.reddit.com/dev/api/ | `SR_REDDIT_JSON_KEY` | 1 | offen |
| Shodan Count API | Offen erreichbare LLM-Server im Internet | Konto (Mitgliedschaft ca. 49 USD einmalig, Stand Kenntnis) (bezahlt) | https://developer.shodan.io/api | `SR_SHODAN_KEY` | 1 | offen |
| URLhaus Host-Abfrage | Schadsoftware-URLs auf huggingface.co | free (kostenloser Key/Konto) | https://urlhaus-api.abuse.ch/ | `SR_ABUSECH_KEY` (gemeinsam für ThreatFox, URLhaus, MalwareBazaar) | 1 | angelegt 17.11.2026 |
| Vast.ai Marktplatz | GPU-Mietpreise (H100); Verfügbare GPUs am Marktplatz | free (kostenloser Key/Konto) | https://docs.vast.ai/ | `SR_VAST_AI_KEY` | 2 | offen |


<!-- szenario:finance -->
## Szenario finance


Automatisch erzeugt von `scripts/consolidate_finance.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| Destatis GENESIS-Online | Deutsche Regelinsolvenzen (Frühindikator) | free (kostenloser Key/Konto) | https://www-genesis.destatis.de/datenbank/online | `SR_DESTATIS_KEY` | 1 | offen |
| FRED API (St. Louis Fed) | Fed: sonstige Kredite an Institute; Euro-Banken-Anleihen: Aufschlag; Euro-Hochzins-Aufschlag; Investment-Grade-Aufschlag … | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/docs/api/fred/series_observations.html | `SR_FRED_KEY` | 9 (+4 als Alternative) | angelegt 17.11.2026 |


<!-- szenario:nuclear -->
## Szenario nuclear


Automatisch erzeugt von `scripts/consolidate_nuclear.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| ENTSO-E Transparency Platform | ENTSO-E: Nichtverfügbarkeit von Kernkraftwerken; ENTSO-E: Erzeugung je Kernkraftwerk; Ukraine: Netz-Lastfluss an der Grenze | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html | `SR_ENTSOE_KEY` | 3 | wartet auf Freischaltung (API-Zugang per Mail beantragt) |
| Fingrid Open Data | Finnland: Atomstrom (Fingrid) | free (kostenloser Key/Konto) | https://data.fingrid.fi/en/instructions | `SR_FINGRID_KEY` | 1 | offen |
| FRED series PURANUSDM | IMF-Uranpreis (monatlich, FRED) | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/series/PURANUSDM | `SR_FRED_KEY` | 1 | angelegt 17.11.2026 |
| Metaculus API | Metaculus: Fragen zu Nuklearwaffen | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 1 | offen |
| uRADMonitor Data API | uRADMonitor: Sensoren in Europa | free (kostenloser Key/Konto) | https://www.uradmonitor.com/api/ | `SR_URADMONITOR_KEY` | 1 | offen |


<!-- szenario:bio -->
## Szenario bio


Automatisch erzeugt von `scripts/consolidate_bio.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. FRED), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet. "Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |
|---|---|---|---|---|---|---|
| CMU Delphi Epidata API (FluView, ILINet, Nowcasts) | USA: FluView ILINet und Labor-Positivrate | free (kostenloser Key/Konto) | https://cmu-delphi.github.io/delphi-epidata/ | `SR_DELPHI_EPIDATA_KEY` | 1 | offen |
| FRED: Eier Verbraucherpreis (APU0000708111) | nur Alternativquelle für: poultry_stocks | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/series/APU0000708111 | `SR_FRED_KEY` | 0 | angelegt 17.11.2026 |
| GISAID EpiCoV/EpiFlu | GISAID Sequenzzahlen | free (kostenloser Key/Konto) | https://gisaid.org/ | `SR_GISAID_KEY` | 1 | offen |
