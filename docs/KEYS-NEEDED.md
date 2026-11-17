# Benötigte Keys, Konten und Bezahlzugänge (Szenario cyber)

Automatisch erzeugt von `scripts/consolidate_cyber.py`. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet. Der Link führt auf die Doku-Seite der Quelle; die Anmeldung ist dort verlinkt. "Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| AbuseIPDB | nur Alternativquelle für: new_ddos_botnet_ips | free (kostenloser Key/Konto) | https://docs.abuseipdb.com/ | `SR_ABUSE_IPDB_KEY` | 0 (+1 als Alternative) |
| Adzuna API | nur Alternativquelle für: incident_response_postings | free (kostenloser Key/Konto) | https://developer.adzuna.com/ | `SR_ADZUNA_KEY` | 0 (+1 als Alternative) |
| AGSI+ Gas Infrastructure Europe | Gasspeicher-Fuellstand und Ausspeicherung | free (kostenloser Key/Konto) | https://agsi.gie.eu/api | `SR_AGSI_KEY` | 1 |
| AISStream.io | AIS-Positionssprünge; Hafenstau; Kabelleger und Schiffsaggregate | free (kostenloser Key/Konto) | https://aisstream.io/documentation | `SR_AISSTREAM_KEY` | 3 |
| Alpha Vantage | nur Alternativquelle für: cyber_etf_volume, cdn_cloud_stress | free (kostenloser Key/Konto) | https://www.alphavantage.co/documentation/ | `SR_ALPHAVANTAGE_KEY` | 0 (+2 als Alternative) |
| ALSI+ LNG Storage | LNG-Terminal Send-out | free (kostenloser Key/Konto) | https://alsi.gie.eu/api | `SR_ALSI_KEY` | 1 |
| Bundesagentur fuer Arbeit Jobsuche API | Stellenanzeigen Incident Response | free (kostenloser Key/Konto) | https://jobsuche.api.bund.dev/ | `SR_BUNDESAGENTUR_JOBSUCHE_KEY` | 1 |
| Censys Search/Open Data | Exponierte OT-Protokolle; Exponierte Dienste (Trend) | free (kostenloser Key/Konto) | https://search.censys.io/api | `SR_CENSYS_KEY` | 2 |
| Cloudflare Radar API | SERVFAIL-Rate (Resolver); DNSSEC-Validierungsfehler; DNS-Verkehr und NXDOMAIN-Anteil; Ranking-Volatilität der Top-Domains … | free (kostenloser Key/Konto) | https://developers.cloudflare.com/radar/ | `SR_CF_RADAR_KEY` | 15 (+5 als Alternative) |
| CoinGecko API | nur Alternativquelle für: stablecoin_peg_deviation, bitcoin_vs_gold_divergence | free (kostenloser Key/Konto) | https://docs.coingecko.com/ | `SR_COINGECKO_KEY` | 0 (+2 als Alternative) |
| DB API Marketplace Timetables / StaDa | nur Alternativquelle für: db_cancellation_rate | free (kostenloser Key/Konto) | https://developers.deutschebahn.com/db-api-marketplace/apis/ | `SR_DB_TIMETABLES_KEY` | 0 (+1 als Alternative) |
| Statusseiten Mobilfunk (Beispiel Downdetector-Alternativen) | Mobilfunk-Störungsmeldungen; Crowd-Störungsmeldungen Strom DE; Bahnfunk-Störungen | free (teilweise Konto) | https://downdetector.com/ | `SR_DOWNDETECTOR_KEY` | 0 (+2 als Alternative) |
| EIA Open Data (Hourly Grid Monitor) | US Last je Balancing Authority | free (kostenloser Key/Konto) | https://www.eia.gov/opendata/ | `SR_EIA_KEY` | 1 |
| ENTSO-E Transparency Platform | Ungeplante Kraftwerksausfälle EU; Grenzüberschreitende Stromflüsse | free (kostenloser Key/Konto) | https://transparency.entsoe.eu/ | `SR_ENTSOE_KEY` | 2 (+2 als Alternative) |
| FAA NOTAM API | NOTAMs zu GPS-Ausfall | free (kostenloser Key/Konto) | https://api.faa.gov/s/ | `SR_FAA_NOTAM_KEY` | 1 |
| FlightAware AeroAPI | Flugausfallquote | paid (bezahlt) | https://www.flightaware.com/commercial/aeroapi/ | `SR_FLIGHTAWARE_KEY` | 1 |
| FRED API (St. Louis Fed) | St. Louis Financial Stress Index | free (kostenloser Key/Konto) | https://fred.stlouisfed.org/docs/api/fred/ | `SR_FRED_KEY` | 1 (+4 als Alternative) |
| GitHub Advisory Database | Security-Meldungen in großen Repos | free (kostenloser Key/Konto) | https://github.com/github/advisory-database | `SR_GHSA_KEY` | 1 (+2 als Alternative) |
| GitHub REST API | Commit-Zeitmuster in öffentlichen Security-Repos | free (kostenloser Key/Konto) | https://docs.github.com/en/rest | `SR_GITHUB_REST_KEY` | 1 |
| GreyNoise Community/Trends | GreyNoise Scanner je CVE-Tag; GreyNoise Gesamt-Rauschen | free (kostenloser Key/Konto) | https://docs.greynoise.io/ | `SR_GREYNOISE_KEY` | 2 (+2 als Alternative) |
| StatusGator / IsDown (Aggregation von Statusseiten) | Crowd-Störungsmeldungen (Downdetector-Ersatz) | paid ab ca. 20 USD/Monat (bezahlt) | https://statusgator.com/ | `SR_ISDOWN_STATUSGATOR_KEY` | 1 |
| abuse.ch MalwareBazaar | Wiper-/Zerstörungs-Malware-Meldungen; MalwareBazaar Samples pro Tag | free (teilweise Konto) | https://bazaar.abuse.ch/api/ | `SR_MALWAREBAZAAR_KEY` | 1 |
| Metaculus API | nur Alternativquelle für: metaculus_manifold | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 0 (+1 als Alternative) |
| Metasploit Framework Commits/Releases | Metasploit neue Exploit-Module | free (kostenloser Key/Konto) | https://github.com/rapid7/metasploit-framework | `SR_METASPLOIT_COMMITS_KEY` | 1 |
| M-Lab NDT (BigQuery/Open Data) | M-Lab Durchsatz und Verlust | free (kostenloser Key/Konto) | https://www.measurementlab.net/data/ | `SR_MLAB_KEY` | 1 |
| Microsoft Graph serviceAnnouncement (M365 Service Health) | nur Alternativquelle für: saas_identity_m365 | free (kostenloser Key/Konto) | https://learn.microsoft.com/graph/api/serviceannouncement-list-issues | `SR_MS_GRAPH_SERVICE_HEALTH_KEY` | 0 (+1 als Alternative) |
| ProjectDiscovery nuclei-templates | Nuclei-Templates für neue CVEs | free (kostenloser Key/Konto) | https://github.com/projectdiscovery/nuclei-templates | `SR_NUCLEI_TEMPLATES_KEY` | 1 |
| NVD CVE API 2.0 | Anteil kritischer CVEs (CVSS >= 9) | free (kostenloser Key/Konto) | https://nvd.nist.gov/developers/vulnerabilities | `SR_NVD_CVE_API_KEY` | 1 (+1 als Alternative) |
| OpenINTEL | DNS-Abhängigkeiten großer Anbieter | free (kostenloser Key/Konto) | https://www.openintel.nl/ | `SR_OPENINTEL_KEY` | 1 (+1 als Alternative) |
| OpenSky Network API | Gleichzeitige Flugzeug-Bodenstopps / Flugausfälle; Flugbewegungen Aggregat; ADS-B Abdeckungsverlust | free (kostenloser Key/Konto) | https://openskynetwork.github.io/opensky-api/rest.html | `SR_OPENSKY_KEY` | 2 (+2 als Alternative) |
| AlienVault OTX | nur Alternativquelle für: wiper_reports, ics_malware, threatfox_ioc_volume | free (kostenloser Key/Konto) | https://otx.alienvault.com/api | `SR_OTX_KEY` | 0 (+3 als Alternative) |
| PhishTank | nur Alternativquelle für: openphish_volume | free (kostenloser Key/Konto) | https://phishtank.org/developer_info.php | `SR_PHISHTANK_KEY` | 0 (+1 als Alternative) |
| Polygon.io Options | Optionsaktivität auf Cyber- und Cloud-Werte | free (kostenloser Key/Konto) | https://polygon.io/docs/options | `SR_POLYGON_KEY` | 1 |
| PowerOutage.us | US Stromausfälle (Kunden ohne Strom) | Daten-API kostenpflichtig, unklar (teilweise Konto) | https://poweroutage.us/ | `SR_POWEROUTAGE_US_KEY` | 1 |
| ransomware.live API | Gleichzeitige Opferdichte; Leak-Opfer in kritischer Infrastruktur; Ransomware-Leak-Posts pro Tag; Leak-Opfer in Deutschland … | free (teilweise Konto) | https://www.ransomware.live/api | `SR_RANSOMWARE_LIVE_KEY` | 0 |
| Reddit about.json | Reddit r/sysadmin Aktivität | free (kostenloser Key/Konto) | https://www.reddit.com/dev/api/ | `SR_REDDIT_JSON_KEY` | 1 |
| SAM.gov Opportunities API | SAM.gov Justification-Notices (ohne Wettbewerb) | free (kostenloser Key/Konto) | https://open.gsa.gov/api/get-opportunities-public-api/ | `SR_SAM_GOV_KEY` | 1 |
| Shadowserver Dashboard | Offene DDoS-Reflektoren; Shadowserver exponierte verwundbare Hosts; Abbau verwundbarer Hosts | free (kostenloser Key/Konto) | https://dashboard.shadowserver.org/ | `SR_SHADOWSERVER_KEY` | 1 (+1 als Alternative) |
| Shodan Trends / Search API | nur Alternativquelle für: exposed_ot_protocols, shodan_exposed_service_trend, vulnerable_host_decay | ab ca. 49 USD einmalig/Monat, unklar (bezahlt) | https://developer.shodan.io/api | `SR_SHODAN_KEY` | 0 (+3 als Alternative) |
| Space-Track.org API | Satellitenzerfall und Anomalien | free (kostenloser Key/Konto) | https://www.space-track.org/documentation | `SR_SPACE_TRACK_KEY` | 1 (+1 als Alternative) |
| Tankerkoenig API | Tankstellen-Ausfälle | free (kostenloser Key/Konto) | https://creativecommons.tankerkoenig.de/ | `SR_TANKERKOENIG_KEY` | 1 |
| VirusTotal Public API | VirusTotal Einreichungsstatistik | free (kostenloser Key/Konto) | https://docs.virustotal.com/reference/overview | `SR_VIRUSTOTAL_KEY` | 1 |
| VulnCheck KEV | nur Alternativquelle für: kev_additions_rate | free (kostenloser Key/Konto) | https://vulncheck.com/kev | `SR_VULNCHECK_KEV_KEY` | 0 (+1 als Alternative) |
| WhoisDS Newly Registered Domains | Neu registrierte Domains mit Krisenbegriffen | free (kostenloser Key/Konto) | https://www.whoisds.com/newly-registered-domains | `SR_WHOISDS_KEY` | 1 (+1 als Alternative) |
