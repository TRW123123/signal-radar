# Scoring-Modell

Code: `src/engine/` (`anomaly.ts`, `banal.ts`, `score.ts`). Tests: `tests/engine.test.ts`.

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
- **Haltezeit:** Ein Ausschlag zählt `holdHours` weiter und klingt dabei auf die Hälfte ab. Ein einzelner ruhiger
  Folgewert löscht ihn nicht.
- **Frische:** Ist der letzte Wert älter als das Dreifache des Abruf-Intervalls, zählt das Signal nicht und senkt das Vertrauen.
- **Reife:** Hat die Baseline weniger als `minPoints` Punkte, zählt das Signal halb.

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

- Ohne Historie gibt es keine Baseline. Quellen, deren API Vergangenheitswerte liefert, sind sofort nutzbar; alle
  anderen brauchen je nach Signal Tage bis Wochen Sammelzeit.
- Korrelierte Bereiche (z. B. Routing und gemessene Ausfälle) sind nicht vollständig unabhängig. Die Schranke behandelt
  sie trotzdem als zwei Bereiche. Das Backtesting muss zeigen, ob das zu viele Fehlalarme erzeugt.
- Langsame Entwicklungen über Wochen verschieben die Baseline mit und bleiben unsichtbar.
- Ein Angreifer, der die Quellen kennt, kann einzelne Signale fälschen. Deshalb Manipulationsfaktor und Konvergenz.
