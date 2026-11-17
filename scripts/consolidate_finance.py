#!/usr/bin/env python3
"""Konsolidiert die Recherche zum Szenario finance (Finanzkrise und Bankenstress) zu Signal-Katalog,
Szenario-Eintrag, Bau-Reihenfolge, Quellen-Matrix sowie Schlüssel- und Lizenz-Tabelle.

Aufruf:  python3 -I scripts/consolidate_finance.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_war.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Schreibt ausschließlich neue Dateien (siehe OUT_*); bestehende Kataloge und Doku-Dateien bleiben unberührt.
"""
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'catalog')
S = 'finance'
IN_RESEARCH = os.path.join(CAT, 'research', 'finance-all.json')
OUT_SIGNALS = os.path.join(CAT, 'signals', 'finance.json')
OUT_SCEN = os.path.join(CAT, 'research', 'finance-scenario-def.json')
OUT_BUILD = os.path.join(CAT, 'finance-build-order.json')
OUT_SOURCES = os.path.join(CAT, 'research', 'finance-sources.json')
OUT_KEYS = os.path.join(CAT, 'research', 'finance-keys.md')
OUT_LIC = os.path.join(CAT, 'research', 'finance-license-todo.md')
OTHER_SIGNALS = [os.path.join(CAT, 'signals', f) for f in sorted(os.listdir(os.path.join(CAT, 'signals')))
                 if f.endswith('.json') and f != 'finance.json']

BUILD_N = 20
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs, die dieselbe Quelle meinen -> kanonische ID
ALIAS = {'fdic-csv': 'fdic-bankfind', 'defillama-cex': 'defillama'}

# Duplikate: Slug -> führender Slug
MERGE = {
    'ecb_fx_refs': 'fx_vol',                  # EZB-Referenzkurse für Franken/Yen sind dieselbe Devisen-Beobachtung
    'sovereign_cds_proxy': 'btp_bund_spread',  # weitere Euro-Renditeabstände zu Deutschland
}

# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {
    'vix': 'yahoo-chart', 'sp500_drawdown': 'yahoo-chart', 'us_10y_yield': 'fred-csv', 'fx_vol': 'ecb-data',
    'copper_gold': 'yahoo-chart', 'us_tbill_stress': 'fred-csv', 'btp_bund_spread': 'ecb-data',
    'fear_greed_crypto': 'alternative-me', 'oil_price': 'github-oil-prices', 'h8_deposits': 'fed-ddp',
    'fed_discount_window': 'fed-ddp', 'us_curve_10y2y': 'fred-csv', 'hy_oas': 'fred-csv',
    'polymarket_recession': 'polymarket-gamma', 'fdic_failed_list': 'fdic-bankfind',
    'skew': 'yahoo-chart', 'stablecoin_depeg': 'defillama', 'jobless_claims': 'fred',
}

# Auf raw.githubusercontent.com liegende Quellen, am 17.11.2026 per curl als aktuell geprüft
GITHUB_CURRENT = {
    'github-oil-prices': 'brent-daily.csv: letzte Zeile 11.11.2026',
    'github-exchange-rates': 'daily.csv: letzter Eintrag 06.11.2026 (Datei 7,6 MB)',
    'github-gold-prices': 'monthly.csv: letzter Eintrag 2026-10 (Monatswerte)',
}
# auf GitHub, aber veraltet / unbrauchbar (Hinweis in notes und uncertainty)
GITHUB_STALE = {
    'github-finance-vix': 'GitHub-Spiegel endet am 22.09.2026 (geprüft 17.11.2026); für aktuelle Werte Yahoo nutzen.',
    'github-s-and-p-500': 'Monatswerte, letzter Eintrag 2026-09, Oktober fehlt (geprüft 17.11.2026); kein Tagessignal.',
    'github-bond-yields-us-10y': 'Monatswerte, letzter Eintrag 2026-09 (geprüft 17.11.2026); für Tageswerte FRED nutzen.',
    'github-cpi-us': 'Monatswerte, letzter Eintrag 2026-09 (geprüft 17.11.2026); Oktober-Wert noch nicht gespiegelt.',
    'github-investor-flow': 'weekly.csv enthält nur die Kopfzeile, keine Daten (geprüft 17.11.2026); nicht nutzbar.',
    'github-fng': 'Verweist auf eine github.com-Repo-Seite statt auf eine raw-Datei; Dateipfad und Aktualität ungeprüft.',
}
BROKEN = {'github-investor-flow'}   # Endpunkt liefert nichts -> verified false, nicht in die Bau-Reihenfolge
SOURCE_VERIFIED_FALSE = {'github-investor-flow'}

# Ausnahmen bei Domain und Evidenzklasse
DOMAIN_OVERRIDE = {}
EVIDENCE_OVERRIDE = {}
DIRECTION_OVERRIDE = {'oil_price': 'both', 'us_10y_yield': 'both', 'us_cpi': 'both', 'us_tga_balance': 'both',
                      'gold': 'up', 'safe_haven_fx': 'up', 'fx_vol': 'up', 'btp_bund_spread': 'up',
                      'fed_reverse_repo': 'both', 'fund_flows': 'down'}

WEIGHT = {
    # money_market: sehr spezifisch, schwer zu fälschen
    'fed_standing_repo': 0.9, 'fed_discount_window': 0.9, 'sofr_tail': 0.85, 'sofr_minus_iorb': 0.85,
    'fed_btfp_other_credit': 0.85, 'ecb_marginal_lending': 0.85, 'fx_swap_lines': 0.85, 'estr_spread': 0.8,
    'cross_currency_basis': 0.8, 'us_tbill_stress': 0.6, 'ecb_excess_liquidity': 0.4, 'fed_reverse_repo': 0.4,
    'us_tga_balance': 0.3,
    # credit
    'eur_ig_financial_oas': 0.75, 'hy_oas': 0.6, 'ig_oas': 0.6, 'eur_hy_oas': 0.6, 'btp_bund_spread': 0.6,
    'ccc_oas': 0.55, 'corp_bond_etf_discount': 0.55, 'ecb_yield_curve_spread': 0.4, 'us_curve_10y3m': 0.4,
    'sloos_tightening': 0.4, 'ecb_bank_cds_proxy': 0.4, 'us_curve_10y2y': 0.35, 'bis_credit_gap': 0.3,
    # banks
    'fdic_failed_list': 0.9, 'h8_deposits': 0.85, 'regional_bank_etf_return': 0.8, 'single_bank_stress_set': 0.75,
    'regional_bank_volume': 0.7, 'eu_bank_index': 0.7, 'h8_borrowings': 0.7, 'sec_8k_item103': 0.6,
    'fdic_problem_banks': 0.6, 'fhlb_advances': 0.6, 'target2_imbalances': 0.55, 'unrealized_losses': 0.5,
    'sec_8k_item202_bank': 0.5, 'bank_deposit_rates': 0.5, 'foreign_bank_failure_context': 0.15,
    # volatility
    'move': 0.6, 'vix_term_structure': 0.45, 'fx_vol': 0.35, 'vix': 0.3, 'skew': 0.3,
    # crypto
    'stablecoin_depeg': 0.6, 'stablecoin_supply': 0.4, 'exchange_outflows': 0.4, 'defi_tvl': 0.35,
    'btc_fees': 0.3, 'btc_price_drop': 0.3,
    # real_economy
    'cre_delinq': 0.5, 'jobless_claims': 0.4, 'consumer_credit_delinq': 0.4, 'bankruptcies_us': 0.35,
    'destatis_insolvenzen': 0.35, 'freight_rates': 0.3, 'copper_gold': 0.3, 'baltic_dry': 0.25,
    'oil_price': 0.2, 'us_cpi': 0.2, 'fund_flows': 0.2,
    # markets
    'sp500_drawdown': 0.35, 'gold': 0.3, 'safe_haven_fx': 0.3, 'ai_stock_stress': 0.3, 'us_10y_yield': 0.3,
    # attention (Klasse D: 0,3 bis 0,7)
    'polymarket_bank_failure': 0.6, 'news_bank_run_volume': 0.5, 'polymarket_recession': 0.5,
    'bank_wiki_views': 0.45, 'bank_service_outages': 0.4, 'fear_greed_crypto': 0.3,
}

NAME = {
    'jobless_claims': 'US-Erstanträge auf Arbeitslosenhilfe (wöchentlich)',
    'sloos_tightening': 'Kreditvergabe-Umfrage: Anteil Banken mit strengeren Standards',
    'fx_vol': 'Devisen: Schwankung und Fluchtwährungen (EUR/USD, USD/JPY, CHF)',
    'btp_bund_spread': 'Renditeabstände Euro-Staaten zu Deutschland (Italien, Frankreich, Spanien, Griechenland)',
    'ecb_bank_cds_proxy': 'EZB: Zinssätze der Banken im Neugeschäft',
    'foreign_bank_failure_context': 'Banken-Ausfälle im Ausland (Nachrichtenzählung, Kontext)',
}
PLAIN = {
    'fx_vol': 'Misst, wie stark Euro, Dollar, Yen und Franken schwanken; Fluchtwährungen springen bei Stress.',
    'btp_bund_spread': 'Misst, wie viel mehr Italien, Frankreich, Spanien oder Griechenland gegenüber Deutschland für Staatsanleihen zahlen.',
    'ecb_bank_cds_proxy': 'Misst, welche Zinsen Banken im Euroraum für neue Kredite berechnen; steigende Sätze zeigen steigende Refinanzierungskosten.',
    'foreign_bank_failure_context': 'Zählt Nachrichten über Bankzusammenbrüche im Ausland; sie zeigen Ansteckungsgefahr, belegen sie aber nicht.',
}

# Messart und Einheit je Signal: (kind, unit)
META = {
    'sofr_tail': ('gauge', 'Basispunkte'), 'sofr_minus_iorb': ('gauge', 'Basispunkte'),
    'estr_spread': ('gauge', 'Basispunkte'), 'fed_standing_repo': ('gauge', 'Mrd. USD'),
    'fed_discount_window': ('gauge', 'Mio. USD'), 'fed_btfp_other_credit': ('gauge', 'Mio. USD'),
    'ecb_marginal_lending': ('gauge', 'Mio. EUR'), 'ecb_excess_liquidity': ('gauge', 'Mrd. EUR'),
    'fed_reverse_repo': ('gauge', 'Mrd. USD'), 'fx_swap_lines': ('gauge', 'Mio. USD'),
    'cross_currency_basis': ('gauge', 'Basispunkte'), 'us_tbill_stress': ('gauge', 'Basispunkte'),
    'us_tga_balance': ('gauge', 'Mio. USD'),
    'hy_oas': ('gauge', 'Prozentpunkte'), 'ig_oas': ('gauge', 'Prozentpunkte'), 'ccc_oas': ('gauge', 'Prozentpunkte'),
    'eur_hy_oas': ('gauge', 'Prozentpunkte'), 'eur_ig_financial_oas': ('gauge', 'Prozentpunkte'),
    'btp_bund_spread': ('gauge', 'Basispunkte'), 'ecb_yield_curve_spread': ('gauge', 'Prozentpunkte'),
    'us_curve_10y2y': ('gauge', 'Prozentpunkte'), 'us_curve_10y3m': ('gauge', 'Prozentpunkte'),
    'sloos_tightening': ('gauge', '% der Banken'), 'corp_bond_etf_discount': ('gauge', '% Abweichung'),
    'bis_credit_gap': ('gauge', 'Prozentpunkte'), 'ecb_bank_cds_proxy': ('gauge', '%'),
    'regional_bank_etf_return': ('gauge', '% (Tagesrendite)'), 'regional_bank_volume': ('gauge', 'x Median 20 Tage'),
    'eu_bank_index': ('gauge', '% (Tagesrendite)'), 'single_bank_stress_set': ('gauge', '% (Tagesrendite)'),
    'fdic_failed_list': ('count', 'Anzahl'), 'fdic_problem_banks': ('gauge', 'Anzahl Banken'),
    'unrealized_losses': ('gauge', 'Mrd. USD'), 'h8_deposits': ('gauge', 'Mrd. USD'),
    'h8_borrowings': ('gauge', 'Mrd. USD'), 'fhlb_advances': ('gauge', 'Mrd. USD'),
    'sec_8k_item103': ('count', 'Anzahl Meldungen'), 'sec_8k_item202_bank': ('count', 'Anzahl Meldungen'),
    'bank_deposit_rates': ('gauge', '%'), 'target2_imbalances': ('gauge', 'Mrd. EUR'),
    'foreign_bank_failure_context': ('count', 'Anzahl Artikel'),
    'bank_service_outages': ('count', 'Anzahl Störungen'), 'bank_wiki_views': ('count', 'Aufrufe'),
    'news_bank_run_volume': ('count', 'Anteil Artikel'),
    'vix': ('gauge', 'Indexpunkte'), 'vix_term_structure': ('gauge', 'Verhältnis'), 'move': ('gauge', 'Indexpunkte'),
    'skew': ('gauge', 'Indexpunkte'), 'fx_vol': ('gauge', '% (Tagesrendite)'), 'fear_greed_crypto': ('gauge', 'Indexpunkte'),
    'stablecoin_depeg': ('gauge', 'Abweichung vom Dollar'), 'stablecoin_supply': ('gauge', 'Mrd. USD'),
    'defi_tvl': ('gauge', 'Mrd. USD'), 'btc_fees': ('gauge', 'sat/vB'), 'exchange_outflows': ('gauge', 'Mrd. USD'),
    'btc_price_drop': ('gauge', '% (Tagesrendite)'),
    'jobless_claims': ('gauge', 'Anträge'), 'bankruptcies_us': ('count', 'Anzahl Fälle'),
    'destatis_insolvenzen': ('count', 'Anzahl Verfahren'), 'freight_rates': ('gauge', 'USD je 40-Fuß-Container'),
    'baltic_dry': ('gauge', 'Indexpunkte'), 'copper_gold': ('gauge', 'Verhältnis'), 'oil_price': ('gauge', 'USD je Barrel'),
    'us_cpi': ('gauge', 'Indexpunkte'), 'consumer_credit_delinq': ('gauge', '%'), 'cre_delinq': ('gauge', '%'),
    'fund_flows': ('gauge', 'Mio. USD'),
    'polymarket_recession': ('gauge', '%'), 'polymarket_bank_failure': ('gauge', '%'),
    'gold': ('gauge', 'USD je Unze'), 'safe_haven_fx': ('gauge', 'Kurs'), 'sp500_drawdown': ('gauge', '% unter Hoch'),
    'ai_stock_stress': ('gauge', '% (Tagesrendite)'), 'us_10y_yield': ('gauge', '%'),
    'quarter_end': ('binary', '0/1'),
}
# Messintervall (Minuten) wo die Latenzangabe nicht reicht
INTERVAL = {
    'us_cpi': 43200, 'btp_bund_spread': 1440, 'consumer_credit_delinq': 129600, 'cre_delinq': 129600,
    'bis_credit_gap': 129600, 'sloos_tightening': 129600, 'unrealized_losses': 129600, 'fhlb_advances': 129600,
    'bankruptcies_us': 129600, 'bank_deposit_rates': 43200, 'ecb_bank_cds_proxy': 43200, 'target2_imbalances': 43200,
    'gold': 1440, 'freight_rates': 10080, 'fdic_problem_banks': 129600, 'quarter_end': 1440,
    'bank_service_outages': 15, 'btc_fees': 60, 'stablecoin_depeg': 60, 'news_bank_run_volume': 60,
    'polymarket_recession': 60, 'polymarket_bank_failure': 60, 'fdic_failed_list': 1440,
}

# Laien-Text-Korrektur: ASCII-Umschreibungen in der Recherche (falls vorhanden)
UMLAUT_FIX = {'fuer': 'für', 'ueber': 'über', 'waehrung': 'Währung', 'gebuehr': 'Gebühr'}

# ---------------------------------------------------------------- Helfer


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
    if src.get('access') == 'scrape' or src.get('format') == 'html':
        return 2
    if src.get('auth') != 'none':
        return 1
    return 0.5 if src.get('format') not in ('json', 'csv') else 0


def lic_unclear(lic):
    return bool(re.search(r'unklar|pr(ü|ue)f|\?', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|nc|propriet|tos', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|selbst|gering|unbekannt|unklar|nur z(ä|ae)hler|eingeschr|'
                      r'begrenzt|feed-fenster|letzte|webseite|kurz|nur feed', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [(r'quartal', 129600), (r'monat(?!e)|monatlich', 43200), (r'w(ö|oe)chentlich', 10080),
             (r'tagesschluss|t(ä|ae)glich|werkt(ä|ae)glich|spiegel', 1440), (r'st(ü|ue)ndlich', 60),
             (r'echtzeit|^1 min', 5), (r'15 min', 15)]
    for pat, v in rules:
        if re.search(pat, t):
            return v
    return 1440


def baseline_for(interval):
    if interval <= 60:
        return {'method': 'hour-of-week', 'windowDays': 28, 'minPoints': 48}
    if interval <= 1440:
        return {'method': 'rolling', 'windowDays': 90, 'minPoints': 30}
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


def fix_text(t):
    if not t:
        return t
    for a, b in UMLAUT_FIX.items():
        t = re.sub(r'\b' + a, b, t)
    return t


def canon(sid):
    return ALIAS.get(sid, sid)


def slug_of(s):
    return s['id'].split('.')[-1]


def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


# ---------------------------------------------------------------- Einlesen
research = json.load(open(IN_RESEARCH, encoding='utf-8'))
raw = research['signals']
BUILT = built_collectors()

variants = defaultdict(list)
for s in raw:
    keep = []
    for src in s['sources']:
        src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
        if src['_orig_id'] in SOURCE_VERIFIED_FALSE:
            src['verified'] = False
        elif src['_orig_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (src.get('endpoint') or ''):
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
    t = by_slug[target]
    t['_merged'].append(s['id'])
    t['priority'] = min(t['priority'], s['priority'])
    for b in s['banal_causes']:
        if b not in t['banal_causes']:
            t['banal_causes'].append(b)
    t['_sources'] += s['_srcs']

# ---------------------------------------------------------------- Signale bauen
DOMAINS = list(research['scenario_def']['domains'])   # in der Szenario-Definition
DOM_ORDER = DOMAINS + ['attention', 'context']
signals = []
for sl, s in by_slug.items():
    ev = EVIDENCE_OVERRIDE.get(sl, s['evidence_class'])
    seg = s['id'].split('.')[1]
    if sl == 'quarter_end' or seg == 'context':
        dom = 'context'
    elif ev == 'D':
        dom = 'attention'
    else:
        dom = DOMAIN_OVERRIDE.get(sl, seg)
    srcs = s['_sources']
    if sl in MAIN:
        main = next(x for x in srcs if x['source_id'] == MAIN[sl])
    else:
        main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    if dom == 'context':
        w = 0.0
    else:
        w = WEIGHT[sl]
        if ev == 'C':
            w = min(w, C_CAP)
        if ev == 'D':
            w = max(0.3, min(0.7, w))
    lic = main.get('license') or 'unklar'
    if not is_free(main):
        status = 'needs-key'
    elif lic_unclear(lic) and (main.get('access') == 'scrape' or main.get('format') == 'html'):
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = INTERVAL.get(sl) or interval_from(main.get('update_latency'))
    kind, unit = META.get(sl, ('gauge', 'Messwert'))
    if sl == 'quarter_end':
        kind, unit = 'binary', '0/1'
    sid = main['source_id']
    alt = list(dict.fromkeys(x['source_id'] for x in srcs if x['source_id'] != sid))
    notes = []
    if s.get('notes'):
        notes.append(fix_text(s['notes']))
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    for x in srcs:
        o = x['_orig_id']
        if o in GITHUB_CURRENT and o == sid:
            notes.append('GitHub-Spiegel aktuell (geprüft 17.11.2026): ' + GITHUB_CURRENT[o] + '.')
        if o in GITHUB_STALE:
            notes.append(GITHUB_STALE[o])
    if ev == 'C' and dom != 'context':
        notes.append('Klasse C: Aussage bzw. Nachrichtenlage, Gewicht höchstens %.1f.' % C_CAP)
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + fix_text(main['sample_note']))
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    ext = s.get('extends') or (sid if sid in BUILT else None)
    sig = OrderedDict([
        ('id', '%s.%s.%s' % (S, dom, sl)), ('scenarios', [S]), ('domain', dom),
        ('name', NAME.get(sl) or fix_text(s['name_de'])), ('plain', PLAIN.get(sl) or fix_text(s['plain_de'])),
        ('evidenceClass', ev), ('direction', direction if direction in ('up', 'down', 'both') else 'both'),
        ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', sid), ('collector', sid), ('unit', unit),
        ('baseline', baseline_for(iv)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', main.get('name')), ('sourceUrl', main.get('doc_url')), ('license', lic),
        ('rationale', fix_text(s.get('rationale'))), ('banalCauses', [fix_text(b) for b in s['banal_causes']]),
        ('endpoint', main.get('endpoint')), ('auth', main.get('auth')), ('history', main.get('history')),
        ('priority', s['priority']), ('verified', bool(main.get('verified'))), ('leadTime', lead),
        ('format', main.get('format')), ('notes', ' '.join(notes)),
        ('extends', ext if ext in BUILT else (s.get('extends') if s.get('extends') in BUILT else None)),
    ])
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    sig['_slug'] = sl
    signals.append(sig)

signals.sort(key=lambda x: (DOM_ORDER.index(x['domain']), -x['weight'], x['id']))

# ---------------------------------------------------------------- Quellen-Matrix (nur finance)
sig_by_src = defaultdict(list)
for sg in signals:
    for sid in dict.fromkeys(sg['_all_src']):
        sig_by_src[sid].append(sg['id'])
sources = []
for sid in sorted(variants):
    vs = variants[sid]
    best = min(vs, key=lambda v: (access_score(v), v.get('format') not in ('json', 'csv'),
                                  v['_orig_id'] != sid, not v.get('verified')))
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    sources.append(OrderedDict([
        ('id', sid), ('name', best.get('name')), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', best.get('update_latency')), ('history', best.get('history')),
        ('rateLimit', best.get('rate_limit')), ('license', best.get('license')),
        ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})), ('collector', sid),
        ('signals', sig_by_src.get(sid, [])), ('scenarios', [S]),
    ]))
src_index = {s['id']: s for s in sources}

# ---------------------------------------------------------------- Bau-Reihenfolge
def gh_live(m):
    return m['_orig_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (m.get('endpoint') or '') and bool(m.get('verified'))


coll = OrderedDict()
for sg in signals:
    if sg['domain'] == 'context':
        continue
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'domains': Counter(), 'maxw': 0.0, 'keyfree': False})
    c['signals'].append(sg['id'])
    c['mains'].append(sg['_main'])
    c['domains'][sg['domain']] += sg['weight']
    c['maxw'] = max(c['maxw'], sg['weight'])
    if sg['status'] == 'planned':
        c['keyfree'] = True
rows = []
for cid, c in coll.items():
    if cid in BROKEN:
        continue
    mains = c['mains']
    gh = any(gh_live(m) for m in mains)
    ext = cid if cid in BUILT else None
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download') and not is_stream(m)
                and is_free(m) and m['_orig_id'] != 'github-exchange-rates' for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0]
    rows.append({'collector': cid, 'domain': dom, 'domains': sorted(c['domains'], key=lambda d: DOM_ORDER.index(d)), 'gh': gh, 'extends': ext, 'keyfree': c['keyfree'], 'small': small,
                 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not gh, ext is None, not c['keyfree'], not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])
chosen = []
for d in DOMAINS:
    for r in [r for r in rows if d in r['domains']][:BUILD_MIN_PER_DOMAIN]:
        if r not in chosen:
            chosen.append(r)
for r in rows:
    if len(chosen) >= BUILD_N:
        break
    if r not in chosen:
        chosen.append(r)
chosen = sorted(chosen, key=lambda r: r['key'])[:BUILD_N]

EXT_TODO = {
    'nyfed-markets': 'SOFR-Perzentile (vorhanden) um IORB-Abstand, Reverse Repo und Swap-Linien (fx_swap_lines) ergänzen',
    'ecb-data': 'Serien ergänzen: Spitzenrefinanzierung, Überschussliquidität, Euro-Renditeabstände, Referenzkurse CHF/JPY/USD, MIR-Zinsen, TARGET2',
    'yahoo-chart': 'SPECS um Symbole ergänzen: KRE, IAT, EXV1.DE/SX7E, Einzelbanken, ^MOVE, ^VIX3M, ^SKEW, HYG/LQD, BTC-USD, GC=F, HG=F, ^GSPC, Fluchtwährungen',
    'sec-edgar': 'Volltextsuche auf weitere 8-K-Items umstellen (Item 1.03 Insolvenz, Item 2.02 bei Banken)',
    'statuspage': 'Host-Liste um Fintech- und Bankdienstleister erweitern',
    'wikimedia-pageviews': 'Artikel ergänzen: Bank run, Bank failure, Silicon Valley Bank, Credit Suisse, Liquiditätskrise',
    'gdelt-doc': 'Suchbegriffe ergänzen: "bank run", "bank collapse", "bank failure"',
    'defillama': 'Stablecoin-Preise (Depeg), Umlauf, TVL und CEX-Abflüsse ergänzen',
    'mempool-space': 'Gebühren-Empfehlung als Stress-Signal für Krypto ergänzen',
    'polymarket-gamma': 'Suchbegriffe ergänzen: recession, bank failure',
    'github-oil-prices': 'Brent-Reihe ist abgedeckt; nur Signal finance.real_economy.oil_price mit Szenario finance eintragen',
}

build = []
for i, r in enumerate(chosen, 1):
    c = r['c']
    srcs_ids = list(dict.fromkeys(m['source_id'] for m in c['mains']))
    eps = list(dict.fromkeys(m['endpoint'] for m in c['mains'] if m.get('endpoint')))
    ver = any(m.get('verified') for m in c['mains'])
    s0 = src_index[srcs_ids[0]]
    unc = []
    if not ver:
        unc.append('Endpunkt aus der Recherche, nicht geprüft (verified=false)')
    notes = [m['sample_note'] for m in c['mains'] if m.get('sample_note')]
    if notes:
        unc.append('Messfeld laut Recherche: ' + fix_text(notes[0]))
    for sid in srcs_ids:
        for o in {m['_orig_id'] for m in c['mains'] if m['source_id'] == sid}:
            if o in GITHUB_STALE:
                unc.append(GITHUB_STALE[o])
    lic = s0.get('license') or 'unklar'
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    if s0.get('rateLimit'):
        unc.append('Rate-Limit: ' + s0['rateLimit'])
    if any(not is_free(m) for m in c['mains']):
        unc.append('Mindestens eine Hauptquelle braucht Key/Konto')
    if r['collector'] == 'fred' or r['collector'] == 'fred-csv':
        unc.append('FRED-Reihen-IDs vor dem Einbau einzeln prüfen; ICE-BofA-Reihen liefern über FRED nur etwa 3 Jahre Historie')
    why = []
    if r['gh']:
        why.append('raw.githubusercontent.com, aktuell verifiziert (' + GITHUB_CURRENT[next(m['_orig_id'] for m in c['mains'] if gh_live(m))] + ')')
    if r['extends']:
        why.append('erweitert bestehenden Collector %s' % r['extends'])
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % (s0.get('format') or '').upper() if r['small'] else 'Format/Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    ext_txt = EXT_TODO.get(r['collector']) if r['extends'] else None
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('domains', r['domains']), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver),
        ('live', r['gh']), ('extends', ext_txt and r['extends']), ('extendsWhat', ext_txt),
        ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Szenario-Eintrag (mit Zuschlag kleiner Domains)
sd = research['scenario_def']
dc_main = Counter(x['domain'] for x in signals)
scenario = OrderedDict([
    ('id', S), ('order', sd['order']), ('title', sd['title']),
    ('question', 'Bahnt sich eine Finanzkrise oder ein Ansturm auf Banken an?'),
    ('tagline', 'Geldmarkt, Kreditaufschläge, Banken, Schwankungen, Krypto, Insolvenzen'),
    ('domains', OrderedDict((d, OrderedDict([('title', v['title']), ('weight', v['weight']), ('plain', v['plain'])]))
                            for d, v in sd['domains'].items())),
])

# ---------------------------------------------------------------- Schlüssel- und Lizenz-Tabellen
for sg in signals:
    sg.pop('_main'), sg.pop('_all_src'), sg.pop('_slug')
main_cnt = Counter(sg['independenceGroup'] for sg in signals if sg['status'] == 'needs-key')
key_rows = []
for s in sources:
    if not (any(not is_free(v) for v in variants[s['id']]) or main_cnt[s['id']]):
        continue
    own = [sg for sg in signals if sg['independenceGroup'] == s['id']]
    names = [sg['name'] for sg in own] or ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in s['signals'][:3])]
    alt = len(s['signals']) - len(own)
    cnt = '%d' % main_cnt[s['id']] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in variants[s['id']] if not is_free(v)), variants[s['id']][0])
    env = 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', s['id'].upper())
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], env, cnt))
keys_md = '\n'.join(['# Benötigte Keys, Konten und Bezahlzugänge (Szenario finance)', '',
                     'Automatisch erzeugt von `scripts/consolidate_finance.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; '
                     'Dienste, die dort schon stehen, nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, '
                     'nicht als Fehler gewertet.', '',
                     '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |',
                     '|---|---|---|---|---|---|'] + key_rows + [''])
lic_rows = []
for s in sources:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if (s.get('access') == 'scrape' or s.get('format') == 'html') and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_md = '\n'.join(['# Lizenz noch klären (Szenario finance)', '',
                    'Automatisch erzeugt von `scripts/consolidate_finance.py`. Kriterien wie in `docs/LICENSE-TODO.md`: Lizenz laut '
                    'Recherche unklar oder Nutzungsbedingungen schränken automatisierten Abruf ein. Signale, deren Hauptquelle nur '
                    'per Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`. Yahoo Finance: '
                    'Nutzungsbedingungen verbieten systematischen Abruf; der Collector yahoo-chart läuft bereits, die Frage gilt '
                    'für alle Szenarien.', '',
                    '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + [''])

# ---------------------------------------------------------------- Ausgabe
for path, obj in [(OUT_SIGNALS, signals), (OUT_SCEN, scenario), (OUT_BUILD, build), (OUT_SOURCES, sources)]:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
open(OUT_KEYS, 'w', encoding='utf-8').write(keys_md)
open(OUT_LIC, 'w', encoding='utf-8').write(lic_md)

# ---------------------------------------------------------------- Selbstprüfung
errors = []
for path in (OUT_SIGNALS, OUT_SCEN, OUT_BUILD, OUT_SOURCES):
    json.load(open(path, encoding='utf-8'))
sigs = json.load(open(OUT_SIGNALS, encoding='utf-8'))
other_ids = set()
for p in OTHER_SIGNALS:
    other_ids |= {x['id'] for x in json.load(open(p, encoding='utf-8'))}
ids = [x['id'] for x in sigs]
if len(ids) != len(set(ids)):
    errors.append('doppelte IDs: %s' % [i for i, n in Counter(ids).items() if n > 1])
if other_ids & set(ids):
    errors.append('ID-Kollision: %s' % sorted(other_ids & set(ids)))
dc = Counter(x['domain'] for x in sigs)
for d in DOM_ORDER:
    if not dc[d]:
        errors.append('Domain leer: ' + d)
for d in DOMAINS:
    if 0 < dc[d] < 3:
        errors.append('Domain mit weniger als 3 Signalen: %s' % d)
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
    if x['domain'] == 'attention' and x['evidenceClass'] != 'D':
        errors.append('attention ohne Klasse D: ' + x['id'])
    if x['domain'] == 'context' and x['weight'] != 0:
        errors.append('context mit Gewicht: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary') or x['direction'] not in ('up', 'down', 'both'):
        errors.append('kind/direction: ' + x['id'])
    if x['status'] not in ('needs-key', 'license-unclear', 'planned'):
        errors.append('status: ' + x['id'])
    if re.search(r'\b(fuer|ueber|waehr|gebuehr|Stoer)', json.dumps(x, ensure_ascii=False), re.I):
        errors.append('ASCII-Umlaut-Verdacht: ' + x['id'])
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
bdc = Counter(d for b in build for d in b['domains'])
for d in DOMAINS:
    if bdc[d] < BUILD_MIN_PER_DOMAIN:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors (soweit möglich)' % (d, bdc[d]))
for b in build:
    for sid in b['signals']:
        if sid not in ids:
            errors.append('Bau-Reihenfolge: unbekanntes Signal ' + sid)
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d + %d != %d' % (len(sigs), merged_in, len(raw)))
if set(scenario['domains']) != set(DOMAINS) or len(scenario['domains']) > 9:
    errors.append('Szenario-Domains')
sids = [s['id'] for s in sources]
if len(sids) != len(set(sids)):
    errors.append('doppelte Quellen-IDs')
for s in sources:
    for x in s['signals']:
        if x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))

print('Recherche-Signale: %d, zusammengeführt: %d, Katalog: %d' % (len(raw), merged_in, len(sigs)))
print('Domains:', dict(sorted(dc.items(), key=lambda kv: DOM_ORDER.index(kv[0]))))
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen: %d, Collectors: %d' % (len(sources), len(coll)))
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Top 10:', ', '.join('%s(%s%s%s)' % (b['collector'], b['domain'], ',live' if b['live'] else '',
                                          ',ext' if b['extends'] else '') for b in build[:10]))
if '-v' in sys.argv:
    for b in build:
        print(b['rank'], b['collector'], b['domain'], 'live' if b['live'] else '', b['extends'] or '', b['why'][:110])
    for x in sigs:
        print(x['id'], x['evidenceClass'], x['weight'], x['status'], x['collector'], x['intervalMinutes'], x['unit'])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
