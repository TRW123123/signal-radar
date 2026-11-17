#!/usr/bin/env python3
"""Print catalog knowledge for one or more collectors: build-order entry, signals, sources. Usage: python3 -I scripts/catalog_show.py <scenario> <collector> [...]"""
import json, sys
scenario, names = sys.argv[1], sys.argv[2:]
sig = json.load(open(f'catalog/signals/{scenario}.json'))
src = json.load(open('catalog/sources.json'))
try:
    order = json.load(open(f'catalog/{scenario}-build-order.json'))
    order = order if isinstance(order, list) else order.get('order', [])
except FileNotFoundError:
    order = []
for n in names:
    print('=' * 20, n)
    for e in order:
        if e.get('collector') == n:
            print('BUILD-ORDER:', json.dumps(e, ensure_ascii=False))
    for s in sig:
        if s.get('collector') == n:
            keep = {k: s.get(k) for k in ('id','name','plain','domain','evidenceClass','direction','kind','weight','manipulability','independenceGroup','unit','intervalMinutes','baseline','status','endpoint','history','license','banalCauses','rationale','notes') if s.get(k) not in (None, '', [])}
            print('SIGNAL:', json.dumps(keep, ensure_ascii=False))
    for s in src:
        if s.get('id') == n:
            print('SOURCE:', json.dumps(s, ensure_ascii=False))
