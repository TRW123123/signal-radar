#!/usr/bin/env python3
"""Einmaliger Backfill: Messwerte der letzten Tage aus dem Git-Verlauf von stamparm/ipsum und firehol/blocklist-ipsets.

Schreibt data-seed/<signalId>.jsonl mit Zeilen {"t": "<ISO-UTC>", "v": <zahl>} (wird vom CLI beim Lauf übernommen).
Die Signal-IDs entsprechen src/collectors/ipsum.ts und src/collectors/firehol-blocklists.ts.

Nur Standardbibliothek und git. Aufruf:
  python3 -I scripts/backfill_git_history.py [--days 60] [--out data-seed] [--work /tmp/gh] [--max-blobs 250] [--budget-min 15]

Vorgehen: Klon ohne Blobs (--filter=blob:none --no-checkout --shallow-since="<days+10> days ago", bei Fehlschlag --depth 120),
je Tag den letzten Commit wählen, die Datei per `git show <commit>:<pfad>` lesen (lädt den Blob nach). Bei FireHOL werden nur die
Kopfzeilen gelesen. Das Blob-Budget wird auf die Signale verteilt; ist das Zeitbudget aufgebraucht, bricht das Skript sauber ab
und schreibt, was bis dahin vorliegt. Hat ein Repo im Fenster weniger als 3 Commits (z. B. weil der Verlauf zusammengestrichen
wurde), wird für dieses Repo nichts geschrieben.
"""
import argparse, json, os, re, subprocess, sys, time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

REPOS = {
    'ipsum': 'https://github.com/stamparm/ipsum',
    'blocklist-ipsets': 'https://github.com/firehol/blocklist-ipsets',
}
# FireHOL-Liste -> Signal-ID (identisch zu src/collectors/firehol-blocklists.ts)
FIREHOL = {
    'blocklist_de.ipset': 'cyber.threat.firehol_blocklist_de_entries',
    'greensnow.ipset': 'cyber.threat.firehol_greensnow_entries',
    'bruteforceblocker.ipset': 'cyber.threat.firehol_bruteforceblocker_entries',
    'firehol_level2.netset': 'cyber.threat.firehol_level2_entries',
}
IPSUM_IDS = ('cyber.threat.ipsum_ips_ge3', 'cyber.threat.ipsum_ips_ge5')
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


class Budget:
    def __init__(self, blobs, minutes):
        self.blobs = blobs
        self.deadline = time.time() + minutes * 60

    def ok(self):
        return self.blobs > 0 and time.time() < self.deadline

    def use(self):
        self.blobs -= 1


def run(args, cwd=None, timeout=600):
    return subprocess.run(args, cwd=cwd, capture_output=True, timeout=timeout, check=False)


def clone(name, url, work, days):
    dest = os.path.join(work, name)
    if os.path.isdir(os.path.join(dest, '.git')):
        return dest
    os.makedirs(work, exist_ok=True)
    base = ['git', 'clone', '--filter=blob:none', '--no-checkout']
    for extra in ([f'--shallow-since={days + 10} days ago'], ['--depth', '120']):
        try:
            r = run(base + extra + [url, dest], timeout=600)
        except subprocess.TimeoutExpired:
            print(f'{name}: Klon-Timeout mit {extra}', file=sys.stderr)
            continue
        if r.returncode == 0:
            return dest
        print(f'{name}: Klon fehlgeschlagen ({extra}): {r.stderr.decode()[:200]}', file=sys.stderr)
        run(['rm', '-rf', dest])
    return None


def daily_commits(repo, days):
    """Letzter Commit je UTC-Tag im Fenster: Liste von (commit, datetime)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    out = run(['git', 'log', f'--since={since}', '--format=%H %cI'], cwd=repo).stdout.decode().splitlines()
    per_day = {}
    for line in out:  # neueste zuerst
        h, iso = line.split(' ', 1)
        t = datetime.fromisoformat(iso).astimezone(timezone.utc)
        per_day.setdefault(t.date(), (h, t))
    return [per_day[d] for d in sorted(per_day)], len(out)


def thin(items, n):
    if n >= len(items):
        return items
    if n <= 0:
        return []
    step = len(items) / n
    return [items[min(len(items) - 1, int(i * step))] for i in range(n)]


def show(repo, commit, path, budget, head_only=False):
    if not budget.ok():
        return None
    budget.use()
    try:
        r = run(['git', 'show', f'{commit}:{path}'], cwd=repo, timeout=120)
    except subprocess.TimeoutExpired:
        return None
    if r.returncode != 0:
        return None
    data = r.stdout[:4000] if head_only else r.stdout
    return data.decode('utf-8', 'replace')


def parse_ipsum(text):
    m = re.search(r'^#\s*Last update:\s*(.+)$', text, re.M)
    if not m:
        return None
    try:
        ts = parsedate_to_datetime(m.group(1).strip()).astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None
    ge3 = ge5 = total = 0
    for line in text.splitlines():
        if not line or line[0] == '#':
            continue
        p = line.split()
        if len(p) < 2 or not re.fullmatch(r'\d{1,3}(\.\d{1,3}){3}', p[0]) or not p[1].isdigit():
            continue
        n = int(p[1])
        total += 1
        ge3 += n >= 3
        ge5 += n >= 5
    return (ts, ge3, ge5) if total else None


def parse_firehol_head(text):
    e = re.search(r'^#\s*Entries\s*:\s*(.+)$', text, re.M)
    d = re.search(r'^#\s*This File Date\s*:\s*(.+)$', text, re.M)
    if not e or not d:
        return None
    n = re.search(r'(\d[\d,]*)\s+unique IPs', e.group(1))
    t = re.search(r'(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+UTC\s+(\d{4})', d.group(1))
    if not n or not t or t.group(1) not in MONTHS:
        return None
    ts = datetime(int(t.group(6)), MONTHS.index(t.group(1)) + 1, int(t.group(2)), int(t.group(3)), int(t.group(4)), int(t.group(5)), tzinfo=timezone.utc)
    return ts, int(n.group(1).replace(',', ''))


def write_seed(out_dir, signal_id, points):
    pts = sorted({(t.strftime('%Y-%m-%dT%H:%M:%SZ'), v) for t, v in points})
    if len(pts) < 2:
        print(f'{signal_id}: weniger als 2 Punkte, nichts geschrieben')
        return 0
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, signal_id + '.jsonl'), 'w') as f:
        for t, v in pts:
            f.write(json.dumps({'t': t, 'v': v}) + '\n')
    print(f'{signal_id}: {len(pts)} Punkte ({pts[0][0][:10]} bis {pts[-1][0][:10]})')
    return len(pts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=60)
    ap.add_argument('--out', default='data-seed')
    ap.add_argument('--work', default='/tmp/gh')
    ap.add_argument('--max-blobs', type=int, default=250)
    ap.add_argument('--budget-min', type=float, default=15)
    a = ap.parse_args()
    budget = Budget(a.max_blobs, a.budget_min)
    ipsum_share = min(a.days, a.max_blobs // 3)
    fh_share = (a.max_blobs - ipsum_share) // len(FIREHOL)

    repo = clone('ipsum', REPOS['ipsum'], a.work, a.days)
    if repo:
        commits, n = daily_commits(repo, a.days)
        if n < 3:
            print(f'ipsum: nur {n} Commit(s) im Fenster, Verlauf nicht verfügbar, übersprungen')
        else:
            p3, p5 = [], []
            for c, _ in thin(commits, ipsum_share):
                r = parse_ipsum(show(repo, c, 'ipsum.txt', budget) or '')
                if r:
                    p3.append((r[0], r[1]))
                    p5.append((r[0], r[2]))
            write_seed(a.out, IPSUM_IDS[0], p3)
            write_seed(a.out, IPSUM_IDS[1], p5)

    repo = clone('blocklist-ipsets', REPOS['blocklist-ipsets'], a.work, a.days)
    if repo:
        commits, n = daily_commits(repo, a.days)
        if n < 3:
            print(f'blocklist-ipsets: nur {n} Commit(s) im Fenster, Verlauf nicht verfügbar, übersprungen')
        else:
            for path, sid in FIREHOL.items():
                pts = []
                for c, _ in thin(commits, fh_share):
                    r = parse_firehol_head(show(repo, c, path, budget, head_only=True) or '')
                    if r:
                        pts.append(r)
                write_seed(a.out, sid, pts)
    if not budget.ok():
        print('Budget (Blobs oder Zeit) aufgebraucht, Ergebnis ist gekürzt', file=sys.stderr)


if __name__ == '__main__':
    main()
