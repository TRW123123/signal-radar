# Offene Fragen und geparkte Punkte

Gesammelt statt einzeln nachgefragt (Vorgabe Nachtlauf 17.11.2026). Reihenfolge nach Dringlichkeit.

## 1. Erledigt am 17.11.2026: Netlify, GitHub, Live-Betrieb

Frontend live unter https://signal-radar.netlify.app (noindex), Repo `TRW123123/signal-radar` ist öffentlich, GitHub Actions `collect`
läuft alle 15 Minuten, der Snapshot kommt von `raw.githubusercontent.com`. Einzelheiten und Begründung: `docs/DEPLOY.md`.

## 2. Offen: Netlify-Plakette und Tarif

Auf dem Gratis-Tarif blendet Netlify eine Plakette ein, die die strenge CSP blockiert. Sie ist über die Site-Einstellung
`built_with_badge_enabled=false` abgeschaltet (per API, ohne Zusatzkosten). Sollte Netlify das Verhalten ändern, kehren 4 Konsolenfehler
zurück; dann Einstellung prüfen. Die `ignore`-Regel greift (geprüft: Commit ohne Frontend-Änderung wird mit „Canceled build due to no content change“ beendet, in der Deploy-Liste rot als `error` gezeigt, aber kein Deploy). **Zu prüfen:** zählt Netlify diese abgebrochenen Builds auf das Kontingent?

## 3. Offen: GDELT drosselt

GDELT antwortet langsam (12 bis 23 s) und begrenzt Abrufe, vor allem von GitHub-Läufern aus. Je Lauf fallen einzelne Ströme mit HTTP 429
aus und werden beim nächsten Lauf nachgeholt (Abstand 5,5 s, Wartezeit nach 429 sechs Sekunden). Bleibt es bei mehr als der Hälfte Ausfällen:
Intervall von `gdelt-doc` erhöhen oder Ströme auf weniger Begriffe kürzen.

## 3a. Offen: ransomware.live

Die kostenlose API `api.ransomware.live/v2/recentvictims` liefert seit 11/2026 nur noch 404; die Pro-API (`api-pro.ransomware.live`) verlangt einen Key.
Der Collector liest jetzt das öffentliche Jahresarchiv `data.ransomware.live/<Jahr>-victims.json` (ca. 7 MB je Abruf, alle 6 Stunden).
Lizenz laut Seite CC BY-NC-SA (nicht kommerziell), Einzelheiten in `docs/LICENSE-TODO.md`. Bei Jahreswechsel liegt in den ersten Tagen
wenig im neuen Jahresarchiv; die Reihe baut sich über den Speicher auf.

## 4. API-Keys

Siehe `docs/KEYS-NEEDED.md`. Vier Collectors laufen ohne Key nicht und werden übersprungen: `cloudflare-radar` (`SR_CLOUDFLARE_KEY`) sowie
`threatfox`, `urlhaus`, `malwarebazaar` (`SR_ABUSECH_KEY`, abuse.ch verlangt ein Konto). Ihr Parser ist nie gegen eine echte Antwort geprüft.
`SR_SEC_USER_AGENT` ist als GitHub-Secret gesetzt.

## 5. Lizenzen

Siehe `docs/LICENSE-TODO.md` (Quellen mit ungeklärter Lizenz) und offene Projekt-Lizenz für die spätere Veröffentlichung.

## 6. Erledigt am 17.11.2026: Parser gegen echte Antworten

Der erste Live-Lauf hat 24 bisher ungeprüfte Collectors gegen echte Antworten geprüft; `docs/STATUS.md` führt je Collector den Stand
(50 ja, 4 teilweise, 4 nein). Repariert: ransomware-live (Quelle gewechselt), polymarket-gamma (Nulltreffer), sans-isc (topports als Objekt),
treasury-fiscal (Schlusstand in `open_today_bal`), Wikimedia (User-Agent), GDELT (Abstand und Zeitlimit).

## 7. Punkt-Messungen brauchen Sammelzeit

Rund 20 gebaute Messreihen liefern pro Abruf nur den aktuellen Stand (z. B. Statusseiten, Blocklisten-Größen,
Mempool, RIPE-Atlas-Sonden). Sie haben erst nach einigen Tagen Live-Betrieb einen Normalwert und zählen bis dahin nicht.
