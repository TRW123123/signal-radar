# Lizenz noch klären (Szenario cyber)

Automatisch erzeugt von `scripts/consolidate_cyber.py`. Aufgenommen: Lizenz laut Recherche unklar oder ungeprüft, oder Nutzungsbedingungen schränken automatisierten/kommerziellen Abruf ein. Signale, deren Hauptquelle nur per Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`.

| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |
|---|---|---|---|
| AbuseIPDB | api | CC BY-NC 4.0 (laut Seite) | https://docs.abuseipdb.com/ |
| Adyen Status | scrape (Status license-unclear) | unklar | https://status.adyen.com/ |
| AGSI+ Gas Infrastructure Europe | api | GIE Nutzungsbedingungen, unklar | https://agsi.gie.eu/api |
| aisstream.io | api | unklar | https://aisstream.io/documentation |
| ALSI+ LNG Storage | api | GIE Nutzungsbedingungen, unklar | https://alsi.gie.eu/api |
| AMS-IX Statistiken | scrape (Status license-unclear) | unklar | https://stats.ams-ix.net/ |
| APNIC Labs Statistiken | download | unklar | https://stats.labs.apnic.net/ |
| APWG Phishing Activity Trends | download | unklar | https://apwg.org/trendsreports/ |
| Artemis Cyber Cat Bonds | scrape | urheberrechtlich geschützt | https://www.artemis.bm/ |
| Autobahn App API | api | Datenlizenz Deutschland, unklar | https://autobahn.api.bund.dev/ |
| AWS Health Dashboard | api | unklar | https://health.aws.amazon.com/health/status |
| Azure Status | rss | unklar | https://azure.status.microsoft/en-us/status/feed/ |
| BaFin Eigengeschäfte von Führungskräften | download | Datenlizenz Deutschland? unklar | https://portal.mvp.bafin.de/database/DealingsInfo/ |
| bgp.tools | scrape (Status license-unclear) | unklar | https://bgp.tools/kb/api |
| Binance Public API (ping/time) | api | Binance API ToS | https://developers.binance.com/docs/binance-spot-api-docs/rest-api |
| Bitnodes API | api | öffentlich, Nutzungsbedingungen unklar | https://bitnodes.io/api/ |
| Blockchain.com Charts API | api | unklar | https://www.blockchain.com/explorer/api/charts |
| Bundesnetzagentur Breitbandmessung / Netzstörungen | scrape (Status license-unclear) | dl-de/by-2-0 (unklar je Datensatz) | https://www.bundesnetzagentur.de/ |
| Bundesagentur für Arbeit Jobsuche API | api | bund.dev, offene Nutzung; Bedingungen prüfen | https://jobsuche.api.bund.dev/ |
| Bundesanzeiger Veröffentlichungen | scrape (Status license-unclear) | unklar; Nutzungsbedingungen prüfen, automatisierter Abruf ggf. eingeschränkt | https://www.bundesanzeiger.de/ |
| CERT-Bund / BSI WID | rss | DL-DE (unklar) | https://wid.cert-bund.de/ |
| CERT-EU Advisories RSS | rss | unklar | https://cert.europa.eu/publications/security-advisories/ |
| CertStream/CT-Logs | api | unklar | https://certstream.calidog.io/ |
| Cloudflare Radar API | api | CC BY-NC 4.0 (Radar-Daten, Kommerz-Nutzung prüfen) | https://developers.cloudflare.com/radar/ |
| Chromium Dash Releases | api | BSD/Chromium; API inoffiziell | https://chromiumdash.appspot.com/releases |
| CISA Known Exploited Vulnerabilities | download | CC0 / US Gov Public Domain (laut CISA-Seite, nicht geprüft) | https://www.cisa.gov/known-exploited-vulnerabilities-catalog |
| Cloudflare Status (Statuspage) | api | unklar | https://www.cloudflarestatus.com/api |
| Cowrie Community-Daten (z. B. SANS/DShield, BitNinja) | api | unklar | https://github.com/cowrie/cowrie |
| DB API Marketplace Timetables / StaDa | api | CC BY 4.0 (laut DB), prüfen | https://developers.deutschebahn.com/db-api-marketplace/apis/ |
| DE-CIX Verkehrsstatistik | scrape (Status license-unclear) | unklar | https://www.de-cix.net/en/locations/frankfurt/statistics |
| DNS-OARC / root-servers.org | scrape (Status license-unclear) | unklar | https://www.root-servers.org/ |
| Downdetector | scrape | kommerz. ToS | https://downdetector.com/ |
| EBA Clearing RT1/STEP2 Status und Statistik | scrape (Status license-unclear) | unklar | https://www.ebaclearing.eu/ |
| Energy-Charts API (Fraunhofer ISE) | api | CC BY 4.0 (laut Seite, prüfen) | https://api.energy-charts.info/ |
| ENTSOG Transparency Platform API | api | ENTSOG, Namensnennung, unklar | https://transparency.entsog.eu/api/archiveDirectory/swagger/ |
| EQS-News / EQS Group Ad-hoc und Pflichtmitteilungen (Feeds) | rss | unklar (Pressetexte der Emittenten; nur Metadaten nutzen) | https://www.eqs-news.com/ |
| ESAs/EBA/ECB Statistiken zu IKT-Vorfällen (DORA, TIBER) | scrape (Status license-unclear) | unklar | https://www.eiopa.europa.eu/digital-operational-resilience-act-dora_en |
| Eurocontrol Network Manager / Aviation Intelligence | scrape (Status license-unclear) | Eurocontrol Nutzungsbedingungen, unklar | https://www.eurocontrol.int/dashboard/aviation-intelligence-portal |
| Fastly Status (Statuspage API) | api | unklar | https://status.fastly.com/api |
| FCA National Storage Mechanism (UK RNS-Pflichtmitteilungen) | api | unklar | https://data.fca.org.uk/#/nsm/nationalstoragemechanism |
| FlightAware AeroAPI | api | kommerziell | https://www.flightaware.com/commercial/aeroapi/ |
| FRBservices Fedwire/FedACH/FedNow Volumen | download | unklar | https://www.frbservices.org/resources/financial-services/wires/volume-value-stats |
| Federal Reserve Financial Services Status (Fedwire, FedACH, FedNow) | scrape (Status license-unclear) | unklar | https://www.frbservices.org/ |
| FRED API (St. Louis Fed) | api | FRED Terms of Use (Drittanbieter-Serien teils eingeschränkt) | https://fred.stlouisfed.org/docs/api/fred/ |
| Google Cloud Status incidents.json | api | unklar | https://status.cloud.google.com/ |
| GitHub Status (Atlassian Statuspage) | api | unklar (Statuspage-API öffentlich, ToS prüfen) | https://www.githubstatus.com/api |
| Google Trends (pytrends, inoffiziell) | api | Google ToS verbieten automatisierte Abfragen; keine offene Lizenz | https://github.com/GeneralMills/pytrends |
| GPSJam | download | unklar | https://gpsjam.org/ |
| GreyNoise Community/Trends | api | Community-API eingeschränkt, ToS | https://docs.greynoise.io/ |
| GRIP BGP-Event-Feed (Georgia Tech) | api | unklar | https://api.grip.inetintel.cc.gatech.edu/json/events |
| GSC Galileo Notices | scrape (Status license-unclear) | EU, unklar | https://www.gsc-europa.eu/system-service-status/constellation-information |
| GTFS-Realtime Feeds (z.B. gtfs.de) | download | CC BY 4.0 (gtfs.de), prüfen | https://gtfs.de/ |
| UK ICO Data security incident trends | download | Open Government Licence (vermutet) | https://ico.org.uk/action-weve-taken/data-security-incident-trends/ |
| StatusGator / IsDown (Aggregation von Statusseiten) | scrape (Status license-unclear) | kommerziell, ToS prüfen | https://statusgator.com/ |
| IVENA / Leitstellen-Abmeldungen | scrape (Status license-unclear) | unklar | https://www.ivena.de/ |
| LINX Statistiken | scrape (Status license-unclear) | unklar | https://portal.linx.net/stats |
| MANRS Observatory | scrape (Status license-unclear) | unklar | https://observatory.manrs.org/ |
| Marsh Global Insurance Market Index (Cyber-Preise) | download | unklar | https://www.marsh.com/en/services/global-insurance-market-index.html |
| Mastercard Developers Status | api | unklar | https://developer.mastercard.com/ |
| Meshtastic Public Map (liamcottle) | api | Community, unklar | https://meshtastic.liamcottle.net/ |
| Metaculus API | api | CC BY 4.0 für Fragen (laut Metaculus; prüfen) | https://www.metaculus.com/api/ |
| NETSCOUT Cyber Threat Horizon | scrape (Status license-unclear) | unklar | https://horizon.netscout.com/ |
| Netzfrequenzmessung.de | scrape (Status license-unclear) | unklar | https://www.netzfrequenzmessung.de/ |
| NINA / MoWaS Warn-API (BBK) | api | Datenlizenz Deutschland, unklar im Detail | https://nina.api.bund.dev/ |
| Okta Trust Status | scrape (Status license-unclear) | unklar | https://status.okta.com/ |
| Ookla Open Data | download | CC BY-NC-SA 4.0 | https://registry.opendata.aws/speedtest-global-performance/ |
| Open Banking UK API Performance | download | unklar | https://www.openbanking.org.uk/api-performance/ |
| OpenINTEL | download | CC BY 4.0 (unklar je Datensatz) | https://www.openintel.nl/ |
| OpenPhish Community Feed | download | nur nicht-kommerziell (Community) | https://openphish.com/phishing_feeds.html |
| OpenSky States | api | CC BY-NC | https://openskynetwork.github.io/opensky-api/rest.html |
| nomi-sec PoC-in-GitHub | download | unklar | https://github.com/nomi-sec/PoC-in-GitHub |
| Polymarket Gamma API | api | Polymarket ToS; Nutzung in einigen Ländern eingeschränkt | https://docs.polymarket.com/ |
| Potaroo / CIDR Report BGP Table | download | unklar | https://bgp.potaroo.net/ |
| PowerOutage.us | scrape | Nutzung laut ToS eingeschränkt | https://poweroutage.us/ |
| PSKReporter | api | unklar, Fair Use | https://pskreporter.info/pskdev.html |
| pypistats.org API | api | CC0? unklar | https://pypistats.org/api/ |
| ransomware.live API | api | CC BY-NC-SA (laut Seite, prüfen) | https://www.ransomware.live/api |
| ransomwatch (GitHub) | download | MIT (Repo), Daten unklar | https://github.com/joshhighet/ransomwatch |
| Reddit about.json | api | Reddit Data API Terms, kommerziell eingeschränkt | https://www.reddit.com/dev/api/ |
| RIPEstat Data API | api | RIPE NCC Terms, frei nutzbar | https://stat.ripe.net/docs/02.data-api/ |
| RIPE RIS Live (WebSocket) | api | RIPE NCC, frei | https://ris-live.ripe.net/manual/ |
| RIPE RIS Raw Data (MRT-Dumps) | download | RIPE NCC, frei | https://ris.ripe.net/docs/mrt/ |
| NIST RPKI Monitor / Routinator VRP | scrape (Status license-unclear) | unklar | https://rpki-monitor.antd.nist.gov/ |
| RSSAC002 Daten (Root-Server-Operatoren) | download | unklar | https://github.com/rssac-caucus/RSSAC002-data |
| SANS ISC / DShield API | api | CC BY-NC-SA (laut ISC, prüfen) | https://isc.sans.edu/api/ |
| Schneider Electric Security Notifications | scrape (Status license-unclear) | unklar | https://www.se.com/ww/en/work/support/cybersecurity/security-notifications.jsp |
| Shadowserver Dashboard / API | api | CC BY 4.0 (unklar) | https://dashboard.shadowserver.org/ |
| CTA/UTP SIP Systemstatus | scrape (Status license-unclear) | unklar | https://www.ctaplan.com/ |
| Socket.dev Blog/Threat-Feed | rss | unklar | https://socket.dev/blog |
| Spamhaus DROP/BGPCC Listen | download | frei für nicht-kommerziell | https://www.spamhaus.org/drop/ |
| Atlassian-Statuspage-Hosts (diverse Anbieter) | api | je Anbieter unklar | https://developer.statuspage.io/ |
| Störungsmelder / allestörungen.de Crowd-Meldungen | scrape (Status license-unclear) | unklar, ToS verbieten ggf. Scraping | https://stoerungsmelder.de/ |
| Stooq historische Kurse (CSV) | api | unklar (privater Dienst) | https://stooq.com/db/h/ |
| Stripe Status | api | unklar | https://docs.stripe.com/api/ |
| TeleGeography Submarine Cable Map | download | CC BY-NC-SA 4.0 | https://www.submarinecablemap.com/ |
| SWIFT Operational Status | scrape (Status license-unclear) | unklar | https://www.swift.com/ |
| Telekom/CPaaS Statuspages (Twilio, Vonage, Bandwidth, Sinch) | api | unklar | https://status.twilio.com/ |
| Packet Clearing House IXP-Statistiken | scrape (Status license-unclear) | unklar | https://www.pch.net/ixp/dir |
| ThousandEyes Internet Report | scrape (Status license-unclear) | unklar | https://www.thousandeyes.com/ |
| VirusTotal Public API | api | Public-API nur nicht-kommerziell | https://docs.virustotal.com/reference/overview |
| WhoisDS Newly Registered Domains | download | unklar | https://www.whoisds.com/newly-registered-domains |
| Yahoo Finance Chart (inoffizielle API) | api | inoffiziell, ToS erlauben keine systematische Nutzung; Lizenz unklar | https://finance.yahoo.com |
