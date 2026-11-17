#!/usr/bin/env python3
"""Save a captured raw response as a fixture and verify its integrity.

Usage: python3 -I scripts/save_fixture.py <fixture-name> <expected-sha256|-> <input-file>

<input-file> holds either the raw body, or the JSON string literal exactly as it appeared in the capture tool's
"text" field (starting and ending with a double quote, with \\" and \\n escapes). The literal form is preferred:
it can be copied without interpreting escapes. Prints OK or MISMATCH and records the result in fixtures/CAPTURE-LOG.jsonl.
"""
import hashlib, json, os, sys, datetime
name, expected, src = sys.argv[1], sys.argv[2], sys.argv[3]
data = open(src, 'r', encoding='utf-8').read()
body = data
stripped = data.strip()
if stripped.startswith('"') and stripped.endswith('"'):
    try:
        v = json.loads(stripped)
        if isinstance(v, str):
            body = v
    except Exception:
        pass
raw = body.encode('utf-8')
sha = hashlib.sha256(raw).hexdigest()
ok = expected in ('-', '') or sha == expected
path = os.path.join('fixtures', name)
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, 'wb').write(raw)
with open('fixtures/CAPTURE-LOG.jsonl', 'a') as f:
    f.write(json.dumps({'fixture': name, 'bytes': len(raw), 'sha256': sha, 'expected': expected, 'integrity': 'ok' if ok and expected not in ('-', '') else ('unchecked' if ok else 'mismatch'), 'at': datetime.datetime.utcnow().isoformat() + 'Z'}) + '\n')
print(('OK' if ok else 'MISMATCH'), name, len(raw), 'bytes', sha[:12])
