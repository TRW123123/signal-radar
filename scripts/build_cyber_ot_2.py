exec(open("/home/claude/signal-radar/scripts/build_cyber_ot.py").read())

L = []
a = L.append

# ---------- Strom ----------
a(G("grid.frequency_deviation_de", "Netzfrequenz-Abweichung Kontinentaleuropa", "Die Netzfrequenz soll bei 50 Hz bleiben; grosse oder dauerhafte Abweichungen zeigen Ungleichgewicht im Stromnetz.", "power_grid", "A",
    "Angriffe auf Leitwarten, Erzeugung oder Laststeuerung (vgl. Ukraine 2015/16) wuerden Erzeugung und Last abrupt aendern; Frequenz ist die schnellste unabhaengige Messgroesse.", "up", "coincident",
    ["Kraftwerks-/Leitungsausfall", "Handelsviertelstunden-Sprung", "Messfehler einzelner Sensoren"], "low", 1, [NETZFREQ, EC_FREQ]))
a(G("grid.frequency_rocof", "Frequenz-Gradient (RoCoF)", "Wie schnell sich die Netzfrequenz aendert; sehr schnelle Aenderungen deuten auf plotzlichen Lastverlust.", "power_grid", "A",
    "Abrupte Gradienten entstehen bei Abschaltung grosser Einheiten oder Netztrennung; Ableitung aus Sekundenwerten.", "up", "coincident",
    ["Normale Stoerfaelle", "Systemseparation durch Wetter"], "low", 2, [NETZFREQ, EC_FREQ], "Aus Frequenz-Zeitreihe selbst berechnen."))
a(G("grid.load_vs_forecast_de", "Last gegen Prognose Deutschland", "Vergleich zwischen tatsaechlichem Stromverbrauch und der Vortagesprognose.", "power_grid", "B",
    "Plotzliche Abweichung nach unten ohne Wetterursache deutet auf Netzabschaltungen oder Steuerungsausfall.", "down", "coincident",
    ["Feiertage", "Wetter", "Fehlerhafte Prognose"], "low", 2, [SMARD, EC_PUB]))
a(G("grid.generation_unit_outages_eu", "Ungeplante Kraftwerksausfaelle EU", "Anzahl und Leistung ungeplant ausgefallener Erzeugungseinheiten in Europa.", "power_grid", "B",
    "Koordinierte Angriffe auf mehrere Anlagen gleichzeitig wuerden Cluster von ungeplanten Ausfaellen erzeugen.", "up", "hours",
    ["Revisionen", "Hitzewellen", "Kuehlwasserknappheit"], "medium", 2, [ENTSOE_OUT]))
a(G("grid.cross_border_flow_anomaly", "Grenzueberschreitende Stromfluesse", "Physische Stromfluesse zwischen Laendern; ungewoehnliche Muster zeigen Netzstress.", "power_grid", "B",
    "Plotzliche Umkehr oder Abriss von Flows kann Folge von Leitungsabschaltungen oder Steuerungsproblemen sein.", "up", "hours",
    ["Marktgetriebene Schwankungen", "Wartung"], "medium", 3, [ENTSOE("https://web-api.tp.entsoe.eu/api?documentType=A11&in_Domain=10Y1001A1001A83F&out_Domain=10YFR-RTE------C&periodStart=202611010000&periodEnd=202611170000&securityToken=KEY", "Physical flows A11")]))
a(G("grid.price_spike_de", "Day-Ahead-Strompreis-Spruenge", "Extreme Preisausschlaege am Strommarkt.", "power_grid", "A",
    "Marktteilnehmer mit Informationsvorsprung oder knappe Reserve spiegeln sich im Preis; Stoerung der Handelssysteme zeigt sich als fehlende Daten.", "up", "hours",
    ["Dunkelflaute", "Gaspreis", "Feiertage"], "medium", 3, [EC_PRICE]))
a(G("grid.us_demand_balancing_authorities", "US Last je Balancing Authority", "Stuendliche Stromnachfrage und Erzeugung in US-Regionen.", "power_grid", "B",
    "Plotzliche Nachfrage-Einbrueche in mehreren Regionen oder fehlende Meldungen sind Brotkrumen koordinierter Ausfaelle.", "down", "coincident",
    ["Hurrikane", "Kaltefront", "EIA-Datenluecken"], "low", 2, [USEIA]))
a(G("grid.us_outage_customers", "US Stromausfaelle (Kunden ohne Strom)", "Gesamtzahl der Haushalte ohne Strom in den USA.", "power_grid", "B",
    "Ein ueberregionaler Anstieg ohne Unwetter wuerde auf Angriffe hindeuten.", "up", "coincident",
    ["Unwetter", "Hitzewelle"], "low", 3, [POWEROUT]))
a(G("grid.eu_outage_reports_crowd", "Crowd-Stoerungsmeldungen Strom DE", "Anzahl der Nutzermeldungen zu Stromausfaellen.", "power_grid", "D",
    "Vorlaeufer oder Begleiter grosser Ausfaelle, rasch sichtbar.", "up", "coincident",
    ["Lokale Bauarbeiten", "Sturm"], "high", 4, [STATUS_RSS]))
a(G("grid.solar_wind_feedin_sudden_drop", "Plotzlicher Einbruch Einspeisung Wind/PV", "Einspeisung erneuerbarer Energien faellt ohne Wetterursache.", "power_grid", "A",
    "Wechselrichter und Fernsteuerungen sind Angriffsziel (Sicherheitsluecken bei Wechselrichtern); gleichzeitige Abschaltung wuerde Einspeisung verringern.", "down", "coincident",
    ["Wolkenfronten", "Abregelung", "Sturmabschaltung"], "low", 2, [EC_PUB, ENTSOE("https://web-api.tp.entsoe.eu/api?documentType=A75&processType=A16&in_Domain=10Y1001A1001A83F&periodStart=202611010000&periodEnd=202611170000&securityToken=KEY", "Ist-Erzeugung nach Typ A75")]))

# ---------- Gas ----------
a(G("gas.storage_level_anomaly_eu", "Gasspeicher-Fuellstand und Ausspeicherung", "Wie voll die Gasspeicher sind und wie schnell sie sich leeren.", "gas", "B",
    "Ungewoehnliche Ein-/Ausspeicherung kann Notfall oder Sabotage zeigen.", "up", "days",
    ["Winterwetter", "Marktpreise"], "low", 2, [AGSI]))
a(G("gas.cross_border_flow_drop", "Gasfluss-Einbruch an Grenzpunkten", "Physischer Gasfluss an europaeischen Grenzen.", "gas", "B",
    "Plotzliche Abrisse an Verdichterstationen koennen OT-Angriffe oder Sabotage anzeigen.", "down", "hours",
    ["Wartung", "Nominierungswechsel"], "low", 3, [ENTSOG]))
a(G("gas.lng_sendout_anomaly", "LNG-Terminal Send-out", "Abgabe aus LNG-Terminals ins Netz.", "gas", "B",
    "Ausfall mehrerer Terminals gleichzeitig waere auffaellig.", "down", "hours",
    ["Schiffsverspaetungen", "Wetter"], "low", 4, [ALSI]))

# ---------- Luftverkehr ----------
a(G("aviation.us_ground_stops", "US Ground Stops und Verspaetungsprogramme", "Wie viele US-Flughaefen derzeit Flugverbote oder Verspaetungsprogramme haben.", "aviation", "B",
    "IT-Ausfaelle bei Airlines oder FAA-Systemen (z.B. NOTAM-Ausfall Jan 2023) erzeugen schlagartig landesweite Ground Stops.", "up", "coincident",
    ["Gewitter", "Nebel", "Personalmangel Tower"], "low", 1, [FAA]))
a(G("aviation.notam_gps_interference", "NOTAMs zu GPS-Ausfall", "Anzahl der Flugwarnungen zu gestoertem GPS.", "aviation", "C",
    "Zunahme zeigt Stoerungen oder Tests; Kontext-Layer.", "up", "days",
    ["Militaerische Uebungen", "Tests"], "medium", 3, [NOTAM]))
a(G("aviation.eurocontrol_delays_it", "Eurocontrol Verspaetungen durch ATC-Systeme", "Verspaetungsminuten wegen Flugsicherungsausruestung.", "aviation", "B",
    "Cyberangriff auf Flugsicherung zeigt sich als Spitze in Equipment-bedingten Verspaetungen.", "up", "coincident",
    ["Technische Pannen", "Streik"], "low", 3, [EURO]))
a(G("aviation.opensky_flight_count", "Flugbewegungen Aggregat", "Anzahl der Flugzeuge in der Luft ueber einem Gebiet.", "aviation", "A",
    "Plotzliche Abnahme zeigt Luftraumsperrungen oder Ausfall von Flugsicherung.", "down", "coincident",
    ["Feiertage", "Wetter", "Empfaengerabdeckung"], "low", 2, [OPENSKY]))
a(G("aviation.adsb_coverage_loss", "ADS-B Abdeckungsverlust", "Anteil der sichtbaren Flugzeuge verglichen mit Fluegen laut Fahrplan.", "aviation", "A",
    "Ausfall oder Stoerung von Empfaengernetz oder Transponder-Spoofing bemerkbar.", "down", "hours",
    ["Empfaenger offline", "Wartung"], "medium", 4, [OPENSKY]))
a(G("aviation.cancellation_rate", "Flugausfallquote", "Anteil abgesagter Fluege an Fahrplan.", "aviation", "B",
    "Gleichzeitige Ausfaelle bei mehreren Airlines deuten auf Systemausfall.", "up", "coincident",
    ["Streik", "Wetter"], "low", 3, [S("flightaware", "FlightAware AeroAPI", "https://www.flightaware.com/commercial/aeroapi/", "https://aeroapi.flightaware.com/aeroapi/disruption_counts/origin", auth="paid", lat="Minuten", hist="Tage", lic="kommerziell", note="Disruption Counts je Flughafen", cost="paid")]))

# ---------- GNSS ----------
a(G("gnss.jamming_map_aggregate", "GPS-Stoerungsflaeche global", "Wie viel Luftraum durch GPS-Stoerung betroffen ist.", "gnss", "A",
    "Ausweitung von Jamming ausserhalb bekannter Hotspots ist Hinweis auf elektronische Kriegsfuehrung; Teil hybrider Eskalation.", "up", "days",
    ["Militaerische Konflikte", "Schutzmassnahmen von Staaten"], "medium", 2, [GPSJAM]))
a(G("gnss.gps_nanu_count", "GPS NANU-Meldungen", "Hinweise des GPS-Betreibers zu Satellitenausfaellen.", "gnss", "C",
    "Haeufung geplanter/ungeplanter Ausfaelle; Kontextsignal.", "up", "days",
    ["Wartung", "Orbitmanoever"], "low", 4, [NANU]))
a(G("gnss.galileo_service_status", "Galileo Servicemeldungen", "Statusmeldungen zum EU-Satellitennavigationssystem.", "gnss", "B",
    "Ausfaelle (wie Juli 2019) zeigen Systemfehler oder Angriffe.", "up", "coincident",
    ["Bodensegmentfehler"], "low", 3, [S("gsc-galileo", "GSC Galileo Notices", "https://www.gsc-europa.eu/system-service-status/constellation-information", "https://www.gsc-europa.eu/system-service-status/constellation-information", access="scrape", fmt="html", lat="Stunden", hist="Archiv", lic="EU, unklar", note="NAGUs und Systemstatus")]))
a(G("gnss.timing_drift_ntp", "Zeitserver-Abweichung (NTP-Pool)", "Wie viele NTP-Server schlechte Zeit melden.", "gnss", "A",
    "GNSS-Zeit ist Basis fuer Netzzeit; Spoofing wuerde NTP-Offsets verursachen.", "up", "hours",
    ["Serverwartung"], "medium", 4, [RADIO]))
a(G("gnss.ionosphere_scintillation", "Ionosphaerenstoerung", "Natuerliche Stoerungen von GNSS durch Weltraumwetter.", "gnss", "A",
    "Banale Ursache fuer GNSS-Fehler; dient zum Ausfiltern.", "up", "coincident",
    ["Sonnenstuerme"], "low", 3, [SWPC_KP]))

# ---------- Schifffahrt ----------
a(G("maritime.ais_position_jumps", "AIS-Positionssprunge", "Anteil der Schiffe mit unplausiblen Positionssprungen.", "maritime", "A",
    "Spoofing/Jamming in Haefen und Seegebieten sichtbar.", "up", "days",
    ["Technische Fehler", "Dunkelschiffe"], "medium", 3, [AIS]))
a(G("maritime.port_congestion", "Hafenstau", "Anzahl wartender Schiffe vor Haefen.", "maritime", "A",
    "Hafen-IT-Ausfaelle (z.B. NotPetya Maersk) lassen Wartezeiten steigen.", "up", "hours",
    ["Wetter", "Streik"], "medium", 3, [AIS]))
a(G("maritime.navarea_warnings", "NAVAREA-Warnungen mit GPS-Bezug", "Seewarnungen zu Navigationsstoerungen.", "maritime", "C",
    "Kontext fuer Stoerungen.", "up", "days",
    ["Uebungen"], "medium", 4, [NAVAREA]))

# ---------- Bahn ----------
a(G("rail.db_cancellation_rate", "Zugausfallquote Deutsche Bahn", "Anteil der ausgefallenen Zuege.", "rail", "B",
    "Cyberangriffe auf Stellwerke oder IT (Oktober 2022 GSM-R Sabotage) zeigen sich in landesweitem Ausfall.", "up", "coincident",
    ["Unwetter", "Streik", "Bauarbeiten"], "low", 2, [DB_ST, GTFSRT]))
a(G("rail.gtfsrt_feed_availability", "Verfuegbarkeit Echtzeit-Fahrplanfeeds", "Ob Verkehrsunternehmen noch Echtzeitdaten liefern.", "rail", "B",
    "Ausfall der Feeds vieler Betreiber gleichzeitig zeigt IT-Stoerung.", "down", "coincident",
    ["Wartung", "Umstellung"], "low", 3, [GTFSRT]))
a(G("rail.gsmr_outage", "Bahnfunk-Stoerungen", "Meldungen zu GSM-R-/Stellwerksausfaellen.", "rail", "D",
    "Sabotage 2022 betraf Bahnfunk; Crowd-Berichte.", "up", "coincident",
    ["Kabeldiebstahl"], "high", 4, [STATUS_RSS]))

# ---------- Telekom ----------
a(G("telecom.country_outage_ioda", "Internet-Ausfall je Land (IODA)", "Messung ob ein Land von aussen erreichbar bleibt.", "telecom", "A",
    "Unabhaengige Messung aus BGP, Probing und Darknet-Telescope.", "down", "coincident",
    ["Seekabelbruch", "Zensur", "Stromausfall"], "low", 1, [IODA]))
a(G("telecom.cloudflare_traffic_anomaly", "Traffic-Anomalien Cloudflare Radar", "Plotzliche Verkehrsveraenderung eines Landes.", "telecom", "A",
    "Ausfaelle bei Providern zeigen sich als Einbruch.", "down", "coincident",
    ["Feiertage", "Provider-Probleme"], "low", 2, [CLOUDFLARE_RADAR]))
a(G("telecom.atlas_probe_latency", "Latenz und Verlust RIPE Atlas", "Ping-Laufzeiten und Paketverlust zu Infrastruktur.", "telecom", "A",
    "Verschlechterung vor/waehrend Angriffen auf Backbone.", "up", "minutes",
    ["Routing-Aenderungen"], "low", 2, [RIPE]))
a(G("telecom.mobile_outage_crowd", "Mobilfunk-Stoerungsmeldungen", "Crowd-Meldungen zu Mobilfunkausfaellen.", "telecom", "D",
    "Schnelles Indiz fuer Netzausfaelle.", "up", "coincident",
    ["Lokale Stoerung", "Bugs"], "high", 3, [STATUS_RSS]))
a(G("telecom.fcc_dirs_reports", "FCC DIRS Meldungen", "Pflichtmeldungen zu Netzausfaellen in Katastrophen.", "telecom", "B",
    "Nur bei Aktivierung; zeigt betroffene Funknetze.", "up", "coincident",
    ["Naturkatastrophen"], "low", 4, [S("fcc-dirs", "FCC DIRS Summary", "https://www.fcc.gov/disaster-information-reporting-system-dirs-0", "https://www.fcc.gov/disaster-information-reporting-system-dirs-0", access="scrape", fmt="html", lat="taeglich bei Aktivierung", hist="Archiv zu Ereignissen", lic="gemeinfrei", note="Zusammenfassungen")]))
a(G("telecom.emergency_number_outage", "Notruf-Stoerungen 112/911", "Meldungen von Behoerden zum Ausfall von Notrufnummern.", "telecom", "B",
    "Notrufausfaelle zeigen Kernnetzprobleme.", "up", "coincident",
    ["Technische Pannen"], "medium", 3, [NINA, S("fcc-psap", "FCC 911 Outage Reports", "https://www.fcc.gov/", "https://www.fcc.gov/public-safety-and-homeland-security/policy-and-licensing-division/9-1-1-reliability", access="scrape", fmt="html", lat="Wochen", hist="Archiv", lic="gemeinfrei", note="Stoerungsmeldungen")]))

# ---------- OT/ICS ----------
a(G("ics.cisa_advisory_rate", "CISA ICS-Advisories pro Woche", "Wie viele neue Sicherheitshinweise zu Industrieanlagen erscheinen.", "ics", "C",
    "Haeufung kann Kampagnen anzeigen; nur Kontext.", "up", "weeks",
    ["Patch-Zyklen"], "low", 4, [CISA_ICS]))
a(G("ics.vendor_advisories", "Hersteller-Advisories Siemens/Schneider", "Sicherheitsmeldungen grosser OT-Hersteller.", "ics", "C",
    "Kontext.", "up", "weeks",
    ["Patch Tuesday"], "low", 5, [SIEMENS, SCHNEIDER]))
a(G("ics.kev_ot_additions", "Ausgenutzte OT-Luecken (KEV)", "Neu als aktiv ausgenutzt gelistete Schwachstellen.", "ics", "C",
    "Aktive Ausnutzung von Edge-/OT-Produkten ist Vorstufe von Kampagnen.", "up", "weeks",
    ["Routine-Aufnahmen"], "low", 3, [KEV]))
a(G("ics.bsi_warnings", "BSI-CERT-Warnungen", "Warnungen des deutschen CERT.", "ics", "C",
    "Kontext fuer Deutschland.", "up", "weeks",
    ["Routine"], "low", 5, [BSI]))
a(G("ics.exposed_modbus_trend", "Oeffentlich sichtbare ICS-Geraete", "Wie viele Industriesteuerungen offen im Netz erreichbar sind.", "ics", "A",
    "Plotzlicher Rueckgang kann Abschottung nach Warnung zeigen, Zunahme Fehlkonfiguration.", "down", "weeks",
    ["Scanner-Aenderungen"], "medium", 5, [SHODAN, CENSYS], "Nur Konsum fertiger Counts."))
a(G("ics.port_scanning_ot_protocols", "Scan-Aktivitaet auf OT-Ports", "Wie oft Honeypots Scans auf Modbus/S7/DNP3 sehen.", "ics", "A",
    "Aufklaerung vor Angriffen.", "up", "weeks",
    ["Forscher-Scans"], "medium", 3, [ISC, GREYNOISE]))

# ---------- Satelliten / Weltraumwetter ----------
a(G("space.geomagnetic_kp", "Kp-Index Geomagnetik", "Staerke geomagnetischer Stuerme.", "space_weather", "A",
    "Banale Ursache fuer GNSS-/Funk-/Netz-Stoerungen; ausfiltern.", "up", "coincident",
    ["Sonnenaktivitaet"], "low", 1, [SWPC_KP]))
a(G("space.xray_flux", "Roentgenfluss Sonne", "Sonneneruptionen, die Funk stoeren.", "space_weather", "A",
    "Banale Ursache fuer HF-Funkausfaelle.", "up", "coincident",
    ["Flares"], "low", 2, [SPACEWX]))
a(G("space.starlink_constellation", "Starlink-Konstellation", "Anzahl aktiver Starlink-Satelliten und Bahnhoehen.", "satellite", "A",
    "Massenhafte Bahnabsenkung oder Ausfall waere ein Brotkrumen fuer Satelliten-Stoerung.", "down", "days",
    ["Sonnenaktivitaet", "Neustarts"], "low", 4, [CELESTRAK, SPACETRACK]))
a(G("space.satellite_decay_events", "Satellitenzerfall und Anomalien", "Unerwartete Zerfaelle.", "satellite", "A",
    "Anomalien bei Kommunikationssatelliten (Viasat 2022).", "up", "days",
    ["Normaler Zerfall"], "low", 5, [SPACETRACK]))

# ---------- Warnsysteme / Rundfunk ----------
a(G("warn.mowas_alert_count", "Aktive MoWaS/NINA-Warnungen", "Anzahl behoerdlicher Warnmeldungen.", "warning", "C",
    "Kontext; Warntag-Tests als banale Ursache.", "up", "coincident",
    ["Warntag", "Unwetter"], "low", 3, [NINA]))
a(G("warn.ipaws_test_vs_actual", "IPAWS-Alerts echt gegen Test", "Anteil echter Warnungen an allen Alerts.", "warning", "C",
    "Falschalarme durch Hacks (EAS 2013) moeglich.", "up", "coincident",
    ["Routinetests"], "medium", 4, [IPAWS]))
a(G("warn.dwd_weather_alerts", "DWD-Wetterwarnungen", "Aktive Unwetterwarnungen.", "warning", "C",
    "Banale Ursache fuer Stromausfaelle und Bahnstoerungen.", "up", "coincident",
    ["Wetter"], "low", 2, [DWD]))
a(G("warn.earthquakes", "Erdbeben", "Erdbeben weltweit.", "warning", "A",
    "Banale Ursache fuer Infrastrukturausfaelle (Seekabel).", "up", "coincident",
    ["Natuerlich"], "low", 4, [EMSC]))

# ---------- Ungewoehnliche Proxys ----------
a(G("proxy.payment_terminal_outage", "Kartenzahlungs-Stoerungen im Handel", "Crowd-Berichte ueber ausgefallene Kartenzahlung.", "retail", "D",
    "Zahlungsdienstleister sind zentrale Abhaengigkeit; Ausfall zeigt breite Stoerung.", "up", "coincident",
    ["Wartungsfenster"], "high", 3, [STATUS_RSS]))
a(G("proxy.fuel_station_outage", "Tankstellen-Ausfaelle", "Meldungen zu geschlossenen oder nicht zahlungsfaehigen Tankstellen.", "retail", "D",
    "Colonial-Pipeline-Angriff 2021 fuehrte zu leeren Tankstellen.", "up", "days",
    ["Lieferengpaesse"], "medium", 4, [S("tankerkoenig", "Tankerkoenig API", "https://creativecommons.tankerkoenig.de/", "https://creativecommons.tankerkoenig.de/json/list.php?lat=51.4&lng=7.5&rad=5&sort=dist&type=all&apikey=KEY", auth="free-key", lat="Minuten", hist="Preis-Historie als CSV-Dump", lic="CC BY 4.0", note="Tankstellen offen/zu und Preis")]))
a(G("proxy.traffic_lights_outage", "Ampel-/Verkehrsleitsysteme", "Meldungen ueber ausgefallene Ampeln.", "traffic", "D",
    "Steuerungs-Ausfaelle in Staedten.", "up", "coincident",
    ["Stromausfall lokal"], "high", 5, [S("autobahn-api", "Autobahn App API", "https://autobahn.api.bund.dev/", "https://verkehr.autobahn.de/o/autobahn/A1/services/warning", lat="Minuten", hist="nur Live", lic="Datenlizenz Deutschland, unklar", note="Stoermeldungen Autobahn")]))
a(G("proxy.hospital_it_outage", "Krankenhaus-IT-Ausfaelle", "Abmeldungen von Notaufnahmen.", "health", "B",
    "Ransomware trifft Kliniken haeufig.", "up", "coincident",
    ["Ueberlastung"], "medium", 4, [S("ivena", "IVENA / Leitstellen-Abmeldungen", "https://www.ivena.de/", "https://www.ivena.de/", access="scrape", fmt="html", lat="Minuten", hist="keine", lic="unklar", note="oft nicht oeffentlich")]))
a(G("proxy.water_utility_alerts", "Wasserversorger-Warnungen", "Kochwarnungen und Ausfaelle.", "water", "B",
    "OT-Angriffe auf Wasserwerke (Oldsmar 2021).", "up", "coincident",
    ["Rohrbruch"], "medium", 5, [S("epa-sdwis", "EPA SDWIS / ECHO", "https://echo.epa.gov/tools/web-services", "https://echodata.epa.gov/echo/sdw_rest_services.get_systems", lat="Wochen", hist="mehrjaehrig", lic="gemeinfrei", note="Verstoesse")]))

ideas = [
    "Idee: Zahl der Strom-Redispatch-Massnahmen taeglich (Quelle nicht geprueft).",
    "Idee: Anzahl von Stromzaehler-Fernabschaltungen (keine oeffentliche Quelle).",
    "Idee: Notstromdiesel-Verkaufszahlen (keine offene Quelle).",
    "Idee: Zeitzeichensender DCF77-Ausfaelle (keine strukturierte Quelle bekannt).",
]

out = {"subdomain": "Kritische physische Infrastruktur und OT", "generated": "2026-11-17", "signals": L, "ideas_without_source": ideas}
json.dump(out, open("/home/claude/signal-radar/catalog/research/cyber-physical-ot.json", "w"), ensure_ascii=False, indent=1)
print(len(L))
