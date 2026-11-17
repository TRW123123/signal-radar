# Offene Fragen und geparkte Punkte

Gesammelt statt einzeln nachgefragt (Vorgabe Nachtlauf 17.11.2026). Reihenfolge nach Dringlichkeit.

## 1. Netlify-Deploy konnte aus der Bau-Umgebung nicht ausgeführt werden

Freigabe liegt vor (17.11., 00:46). Die Cloud-Umgebung blockiert aber ausgehende Verbindungen zu Netlify
(`api.netlify.com`, `netlify-mcp.netlify.app`: Antwort 403 vom Ausgangs-Proxy). Der Rechner des Auftraggebers war
nicht über die Bridge verbunden. Umgehen wurde nicht versucht.
**Nötig:** einmal Deploy vom eigenen Rechner (`netlify deploy --prod --dir frontend`) oder Repo mit Netlify verbinden.
Anleitung: `docs/DEPLOY.md`.

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
