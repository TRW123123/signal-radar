# Nutzungsbedingungen der Datenquellen

Stand der Prüfung: **17.11.2026**, Quellen der Collector-Welle 1 ergänzt am **20.11.2026** (Angaben aus den Übergaben der Collector-Agents).

Signal Radar ist ein nicht-kommerzielles Open-Source-Frühwarn-Dashboard aus öffentlichen Daten. Diese Datei hält fest, was die Nutzungsbedingungen der Quellen verlangen, für die am 17.11.2026 Keys beantragt oder deren Bedingungen gelesen wurden. Sie ist eine Arbeitsnotiz, keine Rechtsberatung.

- **Code und Dashboard:** Die Pflichtangaben (Quellenname, Link, wörtliche Hinweise) stehen zentral in [`src/core/attribution.ts`](../src/core/attribution.ts). `buildSnapshot` hängt die passenden Einträge als `attributions` an den Snapshot, das Dashboard zeigt sie im Fuß unter „Quellen“ und als „Quelle:“ an der jeweiligen Messreihe. Wer einen Collector für eine dieser Quellen baut oder ändert, pflegt Registry und Kopfkommentar zusammen.
- **Ältere Liste:** [`docs/LICENSE-TODO.md`](LICENSE-TODO.md) ist die automatisch erzeugte Recherche-Liste aller Quellen. Wo sie dieser Datei widerspricht, gilt diese Datei.

Status-Begriffe: **Collector vorhanden** (Code unter `src/collectors/` existiert), **nur Spiegel** (Daten kommen nur über ein GitHub-Spiegelrepo), **nur Katalog** (geplant, kein Code), **wartet** (auf Key, Lizenz oder Bedingungen).

---

## Cloudflare Radar

- **Nutzungsbedingungen:** Radar-Daten unter CC BY-NC 4.0.
- **Pflicht-Quellenangabe:** „Cloudflare Radar“.
- **Einschränkungen:** nur nicht-kommerziell; kommerzielle Nutzung bräuchte eine Erlaubnis von Cloudflare.
- **Status im Repo:** Collector vorhanden (`cloudflare-radar`, Key `SR_CLOUDFLARE_KEY`). Weitere Katalog-Signale laufen unter der Collector-ID `cf-radar` (kein Code).

## abuse.ch (ThreatFox, URLhaus, MalwareBazaar)

- **Nutzungsbedingungen:** Kostenlos nur für nicht-gewinnorientierte Zwecke. Moderates Polling ist in Ordnung, Massen-Harvesting nicht. Die Klausel zu „derivative works“ ist unklar formuliert. KI-Training mit den Daten nur mit Zustimmung von abuse.ch.
- **Pflicht-Quellenangabe:** abuse.ch.
- **Einschränkungen:** Der Katalog führte bisher nur „CC0“. Die Daten selbst nennt abuse.ch CC0, die Nutzung über die Auth-Keys unterliegt aber den Bedingungen oben. Die Lizenzangaben in Katalog und Collectors nennen jetzt beides. Signal Radar speichert nur Stundenzählungen, keine IOCs.
- **Status im Repo:** Collectors vorhanden (`threatfox`, `urlhaus`, `malwarebazaar`, je `needsKey`). Feodo Tracker (`feodo`) gehört ebenfalls zu abuse.ch und ist in der Registry mit erfasst (nur Katalog).

## FRED (Federal Reserve Bank of St. Louis)

- **Nutzungsbedingungen:** Automatischer Zugriff über die API ist erlaubt.
- **Pflicht-Quellenangabe:** Im Dashboard wörtlich:
  `This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.`
- **Einschränkungen:** Keine FRED-Logos; „FRED“ darf nicht im Hostnamen vorkommen. Weil Dritte das Dashboard nutzen, wird auf die API-Bedingungen verlinkt: https://fred.stlouisfed.org/docs/api/terms_of_use.html. Serien mit Drittanbieter-Copyright (z. B. ICE BofA) brauchen die Erlaubnis des Rechteinhabers.
- **Status im Repo:** Collectors vorhanden (`fred`, `fred-eggs`, Key `SR_FRED_KEY`); die früheren `fred-csv`-Signale laufen über `fred`. **Offen:** ICE BofA (BAML*), Cboe (VIXCLS, VXVCLS, OVXCLS, GVZCLS) und IMF-Reihen sind Drittanbieter-Reihen; Erlaubnis der Rechteinhaber ungeklärt.

## GIE AGSI+ / ALSI+

- **Nutzungsbedingungen:** Automatischer Dauerzugriff ist vorgesehen, Weiterverarbeitung frei.
- **Pflicht-Quellenangabe:** „GIE AGSI / ALSI platform“. Ohne Quellenangabe kann GIE den Key deaktivieren.
- **Einschränkungen:** keine weiteren gefunden.
- **Status im Repo:** Collectors vorhanden (`agsi` Key `SR_AGSI_KEY`, `alsi` Key `SR_ALSI_KEY`). Zusätzlich Spiegel `github-gas-storage` (GitHub-Repo volzinnovation/de-gas-storage-tracker-bnetza, schreibt AGSI+-Daten fort).

## EIA (U.S. Energy Information Administration)

- **Nutzungsbedingungen:** US-Regierungsdaten, frei nutzbar.
- **Pflicht-Quellenangabe:** „U.S. Energy Information Administration (EIA)“.
- **Einschränkungen:** Veränderte oder abgeleitete Daten nicht als EIA-Daten ausgeben; keine Andeutung einer Billigung durch die EIA; kein EIA-Logo ohne Erlaubnis; Rate-Limits nicht umgehen.
- **Status im Repo:** nur Spiegel: `github-oil-prices`, `github-oil-prices-finance`, `github-gas-henry-hub`, `blackout-energy-prices-github` (GitHub-Repos datasets/oil-prices und datasets/natural-gas mit EIA-Reihen). Die Bedingungen gelten auch für diese Spiegel. Direkter Collector `eia` vorhanden (Key `SR_EIA_KEY`).

## NVD (NIST)

- **Nutzungsbedingungen:** API-Key nicht weitergeben; Rate-Limits einhalten; der Dienst wird „as is“ bereitgestellt.
- **Pflicht-Quellenangabe:** üblicher Hinweis, wörtlich:
  `This product uses the NVD API but is not endorsed or certified by the NVD.`
- **Einschränkungen:** Veränderte Inhalte nicht als „NVD“ ausgeben.
- **Status im Repo:** Collector vorhanden (`nvd-cve-api`). Key `SR_NVD_KEY` optional (ohne Key 6,5 s Pause zwischen Anfragen).

## NASA FIRMS

- **Nutzungsbedingungen:** MAP_KEY mit Limit 5000 Transaktionen je 10 Minuten.
- **Pflicht-Quellenangabe:** „NASA FIRMS“.
- **Einschränkungen:** Die Suomi-NPP-Daten (VIIRS_SNPP) enden am 02.11.2026; auf NOAA-20 / NOAA-21 umstellen.
- **Status im Repo:** Collector vorhanden (`nasa-firms`, Key `SR_FIRMS_KEY`), nutzt `VIIRS_NOAA20_NRT`, kein Suomi NPP. Der MAP_KEY steht im URL-Pfad; `redactUrl` schwärzt solche Pfadsegmente (32 Hex-Zeichen) seit 20.11.2026.

## SEC EDGAR

- **Nutzungsbedingungen:** Fair-Access-Regeln der SEC.
- **Pflicht-Quellenangabe:** keine feste Formel; Quelle SEC EDGAR wird an der Messreihe genannt.
- **Einschränkungen:** User-Agent mit Kontaktangabe ist Pflicht (gesetzt über `SR_SEC_USER_AGENT`); höchstens 10 Anfragen pro Sekunde.
- **Status im Repo:** Collector vorhanden (`sec-edgar`).

## ACLED

- **Nutzungsbedingungen:** Kostenlos nur nicht-kommerziell. Abruf über die API erlaubt, Scraping verboten, Logins nicht teilen.
- **Pflicht-Quellenangabe:** Jede Grafik nennt ACLED gut sichtbar (unten oder in der Legende), möglichst mit Link https://acleddata.com. Geteilte Dateien brauchen eine Quellenspalte mit vollem Namen und Link sowie einen Hinweis auf Änderungen.
- **Einschränkungen:** Öffentliche Ausgaben müssen „transformativ“ sein: keine Rohereignisse im Dashboard, nur aggregierte oder abgeleitete Indikatoren, die sich nicht auf Einzelereignisse zurückrechnen lassen. Kein KI-Training, das ACLED ersetzt.
- **Status im Repo:** nur Katalog (`acled`), kein Collector. Geplantes Signal `war.conflict.acled_events_weekly`: Wochensummen von Ereignissen und Todesopfern je Land.
- **Risiko:** Wochensummen je Land sind als Aggregat vertretbar. Ein künftiger Collector darf aber **nie** Rohereignisse (Datum, Ort, Akteure, Beschreibung) speichern, ausgeben oder im Dashboard zeigen, auch nicht in `meta` von Observations oder als Kontext-Meldung. Bei kleinen Ländern mit wenigen Ereignissen pro Woche prüfen, ob die Summe faktisch ein Einzelereignis verrät. Das Dashboard hebt die ACLED-Nennung an der Messreihe hervor (`mr-credit-stark`).

## OpenSky Network

- **Nutzungsbedingungen:** Nur für gemeinnützige Forschung und Lehre. Automatische API-Nutzung in einem Dienst braucht vorher eine schriftliche Vereinbarung.
- **Pflicht-Quellenangabe:** „The OpenSky Network“ (für den Fall einer Vereinbarung vorgemerkt).
- **Einschränkungen:** Keine Weitergabe der Daten; Flugzeugkennungen und Sensorstandorte anonymisieren.
- **Status im Repo:** wartet auf Lizenz. Lizenzanfrage am 17.11.2026 an contact@opensky-network.org gesendet. **Collector bis zur Antwort nicht aktivieren.** Geprüft: Es gibt keinen Collector, OpenSky läuft derzeit nicht.
- **Achtung Katalog:** `opensky` in `catalog/sources.json` hat `"auth": "none"`; die anonyme API wäre technisch ohne Key nutzbar. Ein Collector ohne `needsKey` würde also sofort laufen. Das ist ohne Vereinbarung nicht erlaubt. Die Lizenzangaben in Katalog und Registry (`blocked-pending-license`) sagen das jetzt; die Signal-Status (`planned` / `needs-key`) bleiben unverändert.

## ENTSO-E Transparency Platform

- **Nutzungsbedingungen:** noch nicht gelesen. API-Zugang per Mail beantragt, Antrag ausstehend.
- **Pflicht-Quellenangabe:** vorläufig „ENTSO-E Transparency Platform“.
- **Einschränkungen:** unbekannt. Der Katalog nennt CC BY 4.0; das ist **laut Katalog, Bedingungen noch nicht selbst gelesen**.
- **Status im Repo:** nur Katalog (`entsoe`), kein Collector. Registry-Status `pending-terms`. Vor dem Bau des Collectors die Bedingungen lesen und diese Datei ergänzen.

---

## Quellen der Collector-Welle 1 (ergänzt 20.11.2026)

Angaben aus den Übergaben der Collector-Agents; die Bedingungen wurden dort gelesen, nicht hier erneut geprüft.

## Global Fishing Watch

- **Nutzungsbedingungen:** CC BY-NC 4.0, nur nicht-kommerziell; höchstens 50 000 Requests am Tag.
- **Pflicht-Quellenangabe:** wörtlich `Powered by Global Fishing Watch.` mit Link auf https://globalfishingwatch.org (Terms 3.A.1).
- **Status im Repo:** Collector vorhanden (`gfw`, Key `SR_GFW_KEY`).

## Fingrid Open Data

- **Nutzungsbedingungen:** CC BY 4.0; höchstens 1 Request je 2 Sekunden.
- **Pflicht-Quellenangabe:** „Fingrid“, Hinweis `Source: Fingrid, data.fingrid.fi`.
- **Status im Repo:** Collector vorhanden (`fingrid`, Key `SR_FINGRID_KEY`).

## GitHub Advisory Database und GitHub REST

- **Nutzungsbedingungen:** Advisory Database unter CC BY 4.0. REST- und Such-API: GitHub-Nutzungsbedingungen, hier nur Aggregatzahlen.
- **Pflicht-Quellenangabe:** Link auf die GitHub Advisory Database, https://github.com/advisories; für `github-rest` Quelle „GitHub“.
- **Status im Repo:** Collectors vorhanden (`ghsa`, `github-rest`, Key `SR_GITHUB_KEY`, in Actions ersatzweise `github.token`).

## CoinGecko

- **Nutzungsbedingungen:** CoinGecko API Terms; Demo-Kontingent 10 000 Requests im Monat.
- **Pflicht-Quellenangabe:** wörtlich `Data provided by CoinGecko` mit Link auf https://www.coingecko.com (Attribution Guide).
- **Status im Repo:** Collector vorhanden (`coingecko`, Key `SR_COINGECKO_KEY`).

## Metaculus

- **Nutzungsbedingungen:** Metaculus Terms of Use: kein KI-Training, kommerzielle Nutzung nur mit Vertrag.
- **Pflicht-Quellenangabe:** „Metaculus“.
- **Status im Repo:** Collector vorhanden (`metaculus`, Key `SR_METACULUS_KEY`). **Offen:** Erlaubnis für die nicht-kommerzielle Nutzung über das Data-Needs-Formular anfragen.

## Reddit

- **Nutzungsbedingungen:** Reddit Data API Terms und Developer Terms: nicht-kommerziell mit registrierter App, kommerziell nur mit Vertrag; keine gelöschten Inhalte speichern (hier nur Zählwerte). User-Agent im Reddit-Format.
- **Pflicht-Quellenangabe:** „Reddit“.
- **Status im Repo:** Collector vorhanden (`reddit-json`, Keys `SR_REDDIT_USER` = client_id, `SR_REDDIT_PASS` = client_secret).

## The Shadowserver Foundation

- **Nutzungsbedingungen:** nicht CC BY. Laut https://www.shadowserver.org/privacy-and-terms/ sind „graphs; charts; and other aggregated data points“ Restricted Content; die Lizenz deckt „Non-Profit Research“ und „Organizational Defense and Research“. Für weitere veröffentlichte Verbreitung: „(1) Shadowserver's copyright notice; (2) a link to the Shadowserver Website; and (3) the Shadowserver trademarked logo.“
- **Pflicht-Quellenangabe:** `© The Shadowserver Foundation` mit Link https://www.shadowserver.org/ und Logo (Logo zeigt das Dashboard noch nicht).
- **Status im Repo:** Collector vorhanden (`shadowserver`, kein Key). **Offen:** Ob die öffentliche Dashboard-Statistik darunter fällt; Shadowserver fragen. Registry-Status `pending-terms`.

## AlienVault OTX

- **Nutzungsbedingungen:** https://otx.alienvault.com/terms nicht lesbar (nur JavaScript), ungeprüft.
- **Pflicht-Quellenangabe:** „AlienVault OTX“.
- **Status im Repo:** Collector vorhanden (`otx`, Key `SR_OTX_KEY`).

## aisstream.io

- **Nutzungsbedingungen:** keine Terms-Seite gefunden.
- **Pflicht-Quellenangabe:** keine vorgeschrieben; genannt wird „aisstream.io“.
- **Status im Repo:** Collector vorhanden (`aisstream`, Key `SR_AISSTREAM_KEY`).

## FAA (NOTAM API, NAS Status)

- **Nutzungsbedingungen:** US-Regierungsdaten, gemeinfrei.
- **Pflicht-Quellenangabe:** keine feste Formel; „Quelle: FAA“.
- **Status im Repo:** Collectors vorhanden (`faa-notam` mit `SR_FAA_NOTAM_USER`/`SR_FAA_NOTAM_PASS`, `faa-nas` ohne Key).

## Space-Track.org

- **Nutzungsbedingungen:** Space-Track User Agreement: keine Weitergabe der Rohdaten an Dritte (hier nur Tageszahlen). API-Richtlinien: < 30 Requests/min, < 300/h, Klasse DECAY höchstens 1×/Tag.
- **Pflicht-Quellenangabe:** „Space-Track.org“.
- **Status im Repo:** Collector vorhanden (`space-track`, `SR_SPACE_TRACK_USER`/`SR_SPACE_TRACK_PASS`), Login per POST seit 20.11.2026; Login-Antworten werden nie aufgezeichnet.

## alerts.in.ua

- **Nutzungsbedingungen:** keine ausdrückliche Lizenz; laut API-Doku Token geheim halten und nur über das Backend abrufen; 8–12 Requests/min.
- **Pflicht-Quellenangabe:** keine vorgeschrieben; empfohlen „alerts.in.ua“.
- **Status im Repo:** Collector vorhanden (`alerts-in-ua`, Key `SR_ALERTS_IN_UA_KEY`).
