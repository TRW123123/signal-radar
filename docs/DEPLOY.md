# Deploy: Live-Betrieb

**Stand (17.11.2026): live.** Frontend: https://signal-radar.netlify.app (Netlify-Projekt `signal-radar`, Publish-Ordner `frontend`, kein Build, mit dem GitHub-Repo verbunden, `robots` bleibt `noindex`). Collectors: GitHub Actions `collect`, alle 15 Minuten, Daten als Commits auf `master`. Erster Handlauf grün: 58 Collectors, 0 Fehler, 4 übersprungen (kein Key). Der Branch heißt `master`, nicht `main`.

Die zwei Wege ergänzen sich: GitHub Actions **sammelt und bewertet** (braucht Internet), Netlify **liefert das Frontend aus** (statische Dateien). Es gibt keinen Server.

Voraussetzungen: Git, Node ab 22.18 (nur zum lokalen Prüfen), `gh` (GitHub CLI, optional), ein GitHub-Konto, optional ein Netlify-Konto.

## Weg A: GitHub (sammeln, bewerten, Daten als Commits)

Der Workflow `.github/workflows/collect.yml` heißt `collect`, läuft nach Zeitplan `7,22,37,52 * * * *` (alle 15 Minuten) und manuell (`workflow_dispatch`). Er führt `node src/cli.ts run --respect-intervals --prune-days 120` aus (Rohwerte älter als 120 Tage fallen weg, nie unter das Baseline-Fenster eines Signals, z. B. 365 Tage bei drei Reihen) und committet `data/` und `frontend/data/snapshot.json` mit der Nachricht `data: <Zeitstempel>`. Jeder Datenpunkt bleibt so in der Git-Historie nachprüfbar. `--respect-intervals` überspringt Collectors, deren Intervall noch nicht abgelaufen ist.

1. **Lokal prüfen.**
   ```
   npm test
   ```
   Erwartet: alle Tests grün (`# fail 0`).

2. **Repo.** `TRW123123/signal-radar`, öffentlich, Branch `master`. Öffentlich ist Voraussetzung dafür, dass die Seite den Snapshot von `raw.githubusercontent.com` laden kann (siehe Weg B).
   Prüfung: `gh repo view --json visibility` zeigt `PUBLIC`; die Datei `.github/workflows/collect.yml` erscheint im Repo.

3. **Actions erlauben.** Im Repo unter *Settings > Actions > General* Actions zulassen. Der Workflow setzt selbst `permissions: contents: write`; steht dort in den Workflow-Berechtigungen des Repos oder der Organisation „Read repository contents“ als Obergrenze, muss sie auf „Read and write“ gestellt werden, sonst scheitert der Schritt `git push`.

4. **Secrets setzen (nur wenn Key-Quellen laufen sollen).** Ohne Key werden die betroffenen Collectors übersprungen, nicht als Fehler gezählt.
   ```
   gh secret set SR_CLOUDFLARE_KEY
   gh secret set SR_ABUSECH_KEY
   ```
   Welche Collectors welchen Key lesen (Stand der Quelltexte):

   | Variable | Gelesen von | Pflicht | Im Workflow `env:` |
   |---|---|---|---|
   | `SR_CLOUDFLARE_KEY` | `cloudflare-radar` | ja (sonst übersprungen) | ja |
   | `SR_ABUSECH_KEY` | `threatfox`, `urlhaus`, `malwarebazaar` | ja (sonst übersprungen) | ja |
   | `SR_SEC_USER_AGENT` | `sec-edgar` | nein; die SEC verlangt einen User-Agent mit Kontaktangabe | ja |

   Der Workflow reicht außerdem `SR_FRED_KEY`, `SR_AGSI_KEY`, `SR_ALSI_KEY`, `SR_EIA_KEY`, `SR_FIRMS_KEY` (und den Alias `SR_NASA_FIRMS_KEY` aus demselben Secret), `SR_NVD_KEY`, `SR_ENTSOE_KEY`, `SR_ACLED_KEY` und `SR_OPENSKY_KEY` durch. Zurzeit liest kein gebauter Collector diese Variablen; sie sind für geplante Collectors vorgesehen. Ein leeres Secret zählt als „kein Key“. Der Bearbeitungsstand der Zugänge (ohne Werte) steht in der Spalte „Stand“ von [KEYS-NEEDED.md](KEYS-NEEDED.md). Lizenz-Lage: [LICENSE-TODO.md](LICENSE-TODO.md), geprüfte Bedingungen: [DATA-TERMS.md](DATA-TERMS.md).

5. **Ersten Lauf von Hand starten und beobachten.**
   ```
   gh workflow run collect
   gh run watch
   ```
   Prüfung: Der Lauf endet grün. Im Log des Schritts „Collect and score“ steht je Collector eine Zeile (`ok, N Werte`, `übersprungen (...)` oder `FEHLER ...`) und am Ende `<N> Collectors, <M> Fehler`. Einzelne Fehler stoppen die anderen Collectors nicht. GDELT drosselt zeitweise mit HTTP 429; betroffene Ströme werden übersprungen und beim nächsten Lauf nachgeholt.

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
- Jeder Lauf mit neuen Daten ist ein Commit. Die Git-Historie wächst dauerhaft (bis zu 96 Commits am Tag). Das ist gewollt (Nachprüfbarkeit); `--prune-days` begrenzt nur die Arbeitskopie, nicht die Historie.
- Läufe sind per `concurrency: collect` seriell, ein hängender Lauf blockiert die folgenden, bis das Zeitlimit greift.

## Weg B: Netlify (Frontend ausliefern)

Netlify liefert den Ordner `frontend/` statisch aus. Es gibt keinen Build-Schritt. Die Datei `netlify.toml` im Repo legt das fest:

- `publish = "frontend"`, kein Build-Befehl.
- Sicherheits-Header für alle Pfade: `Content-Security-Policy` ohne Fremd-Quellen (`default-src 'self'` und nur eigene Quellen für Skripte, Styles, Schriften, Bilder und Verbindungen; zusätzlich `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. Die Policy entspricht der `<meta>`-Policy in `frontend/index.html`.
- Cache: `/data/*.json` mit `public, max-age=60, must-revalidate` (neue Messdaten schnell sichtbar), `/assets/fonts/*` mit `public, max-age=31536000, immutable`.

**Wie die Daten ins Frontend kommen (Entscheidung 17.11.2026):** Die Seite lädt `snapshot.json` zur Laufzeit direkt von `https://raw.githubusercontent.com/TRW123123/signal-radar/master/frontend/data/snapshot.json`; fällt das aus, nimmt sie die mitgelieferte Kopie derselben Seite (`data/snapshot.json`). Auf `localhost` und in den Demos (`?demo=...`) zählen nur eigene Dateien. Die CSP erlaubt dafür genau eine Fremd-Quelle: `connect-src 'self' https://raw.githubusercontent.com` (in `netlify.toml` und in der `<meta>`-Policy von `frontend/index.html`).

Warum so: Der Bot committet alle 15 Minuten. Mit Git-Verbindung wäre jeder Commit ein Netlify-Deploy, bis zu 96 am Tag. Der Weg über `raw.githubusercontent.com` hält die Zahl der Deploys bei den echten Code-Änderungen, kostet kein Netlify-Kontingent, und die Daten sind ohnehin öffentlich und nachprüfbar. Preis: Besucher-Anfragen gehen an GitHub (nur lesend, kein Cookie), der Cache dort beträgt 5 Minuten, und das Repo muss öffentlich bleiben. Zusätzlich überspringt Netlify Builds, wenn sich unter `frontend/` (außer `frontend/data/snapshot.json`) und in `netlify.toml` nichts geändert hat (`ignore` in `netlify.toml`).

### Einrichtung (so wurde es gemacht)

```
netlify sites:create --name signal-radar --account-slug <team> --disable-linking
netlify deploy --prod --dir frontend --site <site-id> --no-build
# Git-Verbindung (GitHub-App-Installation des Kontos, kein Build-Befehl, Publish-Ordner frontend):
netlify api updateSite --data '{"site_id":"<site-id>","body":{"repo":{"provider":"github","repo_path":"TRW123123/signal-radar","repo_branch":"master","cmd":"","dir":"frontend","installation_id":<id>}}}'
# Netlify blendet auf dem Gratis-Tarif eine Plakette ein (Skript .netlify/scripts/hud), die unsere strenge CSP blockiert (4 Konsolenfehler). Abschalten:
netlify api updateSite --data '{"site_id":"<site-id>","body":{"built_with_badge_enabled":false}}'
```

Die Plakette bleibt aus, solange `built_with_badge_enabled` auf `false` steht. Ein Deploy von Hand ist jederzeit möglich (`netlify deploy --prod --dir frontend`); durch die Git-Verbindung läuft er bei Frontend-Änderungen auf `master` von selbst.

### Prüfen

Mit der Adresse der Site (`https://<name>.netlify.app`):

```
curl -sI https://<name>.netlify.app/ | grep -i -E "content-security-policy|x-content-type-options|referrer-policy"
curl -sI https://<name>.netlify.app/data/snapshot.json | grep -i cache-control
curl -sI https://<name>.netlify.app/assets/fonts/martian-mono-latin-standard-normal.woff2 | grep -i cache-control
```

Erwartet: die drei Sicherheits-Header mit den Werten aus `netlify.toml`; `max-age=60` für die JSON-Datei; `max-age=31536000, immutable` für die Schrift. Im Browser mit geöffneten Entwicklerwerkzeugen (Netzwerk): alle Anfragen gehen an die eigene Domain, mit einer Ausnahme: der Snapshot kommt von `raw.githubusercontent.com`; die Konsole meldet keine CSP-Verletzung. Die Anzeige trägt oben die Betriebsart (`live`, `snapshot` oder `demo`).

### Kosten: Build-Minuten

Daten-Commits lösen keinen Build aus (siehe oben: `ignore`-Regel in `netlify.toml`). Ob die Regel greift, zeigt die Deploy-Liste des Projekts: nach einem reinen `data:`-Commit erscheint dort ein übersprungener Build. Zu prüfen bleibt, wie der Tarif übersprungene Builds zählt.
