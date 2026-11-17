#!/usr/bin/env python3
"""Konsolidiert die Recherche zum Szenario Blackout und Energiekrise (catalog/research/blackout-all.json)
zu Signal-Katalog, Szenario-Eintrag, Bau-Reihenfolge, Quellen-Matrix und Schlüssel-/Lizenz-Tabellen.

Aufruf:  python3 -I scripts/consolidate_blackout.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_war.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Schreibt ausschließlich neue Dateien (keine bestehende Datei wird geändert):
  catalog/signals/blackout.json, catalog/research/blackout-scenario-def.json, catalog/blackout-build-order.json,
  catalog/research/blackout-sources.json, catalog/research/blackout-keys.md, catalog/research/blackout-license-todo.md
"""
import glob
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'catalog')
S = 'blackout'
IN_RESEARCH = os.path.join(CAT, 'research', 'blackout-all.json')
OUT_SIGNALS = os.path.join(CAT, 'signals', 'blackout.json')
OUT_SCEN = os.path.join(CAT, 'research', 'blackout-scenario-def.json')
OUT_BUILD = os.path.join(CAT, 'blackout-build-order.json')
OUT_SOURCES = os.path.join(CAT, 'research', 'blackout-sources.json')
OUT_KEYS = os.path.join(CAT, 'research', 'blackout-keys.md')
OUT_LIC = os.path.join(CAT, 'research', 'blackout-license-todo.md')

DOMAINS = ['grid', 'gas', 'prices', 'weather', 'plants', 'outages', 'markets']   # aus der scenario_def
BUILD_N = 20
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2   # Klasse C: höchstens 0,2

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-ID der Recherche -> kanonische ID (bevorzugt die ID aus catalog/sources.json)
ALIAS = {'yahoo': 'yahoo-chart', 'github-natural-gas': 'github-gas-henry-hub', 'polymarket': 'polymarket-gamma',
         'gie-agsi': 'agsi', 'gie-alsi': 'alsi', 'cloudflare-radar': 'cf-radar', 'stoerungsauskunft': 'stoerungsauskunft'}
# Source-ID -> Collector-Name, wo er anders heißt als die Quell-ID
COLLECTOR = {'cf-radar': 'cloudflare-radar'}

# Duplikate: Slug -> Slug des führenden Eintrags (gleiche Quelle/Messgröße, nur Variante)
MERGE = {
    'frequency_netzfrequenzmessung': 'frequency_de_deviation',   # Gegenprobe zur gleichen Größe
    'storage_fill_eu_countries': 'storage_fill_de',              # gleiche AGSI-Abfrage, andere Länder
    'europe_wide_cold_spread': 'cold_wave_temperature',          # gleiche Open-Meteo-Abfrage, mehr Orte
    'river_gauges_coal_corridors': 'rhine_gauge_kaub',           # gleiche Pegelonline-Abfrage, mehr Stationen
    'stoerungsauskunft': 'dso_fault_portals_de',                 # gleiche Messgröße (Störungsportale)
    'wikipedia_prepper_terms': 'wikipedia_pageviews_blackout',   # gleicher Collector, andere Artikelliste
}
# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {'storm_warnings_dwd': 'bright-sky', 'net_load_de': 'smard', 'day_ahead_de': 'energy-charts',
        'nuclear_generation_fr_measured': 'energy-charts', 'ics_advisories_energy': 'cisa-ics'}
# Quellen auf raw.githubusercontent.com, am 17.11.2026 per curl als aktuell geprüft
GITHUB_CURRENT = {
    'github-gas-henry-hub': 'datasets/natural-gas daily.csv: letzte Zeile 11.11.2026',
    'github-oil-prices': 'datasets/oil-prices brent-daily.csv: letzte Zeile 11.11.2026',
    'cisa-ics': 'cisagov/CSAF OT/white/changes.csv: letzter Eintrag 12.11.2026',
}
# Endpunkt-Überschreibung, wo der gebaute Collector eine GitHub-Datei statt der Original-API liest
ENDPOINT_OVERRIDE = {
    'ics_advisories_energy': ('https://raw.githubusercontent.com/cisagov/CSAF/develop/csaf_files/OT/white/changes.csv',
                              'https://github.com/cisagov/CSAF', 'csv', 'Public Domain (CISA)'),
}

# Domain: Recherche-Segment gilt, außer Klasse D (attention) und diese Einzelfälle
DOMAIN_OVERRIDE = {'ics_advisories_energy': 'grid', 'public_holidays_calendar': 'context'}
EVIDENCE_OVERRIDE = {}
DIRECTION_OVERRIDE = {'net_load_de': 'both', 'cold_wave_temperature': 'down', 'nuclear_generation_fr_measured': 'down'}
NAME = {}

WEIGHT = {
    # grid
    'frequency_de_deviation': 0.9, 'balancing_energy_activation': 0.8, 'system_security_measures': 0.8,
    'synchronous_time_deviation': 0.7, 'frequency_cross_check_gb_nordic': 0.7, 'residual_load_de': 0.6,
    'cross_border_flows_de': 0.6, 'generation_forecast_gap': 0.6, 'reserve_prices_fcr_afrr': 0.6,
    'redispatch_volume': 0.6, 'gb_system_margin': 0.6, 'poland_pse_load_reserve': 0.6, 'net_load_de': 0.5,
    'wind_solar_infeed_de': 0.5, 'gas_coal_fossil_ramp_de': 0.5, 'energy_charts_signal': 0.5, 'spain_ree_system': 0.5,
    'ics_advisories_energy': 0.2,
    # gas
    'storage_fill_de': 0.8, 'storage_withdrawal_rate': 0.8, 'pipeline_flows_entry': 0.8, 'norway_outages_gassco': 0.8,
    'lng_terminal_sendout': 0.7, 'entsog_interruptions': 0.7, 'storage_by_site_critical': 0.6, 'lng_inventory_eu': 0.6,
    'interconnector_reverse_flows': 0.6, 'the_balancing_prices': 0.6, 'consumption_industry_bnetza': 0.5,
    'norwegian_flow_nominations': 0.5, 'bnetza_early_warning_level': 0.2,
    # prices
    'imbalance_price_rebap': 0.7, 'day_ahead_de': 0.6, 'day_ahead_spread_neighbors': 0.5, 'intraday_price_index': 0.5,
    'gas_hub_ttf_spread': 0.5, 'negative_price_hours': 0.4, 'carbon_eua': 0.3,
    # weather
    'dunkelflaute_wind_pv_forecast': 0.8, 'cold_wave_temperature': 0.7, 'ensemble_cold_risk': 0.6,
    'storm_wind_gusts_forecast': 0.6, 'dwd_measured_conditions': 0.6, 'icing_snow_load': 0.6,
    'seasonal_outlook': 0.4, 'geomagnetic_storm': 0.4, 'heat_drought_summer': 0.3, 'storm_warnings_dwd': 0.2,
    # plants
    'entsoe_unavailability_gen': 0.8, 'france_nuclear_availability': 0.7, 'nuclear_generation_fr_measured': 0.7,
    'rhine_gauge_kaub': 0.6, 'river_temperature_cooling': 0.5, 'hydro_reservoir_nordic_alps': 0.5,
    'nuclear_status_pris': 0.5, 'pumped_storage_hydro_de': 0.4, 'installed_capacity_changes': 0.4,
    # outages
    'dso_fault_portals_de': 0.7, 'ioda_country_internet': 0.6, 'cloudflare_radar_outages': 0.6, 'ukpn_enedis_open_data': 0.6,
    'ukraine_grid_restrictions': 0.5, 'rtt_internet_probe_dach': 0.5, 'us_outage_counts_eaglei': 0.4,
    'mowas_power_warnings': 0.2,
    # markets
    'ttf_front_month': 0.4, 'energy_equities': 0.3, 'henry_hub_gas': 0.3, 'brent_oil': 0.3,
    # attention (Klasse D: 0,3 bis 0,7)
    'wikipedia_pageviews_blackout': 0.5, 'gdelt_blackout_news': 0.5, 'polymarket_energy_bets': 0.4,
}
ROLLING_DOMAINS = {'prices', 'markets', 'gas', 'weather', 'context'}

PLAIN = {}   # Laien-Texte: die Recherche liefert plain_de bereits auf Deutsch; hier nur Korrekturen

KIND_RULES = [
    (r'negative_price_hours|redispatch_volume|entsog_interruptions|system_security|dwd_measured|storm_warnings|'
     r'mowas|outage_counts|us_outage|cloudflare_radar_outages|ics_advisories|wikipedia|gdelt|norway_outages|'
     r'installed_capacity_changes', 'count'),
    (r'public_holidays|bnetza_early_warning', 'binary'),
    (r'.', 'gauge'),
]
UNIT_RULES = [
    (r'frequency_de|frequency_cross', 'Hz'), (r'synchronous_time', 'Sekunden'),
    (r'storage_fill|lng_inventory|hydro_reservoir', '%'), (r'storage_by_site', '%'),
    (r'withdrawal_rate|lng_terminal|pipeline_flows|interconnector|nominations|consumption_industry', 'GWh/Tag'),
    (r'day_ahead|intraday|imbalance|spread|the_balancing|reserve_prices', 'EUR/MWh'),
    (r'ttf_front', 'EUR/MWh'), (r'henry_hub', 'USD/MMBtu'), (r'brent', 'USD/Barrel'), (r'carbon_eua', 'EUR/t CO2'),
    (r'energy_equities', 'Kurs'),
    (r'net_load|residual_load|wind_solar|gas_coal|cross_border|generation_forecast|balancing_energy|gb_system|poland_pse|'
     r'spain_ree|pumped_storage|nuclear_generation|france_nuclear|entsoe_unavail|installed_capacity|nuclear_status', 'MW'),
    (r'temperature|cold|river_temp|seasonal|dwd_measured|icing', '°C'), (r'wind_gusts', 'km/h'),
    (r'dunkelflaute', 'W/m²'), (r'rhine_gauge', 'cm'), (r'geomagnetic', 'Kp'),
    (r'ioda|rtt_internet', 'Messwert'), (r'wikipedia|gdelt', 'Anzahl'), (r'polymarket', '%'),
    (r'energy_charts_signal', '%'),
]

# ---------------------------------------------------------------- Helfer (aus consolidate_war.py)


def canon(sid):
    return ALIAS.get(sid, sid)


def is_free(src):
    cost = (src.get('cost') or '').lower()
    return src.get('auth') == 'none' and (cost.startswith('free') or cost in ('', 'kostenlos'))


def is_stream(src):
    ep = (src.get('endpoint') or '').lower()
    return ep.startswith('wss://') or 'stream' in ep


def access_score(src):
    cost = (src.get('cost') or '').lower()
    if src.get('auth') == 'paid' or not (cost.startswith('free') or cost == ''):
        return 3
    if src.get('access') == 'scrape':
        return 2
    if src.get('auth') != 'none':
        return 1
    s = 0.0
    if src.get('format') in ('xml', 'html'):
        s += 0.5
    return s


def lic_unclear(lic):
    return bool(re.search(r'unklar|pr(ü|ue)f|\?', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|\bnc\b|propriet|NC 4', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|selbst|gering|unbekannt|unklar|nur z(ä|ae)hler|eingeschr|'
                      r'begrenzt|feed-fenster|letzte|webseite|kurz|nur feed|statisch', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [
        (r'j(ä|ae)hrlich', 525600), (r'halbj', 262800), (r'quartal', 129600), (r'monatlich', 43200),
        (r'w(ö|oe)chentlich|^wochen', 10080),
        (r'(ä|ae)glich|tagesende|^tage|gesch(ä|ae)ftstag|~1 tag|^1 tag', 1440),
        (r'3 h', 180), (r'~2 h|2h', 120),
        (r'st(ü|ue)ndlich|^stunden|1 ?h', 60),
        (r'ereignis|unregelm|unbekannt|laufend|bei (ä|ae)nderung', 60),
        (r'sekunden|echtzeit|\b1 s\b', 5), (r'15 min|10 min|5-15|5-10|3 minuten|minuten', 15),
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
    return 'gauge'


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


def slug_of(s):
    return s['id'].split('.')[-1]


def seg_of(s):
    return s['id'].split('.')[1]


def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


# ---------------------------------------------------------------- Einlesen
research = json.load(open(IN_RESEARCH, encoding='utf-8'))
raw = research['signals']
BUILT = built_collectors()

variants = defaultdict(list)
for s in raw:
    keep, seen = [], set()
    for src in s['sources']:
        src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
        key = (src['source_id'], src.get('endpoint'))
        if key in seen:
            continue
        seen.add(key)
        if src['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (src.get('endpoint') or ''):
            src['verified'] = True
        variants[src['source_id']].append(src)
        keep.append(src)
    s['_srcs'] = keep

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
    if s.get('notes'):
        t['notes'] = ((t.get('notes') or '') + ' ' + s['notes']).strip()
    have = {(x['source_id'], x.get('endpoint')) for x in t['_sources']}
    t['_sources'] += [x for x in s['_srcs'] if (x['source_id'], x.get('endpoint')) not in have]


# ---------------------------------------------------------------- Signale bauen
def make_signal(sl, s, dom, srcs, main, ev, direction):
    alt = []
    for src in srcs:
        if src['source_id'] != main['source_id'] and src['source_id'] not in alt:
            alt.append(src['source_id'])
    if dom == 'context':
        w = 0.0
    else:
        w = WEIGHT[sl]
        if ev == 'C':
            w = min(w, C_CAP)
        if ev == 'D':
            w = max(0.3, min(0.7, w))
    lic = main.get('license') or 'unklar'
    endpoint, fmt, doc = main.get('endpoint'), main.get('format'), main.get('doc_url')
    verified = bool(main.get('verified'))
    if sl in ENDPOINT_OVERRIDE:
        endpoint, doc, fmt, lic = ENDPOINT_OVERRIDE[sl]
        verified = True
    if not is_free(main):
        status = 'needs-key'
    elif lic_unclear(lic) and main.get('access') == 'scrape':
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = interval_from(main.get('update_latency'))
    kind = kind_for(sl)
    sid = main['source_id']
    notes = []
    if s.get('notes'):
        notes.append(s['notes'])
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if sid in GITHUB_CURRENT:
        notes.append('GitHub-Spiegel aktuell (geprüft 17.11.2026): ' + GITHUB_CURRENT[sid] + '.')
    if ev == 'C':
        notes.append('Klasse C: Aussage von Behörde oder Hersteller, Gewicht höchstens %.1f.' % C_CAP)
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + main['sample_note'])
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    sig = OrderedDict([
        ('id', '%s.%s.%s' % (S, dom, sl)), ('scenarios', [S]), ('domain', dom),
        ('name', NAME.get(sl, s['name_de'])), ('plain', PLAIN.get(sl, s['plain_de'])), ('evidenceClass', ev),
        ('direction', direction), ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', sid), ('collector', COLLECTOR.get(sid, sid)), ('unit', unit_for(sl, kind)),
        ('baseline', baseline_for(iv, dom)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', main.get('name')), ('sourceUrl', doc), ('license', lic),
        ('rationale', s.get('rationale')), ('banalCauses', list(s['banal_causes'])),
        ('endpoint', endpoint), ('auth', main.get('auth')), ('history', main.get('history')),
        ('priority', s['priority']), ('verified', verified), ('leadTime', lead),
        ('format', fmt), ('notes', ' '.join(notes)),
    ])
    if s.get('extends'):
        sig['extends'] = COLLECTOR.get(canon(s['extends']), canon(s['extends']))
    else:
        sig['extends'] = None
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    return sig


signals = []
for sl, s in by_slug.items():
    ev = EVIDENCE_OVERRIDE.get(sl, s['evidence_class'])
    if sl in DOMAIN_OVERRIDE:
        dom = DOMAIN_OVERRIDE[sl]
    elif ev == 'D':
        dom = 'attention'
    else:
        dom = seg_of(s)
    srcs = s['_sources']
    if sl in MAIN:
        main = next(x for x in srcs if x['source_id'] == MAIN[sl])
    else:
        main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    if direction not in ('up', 'down', 'both'):
        direction = 'both'
    signals.append(make_signal(sl, s, dom, srcs, main, ev, direction))

DOM_ORDER = DOMAINS + ['attention', 'context']
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
# Konkrete Ergänzungen bestehender Collectors (Urteil)
EXT_WHAT = {
    'energy-charts': 'Endpunkte ergänzen: /price (Day-Ahead DE und Nachbarländer), /public_power (Grenzflüsse, Gas/Kohle, '
                     'Pumpspeicher, Kernkraft FR mit country=fr), /signal (Versorgungsampel); Frequenz und Wind+Solar liefert er schon.',
    'smard': 'Filter ergänzen: Residuallast, Prognose gegen Ist, Pumpspeicher; Netzlast liefert er schon.',
    'github-gas-henry-hub': 'Nur Signal-Deklaration ergänzen (blackout.markets.henry_hub_gas, scenarios blackout); Abruf unverändert.',
    'github-oil-prices': 'Nur Signal-Deklaration ergänzen (blackout.markets.brent_oil, scenarios blackout); Abruf unverändert.',
    'noaa-swpc': 'Nur Signal-Deklaration ergänzen (blackout.weather.geomagnetic_storm, Kp aus bestehendem Abruf).',
    'cisa-ics': 'Filter ergänzen: Advisories von Energie-Herstellern (Siemens Energy, Schneider, ABB, GE Vernova, Hitachi Energy) aus changes.csv und den JSON-Advisories.',
    'yahoo-chart': 'Symbole ergänzen: TTF=F (Gas-Frontmonat), RWE.DE, EOAN.DE, ENR.DE, VER.VI, EUA-Proxy KRBN.',
    'ioda': 'Länder ergänzen: DE, FR, PL, NL, ES, UA (Länder-Signale im Routing und Ping).',
    'cloudflare-radar': 'Ausfallmeldungen (outages) nach Ursache Stromausfall filtern, Länder DE, FR, PL, ES, UA; braucht Key.',
    'ripe-atlas': 'Länder ergänzen: FR, PL, NL, AT, CH neben DE (Probe-Zahl status=1).',
    'polymarket-gamma': 'Suchbegriffe ergänzen: blackout, power outage, energy crisis, gas shortage.',
    'wikimedia-pageviews': 'Artikel ergänzen: Stromausfall, Blackout, Gasmangellage, Notstromaggregat, Kurbelradio, Katwarn.',
    'gdelt-doc': 'Abfrage ergänzen: (Stromausfall OR Blackout OR Gasmangellage) sourcecountry:Germany (Zeitreihe timelinevol).',
}


def gh_current(m):
    return m['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (m.get('endpoint') or '') \
        and bool(m.get('verified'))


coll = OrderedDict()
for sg in signals:
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'domains': Counter(), 'maxw': 0.0, 'keyfree': False})
    c['signals'].append(sg['id'])
    m = dict(sg['_main'])
    if sg['id'].split('.')[-1] in ENDPOINT_OVERRIDE:
        m.update(endpoint=ENDPOINT_OVERRIDE[sg['id'].split('.')[-1]][0], verified=True,
                 format='csv', access='download')
    c['mains'].append(m)
    if sg['domain'] in DOMAINS:
        c['domains'][sg['domain']] += sg['weight']
    c['maxw'] = max(c['maxw'], sg['weight'])
    if sg['status'] == 'planned':
        c['keyfree'] = True
    if sg['status'] == 'needs-key':
        c['needkey'] = c.get('needkey', 0) + 1

rows = []
for cid, c in coll.items():
    if not c['domains']:
        continue   # nur Kontext/Attention ohne Szenario-Domain
    mains = c['mains']
    gh = any(gh_current(m) for m in mains)
    ext = cid if cid in BUILT else None
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download') and not is_stream(m)
                and is_free(m) for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0]
    forbid = any(re.search(r'verbiet|kein scrap', m.get('license') or '', re.I) for m in mains)
    rows.append({'collector': cid, 'domain': dom, 'gh': gh, 'extends': ext, 'keyfree': c['keyfree'], 'small': small,
                 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not gh, ext is None, not c['keyfree'], forbid, not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

chosen = []
for r in rows:
    r['cover'] = set(r['c']['domains'])
# Pflichtplätze: je Domain die besten Collectors, die in dieser Domain Signale haben (Collectors zählen für alle ihre Domains)
must = set()
for d in DOMAINS:
    n = 0
    for r in rows:
        if d in r['cover'] and n < BUILD_MIN_PER_DOMAIN:
            n += 1
            must.add(r['collector'])
for r in rows:
    if r['collector'] in must and r not in chosen:
        chosen.append(r)
for r in rows:
    if len(chosen) >= BUILD_N:
        break
    if r not in chosen:
        chosen.append(r)
if len(chosen) > BUILD_N:   # Mindestquote kann überschießen: schwächste Nicht-Pflichtplätze entfernen
    for r in sorted(chosen, key=lambda r: r['key'], reverse=True):
        if len(chosen) <= BUILD_N:
            break
        if r['collector'] not in must:
            chosen.remove(r)
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
    notes = [m.get('sample_note') for m in c['mains'] if m.get('sample_note')]
    if notes:
        unc.append('Messfeld laut Recherche: ' + notes[0])
    lic = s0.get('license') or 'unklar'
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    rl = s0.get('rateLimit')
    if rl and rl not in ('unklar', 'unbekannt'):
        unc.append('Rate-Limit: ' + rl)
    if not r['keyfree']:
        unc.append('braucht Key/Konto')
    why = []
    if r['gh']:
        why.append('raw.githubusercontent.com, aktuell verifiziert (' + GITHUB_CURRENT[srcs_ids[0]] + ')')
    if r['extends']:
        why.append('erweitert bestehenden Collector ' + r['extends'])
    why.append(('ohne Key, kostenlos' + (' (%d Signal(e) der Quelle brauchen Key)' % c['needkey'] if c.get('needkey') else '')) if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % (s0.get('format') or '').upper() if r['small'] else 'Format/Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    ext_what = EXT_WHAT.get(r['extends']) if r['extends'] else None
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('domains', sorted(r['cover'])), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver),
        ('live', r['gh']), ('extends', ext_what and r['extends']), ('extendsWhat', ext_what),
        ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Szenario-Eintrag (geprüft)
sd = research['scenario_def']
scenario = OrderedDict([
    ('id', S), ('order', 3), ('title', sd['title']),
    ('question', sd['question']),
    ('tagline', sd['tagline']),
    ('domains', OrderedDict((d, OrderedDict([('title', v['title']), ('weight', v['weight']), ('plain', v['plain'])]))
                            for d, v in sd['domains'].items())),
])

# ---------------------------------------------------------------- Schlüssel- und Lizenz-Tabellen
main_cnt = Counter(sg['independenceGroup'] for sg in signals if sg['status'] == 'needs-key')
key_rows = []
for s in sources:
    sid = s['id']
    if not (any(not is_free(v) for v in variants[sid]) or main_cnt[sid]):
        continue
    sgs = [sg for sg in signals if sg['independenceGroup'] == sid]
    names = [sg['name'] for sg in sgs] or ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in s['signals'][:3])]
    alt = len(s['signals']) - len(sgs)
    cnt = '%d' % main_cnt[sid] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in variants[sid] if not is_free(v)), variants[sid][0])
    env = 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', sid.upper())
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], env, cnt))
keys_md = ['# Benötigte Keys, Konten und Bezahlzugänge (Szenario blackout)', '',
           'Automatisch erzeugt von `scripts/consolidate_blackout.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; '
           'Dienste, die dort schon stehen (z. B. ENTSO-E, AGSI+), nutzen dieselbe Umgebungsvariable. '
           'Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.', '',
           '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |',
           '|---|---|---|---|---|---|'] + key_rows + ['']

lic_rows = []
for s in sources:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if s.get('access') == 'scrape' and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_md = ['# Lizenz noch klären (Szenario blackout)', '',
          'Automatisch erzeugt von `scripts/consolidate_blackout.py`. Kriterien wie in `docs/LICENSE-TODO.md`: Lizenz laut '
          'Recherche unklar oder ungeprüft, oder Nutzungsbedingungen schränken automatisierten/kommerziellen Abruf ein. '
          'Signale, deren Hauptquelle nur per Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`.', '',
          '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + ['']

# ---------------------------------------------------------------- Ausgabe
for sg in signals:
    sg.pop('_main')
    sg.pop('_all_src')
for path, obj in [(OUT_SIGNALS, signals), (OUT_SCEN, scenario), (OUT_BUILD, build), (OUT_SOURCES, sources)]:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
for path, lines in [(OUT_KEYS, keys_md), (OUT_LIC, lic_md)]:
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))

# ---------------------------------------------------------------- Selbstprüfung
errors = []
for path in (OUT_SIGNALS, OUT_SCEN, OUT_BUILD, OUT_SOURCES):
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
if len(scenario['domains']) > 9 or set(scenario['domains']) != set(DOMAINS):
    errors.append('Szenario-Domains: %s' % sorted(scenario['domains']))
for d in DOMAINS:
    if dc[d] < 3:
        errors.append('Domain mit weniger als 3 Signalen: %s (%d)' % (d, dc[d]))
for x in sigs:
    if not x['id'].startswith(S + '.') or x['scenarios'] != [S]:
        errors.append('Präfix/Szenario: ' + x['id'])
    if x['domain'] not in DOM_ORDER:
        errors.append('unbekannte Domain: ' + x['id'])
    if not x.get('sourceUrl') or not x.get('collector'):
        errors.append('sourceUrl/collector fehlt: ' + x['id'])
    if not 0 <= x['weight'] <= 1:
        errors.append('weight außerhalb 0..1: ' + x['id'])
    if x['evidenceClass'] == 'C' and x['weight'] > C_CAP:
        errors.append('Klasse C über %.1f: %s' % (C_CAP, x['id']))
    if x['evidenceClass'] == 'D' and (x['domain'] != 'attention' or not 0.3 <= x['weight'] <= 0.7):
        errors.append('Klasse D: Domain/Gewicht: ' + x['id'])
    if x['domain'] == 'context' and x['weight'] != 0:
        errors.append('context mit Gewicht: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary') or x['direction'] not in ('up', 'down', 'both'):
        errors.append('kind/direction: ' + x['id'])
    if x['status'] not in ('active', 'needs-key', 'planned', 'license-unclear'):
        errors.append('status: ' + x['id'])
    if not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', x['collector']):
        errors.append('collector nicht kebab-case: ' + x['id'])
for s in sources:
    for x in s['signals']:
        if x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
bdc = Counter(d for b in build for d in b['domains'])
for d in DOMAINS:
    if bdc[d] < BUILD_MIN_PER_DOMAIN:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d + %d != %d' % (len(sigs), merged_in, len(raw)))

print('Recherche-Signale: %d, zusammengeführt: %d, Katalog: %d' % (len(raw), merged_in, len(sigs)))
print('Domains:', dict(sorted(dc.items())))
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen: %d, Collectors: %d (davon gebaut: %d)' % (len(sources), len(coll), len([c for c in coll if c in BUILT])))
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Bau-Top:', ', '.join('%s(%s%s%s)' % (b['collector'], b['domain'], ',live' if b['live'] else '',
                                          ',ext' if b['extends'] else '') for b in build))
if '-v' in sys.argv:
    for b in build:
        print(b['rank'], b['collector'], b['domain'], 'live' if b['live'] else '', b['extends'] or '', b['why'][:110])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
