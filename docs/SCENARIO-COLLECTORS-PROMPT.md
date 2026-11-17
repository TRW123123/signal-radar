# Auftrag: Collectors für ein Szenario bauen

Arbeitsverzeichnis: /home/claude/signal-radar. Du baust die Datenanbindung für **ein** Szenario `<S>` (steht im Auftrag).
Lies zuerst: `docs/COLLECTOR-GUIDE.md`, `docs/SCENARIO-CONFIG-GUIDE.md`, `src/core/types.ts`,
`catalog/<S>-build-order.json`, und als Vorbilder `src/collectors/cvelist-delta.ts` (live geprüfter GitHub-Collector)
und `src/collectors/config/war.ts` (Szenario-Konfiguration geteilter Collectors). Katalog-Wissen je Collector:
`python3 -I scripts/catalog_show.py <S> <collector>`. Sachlich und neutral; nur passive öffentliche Daten, keine Personen.

Zwei Teile:

**Teil 1: Live prüfbare Quellen (höchste Priorität).** `raw.githubusercontent.com` (und, falls im Auftrag genannt,
`pypi.org` und `registry.npmjs.org`) sind aus der Shell erreichbar, per `curl` und per Node mit `NODE_USE_ENV_PROXY=1`.
Für jeden Eintrag der Bau-Reihenfolge mit `live: true` (und weitere aktuelle Funde aus
`catalog/research/github-hosted-datasets.json` zu deinem Szenario):
1. Quelle live ansehen (`curl -sS -m 30 <url> | head -c 800`, bei großen Dateien auch `tail -c 600`), Aktualität prüfen.
   Ist der letzte Datenstand älter als 3 Wochen, die Quelle nicht bauen und es sagen.
2. Collector `src/collectors/<id>.ts` gegen die echte Form schreiben (ein Collector je Quelle bzw. Repo). Große Dateien
   (über 1 MB): wenn möglich nur das Ende laden (HTTP-Range über `ctx.http.text(url, { headers: { range: 'bytes=-200000' } })`,
   Vorbild `src/collectors/oref-github.ts`), sonst `intervalMinutes` hoch setzen.
3. Signale sauber deklarieren: `intervalMinutes` = Abstand der Messwerte (Wochenreihe 10080), bei Quellen mit
   Veröffentlichungs-Verzug `maxAgeHours` setzen (sonst gilt die Reihe als veraltet), Baseline passend zum Rhythmus
   (Wochenreihen: `rolling`, `windowDays` 364, `minPoints` 20), Gewichte nach Katalog.
4. Aufzeichnen und prüfen: `NODE_USE_ENV_PROXY=1 SR_FIXTURES=record node src/cli.ts collect --only <id> --data /tmp/rec-<S>`,
   dann `SR_FIXTURES=replay node src/cli.ts collect --only <id> --data /tmp/rep-<S> --now-from-fixtures`, Werte ansehen
   (`tail -3 /tmp/rep-<S>/series/<signal>.jsonl`): Größenordnung, Zeitstempel, keine unvollständigen Zeiträume.
   Kopfkommentar `VERIFIED: ja (17.11.2026, echte Antwort)`. Fixture-Dateien über 400 kB in `.gitignore` eintragen.
5. Test `tests/collectors/<id>.test.ts` mit einem gekürzten echten Ausschnitt.

**Teil 2: Erweiterung geteilter Collectors (nur Konfiguration).** Fülle **ausschließlich** deine Datei
`src/collectors/config/<S>.ts` nach `docs/SCENARIO-CONFIG-GUIDE.md`: Wikipedia-Artikelgruppen (de und en, je höchstens
6 real existierende Artikel), GDELT-Abfragen, HN-Begriffe, Polymarket-Suchbegriffe, Yahoo-Symbole, IODA-/OONI-Länder,
Statuspage-Kategorien usw., soweit die Bau-Reihenfolge `extends` nennt. Signal-IDs aus dem Katalog (`<S>.<domain>.<name>`).
Die Collector-Dateien selbst (`src/collectors/*.ts` der geteilten Collectors) und die Konfigurationen anderer Szenarien
fasst du **nicht** an. Neue Requests trägst du in `fixtures/queue/<collector>.json` ein (anhängen; exakte URL für
`now` = `capturedAt` aus `fixtures/META.json`; `maxChars` höchstens 8000). Andere Agents hängen gleichzeitig an dieselben
Queue-Dateien an: lies die Datei unmittelbar vor dem Schreiben neu und ergänze nur deine Einträge.

Regeln: kein `mcp__WhatsApp_VM__fetch_url`, kein git commit. Vor dem Abschluss: nur deine eigenen Tests müssen grün
sein (`node --test tests/collectors/<deine>.test.ts`), und der Gesamt-Replay darf nicht brechen:
`SR_FIXTURES=replay node src/cli.ts collect --data /tmp/all-<S> --now-from-fixtures 2>&1 | tail -1`.

Antwort an mich, maximal 130 Wörter: Teil 1: je Collector eine Zeile (Signale, letzter Datenstand, Replay ok);
Teil 2: Zahl der Signale je erweitertem Collector, Zahl neuer Queue-Einträge; Probleme.
