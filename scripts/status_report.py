#!/usr/bin/env python3
"""Ermittelt Kennzahlen aus dem Repo und schreibt docs/STATUS.md.

Aufruf:  python3 -I scripts/status_report.py            (aus dem Repo-Wurzelverzeichnis oder von überall)
         python3 -I scripts/status_report.py --stdout   (nur ausgeben, nichts schreiben)

Nur Python-Standardbibliothek. Für die Collector-Metadaten (Signal-Ids, Key, Intervall) wird Node
(das Laufzeit-Werkzeug des Projekts) einmal aufgerufen und die echte Registry geladen; das ist genauer
als Textsuche in den TypeScript-Dateien. Ist Node nicht verfügbar, bricht das Skript mit Fehlermeldung ab.
Die VERIFIED-Vermerke werden aus dem Kopfkommentar jeder Collector-Datei gelesen.
"""
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NODE_DUMP = """
import { discoverCollectors } from %s;
const cs = await discoverCollectors(%s);
console.log(JSON.stringify(cs.map(c => ({
  id: c.id, title: c.title, needsKey: c.needsKey ?? null, intervalMinutes: c.intervalMinutes,
  signals: c.signals.map(s => ({ id: s.id, scenarios: s.scenarios ?? null, domain: s.domain ?? null, evidenceClass: s.evidenceClass ?? null })),
}))));
"""


def js(s):
    return json.dumps(s)


def load_collectors():
    code = NODE_DUMP % (js((ROOT / "src/core/registry.ts").as_uri()), js(str(ROOT)))
    try:
        r = subprocess.run(["node", "--input-type=module", "-e", code], capture_output=True, text=True, timeout=120, cwd=str(ROOT))
    except FileNotFoundError:
        sys.exit("Fehler: node nicht gefunden (Node >= 22.18 nötig)")
    if r.returncode != 0:
        sys.exit("Fehler beim Laden der Collectors über Node:\n" + r.stderr[-800:])
    return json.loads(r.stdout)


def header_info(collector_id):
    """Liest den VERIFIED-Vermerk, Rückgabe (status, grund, optionale_keys)."""
    f = ROOT / "src/collectors" / f"{collector_id}.ts"
    text = f.read_text(encoding="utf8")
    lines = text.split("\n")
    status, reason = "fehlt", "kein VERIFIED-Vermerk im Kopfkommentar"
    for i, line in enumerate(lines):
        m = re.match(r"\s*//\s*VERIFIED:\s*(.*)$", line)
        if not m:
            continue
        rest = m.group(1).strip()
        w = re.match(r"(ja|teilweise|nein)\b[\s.:,;]*(.*)$", rest, re.I)
        if w:
            status, reason = w.group(1).lower(), w.group(2).strip()
        else:
            status, reason = "unklar", rest
        j = i + 1
        while j < len(lines) and re.match(r"\s*//", lines[j]):
            reason += " " + re.sub(r"^\s*//\s?", "", lines[j]).strip()
            j += 1
        break
    optional = sorted(set(re.findall(r"ctx\.key\(\s*'([A-Z0-9_]+)'", text)))
    return status, re.sub(r"\s+", " ", reason).strip(), optional


def cell(s, n=230):
    s = s.replace("|", "/")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def main():
    scenarios = json.loads((ROOT / "catalog/scenarios.json").read_text(encoding="utf8"))
    scen_ids = [s["id"] for s in scenarios]

    # Katalog (Dateien)
    cat = {}
    for f in sorted((ROOT / "catalog/signals").glob("*.json")):
        for s in json.loads(f.read_text(encoding="utf8")):
            cat[s["id"]] = s
    n_catalog_files = len(cat)

    collectors = load_collectors()
    declared = {}  # signal id -> (collector id, decl)
    for c in collectors:
        for s in c["signals"]:
            declared[s["id"]] = (c["id"], s)

    # Wirksamer Katalog = Katalog-Dateien + von Collectors deklarierte (Logik wie activate() in src/core/registry.ts)
    eff = {}
    for sid, s in cat.items():
        eff[sid] = {"scenarios": s.get("scenarios") or [sid.split(".")[0]], "domain": s.get("domain") or sid.split(".")[1],
                    "cls": s.get("evidenceClass", "A"), "collector": None, "status": s.get("status", "planned")}
    only_in_collector = 0
    for sid, (cid, d) in declared.items():
        base = eff.get(sid)
        if base is None:
            only_in_collector += 1
            base = {"scenarios": [sid.split(".")[0]], "domain": sid.split(".")[1] if "." in sid else "misc", "cls": "A", "collector": None, "status": "planned"}
            eff[sid] = base
        if d.get("scenarios"):
            base["scenarios"] = d["scenarios"]
        if d.get("domain"):
            base["domain"] = d["domain"]
        if d.get("evidenceClass"):
            base["cls"] = d["evidenceClass"]
        base["collector"] = cid
        base["status"] = "needs-key" if next(c for c in collectors if c["id"] == cid)["needsKey"] else "active"

    # Collector-Infos
    infos = []
    ver_count = Counter()
    for c in collectors:
        status, reason, optional = header_info(c["id"])
        has_test = (ROOT / "tests/collectors" / f"{c['id']}.test.ts").exists()
        infos.append({**c, "verified": status, "reason": reason, "optional": [k for k in optional if k != c["needsKey"]], "test": has_test})
        ver_count[status] += 1
    sig_by_ver = Counter()
    for i in infos:
        sig_by_ver[i["verified"]] += len(i["signals"])

    # Capture-Stand
    meta = ROOT / "fixtures/META.json"
    captured = json.loads(meta.read_text())["capturedAt"] if meta.exists() else "unbekannt"

    out = []
    w = out.append
    w("# Status")
    w("")
    w(f"Automatisch erzeugt von `scripts/status_report.py` am {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}. Nicht von Hand ändern; neu erzeugen mit `python3 -I scripts/status_report.py`.")
    w("")
    w("Quellen der Zahlen: `catalog/scenarios.json`, `catalog/signals/*.json`, die geladenen Collectors (`src/collectors/*.ts`) und deren Kopfkommentar (`VERIFIED:`). "
      f"Aufgezeichnete echte Antworten unter `fixtures/` stammen vom {captured}.")
    w("")
    w("Signale eines Szenarios = Katalog-Einträge plus Signale, die ein Collector zusätzlich deklariert (so verfährt auch die Engine). "
      "Ein Signal, das mehreren Szenarien dient, zählt in jeder Szenario-Zeile, in den Gesamtsummen nur einmal.")
    w("")

    # 1 Szenarien
    w("## Szenarien")
    w("")
    w("| Szenario | Titel | Bereiche | Signale | davon mit Collector | davon nur katalogisiert | davon Klasse D (Aufmerksamkeit, nie gewertet) |")
    w("|---|---|---:|---:|---:|---:|---:|")
    for s in scenarios:
        sigs = [v for v in eff.values() if s["id"] in v["scenarios"]]
        built = sum(1 for v in sigs if v["collector"])
        w(f"| `{s['id']}` | {s['title']} | {len(s['domains'])} | {len(sigs)} | {built} | {len(sigs) - built} | {sum(1 for v in sigs if v['cls'] == 'D')} |")
    uniq = len(eff)
    uniq_built = sum(1 for v in eff.values() if v["collector"])
    w("")
    w(f"Summe (je Signal einmal): **{uniq} Signale**, davon **{uniq_built} mit Collector**, {uniq - uniq_built} nur katalogisiert. "
      f"Davon stehen {n_catalog_files} in den Katalog-Dateien und {only_in_collector} nur im Collector.")
    w("")

    # 2 je Szenario und Bereich
    w("## Signale je Szenario und Bereich")
    for s in scenarios:
        w("")
        w(f"### {s['title']} (`{s['id']}`)")
        w("")
        w("| Bereich | Titel | Gewicht | Signale | mit Collector | Klasse D |")
        w("|---|---|---:|---:|---:|---:|")
        sigs = [v for v in eff.values() if s["id"] in v["scenarios"]]
        by_dom = defaultdict(list)
        for v in sigs:
            by_dom[v["domain"]].append(v)
        shown = set()
        for did, d in s["domains"].items():
            L = by_dom.get(did, [])
            shown.add(did)
            w(f"| `{did}` | {d['title']} | {d['weight']} | {len(L)} | {sum(1 for v in L if v['collector'])} | {sum(1 for v in L if v['cls'] == 'D')} |")
        for did in sorted(set(by_dom) - shown):
            L = by_dom[did]
            w(f"| `{did}` | (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet) | – | {len(L)} | {sum(1 for v in L if v['collector'])} | {sum(1 for v in L if v['cls'] == 'D')} |")

    # 3 Collectors
    w("")
    w("## Collectors")
    w("")
    w("`VERIFIED` kommt aus dem Kopfkommentar der Datei: **ja** = Parser gegen eine echte aufgezeichnete Antwort geprüft, "
      "**teilweise** = nur ein Teil der Abrufe oder Felder geprüft, **nein** = nur nach Dokumentation oder Erinnerung gebaut. "
      "Der Grund steht so im Kopfkommentar (gekürzt).")
    w("")
    w("| Collector | VERIFIED | Grund (aus dem Kopfkommentar) | Key nötig | Signale | Intervall (min) | Test |")
    w("|---|---|---|---|---:|---:|---|")
    for i in infos:
        key = f"`{i['needsKey']}`" if i["needsKey"] else "nein"
        if i["optional"]:
            key += " (optional: " + ", ".join(f"`{k}`" for k in i["optional"]) + ")"
        w(f"| `{i['id']}` | {i['verified']} | {cell(i['reason'])} | {key} | {len(i['signals'])} | {i['intervalMinutes']} | {'ja' if i['test'] else 'nein'} |")

    # 4 Summen
    w("")
    w("## Summen")
    w("")
    w(f"- Szenarien: {len(scenarios)} ({', '.join(scen_ids)})")
    w(f"- Signale gesamt: {uniq}, davon mit Collector {uniq_built}, nur katalogisiert {uniq - uniq_built}")
    w(f"- Collectors: {len(infos)}, davon mit Pflicht-Key {sum(1 for i in infos if i['needsKey'])} ({', '.join(sorted({i['needsKey'] for i in infos if i['needsKey']}))})")
    w(f"- Von Collectors deklarierte Signale (Summe über Collectors): {sum(len(i['signals']) for i in infos)}")
    w("")
    w("| VERIFIED | Collectors | Signale dieser Collectors |")
    w("|---|---:|---:|")
    for k in ("ja", "teilweise", "nein", "fehlt", "unklar"):
        if ver_count.get(k):
            w(f"| {k} | {ver_count[k]} | {sig_by_ver[k]} |")
    w("")
    w("Collectors mit `VERIFIED: nein` oder `teilweise` sind die offenen Prüfaufgaben: Antwort aufzeichnen (`fixtures/queue/<collector>.json`), Parser dagegen testen, Vermerk ändern.")
    w("")

    text = "\n".join(out)
    if "--stdout" in sys.argv:
        print(text)
    else:
        (ROOT / "docs/STATUS.md").write_text(text, encoding="utf8")
        print(f"docs/STATUS.md geschrieben: {len(scenarios)} Szenarien, {uniq} Signale ({uniq_built} mit Collector), "
              f"{len(infos)} Collectors (ja {ver_count['ja']}, teilweise {ver_count['teilweise']}, nein {ver_count['nein']})")


if __name__ == "__main__":
    main()
