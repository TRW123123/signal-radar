#!/usr/bin/env python3
"""List capture queue entries and whether a fixture already exists. Usage: python3 -I scripts/capture_status.py [--todo] [--json]"""
import glob, json, os, sys
todo_only = '--todo' in sys.argv
import zlib
part = next((a.split('=')[1] for a in sys.argv if a.startswith('--part=')), None)  # e.g. --part=0/2: split by collector name
rows = []
for q in sorted(glob.glob('fixtures/queue/*.json')):
    try:
        items = json.load(open(q))
    except Exception as e:
        print('BROKEN QUEUE', q, e); continue
    for it in items:
        have = os.path.exists(os.path.join('fixtures', it['fixture']))
        if todo_only and have: continue
        if part:
            i, n = map(int, part.split('/'))
            if zlib.crc32(os.path.basename(q).encode()) % n != i: continue
        rows.append({'collector': os.path.basename(q)[:-5], 'fixture': it['fixture'], 'url': it['url'], 'maxChars': it.get('maxChars', 12000), 'have': have})
if '--json' in sys.argv:
    print(json.dumps(rows, ensure_ascii=False, indent=1))
else:
    for r in rows:
        print(('x' if r['have'] else ' '), r['collector'].ljust(22), r['fixture'].ljust(46), r['url'][:120])
    print(len(rows), 'entries,', sum(1 for r in rows if not r['have']), 'missing')
