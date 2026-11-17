# Offene Fragen und geparkte Punkte

Gesammelt statt einzeln nachgefragt (Vorgabe Nachtlauf 17.11.2026). Reihenfolge nach Dringlichkeit.

## 1. Netlify-Deploy konnte aus der Bau-Umgebung nicht ausgeführt werden

Freigabe liegt vor (17.11., 00:46). Die Cloud-Umgebung blockiert aber ausgehende Verbindungen zu Netlify
(`api.netlify.com`, `netlify-mcp.netlify.app`: Antwort 403 vom Ausgangs-Proxy). Der Rechner des Auftraggebers war
nicht über die Bridge verbunden. Umgehen wurde nicht versucht.
**Nötig:** einmal Deploy vom eigenen Rechner (`netlify deploy --prod --dir frontend`) oder Repo mit Netlify verbinden.
Anleitung: `docs/DEPLOY.md`.

**Vorschau bis dahin:** `dist/signal-radar.html` ist das komplette Dashboard als eine Datei (Schrift, Code und
Momentaufnahme eingebettet, keine Netzwerk-Anfragen), gebaut mit `python3 -I scripts/build_single.py`. Das
Veröffentlichen als Claude-Artifact wurde von der Berechtigungsprüfung der Umgebung abgelehnt und nicht umgangen.

## 2. Privates GitHub-Repo

Geplant ist ein privates Repo. Aus der Bau-Umgebung lassen sich keine neuen Repos anlegen (nur bestehende anhängen),
und Push braucht laut Hard Rule eine ausdrückliche Freigabe. Der Stand liegt als lokales Git-Repo mit Commits vor
und wird als Archiv übergeben. **Nötig:** leeres privates Repo `signal-radar` anlegen und Push freigeben.

## 3. Live-Betrieb der Collectors

Collectors brauchen eine Laufzeit mit Internetzugang. Vorbereitet: GitHub Actions (alle 15 Minuten, Daten als Commits)
und Netlify Scheduled Functions. Beides startet erst nach Punkt 1 bzw. 2. Bis dahin zeigt das Dashboard eine
Momentaufnahme aus aufgezeichneten echten Antworten.

## 4. API-Keys

Siehe `docs/KEYS-NEEDED.md`. Collectors für Key-Quellen sind gebaut und werden ohne Key übersprungen.

## 5. Lizenzen

Siehe `docs/LICENSE-TODO.md` (Quellen mit ungeklärter Lizenz) und offene Projekt-Lizenz für die spätere Veröffentlichung.

## 6. Aufzeichnung echter Antworten ist in der Bau-Umgebung eng begrenzt

Echte Antworten der Quellen ließen sich nur über ein einzelnes Abruf-Werkzeug holen (ratenbegrenzt, höchstens
24 000 Zeichen, große Antworten nicht verlustfrei übertragbar). Direkt erreichbar war nur `raw.githubusercontent.com`.
Folge: Collectors mit großen Antworten (z. B. IODA, Yahoo, Ransomware.live, ADS-B) sind gebaut, aber nicht gegen eine
vollständige echte Antwort geprüft. `docs/STATUS.md` führt je Collector den Prüfstand. **Nötig:** nach dem ersten
Live-Lauf (GitHub Actions oder lokal `node src/cli.ts run`) die Fehlerliste ansehen; ein Folge-Lauf kann die
betroffenen Parser dann gegen echte Antworten reparieren.

## 7. Punkt-Messungen brauchen Sammelzeit

Rund 20 gebaute Messreihen liefern pro Abruf nur den aktuellen Stand (z. B. Statusseiten, Blocklisten-Größen,
Mempool, RIPE-Atlas-Sonden). Sie haben erst nach einigen Tagen Live-Betrieb einen Normalwert und zählen bis dahin nicht.
