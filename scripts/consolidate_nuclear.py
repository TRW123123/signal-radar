#!/usr/bin/env python3
"""Konsolidiert die Recherche zum Szenario nuclear (Nuklearer Zwischenfall) zu Signal-Katalog,
Szenario-Eintrag, Bau-Reihenfolge, Quellen-Matrix sowie Schlüssel- und Lizenzliste.

Aufruf:  python3 -I scripts/consolidate_nuclear.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_war.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Schreibt ausschließlich neue Dateien (keine bestehenden Dateien werden geändert):
  catalog/signals/nuclear.json, catalog/nuclear-build-order.json, catalog/research/nuclear-scenario-def.json,
  catalog/research/nuclear-sources.json, catalog/research/nuclear-keys.md, catalog/research/nuclear-license-todo.md
Hinweis: Die Recherche enthält bereits echte Umlaute; anders als bei cyber/war ist keine Umlaut-Korrektur nötig.
"""
import glob
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'catalog')
RES = os.path.join(CAT, 'research')
S = 'nuclear'
IN_RESEARCH = os.path.join(RES, S + '-all.json')
OUT_SIGNALS = os.path.join(CAT, 'signals', S + '.json')
OUT_BUILD = os.path.join(CAT, S + '-build-order.json')
OUT_SCEN = os.path.join(RES, S + '-scenario-def.json')
OUT_SOURCES = os.path.join(RES, S + '-sources.json')
OUT_KEYS = os.path.join(RES, S + '-keys.md')
OUT_LIC = os.path.join(RES, S + '-license-todo.md')

# Domains der Szenario-Definition (ohne attention/context). behaviour entfällt: nach Klasse-D-Regel bleibt dort nur
# ein Signal (Jodtabletten-Preis, Klasse A); es kommt zu markets.
DOMAINS = ['radiation', 'seismic', 'plants', 'alerts', 'military', 'markets']
EXTRA_DOMAINS = ['attention', 'context']
DOM_ORDER = DOMAINS + EXTRA_DOMAINS
BUILD_N = 20
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2   # Klasse C (Aussagen von Behörden, Firmen, Konfliktparteien, auch als CSV): höchstens 0,2
TODAY = '17.11.2026'

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs, die dieselbe Quelle meinen -> kanonische ID (bevorzugt die ID aus catalog/sources.json)
ALIAS = {
    'usgs-fdsn': 'usgs', 'iris-fdsn': 'iris-dmc', 'ctbto': 'ctbto-rss', 'nga-msi': 'navarea', 'nina': 'nina-mowas',
    'google-trends': 'google-trends-unofficial', 'mastodon': 'mastodon-trends', 'open-meteo-bl': 'open-meteo',
}
# Quelle -> Collector-ID, wo der Collector anders heißt als die Quelle
COLLECTOR = {}
# Korrekturen an Quellenangaben (Stand der Prüfung am 17.11.2026)
SRC_FIX = {
    'github-air-raid-sirens': {
        'name': 'Ukrainian air raid sirens dataset (GitHub, Vadimkin)',
        'doc_url': 'https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset',
        'endpoint': 'https://raw.githubusercontent.com/Vadimkin/ukrainian-air-raid-sirens-dataset/main/datasets/volunteer_data_en.csv',
        'license': 'unklar (Lizenzdatei nicht geprüft)', 'format': 'csv',
        'history': 'Verlauf je Region seit 2022',
    },
}
# Auf raw.githubusercontent.com liegende Quellen, am 17.11.2026 per curl als aktuell geprüft
GITHUB_CURRENT = {
    'github-air-raid-sirens': 'volunteer_data_en.csv: letzter Alarm 16.11.2026',
    'owid-energy': 'owid-energy-data.csv: HTTP 200, Zeilen bis Jahr 2025 (jährliche Reihe, 23 000 Zeilen, mehrere MB)',
}
STALE_ENDPOINT_NOTE = {
    'github-air-raid-sirens': 'official_data_en.csv endet 07.09.2026; volunteer_data_en.csv ist aktuell.',
}

# Duplikate: Slug -> Slug des führenden Eintrags
MERGE = {
    'bfs_odl_24h_longrun': 'bfs_median_dose_rate',
    'shallow_events_nk_region_mb': 'events_near_punggye_ri',
    'fr_eco2mix_nuclear': 'fr_nuclear_generation',
    'dwd_precipitation_radar': 'rain_washout',
}
# Recherche-Segment -> Domain (behaviour: nur Jodpreis bleibt, siehe DOMAIN_OVERRIDE)
DOMAIN_DEFAULT = {'radiation': 'radiation', 'seismic': 'seismic', 'plants': 'plants', 'alerts': 'alerts',
                  'military': 'military', 'markets': 'markets', 'context': 'context', 'behaviour': 'markets'}
DOMAIN_OVERRIDE = {'eu_hot_weather_derate': 'context'}   # Wetter als Störfaktor der Kraftwerksleistung

# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {'fr_nuclear_generation': 'energy-charts', 'rain_washout': 'open-meteo'}
# Unabhängigkeitsgruppe, wo mehrere Quellen denselben Ursprung haben
INDEP = {'bfs-odl': 'bfs-imis', 'eurdep-bfs': 'bfs-imis', 'open-meteo': 'open-meteo'}
DIRECTION_OVERRIDE = {'iodine_tablet_price': 'up', 'defense_stocks': 'up'}
EVIDENCE_OVERRIDE = {}   # Prognosemärkte bleiben Klasse A (Marktpreise) wie in der Szenario-Definition ("markets")
STATUS_OVERRIDE = {      # Scraping gegen Nutzungsbedingungen: erst Lizenz klären
    'iodine_tablet_price': 'license-unclear', 'google_trends_iodine': 'license-unclear',
}
INTERVAL = {'isc_reviewed_events': 43200, 'fred_uranium_price': 43200, 'owid_nuclear_baseline': 525600,
            'fi_fingrid_nuclear': 5, 'us_nrc_reactor_status': 1440, 'ctbto_press': 1440}

W = {
    # radiation (Klasse A, 0,8-0,9 sehr spezifisch und schwer zu fälschen)
    'bfs_stations_above_normal': 0.9, 'regional_spread_pattern': 0.9, 'bfs_median_dose_rate': 0.8,
    'eurdep_stations_above_normal_pl': 0.8, 'eurdep_stations_above_normal_baltic_nordic': 0.8,
    'eurdep_stations_above_normal_ukraine_adjacent': 0.8, 'eurdep_europe_median': 0.8,
    'bfs_max_station_jump': 0.7, 'ch_nadam': 0.7, 'nl_be_nrm_rivm': 0.7, 'us_epa_radnet': 0.7,
    'jp_nra_monitoring': 0.6, 'kr_kins_iernet': 0.6, 'ca_crmn_xenon': 0.6,
    'bfs_stations_offline': 0.5, 'safecast_global': 0.5, 'uradmonitor_europe': 0.5,
    'radmon_org': 0.4, 'ua_ecozagroza': 0.3,
    # seismic
    'events_near_punggye_ri': 0.9, 'events_near_novaya_zemlya': 0.85, 'events_near_lop_nur': 0.8,
    'events_near_nevada_nnss': 0.8, 'events_near_pokhran': 0.6, 'events_near_chagai': 0.6,
    'explosion_type_global_count': 0.6, 'station_noise_mdj': 0.5, 'isc_reviewed_events': 0.5,
    'ukraine_zone_explosions': 0.5, 'ctbto_press': 0.15,
    # plants (Klasse B)
    'fr_nuclear_generation': 0.6, 'us_nrc_event_reports': 0.6, 'entsoe_unavailability_nuclear': 0.55,
    'us_nrc_reactor_status': 0.55, 'entsoe_nuclear_generation_per_unit': 0.5, 'uk_elexon_nuclear': 0.45,
    'fi_fingrid_nuclear': 0.45, 'entsoe_ukraine_grid': 0.4, 'iaea_pris_status': 0.35, 'owid_nuclear_baseline': 0.2,
    'znpp_external_power': 0.15,
    # alerts (Klasse C: höchstens 0,2)
    'nina_mowas_count': 0.2, 'nina_keyword_radiological': 0.2, 'nws_radiological_events': 0.2,
    'fema_ipaws_archive': 0.15, 'ua_air_raid_sirens': 0.15, 'alertswiss_ch': 0.15,
    # military
    'adsb_command_relay_aircraft': 0.7, 'adsb_tanker_bomber_count': 0.6, 'navarea_missile_test_warnings': 0.5,
    'faa_notam_us_closures': 0.5, 'gnss_jamming_aggregates': 0.4, 'adsb_mil_total': 0.35,
    'celestrak_launches_daily': 0.3,
    # markets (0,2-0,4 generisch, Prognosemarkt und Jodpreis mäßig spezifisch)
    'polymarket_nuclear': 0.5, 'iodine_tablet_price': 0.5, 'uranium_etf_urnm': 0.4, 'uranium_trust_sprott': 0.35,
    'cameco_ccj': 0.35, 'defense_stocks': 0.3, 'vix_gold': 0.25, 'fred_uranium_price': 0.2,
    # attention (Klasse D: 0,3-0,7)
    'wiki_plants_sites': 0.55, 'google_trends_iodine': 0.55, 'wiki_nuclear_en': 0.5, 'wiki_nuclear_de': 0.5,
    'gdelt_nuclear_volume': 0.5, 'metaculus_nuclear': 0.4, 'mastodon_nuclear_tags': 0.35, 'shelter_osm_count': 0.3,
}
ROLLING_DOMAINS = {'seismic', 'markets', 'plants', 'context'}

# Messart und Einheit je Signal (Slug); alles andere: count / Anzahl
GAUGE = {'bfs_median_dose_rate', 'bfs_max_station_jump', 'eurdep_europe_median', 'ch_nadam', 'safecast_global',
         'radmon_org', 'uradmonitor_europe', 'nl_be_nrm_rivm', 'ua_ecozagroza', 'us_epa_radnet', 'jp_nra_monitoring',
         'kr_kins_iernet', 'ca_crmn_xenon', 'rain_washout', 'wind_direction_ukraine_poland', 'neutron_monitor_nmdb',
         'radon_exhalation_proxy', 'solar_geomagnetic', 'station_noise_mdj', 'fr_nuclear_generation',
         'uk_elexon_nuclear', 'fi_fingrid_nuclear', 'entsoe_nuclear_generation_per_unit', 'entsoe_ukraine_grid',
         'owid_nuclear_baseline', 'iodine_tablet_price', 'uranium_etf_urnm', 'uranium_trust_sprott', 'cameco_ccj',
         'defense_stocks', 'vix_gold', 'polymarket_nuclear', 'metaculus_nuclear', 'fred_uranium_price',
         'gdelt_nuclear_volume', 'google_trends_iodine', 'eu_hot_weather_derate', 'regional_spread_pattern'}
UNIT = {
    'bfs_median_dose_rate': 'µSv/h', 'bfs_max_station_jump': 'µSv/h', 'eurdep_europe_median': 'µSv/h',
    'ch_nadam': 'µSv/h', 'safecast_global': 'µSv/h', 'radmon_org': 'µSv/h', 'uradmonitor_europe': 'µSv/h',
    'nl_be_nrm_rivm': 'µSv/h', 'ua_ecozagroza': 'µSv/h', 'us_epa_radnet': 'µSv/h', 'jp_nra_monitoring': 'µSv/h',
    'kr_kins_iernet': 'µSv/h', 'ca_crmn_xenon': 'Messwert', 'rain_washout': 'mm', 'wind_direction_ukraine_poland': 'Grad',
    'neutron_monitor_nmdb': 'Zählrate', 'radon_exhalation_proxy': 'm', 'solar_geomagnetic': 'Kp',
    'station_noise_mdj': 'Messwert', 'fr_nuclear_generation': 'MW', 'uk_elexon_nuclear': 'MW',
    'fi_fingrid_nuclear': 'MW', 'entsoe_nuclear_generation_per_unit': 'MW', 'entsoe_ukraine_grid': 'MW',
    'owid_nuclear_baseline': 'TWh', 'iodine_tablet_price': 'EUR', 'uranium_etf_urnm': 'Kurs',
    'uranium_trust_sprott': 'Kurs', 'cameco_ccj': 'Kurs', 'defense_stocks': 'Kurs', 'vix_gold': 'Kurs',
    'polymarket_nuclear': '%', 'metaculus_nuclear': '%', 'fred_uranium_price': 'USD', 'gdelt_nuclear_volume': '%',
    'google_trends_iodine': 'Indexpunkte', 'eu_hot_weather_derate': '°C', 'regional_spread_pattern': 'Anteil',
}

# Erweiterung vorhandener Collectors: was konkret zu ergänzen ist (für die Bau-Reihenfolge)
EXTEND_WHAT = {
    'github-air-raid-sirens': 'bereits geladene Alarm-Datei (volunteer_data_en.csv) zusätzlich als Signal nuclear.alerts.ua_air_raid_sirens melden (Klasse C, Gewicht 0,15); kein neuer Abruf',
    'adsb-lol': 'Typabfrage /v2/type/E6B (Kommandoflugzeuge; Typcodes E4B, RC135 laut Recherche ungeprüft) und Zählung von Tankern/Bombern über das Typfeld t des /v2/mil-Ergebnisses ergänzen; nur Zähler speichern, keine Kennungen; Gesamtzähler nuclear.military.adsb_mil_total aus dem vorhandenen Abruf',
    'energy-charts': 'Abruf /public_power?country=fr ergänzen und die Produktionsart Kernenergie (Stundenmittel in MW) ausgeben',
    'wikimedia-pageviews': 'drei Artikelgruppen in GROUPS ergänzen: englisch (z. B. Nuclear_fallout), deutsch (z. B. Kaliumiodid) und Kraftwerksartikel (z. B. Zaporizhzhia_Nuclear_Power_Plant)',
    'gdelt-doc': 'Strom (nuclear OR radiation OR reactor) sourcelang:english in STREAMS ergänzen',
    'yahoo-chart': 'Symbole URA, URNM, U-UN.TO und CCJ ergänzen; LMT, NOC, RHM.DE, ^VIX und GC=F auch für nuclear melden',
    'polymarket-gamma': 'Suchbegriffe und Fragetext-Filter für nuclear (Atomwaffen, Atomschlag, Atomtest) in SCENARIO_CFG ergänzen',
    'mastodon-trends': 'Begriffsliste für nuclear (Atom-, Strahlungs- und Fallout-Tags) ergänzen',
    'noaa-swpc': 'vorhandenen Kp-Wert zusätzlich als nuclear.context.solar_geomagnetic melden',
}

# ---------------------------------------------------------------- Helfer (aus consolidate_war.py)

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
    return bool(re.search(r'unklar|pr(ü|ue)f|\?|beachten|nutzungsbedingungen', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|\bnc\b|propriet', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|selbst|gering|unbekannt|unklar|nur z(ä|ae)hler|eingeschr|'
                      r'begrenzt|feed-fenster|letzte|webseite|kurz|nur feed|nur latest|nur aktiv|30 tage|rollierend', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [
        (r'j(ä|ae)hrlich', 525600), (r'quartal', 129600), (r'monatlich', 43200),
        (r'w(ö|oe)chentlich|^wochen', 10080),
        (r'(ä|ae)glich|tagesende|^tage|gesch(ä|ae)ftstag|~1 tag|\b1 tag\b|stunden bis tage|minuten bis tage', 1440),
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
    src.update(SRC_FIX.get(src['source_id'], {}))
    if src['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (src.get('endpoint') or ''):
        src['verified'] = True
    return src


def slug_of(s):
    return s['id'].split('.')[-1]


def seg_of(s):
    return s['id'].split('.')[1]


def clean_note(t):
    t = re.sub(r'(Klasse C: )?Gewicht 0(,[0-9]+)?(, nur Kontext)?\.?', '', t or '').strip()
    return re.sub(r'\s+', ' ', t)


# ---------------------------------------------------------------- Einlesen
research = json.load(open(IN_RESEARCH, encoding='utf-8'))
raw = research['signals']
BUILT = built_collectors()

variants = defaultdict(list)
for s in raw:
    s['_srcs'] = []
    for src in s['sources']:
        src = prep_src(src)
        variants[src['source_id']].append(src)
        s['_srcs'].append(src)

by_slug = OrderedDict()
pending = []
for s in raw:
    sl = slug_of(s)
    if sl in MERGE:
        pending.append((MERGE[sl], s))
        continue
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
    if s.get('notes') and clean_note(s['notes']):
        t['notes'] = ((t.get('notes') or '') + ' ' + clean_note(s['notes'])).strip()
    t['_sources'] += s['_srcs']

# ---------------------------------------------------------------- Signale bauen
signals = []
for sl, s in by_slug.items():
    ev = EVIDENCE_OVERRIDE.get(sl, s['evidence_class'])
    if sl in DOMAIN_OVERRIDE:
        dom = DOMAIN_OVERRIDE[sl]
    elif ev == 'D':
        dom = 'attention'
    else:
        dom = DOMAIN_DEFAULT[seg_of(s)]
    srcs = s['_sources']
    if sl in MAIN:
        main = next(x for x in srcs if x['source_id'] == MAIN[sl])
    else:
        main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    sid = main['source_id']
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    if direction not in ('up', 'down', 'both'):
        direction = 'both'
    if dom == 'context':
        w = 0.0
    else:
        w = W[sl]
        if ev == 'C':
            w = min(w, C_CAP)
        if ev == 'D':
            w = max(0.3, min(0.7, w))
    lic = main.get('license') or 'unklar'
    if sl in STATUS_OVERRIDE:
        status = STATUS_OVERRIDE[sl]
    elif not is_free(main):
        status = 'needs-key'
    elif lic_unclear(lic) and main.get('access') == 'scrape':
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = INTERVAL.get(sl) or (1440 if sid == 'yahoo-chart' else interval_from(main.get('update_latency')))
    kind = 'gauge' if sl in GAUGE else 'count'
    unit = UNIT.get(sl, 'Anzahl')
    alt = []
    for x in srcs:
        if x['source_id'] != sid and x['source_id'] not in alt:
            alt.append(x['source_id'])
    eps = list(dict.fromkeys(x['endpoint'] for x in srcs if x['source_id'] == sid and x.get('endpoint')))
    notes = []
    if clean_note(s.get('notes')):
        notes.append(clean_note(s['notes']))
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if len(eps) > 1:
        notes.append('Weitere Endpunkte derselben Quelle: ' + ' ; '.join(eps[1:]) + '.')
    if sid in GITHUB_CURRENT:
        notes.append('GitHub-Spiegel aktuell (geprüft %s): %s.' % (TODAY, GITHUB_CURRENT[sid]))
    if sid in STALE_ENDPOINT_NOTE:
        notes.append(STALE_ENDPOINT_NOTE[sid])
    if ev == 'C':
        notes.append('Klasse C: Aussage von Behörden, nicht unabhängig prüfbar; Gewicht höchstens %.1f.' % C_CAP)
    if dom == 'context':
        notes.append('Störfaktor-Filter: Gewicht 0, dient nur dazu, harmlose Ausschläge anderer Signale zu erklären.')
    if sl == 'iodine_tablet_price':
        notes.append('Domain markets: nach der Klasse-D-Regel bleibt in der früheren Domain behaviour nur dieses Signal.')
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + main['sample_note'])
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    coll = COLLECTOR.get(sid, sid)
    sig = OrderedDict([
        ('id', '%s.%s.%s' % (S, dom, sl)), ('scenarios', [S]), ('domain', dom),
        ('name', s['name_de']), ('plain', s['plain_de']), ('evidenceClass', ev), ('direction', direction),
        ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', INDEP.get(sid, sid)), ('collector', coll), ('unit', unit),
        ('baseline', baseline_for(iv, dom)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', main.get('name')), ('sourceUrl', main.get('doc_url')), ('license', lic),
        ('rationale', s.get('rationale')), ('banalCauses', list(s['banal_causes'])),
        ('endpoint', main.get('endpoint')), ('auth', main.get('auth')), ('history', main.get('history')),
        ('priority', s['priority']), ('verified', bool(main.get('verified'))), ('leadTime', lead),
        ('format', main.get('format')), ('notes', ' '.join(notes)),
        ('extends', coll if coll in BUILT else None),
    ])
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    sig['_slug'] = sl
    signals.append(sig)

signals.sort(key=lambda x: (DOM_ORDER.index(x['domain']), -x['weight'], x['id']))

# ---------------------------------------------------------------- Quellen-Matrix
sig_by_src = defaultdict(list)
for sg in signals:
    for sid in dict.fromkeys(sg['_all_src']):
        sig_by_src[sid].append(sg['id'])

sources = []
for sid in sorted(variants):
    vs = variants[sid]
    exact = [v for v in vs if v['_orig_id'] == sid]
    best = min(vs, key=lambda v: (access_score(v), v.get('format') not in ('json', 'csv'), v not in exact,
                                  not v.get('verified')))
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    sources.append(OrderedDict([
        ('id', sid), ('name', best.get('name')), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', best.get('update_latency')),
        ('history', best.get('history')), ('rateLimit', best.get('rate_limit')),
        ('license', best.get('license')), ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})),
        ('collector', COLLECTOR.get(sid, sid)), ('signals', sig_by_src.get(sid, [])), ('scenarios', [S]),
    ]))
src_index = {s['id']: s for s in sources}

# ---------------------------------------------------------------- Bau-Reihenfolge
def gh_current(m):
    return m['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (m.get('endpoint') or '') \
        and bool(m.get('verified'))


coll = OrderedDict()
for sg in signals:
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'domains': Counter(), 'maxw': 0.0, 'keyfree': False})
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
    hist = any(has_history(v) for sid in {m['source_id'] for m in mains} for v in variants[sid])
    dom = c['domains'].most_common(1)[0][0] if c['domains'] else 'context'
    forbid = any(re.search(r'verbiet|kein scrap', m.get('license') or '', re.I) for m in mains)
    rows.append({'collector': cid, 'domain': dom, 'gh': gh, 'extends': ext, 'keyfree': c['keyfree'],
                 'small': small, 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not gh, ext is None, not c['keyfree'], forbid, not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

chosen = []
for d in DOMAINS + ['attention']:
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
    notes = [m['sample_note'] for m in c['mains'] if m.get('sample_note')]
    if notes:
        unc.append('Messfeld laut Recherche: ' + notes[0])
    for sid in srcs_ids:
        if sid in STALE_ENDPOINT_NOTE:
            unc.append(STALE_ENDPOINT_NOTE[sid])
    if r['gh'] and srcs_ids[0] == 'owid-energy':
        unc.append('Jährliche Reihe (letztes Jahr 2025), kaum Frühwarnwert; große CSV (mehrere MB) statt kleiner Antwort')
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
        why.append('Erweiterung von %s: %s' % (r['extends'], EXTEND_WHAT.get(r['extends'], 'Länder/Symbole/Begriffe ergänzen')))
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % (s0.get('format') or '').upper() if r['small'] else 'Format/Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver),
        ('live', r['gh']), ('extends', r['extends']),
        ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Szenario-Eintrag
sd = research['scenario_def']
scenario = OrderedDict([
    ('id', S), ('order', 6), ('title', 'Nuklearer Zwischenfall'),
    ('question', 'Gibt es Anzeichen für einen nuklearen Unfall oder Einsatz?'),
    ('tagline', 'Strahlungs-Messnetze, Erdbebendaten, Kraftwerksleistung, Warnsysteme'),
    ('domains', OrderedDict()),
])
for d in DOMAINS:
    e = dict(sd['domains'][d])
    scenario['domains'][d] = OrderedDict([('title', e['title']), ('weight', e['weight']), ('plain', e['plain'])])
scenario['domains']['markets'] = OrderedDict([
    ('title', 'Märkte, Wetten und Vorsorgekäufe'), ('weight', 0.5),
    ('plain', 'Uran, Rüstungsaktien, Prognosemärkte und der Preis für Jodtabletten')])

# ---------------------------------------------------------------- Schlüssel- und Lizenzliste
def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


main_cnt = Counter(sg['_main']['source_id'] for sg in signals if sg['status'] == 'needs-key')
key_rows = []
for s in sources:
    any_needs = any(not is_free(v) for v in variants[s['id']])
    if not (any_needs or main_cnt[s['id']]):
        continue
    mine = [sg for sg in signals if sg['_main']['source_id'] == s['id']]
    names = [sg['name'] for sg in mine] or ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in s['signals'][:3])]
    alt = len(s['signals']) - len(mine)
    cnt = '%d' % main_cnt[s['id']] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in variants[s['id']] if not is_free(v)), variants[s['id']][0])
    env = 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', s['id'].upper())
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], env, cnt))
keys_md = '\n'.join([
    '# Benötigte Keys, Konten und Bezahlzugänge (Szenario nuclear)', '',
    'Automatisch erzeugt von `scripts/consolidate_nuclear.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort '
    'schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.', '',
    '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |', '|---|---|---|---|---|---|'] + key_rows + [''])

lic_rows = []
for s in sources:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if s.get('access') == 'scrape' and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_md = '\n'.join([
    '# Lizenz noch klären (Szenario nuclear)', '',
    'Automatisch erzeugt von `scripts/consolidate_nuclear.py`. Kriterien wie in `docs/LICENSE-TODO.md`: Lizenz laut Recherche unklar '
    'oder ungeprüft, oder Nutzungsbedingungen schränken automatisierten Abruf ein. Signale, deren Hauptquelle nur per Scrape erreichbar '
    'ist und deren Lizenz unklar ist, haben Status `license-unclear`. Angaben von Behörden (Klasse C) zählen höchstens mit Gewicht 0,2.', '',
    '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + [''])

# ---------------------------------------------------------------- Ausgabe
for sg in signals:
    sg.pop('_main'); sg.pop('_all_src'); sg.pop('_slug')
for path, obj in [(OUT_SIGNALS, signals), (OUT_SOURCES, sources), (OUT_BUILD, build), (OUT_SCEN, scenario)]:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
for path, txt in [(OUT_KEYS, keys_md), (OUT_LIC, lic_md)]:
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(txt)

# ---------------------------------------------------------------- Selbstprüfung
errors = []
for path in (OUT_SIGNALS, OUT_SOURCES, OUT_BUILD, OUT_SCEN):
    json.load(open(path, encoding='utf-8'))
sigs = json.load(open(OUT_SIGNALS, encoding='utf-8'))
other_ids = set()
for f in glob.glob(os.path.join(CAT, 'signals', '*.json')):
    if os.path.abspath(f) != os.path.abspath(OUT_SIGNALS):
        other_ids |= {x['id'] for x in json.load(open(f, encoding='utf-8'))}
ids = [x['id'] for x in sigs]
if len(ids) != len(set(ids)):
    errors.append('doppelte IDs: %s' % [i for i, n in Counter(ids).items() if n > 1])
if other_ids & set(ids):
    errors.append('ID-Kollision mit anderen Szenarien: %s' % sorted(other_ids & set(ids)))
dc = Counter(x['domain'] for x in sigs)
for d in DOM_ORDER:
    if not dc[d]:
        errors.append('Domain leer: ' + d)
for d in DOMAINS:
    if dc[d] < 3:
        errors.append('Domain mit weniger als 3 Signalen: %s (%d)' % (d, dc[d]))
if len(DOMAINS) > 9:
    errors.append('mehr als 9 Domains')
FIELDS = ['id', 'scenarios', 'domain', 'name', 'plain', 'evidenceClass', 'direction', 'kind', 'weight', 'manipulability',
          'independenceGroup', 'collector', 'unit', 'baseline', 'intervalMinutes', 'status', 'sourceName', 'sourceUrl',
          'license', 'rationale', 'banalCauses', 'endpoint', 'auth', 'history', 'priority', 'verified', 'leadTime',
          'format', 'notes', 'extends']
for x in sigs:
    miss = [f for f in FIELDS if f not in x]
    if miss:
        errors.append('Felder fehlen %s: %s' % (x['id'], miss))
    if not x['id'].startswith(S + '.') or x['scenarios'] != [S]:
        errors.append('Präfix/Szenario: ' + x['id'])
    if x['domain'] not in DOM_ORDER or x['id'].split('.')[1] != x['domain']:
        errors.append('Domain/ID: ' + x['id'])
    if not x.get('sourceUrl') or not x.get('collector') or not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', x['collector']):
        errors.append('sourceUrl/collector: ' + x['id'])
    if not 0 <= x['weight'] <= 1:
        errors.append('weight außerhalb 0..1: ' + x['id'])
    if x['evidenceClass'] == 'C' and x['weight'] > C_CAP:
        errors.append('Klasse C über %.1f: %s' % (C_CAP, x['id']))
    if x['evidenceClass'] == 'D' and (x['domain'] != 'attention' or not 0.3 <= x['weight'] <= 0.7):
        errors.append('Klasse D: ' + x['id'])
    if x['domain'] == 'attention' and x['evidenceClass'] != 'D':
        errors.append('attention ohne Klasse D: ' + x['id'])
    if x['domain'] == 'context' and x['weight'] != 0:
        errors.append('context mit Gewicht: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary') or x['direction'] not in ('up', 'down', 'both'):
        errors.append('kind/direction: ' + x['id'])
    if x['status'] not in ('needs-key', 'license-unclear', 'planned'):
        errors.append('status: ' + x['id'])
for s in sources:
    for x in s['signals']:
        if x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))
if len({s['id'] for s in sources}) != len(sources):
    errors.append('doppelte Quellen-IDs')
bdc = Counter(b['domain'] for b in build)
for d in DOMAINS + ['attention']:
    if bdc[d] < BUILD_MIN_PER_DOMAIN:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
for b in build:
    if b['extends'] and b['extends'] not in EXTEND_WHAT:
        errors.append('extends ohne Angabe: ' + b['collector'])
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d + %d != %d' % (len(sigs), merged_in, len(raw)))
if set(scenario['domains']) != set(DOMAINS) or 'attention' in scenario['domains'] or 'context' in scenario['domains']:
    errors.append('Szenario-Domains: %s' % sorted(scenario['domains']))
if json.load(open(os.path.join(CAT, 'scenarios.json'), encoding='utf-8')) and \
        any(x['id'] == S for x in json.load(open(os.path.join(CAT, 'scenarios.json'), encoding='utf-8'))):
    errors.append('scenarios.json enthält schon nuclear (Hinweis, nicht geändert)')

dom_status = defaultdict(Counter)
for x in sigs:
    dom_status[x['domain']][x['status']] += 1
print('Recherche-Signale: %d, zusammengeführt: %d, Katalog: %d' % (len(raw), merged_in, len(sigs)))
print('Domains:', {d: dc[d] for d in DOM_ORDER})
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen: %d, Collectors: %d' % (len(sources), len(coll)))
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Top 10:', ', '.join('%d %s%s%s' % (b['rank'], b['collector'], ' live' if b['live'] else '', ' ext' if b['extends'] else '')
                          for b in build[:10]))
if '-v' in sys.argv:
    for x in sigs:
        print('%-62s %s %.2f %-5s %-15s %-6s %s' % (x['id'], x['evidenceClass'], x['weight'], x['direction'], x['status'], x['kind'], x['collector']))
    for b in build:
        print(b['rank'], b['collector'], b['domain'], 'live' if b['live'] else '', b['extends'] or '', b['why'][:110])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
