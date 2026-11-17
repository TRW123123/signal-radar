# Beitragen

Beiträge sind vor allem neue Quellen (Collectors), neue Signale und neue Szenarien. Die technischen Regeln stehen im [Collector-Guide](docs/COLLECTOR-GUIDE.md), die Bewertungslogik in [SCORING.md](docs/SCORING.md). Diese Datei nennt die Regeln, ohne die eine Quelle nicht aufgenommen wird.

## Regeln für neue Quellen

1. **Nur passiv.** Es werden nur Daten gelesen, die der Betreiber öffentlich bereitstellt. Kein Scannen, Proben oder Testen fremder Systeme, keine Exploits, kein Umgehen von Logins, Bezahlschranken oder Rate-Limits.
2. **Nur öffentlich.** Zugang ohne Key oder mit einem frei beantragbaren Key. Keys stehen nie im Code: im Collector `needsKey: 'SR_<DIENST>_KEY'` setzen und per `ctx.key(...)` lesen. Ohne Key wird der Collector übersprungen. Quellen, die Geld oder ein Konto verlangen, vorher mit dem Maintainer klären und in `docs/KEYS-NEEDED.md` aufnehmen.
3. **Keine Personen.** Nur Aggregate und Daten zu Organisationen, Infrastruktur, Märkten und Netzen. Keine Personenprofile, kein Verfolgen einzelner Personen oder ihrer Fahrzeuge, keine Inhalte einzelner Social-Media-Konten.
4. **Lizenz und Nutzungsbedingungen nennen.** Im Kopfkommentar des Collectors und im Feld `license` des Signals. Ist die Lage unklar, offen als „unklar“ eintragen (Liste: `docs/LICENSE-TODO.md`), nichts raten. Rate-Limits einhalten, kleine Antworten anfordern, den vom HTTP-Client gesetzten User-Agent nicht ändern.
5. **Evidenzklasse begründen.** Jedes Signal bekommt eine Klasse mit Begründung im Kopfkommentar:
   - A: unabhängige Messung durch Dritte,
   - B: selbstgemeldete Betriebsdaten oder Pflichtmeldungen,
   - C: offizielle Aussagen und Presse, nur als Kontext, nie gewertet,
   - D: Aufmerksamkeit (Suchtrends, Seitenaufrufe, Foren), nie in der Stufe.
   Ebenso begründet: `manipulability` (wie leicht lässt sich die Quelle fälschen oder abschalten), `independenceGroup` (gleiche Upstream-Quelle, gleiche Gruppe) und die bekannten harmlosen Ursachen für Ausschläge.
6. **Ein Satz für Laien.** Jedes Signal hat `plain`: ein deutscher Satz, der ohne Fachwissen erklärt, was gemessen wird.
7. **Test mit echter Antwort.** Der Parser ist eine exportierte, reine Funktion und wird in `tests/collectors/<id>.test.ts` gegen eine **echte** aufgezeichnete Antwort geprüft: Aufzeichnung unter `fixtures/<quelle>/<name>` (Wunsch in `fixtures/queue/<collector>.json`, Aufzeichnen mit `SR_FIXTURES=record`), Prüfung mit `SR_FIXTURES=replay node src/cli.ts run --now-from-fixtures --only <id>`. Ein aus der Doku nachgebautes Beispiel ist nur ein Zwischenstand, im Test als solches kommentiert, und der Kopfkommentar trägt dann `VERIFIED: nein` (oder `teilweise`) mit Grund. `VERIFIED: ja` setzt eine echte Antwort voraus. Der Test prüft auch leere Antwort und fehlendes Feld.
8. **Keine neuen Abhängigkeiten.** Kein npm-Paket, kein eigenes `fetch`, kein Dateizugriff im Collector (siehe [ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Ablauf

1. Quelle in `catalog/` eintragen oder prüfen, ob sie dort schon steht (`python3 -I scripts/catalog_show.py <szenario> <collector>` zeigt, was der Katalog weiß).
2. Collector und Test schreiben, `npm test` muss grün sein.
3. `python3 -I scripts/status_report.py` ausführen, damit `docs/STATUS.md` den neuen Collector mit seinem `VERIFIED`-Vermerk zeigt.
4. In der Beschreibung des Beitrags nennen: Quelle, Lizenz, Evidenzklasse samt Begründung, welche Antwort aufgezeichnet wurde, was ungeprüft bleibt.

## Ehrlichkeit vor Vollständigkeit

Ein Signal, dessen Wirkung nicht belegt ist, wird nicht als belegt dargestellt. Meldet ein Parser einen Teilausfall, dann nie als Messwert (ein fehlender Summand sieht wie ein Einbruch aus). Stößt jemand auf eine Schwäche der Methode, gehört sie in `docs/OPEN-QUESTIONS.md` oder in den Backtest-Bericht, nicht in eine Gewichtsänderung ohne Begründung.
