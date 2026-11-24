# Kritik Runde 4 – unabhängige Prüfung

Stand 24.11.2026. Bilder in /tmp/k4/: Handy 390×844 `/`, `/#war`, `/#blackout`, `/?demo=acute`, `/?lang=en` (je `*-1.png` = erster Bildschirm), Desktop `d-home-1.png`, ganze Handy-Seite `m-full.png` (6.688 px, Abschnitte `full-0..4.png`), Bedienwege `a-tap.png`, `b-1..3.png`, `c-erdbeben.png`. Hinweis: `shoot.mjs --batch` ignoriert `fullPage:false` (alle Bilder kamen ganzseitig), deshalb zugeschnitten.

## Befund in einem Satz
Der erste Bildschirm ist klar und ehrlich (großes „Nein.“, passendes Gerücht, Teilen), aber er beeindruckt nicht: Der Globus ist ein ruhiger, dunkler Ball mit drei Zahlenbläschen über Nordamerika/Europa. Der Rest der Seite ist kürzer als in Runde 3 (6.688 statt 9.352 px), wiederholt sich aber noch und endet im Archiv.

## Bedienwege (Handy, Playwright, Touch)
- **(a) Punkt antippen** (Bläschen „11“, New York): Unterblatt öffnet sofort, Überschrift verständlich („Wie stark Aktienfonds für IT-Sicherheit gerade gehandelt werden …“). Schwächen: Antippen einer Gruppe „11“ zeigt nur *eine* Messung, die anderen 10 bleiben unsichtbar; Kasten „Normal ist etwa: wird noch gelernt (bisher 14 Vergleichswerte)“ in Schreibmaschinenschrift bricht mitten im Wort um; „Verlauf bis 20.11.“ bei „Stand: vor 5 Minuten“ (24.11.) wirkt widersprüchlich; „Yahoo Finance Chart (inoffizielle API)“ schwächt Vertrauen.
- **(b) „So sah ein echter Ausfall aus: Stromausfall Spanien 2025“**: Seite springt ohne Ankündigung ~5.400 px nach unten in den Rückblick-Bereich (Leser verliert Orientierung). Wiedergabe läuft sichtbar (Zeitleiste, Regler, Datum), aber: Globus dreht Iberien an den Rand, Punkte bleiben türkis, Status zeigt fast durchgehend „Stufe: Ruhig – Kein Bereich ungewöhnlich“; der Ausschlag am Ereignis ist ein kleiner blauer Balken, den man bei normaler Geschwindigkeit verpasst. Laie versteht: „Selbst beim echten Blackout zeigt das Ding nichts.“ Das widerspricht dem Zweck des Knopfes. Weiße Ringe am Rand unerklärt.
- **(c) Schalter „Erdbeben“**: funktioniert, lila Rauten erscheinen (Alaska, Westküste, Mexiko), `aria-pressed` korrekt. Rauten sind klein und sehen aus wie Messpunkte; „an/aus“ als winziges Anhängsel.
- Konsole: keine Fehler, keine Warnungen.

## 5-Sekunden-Test (erster Handy-Bildschirm `/`)
| Person | Zweck? | Antwort? | Teilt? |
|---|---|---|---|
| (a) Verkäuferin 58, „Cyberangriff 17.11.“ | Ja: „Gerücht oder echt?“ + „Nein.“ + ihre Schlagzeile. | Ja, sofort. | Ja (og:image ist jetzt gesetzt). |
| (b) Azubi 19, TikTok | Halb. Globus sieht aus wie Wetter-App-Hintergrund, „LIVE“ ohne Bewegung. Kommt er über Krieg-Link (`/#war`), passt es. Ohne Hash: Antwort auf eine Frage, die er nicht stellte. | Mit Hash ja. | Nein, kein Screenshot-Moment. |
| (c) IT-Admin 44 | Ja, „0 von 9 Bereichen“. | Ja. | Vielleicht; stört sich an „97 Messungen / 92 frische Werte / 38+59“. |
| (d) Rentner 67, misstrauisch | Halb. Wer steckt dahinter? „Offenes Projekt“ sagt ihm nichts, kein Absender/Impressum oben. | Liest „Nein“, glaubt es nicht. | Nein. |
| (e) Journalistin 31 | Ja. | Ja, Faktenchecker benannt. | Ja, wenn Methodik schnell auffindbar (ist zugeklappt unten). |

**Ergebnis: 3 von 5** (wie Runde 3; a, c, e voll; b, d halb).

## Noten (1–10)
| Sofort-Verständnis | Mehrwert | Globus-Wirkung | Sprache | Vertrauen | Teilbarkeit | Handy |
|---|---|---|---|---|---|---|
| 7 | 5 | 4 | 7 | 6 | 6 | 7 |

Globus-Wirkung 4: Verglichen mit „God's Eye View“ fehlt Bewegung, Dichte und Bedeutung. 38 Ortspunkte, fast alle Nordamerika/Westeuropa; Süd-, Ostasien, Afrika leer – wirkt wie „die Welt = USA + EU“. Punktring am Rand (59 Messungen „weltweit“) ist für Laien nicht lesbar.

## Ganze Seite: Probleme an konkreten Stellen
- **Doppelt:** „Alle 97 Messungen als Liste“ (unter „Was weicht ab?“) und „Alle Messungen mit Rohdaten“ (Für Neugierige). „Gehört“-Kasten oben = erste Gerüchte-Karte unten (gleicher Text). Status „0 von 9 Bereichen“ steht dreimal (Kopf, Kasten unter Globus, „Die Regel in einem Bild“). „Kein Bereich ungewöhnlich“ zusätzlich in „Gerede gegen Messung“.
- **Widersprüchlich:** „Bei 3 von 11 großen Ereignissen … “ zeigt 5 Karten, dann „Alle weiteren anzeigen (11)“ → 16? Zählung passt nicht. „Stand: vor 5 Minuten“ vs. Verlauf endet 20.11. Messungs-Zahlen 97 / 92 / 38 + 59 / „45 Messungen“ unter Krieg. Gerüchte-Check unter Thema Cyberangriff zeigt auch Finanzkrise-, Blackout-, Atom-Karten (nicht gefiltert, aber Kopf-Chip ist Cyberangriff).
- **Unverständlich:** „Punktring außen“, Zahl im Bläschen, „Etwas erhöht, zählt allein nicht“, „Angriffs-Messdaten“, „Kern-Dienste“ vs. „Dienste und Firmenmeldungen“ (Unterschied unklar), „1,65-fach“, „Damals erreicht: ‚Einzelne Auffälligkeit‘“. Demo-Banner: „Erfundene Daten. Zeigt keine echte Lage. DEMO mit erfundenen Daten: …“ (doppelt). Demo-Etikett „9,84 Länder“ (Kommazahl Länder) und abgeschnittene Etiketten „Iran · In wie vielen Ländern Messnetz…“.
- **Zu lang:** Gerüchte-Karten (je 5–7 Zeilen Faktencheck + drei Aufklapper); Rückblick-Karten. Seite ist für Laien immer noch etwa doppelt so lang wie nötig; nach „Was weicht ab?“ liest kaum jemand weiter.
- **Kaputt/unschön:** Chip „KI-Vorfal|“ hart abgeschnitten (kein Hinweis auf Wischen). Wiedergabe-Knopf springt weit weg. Desktop-Untertitel anders als Handy-Untertitel. Englisch: „slightly raised“/„Level: Calm“ ok, „HEARD · 17/11“ holprig.
- **Selbstschädigend:** Direkt unter dem Globus steht beim einzigen Beispiel-Knopf „Damals erreicht: ‚Einzelne Auffälligkeit‘ … Vorhersagen kann das Radar nicht.“ Ehrlich, aber das stärkste Element der Seite beweist Schwäche statt Nutzen.

## 8 wirksamste Verbesserungen (nach Wirkung)
1. **Wiedergabe im Hauptglobus statt Sprung nach unten**, und mit Ereignis, bei dem es deutlich ausschlägt (Israel–Iran 2025, „Mehrere Auffälligkeiten“). Ablauf 8 s, automatisch verlangsamt am Ereignis, Punkte werden rot, Kopfzeile wechselt live: „13. Juni 2025, 04:00 – 2 Bereiche ungewöhnlich“. Knopftext: „▶ 20 Sekunden: So sah der Iran-Krieg 2025 in den Daten aus“.
2. **Globus lebendig machen:** langsame Eigendrehung, pulsierende Punkte, kurze Bögen/Linien bei neuen Messwerten, Gegenwartszeile „Letzte Messung vor 2 Min: Cloudflare Radar, Frankfurt – normal“. Ohne Bewegung ist „LIVE“ unglaubwürdig.
3. **Absender oben in einer Zeile** (Rentner-Test): „Ein unabhängiges Projekt von [Name], [Ort]. Keine Werbung, keine Daten über dich. Wer & warum →“.
4. **Doppeltes streichen:** „Gehört“-Kasten oben behalten, erste Gerüchte-Karte unten entfernen; eine Messliste statt zwei; „0 von 9“ nur oben + in der Regel-Grafik. Gerüchte-Check nach Thema filtern (andere Themen als „Weitere Gerüchte (3)“ zugeklappt).
5. **Gruppen-Tipp zeigt Liste:** Bläschen „11“ → „11 Messungen in New York: 10 normal, 1 etwas erhöht“, darunter die Zeilen. „Normal ist etwa: noch zu wenig Vergleichswerte“ in normaler Schrift.
6. **Legende in Alltagssprache statt Zählwerk:** „Jeder Punkt ist ein Messgerät oder Dienst. Grün = wie immer. Rot = ungewöhnlich. Zahl = so viele Messungen am selben Ort.“ Satz mit 97/38/59 streichen.
7. **Rückblick als eine Zeile mit Trefferbild** statt Kartenstapel: „11 große Ereignisse nachgerechnet: 3× gesehen ● ● ●, 2× teilweise ◐ ◐, 6× nicht ○ ○ ○ ○ ○ ○“ + ein Aufklapper; Zählfehler „(11)“ beheben.
8. **Teilen = Bild:** Teilen-Knopf erzeugt dynamisches Kärtchen pro Thema/Gerücht („17.11. Weltweiter Cyberangriff? Messdaten: Nein. 0 von 9 Bereichen auffällig. signal-radar…“), og:image je Hash-Thema; Chip-Leiste mit Schatten-Verlauf rechts, damit „KI-Vorfall“ als wischbar erkennbar ist.

## Durchbruch (über Feinschliff hinaus, statisch + öffentliche Daten)
1. **„Zeitmaschine“ als Hauptbühne:** Regler unter dem Globus über die letzten 14 Tage (Daten liegen schon vor) plus 3–5 historische Ereignisse als Sprungmarken. Der Nutzer sieht selbst, wie Rot aufflammt und wieder abklingt – das ist der Screenshot-/TikTok-Moment, den der ruhige Live-Zustand nie liefert. Der Live-Zustand wird dann zum Kontrast: „Heute: so ruhig wie am 3. Mai.“
2. **Gerücht-Seiten als eigene Adressen** (`/geruecht/cyberangriff-17-november`): je eine statische Seite mit Frage im Titel, Antwort, Messverlauf um das behauptete Datum und Vorschaubild. Das ist teilbar, suchmaschinenfähig und genau das, was Leute nach einer Facebook-Panik googeln.
3. **„Normal“ sichtbar machen statt behaupten:** Pro Bereich ein winziger Streifen „letzte 90 Tage“ mit heutigem Wert als Punkt (Welt-Internet-Ausfälle von IODA/Cloudflare Radar, Erdbeben USGS, Strom ENTSO-E). Laien verstehen „ungewöhnlich“ erst, wenn sie den normalen Bereich als Band sehen – das beantwortet direkt „warum gilt das als ungewöhnlich?“.
