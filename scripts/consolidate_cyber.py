#!/usr/bin/env python3
"""Konsolidiert die fünf Cyber-Recherche-Dateien zu Signal-Katalog, Quellen-Matrix, Bau-Reihenfolge
und den Doku-Tabellen KEYS-NEEDED.md / LICENSE-TODO.md.

Aufruf:  python3 -I scripts/consolidate_cyber.py   (nur Standardbibliothek)

Das Urteil steckt in den Tabellen unten (ALIAS, MERGE, DOMAIN_*, WEIGHT, ...). Alles andere ist Mechanik.
"""
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = ['cyber-internet-core', 'cyber-threat-intel', 'cyber-finance-corporate',
            'cyber-behavior-markets', 'cyber-physical-ot']
OUT_SIGNALS = os.path.join(ROOT, 'catalog', 'signals', 'cyber.json')
OUT_SOURCES = os.path.join(ROOT, 'catalog', 'sources.json')
OUT_BUILD = os.path.join(ROOT, 'catalog', 'cyber-build-order.json')
OUT_KEYS = os.path.join(ROOT, 'docs', 'KEYS-NEEDED.md')
OUT_LIC = os.path.join(ROOT, 'docs', 'LICENSE-TODO.md')

DOMAINS = ['routing', 'dns_core', 'outages', 'threat', 'vuln', 'finance', 'services', 'markets',
           'physical', 'attention']
BUILD_N = 45

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs aus verschiedenen Recherche-Dateien, die dieselbe Quelle meinen -> kanonische ID
ALIAS = {
    'cloudflare-radar': 'cf-radar', 'cloudflare-radar-dns': 'cf-radar',
    'atlas': 'ripe-atlas', 'ripedocs': 'ripe-atlas',
    'isc': 'sans-isc', 'isc-infocon': 'sans-isc',
    'kev': 'cisa-kev', 'cisa-kev-csv': 'cisa-kev',
    'shadow': 'shadowserver', 'shadowserver-dash': 'shadowserver',
    'gn': 'greynoise',
    'ics-cert': 'cisa-ics',
    'swpc': 'noaa-swpc',
    'sec-efts': 'sec-edgar', 'sec-edgar-fts': 'sec-edgar', 'sec-edgar-submissions': 'sec-edgar',
    'sec-edgar-atom': 'sec-edgar', 'sec-edgar-daily-index': 'sec-edgar', 'sec-insider-datasets': 'sec-edgar',
    'fred-currcir': 'fred',
    'ecb-ilm-banknotes': 'ecb-data', 'ecb-estr': 'ecb-data', 'ecb-data-tgt': 'ecb-data',
    'ecb-liquidity': 'ecb-data',
    'hn': 'hn-algolia',
    'wm': 'wikimedia-pageviews', 'wikimedia-aggregate': 'wikimedia-pageviews',
    'tor': 'tor-metrics',
    'cboe-vix': 'cboe', 'cboe-vix9d': 'cboe', 'cboe-pcr': 'cboe',
    'status-cf': 'cloudflarestatus', 'status-fastly': 'fastly-status', 'status-misc': 'statuspage-hosts',
    'status-aws': 'aws-health', 'aws-health-rss': 'aws-health',
    'status-azure': 'azure-status', 'azure-status-rss': 'azure-status',
    'status-gcp': 'gcp-status',
    'entsoe-tp': 'entsoe',
    'eia-930': 'eia', 'eia-grid': 'eia',
    'opensky-states': 'opensky',
    'ctlog': 'ct-logs',
    'mb-tag-wiper': 'malwarebazaar',
    'msrc': 'msrc-cvrf',
    'cert-bund-rss': 'cert-bund', 'bsi-cert': 'cert-bund',
    'downdet': 'downdetector', 'vendor-status': 'downdetector',
    'dcf77': 'ntppool',
    'shodan-trends': 'shodan',
    'first-epss-csv': 'first-epss',
    'defillama-stablecoins': 'defillama', 'defillama-tvl': 'defillama', 'defillama-cex': 'defillama',
    'itunes-reviews': 'apple-rss', 'itunes-rss': 'apple-rss',
    'ais': 'aisstream', 'ais-agg': 'aisstream',
}
# bewusste Korrekturen an Quell-Metadaten (mit Begründung in notes)
AUTH_OVERRIDE = {
    'ripe-atlas': ('none', 'Ergebnisse öffentlicher Messungen sind ohne Key lesbar; Key/Credits nur für eigene Messungen.'),
}
# mehrere Quellen, ein Collector
COLLECTOR = {s: 'statuspage' for s in ['githubstatus', 'cloudflarestatus', 'fastly-status', 'statuspage-hosts',
                                       'mastercard-dev-status', 'telecom-statuspages']}

# Duplikate über Dateien hinweg: Slug (letzter ID-Teil) -> Slug des führenden Eintrags
MERGE = {
    'kev_additions_rate@ddos': 'kev_additions_rate@vuln',
    'infocon_level': 'isc_infocon',
    'mass_scan_surge': 'dshield_port_scan_spike',
    'exposed_services_shadowserver': 'shadowserver_exposed',
    'cf_l3_l7_attack_volume': 'cloudflare_l3_attacks',
    'cloudflare_traffic_anomaly': 'traffic_anomalies',
    'country_outage_ioda': 'ioda_outage_events_global',
    'atlas_probe_latency': 'atlas_ping_global',
    'jamming_map_aggregate': 'gnss_interference',
    'timing_drift_ntp': 'ntp_pool_health_de',
    'geomagnetic_kp': 'geomagnetic_storm',
    'starlink_constellation': 'starlink_fleet_count',
    'grid_load_entsoe_de': 'grid_load_germany',
    'hn_wikipedia_attention': 'hackernews_volume',
    'statuspage_incidents': 'cdn_dns_providers',
    'aws_azure_gcp_events': 'hyperscaler_incidents',
    'downdetector_volume': 'crowd_outage_aggregators',
    'payment_terminal_outage': 'stoerungsmelder_card_banking',
    'ransomware_leaksite_victims': 'leak_posts_daily',
    'ransomware_leak_volume': 'leak_posts_daily',
    '8k_item105_filings': 'sec_8k_item105_daily_count',
    'vix': 'vix_spike',
    'cash_in_circulation': 'banknotes_in_circulation',
    'stablecoin_depeg': 'stablecoin_peg_deviation',
    'bitcoin_tx_and_mempool': 'mempool_fee_spike',
    'cisa_advisory_rate': 'cisa_ics_advisories',
    'bsi_warnings': 'cert_bund_critical',
    'cert_advisory_cadence': 'cert_bund_critical',
    'exposed_modbus_trend': 'exposed_ot_protocols',
    'ct_log_issuance': 'issuance_volume',
    'ct_brand_certs': 'lookalike_issuance_gov_banks',
    'tor_vpn_demand': 'users_de',
    'ercot_pjm_load': 'us_demand_balancing_authorities',
}

# Recherche-Domain -> Ziel-Domain (Default), Einzel-Overrides danach
DOMAIN_DEFAULT = {
    'routing': 'routing', 'outage': 'outages', 'dns': 'dns_core', 'ixp': 'outages', 'cable': 'outages',
    'ct': 'dns_core', 'time': 'dns_core', 'cloud': 'services', 'ddos': 'threat', 'traffic': 'outages',
    'tor': 'outages', 'satellite': 'physical', 'space': 'context', 'proxy': 'outages',
    'vuln': 'vuln', 'honeypot': 'threat', 'malware': 'threat', 'botnet': 'threat', 'ransomware': 'threat',
    'exposure': 'vuln', 'phishing': 'threat', 'supply': 'threat', 'exploit': 'vuln', 'ics': 'vuln',
    'filings': 'services', 'breach': 'services', 'regulatory': 'services', 'insurance': 'markets',
    'attention': 'attention', 'status': 'services', 'payments': 'finance', 'cash': 'finance',
    'money': 'finance', 'markets': 'markets', 'crypto': 'finance', 'market': 'markets',
    'insider': 'markets', 'prediction': 'markets', 'aviation': 'physical', 'dev': 'outages',
    'procurement': 'services', 'labor': 'attention', 'energy': 'physical', 'power_grid': 'physical',
    'gas': 'physical', 'gnss': 'physical', 'maritime': 'physical', 'rail': 'physical',
    'telecom': 'physical', 'space_weather': 'context', 'warning': 'physical', 'retail': 'attention',
    'traffic_d': 'attention', 'health': 'physical', 'water': 'physical',
}
DOMAIN_OVERRIDE = {
    'member_port_changes': 'routing', 'pch_global_counts': 'routing', 'map_inventory': 'physical',
    'gnss_interference': 'physical', 'cf_http_error_rates': 'outages', 'kev_additions_rate': 'vuln',
    'starlink_fleet_count': 'physical', 'ioda_starlink_asn': 'physical', 'bnetza_disruption_reports': 'services',
    'manrs_adoption': 'routing', 'openintel_dns_dependency': 'dns_core', 'shadowserver_exposed': 'vuln',
    'traffic_anomalies': 'outages', 'cloudflare_l3_attacks': 'threat', 'advisory_volume': 'vuln',
    'cisa_ics_advisories': 'vuln', 'exposed_ot_protocols': 'vuln', 'github_security_issue_spike': 'vuln',
    'payment_providers': 'finance', 'open_banking_uk': 'finance', 'crypto_exchange_statuspages': 'finance',
    'bitcoin_network_nodes': 'finance', 'mempool_fee_spike': 'finance', 'stablecoin_peg_deviation': 'finance',
    'banknotes_in_circulation': 'finance', '8k_ciso_departures': 'services', 'emergency_releases': 'vuln',
    'kev_ot_additions': 'vuln', 'vendor_advisories': 'vuln', 'port_scanning_ot_protocols': 'threat',
    'hospital_it_outage': 'physical', 'water_utility_alerts': 'physical', 'leak_posts_daily': 'threat',
    'sec_8k_item105_daily_count': 'services', 'users_de': 'outages', 'grid_load_germany': 'physical',
    'cyber_premium_index': 'markets',
}
# reine Störfaktor-Filter: domain "context", weight 0
CONTEXT = {'patch_tuesday_calendar', 'geomagnetic_storm', 'xray_flux', 'ionosphere_scintillation',
           'dwd_weather_alerts', 'earthquakes', 'mowas_alert_count'}

# Gewichte: Default je (Domain, Klasse), dann Einzelwerte nach Rubrik
WEIGHT_DEFAULT = {'routing': 0.6, 'dns_core': 0.5, 'outages': 0.55, 'threat': 0.5, 'vuln': 0.45,
                  'finance': 0.5, 'services': 0.55, 'markets': 0.3, 'physical': 0.4, 'attention': 0.45}
WEIGHT = {
    # routing
    'bgp_withdrawals_global': 0.85, 'visible_prefixes_v4_v6': 0.85, 'country_prefix_visibility_de': 0.8,
    'asn_visibility_critical_de': 0.75, 'hijack_events': 0.7, 'route_leaks': 0.65, 'bgp_update_rate': 0.65,
    'new_origin_asn_rate': 0.6, 'ddos_scrubbing_diversions': 0.6, 'rpki_invalid_share': 0.5,
    'as_path_length_shift': 0.5, 'rpki_repository_health': 0.45, 'member_port_changes': 0.2,
    'pch_global_counts': 0.2, 'manrs_adoption': 0.2,
    # outages
    'ioda_outage_events_global': 0.85, 'ioda_country_signals_de': 0.8, 'cf_radar_outages': 0.8,
    'atlas_probe_connectivity': 0.75, 'traffic_anomalies': 0.75, 'cf_http_error_rates': 0.7,
    'decix_frankfurt_traffic': 0.7, 'amsix_linx_traffic': 0.65, 'cf_traffic_de': 0.65,
    'atlas_ping_global': 0.6, 'thousandeyes_internet_report': 0.6, 'cf_outage_cause_cable': 0.6,
    'latency_shift_regional': 0.55, 'cf_iqi_quality': 0.5, 'users_de': 0.4, 'mlab_ndt_throughput': 0.35,
    'github_push_volume': 0.35, 'relay_count_bandwidth': 0.3, 'mix_protocol_shift': 0.25,
    'ipv6_share_shift': 0.25, 'package_downloads_npm_pypi': 0.25, 'mobile_vs_desktop_shift': 0.2,
    'speedtest_open_data': 0.15,
    # dns_core
    'root_atlas_reachability': 0.8, 'servfail_rate': 0.75, 'tld_nameserver_reachability': 0.75,
    'dnssec_failures': 0.65, 'cf_query_volume_and_nxdomain': 0.6, 'mass_revocation': 0.6,
    'root_rssac002_volume': 0.5, 'ca_incidents_and_root_removals': 0.5, 'lookalike_issuance_gov_banks': 0.5,
    'ntp_pool_health_de': 0.5, 'issuance_volume': 0.45, 'log_availability': 0.45, 'root_instance_count': 0.4,
    'root_zone_changes': 0.3, 'top_domain_rank_volatility': 0.3, 'openintel_dns_dependency': 0.2,
    # threat
    'wiper_reports': 0.8, 'ics_malware': 0.75, 'simultaneous_victims': 0.75, 'greynoise_cve_tag_ips': 0.7,
    'victims_critical_sector': 0.7, 'dshield_port_scan_spike': 0.65, 'cloudflare_l3_attacks': 0.65,
    'leak_posts_daily': 0.6, 'victims_by_country_de': 0.6, 'cloudflare_l7_attacks': 0.6,
    'port_scanning_ot_protocols': 0.6, 'targets_by_country': 0.55, 'osv_malware_advisories': 0.55,
    'greynoise_noise_volume': 0.5, 'brand_domains_nrd': 0.5, 'npm_pypi_takedowns': 0.5,
    'cowrie_ssh_telnet': 0.45, 'shadowserver_reflectors': 0.45, 'urlhaus_volume': 0.45,
    'threatfox_ioc_volume': 0.45, 'feodo_c2_count': 0.45, 'new_ddos_botnet_ips': 0.45,
    'malwarebazaar_volume': 0.4, 'c2_hosting_concentration': 0.35, 'group_activity_new': 0.35,
    'openphish_volume': 0.35, 'spam_volume': 0.3, 'isc_infocon': 0.3, 'apwg_quarterly': 0.15,
    # vuln
    'msrc_out_of_band': 0.75, 'epss_jumps': 0.7, 'emergency_releases': 0.7, 'kev_additions_rate': 0.65,
    'kev_network_edge_share': 0.6, 'epss_high_count': 0.55, 'msrc_zero_day_count': 0.55,
    'shadowserver_exposed': 0.55, 'nuclei_templates': 0.55, 'kev_ransomware_flag': 0.5,
    'metasploit_modules': 0.45, 'exposed_ot_protocols': 0.45, 'nvd_critical_share': 0.4,
    'shodan_exposed_service_trend': 0.4, 'vulnerable_host_decay': 0.4, 'exploitdb_rate': 0.35,
    'nvd_cve_volume': 0.3, 'advisory_volume': 0.3, 'github_security_issue_spike': 0.3,
    'kev_due_date_short': 0.3, 'cert_bund_critical': 0.3, 'kev_ot_additions': 0.3,
    'cisa_ics_advisories': 0.25, 'vendor_advisories': 0.2,
    # finance
    'target_services_status': 0.85, 'fed_services_status': 0.85, 'swift_status': 0.85,
    'uk_chaps_faster_payments': 0.8, 'sepa_instant_rt1': 0.8, 'payment_providers': 0.8,
    'target_daily_volume': 0.6, 'open_banking_uk': 0.6, 'sofr_tail': 0.55, 'exchange_api_availability': 0.55,
    'estr_percentile_spread': 0.5, 'pix_upi_volumes': 0.5, 'crypto_exchange_statuspages': 0.5,
    'stablecoin_peg_deviation': 0.5, 'fed_repo_facility_usage': 0.45, 'ecb_marginal_lending': 0.45,
    'bitcoin_network_nodes': 0.45, 'exchange_reserves_outflow': 0.35, 'defi_tvl_drop': 0.35,
    'banknotes_in_circulation': 0.3, 'mempool_fee_spike': 0.3,
    # services
    'sec_8k_item105_same_vendor_cluster': 0.85, 'hyperscaler_incidents': 0.8, 'cdn_dns_providers': 0.8,
    'sec_8k_item105_daily_count': 0.75, 'saas_identity_m365': 0.75, 'sec_8k_financial_sector': 0.7,
    'statuspage_incident_rate': 0.7, 'eqs_adhoc_cyber': 0.65, 'sec_8k_keywords_outage': 0.6,
    'uk_rns_cyber': 0.6, 'cpaas_telecom': 0.6, 'hhs_ocr_hacking_incidents': 0.5,
    'bnetza_disruption_reports': 0.5, 'state_ag_notifications': 0.45, 'sec_8k_item105_amendments': 0.4,
    'ted_emergency_it': 0.35, 'sam_gov_justifications': 0.35, '8k_ciso_departures': 0.3,
    'dora_ico_incident_stats': 0.2,
    # markets
    'sip_feed_status': 0.65, 'nasdaq_nyse_halts': 0.6, 'xetra_market_status': 0.6, 'polymarket_cyber': 0.55,
    'cyber_etf_volume': 0.45, 'cyber_pureplay_volume': 0.45, 'market_volume_cyber': 0.45,
    'cdn_cloud_stress': 0.4, 'single_name_options': 0.4, 'form4_cyber_cloud': 0.4,
    'cyber_insurer_prices': 0.35, 'bafin_dealings': 0.35, 'form144_planned_sales': 0.35,
    'bank_equity_index': 0.3, 'bank_stocks': 0.3, 'form4_banks': 0.3, 'short_interest_cyber': 0.3,
    'vix_spike': 0.25, 'vix_term_structure': 0.25, 'putcall_ratio': 0.25, 'financial_stress_index': 0.25,
    'gold': 0.2, 'bitcoin_vs_gold_divergence': 0.2, 'safe_haven_fx': 0.2, 'cyber_premium_index': 0.15,
    'cat_bond_cyber': 0.15,
    # physical
    'emergency_number_outage': 0.75, 'airline_it_ground_stops': 0.6, 'hospital_it_outage': 0.6,
    'frequency_deviation_de': 0.55, 'generation_unit_outages_eu': 0.55, 'us_outage_customers': 0.55,
    'us_ground_stops': 0.55, 'eurocontrol_delays_it': 0.55, 'fcc_dirs_reports': 0.55,
    'frequency_rocof': 0.5, 'load_vs_forecast_de': 0.5, 'gtfsrt_feed_availability': 0.5,
    'cross_border_flow_anomaly': 0.45, 'solar_wind_feedin_sudden_drop': 0.45, 'opensky_flight_count': 0.45,
    'cancellation_rate': 0.45, 'galileo_service_status': 0.45, 'continuity_aircraft': 0.45,
    'irish_datacenter_load': 0.45, 'gnss_interference': 0.4, 'us_demand_balancing_authorities': 0.4,
    'adsb_coverage_loss': 0.4, 'db_cancellation_rate': 0.4, 'grid_load_germany': 0.4,
    'water_utility_alerts': 0.4, 'ioda_starlink_asn': 0.4, 'cross_border_flow_drop': 0.35,
    'ais_position_jumps': 0.35, 'price_spike_de': 0.3, 'storage_level_anomaly_eu': 0.3,
    'lng_sendout_anomaly': 0.3, 'starlink_fleet_count': 0.3, 'bizjet_nz_aggregate': 0.3,
    'bizjet_remote_havens': 0.3, 'notam_gps_interference': 0.25, 'ipaws_test_vs_actual': 0.25,
    'port_congestion': 0.25, 'gps_nanu_count': 0.2, 'navarea_warnings': 0.2, 'satellite_decay_events': 0.2,
    'map_inventory': 0.15,
    # attention (Klasse D: 0.3..0.7)
    'reddit_sysadmin_activity': 0.6, 'crowd_outage_aggregators': 0.6, 'stoerungsmelder_card_banking': 0.6,
    'mobile_outage_crowd': 0.6, 'wikipedia_cyber_terms': 0.55, 'hackernews_volume': 0.55,
    'gdelt_cyber_volume': 0.5, 'gdelt_cyber_bank_volume': 0.5, 'bluesky_mastodon_keywords': 0.5,
    'ooni_anomalies': 0.5, 'poc_github': 0.5, 'bank_app_review_spike': 0.5, 'eu_outage_reports_crowd': 0.5,
    'wikipedia_cash_prep': 0.45, 'google_trends_crisis': 0.45, 'wikipedia_traffic_baseline': 0.4,
    'wikipedia_edit_rate_outage_pages': 0.4, 'vt_malware_stats': 0.4, 'gsmr_outage': 0.4,
    'cloudflare_domain_rankings': 0.4, 'app_store_survival_apps': 0.35, 'steam_twitch_activity': 0.35,
    'metaculus_manifold': 0.35, 'fuel_station_outage': 0.35, 'traffic_lights_outage': 0.35,
    'security_repo_commit_hours': 0.35, 'domain_registrations_crisis_terms': 0.35,
    'ham_radio_activity': 0.3, 'meshtastic_nodes': 0.3, 'ship_ais_aggregate': 0.3,
    'incident_response_postings': 0.3, 'conference_cancellations': 0.3,
}
# Zeitreihen ohne Wochengang (Tagesdaten -> rolling statt day-of-week)
NO_WEEKLY = {'stablecoin_peg_deviation', 'mempool_fee_spike', 'exchange_reserves_outflow', 'defi_tvl_drop',
             'bitcoin_network_nodes', 'exchange_api_availability', 'bitcoin_vs_gold_divergence',
             'dshield_port_scan_spike', 'greynoise_noise_volume', 'cowrie_ssh_telnet', 'feodo_c2_count',
             'cloudflare_l3_attacks', 'cloudflare_l7_attacks', 'gnss_interference', 'starlink_fleet_count'}

# Umlaut-Korrektur: Ausnahmen (legitime ae/oe/ue) und ß-Wortstämme
UMLAUT_KEEP = {'aktuell', 'aktuelle', 'aktuellen', 'aktueller', 'zuerst', 'israel', 'michael', 'cboe',
               'maersk', 'queenstown', 'tuesday', 'issues', 'issue', 'true', 'value', 'values', 'due',
               'duedate', 'suez', 'fuel', 'does', 'goes', 'poet', 'boeing', 'aerospace', 'virtuell',
               'manuell', 'eventuell', 'individuell', 'sexuell', 'continue', 'revenue', 'venue', 'queue'}
WORD_FIX = {'faroer': 'Färöer', 'plotzlicher': 'Plötzlicher', 'plotzlich': 'plötzlich',
            'positionssprunge': 'Positionssprünge', 'positionssprungen': 'Positionssprüngen'}
SZ = [('gross', 'groß'), ('heisst', 'heißt'), ('ausmass', 'ausmaß'), ('ausserhalb', 'außerhalb'),
      ('ausserplanm', 'außerplanm'), ('aussergew', 'außergew'), ('ausser', 'außer'), ('aussen', 'außen'),
      ('mässig', 'mäßig'), ('massnahm', 'maßnahm'), ('verstoss', 'verstoß'), ('fussball', 'fußball')]

# ---------------------------------------------------------------- Helfer
changed_words = Counter()


def _case(src, dst):
    return dst[0].upper() + dst[1:] if src[:1].isupper() else dst


def fix_word(w):
    lw = w.lower()
    if lw in WORD_FIX:
        out = WORD_FIX[lw]
        return out if w[:1].isupper() else out.lower()
    if lw in UMLAUT_KEEP or lw.startswith(('blue', 'quel', 'steuer', 'aero')):
        out = w
    else:
        def rep(m):
            a, b = m.group(1), m.group(2)
            prev = m.string[m.start() - 1].lower() if m.start() > 0 else ''
            if a.lower() == 'u' and prev in 'qaeä':      # que, aue, eue (neue, Steuer, Dauer)
                return a + b
            if a.lower() == 'u' and m.string[m.end():m.end() + 2].lower() == 'll':  # aktuell, manuell
                return a + b
            if a.lower() == 'a' and prev == 'r' and m.string[m.end():m.end() + 1].lower() == 'l':  # Israel
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
    # URLs und Code in Backticks unangetastet lassen
    parts = re.split(r'(https?://\S+|`[^`]*`)', text)
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
    """0 = frei per API/Download, 1 = Key/Konto, 2 = nur Scrape, 3 = bezahlt."""
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
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|nc', lic or '', re.I))


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
        (r'unregelm|unbekannt|laufend', 60),
        (r'15 min|10 min|5-15|5-10', 15),
        (r'sekunden|echtzeit|\b1 s\b|10 s|30 s|unter 1 s|1-2 min|1-3 min|1-5 min|1 min|5 min', 5),
        (r'minuten', 15),
    ]
    for pat, v in rules:
        if re.search(pat, t):
            return v
    return 60


def baseline_for(interval, domain, slug):
    if interval <= 60:
        return {'method': 'hour-of-week', 'windowDays': 28, 'minPoints': 48}
    if interval <= 1440:
        if domain in ('routing', 'dns_core', 'context') or slug in NO_WEEKLY:
            return {'method': 'rolling', 'windowDays': 28, 'minPoints': 14}
        return {'method': 'day-of-week', 'windowDays': 56, 'minPoints': 21}
    # gröbere Reihen: Fenster so, dass genug Punkte zusammenkommen
    if interval <= 10080:
        return {'method': 'rolling', 'windowDays': 365, 'minPoints': 26}
    if interval <= 43200:
        return {'method': 'rolling', 'windowDays': 1095, 'minPoints': 24}
    return {'method': 'rolling', 'windowDays': 1825, 'minPoints': 12}


def kind_for(slug):
    if re.search(r'_status$|availability|market_status|_health$', slug):
        return 'binary' if 'status' in slug else 'gauge'
    if re.search(r'share|ratio|percent|spread|deviation|index|level|price|gold|vix|fx|peg|quality|'
                 r'frequency|rocof|load|fill|storage|tail|divergence|interest|throughput|visibility|'
                 r'traffic|latency|ping|connectivity|reachability|signals_de|stress|length', slug):
        return 'gauge'
    if re.search(r'_rate$|rate_|_rate_', slug):
        return 'rate'
    return 'count'


def unit_for(slug, kind):
    if kind == 'binary':
        return '0/1'
    for pat, u in [(r'latency|ping', 'ms'), (r'frequency_deviation', 'mHz'), (r'rocof', 'mHz/s'),
                   (r'load|feedin|demand', 'MW'), (r'price', 'EUR/MWh'), (r'share|ratio|percent', '%'),
                   (r'vix|index|stress', 'Indexpunkte'), (r'peg|deviation', '%'), (r'spread|tail', 'Basispunkte'),
                   (r'gold|stocks|prices|insurer|fx', 'Kurs'), (r'volume', 'Anzahl'), (r'cancellation_rate', '%')]:
        if re.search(pat, slug):
            return u
    return 'Anzahl' if kind in ('count', 'rate') else 'Messwert'


# ---------------------------------------------------------------- Einlesen
raw = []
for f in RESEARCH:
    with open(os.path.join(ROOT, 'catalog', 'research', f + '.json'), encoding='utf-8') as fh:
        d = json.load(fh)
    for s in d['signals']:
        s['_file'] = f
        raw.append(s)

# Quellen-Varianten nach kanonischer ID sammeln
variants = defaultdict(list)
for s in raw:
    for src in s['sources']:
        src = dict(src)
        src['_orig_id'] = src['source_id']
        src['source_id'] = canon(src['source_id'])
        if src['source_id'] in AUTH_OVERRIDE:
            src['auth'] = AUTH_OVERRIDE[src['source_id']][0]
        variants[src['source_id']].append(src)


def slug_of(s):
    return s['id'].split('.')[-1]


def merge_key(s):
    sl = slug_of(s)
    k = sl + '@' + s['id'].split('.')[1]
    return k if k in MERGE else sl


# Duplikate zusammenführen
by_slug = OrderedDict()
pending = []
for s in raw:
    k = merge_key(s)
    if k in MERGE:
        pending.append((MERGE[k].split('@')[0], s))
        continue
    sl = slug_of(s)
    assert sl not in by_slug, 'Slug-Kollision: ' + sl
    s['_merged'] = []
    s['_sources'] = []
    for src in s['sources']:
        src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
        if src['source_id'] in AUTH_OVERRIDE:
            src['auth'] = AUTH_OVERRIDE[src['source_id']][0]
        s['_sources'].append(src)
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
    for src in s['sources']:
        src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
        if src['source_id'] in AUTH_OVERRIDE:
            src['auth'] = AUTH_OVERRIDE[src['source_id']][0]
        t['_sources'].append(src)

# ---------------------------------------------------------------- Signale bauen
signals = []
for sl, s in by_slug.items():
    ev = s['evidence_class']
    rdom = s['domain']
    if sl in CONTEXT:
        dom = 'context'
    elif ev == 'D':
        dom = 'attention'
    elif sl in DOMAIN_OVERRIDE:
        dom = DOMAIN_OVERRIDE[sl]
    else:
        dom = DOMAIN_DEFAULT[rdom]
    # Hauptquelle: bester Zugang, bei Gleichstand Reihenfolge der Recherche
    srcs = s['_sources']
    main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    alt = []
    for src in srcs:
        if src['source_id'] != main['source_id'] and src['source_id'] not in alt:
            alt.append(src['source_id'])
    if dom == 'context':
        w = 0.0
    else:
        w = WEIGHT.get(sl, WEIGHT_DEFAULT[dom])
        if ev == 'C':
            w = min(w, 0.3)
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
    kind = kind_for(sl)
    direction = s['direction'] if s['direction'] in ('up', 'down', 'both') else 'both'
    notes = []
    if s.get('notes'):
        notes.append(de(s['notes']))
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if main['source_id'] in AUTH_OVERRIDE:
        notes.append(AUTH_OVERRIDE[main['source_id']][1])
    if ev == 'C':
        notes.append('Klasse C: nur Kontext-Layer, wird von der Engine nicht gewertet.')
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + de(main['sample_note']))
    sig = OrderedDict([
        ('id', 'cyber.%s.%s' % (dom, sl)),
        ('scenarios', ['cyber']),
        ('domain', dom),
        ('name', de(s['name_de'])),
        ('plain', de(s['plain_de'])),
        ('evidenceClass', ev),
        ('direction', direction),
        ('kind', kind),
        ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', main['source_id']),
        ('collector', COLLECTOR.get(main['source_id'], main['source_id'])),
        ('unit', unit_for(sl, kind)),
        ('baseline', baseline_for(iv, dom, sl)),
        ('intervalMinutes', iv),
        ('status', status),
        ('sourceName', main.get('name')),
        ('sourceUrl', main.get('doc_url')),
        ('license', lic),
        ('rationale', de(s.get('rationale'))),
        ('banalCauses', [de(b) for b in s['banal_causes']]),
        ('endpoint', main.get('endpoint')),
        ('auth', main.get('auth')),
        ('history', main.get('history')),
        ('priority', s['priority']),
        ('verified', bool(main.get('verified'))),
        ('leadTime', s.get('lead_time')),
        ('format', main.get('format')),
        ('notes', ' '.join(notes)),
    ])
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    signals.append(sig)

signals.sort(key=lambda x: (DOMAINS.index(x['domain']) if x['domain'] in DOMAINS else 99, -x['weight'], x['id']))

# ---------------------------------------------------------------- Quellen-Matrix
sig_by_src = defaultdict(list)
for sg in signals:
    for sid in dict.fromkeys(sg['_all_src']):
        sig_by_src[sid].append(sg['id'])

sources = []
for sid in sorted(variants):
    vs = variants[sid]
    exact = [v for v in vs if v['_orig_id'] == sid]
    best = min(exact or vs, key=access_score)
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    sources.append(OrderedDict([
        ('id', sid), ('name', best.get('name')), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', de(best.get('update_latency'))),
        ('history', de(best.get('history'))), ('rateLimit', de(best.get('rate_limit'))),
        ('license', de(best.get('license'))), ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})),
        ('collector', COLLECTOR.get(sid, sid)),
        ('signals', sig_by_src.get(sid, [])), ('scenarios', ['cyber']),
    ]))
src_index = {s['id']: s for s in sources}

# ---------------------------------------------------------------- Bau-Reihenfolge
coll = OrderedDict()
for sg in signals:
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'domains': Counter(), 'maxw': 0.0,
                                          'keyfree': False, 'top': None})
    c['signals'].append(sg['id'])
    c['mains'].append(sg['_main'])
    if sg['domain'] != 'context':
        c['domains'][sg['domain']] += sg['weight']
    if sg['weight'] >= c['maxw']:
        c['maxw'] = sg['weight']
    if sg['status'] == 'planned':
        c['keyfree'] = True

rows = []
for cid, c in coll.items():
    mains = c['mains']
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download')
                and not is_stream(m) and is_free(m) for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0] if c['domains'] else 'context'
    rows.append({'collector': cid, 'domain': dom, 'keyfree': c['keyfree'], 'small': small, 'hist': hist,
                 'value': c['maxw'], 'c': c,
                 'key': (not c['keyfree'], not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

chosen = []
for d in DOMAINS:  # Pflicht-Abdeckung: 3 je Domain
    for r in [r for r in rows if r['domain'] == d][:3]:
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
    for sid in srcs_ids:
        eps += [e for e in src_index[sid]['endpoints'] if e not in eps]
    ver = any(src_index[sid]['verified'] for sid in srcs_ids)
    unc = []
    if not ver:
        unc.append('Endpunkt aus der Recherche, nicht geprüft (verified=false)')
    notes = [de(m.get('sample_note')) for m in c['mains'] if m.get('sample_note')]
    if notes:
        unc.append('Messfeld laut Recherche: ' + notes[0])
    lic = src_index[srcs_ids[0]]['license']
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    rl = src_index[srcs_ids[0]]['rateLimit']
    if rl and rl != 'unklar':
        unc.append('Rate-Limit: ' + rl)
    why = []
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % src_index[srcs_ids[0]]['format'].upper() if r['small'] else 'Format/Zugang aufwändiger')
    why.append('Historie per API: ' + src_index[srcs_ids[0]]['history'] if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('signals', c['signals']),
        ('endpoints', eps), ('format', src_index[srcs_ids[0]]['format']), ('history', r['hist']),
        ('verified', ver), ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Doku-Tabellen
def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


key_rows = []
main_cnt = Counter(sg['independenceGroup'] for sg in signals if sg['status'] == 'needs-key')
for s in sources:
    best_needs = not is_free({'auth': s['auth'], 'cost': s['cost']})
    any_needs = any(not is_free(v) for v in variants[s['id']])
    if not (best_needs or any_needs or main_cnt[s['id']]):
        continue
    names = [sg['name'] for sg in signals if sg['independenceGroup'] == s['id']]
    if not names:
        names = ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in s['signals'][:3])]
    alt = len(s['signals']) - len([sg for sg in signals if sg['independenceGroup'] == s['id']])
    cnt = '%d' % main_cnt[s['id']] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    env = 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', s['id'].upper())
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(s['auth'], s['auth'])
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(s['cost']), auth, s['docUrl'], env, cnt))

keys_md = ['# Benötigte Keys, Konten und Bezahlzugänge (Szenario cyber)', '',
           'Automatisch erzeugt von `scripts/consolidate_cyber.py`. Collectors ohne Key werden übersprungen, '
           'nicht als Fehler gewertet. Der Link führt auf die Doku-Seite der Quelle; die Anmeldung ist dort verlinkt. '
           '"Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key.', '',
           '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |',
           '|---|---|---|---|---|---|'] + key_rows + ['']

lic_rows = []
for s in sources:
    lic = s['license'] or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if s['access'] == 'scrape' and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s['access'], flag, md_cell(lic), s['docUrl']))
lic_md = ['# Lizenz noch klären (Szenario cyber)', '',
          'Automatisch erzeugt von `scripts/consolidate_cyber.py`. Aufgenommen: Lizenz laut Recherche unklar oder '
          'ungeprüft, oder Nutzungsbedingungen schränken automatisierten/kommerziellen Abruf ein. '
          'Signale, deren Hauptquelle nur per Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`.', '',
          '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + ['']

# ---------------------------------------------------------------- Ausgabe
for sg in signals:
    sg.pop('_main')
    sg.pop('_all_src')

os.makedirs(os.path.dirname(OUT_SIGNALS), exist_ok=True)
for path, obj in [(OUT_SIGNALS, signals), (OUT_SOURCES, sources), (OUT_BUILD, build)]:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
for path, lines in [(OUT_KEYS, keys_md), (OUT_LIC, lic_md)]:
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))

# ---------------------------------------------------------------- Selbstprüfung
errors = []
for path in (OUT_SIGNALS, OUT_SOURCES, OUT_BUILD):
    with open(path, encoding='utf-8') as fh:
        json.load(fh)
sigs = json.load(open(OUT_SIGNALS, encoding='utf-8'))
ids = [x['id'] for x in sigs]
if len(ids) != len(set(ids)):
    errors.append('doppelte IDs: %s' % [i for i, n in Counter(ids).items() if n > 1])
dc = Counter(x['domain'] for x in sigs)
for d in DOMAINS + ['context']:
    if not dc[d]:
        errors.append('Domain leer: ' + d)
for x in sigs:
    if not x.get('sourceUrl') or not x.get('collector'):
        errors.append('sourceUrl/collector fehlt: ' + x['id'])
    if not 0 <= x['weight'] <= 1:
        errors.append('weight außerhalb 0..1: ' + x['id'])
    if x['evidenceClass'] == 'D' and x['domain'] != 'attention':
        errors.append('Klasse D außerhalb attention: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary'):
        errors.append('kind: ' + x['id'])
bdc = Counter(b['domain'] for b in build)
for d in DOMAINS:
    if bdc[d] < 3:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz stimmt nicht: %d + %d != %d' % (len(sigs), merged_in, len(raw)))

print('Recherche-Signale: %d, zusammengeführt: %d, Katalog: %d' % (len(raw), merged_in, len(sigs)))
print('Domains:', dict(sorted(dc.items())))
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen: %d, Collectors: %d, verifiziert: %d' % (len(sources), len(coll), sum(s['verified'] for s in sources)))
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Top 15:', ', '.join('%s(%s)' % (b['collector'], b['domain']) for b in build[:15]))
if '-v' in sys.argv:
    print('Umlaut-Korrekturen:', ' '.join(sorted(changed_words)))
    for b in build:
        print(b['rank'], b['collector'], b['domain'], b['history'], b['why'][:90])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
