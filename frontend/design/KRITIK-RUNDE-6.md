# Kritik Runde 6 – Signal Radar (24.11.2026, unabhängige Prüfung)

Bilder: /tmp/k6/ (`m-*-top.png` erster Handy-Bildschirm, `d-*-top.png` Desktop, `full-0..3.png` ganze Handy-Seite, `rb-*.png` Rückblick, `tap-*.png` Antippen). Konsolenfehler: keine (Laden, Rückblick, Antippen).

## 5-Sekunden-Test (erster Handy-Bildschirm `/`)
- (a) Verkäuferin, 17.11.: „Nein. Kein großer Cyberangriff" + lila Kasten „Weltweiter Cyberangriff am 17. November 2026?“ – **voll**.
- (b) Azubi/TikTok: Antwort verstanden, aber der Globus zeigt vor allem lila Rauten, die die Legende darüber nicht erklärt. Nichts bewegt sich, nichts ist rot. „Okay, nix los“ – **halb**, teilt nicht.
- (c) IT-Admin: Zweck, Stufe und Open Source klar – **voll**.
- (d) Rentner: „Wer steckt dahinter? Was heißt Open-Source-Projekt?“ Kein Absender, keine Quelle im ersten Bildschirm – **halb**.
- (e) Journalistin: Frage, Antwort, Gerücht, Stand und Teilen-Knopf – **voll**.
**3 von 5** (unverändert).

## Noten (1–10)
| Sofort-Verständnis | Mehrwert | Globus-Wirkung | Sprache | Vertrauen | Teilbarkeit | Handy |
|---|---|---|---|---|---|---|
| 7 | 5 | 5 | 7 | 5 | 6 | 7 |

## Bedienwege
- (a) Israel–Iran (`#war`): Nach 2 s steht da „Tag 1: Gestörte Webseiten in Israel etwas erhöht (zählt allein nicht)“, und der Globus dreht nach Nahost. Nach 5 bzw. 9 s steht „Tag 3: Luftalarme in Israel weit über normal“ mit einem roten Punkt und einer Beschriftung. Ein Laie sieht, *dass* etwas passiert. Am Ende (17.6.) ist es aber nur „Einzelne Auffälligkeit“, also kein Höhepunkt. Das Fazit steht unter dem Globus, außerhalb des Bildschirms, und widerspricht sich (Fehler 2). Die Logozeile ist oben abgeschnitten.
- (b) Themenwechsel im Rückblick: **jetzt sauber**. LIVE-Zeile, Antwort und Hash `#cyber` stimmen, `im-rueckblick` ist entfernt (rb-wechsel.png). Der Fehler aus Runde 5 ist behoben.
- (c) Punkt „11“ → Liste „US-Börsen, New York“ → Messung „Aktienfonds für IT-Sicherheit“: Die Karte ist gut gebaut, aber widersprüchlich (Fehler 3).
- (d) Lila Raute: Ein Tipp in Europa trifft eine Raute statt des Punkts „19“ (Überdeckung). Der Hinweis zeigt „Deutschland 9.459 · Internet-Störungen je Land (letzt…“ (abgeschnitten). In Afrika steht „Elfenbeinküste 523,294.067 · Internet-Störungen je Lan…“. Es öffnet sich keine Karte und es gibt keine Erklärung. Die Schichten sind nur in den Schaltern unter dem Globus erklärt (Erdbeben aus / Naturereignisse aus / Internet-Störungen an, „nur zur Orientierung“). Die Legende über dem Globus nennt keine lila Rauten.
- (e) Teilen (app.js:393–397, texte.js:112): Geteilt wird `„Nein. In den Messdaten ist kein großer Cyberangriff zu sehen. (Signal Radar, Stand <Zeit>)“` mit der URL `…#cyber`. Die Frage und das Gerücht fehlen, und im Demo-Modus würde ein erfundenes „Ja“ geteilt.

## Fehlerliste (nach Schwere)
1. **Rauten-Werte unsinnig und falsch formatiert**: „523,294.067“ (Elfenbeinküste) und „9.459“ (Deutschland) sind rohe IODA-Werte (snapshot.json `layers.internet-outages.points.value` = 523294067). Das Format mischt englische und deutsche Trennzeichen und wirkt alarmierend, während oben „Nein“ steht. Der Text ist abgeschnitten.
2. **Rückblick-Fazit Israel–Iran widerspricht sich**: Es heißt „zu sehen erst 2 Tage nach Beginn … bis ‚Mehrere Auffälligkeiten‘, erstmals 2 Tage nach Beginn“ und im selben Absatz „Stufe ‚Mehrere Auffälligkeiten‘ erst ab dem 18.06.“. Die Wiedergabe endet am 17.6. mit „Einzelne Auffälligkeit“, die behauptete Stufe ist also nie zu sehen. Die Liste markiert das Ereignis als „gesehen“, das Fazit sagt „Keine Vorwarnung“.
3. **Messkarte widersprüchlich**: „Etwas erhöht“, obwohl der Wert 1,65-fach im Bereich „Normal ist etwa 0,63- bis 2,44-fach“ liegt und „in 21 % der Fälle“ vorkam. Der Statuspunkt ist blau, auf dem Globus ist er gelb. „Letzter Wert 20.11.“ ist 4 Tage alt, im Diagramm steht aber „Der Punkt ist der Wert jetzt“.
4. **Rauten verdecken Zahlenpunkte** (Europa): Ein Tipp auf „19“ öffnet den Rauten-Hinweis statt der Liste.
5. **Legende über dem Globus unvollständig**: Lila Rauten machen den größten Teil der sichtbaren Marken aus, werden dort aber nicht erklärt.
6. **Demo `?demo=acute`**: Der echte Gerüchtekasten „17.11.2026 … IFLScience fanden keine Belege“ steht neben „Messdaten heute: Häufung“. Erfundene Daten werden so mit einem echten Gerücht verknüpft (Screenshot-Gefahr). Der Hinweis „Iran 10 Länder · ungewöhnlich“ ist unverständlich.
7. **„Die Regel in einem Bild“**: Die Stufenkarten sind ungleich hoch, die Karte „2 Bereiche“ ist nach oben versetzt, die Silbentrennung („Auffälligkei-ten“) wirkt unruhig.
8. Die Unterzeile unterscheidet sich: Handy „Gerücht oder echt? Live-Blick …“, Desktop „Gerüchte gibt es viele …“. Die Reihenfolge in der Legende unter dem Globus (normal · ungewöhnlich · etwas erhöht) ist unlogisch.
9. Trefferquote „5 von 16 … meist schwach“ ist ehrlich, aber für Laien ein Mehrwert-Killer, wenn sie ohne Einordnung steht.

## 8 wirksamste Verbesserungen
1. **Rauten-Hinweis neu**: Statt des rohen Werts: „Elfenbeinküste: Internet heute deutlich gestört (Platz 1 von 40 Ländern). Zählt nicht zur Antwort oben.“ Stärke in Worten (leicht/deutlich/stark) statt einer Zahl. Antippen öffnet eine Mini-Karte mit Quelle.
2. **Legende über dem Globus ergänzen**: „Punkte = Messungen (grün normal, gelb erhöht, rot ungewöhnlich). Lila Rauten = Länder mit Internet-Störungen, nur zur Orientierung.“
3. **Rückblick-Fazit in einen Satz und sichtbar über dem Globus**: „Ergebnis: Das Radar wurde am 15.6. auffällig, 2 Tage nach den ersten Angriffen. Eine Vorwarnung gab es nicht.“ Die Daten auf eine Zahl bringen und die Wiedergabe bis zum Tag der höchsten Stufe (18.6.) laufen lassen, damit der Höhepunkt zu sehen ist.
4. **Messkarte widerspruchsfrei**: Liegt der Wert im Normalband, steht „normal“ da. Steht „erhöht“ da, kommt eine Begründung dazu: „höher als an 79 % der letzten Tage“. Bei alten Werten heißt es „Wert vom 20.11. (Börse schließt am Wochenende)“ statt „jetzt“. Die Punktfarbe ist dieselbe wie auf dem Globus.
5. **Absender im ersten Bildschirm**: „Ein offenes Projekt von <Name>, ohne Werbung. Alle 97 Messungen stammen aus öffentlichen Quellen wie Cloudflare, Georgia Tech und der US-Notenbank.“ (Rentner, Vertrauen)
6. **Teiltext mit Frage und Gerücht**: „Gab es am 17.11. einen weltweiten Cyberangriff? Die Messdaten sagen: Nein, kein großer Cyberangriff zu sehen (97 Messungen, Stand 24.11., 14:03).“ Dazu ein eigenes OG-Bild je Antwort. Im Demo-Modus ist Teilen gesperrt.
7. **Bewegung im Ruhezustand**: Ein Knopf direkt unter der Antwort: „▶ So sah es beim Israel–Iran-Krieg aus (20 Sek.)“. Damit wird der stärkste Moment der Seite gezeigt, nicht versteckt.
8. **Demo vom echten Gerücht trennen**: In Demos wird kein echtes Gerücht verlinkt. Das DEMO-Band liegt zusätzlich als Wasserzeichen über dem Globus.

## Azubi und Rentner; die eine Änderung
Der Azubi sieht einen ruhigen Globus voller unerklärter lila Rauten und nichts, was ihn überrascht oder was er weiterschicken möchte. Dem Rentner fehlt der Absender, und eine Zahl wie „523,294.067 Störungen“ bestätigt sein Misstrauen.
**Die eine Änderung**: Der Globus erzählt im ersten Bildschirm von selbst einen Vergleich: „Heute“ (ruhig) gegen „So sah ein echter Ernstfall aus“, also ein automatischer 10-Sekunden-Zeitraffer Israel–Iran oder Stromausfall Spanien, bei dem die Punkte rot aufleuchten. Danach springt er zurück auf „Jetzt: alles ruhig“. Das macht die Leere zur Aussage („so sähe es aus, wenn es echt wäre“) und hebt Mehrwert und Globus-Wirkung zugleich.
