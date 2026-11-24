# Kritik Runde 8 – Signal Radar (24.11.2026, unabhängige Prüfung)

Bilder in /tmp/k8/: m-root, m-war, m-fin, m-bio (Handy, 1. Bildschirm), d-root (Desktop), m-root-full (ganze Seite), v-root-6/14, v-war-6/14 (Vergleich), g-liste (Karte US-Börsen). Texte: root.txt, fin.txt, war.txt, gruppe.txt.
Konsolenfehler/-warnungen: keine.

## 5-Sekunden-Test (erster Handy-Bildschirm `/`)
- (a) Verkäuferin: „Nein. Kein großer Cyberangriff“ + lila Kasten „Weltweiter Cyberangriff am 17. November 2026?“ – genau ihre Frage. **Voll.**
- (b) Azubi: Antwort kommt an, aber der Globus ist still (Rauten, drei Zahlen-Kreise, nichts rot, nichts bewegt sich). Der Vergleichs-Knopf – das eigentliche Spektakel – liegt bei `/` unter dem ersten Bildschirm. „Nix los“, kein Grund zu teilen. **Halb.**
- (c) IT-Admin: Stufe, „0 von 9 Bereichen“, Open Source, 93 Messungen, Stand vor 12 Min. **Voll.**
- (d) Rentner: Absender jetzt sichtbar („Unabhängiges Open-Source-Projekt“), aber das Wort sagt ihm nichts; kein Name, keine Quelle wie „Daten von …“. Das „Nein“ ohne Begründung im 1. Bildschirm wirkt wie Behauptung. **Halb.**
- (e) Journalistin: Frage, Antwort, Gerücht mit Datum, Quellen (IFLScience, Mimikama), Teilen. **Voll.**

**3 von 5.**

## Noten
| Sofort-Verständnis | Mehrwert | Globus-Wirkung | Sprache | Vertrauen | Teilbarkeit | Handy |
|---|---|---|---|---|---|---|
| 8 | 6 | 6 | 7 | 6 | 6 | 7 |

## Bedienwege
- Vergleich `/` (Kanada 2022): Knopf sagt jetzt ehrlich „technischer Fehler, kein Angriff“ (Fehler aus Runde 7 behoben). Nach 6 s „Am Tag davor: Alles ruhig“, nach 14 s roter Punkt Kanada + Fazit. Verständlich.
- Vergleich `/#war` (Israel–Iran): nach 14 s zwei rote Orte, Fazit klar, Beschriftungen nicht mehr abgeschnitten. Gut.
- Karte US-Börsen (Cyber-ETF): Status „Etwas erhöht“, aber Text „Im üblichen Bereich“; zwei verschiedene „Normalwerte“ in einer Karte (siehe Fehler 3). Verlauf passt zum Wert.
- `/#finance`: 26 Messungen, 24 frisch; nur eine „etwas erhöht“. Keine leeren Werte; „Im Netz: Dazu haben wir noch keine Werte.“ ist ehrlich, aber schwach.

## Fehler (nach Schwere)
1. **Widerspruch** Liste „Einzeln etwas erhöht“ (`/`): „Wie viele Bitcoin-Überweisungen auf Bestätigung warten – **niedriger als sonst · etwas erhöht**“. Ursache: `texte.js` Z. 206 `zustand.erhoeht: 'etwas erhöht'` gilt auch für Abweichung nach unten; ebenso Überschrift Z. 131.
2. **Widerspruch** (`/`): „Microsoft Sicherheitsbulletin – **0 Dokumente/Tag · etwas erhöht**“. Null kann nicht erhöht sein (vermutlich Rundung eines kleinen Werts auf 0).
3. **Widerspruch** Karte Cyber-ETF: „1,65 – üblich sind etwa 0,9.“ und direkt darunter „Normal ist etwa 0,63-fach bis 2,44-fach“ sowie Status „Etwas erhöht“ gegen „Im üblichen Bereich“. Außerdem fehlt in der ersten Zeile die Einheit („-fach“).
4. **Zeichenfehler** Fazit Krieg-Vergleich: „höchste Stufe „Mehrere Auffälligkeiten“ am 18.6.**..**“ – doppelter Punkt (`texte.js` Z. 81, `${hoch}` endet auf Punkt, danach folgt `.`).
5. **Widerspruch** Vergleich `/` nach 14 s: Überschrift „Internet-Wegweiser … dazu **3** weitere Messungen“, Etikett am Globus „Internet-Wegweiser in Kanada **(+5)**“ (Etikett zählt alle am Ort, auch normale).
6. **Unpassend** `/#bio`: Vergleichs-Knopf „Stromausfall Spanien 2025, Thema Blackout“ auf der Pandemie-Seite. Ehrlich beschriftet, aber kein Mehrwert; lieber ausblenden.
7. **Laien-Falle** `/`: „20 % der Anbieter (Zahlungsdienste) melden eine Störung · etwas erhöht“ direkt unter „Nein“. Klingt für Laien alarmierend; Einordnung fehlt.

## Korrekturen (je wenige Zeilen)
1. `texte.js` Z. 206/207: `erhoeht: 'etwas auffällig'`, Legende ebenso; Z. 131: `etwas: 'Einzeln etwas auffällig, zählt allein nicht:'`. (Löst Fehler 1 ohne Logik.)
2. `texte.js` Z. 81: `${hoch}` durch `${String(hoch).replace(/\.$/, '')}` ersetzen (Fehler 4).
3. `texte.js` Z. 301: `ueblich: (w, c) => \`${w} – der Mittelwert liegt bei etwa ${c}.\`` und an der Aufrufstelle die Einheit („-fach“) wie im Kasten anhängen (Fehler 3, Teil 1). Satz „Im üblichen Bereich, aber höher als an den meisten Tagen.“ behalten – dann passt er zu „etwas auffällig“.
4. Wertformat: Werte zwischen 0 und 1 mit einer Nachkommastelle zeigen (z. B. „0,3 Dokumente/Tag“), nie „0“ bei Status ≠ normal (Fehler 2).
5. Globus-Etikett: „(+5)“ → „(+5 am selben Ort)“ oder nur ungewöhnliche mitzählen (Fehler 5).

## Was fehlt Azubi und Rentner?
Dem Azubi fehlt im ersten Bildschirm ein Moment, der etwas zeigt: Der Vergleichs-Knopf („So sah ein echter Ernstfall aus ▶“) sollte bei `/` wie bei `/#war` sichtbar über dem Falz liegen oder der Globus kurz selbst einen roten Rückblick-Puls spielen. Dem Rentner fehlt ein Satz „warum Nein“ mit greifbarem Absender, etwa „Nein. 93 Messungen von Behörden, Börsen und Netzbetreibern sind normal – geprüft von [Name/Projekt], Daten frei einsehbar.“
