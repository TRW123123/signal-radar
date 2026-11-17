# Deploy: Live-Betrieb

**Stand:** Weder GitHub-Repo noch Netlify-Deploy wurden aus der Bau-Umgebung heraus ausgeführt. Deren Ausgangs-Proxy hat Verbindungen zu Netlify blockiert (Antwort 403), neue GitHub-Repos ließen sich dort nicht anlegen, und ein Push braucht eine ausdrückliche Freigabe. Details und die zugehörigen Entscheidungen: [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md), Punkte 1 bis 3. Alle Schritte unten sind deshalb **nicht selbst durchgespielt**; jeder Schritt nennt eine Prüfung, mit der man das Ergebnis selbst feststellt.

Die zwei Wege ergänzen sich: GitHub Actions **sammelt und bewertet** (braucht Internet), Netlify **liefert das Frontend aus** (statische Dateien). Es gibt keinen Server.

Voraussetzungen: Git, Node ab 22.18 (nur zum lokalen Prüfen), `gh` (GitHub CLI, optional), ein GitHub-Konto, optional ein Netlify-Konto.

## Weg A: GitHub (sammeln, bewerten, Daten als Commits)

Der Workflow `.github/workflows/collect.yml` heißt `collect`, läuft nach Zeitplan `7,22,37,52 * * * *` (alle 15 Minuten) und manuell (`workflow_dispatch`). Er führt `node src/cli.ts run --respect-intervals` aus und committet `data/` und `frontend/data/snapshot.json` mit der Nachricht `data: <Zeitstempel>`. Jeder Datenpunkt bleibt so in der Git-Historie nachprüfbar. `--respect-intervals` überspringt Collectors, deren Intervall noch nicht abgelaufen ist.

1. **Lokal prüfen.**
   ```
   npm test
   ```
   Erwartet: alle Tests grün (`# fail 0`).

2. **Privates Repo anlegen und pushen.** Ein Push ist nach den Regeln des Projekts nur mit ausdrücklicher Freigabe des Inhabers vorgesehen.
   ```
   gh repo create signal-radar --private --source . --remote origin
   git push -u origin main
   ```
   Ohne `gh`: leeres privates Repo im Browser anlegen, dann `git remote add origin <URL>` und `git push -u origin main`.
   Prüfung: `gh repo view --json visibility` zeigt `PRIVATE`; die Datei `.github/workflows/collect.yml` erscheint im Repo.

3. **Actions erlauben.** Im Repo unter *Settings > Actions > General* Actions zulassen. Der Workflow setzt selbst `permissions: contents: write`; steht dort in den Workflow-Berechtigungen des Repos oder der Organisation „Read repository contents“ als Obergrenze, muss sie auf „Read and write“ gestellt werden, sonst scheitert der Schritt `git push`.

4. **Secrets setzen (nur wenn Key-Quellen laufen sollen).** Ohne Key werden die betroffenen Collectors übersprungen, nicht als Fehler gezählt.
   ```
   gh secret set SR_CLOUDFLARE_KEY
   gh secret set SR_ABUSECH_KEY
   ```
   Welche Collectors welchen Key lesen (Stand der Quelltexte):

   | Variable | Gelesen von | Pflicht | Im Workflow `env:` vorhanden |
   |---|---|---|---|
   | `SR_CLOUDFLARE_KEY` | `cloudflare-radar` | ja (sonst übersprungen) | ja |
   | `SR_ABUSECH_KEY` | `threatfox`, `urlhaus`, `malwarebazaar` | ja (sonst übersprungen) | **nein** |
   | `SR_SEC_USER_AGENT` | `sec-edgar` | nein; die SEC verlangt einen User-Agent mit Kontaktangabe, ohne Wert wird der Standard-User-Agent gesendet | **nein** |

   Der Workflow reicht außerdem `SR_NVD_KEY`, `SR_FRED_KEY`, `SR_ENTSOE_KEY`, `SR_ACLED_KEY` und `SR_OPENSKY_KEY` durch. Zurzeit liest **kein** Collector diese Variablen; sie sind harmlos, bringen aber nichts. Damit die Variablen `SR_ABUSECH_KEY` und `SR_SEC_USER_AGENT` im Lauf ankommen, müssen sie im Schritt „Collect and score“ unter `env:` ergänzt werden, zum Beispiel:
   ```
   SR_ABUSECH_KEY: ${{ secrets.SR_ABUSECH_KEY }}
   SR_SEC_USER_AGENT: ${{ secrets.SR_SEC_USER_AGENT }}
   ```
   Wo man Keys bekommt und was sie kosten: [KEYS-NEEDED.md](KEYS-NEEDED.md). Die Lizenz-Lage der Quellen: [LICENSE-TODO.md](LICENSE-TODO.md).

5. **Ersten Lauf von Hand starten und beobachten.**
   ```
   gh workflow run collect
   gh run watch
   ```
   Prüfung: Der Lauf endet grün. Im Log des Schritts „Collect and score“ steht je Collector eine Zeile (`ok, N Werte`, `übersprungen (...)` oder `FEHLER ...`) und am Ende `<N> Collectors, <M> Fehler`. Einzelne Fehler sind erwartbar (11 Collectors sind noch nicht gegen echte Antworten geprüft, siehe [STATUS.md](STATUS.md)); sie stoppen die anderen nicht.

6. **Ergebnis prüfen.**
   ```
   git pull
   git log --oneline -3          # oberster Eintrag: "data: 2026-..."
   ls data/series | head         # JSONL-Dateien je Signal
   node -e "const s=JSON.parse(require('fs').readFileSync('frontend/data/snapshot.json','utf8'));console.log(s.mode,s.generatedAt,s.scenarios.map(x=>x.id+':'+x.level))"
   ```
   Erwartet: `mode` ist `live`, `generatedAt` ist aktuell. Anfangs ist das Vertrauen niedrig und die Aussage lautet „Noch zu wenig Messdaten“; Quellen mit eingebauter Historie liefern sofort eine Baseline, die übrigen brauchen je nach Signal Tage bis Wochen.

7. **Laufzeit im Auge behalten.** Das Zeitlimit des Jobs beträgt 10 Minuten (`timeout-minutes: 10`). Dauert der erste Lauf länger, wird er abgebrochen und es gibt keinen Commit; dann Zeitplan oder Collector-Auswahl anpassen (`--only`).

Hinweise:

- GitHub garantiert Zeitpläne nicht auf die Minute; Läufe können sich verspäten oder einzeln ausfallen. Das Scoring toleriert das (Frische = dreifaches Intervall).
- Jeder Lauf mit neuen Daten ist ein Commit. Die Git-Historie wächst dauerhaft (bis zu 96 Commits am Tag). Das ist gewollt (Nachprüfbarkeit), bei einem privaten Repo aber ein Speicherthema auf lange Sicht.
- Läufe sind per `concurrency: collect` seriell, ein hängender Lauf blockiert die folgenden, bis das Zeitlimit greift.

## Weg B: Netlify (Frontend ausliefern)

Netlify liefert den Ordner `frontend/` statisch aus. Es gibt keinen Build-Schritt. Die Datei `netlify.toml` im Repo legt das fest:

- `publish = "frontend"`, kein Build-Befehl.
- Sicherheits-Header für alle Pfade: `Content-Security-Policy` ohne Fremd-Quellen (`default-src 'self'` und nur eigene Quellen für Skripte, Styles, Schriften, Bilder und Verbindungen; zusätzlich `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Die Policy entspricht der `<meta>`-Policy in `frontend/index.html`.
- Cache: `/data/*.json` mit `public, max-age=60, must-revalidate` (neue Messdaten schnell sichtbar), `/assets/fonts/*` mit `public, max-age=31536000, immutable`.

**Wie die Daten ins Frontend kommen:** Das Frontend liest `data/snapshot.json` (relativ zur Seite). Diese Datei erzeugt und aktualisiert der GitHub-Workflow (Weg A) als Teil jedes Daten-Commits. Ist Netlify per Git mit dem Repo verbunden, löst jeder Daten-Commit einen neuen Deploy aus, und die Seite zeigt den neuen Snapshot. Ohne Weg A bleibt `snapshot.json` stehen. Im Repo liegt sie derzeit nicht (nur `frontend/data/demo-*.json`); ohne die Datei zeigt das Frontend den Zustand „Snapshot nicht erreichbar“. Eine erste Momentaufnahme aus den aufgezeichneten Antworten erzeugt `npm run replay` (Betriebsart `snapshot`, nicht `live`).

### B1: Deploy per Git-Verbindung (empfohlen, aktualisiert sich selbst)

1. In Netlify: *Add new site > Import an existing project*, GitHub wählen, das private Repo `signal-radar` freigeben.
2. Build-Einstellungen: Build-Befehl leer lassen, Publish-Verzeichnis `frontend` (kommt aus `netlify.toml`). Branch `main`.
3. Deploy starten.

### B2: Deploy per CLI (einmalig, aktualisiert sich nicht)

```
npm install -g netlify-cli        # globales Werkzeug, keine Projekt-Abhängigkeit
netlify login
netlify link                      # vorhandene Site wählen; oder: netlify sites:create
netlify deploy --dir frontend     # Vorschau-Deploy, gibt eine URL aus
netlify deploy --prod --dir frontend
```

Dieser Weg liefert genau den Stand von `frontend/` zum Zeitpunkt des Befehls aus. Für laufend aktuelle Daten ist B1 nötig oder der Befehl muss nach jedem Daten-Commit wiederholt werden.

### Prüfen (beide Wege)

Mit der Adresse der Site (`https://<name>.netlify.app`):

```
curl -sI https://<name>.netlify.app/ | grep -i -E "content-security-policy|x-content-type-options|referrer-policy"
curl -sI https://<name>.netlify.app/data/snapshot.json | grep -i cache-control
curl -sI https://<name>.netlify.app/assets/fonts/martian-mono-latin-standard-normal.woff2 | grep -i cache-control
```

Erwartet: die drei Sicherheits-Header mit den Werten aus `netlify.toml`; `max-age=60` für die JSON-Datei; `max-age=31536000, immutable` für die Schrift. Im Browser mit geöffneten Entwicklerwerkzeugen (Netzwerk): alle Anfragen gehen an die eigene Domain, keine an Dritte; die Konsole meldet keine CSP-Verletzung. Die Anzeige trägt oben die Betriebsart (`live`, `snapshot` oder `demo`).

### Kosten: Build-Minuten bei Git-Verbindung

Bei B1 löst jeder Commit auf `main` einen Deploy aus, auch die Daten-Commits des Bots, also bis zu 96 am Tag. Auch ein Deploy ohne Build-Befehl kann je nach Netlify-Tarif Kontingent verbrauchen (Build-Minuten bzw. Deploy-Zähler); die aktuellen Bedingungen bitte im Tarif nachlesen, sie sind hier nicht geprüft. Gegenmaßnahmen: den Zeitplan im Workflow seltener einstellen (z. B. stündlich), oder die Option unten.

### Option, nicht umgesetzt: `snapshot.json` direkt von GitHub laden

Statt bei jedem Daten-Commit neu zu deployen, könnte das Frontend die Datei zur Laufzeit von `https://raw.githubusercontent.com/<owner>/<repo>/main/frontend/data/snapshot.json` laden. Netlify würde dann nur noch bei Code-Änderungen deployen. Voraussetzungen und Folgen:

- Das Repo (oder ein eigenes Daten-Repo bzw. ein Daten-Branch) muss **öffentlich** sein. Für ein privates Repo verlangt `raw.githubusercontent.com` eine Anmeldung, im Browser ohne Token geht es nicht.
- Die CSP muss genau diese eine Quelle zulassen: in `netlify.toml` und in der `<meta>`-Policy von `frontend/index.html` `connect-src 'self' https://raw.githubusercontent.com`. Alle anderen Direktiven bleiben unverändert.
- `frontend/app.js` muss die URL kennen (heute fest `data/snapshot.json`); das ist eine Änderung im Frontend-Code, die hier nicht gemacht wurde.
- Die Besucher-Anfrage geht dann an GitHub. Das widerspricht dem bisherigen Grundsatz „keine externen Anfragen“ ([frontend/design/BRIEF.md](../frontend/design/BRIEF.md)) und sollte bewusst entschieden werden.
- Zu prüfen vorab: ob `raw.githubusercontent.com` CORS-Header für die Site setzt und wie lange es cached (`curl -sI <raw-URL>`). Verzögerungen von einigen Minuten sind möglich.

## Reihenfolge-Empfehlung

1. Weg A einrichten und mindestens einen grünen Lauf abwarten (Schritte 1 bis 6).
2. Weg B1 verbinden; die Seite zeigt dann den vom Workflow erzeugten Snapshot.
3. Erst danach über die Option „direkt von GitHub laden“ nachdenken, falls die Deploy-Zahl stört.
