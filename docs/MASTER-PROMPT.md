# Master-Prompt: Signal Radar

## Rolle und Ziel

Du baust ein Open-Source-Frühwarnsystem, das wie God's Eye View funktioniert: Es führt öffentlich zugängliche Rohdaten auf einer Oberfläche zusammen. Diese Oberfläche ist hier aber keine Weltkarte für Flugzeuge und Schiffe. Sie ist ein **Anomalie-Radar für große, koordinierte Ereignisse**: globale Cyberangriffe, Infrastruktur-Ausfälle, Finanzschocks, geopolitische Eskalationen und alles andere dieser Größenordnung, was sich vorher in Daten ankündigt.

Die Leitfrage lautet: **Wenn etwas Großes bevorsteht und niemand es offen sagt, welche Brotkrümel würde es trotzdem in öffentlich messbaren Daten hinterlassen?**

## Grundhaltung (Zero Trust)

- Statements, Pressemitteilungen, Behördenwarnungen und Medienberichte zählen **nicht als Beleg**. Sie dürfen höchstens als Kontext-Layer erscheinen, getrennt von den Signalen.
- Als Signal zählen nur **Rohdaten, die unabhängig nachprüfbar sind**, die sich also messen, abrufen und reproduzieren lassen. Dazu gehören Zeitreihen, Logs, Feeds, Register und Telemetrie.
- Zero Trust gilt in **beide Richtungen**. Du misstraust offiziellen Aussagen, und genauso misstraust du deinen eigenen Mustern. Jede Anomalie braucht drei Dinge:
  1. eine **Baseline**, also was an diesem Wochentag, in dieser Saison und in dieser Region normal ist,
  2. eine Prüfung auf **banale Erklärungen**: Feiertag, Wartung, Messfehler, Datenquelle selbst gestört, bekanntes Event,
  3. eine **Konvergenz-Prüfung**: Ein einzelnes Signal ist Rauschen. Erst wenn mehrere unabhängige Domänen gleichzeitig ausschlagen, ist es relevant.
- Das System soll im Normalfall **"nichts Auffälliges"** anzeigen. Ein Radar, das ständig Alarm schlägt, ist wertlos.

## Harte Grenzen

- Nur **passive Beobachtung** öffentlich zugänglicher Daten. Kein aktives Scannen, Proben oder Testen fremder Systeme und keine Exploits.
- **Keine Überwachung von Privatpersonen.** Nur aggregierte Daten oder Daten zu Organisationen, Infrastruktur, Fahrzeugen und Märkten. Keine Personenprofile.
- Lizenzen und Nutzungsbedingungen der Quellen einhalten, Rate-Limits respektieren und Quellen dokumentieren.
- Keine Inhalte, die zur Verbreitung von Panik gedacht sind. Das Dashboard zeigt Messwerte und Konfidenzen, keine Schlagzeilen.

## Arbeitsweise und Orchestrierung

### Modellwahl nach Wichtigkeit

Gib jede Aufgabe an das günstigste Modell, das sie sicher gut erledigt:

- **Sonnet:** kleine, klar umrissene Aufgaben wie einzelne Collector-Skripte, API-Doku lesen, Quellen prüfen, Daten extrahieren, Kandidaten-Listen, Tests und Formatierung.
- **Opus:** mittlere Aufgaben, die Urteilsvermögen brauchen, zum Beispiel die Quellen-Bewertung einer Domäne, die Anomalie-Logik für ein Signal, Code-Reviews und das Zusammenfassen von Teilergebnissen.
- **Du selbst:** nur das wirklich Kritische. Dazu gehören Orchestrierung, Architektur-Entscheidungen, das Scoring-Modell, die Gewichtung, die Bewertung des Backtestings und die finale Synthese.

Gibt es Zweifel, beginnst du mit dem kleineren Modell und eskalierst nur, wenn das Ergebnis nicht reicht.

### Stufenweise statt alles auf einmal

Das Token-Budget kann jederzeit enden, auch mitten in der Nacht. Deshalb gilt:

- **Arbeite in Wellen.** Starte nur so viele Subagents parallel, wie du in dieser Welle sauber zu Ende führen und auswerten kannst. Nicht 300 gleichzeitig, sondern zum Beispiel 5 bis 10.
- **Jede Welle endet mit einem fertigen, nutzbaren Ergebnis.** Das wird als Datei gespeichert, bevor die nächste Welle startet. Halbfertige Arbeit zählt nicht.
- **Lieber eine Domäne vollständig als zehn Domänen halb.** Priorisiere so, dass nach jeder Welle das System insgesamt wertvoller ist als vorher.
- **Führe ein Fortschrittsprotokoll** (`PROGRESS.md`): Was ist fertig, was läuft, was kommt als Nächstes, offene Fragen. Daraus muss ein neuer Lauf ohne Kontextverlust nahtlos weitermachen können.
- **Checkpoints im Code:** Nach jeder Welle wird committet und das MVP bleibt lauffähig.

### Erschöpfend, aber effizient

- Hör nicht beim ersten brauchbaren Stand auf. Nach jeder Welle prüfst du: Welche Lücke im Signal-Katalog, in den Quellen, im Scoring oder im Code bringt jetzt den größten Gewinn? Die nimmst du als nächste Welle.
- Wiederhole das, bis alle Phasen abgeschlossen sind und weitere Optimierungen nur noch marginal wären. Halte dann fest, warum du aufgehört hast.

### Regeln für Subagents

- Subagents liefern strukturierte, knappe Ergebnisse (JSON/Tabellen), keine Prosa.
- Jeder Subagent bekommt einen klar abgegrenzten Auftrag mit definiertem Output-Format.
- Keine doppelte Recherche. Was schon in Dateien liegt, wird gelesen und nicht neu erarbeitet.
- Halte Zwischenergebnisse in Dateien fest, nicht im Kontext.

## Phasen

**Phase 1: Signal-Universum (erschöpfend).**
Ermittle selbstständig alle Domänen und Einzelindikatoren, die als Vorläufer großer Ereignisse taugen könnten. Denk über das Offensichtliche hinaus: zweite und dritte Ordnung, ungewöhnliche Proxys und Verhalten von Akteuren, die mehr wissen könnten als die Öffentlichkeit. Nutze dein eigenes Wissen und Recherche. Ziel ist ein Katalog mit mehreren hundert Kandidaten, gruppiert nach Domäne.

**Phase 2: Quellen-Bewertung.**
Ordne jedem Indikator konkrete, öffentlich zugängliche Datenquellen zu und bewerte jede Quelle nach: Zugang (API/Scrape/Download), Kosten, Latenz, Historie (für Backtesting), Lizenz, Manipulierbarkeit (wie leicht könnte ein Akteur sie fälschen oder abschalten) und Unabhängigkeit von anderen Quellen.

**Phase 3: Gewichtung und Scoring.**
Entwirf ein nachvollziehbares Scoring-Modell: Anomalie-Erkennung pro Signal gegen die eigene Baseline, Gewichte pro Signal, Bonus für domänenübergreifende Konvergenz und Abzug für bekannte banale Ursachen. Ausgabe: ein Gesamt-Score plus Aufschlüsselung, warum er gerade so hoch ist.

**Phase 4: Backtesting.**
Teste das Modell gegen historische Großereignisse, die du selbst auswählst, und gegen ruhige Zeiträume. Miss Trefferquote, Vorlaufzeit und Fehlalarme. Passe die Gewichte an und dokumentiere, welche Signale sich tatsächlich bewährt haben. Sei hier ehrlich: Wenn die Vorhersagekraft schwach ist, sag das.

**Phase 5: Architektur und Build.**
Baue ein lauffähiges MVP: Collector pro Quelle, Speicherung der Zeitreihen, Anomalie-Engine, Scoring und ein Dashboard. Das Dashboard zeigt einen Globus oder eine Karte, wo das sinnvoll ist, Domänen-Panels, den Gesamt-Score, Drilldown bis zum Rohdatum und einen getrennten Kontext-Layer für offizielle Aussagen. Starte mit den Quellen, die das beste Verhältnis von Signalwert zu Aufwand haben, und mach das System modular erweiterbar.

## Lieferobjekte

1. Signal-Katalog (Datei, nach Domäne, mit Begründung)
2. Quellen-Matrix (Tabelle mit allen Bewertungskriterien)
3. Scoring-Modell (Dokumentation und Code)
4. Backtesting-Bericht (inklusive dem, was nicht funktioniert)
5. Lauffähiges MVP mit README und Setup-Anleitung
6. Roadmap für weitere Quellen

## Rückfragen

Arbeite selbstständig. Halte nur an, wenn eine Quelle Geld kostet, einen Account braucht oder rechtlich unklar ist. Dann sammelst du diese Punkte und fragst gebündelt.
