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
Stand 20.11.2026: Die Collector-Welle 1 hat 21 weitere Collectors mit Key gebaut; Variablennamen und Stand in `docs/KEYS-NEEDED.md`,
alle Variablen sind in `.github/workflows/collect.yml` durchgereicht (fehlendes Secret = übersprungen). Siehe Punkt 8.

## 5. Lizenzen

Siehe `docs/LICENSE-TODO.md` (Quellen mit ungeklärter Lizenz) und offene Projekt-Lizenz für die spätere Veröffentlichung.

## 6. Erledigt am 17.11.2026: Parser gegen echte Antworten

Der erste Live-Lauf hat 24 bisher ungeprüfte Collectors gegen echte Antworten geprüft; `docs/STATUS.md` führt je Collector den Stand
(50 ja, 4 teilweise, 4 nein). Repariert: ransomware-live (Quelle gewechselt), polymarket-gamma (Nulltreffer), sans-isc (topports als Objekt),
treasury-fiscal (Schlusstand in `open_today_bal`), Wikimedia (User-Agent), GDELT (Abstand und Zeitlimit).

## 7. Punkt-Messungen brauchen Sammelzeit

Rund 20 gebaute Messreihen liefern pro Abruf nur den aktuellen Stand (z. B. Statusseiten, Blocklisten-Größen,
Mempool, RIPE-Atlas-Sonden). Sie haben erst nach einigen Tagen Live-Betrieb einen Normalwert und zählen bis dahin nicht.

## 8. Offen seit 20.11.2026: Collector-Welle 1 (Übergaben A, B, C)

**Lizenzen, vor Veröffentlichung klären**
- **Shadowserver:** Dashboard-Statistiken gelten laut Terms als „Restricted Content“. Für veröffentlichte Verbreitung verlangt Shadowserver
  Copyright-Hinweis, Link und Logo; ob die öffentliche Dashboard-Statistik überhaupt darunter fällt, sagen die Terms nicht. Shadowserver direkt
  fragen. Bis dahin zeigt das Dashboard „© The Shadowserver Foundation“ mit Link, aber kein Logo (Registry-Status `pending-terms`).
- **Metaculus:** Terms erlauben kein KI-Training, kommerziell nur mit Vertrag. Nicht-kommerzielle Nutzung über das Data-Needs-Formular
  anfragen; für die %-Signale (metaculus_nuclear, prediction_ai_incident) Bot-Benchmarking- oder Unrestricted-Zugang beantragen.
- **Reddit:** Data API Terms, nur nicht-kommerziell. Prüfen, ob `active_user_count` nach der Umstellung 2025 noch geliefert wird.
- **ICE BofA und weitere Drittanbieter-Reihen über FRED** (BAML*, Cboe VIXCLS/VXVCLS/OVXCLS/GVZCLS, IMF PURANUSDM/PNGAS*): Laut FRED-Bedingungen
  braucht jede Nutzung über den privaten Gebrauch hinaus die Erlaubnis des Rechteinhabers. Ggf. Status `license-unclear`.
- **OTX** (Terms nur per JavaScript lesbar) und **aisstream** (keine Terms-Seite): Bedingungen ungeprüft.

**Kontingente und Betrieb**
- **SAM.gov:** Das Tageskontingent hängt von der Rolle des SAM-Kontos ab (ohne Rolle sehr klein). Schlägt ein Lauf fehl, versucht der Runner es
  alle 15 min erneut und kann das Kontingent aufbrauchen. Kontingent des Kontos prüfen.
- **aisstream:** Seit 09/2026 drosselt aisstream unkomprimierte WebSocket-Verbindungen. Ob Node permessage-deflate aushandelt, zeigt erst das
  Log des Live-Laufs („Kompression: true/false“).
- **GFW:** Ob mehrere `regionIds` (EEZ-MRGIDs) im GET als ODER wirken, ist nicht dokumentiert; beim ersten Lauf mit Key gegen Einzelabfragen prüfen.
- **github-rest:** Die Claude-Co-Autor-Suche kam mit `incomplete_results=true`; bleibt das in Actions so, Abfrage aufteilen oder nur Copilot zählen.
- **FAA NOTAM:** Ob `domesticLocation=GPS` die GPS-NOTAMs trifft und die FDC-Airspace-Abfrage unter 1000 Treffern bleibt, prüft erst der Live-Lauf.
- **AGSI:** Bei der ersten Antwort mit Key prüfen, ob EIC 21X000000001160J der gewünschte Betreiber ist.
- **Space-Track und Reddit** laufen seit 20.11.2026 mit POST (Login bzw. Token); ungeprüft bis Key. Login-Antworten werden nie aufgezeichnet,
  ein Replay dieser beiden Collectors braucht daher von Hand angelegte Dummy-Fixtures (`space-track/login.json`, `reddit-json/token.json`).

**ID-Kollisionen mit später gebauten Collectors**
Welle-1-Collectors speisen Signale, die der Katalog anderen, noch nicht gebauten Collectors zuweist. Wer einen davon baut, muss eine der beiden
Seiten auf eine neue id umstellen (der Test `tests/signal-ownership.test.ts` schlägt sonst fehl):
- `cvelist-v5`/`cvelist-delta`: `cyber.vuln.nvd_cve_volume`, `ai.supply_chain.cve_ai_keywords` (jetzt nvd-cve-api)
- `osv`/`ossf-malicious`: `osv_malware_advisories`, `osv_malware_ai`, `advisory_volume` (jetzt ghsa)
- `github-search`: die drei ai.agents-/supply_chain-Signale (jetzt github-rest)
- `censys`/`shodan`: `cyber.vuln.exposed_ot_protocols` (jetzt shadowserver)
- `cboe`, `fed-ddp`, `wb-pink`, `eu-oil-bulletin`, `ecb-data`: einzelne Markt-Signale (jetzt fred); `fred-csv` ist in `catalog/sources.json` auf `fred` umgestellt
- `entsog`: `blackout.gas.lng_terminal_sendout` (jetzt alsi); `ted`, `usaspending`: `war.government.defense_procurement` (jetzt sam-gov)
- `manifold`: `cyber.attention.metaculus_manifold` (jetzt metaculus); `yahoo-chart` (CALM): `bio.markets.poultry_stocks` (jetzt fred-eggs);
  `aishub`: `war.shipping.baltic_dark_vessels` (jetzt gfw)
- Neue ids, noch nicht im Katalog: `blackout.grid.frequency_nordic_deviation`, `war.conflict.ua_active_air_raid_oblasts`,
  `war.conflict.ua_active_missile_threats`, `cyber.threat.otx_wiper_pulses`, `cyber.threat.otx_ics_pulses`.
- Vorschlag Gruppe A: `agsi` statt `github-gas-storage` für `storage_fill_de`/`storage_withdrawal_rate` (aktueller) – Entscheidung offen.

