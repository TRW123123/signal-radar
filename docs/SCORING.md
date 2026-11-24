# Scoring-Modell

Code: `src/engine/` (`anomaly.ts`, `banal.ts`, `score.ts`). Tests: `tests/engine.test.ts`.
Messung der Schwellen an den Live-Daten: `docs/CALIBRATION.md` (erzeugt von `node src/backtest/calibrate.ts`).
Die Zahlen in den Sätzen „liegt dort, weil …" stammen aus der Kalibrierung vom 24.11.2026 (30 Tage, 68 eingeschwungene
Signale, 32 Bereiche mit Daten) und sind wegen der kurzen Datenbasis als Größenordnung zu lesen.

## Zielvorgabe

Die Schwellen werden aus einer festgelegten Fehlalarm-Rate abgeleitet, nicht umgekehrt:

- Eine einzelne Messung gilt höchstens an etwa **1 von 50** Vergleichszeitpunkten als ungewöhnlich (2 %).
- Ein Bereich ist höchstens etwa **5 % der Zeit** „ungewöhnlich".
- Stufe 2 oder höher kommt in ruhigen Zeiten höchstens etwa **1 % der Zeit** vor (rund 7 Stunden im Monat).

Begründung: Ein Radar ist nur so viel wert wie sein Ruhezustand. Bei rund 150 Messungen pro Stunde liefert 1 von 50
schon drei Einzel-Auffälligkeiten pro Stunde; das ist vertretbar, weil eine einzelne Messung nie allein eine Stufe hebt.
Ein Bereich, der öfter als eine Stunde von zwanzig abweicht, sagt nichts mehr. Stufe 2 bedeutet „zwei unabhängige
Bereiche gleichzeitig" und muss selten bleiben, sonst lernen Leser, sie zu übergehen.

## Was der Wert bedeutet

Der Wert eines Szenarios sagt: **Wie ungewöhnlich sind die Messwerte gerade, verglichen mit ihrem eigenen Normalzustand,
und in wie vielen unabhängigen Bereichen gleichzeitig?** Er ist keine Wahrscheinlichkeit und keine Vorhersage.
Der Normalfall ist „Ruhig“. Ein Radar, das dauernd Alarm zeigt, ist wertlos.

## Zero Trust in beide Richtungen

1. **Aussagen sind kein Beleg.** Evidenzklasse C (Behörden, Presse, Advisories) wird nie gewertet und erscheint nur als
   Kontext. Gewertet werden Klasse A (unabhängige Messung) und Klasse B (selbstgemeldete Betriebsdaten und
   Pflichtmeldungen, Faktor 0,8).
2. **Den eigenen Mustern misstrauen.** Jede Abweichung braucht eine Baseline, eine Prüfung auf harmlose Ursachen und
   Konvergenz über unabhängige Bereiche.

## Schritt 1: Abweichung pro Signal

Für jede Beobachtung wird eine Baseline **nur aus der Vergangenheit desselben Signals** gebildet:

- Fenster `windowDays` (Standard 28 Tage), optional saisonal (`hour-of-week`, `day-of-week`), damit Tages- und
  Wochengang nicht als Anomalie zählen.
- Zentrum = Median, Streuung = MAD × 1,4826. Beides ist robust: ein alter Vorfall im Fenster verschiebt die Baseline kaum.
- Untergrenzen für die Streuung: 5 % des Zentrums, bei Zählreihen √Zentrum (Poisson-Rauschen), sonst explodiert z bei
  flachen Reihen.
- **Schiefe Reihen:** Stoßweise Reihen (Zählungen mit Sammelveröffentlichungen) liegen regelmäßig weit über dem Median.
  Deshalb wird die Streuung je Seite um die Spanne des eigenen oberen bzw. unteren Zehntels erweitert
  (`(q90 − Median) / 1,2816` nach oben, `(Median − q10) / 1,2816` nach unten). „Ungewöhnlich" heißt: mehr als diese
  Reihe regelmäßig zeigt.
- `z = (Wert − Zentrum) / Streuung`, gerichtet (`up`, `down`, `both`).
- Anomalie `a` = weiche Rampe zwischen `z0` und `z1`. Profil `high` (aktuell): `z0 = 2,5`, `z1 = 7`, gelistet ab `z ≥ 2`.
  Profil `normal`: `z0 = 3,5`, `z1 = 8`.
  **`z0 = 2,5` liegt dort, weil** eingeschwungene Signale (mindestens 60 Vergleichspunkte) bei 2,5 im Mittel 2,3 % der
  Zeit darüber liegen, mit den signal-eigenen Schwellen 1,8 %, also etwa 1 von 55. Bei 3 wären es 1,8 % (ohne eigene
  Schwellen), bei 2 schon 3,8 %. Das Ziel 1 von 50 liegt zwischen 2,5 und 3; der Unterschied ist kleiner als die
  Messunsicherheit, und die niedrigere Schwelle zeigt echte Ausschläge früher.
  Die Listen-Schwelle `z ≥ 2` liegt dort, weil eingeschwungene Signale sie 3,8 % der Zeit erreichen: oft genug, um
  Ausschläge früh sichtbar zu machen, aber sie zählen erst ab 2,5.
- **Signal-eigene Schwellen** (`thresholds.z0` in der Deklaration) für Reihen, die von Natur aus stoßweise sind. Sie
  liegen am eigenen 1-von-50-Punkt der Reihe. Beispiel: ThreatFox und URLhaus (stündliche Zählungen mit
  Sammel-Importen) haben `z0 = 10`, **weil** 2 % ihrer Stunden z ≈ 10 erreichen. Mit 2,5 lagen sie 11,2 % bzw. 5,1 %
  der Stunden über der Schwelle und hielten den Bereich Angriffs-Telemetrie 17 % der Zeit auf „ungewöhnlich"; mit 10
  sind es 2,1 % bzw. 2,2 % und 4,7 %.
- **Haltezeit:** Ein Ausschlag zählt `holdHours` weiter und klingt dabei auf die Hälfte ab. Ein einzelner ruhiger
  Folgewert löscht ihn nicht.
- **Frische:** Ist der letzte Wert älter als das Dreifache des Abruf-Intervalls, zählt das Signal nicht und senkt das Vertrauen.
- **Mindestgröße:** Unter 7 Vergleichswerten wird ein Signal nicht bewertet (`BASELINE_RULES.minValues`). **Das liegt
  dort, weil** Baselines mit 3 bis 6 Werten 5,3 % aller Vergleiche über die Schwelle hoben, 2,6-mal das Ziel, und
  einzelne junge Reihen (Satelliten-Hitzepunkte am Golf mit 3 Tageswerten) einen ganzen Bereich 6 % der Zeit auf
  „ungewöhnlich" hielten. 7 entspricht einer Woche Tageswerte.
- **Reife:** Hat die Baseline weniger als `minPoints` Punkte, zählt das Signal halb. Das bleibt nötig: Auch mit 7 bis
  27 Werten liegen noch 4 bis 6 % der Vergleiche über der Schwelle, ab 28 Werten unter 1,5 %.

## Schritt 2: Harmlose Ursachen

`catalog/banal-rules.json` enthält bekannte Erklärungen als Daten: Patch-Dienstag, Monatswechsel im Zahlungsverkehr,
angekündigte Warntests, geomagnetische Stürme (dämpfen GPS- und Funk-Signale), Wartungsfenster am Wochenende.
Eine passende Regel multipliziert die Anomalie mit `factor` und der Grund wird angezeigt. Neue Regeln brauchen keinen Code.

## Schritt 3: Beitrag eines Signals

`Beitrag = Gewicht × Klassenfaktor × Manipulationsfaktor × Anomalie × Dämpfung × Reife`

- `Gewicht` (0–1): wie spezifisch ein voller Ausschlag für das Szenario ist.
- `Manipulationsfaktor`: `low` 1, `medium` 0,8, `high` 0,55. Wie leicht könnte jemand die Quelle fälschen oder abschalten?

## Schritt 4: Bereiche und Unabhängigkeit

Signale gehören zu einem Bereich (`domain`, z. B. Internet-Routen, Zahlungsverkehr). Innerhalb eines Bereichs zählt pro
Quelle (`independenceGroup`) nur das stärkste Signal, damit zehn Kennzahlen derselben Quelle nicht wie zehn Belege wirken.
Der Bereichswert ist ein Noisy-OR der Gruppen: `1 − Π(1 − Beitrag)`. Ein Bereich gilt ab 0,25 als „weicht ab“.
**Die Grenze 0,25 liegt dort, weil** ein Bereich mit Daten damit gepoolt 0,2 % der Zeit abweicht und der lauteste
Bereich (Angriffs-Telemetrie) 4,7 %, also im Ziel von 5 %. Bei 0,15 wären es gepoolt 3,1 %, bei 0,1 schon 7,1 %. Eine
Quelle mit mittlerem Gewicht (Beitrag 0,5 bei vollem Ausschlag) erreicht 0,25 erst bei halbem Ausschlag, also klar
jenseits der Einzelschwelle.

## Schritt 5: Konvergenz-Schranke

`Szenario = NoisyOR(Bereichswert × Bereichsgewicht) × Schranke(n)`, `n` = Zahl der abweichenden Bereiche:

| abweichende Bereiche | Schranke | höchste erreichbare Stufe |
|---|---|---|
| 0 | 0,11 | 0 Ruhig (Unruhe unter der Grenze erreicht nie Stufe 1) |
| 1 | 0,29 | 1 Leicht erhöht |
| 2 | 0,54 | 2 Erhöht |
| 3 | 0,77 | 3 Hoch |
| 4 und mehr | 1,00 | 4 Akut |

Stufen: `< 0,12` Ruhig, `< 0,30` Leicht erhöht, `< 0,55` Erhöht, `< 0,78` Hoch, sonst Akut.
Ein einzelner Bereich kann also nie mehr als „Leicht erhöht“ auslösen, egal wie stark er ausschlägt.

**Die Stufen-Grenzen und die Schranke liegen dort, weil** sie zusammen die Konvergenz-Regel umsetzen: Die Schranke für
n abweichende Bereiche liegt jeweils knapp unter der Grenze von Stufe n + 1 (0,11 < 0,12, 0,29 < 0,30, 0,54 < 0,55,
0,77 < 0,78). Sie sind aus der Konstruktion hergeleitet, nicht aus Häufigkeiten. Die Messung prüft, ob das Ziel hält:
In 30 Tagen war Stufe 2 oder höher nie erreicht (Ziel ≤ 1 %), Stufe 1 in ruhiger Zeit im Mittel 0,2 % und im lautesten
Szenario (Cyber) 1,2 % der Zeit; der höchste Szenario-Wert außerhalb bekannter Ereignisse war 0,153. Vor der
Kalibrierung waren es 2,7 % und 9,1 % (Krieg, getragen von einer drei Tage alten Satelliten-Reihe). Feiner lassen sich
die Stufen 2 bis 4 erst kalibrieren, wenn sie in den Daten vorkommen.

## Schritt 6: Gerede gegen Messung

Klasse D (Suchtrends, Seitenaufrufe, Foren) fließt **nicht** in den Szenario-Wert. Sie bildet den getrennten
Aufmerksamkeits-Wert. Daraus entsteht `rumorGap`:

- `talk-no-data`: viel Aufmerksamkeit (≥ 0,35), Messwerte unter Stufe 2. Typisch für ein virales Gerücht.
- `data-no-talk`: Messwerte ab Stufe 2, kaum Aufmerksamkeit (< 0,15). Der eigentlich interessante Fall.
- `both`: beides erhöht.

## Schritt 7: Vertrauen

`Vertrauen = Gewicht der Signale mit frischen Daten und Baseline / Gewicht aller wertbaren Signale des Szenarios`
(unreife Baselines zählen halb, geplante Signale ohne Collector zählen als fehlend). Unter 0,15 lautet die Aussage
„Noch zu wenig Messdaten“.

## Nachvollziehbarkeit

Der Verlauf im Dashboard wird nicht gespeichert, sondern aus denselben Rohdaten für vergangene Zeitpunkte neu
berechnet (`src/pipeline/snapshot.ts`). Wer die Rohdaten hat, bekommt dieselben Werte.

## Bekannte Grenzen

- Die Kalibrierung beruht auf einer Woche Live-Betrieb und je Quelle sehr unterschiedlich langer API-Historie (Median
  28 Tage). Sie ist monatlich zu wiederholen (`node src/backtest/calibrate.ts --before backtest/results/calibration.json`);
  Signale, die heute nur wegen kurzer Historie laut sind, bekommen erst danach eine eigene Schwelle.
- Ohne Historie gibt es keine Baseline. Quellen, deren API Vergangenheitswerte liefert, sind sofort nutzbar; alle
  anderen brauchen je nach Signal Tage bis Wochen Sammelzeit.
- Korrelierte Bereiche (z. B. Routing und gemessene Ausfälle) sind nicht vollständig unabhängig. Die Schranke behandelt
  sie trotzdem als zwei Bereiche. Das Backtesting muss zeigen, ob das zu viele Fehlalarme erzeugt.
- Langsame Entwicklungen über Wochen verschieben die Baseline mit und bleiben unsichtbar.
- Ein Angreifer, der die Quellen kennt, kann einzelne Signale fälschen. Deshalb Manipulationsfaktor und Konvergenz.
