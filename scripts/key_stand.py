#!/usr/bin/env python3
# Kanonische Umgebungsvariablen und Bearbeitungsstand der Zugänge (17.11.2026, aktualisiert 20.11.2026).
# Keine Key-Werte. Wird von den Konsolidierern importiert und kann die fertige
# Tabelle in docs/KEYS-NEEDED.md nachträglich um die Spalte „Stand“ ergänzen:
#   python3 -I scripts/key_stand.py
# Nach einer Neu-Erzeugung von KEYS-NEEDED.md durch consolidate_*.py diesen
# Schritt erneut ausführen, falls der Konsolidierer die Spalte noch nicht selbst schreibt.

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_MD = os.path.join(ROOT, 'docs', 'KEYS-NEEDED.md')

# Quell-ID (catalog/sources.json) -> Name, den der Code bzw. das gesetzte Secret verwendet.
ENV_BY_SOURCE = {
    'cf-radar': 'SR_CLOUDFLARE_KEY',
    'urlhaus': 'SR_ABUSECH_KEY',
    'threatfox': 'SR_ABUSECH_KEY',
    'malwarebazaar': 'SR_ABUSECH_KEY',
    'sec-edgar': 'SR_SEC_USER_AGENT',
    'agsi': 'SR_AGSI_KEY',
    'alsi': 'SR_ALSI_KEY',
    'eia': 'SR_EIA_KEY',
    'fred': 'SR_FRED_KEY',
    'fred-csv': 'SR_FRED_KEY',
    'fred-eggs': 'SR_FRED_KEY',
    'nasa-firms': 'SR_FIRMS_KEY',
    'nvd-cve-api': 'SR_NVD_KEY',
    'entsoe': 'SR_ENTSOE_KEY',
    'acled': 'SR_ACLED_KEY',
    'opensky': 'SR_OPENSKY_KEY',
    'ghsa': 'SR_GITHUB_KEY',
    'github-rest': 'SR_GITHUB_KEY',
    'faa-notam': 'SR_FAA_NOTAM_USER',
    'space-track': 'SR_SPACE_TRACK_USER',
    'reddit-json': 'SR_REDDIT_USER',
}

# Frühere Generator-Schreibweisen -> kanonischer Name im Code / in den GitHub-Secrets.
ENV_ALIASES = {
    'SR_CF_RADAR_KEY': 'SR_CLOUDFLARE_KEY',
    'SR_NVD_CVE_API_KEY': 'SR_NVD_KEY',
    'SR_NASA_FIRMS_KEY': 'SR_FIRMS_KEY',
    'SR_MALWAREBAZAAR_KEY': 'SR_ABUSECH_KEY',
    'SR_THREATFOX_KEY': 'SR_ABUSECH_KEY',
    'SR_URLHAUS_KEY': 'SR_ABUSECH_KEY',
    'SR_GHSA_KEY': 'SR_GITHUB_KEY',
    'SR_GITHUB_REST_KEY': 'SR_GITHUB_KEY',
    'SR_GITHUB_SEARCH_KEY': 'SR_GITHUB_KEY',
    'SR_FAA_NOTAM_KEY': 'SR_FAA_NOTAM_USER',
    'SR_SPACE_TRACK_KEY': 'SR_SPACE_TRACK_USER',
    'SR_REDDIT_JSON_KEY': 'SR_REDDIT_USER',
}

# Hinweis in der Tabellenzelle, wenn der Generator-Name vom Code-Namen abweicht.
ENV_CELL_NOTE = {
    'SR_CLOUDFLARE_KEY': 'Generator-Name `SR_CF_RADAR_KEY`',
    'SR_NVD_KEY': 'Generator-Name `SR_NVD_CVE_API_KEY`',
    'SR_FIRMS_KEY': 'Alias `SR_NASA_FIRMS_KEY`',
    'SR_ABUSECH_KEY': 'gemeinsam für ThreatFox, URLhaus, MalwareBazaar',
    'SR_GITHUB_KEY': 'gemeinsam für ghsa und github-rest; in Actions Fallback `github.token`',
    'SR_FAA_NOTAM_USER': 'client_id, dazu `SR_FAA_NOTAM_PASS` = client_secret',
    'SR_SPACE_TRACK_USER': 'Login-Name, dazu `SR_SPACE_TRACK_PASS`',
    'SR_REDDIT_USER': 'client_id, dazu `SR_REDDIT_PASS` = client_secret',
}

STAND_ANGELEGT = 'angelegt 17.11.2026'
STAND_GEBAUT = 'offen; Collector gebaut 20.11.2026'
STAND = {
    'SR_CLOUDFLARE_KEY': STAND_ANGELEGT,
    'SR_ABUSECH_KEY': STAND_ANGELEGT,
    'SR_SEC_USER_AGENT': STAND_ANGELEGT,
    'SR_FRED_KEY': STAND_ANGELEGT,
    'SR_AGSI_KEY': STAND_ANGELEGT,
    'SR_ALSI_KEY': STAND_ANGELEGT,
    'SR_EIA_KEY': STAND_ANGELEGT,
    'SR_FIRMS_KEY': STAND_ANGELEGT,
    'SR_NVD_KEY': STAND_ANGELEGT + '; optional (ohne Key 6,5 s Pause je Anfrage)',
    'SR_ENTSOE_KEY': 'wartet auf Freischaltung (API-Zugang per Mail beantragt)',
    'SR_ACLED_KEY': 'Konto angelegt 17.11.2026, Login per E-Mail+Passwort (kein Key), Collector fehlt',
    'SR_OPENSKY_KEY': 'gesperrt bis Lizenz (Anfrage 17.11.2026)',
    # Collector-Welle 1 (20.11.2026): Collector gebaut, Secret noch nicht angelegt
    'SR_GITHUB_KEY': 'Collector gebaut 20.11.2026; ohne eigenes Secret nutzt Actions `github.token`',
    'SR_OTX_KEY': STAND_GEBAUT,
    'SR_AISSTREAM_KEY': STAND_GEBAUT,
    'SR_FAA_NOTAM_USER': STAND_GEBAUT,
    'SR_SPACE_TRACK_USER': STAND_GEBAUT + ' (Login per POST seit 20.11.2026)',
    'SR_GFW_KEY': STAND_GEBAUT,
    'SR_ALERTS_IN_UA_KEY': STAND_GEBAUT,
    'SR_FINGRID_KEY': STAND_GEBAUT,
    'SR_COINGECKO_KEY': STAND_GEBAUT + ' (läuft notfalls auch ohne Key)',
    'SR_METACULUS_KEY': STAND_GEBAUT,
    'SR_SAM_GOV_KEY': STAND_GEBAUT + ' (Tageskontingent je Kontorolle prüfen)',
    'SR_REDDIT_USER': STAND_GEBAUT + ' (Token per POST seit 20.11.2026)',
    'SR_SHADOWSERVER_KEY': 'nicht nötig: Collector `shadowserver` liest das öffentliche Dashboard-JSON ohne Key',
    'SR_GREYNOISE_KEY': 'nicht nötig: Gratiszugang kennt nur Einzel-IP-Lookups, kein Aggregat messbar; Collector nicht gebaut',
    'SR_CENSYS_KEY': 'nicht nötig: Legacy-API seit 30.09.2026 abgeschaltet, Free-Plan nur Lookups; OT-Exposition kommt von Shadowserver',
}
STAND_DEFAULT = 'offen'

TABLE_HEADER = '| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale | Stand |'
TABLE_SEP = '|---|---|---|---|---|---|---|'

SEC_ROW = (
    '| SEC EDGAR | User-Agent mit Kontaktangabe (Fair Access, kein API-Key) | frei '
    '(User-Agent Pflicht) | https://www.sec.gov/edgar/search/ | `SR_SEC_USER_AGENT` | '
    'Collector `sec-edgar` | angelegt 17.11.2026 |'
)
THREATFOX_ROW = (
    '| abuse.ch ThreatFox | ThreatFox IOC-Volumen (Collector `threatfox`) | free '
    '(kostenloser Key/Konto) | https://threatfox.abuse.ch/api/ | `SR_ABUSECH_KEY` '
    '(gemeinsam für ThreatFox, URLhaus, MalwareBazaar) | Collector vorhanden | angelegt 17.11.2026 |'
)

INTRO_STAND = (
    'Die Spalte „Stand“ ist der Bearbeitungsstand der Zugänge (17.11.2026, aktualisiert 20.11.2026), ohne Key-Werte. '
    'Die Zuordnung liegt in `scripts/key_stand.py`. Kanonisch sind die Namen aus dem Code '
    'und den GitHub-Secrets (z. B. `SR_CLOUDFLARE_KEY`, nicht der frühere Generator-Name '
    '`SR_CF_RADAR_KEY`). ThreatFox, URLhaus und MalwareBazaar teilen sich `SR_ABUSECH_KEY`; '
    'für NASA FIRMS gilt `SR_FIRMS_KEY` (der Workflow setzt zusätzlich den Alias `SR_NASA_FIRMS_KEY`). '
    'ghsa und github-rest teilen sich `SR_GITHUB_KEY`. FAA NOTAM, Space-Track und Reddit brauchen ein Paar '
    '(`SR_FAA_NOTAM_USER`/`_PASS`, `SR_SPACE_TRACK_USER`/`_PASS`, `SR_REDDIT_USER`/`_PASS`); in der Tabelle steht der erste Name.'
)


def canonical_env(name: str) -> str:
    name = (name or '').strip().strip('`')
    return ENV_ALIASES.get(name, name)


def env_for_source(source_id: str) -> str:
    if source_id in ENV_BY_SOURCE:
        return ENV_BY_SOURCE[source_id]
    generated = 'SR_%s_KEY' % re.sub(r'[^A-Z0-9]', '_', (source_id or '').upper())
    return canonical_env(generated)


def stand_for(env: str) -> str:
    return STAND.get(canonical_env(env), STAND_DEFAULT)


def format_env_cell(env: str) -> str:
    env = canonical_env(env)
    note = ENV_CELL_NOTE.get(env)
    return '`%s` (%s)' % (env, note) if note else '`%s`' % env


def _split_row(line: str) -> list[str] | None:
    s = line.strip()
    if not s.startswith('|'):
        return None
    parts = [p.strip() for p in s.strip('|').split('|')]
    return parts


def _is_sep(parts: list[str]) -> bool:
    return all(re.fullmatch(r':?-{3,}:?', p or '') for p in parts)


def apply_to_markdown(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    intro_done = False
    cyber_table_closed = False
    saw_stand_intro = 'scripts/key_stand.py' in text

    while i < len(lines):
        line = lines[i]
        parts = _split_row(line)
        if parts and 'Umgebungsvariable' in parts and 'Dienst' in parts:
            if 'Stand' not in parts:
                parts.append('Stand')
            env_i = parts.index('Umgebungsvariable')
            stand_i = parts.index('Stand')
            out.append('| ' + ' | '.join(parts) + ' |')
            i += 1
            if i < len(lines) and (_split_row(lines[i]) and _is_sep(_split_row(lines[i]) or [])):
                sep = _split_row(lines[i]) or []
                while len(sep) < len(parts):
                    sep.append('---')
                out.append('|' + '|'.join('---' for _ in parts) + '|')
                i += 1
            in_cyber = (not cyber_table_closed) and '## Szenario' not in '\n'.join(out)
            have_sec = False
            have_threatfox = False
            while i < len(lines):
                row = _split_row(lines[i])
                if not row or _is_sep(row):
                    break
                # pad
                while len(row) < stand_i:
                    row.append('')
                env_cell = row[env_i] if env_i < len(row) else ''
                m = re.search(r'`(SR_[A-Z0-9_]+)`', env_cell)
                if m:
                    env = canonical_env(m.group(1))
                    row[env_i] = format_env_cell(env)
                    stand = stand_for(env)
                else:
                    stand = STAND_DEFAULT
                if stand_i < len(row):
                    # replace previous stand if we re-run
                    row[stand_i] = stand
                else:
                    row.append(stand)
                name = (row[0] if row else '').lower()
                if name.startswith('sec edgar') or (env_i < len(row) and 'SR_SEC_USER_AGENT' in row[env_i]):
                    have_sec = True
                if 'threatfox' in name:
                    have_threatfox = True
                out.append('| ' + ' | '.join(row) + ' |')
                i += 1
            if in_cyber:
                if not have_threatfox:
                    out.append(THREATFOX_ROW)
                if not have_sec:
                    out.append(SEC_ROW)
                cyber_table_closed = True
            continue
        out.append(line)
        # After the first intro paragraph of the cyber file, add the Stand explanation once.
        if (not intro_done and not saw_stand_intro and line.startswith('Automatisch erzeugt von `scripts/consolidate_cyber.py`')):
            # append onto this paragraph
            out[-1] = line.rstrip() + ' ' + INTRO_STAND
            intro_done = True
        i += 1

    return '\n'.join(out) + ('\n' if text.endswith('\n') or not text else '')


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    path = argv[0] if argv else KEYS_MD
    text = open(path, encoding='utf-8').read()
    new = apply_to_markdown(text)
    if new != text:
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(new)
        print('aktualisiert:', path)
    else:
        print('unverändert:', path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
