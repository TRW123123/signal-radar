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

## Szenario Kriegseskalation

Automatisch erzeugt von `scripts/consolidate_war.py`. Kriterien wie oben. Zusätzlich gilt: Angaben von Kriegsparteien (z. B. Verlustzahlen) sind Klasse C und werden nur mit Gewicht ≤ 0,2 geführt.

| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |
|---|---|---|---|
| Auswärtiges Amt OpenData travelwarning | api | unklar (AA-Opendata-Seite prüfen) | https://www.auswaertiges-amt.de/opendata/travelwarning |
| ACLED API | api | Bedingungen, nicht-kommerziell frei | https://acleddata.com/acled-api-documentation |
| AGSI+ Gas Infrastructure Europe | api | GIE Nutzungsbedingungen, unklar | https://agsi.gie.eu/api |
| airplanes.live API | api | nicht-kommerziell, prüfen | https://airplanes.live/api-guide/ |
| AISHub / MarineTraffic / Datalastic AIS | api | Datentausch (AISHub), sonst kommerziell | https://www.aishub.net/api |
| aisstream.io | api | unklar | https://aisstream.io/documentation |
| alerts.in.ua API | api | Nutzung nicht-kommerziell mit Key, prüfen | https://devs.alerts.in.ua/ |
| ALSI+ LNG Storage | api | GIE Nutzungsbedingungen, unklar | https://alsi.gie.eu/api |
| Baltic Exchange (BDI, BDTI, BCTI) | scrape | proprietär | https://www.balticexchange.com/ |
| BfArM Lieferengpass-Meldungen | scrape (Status license-unclear) | unklar | https://anwendungen.pharmnet-bund.de/lieferengpassmeldungen/faces/public/meldungen.xhtml |
| Bonbast Rial-Kurse | scrape (Status license-unclear) | unklar | https://www.bon-bast.com/ |
| Cloudflare Radar API | api | CC BY-NC 4.0 (Radar-Daten, Kommerz-Nutzung prüfen) | https://developers.cloudflare.com/radar/ |
| CTBTO Pressekanal | rss | unklar | https://www.ctbto.org/ |
| DIP Bundestag API | api | unklar | https://dip.bundestag.de/%C3%BCber-dip/hilfen/api |
| Drewry World Container Index | scrape | Namensnennung, Weiterverwendung eingeschränkt | https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry |
| DRK Blutspendedienst Versorgungslage (Webseite) | scrape (Status license-unclear) | unklar | https://www.blutspende.de/ |
| EASA Conflict Zone Information Bulletins | scrape (Status license-unclear) | EASA, unklar | https://www.easa.europa.eu/en/domains/air-operations/czibs |
| EMSC FDSN Event API | api | EMSC Nutzungsbedingungen, unklar | https://www.seismicportal.eu/fdsn-wsevent.html |
| Energy-Charts API (Fraunhofer ISE) | api | CC BY 4.0 (laut Seite, prüfen) | https://api.energy-charts.info/ |
| ENTSOG Transparency Platform API | api | ENTSOG, Namensnennung, unklar | https://transparency.entsog.eu/api/archiveDirectory/swagger/ |
| EU Financial Sanctions Files (FSF) | download | EU-Daten, Wiederverwendung mit Quellenangabe (prüfen) | https://webgate.ec.europa.eu/fsd/fsf |
| Eurocontrol Network Manager / Aviation Intelligence | scrape (Status license-unclear) | Eurocontrol Nutzungsbedingungen, unklar | https://www.eurocontrol.int/dashboard/aviation-intelligence-portal |
| FAO Food Price Index | download | CC BY-NC-SA 3.0 IGO | https://www.fao.org/worldfoodsituation/foodpricesindex/en/ |
| UN Comtrade / Eurostat Munition Handel | api | UN, Bedingungen prüfen | https://comtradeapi.un.org/ |
| Flightradar24 GPS-Jamming-Karte | scrape (Status license-unclear) | Flightradar24 ToS, unklar | https://www.flightradar24.com/data/gps-jamming |
| FRED API (St. Louis Fed) | api | FRED Terms of Use (Drittanbieter-Serien teils eingeschränkt) | https://fred.stlouisfed.org/docs/api/fred/ |
| GEOFON FDSN Event | api | GFZ, CC BY 4.0 (prüfen) | https://geofon.gfz-potsdam.de/fdsnws/event/1/ |
| Global Fishing Watch APIs (Events/4Wings) | api | CC BY-NC 4.0 | https://globalfishingwatch.org/our-apis/ |
| Vadimkin/ukrainian-air-raid-sirens-dataset (GitHub) | download | unklar (Lizenzdatei nicht geprüft) | https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset |
| datasets/oil-prices (GitHub, EIA-Spiegel) | download | unklar (datasets.io, vermutlich PDDL) | https://github.com/datasets/oil-prices |
| cyterat/deepstate-map-data (GitHub) | download | unklar (Quelle DeepStateMap, Repo-Lizenz prüfen) | https://github.com/cyterat/deepstate-map-data |
| PetroIvaniuk/2022-Ukraine-Russia-War-Dataset (GitHub) | download | unklar (Repo-Lizenz prüfen) | https://github.com/PetroIvaniuk/2022-Ukraine-Russia-War-Dataset |
| Google Trends (pytrends, inoffiziell) | api | Google ToS verbieten automatisierte Abfragen; keine offene Lizenz | https://github.com/GeneralMills/pytrends |
| GPSJam | download | unklar | https://gpsjam.org/ |
| IMF PortWatch (offene ArcGIS FeatureServer) | api | IMF Open Data Terms (Namensnennung); URL/Layername vor Nutzung prüfen | https://portwatch.imf.org/ |
| LMA Joint War Committee Listed Areas | scrape (Status license-unclear) | unklar | https://www.lmalloyds.com/lma/jointwar |
| The Space Devs Launch Library 2 | api | Free-Tier mit Limit, Bedingungen prüfen | https://ll.thespacedevs.com/docs/ |
| Metaculus API | api | CC BY 4.0 für Fragen (laut Metaculus; prüfen) | https://www.metaculus.com/api/ |
| NINA / MoWaS Warn-API (BBK) | api | Datenlizenz Deutschland, unklar im Detail | https://nina.api.bund.dev/ |
| OpenSanctions (aggregiert, Deltas) | download | CC BY-NC 4.0 (kommerziell kostenpflichtig) | https://www.opensanctions.org/docs/bulk/ |
| OpenSky States | api | CC BY-NC | https://openskynetwork.github.io/opensky-api/rest.html |
| Israel Alerts (Heimatfront-Historie, GitHub-Spiegel) | download | unklar | https://github.com/dleshem/israel-alerts-data |
| Pikud HaOref Live JSON | api | unklar | https://www.oref.org.il/ |
| Oryx Daily Count (GitHub-Spiegel) | download | unklar | https://github.com/scarnecchia/oryx_data |
| Panama Canal Authority Transit-Statistik | scrape (Status license-unclear) | unklar | https://pancanal.com/en/maritime-operations/ |
| Paris MoU / P&I-Club-Rundschreiben (RSS) | scrape (Status license-unclear) | unklar | https://www.gard.no/ |
| Polymarket Gamma API | api | Polymarket ToS; Nutzung in einigen Ländern eingeschränkt | https://docs.polymarket.com/ |
| Ukraine Verkhovna Rada Open Data | download | unklar | https://data.rada.gov.ua/open |
| Reservistenverband / Bundeswehr Webseiten | scrape (Status license-unclear) | unklar | https://www.reservistenverband.de/ |
| RIPEstat Data API | api | RIPE NCC Terms, frei nutzbar | https://stat.ripe.net/docs/02.data-api/ |
| Straż Graniczna Statystyki | scrape (Status license-unclear) | unklar | https://www.strazgraniczna.pl/pl/granica/statystyki-sg/2206,Statystyki-SG.html |
| SPDR Gold Shares Bestand (Tonnen) | download | unklar | https://www.spdrgoldshares.com/usa/historical-data/ |
| Shanghai Containerized Freight Index | scrape (Status license-unclear) | unklar | https://en.sse.net.cn/indices/scfinew.jsp |
| Stooq historische Kurse (CSV) | api | unklar (privater Dienst) | https://stooq.com/db/h/ |
| TeleGeography Submarine Cable Map | download | CC BY-NC-SA 4.0 | https://www.submarinecablemap.com/ |
| Telegram öffentliche Kanalvorschau (t.me/s/<kanal>) | scrape (Status license-unclear) | unklar, ToS beachten | https://core.telegram.org/api/web-preview |
| Taiwan MND Tagesmeldung PLA-Aktivität | scrape (Status license-unclear) | Taiwan Open Data, prüfen | https://www.mnd.gov.tw/ |
| UK GOV.UK Content API (Foreign travel advice) | api | Open Government Licence v3.0 | https://content-api.publishing.service.gov.uk/ |
| UK Sanctions List (FCDO) / OFSI Consolidated List | download | Open Government Licence v3.0 | https://www.gov.uk/government/publications/the-uk-sanctions-list |
| UK National Threat Level (MI5) | scrape (Status license-unclear) | unklar | https://www.mi5.gov.uk/threat-levels |
| UKMTO Recent Incidents | scrape (Status license-unclear) | unklar | https://www.ukmto.org/ |
| IRIS/CTBTO IMS Infraschall (IDC, vDEC) | scrape | eingeschränkt | https://www.ctbto.org/our-work/international-monitoring-system |
| VIINA 2.0 (GitHub) | download | unklar | https://github.com/zhukovyuri/VIINA |
| WorldGovernmentBonds CDS/Renditen | scrape (Status license-unclear) | unklar, Scrape-Verbot möglich | http://www.worldgovernmentbonds.com/ |
| Yahoo Finance Chart (inoffizielle API) | api | inoffiziell, ToS erlauben keine systematische Nutzung; Lizenz unklar | https://finance.yahoo.com |
