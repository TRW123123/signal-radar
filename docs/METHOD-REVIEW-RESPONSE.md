# Antwort auf das Methodik-Review (Gemini, 17.11.2026)

Jeder Punkt wurde gegen den Code und die vorhandenen Daten geprüft. Übernommen wurde nur, was sich bestätigen ließ.

## Übernommen und umgesetzt

| Punkt | Befund nach Prüfung | Umsetzung |
|---|---|---|
| 1.1 Statusseiten teilen sich Cloud-Anbieter | **Teilweise richtig.** Innerhalb eines Bereichs zählten die Statusseiten schon als eine Quelle. Sie speisen aber zwei Bereiche (Dienste, Zahlungsverkehr) und hätten so allein zwei Bereiche „abweichen“ lassen können. | Neues Konzept `upstream` (`catalog/upstreams.json`): Signale mit gemeinsamem Ursprung zählen pro Bereich einmal, und ein Ursprung kann höchstens einen Bereich zur Konvergenz beitragen. |
| 1.2 FireHOL-Listen sind Teilmengen | **Richtig.** Die fünf Listen standen in fünf verschiedenen Unabhängigkeitsgruppen und wurden per Noisy-OR addiert. | Gemeinsamer Ursprung `firehol-attackers`. Unabhängig bleiben `cybercrime` und `tor_exits`. |
| 1.3 BGP-Daten aus denselben Route-Collectoren | **Richtig.** RIPEstat, GRIP und die BGP-Signale von IODA stehen auf RIPE RIS und RouteViews. Die IODA-Ping-Messung ist davon unabhängig. | Gemeinsamer Ursprung `bgp-ris-routeviews` für die Bereiche Routing und für die BGP-Signale von IODA. |
| 2.2 HN-Suche nach „is down“ | **Richtig.** Der Begriff trifft auch Titel wie „inflation is down“. `tags=story` und die Titelsuche waren bereits gesetzt. | Begriff entfernt. |
| 3 Oracle-Patchtag | **Richtig**, eine bekannte Ursache für Massen-Veröffentlichungen von Schwachstellen. | Dämpfungsregeln für die nächsten Termine. Die Termine sind nach der Oracle-Regel berechnet und müssen fortgeschrieben werden. |
| 3 Quartalsultimo im Geldmarkt | **Richtig.** Die bisherige Monatsende-Regel war schwächer. | Stärkere Dämpfung um die Quartalsenden 2026/27. |
| 3 Meldeverzug über die Feiertage (Pandemie) | **Richtig** für Wochen-Meldedaten. | Dämpfung 21.12.2026 bis 17.01.2027 für das Szenario Pandemie. |

Tests: zwei neue Engine-Tests decken den gemeinsamen Ursprung ab, die Suite bleibt grün.

## Richtig, aber noch nicht umgesetzt (Aufgaben)

- **1.4 Cyber-Aktienfonds gegen den Gesamtmarkt bereinigen** (Überrendite gegenüber einem Technologie-Index): sinnvoll. Dafür muss zusätzlich ein Vergleichsindex abgerufen werden. Die drei Fonds zählen bereits als ein Signal.
- **2.2 Polymarket über Kategorien und Veränderung der Wahrscheinlichkeit statt Suchbegriffe**: richtig, die Suche liefert 0 Treffer. Die Parameter `volume_num_min` und Kategorie-Tags müssen gegen die echte API geprüft werden.
- **2.3 GRIP ohne DDoS-Schutzanbieter zählen**: plausibel. Die ASN-Liste und das Feld `suspicion_level` sind gegen die echte Antwort zu prüfen.
- **2.4 Stromlast als Abweichung von der Prognose**: fachlich besser als der Rohwert. Die SMARD-Filter-Nummer für die Prognose ist noch zu belegen.
- **3 Ende der EZB-Mindestreserveperiode**: richtig. Die acht Termine pro Jahr müssen aus dem offiziellen EZB-Kalender übernommen werden, nicht geschätzt.
- **3 Radon-Auswaschung bei Regen**: richtig, sobald Strahlungs-Messdaten angebunden sind. Dafür braucht es ein Niederschlags-Signal am selben Ort.

## Nicht übernommen

- **2.1 Wikipedia-Artikel „Hacker“ einzeln**: trifft nicht zu. Der Artikel ist Teil einer Summe aus mehreren Artikeln, und die Gruppe zählt schon als Aufmerksamkeit (Klasse D) ohne Einfluss auf den Mess-Wert.
- **3 Patch-Dienstag**: gab es bereits.
- **3 Stundenwechsel in der Netzfrequenz**: bekannter Effekt. Die Regel lässt sich aber nicht auf eine Stunden-Kennzahl anwenden. Richtig wäre, das Messfenster im Collector so zu legen, dass es den Stundenwechsel nicht enthält.
