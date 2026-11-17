#!/usr/bin/env python3
"""Konsolidiert die drei Kriegs-Recherche-Dateien (plus GitHub-Datensätze und Konfliktherde) zu
Signal-Katalog, erweiterter Quellen-Matrix, Bau-Reihenfolge, Doku-Abschnitten und Szenario-Vorschlag.

Aufruf:  python3 -I scripts/consolidate_war.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_cyber.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Idempotent: sources.json und die beiden Doku-Dateien werden ergänzt, frühere war-Ergänzungen vorher entfernt.
Achtung: consolidate_cyber.py überschreibt sources.json und die Doku-Dateien komplett. Nach einem
erneuten Lauf des Cyber-Skripts dieses Skript noch einmal ausführen.
"""
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

from key_stand import TABLE_HEADER, TABLE_SEP, env_for_source, format_env_cell, stand_for

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = ['war-military', 'war-markets-shipping', 'war-states-events']
CAT = os.path.join(ROOT, 'catalog')
OUT_SIGNALS = os.path.join(CAT, 'signals', 'war.json')
OUT_SOURCES = os.path.join(CAT, 'sources.json')
OUT_BUILD = os.path.join(CAT, 'war-build-order.json')
OUT_SCEN = os.path.join(CAT, 'research', 'war-scenario-def.json')
OUT_KEYS = os.path.join(ROOT, 'docs', 'KEYS-NEEDED.md')
OUT_LIC = os.path.join(ROOT, 'docs', 'LICENSE-TODO.md')
CYBER_SIGNALS = os.path.join(CAT, 'signals', 'cyber.json')
SECTION = '## Szenario Kriegseskalation'

DOMAINS = ['military', 'conflict', 'shipping', 'connectivity', 'government', 'energy', 'markets', 'attention']
BUILD_N = 30
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2   # Klasse C (Aussagen, auch Angaben von Kriegsparteien über Erfolge/Verluste): höchstens 0,2

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs, die dieselbe Quelle meinen -> kanonische ID (bevorzugt die ID, die es in sources.json schon gibt)
ALIAS = {
    'adsb-lol-type': 'adsb-lol', 'cloudflare-radar': 'cf-radar', 'gie-agsi': 'agsi', 'gie-alsi': 'alsi',
    'portwatch': 'imf-portwatch', 'lma-jwc': 'jwc', 'ted-eu': 'ted', 'eurocontrol-opendata': 'eurocontrol',
    'gdelt': 'gdelt-doc', 'us-embassy-alerts': 'us-travel-advisories',
    'ukr-sirens-github': 'github-air-raid-sirens', 'ukr-losses-github': 'github-ukraine-losses',
    'github-viina': 'viina', 'google-trends': 'google-trends-unofficial', 'nga-msi': 'navarea',
    'usgs-fdsn': 'usgs', 'telegeography': 'subcable', 'nina-warn': 'nina-mowas', 'gh-search': 'github-rest',
    'ecb-sdw': 'ecb-data', 'defillama-stables': 'defillama',
}
# Quellen, die laut Recherche nicht verwendbar sind (werden verworfen)
DROP_SOURCES = {'tw-adiz-github': 'Repo enthält laut Prüfung keinen ADIZ-Datensatz (Streamlit-Template).'}
# Quelle aus einem Signal in ein passenderes verschieben: (Slug, Quelle) -> Ziel-Slug
SOURCE_MOVE = {('fuel_food_prices', 'github-datasets-brent'): 'brent_price'}
# Source-ID -> Collector-ID, wo der gebaute Collector anders heißt
COLLECTOR = {'cf-radar': 'cloudflare-radar'}
# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {'taiwan_adiz': 'tw-mnd', 'acled_events_weekly': 'acled', 'gnss_interference': 'gpsjam', 'ua_air_alerts': 'github-air-raid-sirens', 'brent_price': 'yahoo-chart'}
# Auf raw.githubusercontent.com liegende Quellen, am 17.11.2026 per curl als aktuell geprüft (letzter Eintrag)
GITHUB_CURRENT = {
    'github-air-raid-sirens': 'volunteer_data_en.csv: letzter Alarm 16.11.2026',
    'oref-github': 'israel-alerts.csv: letzter Eintrag 08.11.2026',
    'github-ukraine-losses': 'russia_losses_*.json: letzter Eintrag 16.11.2026',
    'github-deepstate': 'Tagesdatei 20261116 abrufbar (HTTP 200)',
    'github-datasets-brent': 'brent-daily.csv: letzte Zeile 11.11.2026',
}
# auf GitHub, aber nicht aktuell / nicht direkt nutzbar (Hinweis in notes)
GITHUB_STALE = {
    'oryx-github': 'GitHub-Spiegel endet 2025-08 (geprüft 17.11.2026); Original auf oryxspioenkop.com.',
    'viina': 'raw-URL liefert nur einen Git-LFS-Zeiger; Daten über git lfs oder Media-URL holen.',
}
STALE_ENDPOINT_NOTE = {
    'github-air-raid-sirens': 'official_data_en.csv endet 07.09.2026; volunteer_data_en.csv ist aktuell.',
}

# Duplikate: Slug (oder Slug@Recherche-Segment) -> Slug des führenden Eintrags
MERGE = {
    'ukraine_sirens': 'ua_air_alerts',
    'acled_weekly': 'acled_events_weekly',
    'hormuz_transits@maritime': 'hormuz_transits',
    'shipping_hormuz': 'hormuz_transits',
    'suez_bab_el_mandeb': 'chokepoint_suez_babelmandeb',
    'taiwan_strait_transits': 'chokepoint_taiwan_strait',
    'ais_gaps_hormuz': 'ais_gaps_gulf',
    'gnss_jamming_gulf_baltic': 'jamming_gulf',
    'airspace_flights': 'airspace_closures',
    'airport_closures': 'faa_closures',
    'baltic_cable_cuts': 'undersea_cables_baltic',
    'war_risk_listed_areas@connectivity': 'war_risk_listed_areas',
    'internet_outage_ukraine': 'ioda_ua',
    'grid_baltic_ukraine': 'power_grid_frontline',
    'gas_storage_war': 'eu_gas_storage',
    'gas_storage_ua_eu': 'eu_gas_storage',
    'oil_war_premium': 'brent_price',
    'defense_gold': 'defense_stocks_eu',
    'wikipedia_war_pages': 'wiki_hotspot_articles',
    'wikipedia_hormuz': 'wiki_hotspot_articles',
    'trends_shelter': 'search_trends',
    'procurement_emergency': 'defense_procurement',
}

# Recherche-Segment (zweiter ID-Teil) -> Ziel-Domain, Einzel-Overrides danach
DOMAIN_DEFAULT = {
    'adsb': 'military', 'airspace': 'military', 'notam': 'military', 'gnss': 'military', 'space': 'military',
    'missile': 'military', 'proxy': 'military', 'fire': 'conflict', 'seismic': 'conflict',
    'infrasound': 'conflict', 'alert': 'conflict', 'event': 'conflict', 'maritime': 'shipping',
    'market': 'markets', 'markets': 'markets', 'infra': 'connectivity', 'shipping': 'shipping',
    'government': 'government', 'conflict': 'conflict', 'connectivity': 'connectivity', 'attention': 'attention',
}
DOMAIN_OVERRIDE = {
    'taiwan_adiz': 'military', 'ammo_trade': 'government', 'ctbto_statements': 'conflict',
    'eu_gas_storage': 'energy', 'lng_terminals': 'energy', 'gas_flows_entsog': 'energy', 'power_prices': 'energy',
    'us_spr_stocks': 'energy', 'dod_contract_obligations': 'government', 'defense_procurement': 'government',
    'fuel_bunker_prices': 'markets', 'drone_airport_closures_eu': 'military', 'gnss_interference': 'military',
    'airspace_closures': 'military', 'faa_closures': 'military', 'fuel_food_prices': 'markets',
    'school_closures': 'government', 'pharmacy_shortages': 'government',
}
CONTEXT = set()  # reine Störfaktor-Filter aus der Recherche (siehe EXTRA für abgeleitete)

# Abgeleitete Signale: eine in der Recherche genannte Quelle wird eigenes Signal (z. B. Störfaktor-Filter)
EXTRA = {
    'geomagnetic_kp': {
        'from': ('jamming_baltic', 'noaa-swpc'), 'domain': 'context',
        'name': 'Weltraumwetter (Kp-Index)',
        'plain': 'Misst Sonnenstürme; sie können GPS stören und werden deshalb aus den Störsignalen herausgerechnet.',
        'rationale': 'Laut Recherche zur Bereinigung von GNSS-Störsignalen: hoher Kp-Index erklärt GPS-Störungen ohne Störsender.',
        'banal': ['Sonnenaktivität im Elfjahres-Zyklus'], 'direction': 'up', 'kind': 'gauge', 'unit': 'Kp',
    },
}

# Evidenzklasse korrigieren: Angaben einer Kriegspartei über eigene Erfolge/gegnerische Verluste = C
# baltic_drone_warnings: einzige schlüsselfreie Quelle ist GDELT (Nachrichtenzählung) -> Aufmerksamkeit, nicht Messung
EVIDENCE_OVERRIDE = {'baltic_drone_warnings': 'D'}
DIRECTION_OVERRIDE = {'us_10y_yield': 'both', 'panama_suez_substitution': 'both', 'baltic_ais_traffic': 'down',
                      'lng_terminals': 'both', 'gas_flows_entsog': 'down', 'insider_form4_defense': 'both'}

WEIGHT_DEFAULT = {'military': 0.55, 'conflict': 0.55, 'shipping': 0.5, 'connectivity': 0.6, 'government': 0.45,
                  'energy': 0.4, 'markets': 0.3, 'attention': 0.45}
WEIGHT = {
    # military
    'airspace_closures': 0.9, 'avoidance_iran_gulf': 0.85, 'avoidance_taiwan_strait': 0.8,
    'avoidance_black_sea': 0.75, 'tanker_count': 0.7, 'mil_count_hormuz': 0.65, 'faa_closures': 0.65,
    'mil_count_baltic': 0.6, 'mil_count_taiwan': 0.6, 'isr_recon': 0.6, 'airlift_c17': 0.6,
    'jamming_gulf': 0.6, 'jamming_east_asia': 0.6, 'asat_debris': 0.6, 'taiwan_adiz': 0.6,
    'satellite_imagery_airbases': 0.6, 'civ_count_ukraine_edge': 0.55, 'jamming_baltic': 0.55,
    'drone_hale': 0.5, 'russia_missile_ranges': 0.5, 'jamming_black_sea': 0.5, 'ballistic_launches_log': 0.5,
    'drone_airport_closures_eu': 0.5, 'gnss_interference': 0.5, 'navarea_warnings': 0.45,
    'gov_leadership_flights': 0.4, 'mil_dark_ratio': 0.4, 'sat_maneuvers': 0.4, 'launches_by_country': 0.3,
    'cosmos_launches': 0.3,
    # conflict
    'nk_test_site': 0.85, 'novaya_zemlya': 0.8, 'israel_oref': 0.8, 'ua_air_alerts': 0.75,
    'firms_gulf_energy': 0.75, 'firms_korea_dmz': 0.7, 'baltic_drone_warnings': 0.5,
    'fires_infrastructure': 0.65, 'firms_front_ukraine': 0.6, 'firms_refineries_russia': 0.6, 'explosions': 0.6,
    'border_crossings': 0.55, 'explosions_ukraine': 0.5, 'acled_events_weekly': 0.5, 'ucdp_candidate': 0.5,
    'displacement_refugees': 0.45, 'reliefweb_reports': 0.4, 'oryx_losses': 0.3,
    # shipping
    'hormuz_transits': 0.9, 'chokepoint_taiwan_strait': 0.85, 'chokepoint_suez_babelmandeb': 0.8,
    'war_risk_listed_areas': 0.75, 'chokepoint_bosporus_blacksea': 0.7, 'maritime_incidents': 0.7,
    'port_activity_gulf_baltic': 0.6, 'ais_gaps_gulf': 0.6, 'p_and_i_circulars': 0.6,
    'baltic_ais_traffic': 0.45, 'baltic_dark_vessels': 0.45, 'baltic_dry_dirty_tanker': 0.45,
    'freight_container': 0.35, 'panama_suez_substitution': 0.2,
    # connectivity
    'ioda_ir': 0.85, 'ioda_tw': 0.85, 'ioda_il': 0.8, 'ioda_ua': 0.8, 'ioda_ru': 0.75,
    'gulf_states_internet': 0.75, 'undersea_cables_baltic': 0.6, 'power_grid_frontline': 0.6,
    'traffic_by_network': 0.55,
    # government
    'ordered_departure': 0.8, 'evac_flights': 0.75, 'aa_hotspot_changes': 0.7, 'unsc_emergency_meetings': 0.65,
    'aa_warning_count': 0.6, 'us_level4_count': 0.6, 'uk_fcdo_changes': 0.6, 'mobilization_registers': 0.6,
    'sanctions_ofac_rate': 0.5, 'sanctions_eu_uk': 0.5, 'civil_defense_warnings': 0.5,
    'defense_procurement': 0.45, 'unsc_vetoes': 0.4, 'export_controls': 0.4, 'school_closures': 0.4,
    'sanctions_delistings': 0.3, 'civil_shelter_programs': 0.3, 'dod_contract_obligations': 0.3,
    'pharmacy_shortages': 0.3, 'ammo_trade': 0.2,
    # energy
    'gas_flows_entsog': 0.6, 'lng_terminals': 0.45, 'us_spr_stocks': 0.45, 'eu_gas_storage': 0.4,
    'power_prices': 0.3,
    # markets
    'conflict_currencies': 0.6, 'brent_price': 0.55, 'brent_term_structure': 0.55, 'gas_ttf': 0.55,
    'sovereign_cds_proxy': 0.55, 'ovx': 0.5, 'defense_stocks_eu': 0.5, 'tanker_equities': 0.5,
    'wti_price': 0.45, 'defense_etf_us': 0.45, 'gas_henry_vs_ttf': 0.4, 'defense_stocks_us': 0.4,
    'container_liner_equities': 0.4, 'wheat_prices': 0.4, 'fuel_food_prices': 0.4, 'fuel_bunker_prices': 0.35,
    'insider_form4_defense': 0.35, 'gold_price': 0.3, 'safe_haven_chf': 0.3, 'gvz_and_move': 0.3,
    'breakeven_inflation': 0.3, 'positioning_cftc': 0.3, 'fertilizer_prices': 0.3, 'gold_etf_holdings': 0.25,
    'safe_haven_jpy': 0.25, 'vix': 0.25, 'bund_yield_spread': 0.25, 'crypto_stablecoin_flows': 0.25,
    'us_10y_yield': 0.2, 'hy_credit_spread': 0.2, 'central_bank_gold': 0.2, 'food_prices': 0.2,
    # attention (Klasse D: 0.3..0.7)
    'prediction_markets_war': 0.6, 'rial_black_market': 0.6, 'frontline_area_change': 0.6,
    'prediction_volume_spike': 0.55, 'gdelt_fight_events': 0.55, 'gdelt_tone_volume_hotspots': 0.5,
    'wiki_ww3': 0.5, 'wiki_conscription': 0.5, 'wiki_civil_protection': 0.5, 'wiki_hotspot_articles': 0.5,
    'search_trends': 0.5, 'gdelt_goldstein': 0.45, 'gdelt_mass_violence': 0.45, 'gdelt_coverage_share': 0.45,
    'telegram_alert_channels': 0.45, 'viina_events': 0.4, 'social_hashtags': 0.4, 'blood_donation_calls': 0.4,
    'wiki_edit_rate': 0.4, 'hackernews_mentions': 0.35, 'reservist_portals': 0.35, 'gdelt_energy_tone': 0.35,
    'pizza_index': 0.3, 'shelter_osm': 0.3,
}
ROLLING_DOMAINS = {'conflict', 'shipping', 'markets', 'energy', 'context'}

# Laien-Texte, wo die Recherche nur Stichworte liefert
PLAIN = {
    'mil_count_hormuz': 'Zählt, wie viele Militärflugzeuge über dem Persischen Golf und dem Arabischen Meer sichtbar sind.',
    'tanker_count': 'Zählt Tankflugzeuge in der Luft; viele davon zugleich deuten auf große Luftoperationen hin.',
    'isr_recon': 'Zählt Aufklärungs- und Frühwarnflugzeuge in der Luft; mehr davon heißt, dass genauer hingeschaut wird.',
    'airlift_c17': 'Zählt große Transportflugzeuge; viele Flüge zugleich können Truppen- oder Materialverlegungen bedeuten.',
    'drone_hale': 'Zählt sichtbare Langstrecken-Aufklärungsdrohnen über Krisengebieten.',
    'mil_dark_ratio': 'Vergleicht sichtbare mit üblichen Militärflügen; wenn viele "verschwinden", fliegen sie womöglich ohne Ortungssignal.',
    'civ_count_ukraine_edge': 'Zählt zivile Flüge im Grenzgebiet von Ukraine, Moldau und Rumänien; ein Einbruch zeigt Ausweichen oder Sperrungen.',
    'avoidance_iran_gulf': 'Zählt zivile Flüge über Iran, Irak und dem Golf pro Tag; ein Einbruch heißt, Airlines meiden den Luftraum.',
    'avoidance_black_sea': 'Zählt zivile Flüge über Schwarzem Meer und Ostsee pro Tag; ein Einbruch heißt, Airlines weichen aus.',
    'avoidance_taiwan_strait': 'Zählt zivile Flüge über der Taiwanstraße; Umleitungen oder ein Einbruch zeigen Gefahr.',
    'faa_closures': 'Zählt neue Luftraum-Beschränkungen (NOTAM) für Kiew, Baku, Teheran und Taipeh.',
    'russia_missile_ranges': 'Zählt neu ausgewiesene Sperrgebiete für Raketen- und Schießübungen in Ostsee, Kaliningrad und Barentssee.',
    'navarea_warnings': 'Zählt amtliche Seewarnungen zu Schießübungen und Sperrgebieten auf See.',
    'czib_status': 'Zählt aktive Warnungen der EU-Flugsicherheitsbehörde vor Konfliktzonen.',
    'jamming_baltic': 'Misst, wie viele Flugzeuge über der Ostsee gestörtes GPS melden.',
    'jamming_gulf': 'Misst, wie viele Flugzeuge über dem Golf und dem östlichen Mittelmeer gestörtes GPS melden.',
    'jamming_black_sea': 'Misst, wie viele Flugzeuge vor Krim und Odessa gestörtes GPS melden.',
    'jamming_east_asia': 'Misst, wie viele Flugzeuge um Korea und Taiwan gestörtes GPS melden.',
    'firms_front_ukraine': 'Zählt per Satellit erkannte Brände und Hitzepunkte im Osten der Ukraine.',
    'firms_refineries_russia': 'Erkennt per Satellit ungewöhnlich starke Brände an Raffinerien und Öllagern in Russland.',
    'firms_gulf_energy': 'Erkennt per Satellit Brände an Öl- und Gasanlagen in Iran und am Golf.',
    'firms_korea_dmz': 'Zählt per Satellit erkannte Hitzepunkte nahe der innerkoreanischen Grenze.',
    'explosions_ukraine': 'Zählt Erschütterungen, die Erdbebendienste in der Ukraine als Explosion einstufen.',
    'nk_test_site': 'Zählt Erschütterungen am nordkoreanischen Atomtestgelände Punggye-ri.',
    'novaya_zemlya': 'Zählt Erschütterungen am russischen Atomtestgelände Nowaja Semlja.',
    'explosions': 'Zählt Infraschall-Messungen, die auf sehr große Explosionen hinweisen.',
    'launches_by_country': 'Zählt Raketenstarts ins All je Land und Woche.',
    'sat_maneuvers': 'Zählt Bahnänderungen russischer und chinesischer Militärsatelliten.',
    'asat_debris': 'Zählt neue Trümmerteile im Orbit; plötzlich viele davon können auf zerstörte Satelliten hindeuten.',
    'cosmos_launches': 'Zählt Starts russischer Militärsatelliten (Kosmos-Reihe).',
    'ballistic_launches_log': 'Zählt Raketentests Nordkoreas und Irans anhand maschinenlesbarer Listen.',
    'ais_gaps_gulf': 'Zählt Schiffe im Golf, die ihr Ortungssignal abschalten.',
    'hormuz_transits': 'Zählt Schiffe in der Straße von Hormus; ein Einbruch ist ein starkes Warnsignal.',
    'chokepoint_suez_babelmandeb': 'Zählt Schiffe durch Rotes Meer, Bab el-Mandeb und Suezkanal pro Tag.',
    'chokepoint_taiwan_strait': 'Zählt Schiffe in der Taiwanstraße pro Tag.',
    'chokepoint_bosporus_blacksea': 'Zählt Schiffe durch den Bosporus und in Häfen am Schwarzen Meer.',
    'panama_suez_substitution': 'Zählt Passagen im Panamakanal; Umwege über Panama können Meidung von Suez zeigen.',
    'port_activity_gulf_baltic': 'Zählt Schiffsanläufe und Fracht in Häfen am Golf, an Ostsee und Schwarzem Meer.',
    'baltic_ais_traffic': 'Zählt Schiffe im Finnischen Meerbusen und im Öresund.',
    'baltic_dark_vessels': 'Zählt Schiffe in der Ostsee, die ihr Ortungssignal abschalten.',
    'freight_container': 'Misst, was der Versand eines Containers kostet; Umwege um Krisengebiete treiben den Preis.',
    'baltic_dry_dirty_tanker': 'Misst Frachtraten für Schüttgut und Öltanker.',
    'war_risk_listed_areas': 'Beobachtet, welche Seegebiete Versicherer als Kriegsrisiko einstufen; neue Gebiete heißen höhere Gefahr.',
    'maritime_incidents': 'Zählt gemeldete Angriffe auf Schiffe und Beschlagnahmungen.',
    'p_and_i_circulars': 'Zählt Rundschreiben von Schiffsversicherern zu Kriegsrisiko-Zuschlägen.',
    'ukraine_drone_missile_daily': 'Tageszahl der laut ukrainischem Generalstab abgeschossenen Drohnen und Marschflugkörper; Angabe einer Kriegspartei.',
    'oryx_losses': 'Zählt per Foto oder Video belegte Verluste an Militärgerät je Tag.',
    'viina_events': 'Zählt Kampfereignisse, die automatisch aus Nachrichten erkannt werden.',
    'acled_events_weekly': 'Zählt dokumentierte Gewaltereignisse je Land und Woche.',
    'israel_oref': 'Zählt Raketen- und Drohnenalarme in Israel pro Tag.',
    'baltic_drone_warnings': 'Zählt Drohnenwarnungen in Estland, Lettland, Litauen und Finnland.',
    'taiwan_adiz': 'Zählt chinesische Militärflugzeuge und -schiffe um Taiwan pro Tag (Angaben des taiwanischen Verteidigungsministeriums).',
    'satellite_imagery_airbases': 'Zählt Flugzeuge auf Militärflugplätzen in frei verfügbaren Satellitenbildern.',
    'ammo_trade': 'Misst den Außenhandel mit Munition laut Zollstatistik.',
    'shelter_osm': 'Zählt in OpenStreetMap eingetragene Schutzräume; viele neue Einträge zeigen Vorsorge.',
    'ctbto_statements': 'Meldungen der Atomteststopp-Organisation zu Erschütterungen; nur Kontext.',
    'brent_price': 'Misst den Ölpreis (Brent); Kriegsangst in Förderregionen treibt ihn nach oben.',
    'wti_price': 'Misst den US-Ölpreis (WTI).',
    'gas_ttf': 'Misst den europäischen Großhandelspreis für Gas.',
    'gold_price': 'Misst den Goldpreis; Anleger flüchten bei Angst in Gold.',
    'defense_etf_us': 'Misst Kurse von Fonds aus US-Rüstungsfirmen; sie steigen, wenn höhere Militärausgaben erwartet werden.',
    'defense_stocks_eu': 'Misst Kurse europäischer Rüstungsfirmen wie Rheinmetall, BAE, Saab, Hensoldt, Leonardo und Thales.',
    'defense_stocks_us': 'Misst Kurse großer US-Rüstungsfirmen wie Lockheed, Northrop, RTX und General Dynamics.',
    'safe_haven_chf': 'Misst den Kurs des Schweizer Franken; bei Angst wird er gegenüber dem Euro teurer.',
    'safe_haven_jpy': 'Misst den Kurs des japanischen Yen; bei Angst wird er teurer.',
    'vix': 'Misst, wie stark Anleger große Kursschwankungen bei US-Aktien erwarten ("Angstbarometer").',
    'ovx': 'Misst, wie stark Anleger Schwankungen beim Ölpreis erwarten.',
    'gvz_and_move': 'Misst, wie stark Anleger Schwankungen bei Gold und Staatsanleihen erwarten.',
    'us_10y_yield': 'Misst den Zins zehnjähriger US-Staatsanleihen; Flucht in Sicherheit senkt ihn, Inflationsangst hebt ihn.',
    'bund_yield_spread': 'Misst Zinsen deutscher und italienischer Staatsanleihen und den Abstand dazwischen.',
    'breakeven_inflation': 'Misst, welche Inflation die Anleihemärkte erwarten; ein Ölschock treibt sie.',
    'sovereign_cds_proxy': 'Misst, was eine Versicherung gegen die Pleite von Israel, Taiwan, Türkei oder Ukraine kostet.',
    'hy_credit_spread': 'Misst den Zinsaufschlag riskanter Unternehmen; er steigt bei allgemeiner Angst.',
    'conflict_currencies': 'Misst die Kurse von Rubel, Hrywnja, Schekel, Taiwan-Dollar und Rial.',
    'tanker_equities': 'Misst Aktienkurse von Öltanker-Reedereien; sie steigen, wenn Transporte riskanter und teurer werden.',
    'container_liner_equities': 'Misst Aktienkurse von Container-Reedereien wie Maersk, Hapag-Lloyd und ZIM.',
    'fuel_bunker_prices': 'Misst die Preise für Schiffs- und Flugtreibstoff.',
    'eu_gas_storage': 'Misst, wie voll die Gasspeicher in der EU sind.',
    'lng_terminals': 'Misst, wie viel Flüssiggas die Terminals in Europa ins Netz abgeben und lagern.',
    'gas_flows_entsog': 'Misst Gasflüsse an Grenzübergängen, z. B. aus Norwegen, durch die Ukraine und durch TurkStream.',
    'power_prices': 'Misst die Strompreise für den nächsten Tag in Europa.',
    'us_spr_stocks': 'Misst die Bestände der strategischen Ölreserve und der Öllager in den USA.',
    'positioning_cftc': 'Misst, wie große Fonds bei Öl, Gold und Weizen auf steigende oder fallende Preise setzen.',
    'wheat_prices': 'Misst den Weltmarktpreis für Weizen.',
    'fertilizer_prices': 'Misst die Preise für Dünger wie Harnstoff.',
    'prediction_markets_war': 'Misst, welche Wahrscheinlichkeit Wettmärkte für Waffenruhe, Angriff oder Blockade sehen.',
    'prediction_volume_spike': 'Erkennt plötzliche Umsatzsprünge bei Wetten auf geopolitische Ereignisse.',
    'insider_form4_defense': 'Zählt Aktienkäufe und -verkäufe von Führungskräften von Rüstungsfirmen (US-Pflichtmeldungen).',
    'dod_contract_obligations': 'Misst, wie viel Geld das US-Verteidigungsministerium vertraglich bindet.',
    'central_bank_gold': 'Misst die Goldreserven der Zentralbanken.',
    'crypto_stablecoin_flows': 'Misst Umlauf von Stablecoins (z. B. USDT) und Bitcoin-Kurs als Fluchtweg für Kapital.',
    'food_prices': 'Misst die weltweiten Lebensmittelpreise (FAO-Index).',
    'wiki_hotspot_articles': 'Zählt Wikipedia-Aufrufe zu Krisenorten wie Hormus, Suwałki-Lücke und Taiwanstraße.',
    'gdelt_energy_tone': 'Misst, wie negativ Nachrichten über Energie und Krieg klingen.',
    'unsc_vetoes': 'Zählt Vetos im UN-Sicherheitsrat zu Konfliktresolutionen.',
}
NAME = {'faa_closures': 'Luftraum-Beschränkungen (NOTAM) an Brennpunkten', 'eu_gas_storage': 'EU-Gasspeicher-Füllstand',
        'wiki_hotspot_articles': 'Wikipedia-Aufrufe: Krisenorte und Kriegsthemen'}

# Einheiten und Messart (Slug-Regex -> Wert), erste Übereinstimmung zählt
KIND_RULES = [
    (r'status$', 'binary'),
    (r'price|ttf|gold|vix|ovx|gvz|yield|spread|breakeven|cds|currenc|haven|equities|etf|stocks|term_structure|'
     r'rial|storage|lng_terminals|flows|ratio|share|tone|goldstein|prediction_markets|internet|ioda_|traffic|'
     r'grid|area_change|spr_stocks|positioning|bunker|holdings|kp', 'gauge'),
]
UNIT_RULES = [
    (r'power_prices', 'EUR/MWh'), (r'spr_stocks', 'Barrel'), (r'stablecoin', 'USD'),
    (r'central_bank_gold|gold_etf_holdings', 'Tonnen'), (r'yield|breakeven|eu_gas_storage|ratio|share', '%'),
    (r'spread|cds', 'Basispunkte'), (r'vix|ovx|gvz|food_prices|tone|goldstein', 'Indexpunkte'),
    (r'price|ttf|gold|currenc|haven|equities|etf|stocks|term_structure|rial|bunker', 'Kurs'),
    (r'ioda_|internet|traffic', 'Messwert'), (r'flows|grid', 'MW'), (r'area_change', 'km²'),
    (r'prediction_markets', '%'), (r'spr_stocks', 'Barrel'), (r'lng_terminals', 'GWh'), (r'kp$', 'Kp'),
]

# Umlaut-Korrektur (wie cyber), Ausnahmen um Kriegs-Vokabular ergänzt
UMLAUT_KEEP = {'aktuell', 'aktuelle', 'aktuellen', 'aktueller', 'zuerst', 'israel', 'michael', 'cboe',
               'maersk', 'tuesday', 'issues', 'issue', 'issued', 'true', 'value', 'values', 'due', 'suez', 'fuel',
               'does', 'goes', 'boeing', 'aerospace', 'virtuell', 'manuell', 'eventuell', 'individuell',
               'continue', 'revenue', 'venue', 'queue', 'boe', 'venezuela', 'kaesong', 'buenos', 'influence',
               'guess', 'guest', 'puerto', 'manuel', 'samuel', 'phoenix', 'raphael', 'ismael', 'blue', 'league',
               'avenue', 'statue', 'residue', 'cruel', 'duel', 'fluent', 'queen', 'queens', 'question',
               'sequence', 'frequency', 'oecd', 'ukmto', 'poe', 'joe', 'shoe', 'aegis', 'ae', 'ue', 'oe',
               'uae', 'gnss', 'suezkanal', 'visuell', 'visuelle', 'visuellen', 'oryxspioenkop', 'israeli', 'israelis', 'tue', 'samuels', 'reuters', 'kuehne', 'nuevo', 'duero'}
WORD_FIX = {'plotzlicher': 'Plötzlicher', 'plotzlich': 'plötzlich'}
SZ = [('grösse', 'größe'), ('grösst', 'größt'), ('gross', 'groß'), ('heisst', 'heißt'), ('ausmass', 'ausmaß'),
      ('ausserhalb', 'außerhalb'), ('ausserplanm', 'außerplanm'), ('aussergew', 'außergew'), ('ausser', 'außer'),
      ('aussen', 'außen'), ('mässig', 'mäßig'), ('massnahm', 'maßnahm'), ('strasse', 'straße'),
      ('schliess', 'schließ'), ('fliess', 'fließ'), ('schiess', 'schieß')]

# ---------------------------------------------------------------- Helfer (aus consolidate_cyber.py)
changed_words = Counter()


def fix_word(w):
    lw = w.lower()
    if lw in WORD_FIX:
        out = WORD_FIX[lw]
        return out if w[:1].isupper() else out.lower()
    if lw in UMLAUT_KEEP or lw.startswith(('blue', 'aero')) or w.isupper():
        out = w
    else:
        def rep(m):
            a, b = m.group(1), m.group(2)
            prev = m.string[m.start() - 1].lower() if m.start() > 0 else '#'
            if a.lower() == 'u' and prev in 'qaeä':
                return a + b
            if a.lower() == 'u' and prev in 'tnxds' and m.string[m.end():m.end() + 2].lower() == 'll':
                return a + b
            if a.lower() == 'a' and prev == 'r' and m.string[m.end():m.end() + 1].lower() == 'l':
                return a + b
            ch = {'a': 'ä', 'o': 'ö', 'u': 'ü'}[a.lower()]
            return ch.upper() if a.isupper() else ch
        out = re.sub(r'([AaOoUu])([eE])', rep, w)
    lo = out.lower()
    for a, b in SZ:
        if a in lo:
            i = lo.index(a)
            seg = b if not out[i:i + 1].isupper() else b[0].upper() + b[1:]
            out = out[:i] + seg + out[i + len(a):]
            lo = out.lower()
    if out != w:
        changed_words[w.lower() + '>' + out.lower()] += 1
    return out


def de(text):
    if not text:
        return text
    parts = re.split(r'(https?://\S+|`[^`]*`|[\w.-]+\.(?:json|csv|geojson|xml|zip))', text)
    return ''.join(p if i % 2 else re.sub(r'[A-Za-zÄÖÜäöüß]+', lambda m: fix_word(m.group(0)), p)
                   for i, p in enumerate(parts))


def canon(sid):
    return ALIAS.get(sid, sid)


def is_free(src):
    cost = (src.get('cost') or '').lower()
    return src.get('auth') == 'none' and (cost.startswith('free') or cost in ('', 'kostenlos'))


def is_stream(src):
    ep = (src.get('endpoint') or '').lower()
    return ep.startswith('wss://') or 'stream' in ep or 'firehose' in ep or 'jetstream' in ep


def access_score(src):
    cost = (src.get('cost') or '').lower()
    if src.get('auth') == 'paid' or not (cost.startswith('free') or cost == ''):
        return 3
    if src.get('access') == 'scrape':
        return 2
    if src.get('auth') != 'none':
        return 1
    s = 0.0
    if is_stream(src):
        s += 0.5
    if src.get('format') in ('mrt', 'parquet', 'html'):
        s += 0.5
    return s


def lic_unclear(lic):
    return bool(re.search(r'unklar|pr(ü|ue)f|\?', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|nc|propriet', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|selbst|gering|unbekannt|unklar|nur z(ä|ae)hler|eingeschr|'
                      r'begrenzt|feed-fenster|letzte|webseite|kurz|nur feed', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [
        (r'j(ä|ae)hrlich', 525600), (r'quartal', 129600), (r'monatlich', 43200),
        (r'w(ö|oe)chentlich|^wochen', 10080),
        (r'(ä|ae)glich|tagesende|^tage|gesch(ä|ae)ftstag|~1 tag|stunden bis tage|minuten bis tage', 1440),
        (r'12 h', 720), (r'3 h', 180), (r'~2 h|2h', 120),
        (r'st(ü|ue)ndlich|^stunden|1 ?h|minuten bis stunden|minuten-stunden|15 min bis stunden|15-60', 60),
        (r'unregelm|unbekannt|laufend|bei (ä|ae)nderung', 60),
        (r'15 min|10 min|5-15|5-10', 15),
        (r'sekunden|echtzeit|\b1 s\b|10 s|30 s|unter 1 s|1-2 min|1-3 min|1-5 min|1 min|5 min', 5),
        (r'minuten', 15),
    ]
    for pat, v in rules:
        if re.search(pat, t):
            return v
    return 60


def baseline_for(interval, domain):
    if interval <= 60:
        return {'method': 'hour-of-week', 'windowDays': 28, 'minPoints': 48}
    if interval <= 1440:
        if domain in ROLLING_DOMAINS:
            return {'method': 'rolling', 'windowDays': 28, 'minPoints': 14}
        return {'method': 'day-of-week', 'windowDays': 56, 'minPoints': 21}
    if interval <= 10080:
        return {'method': 'rolling', 'windowDays': 365, 'minPoints': 26}
    if interval <= 43200:
        return {'method': 'rolling', 'windowDays': 1095, 'minPoints': 24}
    return {'method': 'rolling', 'windowDays': 1825, 'minPoints': 12}


def kind_for(slug):
    for pat, k in KIND_RULES:
        if re.search(pat, slug):
            return k
    return 'count'


def unit_for(slug, kind):
    if kind == 'binary':
        return '0/1'
    for pat, u in UNIT_RULES:
        if re.search(pat, slug):
            return u
    return 'Anzahl' if kind in ('count', 'rate') else 'Messwert'


def built_collectors():
    ids = set()
    d = os.path.join(ROOT, 'src', 'collectors')
    for f in os.listdir(d):
        if f.endswith('.ts') and not f.startswith('_'):
            m = re.search(r"^  id: '([^']+)'", open(os.path.join(d, f), encoding='utf-8').read(), re.M)
            if m:
                ids.add(m.group(1))
    return ids


def prep_src(src):
    src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
    if src['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (src.get('endpoint') or ''):
        src['verified'] = True
    return src


def slug_of(s):
    return s['id'].split('.')[-1]


def seg_of(s):
    return s['id'].split('.')[1]


def merge_key(s):
    k = slug_of(s) + '@' + seg_of(s)
    return k if k in MERGE else slug_of(s)


# ---------------------------------------------------------------- Einlesen
raw = []
for f in RESEARCH:
    with open(os.path.join(CAT, 'research', f + '.json'), encoding='utf-8') as fh:
        for s in json.load(fh)['signals']:
            s['_file'] = f
            raw.append(s)
BUILT = built_collectors()
existing_sources = json.load(open(OUT_SOURCES, encoding='utf-8'))
existing_ids = {s['id'] for s in existing_sources}

variants = defaultdict(list)
dropped = []
for s in raw:
    keep = []
    for src in s['sources']:
        if src['source_id'] in DROP_SOURCES:
            dropped.append((s['id'], src['source_id']))
            continue
        src = prep_src(src)
        variants[src['source_id']].append(src)
        keep.append(src)
    s['_srcs'] = keep

by_slug = OrderedDict()
pending = []
for s in raw:
    k = merge_key(s)
    if k in MERGE:
        pending.append((MERGE[k], s))
        continue
    sl = slug_of(s)
    assert sl not in by_slug, 'Slug-Kollision: ' + sl
    s['_merged'] = []
    s['_sources'] = list(s['_srcs'])
    by_slug[sl] = s
for target, s in pending:
    assert target in by_slug, 'MERGE-Ziel fehlt: ' + target
    t = by_slug[target]
    t['_merged'].append(s['id'])
    t['priority'] = min(t['priority'], s['priority'])
    for b in s['banal_causes']:
        if b not in t['banal_causes']:
            t['banal_causes'].append(b)
    if s.get('notes'):
        t['notes'] = ((t.get('notes') or '') + ' ' + s['notes']).strip()
    t['_sources'] += s['_srcs']
moved = []
for (sl, sid), target in SOURCE_MOVE.items():
    src = [x for x in by_slug[sl]['_sources'] if x['source_id'] == sid]
    by_slug[sl]['_sources'] = [x for x in by_slug[sl]['_sources'] if x['source_id'] != sid]
    by_slug[target]['_sources'] += src
    moved.append('%s: %s -> %s' % (sid, sl, target))

# ---------------------------------------------------------------- Signale bauen
def make_signal(sl, s, dom, srcs, main, name, plain, rationale, banal, direction, ev, merged, extra_notes):
    alt = []
    for src in srcs:
        if src['source_id'] != main['source_id'] and src['source_id'] not in alt:
            alt.append(src['source_id'])
    if dom == 'context':
        w = 0.0
    else:
        w = WEIGHT.get(sl, WEIGHT_DEFAULT[dom])
        if ev == 'C':
            w = min(w, C_CAP)
        if ev == 'D':
            w = max(0.3, min(0.7, w))
    lic = main.get('license') or 'unklar'
    if not is_free(main):
        status = 'needs-key'
    elif lic_unclear(lic) and main.get('access') == 'scrape':
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = interval_from(main.get('update_latency'))
    kind = (EXTRA.get(sl) or {}).get('kind') or kind_for(sl)
    unit = (EXTRA.get(sl) or {}).get('unit') or unit_for(sl, kind)
    sid = main['source_id']
    notes = list(extra_notes)
    if s.get('notes'):
        notes.append(de(s['notes']))
    if merged:
        notes.append('Zusammengeführt aus: ' + ', '.join(merged) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if sid in GITHUB_CURRENT:
        notes.append('GitHub-Spiegel aktuell (geprüft 17.11.2026): ' + GITHUB_CURRENT[sid] + '.')
    if sid in GITHUB_STALE:
        notes.append(GITHUB_STALE[sid])
    if sid in STALE_ENDPOINT_NOTE:
        notes.append(STALE_ENDPOINT_NOTE[sid])
    if ev == 'C':
        notes.append('Klasse C: Aussage (bei Kriegsparteien nicht unabhängig prüfbar), Gewicht höchstens %.1f.' % C_CAP)
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + de(main['sample_note']))
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    sig = OrderedDict([
        ('id', 'war.%s.%s' % (dom, sl)), ('scenarios', ['war']), ('domain', dom),
        ('name', de(name)), ('plain', de(plain)), ('evidenceClass', ev), ('direction', direction),
        ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', sid), ('collector', COLLECTOR.get(sid, sid)), ('unit', unit),
        ('baseline', baseline_for(iv, dom)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', de(main.get('name'))), ('sourceUrl', main.get('doc_url')), ('license', lic),
        ('rationale', de(rationale)), ('banalCauses', [de(b) for b in banal]),
        ('endpoint', main.get('endpoint')), ('auth', main.get('auth')), ('history', main.get('history')),
        ('priority', s['priority']), ('verified', bool(main.get('verified'))), ('leadTime', lead),
        ('format', main.get('format')), ('notes', ' '.join(notes)),
    ])
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    return sig


signals = []
for sl, s in by_slug.items():
    ev = EVIDENCE_OVERRIDE.get(sl, s['evidence_class'])
    if sl in CONTEXT:
        dom = 'context'
    elif ev == 'D':
        dom = 'attention'
    elif sl in DOMAIN_OVERRIDE:
        dom = DOMAIN_OVERRIDE[sl]
    else:
        dom = DOMAIN_DEFAULT[seg_of(s)]
    srcs = s['_sources']
    if sl in MAIN:
        main = next(x for x in srcs if x['source_id'] == MAIN[sl])
    else:
        main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    if direction not in ('up', 'down', 'both'):
        direction = 'both'
    signals.append(make_signal(sl, s, dom, srcs, main, NAME.get(sl, s['name_de']), PLAIN.get(sl, s['plain_de']),
                               s.get('rationale'), s['banal_causes'], direction, ev, s['_merged'], []))

extra_count = 0
for sl, e in EXTRA.items():
    base_sl, sid = e['from']
    base = next(x for x in raw if slug_of(x) == base_sl)
    src = next(x for x in base['_srcs'] if x['source_id'] == sid)
    pseudo = {'notes': '', 'manipulability': 'low', 'priority': base['priority'], 'lead_time': 'coincident'}
    signals.append(make_signal(sl, pseudo, e['domain'], [src], src, e['name'], e['plain'], e['rationale'],
                               e['banal'], e['direction'], 'A', [],
                               ['Abgeleitet aus der Quellenangabe von %s (Störfaktor-Filter, Gewicht 0).' % base['id']]))
    extra_count += 1

DOM_ORDER = DOMAINS + ['context']
signals.sort(key=lambda x: (DOM_ORDER.index(x['domain']), -x['weight'], x['id']))

# ---------------------------------------------------------------- Quellen-Matrix (erweitern)
sig_by_src = defaultdict(list)
for sg in signals:
    for sid in dict.fromkeys(sg['_all_src']):
        sig_by_src[sid].append(sg['id'])

# frühere war-Ergänzungen entfernen (idempotent)
sources = []
for s in existing_sources:
    s = OrderedDict(s)
    s['signals'] = [x for x in s.get('signals', []) if not x.startswith('war.')]
    s['scenarios'] = [x for x in s.get('scenarios', []) if x != 'war']
    if s['scenarios']:
        sources.append(s)
existing_ids = {s['id'] for s in sources}   # ohne frühere reine war-Quellen
src_index = {s['id']: s for s in sources}
new_sources = []
for sid in sorted(variants):
    vs = variants[sid]
    if sid in src_index:
        e = src_index[sid]
        e['scenarios'] = e['scenarios'] + ['war']
        e['signals'] = e['signals'] + sig_by_src.get(sid, [])
        continue
    exact = [v for v in vs if v['_orig_id'] == sid]
    best = min(vs, key=lambda v: (access_score(v), v.get('format') not in ('json', 'csv'), v not in exact,
                                  not v.get('verified')))
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    rec = OrderedDict([
        ('id', sid), ('name', de(best.get('name'))), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', de(best.get('update_latency'))),
        ('history', de(best.get('history'))), ('rateLimit', de(best.get('rate_limit'))),
        ('license', de(best.get('license'))), ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})),
        ('collector', COLLECTOR.get(sid, sid)), ('signals', sig_by_src.get(sid, [])), ('scenarios', ['war']),
    ])
    sources.append(rec)
    new_sources.append(rec)
    src_index[sid] = rec

# ---------------------------------------------------------------- Bau-Reihenfolge
def gh_current(m):
    return m['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (m.get('endpoint') or '') \
        and bool(m.get('verified'))


coll = OrderedDict()
for sg in signals:
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'domains': Counter(), 'maxw': 0.0,
                                          'keyfree': False})
    c['signals'].append(sg['id'])
    c['mains'].append(sg['_main'])
    if sg['domain'] != 'context':
        c['domains'][sg['domain']] += sg['weight']
    c['maxw'] = max(c['maxw'], sg['weight'])
    if sg['status'] == 'planned':
        c['keyfree'] = True

rows = []
for cid, c in coll.items():
    mains = c['mains']
    gh = any(gh_current(m) for m in mains)
    ext = cid if cid in BUILT else None
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download')
                and not is_stream(m) and is_free(m) for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0] if c['domains'] else 'context'
    forbid = any(re.search(r'verbiet|kein scrap', m.get('license') or '', re.I) for m in mains)
    rows.append({'collector': cid, 'domain': dom, 'gh': gh, 'extends': ext, 'keyfree': c['keyfree'],
                 'small': small, 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not gh, ext is None, not c['keyfree'], forbid, not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

chosen = []
for d in DOMAINS:
    for r in [r for r in rows if r['domain'] == d][:BUILD_MIN_PER_DOMAIN]:
        if r not in chosen:
            chosen.append(r)
for r in rows:
    if len(chosen) >= BUILD_N:
        break
    if r not in chosen and r['domain'] != 'context':
        chosen.append(r)
chosen.sort(key=lambda r: r['key'])

build = []
for i, r in enumerate(chosen, 1):
    c = r['c']
    srcs_ids = list(dict.fromkeys(m['source_id'] for m in c['mains']))
    eps = []
    for m in c['mains']:
        if m.get('endpoint') and m['endpoint'] not in eps:
            eps.append(m['endpoint'])
    ver = any(m.get('verified') for m in c['mains'])
    s0 = src_index[srcs_ids[0]]
    unc = []
    if not ver:
        unc.append('Endpunkt aus der Recherche, nicht geprüft (verified=false)')
    notes = [de(m.get('sample_note')) for m in c['mains'] if m.get('sample_note')]
    if notes:
        unc.append('Messfeld laut Recherche: ' + notes[0])
    for sid in srcs_ids:
        if sid in STALE_ENDPOINT_NOTE:
            unc.append(STALE_ENDPOINT_NOTE[sid])
        if sid in GITHUB_STALE:
            unc.append(GITHUB_STALE[sid])
    lic = s0.get('license') or 'unklar'
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    rl = s0.get('rateLimit')
    if rl and rl not in ('unklar', 'unbekannt'):
        unc.append('Rate-Limit: ' + rl)
    why = []
    if r['gh']:
        why.append('raw.githubusercontent.com, aktuell verifiziert (' + GITHUB_CURRENT[srcs_ids[0]] + ')')
    if r['extends']:
        why.append('erweitert bestehenden Collector %s um Kriegs-Länder/-Symbole/-Begriffe' % r['extends'])
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % (s0.get('format') or '').upper() if r['small'] else 'Format/Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver),
        ('extends', r['extends']), ('github', r['gh']),
        ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Doku-Abschnitte
def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


war_src = [src_index[sid] for sid in sorted(variants)]
key_rows = []
main_cnt = Counter(sg['independenceGroup'] for sg in signals if sg['status'] == 'needs-key')
for s in war_src:
    any_needs = any(not is_free(v) for v in variants[s['id']])
    if not (any_needs or main_cnt[s['id']]):
        continue
    names = [sg['name'] for sg in signals if sg['independenceGroup'] == s['id']]
    war_sigs = [x for x in s['signals'] if x.startswith('war.')]
    if not names:
        names = ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in war_sigs[:3])]
    alt = len(war_sigs) - len([sg for sg in signals if sg['independenceGroup'] == s['id']])
    cnt = '%d' % main_cnt[s['id']] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in variants[s['id']] if not is_free(v)), variants[s['id']][0])
    env = env_for_source(s['id'])
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(
        v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | %s | %s | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], format_env_cell(env), cnt, stand_for(env)))
keys_sec = [SECTION, '', 'Automatisch erzeugt von `scripts/consolidate_war.py`. Gleiche Spalten wie oben; '
            'Dienste, die schon im Cyber-Abschnitt stehen, nutzen dieselbe Umgebungsvariable. '
            'Spalte „Stand“ und kanonische Env-Namen: scripts/key_stand.py.', '',
            TABLE_HEADER, TABLE_SEP] + key_rows + ['']

lic_rows = []
for s in war_src:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if s.get('access') == 'scrape' and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_sec = [SECTION, '', 'Automatisch erzeugt von `scripts/consolidate_war.py`. Kriterien wie oben. Zusätzlich gilt: '
           'Angaben von Kriegsparteien (z. B. Verlustzahlen) sind Klasse C und werden nur mit Gewicht ≤ 0,2 geführt.', '',
           '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + ['']


def append_section(path, lines):
    txt = open(path, encoding='utf-8').read()
    i = txt.find('\n' + SECTION)
    if i >= 0:
        txt = txt[:i]
    txt = txt.rstrip('\n') + '\n\n' + '\n'.join(lines)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(txt)


# ---------------------------------------------------------------- Szenario-Vorschlag
scenario = OrderedDict([
    ('id', 'war'), ('order', 2), ('title', 'Kriegseskalation'),
    ('question', 'Spitzt sich gerade irgendwo ein Krieg gefährlich zu?'),
    ('tagline', 'Militärflüge, Meerengen, Luftalarme, Internet-Ausfälle, Ölpreis, Reisewarnungen'),
    ('domains', OrderedDict([
        ('military', {'title': 'Militär in Luft, See und All', 'weight': 1,
                      'plain': 'Militärflugzeuge, Satelliten, GPS-Störungen und gesperrter Luftraum'}),
        ('conflict', {'title': 'Gemessene Kampfhandlungen', 'weight': 1,
                      'plain': 'Luftalarme, Brände per Satellit, Explosionen in Erdbebendaten'}),
        ('shipping', {'title': 'Schifffahrt und Meerengen', 'weight': 0.9,
                      'plain': 'Schiffe durch Hormus, Rotes Meer und Taiwanstraße, Frachtraten, Versicherungen'}),
        ('connectivity', {'title': 'Internet und Strom in Konfliktgebieten', 'weight': 0.9,
                          'plain': 'Fallen Internet, Mobilfunk oder Strom in betroffenen Ländern aus?'}),
        ('government', {'title': 'Verhalten von Staaten', 'weight': 0.8,
                        'plain': 'Reisewarnungen, Botschaftsabzüge, Sanktionen, Sondersitzungen des UN-Sicherheitsrats'}),
        ('energy', {'title': 'Energieversorgung', 'weight': 0.6,
                    'plain': 'Gasspeicher, Gasflüsse, Ölreserven und Strompreise'}),
        ('markets', {'title': 'Märkte und Wetten', 'weight': 0.6,
                     'plain': 'Öl, Gold, Rüstungsaktien, Währungen der Konfliktparteien'}),
    ])),
])

# ---------------------------------------------------------------- Ausgabe
for sg in signals:
    sg.pop('_main')
    sg.pop('_all_src')
for path, obj in [(OUT_SIGNALS, signals), (OUT_SOURCES, sources), (OUT_BUILD, build), (OUT_SCEN, scenario)]:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
append_section(OUT_KEYS, keys_sec)
append_section(OUT_LIC, lic_sec)

# ---------------------------------------------------------------- Selbstprüfung
errors = []
for path in (OUT_SIGNALS, OUT_SOURCES, OUT_BUILD, OUT_SCEN):
    json.load(open(path, encoding='utf-8'))
sigs = json.load(open(OUT_SIGNALS, encoding='utf-8'))
cyber_ids = {x['id'] for x in json.load(open(CYBER_SIGNALS, encoding='utf-8'))}
ids = [x['id'] for x in sigs]
if len(ids) != len(set(ids)):
    errors.append('doppelte IDs: %s' % [i for i, n in Counter(ids).items() if n > 1])
if cyber_ids & set(ids):
    errors.append('ID-Kollision mit cyber: %s' % sorted(cyber_ids & set(ids)))
dc = Counter(x['domain'] for x in sigs)
for d in DOM_ORDER:
    if not dc[d]:
        errors.append('Domain leer: ' + d)
for x in sigs:
    if not x['id'].startswith('war.') or x['scenarios'] != ['war']:
        errors.append('Präfix/Szenario: ' + x['id'])
    if x['domain'] not in DOM_ORDER:
        errors.append('unbekannte Domain: ' + x['id'])
    if not x.get('sourceUrl') or not x.get('collector'):
        errors.append('sourceUrl/collector fehlt: ' + x['id'])
    if not 0 <= x['weight'] <= 1:
        errors.append('weight außerhalb 0..1: ' + x['id'])
    if x['evidenceClass'] == 'C' and x['weight'] > C_CAP:
        errors.append('Klasse C über %.1f: %s' % (C_CAP, x['id']))
    if x['evidenceClass'] == 'D' and x['domain'] != 'attention':
        errors.append('Klasse D außerhalb attention: ' + x['id'])
    if x['domain'] == 'context' and x['weight'] != 0:
        errors.append('context mit Gewicht: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary') or x['direction'] not in ('up', 'down', 'both'):
        errors.append('kind/direction: ' + x['id'])
    if x['status'] not in ('active', 'needs-key', 'planned', 'license-unclear'):
        errors.append('status: ' + x['id'])
src_ids = [s['id'] for s in sources]
if len(src_ids) != len(set(src_ids)):
    errors.append('doppelte Quellen-IDs')
if not existing_ids <= set(src_ids):
    errors.append('bestehende Quellen verloren: %s' % sorted(existing_ids - set(src_ids)))
for s in sources:
    for x in s['signals']:
        if x.startswith('war.') and x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))
bdc = Counter(b['domain'] for b in build)
for d in DOMAINS:
    if bdc[d] < BUILD_MIN_PER_DOMAIN:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) - extra_count + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d - %d + %d != %d' % (len(sigs), extra_count, merged_in, len(raw)))
sc_doms = set(scenario['domains'])
if sc_doms != set(DOMAINS) - {'attention'}:
    errors.append('Szenario-Domains: %s' % sorted(sc_doms))
for path in (OUT_KEYS, OUT_LIC):
    t = open(path, encoding='utf-8').read()
    if t.count(SECTION) != 1 or '(Szenario cyber)' not in t:
        errors.append('Doku-Abschnitt kaputt: ' + path)

print('Recherche-Signale: %d, zusammengeführt: %d, abgeleitet: %d, Katalog: %d' % (len(raw), merged_in, extra_count, len(sigs)))
print('Domains:', dict(sorted(dc.items())))
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen gesamt: %d (neu: %d, erweitert: %d), Collectors: %d' % (
    len(sources), len(new_sources), len([s for s in sources if 'war' in s['scenarios'] and s['id'] in existing_ids]), len(coll)))
print('Verworfen:', dropped, ' Verschoben:', moved)
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Top 15:', ', '.join('%s(%s%s%s)' % (b['collector'], b['domain'], ',gh' if b['github'] else '',
                                           ',ext' if b['extends'] else '') for b in build[:15]))
if '-v' in sys.argv:
    print('Umlaut-Korrekturen:', ' '.join(sorted(changed_words)))
    for b in build:
        print(b['rank'], b['collector'], b['domain'], 'gh' if b['github'] else '', b['extends'] or '', b['why'][:100])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
