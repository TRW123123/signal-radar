#!/usr/bin/env python3
"""Konsolidiert die Recherche zum Szenario bio (Pandemie und Ausbrüche) zu Signal-Katalog, Szenario-Eintrag,
Bau-Reihenfolge, Quellen-Matrix und den Tabellen für Keys und Lizenzen.

Aufruf:  python3 -I scripts/consolidate_bio.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_war.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Schreibt ausschließlich:
  catalog/signals/bio.json, catalog/research/bio-scenario-def.json, catalog/bio-build-order.json,
  catalog/research/bio-sources.json, catalog/research/bio-keys.md, catalog/research/bio-license-todo.md
Bestehende Dateien (scenarios.json, sources.json, docs/*) werden nicht angefasst.
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
SRC_FILE = os.path.join(RES, 'bio-all.json')
OUT_SIGNALS = os.path.join(CAT, 'signals', 'bio.json')
OUT_SCEN = os.path.join(RES, 'bio-scenario-def.json')
OUT_BUILD = os.path.join(CAT, 'bio-build-order.json')
OUT_SOURCES = os.path.join(RES, 'bio-sources.json')
OUT_KEYS = os.path.join(RES, 'bio-keys.md')
OUT_LIC = os.path.join(RES, 'bio-license-todo.md')
S = 'bio'

# Domains der Szenario-Definition. "research" aus der Recherche entfällt: beide Signale sind Klasse D
# (Preprint-Wellen, Trefferzahlen) und landen in attention; als Domain bliebe sie leer.
DOMAINS = ['wastewater', 'clinical', 'outbreaks', 'animal', 'genomic', 'mortality', 'behaviour', 'markets']
DOM_ORDER = DOMAINS + ['attention', 'context']
BUILD_N = 20
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2   # Klasse C (Aussagen von Behörden und Organisationen): höchstens 0,2

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs, die dieselbe Quelle meinen -> kanonische ID
ALIAS = {'who-covid-dash': 'who-flunet'}   # Endpunkt ist WHO FluNet (FLUMART), nicht das COVID-Dashboard
# Quelle -> Collector, wo mehrere Quellen derselben Herkunft ein Collector bedient
COLLECTOR = {
    'rki-amelag-github-sites': 'rki-amelag-github', 'rki-intensivregister-bl-github': 'rki-intensivregister-github',
    'cdc-nwss-flua': 'cdc-nwss-socrata', 'cdc-nwss-h5': 'cdc-nwss-socrata',
    'pango-notes-github': 'pango-alias-github', 'pango-lineages-github': 'pango-alias-github',
    'usda-nmts': 'usda-aphis-hpai',
}
# Duplikate: Slug -> Slug des führenden Eintrags
MERGE = {
    'epmc_hits': 'preprint_waves',          # beide zählen Preprints/Artikel zu Erreger-Stichworten (Europe PMC)
    'wiki_birdflu': 'wiki_outbreak',        # Wikipedia-Aufrufe, nur andere Artikelliste (Vogelgrippe gehört dazu)
    'pango_lineage_share': 'ecdc_variants', # gleiche Datei variants.csv als schlüsselfreie Quelle
    'genbank_h5': 'nextstrain_h5',          # beide zählen neue H5N1-Sequenzen
    'egg_price': 'poultry_stocks',          # Eierpreis-Proxy ist der Kurs von Cal-Maine (CALM), wie bei poultry_stocks
}
# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {'nextstrain_h5': 'ncbi-eutils'}   # kleine API-Antwort statt komprimierter Metadaten-Datei
CONTEXT = {'amelag_covered_pop'}          # reiner Qualitätsfilter (Abdeckung), Gewicht 0

# Auf raw.githubusercontent.com liegende Quellen, am 17.11.2026 per curl als aktuell geprüft (letzter Eintrag)
GITHUB_CURRENT = {
    'rki-amelag-github': 'amelag_aggregierte_kurve.tsv: letzte Woche 04.11.2026',
    'rki-are-github': 'ARE-Konsultationsinzidenz.tsv: letzte Woche 2026-W45',
    'rki-grippeweb-github': 'GrippeWeb_Daten_des_Wochenberichts.tsv: letzte Woche 2026-W45',
    'rki-sari-github': 'SARI-Hospitalisierungsinzidenz.tsv: letzte Woche 2026-W45',
    'rki-intensivregister-github': 'Intensivregister_Deutschland_Kapazitaeten.csv und _Bundeslaender_: letzter Tag 16.11.2026',
    'rki-covid-hosp-github': 'Aktuell_Deutschland_COVID-19-Hospitalisierungen.csv: letzter Tag 15.11.2026',
    'rki-covid-inz-github': 'COVID-19-Faelle_7-Tage-Inzidenz_Deutschland.csv: letzter Tag 15.11.2026',
    'ecdc-erviss-github': 'ILIARIRates, sentinelTestsDetectionsPositivity, nonSentinelSeverity, activityFluTypeSubtype: 2026-W45; variants.csv: 2026-W44',
    'cdc-flusight-github': 'target-hospital-admissions.csv: letzte Woche 07.11.2026',
}
GITHUB_NOTE = {
    'pango-alias-github': 'raw-Dateien am 17.11.2026 abrufbar (HTTP 200, alias_key.json bis Alias XHE, lineage_notes.txt bis QW.2), '
                          'aber ohne Datumsangabe; Aktualität daher nicht verifiziert.',
    'rki-amelag-github-sites': 'amelag_einzelstandorte.tsv (57 MB): Kopfzeile am 17.11.2026 abgerufen, Ende der Datei nicht prüfbar (Range-Abruf vom Ende liefert 501).',
}
# Dateigrößen laut Recherche und Prüfung: alle RKI/ECDC/CDC-Dateien sind größer als 6000 Zeichen
SIZE_NOTE = 'Datei größer als 6000 Zeichen (0,1 bis 57 MB); Zeilenfilter und Spaltenauswahl im Collector.'

# Beschreibung dessen, was ein vorhandener Collector ergänzen muss
EXTENDS = {
    'yahoo-chart': 'Symbole ergänzen: MRNA, BNTX, NVAX (mrna); ROG.SW, GILD, HOLX (antivirals); CALM, VITL (poultry_stocks, inkl. Eierpreis-Proxy); '
                   'MMM, APT (mask_stocks). Metrik Schlusskurs-Stand wie bei den Preisen; je Signal nur Tage, an denen alle Symbole Werte haben.',
    'gdelt-doc': 'Neue Suchbegriffe für bio.attention.gdelt_outbreak: "bird flu" OR H5N1, outbreak OR epidemic OR "new virus" (mode=timelinevol).',
    'wikimedia-pageviews': 'Zwei neue Artikelgruppen (de.wikipedia): wiki_outbreak = Vogelgrippe, Geflügelpest, H5N1, Ebolafieber, Mpox, Marburg-Virus, Nipah, Masern; '
                           'wiki_masks = Atemschutzmaske, Quarantäne, Grippeschutzimpfung.',
    'mastodon-trends': 'Neues Signal bio.attention.mastodon_health: Trend-Tags nach Erreger- und Krankheitsbegriffen filtern (heute nur ein Cyber-Signal).',
    'polymarket-gamma': 'Neues Signal bio.attention.poly_pandemic: Suchbegriffe pandemic, H5N1, WHO emergency; Wahrscheinlichkeit und Volumen wie bei den Cyber- und War-Signalen.',
}

# Gewichte nach Rubrik: 0,8 bis 0,9 sehr spezifisch und schwer zu fälschen; 0,5 bis 0,7 mäßig; 0,2 bis 0,4 generisch;
# Klasse D 0,3 bis 0,7; Klasse C höchstens 0,2.
WEIGHT = {
    # wastewater
    'amelag_sars2': 0.7, 'amelag_flu': 0.6, 'amelag_flub': 0.4, 'amelag_rsv': 0.5, 'amelag_site_spread': 0.7,
    'nwss_sars2': 0.6, 'nwss_flu': 0.5, 'nwss_h5': 0.85, 'wscan_multi': 0.6, 'eu_ww': 0.6, 'ch_ww': 0.55,
    'nl_ww': 0.55, 'ww_vs_clinical_gap': 0.8, 'amelag_covered_pop': 0.0,
    # clinical
    'are_konsultation': 0.6, 'are_kids': 0.5, 'are_bl_spread': 0.55, 'grippeweb_ili': 0.5, 'sari_total': 0.7,
    'sari_unexplained': 0.85, 'sari_kids': 0.5, 'icu_covid_current': 0.5, 'icu_picu': 0.55, 'icu_free_vent': 0.5,
    'covid_hosp': 0.55, 'covid_inz': 0.35, 'ecdc_ili': 0.55, 'ecdc_positivity': 0.6, 'ecdc_severity': 0.6,
    'ecdc_flu_unknown': 0.85, 'cdc_flusight': 0.5, 'cdc_nhsn': 0.5, 'cdc_fluview': 0.5, 'ukhsa': 0.5,
    'who_flunet': 0.5, 'srv_survstat': 0.4, 'nov_human_h5': 0.2,
    # outbreaks (alles Klasse C)
    'who_don_rate': 0.15, 'who_don_new_pathogen': 0.2, 'who_pheic': 0.2, 'cdtr_items': 0.15, 'africacdc': 0.15,
    # animal
    'aphis_flocks': 0.6, 'aphis_dairy': 0.8, 'aphis_wild': 0.5, 'aphis_mammal': 0.75, 'woah_events': 0.55,
    'fli_tsis': 0.55, 'fli_risk': 0.2, 'efsa_quarter': 0.2, 'pet_food_recall': 0.5,
    # genomic
    'pango_new_alias': 0.6, 'ecdc_variants': 0.6, 'nextstrain_h5': 0.75, 'gisaid_counts': 0.4,
    # mortality
    'euromomo': 0.8, 'destatis_deaths': 0.7, 'cdc_excess': 0.7, 'pediatric_flu_deaths': 0.5,
    # behaviour
    'bfarm_engpass': 0.35, 'travel_warn': 0.2, 'sick_leave': 0.5,
    # markets (generisch)
    'mrna': 0.3, 'antivirals': 0.3, 'poultry_stocks': 0.25, 'mask_stocks': 0.3,
    # attention (Klasse D)
    'gdelt_outbreak': 0.4, 'wiki_outbreak': 0.5, 'promed_volume': 0.5, 'healthmap_alerts': 0.4,
    'dead_birds_inat': 0.5, 'wiki_masks': 0.4, 'mastodon_health': 0.3, 'preprint_waves': 0.4, 'poly_pandemic': 0.5,
}
DIRECTION_OVERRIDE = {}
EVIDENCE_OVERRIDE = {}
# erwartetes Beobachtungsintervall (Minuten) dort, wo die Recherche nur "bei Veröffentlichung" o. ä. nennt
INTERVAL = {'who_don_rate': 1440, 'who_don_new_pathogen': 1440, 'who_pheic': 1440, 'pango_new_alias': 1440,
            'fli_risk': 1440, 'travel_warn': 1440, 'mrna': 1440, 'antivirals': 1440, 'poultry_stocks': 1440,
            'mask_stocks': 1440}
ROLLING_DOMAINS = {'markets', 'animal', 'context'}

# Laien-Texte, wo die Recherche eine Frage ohne Erklärung liefert oder holprig formuliert
PLAIN = {
    'wscan_multi': 'Misst Mpox, Norovirus und RSV im Abwasser eines privaten US-Messnetzes; ungewöhnliche Erreger fallen dort früh auf.',
    'healthmap_alerts': 'Zählt, wie viele Ausbruchsmeldungen das Portal HealthMap automatisch aus Nachrichten erzeugt, je Land.',
    'poultry_stocks': 'Verfolgt die Aktien großer Eier- und Geflügelhersteller; bei Vogelgrippe-Ausbrüchen und knappen Eiern bewegen sie sich.',
    'preprint_waves': 'Zählt Vorabveröffentlichungen und Artikel zu bestimmten Erregern; eine plötzliche Welle zeigt, dass Forschende etwas Neues sehen.',
    'wiki_outbreak': 'Zählt Wikipedia-Aufrufe zu Vogelgrippe, Ebola, Mpox, Marburg, Nipah und Masern.',
    'ecdc_variants': 'Zeigt, welche Corona-Varianten in welchem EU-Land dominieren und wie schnell neue Linien wachsen.',
    'nextstrain_h5': 'Zählt neue H5N1-Genomsequenzen in öffentlichen Datenbanken; mehr Sequenzen heißen, dass mehr Ausbrüche untersucht werden.',
}
NAME = {'poultry_stocks': 'Geflügel- und Eier-Aktien (Cal-Maine, Vital Farms)',
        'nextstrain_h5': 'H5N1-Sequenzen in öffentlichen Datenbanken (NCBI, Nextstrain)',
        'ecdc_variants': 'EU: Varianten-Anteile SARS-CoV-2 und neue Linien',
        'preprint_waves': 'Preprint-Welle zu einem Erreger (medRxiv, Europe PMC)',
        'wiki_outbreak': 'Wikipedia-Aufrufe: Erreger und Vogelgrippe'}

KIND_GAUGE = re.compile(
    r'^(amelag_(sars2|flu|flub|rsv|site_spread|covered_pop)|nwss_(sars2|flu)|wscan_multi|eu_ww|ch_ww|nl_ww|ww_vs_clinical_gap|'
    r'are_(konsultation|kids)|grippeweb_ili|sari_|icu_(picu|free_vent)|ecdc_(ili|positivity|variants)|cdc_(fluview|nhsn)|ukhsa|'
    r'euromomo|mrna|antivirals|poultry_stocks|mask_stocks|poly_pandemic|fli_risk|covid_inz|sick_leave)')
UNIT = {
    'amelag_sars2': 'Viruslast (normalisiert)', 'amelag_flu': 'Viruslast (normalisiert)', 'amelag_flub': 'Viruslast (normalisiert)',
    'amelag_rsv': 'Viruslast (normalisiert)', 'amelag_site_spread': '% der Standorte', 'amelag_covered_pop': '% der Bevölkerung',
    'nwss_sars2': 'Viruslast-Index', 'nwss_flu': 'Viruslast-Index', 'nwss_h5': 'Messstellen', 'wscan_multi': 'Viruslast',
    'eu_ww': 'Viruslast', 'ch_ww': 'Viruslast', 'nl_ww': 'Viruslast', 'ww_vs_clinical_gap': 'Verhältnis',
    'are_konsultation': 'pro 100.000', 'are_kids': 'pro 100.000', 'are_bl_spread': 'Bundesländer', 'grippeweb_ili': 'pro 100.000',
    'sari_total': 'pro 100.000', 'sari_kids': 'pro 100.000', 'sari_unexplained': '%', 'icu_covid_current': 'Patienten',
    'icu_picu': '% belegt', 'icu_free_vent': 'Plätze', 'covid_hosp': 'Fälle (7 Tage)', 'covid_inz': 'pro 100.000',
    'ecdc_ili': 'pro 100.000', 'ecdc_positivity': '%', 'ecdc_severity': 'Fälle', 'ecdc_flu_unknown': 'Nachweise',
    'cdc_flusight': 'Einweisungen', 'cdc_nhsn': 'Einweisungen', 'cdc_fluview': '%', 'ukhsa': 'Messwert',
    'who_flunet': 'Nachweise', 'srv_survstat': 'Fälle', 'nov_human_h5': 'Fälle', 'who_don_rate': 'Meldungen pro Monat',
    'who_don_new_pathogen': 'Meldungen', 'who_pheic': '0/1', 'cdtr_items': 'Themen', 'promed_volume': 'Berichte',
    'healthmap_alerts': 'Meldungen', 'africacdc': 'Ereignisse', 'gdelt_outbreak': 'Volumenanteil', 'wiki_outbreak': 'Aufrufe',
    'wiki_masks': 'Aufrufe', 'aphis_flocks': 'Bestände', 'aphis_dairy': 'Herden', 'aphis_wild': 'Tiere', 'aphis_mammal': 'Tiere',
    'woah_events': 'Ausbrüche', 'fli_tsis': 'Ausbrüche', 'fli_risk': 'Stufe', 'efsa_quarter': 'Ausbrüche',
    'dead_birds_inat': 'Beobachtungen', 'pet_food_recall': 'Rückrufe', 'pango_new_alias': 'Aliase', 'ecdc_variants': '%',
    'nextstrain_h5': 'Sequenzen', 'gisaid_counts': 'Sequenzen', 'euromomo': 'z-Wert', 'destatis_deaths': 'Todesfälle',
    'cdc_excess': 'Todesfälle', 'pediatric_flu_deaths': 'Todesfälle', 'preprint_waves': 'Preprints', 'bfarm_engpass': 'Meldungen',
    'travel_warn': 'Änderungen', 'mastodon_health': 'Tags', 'sick_leave': '%', 'mrna': 'Kurs', 'antivirals': 'Kurs',
    'poultry_stocks': 'Kurs', 'mask_stocks': 'Kurs', 'poly_pandemic': '%',
}

# ---------------------------------------------------------------- Helfer


def is_free(src):
    cost = (src.get('cost') or '').lower()
    return src.get('auth') == 'none' and (cost.startswith('free') or cost in ('', 'kostenlos'))


def is_stream(src):
    ep = (src.get('endpoint') or '').lower()
    return ep.startswith('wss://') or 'stream' in ep or 'firehose' in ep


def access_score(src):
    cost = (src.get('cost') or '').lower()
    if src.get('auth') == 'paid' or not (cost.startswith('free') or cost == ''):
        return 3
    if src.get('access') == 'scrape':
        return 2
    if src.get('auth') != 'none':
        return 1
    return 0.5 if src.get('format') in ('mrt', 'parquet', 'html') else 0


def lic_unclear(lic):
    return bool(re.search(r'unklar|nicht (im repo )?gepr(ü|ue)ft|ungepr|\?', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|\bNC\b|-NC\b|restriktiv|'
                          r'proprietär|Nutzungsbedingungen|Copyright|GISAID', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|selbst|gering|unbekannt|unklar|nur z(ä|ae)hler|eingeschr|'
                      r'begrenzt|feed-fenster|letzte|webseite|kurz|nur feed', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [
        (r'j(ä|ae)hrlich', 525600), (r'vierteljähr|quartal', 129600), (r'monatlich', 43200),
        (r'w(ö|oe)chentlich|^wochen', 10080), (r'werktag', 1440), (r'mehrmals t(ä|ae)glich', 360),
        (r'(ä|ae)glich|tagesende', 1440), (r'st(ü|ue)ndlich|^stunden|1 ?h', 60),
        (r'15 min', 15), (r'minuten', 15), (r'unregelm|unbekannt|laufend|bei ', 60),
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


def canon(sid):
    return ALIAS.get(sid, sid)


def coll_of(sid):
    return COLLECTOR.get(sid, sid)


def slug_of(s):
    return s['id'].split('.')[-1]


def seg_of(s):
    return s['id'].split('.')[1]


def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


# ---------------------------------------------------------------- Einlesen
research = json.load(open(SRC_FILE, encoding='utf-8'))
raw = research['signals']
BUILT = built_collectors()
existing_sources = {s['id']: s for s in json.load(open(os.path.join(CAT, 'sources.json'), encoding='utf-8'))}

variants = defaultdict(list)
for s in raw:
    keep = []
    for src in s['sources']:
        src = dict(src, _orig_id=src['source_id'], source_id=canon(src['source_id']))
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
    t['_sources'] += s['_srcs']


# ---------------------------------------------------------------- Signale bauen
def make_signal(sl, s, dom, srcs, main, ev):
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
    if not is_free(main):
        status = 'needs-key'
    elif lic_unclear(lic) and main.get('access') == 'scrape':
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = INTERVAL.get(sl) or interval_from(main.get('update_latency'))
    kind = 'binary' if sl == 'who_pheic' else ('gauge' if KIND_GAUGE.match(sl) else 'count')
    sid = main['source_id']
    c = coll_of(sid)
    notes = []
    if s.get('notes'):
        notes.append(s['notes'])
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if sl == 'poultry_stocks':
        notes.append('Eierpreis-Proxy: Kurs von Cal-Maine (CALM); der echte Eierpreis (FRED APU0000708111) braucht einen kostenlosen Key.')
    if sid in GITHUB_CURRENT:
        notes.append('GitHub-Spiegel aktuell (geprüft 17.11.2026): ' + GITHUB_CURRENT[sid] + '.')
    if sid in GITHUB_NOTE:
        notes.append(GITHUB_NOTE[sid])
    if 'raw.githubusercontent.com' in (main.get('endpoint') or ''):
        notes.append(SIZE_NOTE)
    if c in EXTENDS:
        notes.append('Erweitert vorhandenen Collector %s: %s' % (c, EXTENDS[c]))
    if ev == 'C':
        notes.append('Klasse C: Aussage einer Behörde oder Organisation, Gewicht höchstens %.1f.' % C_CAP)
    if ev == 'D':
        notes.append('Klasse D: Aufmerksamkeit bzw. Selbstauskunft der Masse, Domain attention.')
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + main['sample_note'])
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    if direction not in ('up', 'down', 'both'):
        direction = 'both'
    sig = OrderedDict([
        ('id', '%s.%s.%s' % (S, dom, sl)), ('scenarios', [S]), ('domain', dom),
        ('name', NAME.get(sl, s['name_de'])), ('plain', PLAIN.get(sl, s['plain_de'])),
        ('evidenceClass', ev), ('direction', direction), ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', c), ('collector', c), ('unit', UNIT.get(sl, 'Anzahl')),
        ('baseline', baseline_for(iv, dom)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', main.get('name')), ('sourceUrl', main.get('doc_url')), ('license', lic),
        ('rationale', s.get('rationale')), ('banalCauses', s['banal_causes']),
        ('endpoint', main.get('endpoint')), ('auth', main.get('auth')), ('history', main.get('history')),
        ('priority', s['priority']), ('verified', bool(main.get('verified'))), ('leadTime', lead),
        ('format', main.get('format')), ('notes', ' '.join(notes)),
        ('extends', c if c in BUILT else None),
    ])
    sig['_main'] = main
    sig['_srcs'] = srcs
    return sig


signals = []
for sl, s in by_slug.items():
    ev = EVIDENCE_OVERRIDE.get(sl, s['evidence_class'])
    if sl in CONTEXT:
        dom = 'context'
    elif ev == 'D':
        dom = 'attention'
    else:
        dom = seg_of(s)
    srcs = s['_sources']
    if sl in MAIN:
        main = next(x for x in srcs if x['source_id'] == MAIN[sl])
    else:
        main = min(enumerate(srcs), key=lambda x: (access_score(x[1]), x[0]))[1]
    signals.append(make_signal(sl, s, dom, srcs, main, ev))
signals.sort(key=lambda x: (DOM_ORDER.index(x['domain']), -x['weight'], x['id']))

# ---------------------------------------------------------------- Quellen-Matrix (nur bio)
sig_by_src = defaultdict(list)
for sg in signals:
    for sid in dict.fromkeys(x['source_id'] for x in sg['_srcs']):
        sig_by_src[sid].append(sg['id'])
sources = []
for sid in sorted(variants):
    vs = variants[sid]
    exact = [v for v in vs if v['_orig_id'] == sid]
    best = min(vs, key=lambda v: (access_score(v), v.get('format') not in ('json', 'csv'), v not in exact, not v.get('verified')))
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    ex = existing_sources.get(sid)
    sources.append(OrderedDict([
        ('id', sid), ('name', best.get('name')), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', best.get('update_latency')), ('history', best.get('history')),
        ('rateLimit', best.get('rate_limit')), ('license', best.get('license')),
        ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})),
        ('collector', ex['collector'] if ex else coll_of(sid)), ('signals', sig_by_src.get(sid, [])), ('scenarios', [S]),
    ]))
src_index = {s['id']: s for s in sources}

# ---------------------------------------------------------------- Bau-Reihenfolge
coll = OrderedDict()
for sg in signals:
    c = coll.setdefault(sg['collector'], {'signals': [], 'mains': [], 'allsrc': [], 'domains': Counter(), 'maxw': 0.0, 'keyfree': False})
    c['signals'].append(sg['id'])
    c['mains'].append(sg['_main'])
    c['allsrc'] += [x for x in sg['_srcs'] if coll_of(x['source_id']) == sg['collector']]
    if sg['domain'] != 'context':
        c['domains'][sg['domain']] += sg['weight']
    c['maxw'] = max(c['maxw'], sg['weight'])
    if sg['status'] == 'planned':
        c['keyfree'] = True


def gh_live(m):
    return m['source_id'] in GITHUB_CURRENT and 'raw.githubusercontent.com' in (m.get('endpoint') or '') and bool(m.get('verified'))


rows = []
for cid, c in coll.items():
    mains = c['mains']
    gh = any(gh_live(m) for m in mains)
    ext = cid if cid in BUILT else None
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download') and not is_stream(m) and is_free(m)
                and 'raw.githubusercontent.com' not in (m.get('endpoint') or '') and 'data.cdc.gov' not in (m.get('endpoint') or '')
                or ('data.cdc.gov' in (m.get('endpoint') or '') and '$limit' in (m.get('endpoint') or '')) for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0] if c['domains'] else 'context'
    forbid = any(re.search(r'verbiet|kein scrap', m.get('license') or '', re.I) for m in mains)
    rows.append({'collector': cid, 'domain': dom, 'gh': gh, 'extends': ext, 'keyfree': c['keyfree'], 'small': small,
                 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not gh, ext is None, not c['keyfree'], forbid, not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

# Zuerst die Rangliste nach Schlüssel (live, erweitert, ohne Key, klein, Historie, Wert); danach Domain-Abdeckung:
# fehlt einer Domain der zweite Eintrag, ersetzt ihr bester Collector den rangniedrigsten aus einer Domain mit Überschuss.
chosen = [r for r in rows if r['domain'] != 'context'][:BUILD_N]
for d in DOMAINS + ['attention']:
    while sum(1 for r in chosen if r['domain'] == d) < BUILD_MIN_PER_DOMAIN:
        cand = [r for r in rows if r['domain'] == d and r not in chosen]
        if not cand:
            break
        cnt = Counter(r['domain'] for r in chosen)
        victims = [r for r in chosen if cnt[r['domain']] > BUILD_MIN_PER_DOMAIN]
        chosen.remove(max(victims, key=lambda r: r['key']))
        chosen.append(cand[0])
chosen.sort(key=lambda r: r['key'])

build = []
for i, r in enumerate(chosen, 1):
    c = r['c']
    srcs_ids = list(dict.fromkeys(m['source_id'] for m in c['allsrc']))
    eps = list(dict.fromkeys(m['endpoint'] for m in c['allsrc'] if m.get('endpoint')))
    ver = any(m.get('verified') for m in c['mains'])
    s0 = src_index[c['mains'][0]['source_id']]
    unc = []
    if not ver:
        unc.append('Endpunkt aus der Recherche, nicht geprüft (verified=false)')
    unc_notes = [m.get('sample_note') for m in c['mains'] if m.get('sample_note')]
    if unc_notes:
        unc.append('Messfeld laut Recherche: ' + unc_notes[0])
    for sid in srcs_ids:
        if sid in GITHUB_NOTE:
            unc.append(GITHUB_NOTE[sid])
    if r['gh'] or any('raw.githubusercontent.com' in (m.get('endpoint') or '') for m in c['mains']):
        unc.append(SIZE_NOTE)
    lic = s0.get('license') or 'unklar'
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    rl = s0.get('rateLimit')
    if rl and rl not in ('unklar', 'unbekannt'):
        unc.append('Rate-Limit: ' + rl)
    why = []
    if r['extends']:
        why.append('Ergänzen: ' + EXTENDS[r['extends']])
    if r['gh']:
        gs = next(m['source_id'] for m in c['mains'] if gh_live(m))
        why.append('raw.githubusercontent.com, aktuell verifiziert (' + GITHUB_CURRENT[gs] + ')')
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort möglich' % (s0.get('format') or '').upper() if r['small'] else 'Antwort groß oder Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver), ('live', r['gh']),
        ('extends', r['extends']), ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))

# ---------------------------------------------------------------- Keys und Lizenzen (Markdown)
ENV = {'fred-eggs': 'SR_FRED_KEY'}
key_rows = []
main_cnt = Counter(sg['_main']['source_id'] for sg in signals if sg['status'] == 'needs-key')
for s in sources:
    sid = s['id']
    if not (any(not is_free(v) for v in variants[sid]) or main_cnt[sid]):
        continue
    names = [sg['name'] for sg in signals if sg['_main']['source_id'] == sid]
    all_sigs = s['signals']
    if not names:
        names = ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in all_sigs[:3])]
    alt = len(all_sigs) - len(names) if names and not names[0].startswith('nur') else 0
    cnt = '%d' % main_cnt[sid] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in variants[sid] if not is_free(v)), variants[sid][0])
    env = ENV.get(sid, 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', sid.upper()))
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], env, cnt))
keys_md = ['# Benötigte Keys, Konten und Bezahlzugänge (Szenario bio)', '',
           'Automatisch erzeugt von `scripts/consolidate_bio.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon '
           'stehen (z. B. FRED), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet. '
           '"Betroffene Signale" zählt Signale mit dieser Quelle als Hauptquelle und Status needs-key.', '',
           '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |',
           '|---|---|---|---|---|---|'] + key_rows + ['']

lic_rows = []
for s in sources:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic)):
        continue
    flag = ' (Status license-unclear)' if s.get('access') == 'scrape' and lic_unclear(lic) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_md = ['# Lizenz noch klären (Szenario bio)', '',
          'Automatisch erzeugt von `scripts/consolidate_bio.py`. Kriterien wie in `docs/LICENSE-TODO.md`: Lizenz laut Recherche unklar oder '
          'ungeprüft, oder Nutzungsbedingungen schränken automatisierten oder kommerziellen Abruf ein. Signale, deren Hauptquelle nur per '
          'Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`.', '',
          '| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |', '|---|---|---|---|'] + lic_rows + ['']

# ---------------------------------------------------------------- Szenario-Eintrag
scenario = OrderedDict([
    ('id', S), ('order', research['scenario_def']['order']), ('title', 'Pandemie und Ausbrüche'),
    ('question', 'Breitet sich gerade ein gefährlicher Erreger aus?'),
    ('tagline', 'Abwasser, Arztbesuche, Krankenhäuser, Vogelgrippe, neue Virusvarianten, Medikamentenengpässe'),
    ('domains', OrderedDict([
        ('wastewater', {'title': 'Abwasser', 'weight': 1, 'plain': 'Wie viel Virus-Erbgut messen Kläranlagen?'}),
        ('clinical', {'title': 'Arztbesuche und Krankenhäuser',
                      'weight': 1, 'plain': 'Wie viele Menschen sind mit Atemwegsinfekten in Praxen und Kliniken?'}),
        ('outbreaks', {'title': 'Ausbruchsmeldungen', 'weight': 0.4,
                       'plain': 'Was melden WHO, ECDC und Africa CDC? (Aussagen von Organisationen, daher geringes Gewicht)'}),
        ('animal', {'title': 'Tierseuchen', 'weight': 0.9, 'plain': 'Vogelgrippe bei Geflügel, Wildvögeln und Rindern'}),
        ('genomic', {'title': 'Erbgut-Überwachung', 'weight': 0.8, 'plain': 'Neue Virus-Linien und Varianten'}),
        ('mortality', {'title': 'Sterbefälle', 'weight': 0.8, 'plain': 'Sterben mehr Menschen als erwartet?'}),
        ('behaviour', {'title': 'Verhalten und Versorgung', 'weight': 0.5,
                       'plain': 'Medikamentenengpässe, Reisehinweise und Krankenstand'}),
        ('markets', {'title': 'Märkte', 'weight': 0.4, 'plain': 'Aktien von Impfstoff-, Test- und Geflügelherstellern'}),
    ])),
])

# ---------------------------------------------------------------- Ausgabe
for sg in signals:
    sg.pop('_main')
    sg.pop('_srcs')
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
for x in sigs:
    if not x['id'].startswith(S + '.') or x['scenarios'] != [S]:
        errors.append('Präfix/Szenario: ' + x['id'])
    if x['domain'] not in DOM_ORDER:
        errors.append('unbekannte Domain: ' + x['id'])
    if not x.get('sourceUrl') or not x.get('collector'):
        errors.append('sourceUrl/collector fehlt: ' + x['id'])
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', x['collector']):
        errors.append('collector nicht kebab-case: ' + x['id'])
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
    if not re.search(r'[.!?]$', x['plain']) and not x['plain'].endswith('?'):
        errors.append('plain ohne Satzende: ' + x['id'])
sc = json.load(open(OUT_SCEN, encoding='utf-8'))
if len(sc['domains']) > 9 or set(sc['domains']) != set(DOMAINS):
    errors.append('Szenario-Domains: %s' % sorted(sc['domains']))
for d in DOMAINS:
    if dc[d] < 3:
        errors.append('Domain mit weniger als 3 Signalen: %s (%d)' % (d, dc[d]))
src_ids = [s['id'] for s in sources]
if len(src_ids) != len(set(src_ids)):
    errors.append('doppelte Quellen-IDs')
for s in sources:
    for x in s['signals']:
        if x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))
bdc = Counter(b['domain'] for b in build)
avail = Counter(r['domain'] for r in rows)
for d in DOMAINS + ['attention']:
    if bdc[d] < min(BUILD_MIN_PER_DOMAIN, avail[d]):
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
if len({b['collector'] for b in build}) != len(build):
    errors.append('Bau-Reihenfolge: Collector doppelt')
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d + %d != %d' % (len(sigs), merged_in, len(raw)))
for b in build:
    if b['live'] and not any('raw.githubusercontent.com' in e for e in b['endpoints']):
        errors.append('live ohne GitHub-Endpunkt: ' + b['collector'])
    if b['extends'] and b['extends'] not in BUILT:
        errors.append('extends unbekannt: ' + b['collector'])
for sg in sigs:
    for f in ('endpoint', 'auth', 'history', 'priority', 'verified', 'leadTime', 'format', 'notes', 'extends'):
        if f not in sg:
            errors.append('Feld fehlt %s: %s' % (f, sg['id']))
            break

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
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
