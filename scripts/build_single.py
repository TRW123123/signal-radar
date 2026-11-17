#!/usr/bin/env python3
"""Build a single self-contained HTML file of the dashboard (styles, script, fonts and snapshot inlined).
Usage: python3 -I scripts/build_single.py [snapshot.json] [out.html]
The result opens from a phone or as an e-mail attachment, needs no server and makes no network requests."""
import base64, json, re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fe = os.path.join(root, 'frontend')
snap_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(fe, 'data', 'snapshot.json')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'dist', 'signal-radar.html')
html = open(os.path.join(fe, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(fe, 'app.css'), encoding='utf-8').read()
js = open(os.path.join(fe, 'app.js'), encoding='utf-8').read()
snap = json.load(open(snap_path, encoding='utf-8'))

def font(m):
    p = os.path.join(fe, m.group(1))
    return "url('data:font/woff2;base64," + base64.b64encode(open(p, 'rb').read()).decode() + "')"
css = re.sub(r"url\('(assets/fonts/[^']+)'\)", font, css)
fav = base64.b64encode(open(os.path.join(fe, 'favicon.svg'), 'rb').read()).decode()
html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
html = html.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', f'<link rel="icon" href="data:image/svg+xml;base64,{fav}">')
html = html.replace('<link rel="stylesheet" href="app.css">', '<style>\n' + css + '\n</style>')
embed = '<script>window.__SR_SNAPSHOT__ = ' + json.dumps(snap, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';</script>\n'
html = html.replace('<script type="module" src="app.js"></script>', embed + '<script type="module">\n' + js.replace('</script', '<\\/script') + '\n</script>')
# the multi-file page forbids inline code; the single file needs it, but still allows no network at all
html, n = re.subn(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:; font-src data:; base-uri \'none\'; form-action \'none\'">', html)
assert n == 1, 'CSP meta not found'
assert 'app.css' not in html and 'src="app.js"' not in html, 'inlining failed'
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(out, round(len(html.encode()) / 1024), 'kB')
