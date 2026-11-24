# Kritik Runde 7 – Signal Radar (24.11.2026, unabhängige Prüfung)

Bilder in /tmp/k7/: `m_*.png` (erster Handy-Bildschirm), `m_en.png`, `d_home.png` (Desktop), `full_0..2.png` (ganze Handy-Seite), `f_{war,cyber,fin}_{4,9,14,back}.png` (Vergleich), `t_point.png`, `t_diamond.png`, `t_g.png`.
Konsolenfehler: keine (Laden aller Ansichten, Vergleich, Antippen, /g/-Seite).

## 5-Sekunden-Test (erster Handy-Bildschirm `/`)
- (a) Verkäuferin, 17.11.: „Nein. Kein großer Cyberangriff“ und darunter der lila Kasten „Weltweiter Cyberangriff am 17. November 2026?“. **Voll** verstanden.
- (b) Azubi (TikTok): Die Antwort kommt an. Der Globus ist aber unbewegt und zeigt vor allem lila Rauten, darüber stehen 3 Zeilen Legende. Wirkt „nix los“, er teilt es nicht. **Halb.**
- (c) IT-Admin: Zweck, Stufe, „0 von 9 Bereichen“ und Open Source sind klar. **Voll.** (Später stolpert er über VIX 35,9 = „normal“, siehe Fehler 1.)
- (d) Rentner: „Wer macht das? Was ist ein Open-Source-Projekt?“ Im ersten Bildschirm steht weder ein Absender noch eine Quelle. Die Raute „Russland: Internet-Störungen stark“ verunsichert ihn eher. **Halb.**
- (e) Journalistin: Frage, Antwort, Gerücht mit Datum, Stand und Teilen-Knopf sind da. **Voll.**

**3 von 5** (wie in Runde 6).

## Noten
| Sofort-Verständnis | Mehrwert | Globus-Wirkung | Sprache | Vertrauen | Teilbarkeit | Handy |
|---|---|---|---|---|---|---|
| 7 | 6 | 5 | 7 | 5 | 6 | 7 |

## Bedienwege
- **Vergleich Krieg (Israel–Iran 2025):** Gut. Nach 4 s steht „Tag 3: Luftalarme in Israel weit außerhalb des Normalen“ mit rotem Punkt über Israel. Nach 14 s folgen Tag 6 und das Fazit über dem Globus: „Radar am 15.6. auffällig, 2 Tage nach Beginn … keine Vorwarnung“. Das ist verständlich und ehrlich. Schwäche: Selbst im Krieg erreicht die Anzeige nur „Mehrere Auffälligkeiten“ (Stufe 2 von 4). Ein Laie fragt sich dann, was das „Nein“ von heute wert ist. Unten ist die Beschriftung „Gestörte Webseiten in Israel (+2)“ am Bildrand abgeschnitten. Der Knopf „Zurück zu jetzt“ stellt den Live-Zustand vollständig wieder her (LIVE, Antwort, Knöpfe).
- **Vergleich Cyber:** Gezeigt wird der „Netzausfall Kanada 2022“ (Rogers). Das war kein Angriff, sondern ein Wartungsfehler. Auf der Seite steht das nirgends, obwohl der Text direkt davor „Bei einem echten Großangriff …“ sagt. Das ist irreführend. Dabei steht mit „Hackerangriff US-Kliniken 2024“ ein passender Fall in der Liste. Bei Tag 1 steht außerdem „Einzelne Auffälligkeit · 2 Bereiche ungewöhnlich“, das widerspricht der eigenen Regel (siehe Fehler 2).
- **Vergleich Finanzen (Bankenkrise USA 2023):** Passt zum Thema und ist ehrlich benannt. Zu sehen ist aber nur 1 Bereich mit „Einzelne Auffälligkeit“, also wenig Wirkung.
- **Punkt „11“ antippen:** Es öffnet sich ein Blatt „11 Messungen: US-Börsen, New York“. Die Zählung „1 etwas erhöht, 10 normal“ stimmt mit der Farbe überein. Allerdings steht VIX zweimal darin („Wie nervös die US-Börse insgesamt ist“ und „Marktangst“, beide 35,9), und beide gelten als „normal“.
- **Lila Raute antippen:** Ein Hinweis in Worten erscheint: „Russland · Internet-Störungen: stark“. Das ist lesbar, erklärt aber nicht, warum das neben „kein Cyberangriff“ steht (Sperren durch den Staat? zählt nicht?).
- **/g/weltweiter-cyberangriff-17-november/:** Sauber gegliedert („Was behauptet wird / Was Faktenprüfer sagen / Was am Ende passiert ist“) und gut lesbar.

## Fehler (nach Schwere)
1. **Sachlich irreführend: VIX 35,9 gilt als „normal“.** Die eigene Basislinie liegt bei 19,4 (Streuung 4,9), der Wert ist also z ≈ 3,4. Die VIX-Terminstruktur steht bei 1,16 gegenüber normal 0,94; das ist Backwardation, ein klassisches Stresszeichen. Trotzdem steht im Blatt „US-Börsen, New York“ „normal“. Im Thema **Finanzkrise** haben die Messungen `finance.volatility.vix` und `vix_term_structure` den Wert `null`. Ausgerechnet dort fehlt also der Angstindex, und das Thema zeigt „0 von 6 ungewöhnlich“. Ein Fachmann verliert hier das Vertrauen.
2. **Widerspruch Stufe und Regel:** Im Cyber-Rückblick am 8.7.2022 steht „Stufe damals: Einzelne Auffälligkeit · 2 Bereiche ungewöhnlich“. Die Regelkarte sagt aber „2 Bereiche → Mehrere Auffälligkeiten“. Im Krieg-Rückblick passt beides zusammen, hier nicht.
3. **Cyber-Vergleich zeigt keinen Angriff** (Rogers 2022 = Wartungsfehler) unter der Überschrift „so sah ein echter Ernstfall aus“, direkt nach dem Satz „Bei einem echten Großangriff …“.
4. **Doppelte Messung:** VIX erscheint im selben Blatt zweimal (35,9 „Punkte“ und 35,9 „Indexpunkte“). Das lässt die Zahl „97 Messungen“ größer wirken, als sie ist.
5. **„Hätte das Radar es gesehen?“**: „Bei 5 von 16 … schlug das Radar an … Es zeigt, ob etwas wirklich passiert, meist innerhalb weniger Stunden.“ Der zweite Satz verspricht mehr, als 5 von 16 hergeben.
6. **Gerücht-Kasten im Thema Finanzen passt nicht:** „Trump-Warnung: 90 Tage Vorräte“ ist kein Finanzgerücht. Im Thema Krieg fehlt der Kasten ganz, obwohl es /g/gehackte-warn-apps-atomwarnung… gibt.
7. **Abgeschnitten:** Gerücht-Texte enden mit „…“ (alle Themen, Handy). Die Beschriftung „Gestörte Webseiten in Israel (+2)“ ist am unteren Rand abgeschnitten. Die Zeile „Letzte Messung … Wie weit die größten Stableco…“ ist ebenfalls abgeschnitten.
8. **Legende:** Über dem Globus steht „Lila Rauten und Dreiecke … z. B. Erdbeben“, Erdbeben und Naturereignisse sind aber standardmäßig **aus**. Die Legende hat 3 Zeilen, das ist auf dem Handy zu viel.
9. **„Die Regel in einem Bild“:** Die Karten sind ungleich hoch, die Karte „2 Bereiche“ ist versetzt, dazu die Trennung „Auffälligkei-ten“ (aus Runde 6 noch offen).
10. Der Rentner findet keinen Absender oder Verantwortlichen im ersten Bildschirm.

## 6 schnelle Verbesserungen (je ≤ 20 Min.)
1. **VIX ehrlich zeigen:** Die doppelte Zeile entfernen. Liegt z > 2, „etwas erhöht“ anzeigen und den Satz „Börsen-Angstindex 35,9 – fast doppelt so hoch wie üblich (≈ 19)“ ausgeben. Im Thema Finanzen die `null`-Messungen ausblenden oder „keine Daten“ anzeigen, statt sie stumm mitzuzählen.
2. **Cyber-Vergleich tauschen** auf „Hackerangriff US-Kliniken 2024“. Wenn das nicht geht, den Knopf umbenennen: „Vergleich: so sah ein großer Netzausfall aus (Kanada 2022 – Technikfehler, kein Angriff)“.
3. **Stufe und Bereiche angleichen:** Im Rückblick die Stufe aus der Zahl der Bereiche ableiten. Alternativ den Zusatz zeigen: „2 Bereiche, davon 1 schwach – zählt als Einzelne Auffälligkeit“.
4. **Satz bei „Hätte das Radar es gesehen?“ ersetzen:** „Bei 5 von 16 großen Ereignissen schlug es an, oft erst nach Stunden. Ein ‚Nein‘ heißt: in den Messdaten ist jetzt nichts Großes zu sehen – nicht: es kann nichts passieren.“
5. **Raute erklären:** Im Hinweis eine zweite Zeile ergänzen: „Nur zur Orientierung – Störungen durch Sperren oder Technik zählen nicht als Angriff.“ Die Legende über dem Globus auf eine Zeile kürzen: „Punkte: Messungen (grün normal, gelb erhöht, rot ungewöhnlich). Lila: Internet-Störungen, nur zur Orientierung.“
6. **Gerücht-Kasten:** Im Thema Krieg den Kasten „Gehackte Warn-Apps / Atomwarnung“ zeigen. Im Thema Finanzen die Trump-Vorräte-Meldung durch ein Finanzgerücht ersetzen; wenn es keins gibt, den Kasten weglassen. Den Text auf 2 Zeilen ohne „…“ kürzen („Faktenprüfer: keine Belege. Grundlage war ein FEMA-Test.“).

## 3 größere Verbesserungen (später)
1. **Absender und Vertrauen im ersten Bildschirm:** „Gemacht von … · Quellen: z. B. Cloudflare, IODA, Yahoo Finance · ohne Werbung“ mit Link zur Methodik.
2. **Globus lebendig machen:** Langsame Drehung, aufleuchtende neue Messungen und ein kurzer automatischer Vergleich (3 s) beim ersten Besuch, damit der Kontrast ruhig/Ernstfall ohne Tippen sichtbar wird.
3. **Gewichtung prüfen:** Wenn selbst Israel–Iran nur Stufe 2 und SVB nur Stufe 1 erreicht, sind die Schwellen zu streng oder die Bereiche zu dünn. Ein Ernstfall muss im Vergleich deutlich „rot“ aussehen, sonst ist das „Nein“ wenig wert.
