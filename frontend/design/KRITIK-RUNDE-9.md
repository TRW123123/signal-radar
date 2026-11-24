# Kritik Runde 9 – Signal Radar (24.11.2026, Abschlussprüfung)

Bilder /tmp/k9/: m-de-root, m-war, m-blackout, m-ai, m-finance, m-nuclear, m-bio, m-acute, m-en, m320, desk, cmp1 (Vergleich nach 13 s), cmp2 (nach „Zurück zu jetzt“).
Konsolenfehler: keine. Vergleichs-Knopf „So sah ein echtes Ereignis aus“ liegt jetzt im 1. Handy-Bildschirm, funktioniert; „Zurück zu jetzt“ funktioniert (landet aber mitten auf der Seite, Kopf weggescrollt).

## 5-Sekunden-Test (1. Handy-Bildschirm `/`)
- (a) Verkäuferin: „Nein. Kein großer Cyberangriff“ + Kasten „Weltweiter Cyberangriff am 17. November 2026?“. **Voll.**
- (b) Azubi: Globus weiter still (nichts rot); der Knopf „So sah ein echtes Ereignis aus“ ist sichtbar, verspricht aber nur – ob er tippt, ist offen. **Halb.**
- (c) IT-Admin: Stufe, 0 von 9, 87 Messungen mit Quellennamen, Stand. **Voll** (stolpert aber über Fehler 3).
- (d) Rentner: „Unabhängig, ohne Werbung, alle Daten offen einsehbar“ + „Warum? …“ beantworten „wer sagt das, woher?“. Quellennamen (FireHOL, Atlassian) sagen ihm nichts, aber das Nein ist jetzt begründet. **Voll (knapp).**
- (e) Journalistin: Frage, Antwort, Begründung, Gerücht mit Datum, Teilen. **Voll.**

**4 von 5.**

## Noten
| Sofort-Verständnis | Mehrwert | Globus-Wirkung | Sprache | Vertrauen | Teilbarkeit | Handy |
|---|---|---|---|---|---|---|
| 8 | 7 | 7 | 7 | 7 | 6 | 7 |

## Echte Fehler
1. **Deutsch auf EN-Seite** (`/`, en-US, Warum-Zeile): „…Cloudflare Radar, Atlassian-Statuspage-Anbieter.“ → „…Cloudflare Radar, Atlassian Statuspage providers.“ (Quellenname muss übersetzt werden.)
2. **Überlappung** Gerücht-Kasten-Kopf: EN 390 px „HEARD · 17 NOV 2026“ läuft in „Measurements today: nothing major →“; DE 320 px „GEHÖRT · 17.11.2026“ in „Messdaten heute: nichts Großes →“. Korrektur: Kopfzeile umbrechen lassen (flex-wrap) bzw. rechten Teil kürzen: „Daten: nichts Großes →“ / „Data: nothing major →“.
3. **Widerspruch** (`/`, auf Desktop im selben Bildschirm): Warum „87 Messungen … zeigen gerade nichts Ungewöhnliches“ vs. Liste darunter mit 6 Messungen „etwas auffällig“. Text: „Warum? Von 87 Messungen weicht kein Bereich als Ganzes ab; 6 einzelne Ausreißer zählen allein nicht, z. B. …“ (gilt sinngemäß für alle Themen).
4. **Widerspruch** `/?demo=acute`: „5 von 9 Bereichen weichen ab:“ und danach 7 Namen (Internet-Routen, Gemessene Ausfälle, Zahlungsverkehr, Strom, Verkehr, Funk, Dienste und Firmenmeldungen). Genau die 5 abweichenden nennen oder „z. B.“ + höchstens 5 Namen. Außerdem wiederholt die Warum-Zeile fast wörtlich den Satz darüber.
5. **Widersprüchliche Zahl** Vergleich (cmp1): Überschrift „Internet-Wegweiser in Kanada …, dazu 3 weitere Messungen“, Globus-Beschriftung „Internet-Wegweiser in Kanada (+5)“. Eine Zählung für beide verwenden.
6. **Abgeschnitten/unsichtbar** Themenleiste: 320 px „Black…“ unter „mehr →“; bei `#ai`, `#finance`, `#nuclear`, `#bio` ist der aktive Reiter nicht im Bild (Leiste nicht zum aktiven Thema gescrollt). Korrektur: aktiven Reiter beim Laden `scrollIntoView({inline:'center'})`.
7. Klein: `#nuclear` Warum nennt „Yahoo Finance Chart-Endpunkt“ – technisch und für Laien befremdlich. → „Yahoo Finance (Uran-Aktien)“ oder BfS zuerst nennen.
