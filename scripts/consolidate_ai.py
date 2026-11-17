#!/usr/bin/env python3
"""Konsolidiert die Recherche zum Szenario "ai" (KI-Vorfall) zu Signal-Katalog, Szenario-Eintrag, Bau-Reihenfolge,
Quellen-Matrix sowie Schluessel- und Lizenz-Tabellen.

Aufruf:  python3 -I scripts/consolidate_ai.py [-v]   (nur Standardbibliothek)

Muster: scripts/consolidate_war.py. Das Urteil steckt in den Tabellen unten; alles andere ist Mechanik.
Schreibt ausschliesslich neue Dateien (aendert weder sources.json noch docs/*.md noch scenarios.json):
  catalog/signals/ai.json, catalog/research/ai-scenario-def.json, catalog/ai-build-order.json,
  catalog/research/ai-sources.json, catalog/research/ai-keys.md, catalog/research/ai-license-todo.md
"""
import json
import os
import re
import sys
from collections import OrderedDict, Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, 'catalog')
RES = os.path.join(CAT, 'research')
IN_RESEARCH = os.path.join(RES, 'ai-all.json')
OUT_SIGNALS = os.path.join(CAT, 'signals', 'ai.json')
OUT_SCEN = os.path.join(RES, 'ai-scenario-def.json')
OUT_BUILD = os.path.join(CAT, 'ai-build-order.json')
OUT_SOURCES = os.path.join(RES, 'ai-sources.json')
OUT_KEYS = os.path.join(RES, 'ai-keys.md')
OUT_LIC = os.path.join(RES, 'ai-license-todo.md')
SIG_DIR = os.path.join(CAT, 'signals')
SC = 'ai'

# Domains des Szenarios (Recherche: "research" enthaelt nur Klasse-D-Signale und faellt deshalb weg, siehe NOTE_DROPPED)
DOMAINS = ['platforms', 'supply_chain', 'agents', 'incidents', 'compute', 'markets']
EXTRA_DOMAINS = ['attention', 'context']
BUILD_N = 20
BUILD_MIN_PER_DOMAIN = 2
C_CAP = 0.2   # Klasse C (Aussagen, Behoerden-/Firmenberichte, auch als CSV): hoechstens 0,2
LIVE_HOSTS = ('raw.githubusercontent.com', 'pypi.org', 'registry.npmjs.org')

# ---------------------------------------------------------------- Tabellen (Urteil)

# Quell-IDs, die dieselbe Quelle meinen -> kanonische ID (bevorzugt die ID aus catalog/sources.json)
ALIAS = {
    'github-advisories': 'ghsa', 'github-search': 'github-rest', 'nvd': 'nvd-cve-api', 'osv-dev': 'osv',
    'reddit': 'reddit-json', 'statuspage': 'statuspage-hosts', 'pypi-xmlrpc': 'pypi', 'pypi-rss': 'pypi',
    'pypi-json': 'pypi', 'cf-radar': 'cf-radar',
}
# kanonische Quell-ID -> Collector-ID, wo der (gebaute oder geplante) Collector anders heisst
COLLECTOR = {'cf-radar': 'cloudflare-radar', 'cvelist-v5': 'cvelist-delta', 'statuspage-hosts': 'statuspage',
             'nvd-cve-api': 'nvd-cve', 'reddit-json': 'reddit', 'ghsa': 'github-advisories',
             'github-rest': 'github-search'}
# Umgebungsvariable je Dienst, wo ein Collector schon eine feste hat
ENV_FIXED = {'cf-radar': 'SR_CLOUDFLARE_KEY', 'urlhaus': 'SR_ABUSECH_KEY'}

# Duplikate: Slug -> Slug des fuehrenden Eintrags
MERGE = {
    'ai_provider_major_incident': 'ai_provider_status_share',   # gleiche Statusseiten, nur anderer Schwellenwert
    'cve_ai_share': 'cve_ai_keywords',                           # Anteil ist nur die Normierung derselben Zaehlung
    'ghsa_malware_count': 'osv_malware_ai',                      # GitHub-Advisories sind eine Teilmenge der OSV-Malware-Meldungen
    'agent_traffic_by_operator': 'ai_crawler_share',             # gleiche Cloudflare-Radar-Reihe, nur nach Betreiber aufgeteilt
}

# Hauptquelle explizit (sonst: bester Zugang, bei Gleichstand Reihenfolge der Recherche)
MAIN = {'prediction_ai_incident': 'polymarket-gamma', 'osv_malware_ai': 'ossf-malicious',
        'cve_ai_keywords': 'cvelist-v5', 'kev_ai_products': 'cisa-kev', 'gpu_rental_price': 'vast-ai'}

# Endpunkt einer Recherche-Quelle korrigieren (am 17.11.2026 per curl geprueft)
ENDPOINT_FIX = {
    ('kev_ai_products', 'cisa-kev'): {
        'endpoint': 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json',
        'verified': True, 'history': 'dateAdded je Eintrag (1781 Eintraege)', 'license': 'CC0 1.0 (Spiegel cisagov/kev-data)',
        'sample_note': 'Spiegel des CISA-KEV-Katalogs, 1,8 MB; Feld vulnerabilities[].vendorProject/product auf KI-Produkte filtern, '
                       'Zaehlung nach dateAdded. Originalquelle: cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json.'},
    ('cve_ai_keywords', 'cvelist-v5'): {
        'endpoint': 'https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/deltaLog.json',
        'verified': True, 'history': '30 Tage deltaLog; Einzeldatei je CVE mit Titel und Beschreibung',
        'sample_note': 'deltaLog.new[].githubLink fuehrt zur Einzeldatei (containers.cna.title und descriptions), dort nach KI-Begriffen '
                       'filtern; Aufwand: eine Anfrage je neue CVE. Einzeldatei CVE-2025-3248 (Langflow RCE) am 17.11.2026 geprueft.'},
}
# Zusaetzliche Quellen, die nur im GitHub-Datensatzverzeichnis stehen: (Slug, Quelle)
EXTRA_SOURCES = {
    'inference_cost_listing': [{
        'source_id': 'litellm-github', 'name': 'LiteLLM Modell- und Preisliste (GitHub)',
        'doc_url': 'https://github.com/BerriAI/litellm',
        'endpoint': 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
        'access': 'download', 'format': 'json', 'auth': 'none', 'cost': 'free',
        'update_latency': 'mehrmals taeglich (Commits)',
        'history': 'Nur Gegenwart in der Datei; Git-Verlauf nicht geprueft', 'rate_limit': 'unbekannt', 'license': 'MIT',
        'verified': True,
        'sample_note': 'Objekt je Modell mit input_cost_per_token, output_cost_per_token, litellm_provider; 4,1 MB, 6036 Eintraege am '
                       '17.11.2026; neuester Modellname mit Datum 29.09.2026, Aenderungsdatum der Datei nicht pruefbar.'}],
}
# Aktuell bzw. erreichbar geprueft am 17.11.2026 (nur Hosts aus LIVE_HOSTS zaehlen als "live")
LIVE_CURRENT = {
    'pypi': 'XML-RPC changelog_last_serial liefert 43761231 (0,2 kB); rss/packages.xml: neuester Eintrag 17.11.2026 00:59 GMT; '
            'pypi/litellm/json: letzter Upload 16.11.2026 21:57 UTC',
    'npm-registry': 'Suche keywords:mcp mit size=3 (3,9 kB), updated 16.11.2026; Paket langchain: letzte Version 13.11.2026',
    'cvelist-v5': 'deltaLog.json: fetchTime 16.11.2026 23:36 UTC',
    'cisa-kev': 'Spiegel cisagov/kev-data: dateReleased 13.11.2026, 1781 Eintraege',
}
# erreichbar, aber Aktualitaet nicht belegbar oder Daten veraltet (Hinweis in notes/uncertainty)
SOURCE_NOTE = {
    'ai-robots-txt': 'robots.json am 17.11.2026 erreichbar (HTTP 200, 92 kB, 208 Eintraege), Datei ohne Zeitstempel: Aktualitaet nicht pruefbar '
                     '(Commits-API fuer das Repo war in der Pruef-Umgebung gesperrt).',
    'mitre-atlas': 'dist/ATLAS.yaml ist laut Kopfzeile veraltet ("deprecated, no longer being updated", Version 5.6.0); neuere Daten '
                   'liegen laut Kopfzeile im Repo-Hauptverzeichnis, dort nicht geprueft.',
    'ossf-malicious': 'Nur README per raw geprueft (HTTP 200); Einzeldateien liegen unter osv/malicious/<oekosystem>/<paket>/, raw bietet keine '
                      'Verzeichnisliste: Zaehlung braucht Git-Tree-API oder Statistikdatei, in der Pruef-Umgebung nicht geprueft.',
    'pypi': 'XML-RPC ist ein POST mit XML-Body; Paket-JSON ist gross (litellm 2,4 MB).',
}
# Was ein vorhandener Collector fuer dieses Szenario ergaenzen muss
EXT_WHAT = {
    'cvelist-delta': 'je CVE aus deltaLog.new[] die Einzeldatei laden und Titel/Beschreibung nach KI-Begriffen filtern (z. B. langchain, ollama, '
                     'vllm, langflow, mlflow, pytorch, transformers, mcp); neue Signale ai.supply_chain.cve_ai_keywords',
    'cisa-kev': 'Neuaufnahmen nach vendorProject/product auf KI-Frameworks filtern (Langflow, Ray, Ollama, MLflow u. a.); Spiegel '
                'cisagov/kev-data auf raw.githubusercontent.com nutzbar; Signal ai.supply_chain.kev_ai_products',
    'statuspage': 'status.huggingface.co in catalog/statuspage-hosts.json aufnehmen (Host-Typ ungeprueft, evtl. Instatus) und Kategorie ai fuer '
                  'OpenAI/Anthropic (stehen schon in der Liste) einfuehren; Signale ai.platforms.* und ai.compute.cloud_ai_regional_status',
    'first-epss': 'EPSS-Wert und Perzentil fuer CVE-IDs mit KI-Bezug (aus cvelist-delta) abrufen; Signal ai.supply_chain.epss_ai_cves',
    'sans-isc': 'portdetails fuer Ports typischer Modell-Server (z. B. 11434) ergaenzen; Signal ai.agents.honeypot_llm_probes',
    'hn-algolia': 'Suchbegriffe fuer KI-Sicherheit ergaenzen (prompt injection, jailbreak, rogue agent u. a.); Signal ai.incidents.hn_ai_security_stories',
    'gdelt-doc': 'KI-Begriffe ergaenzen ("AI agent" mit breach/rogue u. a.); Signal ai.incidents.ai_news_volume',
    'polymarket-gamma': 'Suchbegriffe fuer KI-Vorfaelle ergaenzen; Signal ai.markets.prediction_ai_incident',
    'yahoo-chart': 'Symbolgruppe KI-Aktien (z. B. NVDA, CRWV) und Cyber-ETF (CIBR) ergaenzen; Signale ai.markets.*_stock_*',
    'sec-edgar': 'Volltextsuche in 8-K/10-Q nach KI-Begriffen (z. B. "autonomous agent") ergaenzen; Signal ai.markets.ai_sec_8k',
    'ransomware-live': 'Opfer mit KI-Bezug (Branche/Name) filtern; Signal ai.markets.ai_ransomware_victims',
    'wikimedia-pageviews': 'Artikelliste um KI-Seiten (z. B. Hugging_Face) erweitern; Signal ai.attention.ai_attention_wiki',
    'cloudflare-radar': 'Endpunkte radar/ai/bots/* (Crawler-Anteil, Crawl-to-Refer) und Layer-7-Angriffe ergaenzen; Key SR_CLOUDFLARE_KEY',
    'urlhaus': 'Host-Abfrage fuer huggingface.co ergaenzen; Key SR_ABUSECH_KEY; Signal ai.platforms.hf_malware_hosting',
}

# Recherche-Segment -> Ziel-Domain (Klasse D geht immer nach attention), Einzel-Overrides danach
DOMAIN_OVERRIDE = {'context_release_calendar': 'context'}
EVIDENCE_OVERRIDE = {}
DIRECTION_OVERRIDE = {}
# Quellen, deren Zugang laut Recherche/Nutzungsbedingungen eher Scraping mit unklarer Lizenz ist
LICENSE_UNCLEAR_SOURCES = {'oecd-aim'}

WEIGHT = {
    # platforms
    'hf_unsafe_flags': 0.7, 'hf_malware_hosting': 0.65, 'hf_new_models_rate': 0.6, 'hf_new_account_share': 0.6,
    'hf_lookalike_certs': 0.55, 'ai_provider_status_share': 0.55, 'hf_download_spike': 0.5, 'hf_new_datasets_rate': 0.5,
    'hf_new_spaces_rate': 0.5, 'hf_status_incidents': 0.5, 'model_registry_ci_status': 0.3, 'hf_domain_rank': 0.3,
    'hf_blog_security_policy': 0.2,
    # supply_chain
    'osv_malware_ai': 0.85, 'kev_ai_products': 0.85, 'pypi_ai_yanks_removals': 0.8, 'pypi_ai_name_typosquats': 0.75,
    'pypi_ai_maintainer_changes': 0.75, 'pypi_ai_release_burst': 0.7, 'npm_ai_version_burst': 0.65,
    'cve_ai_keywords': 0.6, 'ai_exposed_servers': 0.6, 'npm_ai_new_packages': 0.55, 'epss_ai_cves': 0.55,
    'mcp_repo_growth': 0.5, 'pypi_new_projects_rate': 0.4, 'pypi_serial_rate': 0.35, 'atlas_techniques': 0.1,
    # agents
    'ai_crawler_share': 0.7, 'greynoise_ai_tags': 0.65, 'github_bot_commits_share': 0.6, 'github_agent_pr_rate': 0.6,
    'honeypot_llm_probes': 0.6, 'llm_api_error_rate': 0.6, 'ai_crawl_to_refer': 0.55, 'openrouter_token_volume': 0.55,
    'ai_user_agent_new_entries': 0.5, 'github_agent_coauthor_commits': 0.5, 'agent_framework_downloads': 0.5,
    'agent_ddos_layer7': 0.45, 'bot_traffic_share_total': 0.4,
    # incidents
    'mandatory_incident_reports': 0.5, 'metr_agent_incidents': 0.2, 'incident_vendor_reports': 0.2,
    'mit_risk_repo_entries': 0.1,
    # compute
    'gpu_rental_price': 0.5, 'gpu_marketplace_availability': 0.45, 'datacenter_load_ercot': 0.4,
    'datacenter_load_pjm': 0.4, 'cloud_ai_regional_status': 0.4, 'inference_cost_listing': 0.3,
    'ai_traffic_domain_rank': 0.3,
    # markets
    'prediction_ai_incident': 0.6, 'ai_sec_8k': 0.55, 'ai_ransomware_victims': 0.5, 'cyber_stock_ai_events': 0.4,
    'ai_stock_volume': 0.3,
    # attention (Klasse D: 0,3 bis 0,7)
    'aiid_incident_count': 0.7, 'oecd_aim_incidents': 0.7, 'oecd_aim_hazard_share': 0.55, 'hn_ai_security_stories': 0.5,
    'ai_attention_wiki': 0.45, 'ai_news_volume': 0.4, 'ai_local_community_activity': 0.4, 'arxiv_agent_escape': 0.4,
    'arxiv_self_replication': 0.4, 'arxiv_jailbreak': 0.35, 'arxiv_ai_security_total': 0.3, 'arxiv_deception_eval': 0.3,
    'hf_daily_papers': 0.3, 'ai_commoncrawl_size': 0.3,
    # context
    'context_release_calendar': 0.0,
}

# Messart und Einheit (Slug -> (kind, unit)); Rest: ('count', 'Anzahl')
KIND_UNIT = {
    'hf_new_models_rate': ('count', 'Modelle/Stunde'), 'hf_new_datasets_rate': ('count', 'Datensaetze/Stunde'),
    'hf_new_spaces_rate': ('count', 'Spaces/Stunde'), 'hf_new_account_share': ('gauge', '%'),
    'hf_download_spike': ('count', 'Downloads'), 'hf_unsafe_flags': ('count', 'Modelle'),
    'hf_status_incidents': ('count', 'Meldungen'), 'ai_provider_status_share': ('gauge', '%'),
    'model_registry_ci_status': ('gauge', '%'), 'hf_domain_rank': ('gauge', 'Rang'),
    'hf_lookalike_certs': ('count', 'Zertifikate'), 'hf_malware_hosting': ('count', 'URLs'),
    'hf_blog_security_policy': ('count', 'Beitraege'),
    'pypi_serial_rate': ('rate', 'Ereignisse/Stunde'), 'pypi_new_projects_rate': ('count', 'Projekte/Stunde'),
    'pypi_ai_name_typosquats': ('count', 'Projekte'), 'pypi_ai_yanks_removals': ('count', 'Releases'),
    'pypi_ai_maintainer_changes': ('count', 'Aenderungen'), 'pypi_ai_release_burst': ('count', 'Releases/Stunde'),
    'npm_ai_new_packages': ('count', 'Pakete/Tag'), 'npm_ai_version_burst': ('count', 'Versionen/Stunde'),
    'osv_malware_ai': ('count', 'Meldungen'), 'cve_ai_keywords': ('count', 'CVEs'), 'kev_ai_products': ('count', 'Eintraege'),
    'epss_ai_cves': ('gauge', 'EPSS'), 'ai_exposed_servers': ('gauge', 'Server'), 'mcp_repo_growth': ('count', 'Repos/Woche'),
    'atlas_techniques': ('count', 'Techniken'),
    'ai_crawler_share': ('gauge', '%'), 'ai_crawl_to_refer': ('gauge', 'Verhaeltnis'),
    'ai_user_agent_new_entries': ('count', 'Eintraege'), 'github_bot_commits_share': ('gauge', '%'),
    'github_agent_pr_rate': ('count', 'Pull Requests/Tag'), 'github_agent_coauthor_commits': ('count', 'Commits/Tag'),
    'honeypot_llm_probes': ('count', 'Reports'), 'greynoise_ai_tags': ('count', 'Tags'),
    'llm_api_error_rate': ('gauge', '%'), 'openrouter_token_volume': ('count', 'Token'),
    'agent_framework_downloads': ('count', 'Downloads'), 'agent_ddos_layer7': ('count', 'Angriffe'),
    'bot_traffic_share_total': ('gauge', '%'),
    'aiid_incident_count': ('count', 'Vorfaelle'), 'oecd_aim_incidents': ('count', 'Meldungen'),
    'oecd_aim_hazard_share': ('gauge', '%'), 'metr_agent_incidents': ('count', 'Vorfaelle'),
    'mit_risk_repo_entries': ('count', 'Eintraege'), 'incident_vendor_reports': ('count', 'Berichte'),
    'mandatory_incident_reports': ('count', 'Meldungen'), 'ai_news_volume': ('gauge', 'Anteil'),
    'hn_ai_security_stories': ('count', 'Beitraege'),
    'gpu_rental_price': ('gauge', 'USD/Stunde'), 'gpu_marketplace_availability': ('gauge', 'Angebote'),
    'datacenter_load_ercot': ('gauge', 'MW'), 'datacenter_load_pjm': ('gauge', 'MW'),
    'inference_cost_listing': ('gauge', 'USD/Mio. Token'), 'cloud_ai_regional_status': ('gauge', '%'),
    'ai_traffic_domain_rank': ('gauge', 'Rang'),
    'arxiv_agent_escape': ('count', 'Papers/Woche'), 'arxiv_jailbreak': ('count', 'Papers/Woche'),
    'arxiv_self_replication': ('count', 'Papers/Woche'), 'arxiv_ai_security_total': ('count', 'Papers/Woche'),
    'arxiv_deception_eval': ('count', 'Papers/Woche'), 'hf_daily_papers': ('count', 'Papers/Tag'),
    'prediction_ai_incident': ('gauge', '%'), 'ai_stock_volume': ('gauge', 'Handelsvolumen'),
    'cyber_stock_ai_events': ('gauge', 'Handelsvolumen'), 'ai_sec_8k': ('count', 'Meldungen'),
    'ai_ransomware_victims': ('count', 'Opfer'), 'ai_attention_wiki': ('count', 'Aufrufe/Tag'),
    'ai_local_community_activity': ('gauge', 'Nutzer online'), 'ai_commoncrawl_size': ('count', 'Seiten'),
    'context_release_calendar': ('count', 'Beitraege'),
}
# Abrufintervall in Minuten, wo die Quelle schneller aktualisiert als sinnvoll abgefragt wird
INTERVAL_OVERRIDE = {'hf_new_models_rate': 60, 'hf_new_datasets_rate': 60, 'hf_new_spaces_rate': 60, 'hf_unsafe_flags': 1440,
                     'hf_new_account_share': 1440, 'hf_download_spike': 1440, 'pypi_serial_rate': 15, 'pypi_new_projects_rate': 60,
                     'pypi_ai_release_burst': 60, 'npm_ai_version_burst': 60, 'honeypot_llm_probes': 1440,
                     'prediction_ai_incident': 60, 'ai_stock_volume': 1440, 'cyber_stock_ai_events': 1440,
                     'hn_ai_security_stories': 60, 'llm_api_error_rate': 60, 'datacenter_load_ercot': 60,
                     'datacenter_load_pjm': 60, 'ai_ransomware_victims': 360, 'ai_sec_8k': 360,
                     'arxiv_agent_escape': 10080, 'arxiv_jailbreak': 10080, 'arxiv_self_replication': 10080,
                     'arxiv_ai_security_total': 10080, 'arxiv_deception_eval': 10080, 'mcp_repo_growth': 10080,
                     'ai_commoncrawl_size': 43200, 'ai_crawl_to_refer': 10080, 'bot_traffic_share_total': 10080}
ROLLING_DOMAINS = {'markets', 'compute', 'attention', 'context'}

# Antwortgroesse: Quellen, deren Antwort bekannt oder wahrscheinlich ueber 6000 Zeichen liegt
BIG_SOURCES = {'cvelist-v5', 'cisa-kev', 'gharchive', 'ai-robots-txt', 'mitre-atlas', 'osv', 'ossf-malicious', 'litellm-github',
               'commoncrawl'}

# Umlaut-Korrektur (aus consolidate_war.py), Ausnahmen um KI-Vokabular ergaenzt
UMLAUT_KEEP = {'aktuell', 'aktuelle', 'aktuellen', 'aktueller', 'zuerst', 'israel', 'michael', 'cboe', 'tuesday', 'issues',
               'issue', 'issued', 'true', 'value', 'values', 'due', 'fuel', 'does', 'goes', 'virtuell', 'manuell',
               'eventuell', 'individuell', 'continue', 'revenue', 'venue', 'queue', 'boe', 'blue', 'league', 'avenue',
               'statue', 'residue', 'cruel', 'duel', 'fluent', 'queen', 'queens', 'question', 'sequence', 'frequency',
               'oecd', 'poe', 'joe', 'ae', 'ue', 'oe', 'gnss', 'visuell', 'visuelle', 'visuellen', 'israeli', 'tue',
               'reuters', 'nuevo', 'openai', 'blog', 'blogs', 'typosquats', 'metaculus', 'sandbox', 'bluesky',
               'fileswithissues', 'guess', 'guest', 'phoenix', 'samuel', 'crowd', 'prompt', 'inference', 'releases', 'release',
               'dataset', 'datasets', 'feeds', 'feed', 'rogue', 'queries', 'query', 'quantisierungen', 'duenn'}
WORD_FIX = {}
SZ = [('grösse', 'größe'), ('grösst', 'größt'), ('gross', 'groß'), ('heisst', 'heißt'), ('ausmass', 'ausmaß'),
      ('ausserhalb', 'außerhalb'), ('ausserplanm', 'außerplanm'), ('aussergew', 'außergew'), ('ausser', 'außer'),
      ('aussen', 'außen'), ('mässig', 'mäßig'), ('massnahm', 'maßnahm'), ('strasse', 'straße'),
      ('schliess', 'schließ'), ('fliess', 'fließ'), ('schiess', 'schieß'), ('regelmässig', 'regelmäßig'),
      ('weiss', 'weiß'), ('stoss', 'stoß'), ('bloss', 'bloß'), ('fuss', 'fuß')]

# Laien-Texte, wo die Recherche nur Stichworte liefert oder ein Satz zu ungenau ist
PLAIN = {
    'context_release_calendar': 'Zeigt, wann grosse KI-Labore neue Modelle veroeffentlichen; solche Termine erklaeren Spitzen bei Uploads und Abrufen und werden herausgerechnet.',
}
NAME = {}

# ---------------------------------------------------------------- Helfer (aus consolidate_war.py)
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
    parts = re.split(r'(https?://\S+|`[^`]*`|[\w.-]+\.(?:json|csv|geojson|xml|zip|yaml))', text)
    return ''.join(p if i % 2 else re.sub(r'[A-Za-zÄÖÜäöüß]+', lambda m: fix_word(m.group(0)), p)
                   for i, p in enumerate(parts))


def canon(sid):
    return ALIAS.get(sid, sid)


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
    s = 0.0
    if is_stream(src):
        s += 0.5
    if src.get('format') in ('xml', 'yaml', 'html'):
        s += 0.5
    return s


def lic_unclear(lic):
    return bool(re.search(r'unklar|pr(ü|ue)f|\?', lic or '', re.I))


def lic_restrictive(lic):
    return bool(re.search(r'verbiet|kein scrap|eingeschr|inoffiz|urheberrecht|nicht-?komm|kommerz|\bnc\b|-nc|propriet', lic or '', re.I))


NEG_HIST = re.compile(r'keine|nur live|nur aktuell|nur gegenwart|selbst|gering|unbekannt|unklar|eingeschr|begrenzt|'
                      r'feed-fenster|letzte|webseite|kurz|nur feed', re.I)


def has_history(src):
    h = src.get('history') or ''
    return bool(h) and not NEG_HIST.search(h)


def interval_from(lat):
    t = (lat or '').lower()
    rules = [
        (r'monate', 43200), (r'j(ä|ae)hrlich', 525600), (r'quartal', 129600), (r'monatlich', 43200),
        (r'w(ö|oe)chentlich|^wochen', 10080),
        (r'(ä|ae)glich|tagesende|^tage|~1 tag|^1 tag|stunden bis tage|minuten bis tage', 1440),
        (r'3 h', 180), (r'st(ü|ue)ndlich|^stunden|1 ?h\b|^1 h', 60),
        (r'unregelm|unbekannt|laufend|bei (ä|ae)nderung', 60),
        (r'5 min', 15), (r'sekunden|echtzeit|1 min', 15), (r'minuten', 15),
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


def slug_of(s):
    return s['id'].split('.')[-1]


def seg_of(s):
    return s['id'].split('.')[1]


def collector_of(sid):
    return COLLECTOR.get(sid, sid)


def host_live(ep):
    return any(h in (ep or '') for h in LIVE_HOSTS)


# ---------------------------------------------------------------- Einlesen
research = json.load(open(IN_RESEARCH, encoding='utf-8'))
raw = research['signals']
rdef = research['scenario_def']
BUILT = built_collectors()
existing_sources = {s['id']: s for s in json.load(open(os.path.join(CAT, 'sources.json'), encoding='utf-8'))}
other_ids = set()
for f in os.listdir(SIG_DIR):
    if f.endswith('.json') and f != 'ai.json':
        other_ids |= {x['id'] for x in json.load(open(os.path.join(SIG_DIR, f), encoding='utf-8'))}

variants = defaultdict(list)   # kanonische Quell-ID -> Varianten
for s in raw:
    sl = slug_of(s)
    srcs = [dict(x) for x in s['sources']] + [dict(x) for x in EXTRA_SOURCES.get(sl, [])]
    keep = []
    for src in srcs:
        fix = ENDPOINT_FIX.get((sl, src['source_id']))
        if fix:
            src.update(fix)
        src['_orig_id'] = src['source_id']
        src['source_id'] = canon(src['source_id'])
        keep.append(src)
        variants[src['source_id']].append(src)
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
def make_signal(sl, s):
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
    sid = main['source_id']
    alt = list(dict.fromkeys(x['source_id'] for x in srcs if x['source_id'] != sid))
    direction = DIRECTION_OVERRIDE.get(sl, s['direction'])
    if direction not in ('up', 'down', 'both'):
        direction = 'both'
    w = WEIGHT[sl]
    if ev == 'C':
        w = min(w, C_CAP)
    if ev == 'D' and dom == 'attention':
        w = max(0.3, min(0.7, w))
    if dom == 'context':
        w = 0.0
    lic = main.get('license') or 'unklar'
    if not is_free(main):
        status = 'needs-key'
    elif (lic_unclear(lic) and main.get('access') == 'scrape') or sid in LICENSE_UNCLEAR_SOURCES:
        status = 'license-unclear'
    else:
        status = 'planned'
    iv = INTERVAL_OVERRIDE.get(sl) or max(15, interval_from(main.get('update_latency')))
    kind, unit = KIND_UNIT[sl]
    coll = collector_of(sid)
    ext = coll if coll in BUILT else None
    notes = []
    if s.get('notes'):
        notes.append(de(s['notes']))
    if s['_merged']:
        notes.append('Zusammengeführt aus: ' + ', '.join(s['_merged']) + '.')
    if alt:
        notes.append('Alternative Quellen: ' + ', '.join(alt) + '.')
    if sid in LIVE_CURRENT:
        notes.append('Geprüft am 17.11.2026: ' + de(LIVE_CURRENT[sid]) + '.')
    if sid in SOURCE_NOTE:
        notes.append(de(SOURCE_NOTE[sid]))
    if ev == 'C':
        notes.append('Klasse C: Aussage bzw. Bericht einer Behörde, Firma oder Organisation, nicht unabhängig prüfbar; Gewicht höchstens %.1f.' % C_CAP)
    if dom == 'context':
        notes.append('Reiner Störfaktor-Filter, Gewicht 0.')
    if ext:
        notes.append('Erweitert vorhandenen Collector %s: %s.' % (ext, de(EXT_WHAT.get(ext, 'neue Begriffe/Symbole/Endpunkte ergänzen'))))
    if main.get('sample_note'):
        notes.append('Messfeld laut Recherche: ' + de(main['sample_note']))
    lead = s.get('lead_time') if s.get('lead_time') in ('minutes', 'hours', 'days', 'weeks', 'coincident', 'lagging') else 'coincident'
    sig = OrderedDict([
        ('id', '%s.%s.%s' % (SC, dom, sl)), ('scenarios', [SC]), ('domain', dom),
        ('name', de(NAME.get(sl, s['name_de']))), ('plain', de(PLAIN.get(sl, s['plain_de']))),
        ('evidenceClass', ev), ('direction', direction), ('kind', kind), ('weight', round(w, 2)),
        ('manipulability', s['manipulability'] if s['manipulability'] in ('low', 'medium', 'high') else 'medium'),
        ('independenceGroup', sid), ('collector', coll), ('unit', de(unit)),
        ('baseline', baseline_for(iv, dom)), ('intervalMinutes', iv), ('status', status),
        ('sourceName', de(main.get('name'))), ('sourceUrl', main.get('doc_url')), ('license', de(lic)),
        ('rationale', de(s.get('rationale'))), ('banalCauses', [de(b) for b in s['banal_causes']]),
        ('endpoint', main.get('endpoint')), ('auth', main.get('auth')), ('history', de(main.get('history'))),
        ('priority', s['priority']), ('verified', bool(main.get('verified'))), ('leadTime', lead),
        ('format', main.get('format')), ('notes', ' '.join(notes)), ('extends', ext),
    ])
    if sl == 'pypi_serial_rate':
        sig['transform'] = 'rate'
    sig['_main'] = main
    sig['_all_src'] = [x['source_id'] for x in srcs]
    return sig


signals = [make_signal(sl, s) for sl, s in by_slug.items()]
DOM_ORDER = DOMAINS + EXTRA_DOMAINS
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
    best = min(vs, key=lambda v: (access_score(v), v.get('format') not in ('json', 'csv'), v not in exact, not v.get('verified')))
    eps = list(dict.fromkeys(v['endpoint'] for v in vs if v.get('endpoint')))
    ex = existing_sources.get(sid)
    sources.append(OrderedDict([
        ('id', sid), ('name', de(best.get('name'))), ('docUrl', best.get('doc_url')), ('endpoints', eps),
        ('access', best.get('access')), ('format', best.get('format')), ('auth', best.get('auth')),
        ('cost', best.get('cost')), ('updateLatency', de(best.get('update_latency'))),
        ('history', de(best.get('history'))), ('rateLimit', de(best.get('rate_limit'))),
        ('license', de(best.get('license'))), ('verified', any(v.get('verified') for v in vs)),
        ('aliases', sorted({v['_orig_id'] for v in vs} - {sid})),
        ('collector', collector_of(sid)), ('signals', sig_by_src.get(sid, [])), ('scenarios', [SC]),
    ]))
src_index = {s['id']: s for s in sources}

# ---------------------------------------------------------------- Bau-Reihenfolge
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

BUILD_DOMAINS = DOMAINS + ['attention']
rows = []
for cid, c in coll.items():
    mains = c['mains']
    live = any(m['source_id'] in LIVE_CURRENT and host_live(m.get('endpoint')) and bool(m.get('verified')) for m in mains)
    ext = cid if cid in BUILT else None
    small = any(m.get('format') in ('json', 'csv') and m.get('access') in ('api', 'download') and not is_stream(m)
                and is_free(m) and m['source_id'] not in BIG_SOURCES for m in mains)
    hist = any(has_history(m) for m in mains)
    dom = c['domains'].most_common(1)[0][0] if c['domains'] else 'context'
    forbid = any(re.search(r'verbiet|kein scrap', m.get('license') or '', re.I) for m in mains)
    rows.append({'collector': cid, 'domain': dom, 'live': live, 'extends': ext, 'keyfree': c['keyfree'], 'small': small,
                 'hist': hist, 'value': c['maxw'], 'c': c,
                 'key': (not live, ext is None, not c['keyfree'], forbid, not small, not hist, -c['maxw'], cid)})
rows.sort(key=lambda r: r['key'])

chosen = []
for d in BUILD_DOMAINS:
    for r in [r for r in rows if r['domain'] == d][:BUILD_MIN_PER_DOMAIN]:
        if r not in chosen:
            chosen.append(r)
for r in rows:
    if len(chosen) >= BUILD_N:
        break
    if r not in chosen and r['domain'] != 'context':
        chosen.append(r)
if len(chosen) > BUILD_N:   # Mindestquote darf die Liste nicht sprengen: schwächste Zusatzeinträge streichen
    chosen = sorted(chosen, key=lambda r: r['key'])[:BUILD_N]
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
        if sid in SOURCE_NOTE:
            unc.append(de(SOURCE_NOTE[sid]))
    lic = s0.get('license') or 'unklar'
    if lic_unclear(lic) or lic_restrictive(lic):
        unc.append('Lizenz: ' + lic)
    rl = s0.get('rateLimit')
    if rl and rl not in ('unklar', 'unbekannt'):
        unc.append('Rate-Limit: ' + rl)
    why = []
    if r['live']:
        why.append('Quelle auf %s, aktuell verifiziert (%s)' % (', '.join(h for h in LIVE_HOSTS if any(h in (m.get('endpoint') or '') for m in c['mains'])),
                                                          '; '.join(de(LIVE_CURRENT[s]) for s in srcs_ids if s in LIVE_CURRENT)))
    if r['extends']:
        why.append('erweitert bestehenden Collector %s' % r['extends'])
    why.append('ohne Key, kostenlos' if r['keyfree'] else 'braucht Key/Konto')
    why.append('kleine %s-Antwort' % (s0.get('format') or '').upper() if r['small'] else 'Antwort groß oder Format/Zugang aufwändiger')
    why.append('Historie: ' + (s0.get('history') or '') if r['hist'] else 'keine API-Historie, Baseline muss erst wachsen')
    why.append('max. Gewicht %.2f, %d Signal(e)' % (r['value'], len(c['signals'])))
    build.append(OrderedDict([
        ('rank', i), ('collector', r['collector']), ('domain', r['domain']), ('signals', c['signals']),
        ('endpoints', eps), ('format', s0.get('format')), ('history', r['hist']), ('verified', ver),
        ('live', r['live']), ('extends', r['extends']),
        ('extendsAdd', de(EXT_WHAT.get(r['extends'], 'neue Begriffe/Symbole/Endpunkte ergänzen')) if r['extends'] else None),
        ('uncertainty', '; '.join(unc)), ('why', '; '.join(why)),
    ]))


# ---------------------------------------------------------------- Szenario-Eintrag
def md_cell(t):
    return (t or '').replace('|', '/').replace('\n', ' ')


NOTE_DROPPED = ('Domain "research" der Recherche entfällt: alle ihre Signale sind Klasse D und liegen in attention; '
                'sie hätte als Domain keine eigene Messung.')
dom_n = Counter(sg['domain'] for sg in signals)
scenario = OrderedDict([
    ('id', SC), ('order', rdef['order']), ('title', de(rdef['title'])),
    ('question', 'Gerät gerade ein KI-System außer Kontrolle oder wird es massenhaft missbraucht?'),
    ('tagline', 'Modell-Plattformen, Schadpakete, Agenten-Verkehr, Vorfall-Datenbanken, Rechenleistung'),
    ('domains', OrderedDict([(d, OrderedDict([('title', de(rdef['domains'][d]['title'])), ('weight', rdef['domains'][d]['weight']),
                                              ('plain', de(rdef['domains'][d]['plain']))])) for d in DOMAINS])),
])


# ---------------------------------------------------------------- Schluessel- und Lizenz-Tabellen
sig_main_cnt = Counter(sg['independenceGroup'] for sg in signals if sg['status'] == 'needs-key')
key_rows = []
for s in sources:
    vs = variants[s['id']]
    if not (any(not is_free(v) for v in vs) or sig_main_cnt[s['id']]):
        continue
    mine = [sg for sg in signals if sg['independenceGroup'] == s['id']]
    names = [sg['name'] for sg in mine] or ['nur Alternativquelle für: ' + ', '.join(x.split('.')[-1] for x in s['signals'][:3])]
    alt = len(s['signals']) - len(mine)
    cnt = '%d' % sig_main_cnt[s['id']] + (' (+%d als Alternative)' % alt if alt > 0 else '')
    v_need = next((v for v in vs if not is_free(v)), vs[0])
    env = ENV_FIXED.get(s['id']) or 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', s['id'].upper())
    auth = {'free-key': 'kostenloser Key/Konto', 'paid': 'bezahlt', 'none': 'teilweise Konto'}.get(v_need.get('auth'), v_need.get('auth'))
    key_rows.append('| %s | %s | %s (%s) | %s | `%s` | %s |' % (
        md_cell(s['name']), md_cell('; '.join(names[:4]) + (' …' if len(names) > 4 else '')),
        md_cell(v_need.get('cost')), auth, s['docUrl'], env, cnt))
keys_md = ['# Benötigte Keys, Konten und Bezahlzugänge (Szenario ai)', '',
           'Automatisch erzeugt von `scripts/consolidate_ai.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen '
           '(z. B. Cloudflare Radar, abuse.ch, GitHub), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als '
           'Fehler gewertet.', '',
           '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |',
           '|---|---|---|---|---|---|'] + key_rows + ['']

lic_rows = []
for s in sources:
    lic = s.get('license') or 'unklar'
    if not (lic_unclear(lic) or lic_restrictive(lic) or s['id'] in LICENSE_UNCLEAR_SOURCES):
        continue
    flag = ' (Status license-unclear)' if any(sg['status'] == 'license-unclear' and sg['independenceGroup'] == s['id'] for sg in signals) else ''
    lic_rows.append('| %s | %s%s | %s | %s |' % (md_cell(s['name']), s.get('access'), flag, md_cell(lic), s['docUrl']))
lic_md = ['# Lizenz noch klären (Szenario ai)', '',
          'Automatisch erzeugt von `scripts/consolidate_ai.py`. Kriterien wie `docs/LICENSE-TODO.md`: Lizenz laut Recherche unklar oder '
          'ungeprüft, oder Nutzungsbedingungen schränken automatisierten/kommerziellen Abruf ein. Signale, deren Hauptquelle nur per Scrape '
          'erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`. Berichte von Behörden und Firmen (Klasse C) '
          'zählen höchstens mit Gewicht 0,2.', '',
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
for path in (OUT_SIGNALS, OUT_SOURCES, OUT_BUILD, OUT_SCEN):
    json.load(open(path, encoding='utf-8'))
sigs = json.load(open(OUT_SIGNALS, encoding='utf-8'))
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
for x in sigs:
    if not x['id'].startswith(SC + '.') or x['scenarios'] != [SC]:
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
    if x['evidenceClass'] == 'D' and x['domain'] not in ('attention', 'context'):
        errors.append('Klasse D außerhalb attention/context: ' + x['id'])
    if x['evidenceClass'] == 'D' and x['domain'] == 'attention' and not 0.3 <= x['weight'] <= 0.7:
        errors.append('Klasse D außerhalb 0,3..0,7: ' + x['id'])
    if x['domain'] == 'context' and x['weight'] != 0:
        errors.append('context mit Gewicht: ' + x['id'])
    if x['kind'] not in ('gauge', 'count', 'rate', 'binary') or x['direction'] not in ('up', 'down', 'both'):
        errors.append('kind/direction: ' + x['id'])
    if x['status'] not in ('needs-key', 'license-unclear', 'planned'):
        errors.append('status: ' + x['id'])
    if not x['plain'] or not x['name']:
        errors.append('name/plain leer: ' + x['id'])
    if re.search(r'[a-z](ae|oe|ue)[a-z]', x['plain'] + x['name']) and False:
        pass
src_ids = [s['id'] for s in sources]
if len(src_ids) != len(set(src_ids)):
    errors.append('doppelte Quellen-IDs')
for s in sources:
    for x in s['signals']:
        if x not in set(ids):
            errors.append('Quelle %s verweist auf unbekanntes Signal %s' % (s['id'], x))
bdc = Counter(b['domain'] for b in build)
for d in BUILD_DOMAINS:
    if bdc[d] < BUILD_MIN_PER_DOMAIN:
        errors.append('Bau-Reihenfolge: Domain %s nur %d Collectors' % (d, bdc[d]))
if len(build) != BUILD_N:
    errors.append('Bau-Reihenfolge hat %d statt %d Einträge' % (len(build), BUILD_N))
for b in build:
    if b['live'] and not b['verified']:
        errors.append('live ohne verified: ' + b['collector'])
merged_in = sum(len(s['_merged']) for s in by_slug.values())
if len(sigs) + merged_in != len(raw):
    errors.append('Signal-Bilanz: %d + %d != %d' % (len(sigs), merged_in, len(raw)))
if set(scenario['domains']) != set(DOMAINS):
    errors.append('Szenario-Domains: %s' % sorted(scenario['domains']))
missing_w = {slug_of(s) for s in raw if slug_of(s) not in MERGE} - set(WEIGHT)
if missing_w:
    errors.append('Gewicht fehlt: %s' % sorted(missing_w))

print('Recherche-Signale: %d, zusammengeführt: %d, Katalog: %d' % (len(raw), merged_in, len(sigs)))
print('Domains:', dict(sorted(dc.items(), key=lambda kv: DOM_ORDER.index(kv[0]))))
print('Status:', dict(Counter(x['status'] for x in sigs)))
print('Klassen:', dict(Counter(x['evidenceClass'] for x in sigs)))
print('Quellen: %d, Collectors: %d, Hinweis: %s' % (len(sources), len(coll), NOTE_DROPPED))
print('Bau-Reihenfolge Domains:', dict(bdc))
print('Top 10:', ', '.join('%d %s(%s%s%s)' % (b['rank'], b['collector'], b['domain'], ',live' if b['live'] else '',
                                              ',ext' if b['extends'] else '') for b in build[:10]))
if '-v' in sys.argv:
    print('Umlaut-Korrekturen:', ' '.join(sorted(changed_words)))
    for b in build:
        print(b['rank'], b['collector'], b['domain'], 'live' if b['live'] else '', b['extends'] or '', b['why'][:90])
if errors:
    print('FEHLER:\n  ' + '\n  '.join(errors))
    sys.exit(1)
print('Selbstprüfung OK')
