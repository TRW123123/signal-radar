// Report section for history runs (run.ts --history): per event what the radar would have shown, measured only
// against the sources that have history at all. Used by evaluate.ts; pure function, returns Markdown lines.

import type { BacktestEvent, BacktestResult } from './lib.ts';
import { DAY } from './lib.ts';
import { buildReplay, judgeSawIt, NOTABLE_ANOMALY } from './replays.ts';

const LABEL = ['Ruhig', 'Leicht erhöht', 'Erhöht', 'Hoch', 'Akut'];
const num = (x: number, d = 1) => x.toFixed(d).replace('.', ',');
const hrs = (h: number | null) => (h === null ? '–' : `${h > 0 ? '+' : ''}${h} h`);

/** sources whose past was fetched for the history runs (backtest/history-queue.json) or whose file carries it */
const HISTORY_SOURCES = 'NY Fed (SOFR), Yahoo (VIX, Cyber-ETFs CIBR/HACK/BUG), RIPEstat (sichtbare Netzblöcke Deutschland), '
  + 'OONI (Web-Messungen USA, teils Deutschland), Tor Metrics (Bandbreite), SEC EDGAR (8-K Item 1.05, ab 2024), CISA KEV (ab 11/2021) und CISA ICS';

/** hand-written reading of the current history runs (kept next to the table; update when the runs change) */
const HISTORY_NOTES: string[] = [
  'Einordnung (Stand 24.11.2026): Mit den gezielten Messungen sieht das Radar die Ereignisse, deren Folgen physisch messbar sind. '
    + '**Iberischer Stromausfall:** IODA-Ping Spanien und Portugal (z 14 bis 16) ab dem ersten Zeitschritt nach Beginn (+1 h), Stufe 1; '
    + 'die Netzlast Portugals wich nur schwach ab (z 4,7, Bereich Netz nicht über der Schwelle), die Netzlast Spaniens fehlt in den Ausfallstunden '
    + '(keine vollständigen Stunden), Wikipedia-Aufrufe sprangen erst mit dem Tageswert (+14 h). Kein Vorlauf. '
    + '**Israel–Iran:** Luftalarme Israel ab dem Tageswert des 13.06. (+27 h), Stufe 1 ab +50 h, Stufe 2 ab 18.06. 14 Uhr UTC (+5,6 Tage) durch den '
    + 'Einbruch der anpingbaren Netze im Iran (z 19); Ölpreis-Volatilität (OVX) auffällig, aber nicht ausschlaggebend. Kein Vorlauf. '
    + '**Rogers:** IODA AS812 (Routing und Ping) ab +1 h; die BGP-Meldungen (RIPEstat, Anzahl Announcements) schlugen schon 23 h vorher aus, '
    + 'aber auch 18 Tage vorher mehrfach (18 Zeitschritte Stufe 1 vor Beginn): Rauschen, kein Vorlauf. '
    + '**Facebook:** Stufe 1 ab +3 h durch die BGP-Meldungen für AS32934; dieselbe Reihe schlug auch am 26./27.09. ohne Ereignis aus (5 Zeitschritte). '
    + 'Sichtbare Präfixe gibt RIPEstat nur in 8-Stunden-Schritten (Rückgang 391 auf 369 ab 16 Uhr UTC, nach Verschiebung um ein Intervall gegen Vorausschau), '
    + 'unter der Schwelle. IODA hat für AS32934 im Jahr 2021 keine Daten (leere Antwort). '
    + '**Kontrollen:** Spanien/Portugal vier Wochen vorher und Nahost vier Wochen vorher blieben mit denselben Messungen auf Stufe 0.',
  '',
  'Nicht prüfbar bzw. nicht gesehen: CrowdStrike, Change Healthcare, Log4Shell, MOVEit, Colonial, Dyn, NotPetya sind Firmen- oder Software-Vorfälle; '
    + 'für sie gibt es keine offene Messung mit Historie, die das Ereignis physisch zeigt (FAA-Flugausfälle nur live). Sie bleiben mit „nein“ bzw. '
    + '„teilweise“ (VIX, ohne Bezug) in der Liste. RIPEstat liefert für eine ASN keine Rücknahmen (withdrawals = null), nur Announcements. '
    + 'Der Luftalarm-Datensatz (65 MB) wurde direkt von raw.githubusercontent.com geladen und als Ausschnitt gespeichert (März bis Juli 2025, Kategorien 1 und 2). '
    + 'Weiter fehlend: `moveit-2023-05/yahoo/VIX-6mo-1d.json` (HTTP 500); SOFR erst ab April 2018, KEV ab November 2021, SEC Item 1.05 ab Dezember 2023.',
];

export function historySection(results: { file: string; result: BacktestResult }[], events: BacktestEvent[]): string[] {
  const L: string[] = [];
  const hist = results.filter((r) => r.result.source.startsWith('history:'));
  if (!hist.length) return L;
  L.push('## Was das Radar je Ereignis gezeigt hätte (Historien-Läufe)');
  L.push('');
  L.push(`Grundlage: echte historische Antworten der Quellen unter \`fixtures/backtest/<ereignis>/\`, je Ereignis zum Zeitpunkt „Ende + 4 Tage“ eingelesen; `
    + `zu jedem Zeitschritt nur Daten bis zu diesem Zeitpunkt, Tageswerte erst ab Tagesende sichtbar, Engine unverändert. `
    + `Allgemeine Reihen (alle Cyber-Zeiträume): ${HISTORY_SOURCES}. `
    + 'Dazu kommen je Ereignis eigene Messungen (Feld `probes` in `backtest/events.json`, eingelesen von `src/backtest/history-adapters.ts`): '
    + 'die Messungen, die das Ereignis physisch zeigen müssten, auch für Länder und Netze, die der Live-Betrieb nicht abfragt. Jede wird ein eigenes, '
    + 'benanntes Wiedergabe-Signal mit den Engine-Einstellungen einer Katalog-Vorlage (Grundlinie, Schwellen, Gewicht, Richtung, Beweisklasse). '
    + 'Iberischer Stromausfall: IODA Spanien/Portugal (Routing und Ping), Energy-Charts Netzlast Spanien/Portugal, OONI Spanien/Portugal, '
    + 'Wikipedia-Aufrufe. Israel–Iran: Luftalarme Israel (GitHub-Datensatz), IODA Iran/Israel, OONI Iran/Israel, Brent (GitHub-Datensatz und Yahoo), '
    + 'WTI, Gold, OVX, VIX, Wikipedia-Aufrufe. Rogers: IODA Kanada und AS812 (Routing und Ping), Wikipedia. Facebook: RIPEstat sichtbare Präfixe AS32934, '
    + 'Wikipedia. Kontroll-Zeiträume nutzen dieselben Messungen (Feld `probesFrom`), eingelesen zu ihrem eigenen, früheren Zeitpunkt.');
  L.push('');
  L.push(`„Auffällig“ heißt hier: Anomalie der Engine ≥ ${num(NOTABLE_ANOMALY, 2)} (z deutlich über der Schwelle). Zeiten relativ zum Ereignisbeginn, `
    + 'gesucht von 3 Tagen davor bis 1 Tag nach dem Ende. „Gesehen?“ ist dieselbe Regel wie in den Wiedergaben (`src/backtest/replays.ts`): '
    + '„ja“ nur bei Stufenanstieg durch abweichende Bereiche, „teilweise“ bei einzelnen auffälligen Messungen in einem erwarteten Bereich, sonst „nein“.');
  L.push('');
  L.push('| Zeitraum | Art | Signale mit Daten | Bereiche mit Daten | erwartete Bereiche ohne Daten | höchste Stufe (Wert) | auffällige Messungen (Beginn, max. z) | Gesehen? |');
  L.push('|---|---|---:|---|---|---|---|---|');
  const details: string[] = [];
  const tally: Record<string, string[]> = { ja: [], teilweise: [], nein: [] };
  const ctl: string[] = [];
  for (const { result } of hist) {
    const id = result.source.slice('history:'.length).split(' ')[0];
    const ev = events.find((e) => e.id === id);
    if (!ev) continue;
    const start = Date.parse(ev.start);
    const end = Date.parse(ev.end);
    const from = start - 3 * DAY;
    const to = end + DAY;
    const win = result.steps.filter((s) => Date.parse(s.t) >= from && Date.parse(s.t) <= to);
    const freshIdx = new Set(win.flatMap((s) => s.fresh));
    const sigs = [...freshIdx].map((i) => result.signals[i]).filter(Boolean);
    const dataDomains = [...new Set(win.flatMap((s) => s.dataDomains))].sort();
    const missing = ev.kind === 'event' ? ev.expectedDomains.filter((d) => !dataDomains.includes(d)) : [];
    const maxLevel = win.reduce((m, s) => Math.max(m, s.level), 0);
    const maxScore = win.reduce((m, s) => Math.max(m, s.score), 0);
    // all signals with data, not only the expected domains, to list every notable measurement
    let notableTxt = '–';
    let saw = '–';
    if (win.some((s) => s.v)) {
      const replay = buildReplay(result, new Map(), { id, from, to, stepHours: result.stepHours, eventStart: ev.start, maxSignals: 1000 });
      const all = judgeSawIt({ frames: replay.frames, eventStart: ev.start, eventEnd: ev.end, preHours: 72, postHours: 24 });
      const scored = judgeSawIt({ frames: replay.frames, eventStart: ev.start, eventEnd: ev.end, expectedDomains: ev.kind === 'event' ? ev.expectedDomains : [] });
      saw = scored.sawIt;
      notableTxt = all.notable.map((n) => `\`${n.id.replace(/^[a-z]+\./, '')}\` ${hrs(n.firstHours)}, z ${n.z === null ? '–' : num(n.z)}${ev.kind === 'event' && !ev.expectedDomains.includes(n.domain) ? ' (nicht erwarteter Bereich)' : ''}`).join('; ') || 'keine';
    }
    if (ev.kind === 'event' && tally[saw]) tally[saw].push(id);
    if (ev.kind === 'control') ctl.push(`${id}: höchste Stufe ${maxLevel}${saw === 'teilweise' ? ', eine einzelne Messung auffällig' : ''}`);
    L.push(`| ${ev.title} (\`${id}\`) | ${ev.kind === 'event' ? 'Ereignis' : 'Kontrolle'} | ${sigs.length} | ${dataDomains.join(', ') || '–'} | ${missing.join(', ') || (ev.kind === 'event' ? 'keine' : '–')} | ${maxLevel} ${LABEL[maxLevel]} (${num(maxScore, 3)}) | ${notableTxt} | **${saw}** |`);
    details.push(`- \`${id}\`: ${sigs.map((s) => `\`${s.id.replace(/^[a-z]+\./, '')}\` (${s.evidenceClass})`).join(', ') || 'keine'}`);
  }
  L.push('');
  L.push('<details><summary>Signale mit Daten je Zeitraum (3 Tage vor Beginn bis 1 Tag nach Ende)</summary>');
  L.push('');
  L.push(...details);
  L.push('');
  L.push('</details>');
  L.push('');
  L.push(`**Kurz:** Von ${tally.ja.length + tally.teilweise.length + tally.nein.length} historischen Ereignissen hätte das Radar mit diesen Daten `
    + `${tally.ja.length} gesehen (Stufenanstieg), ${tally.teilweise.length} nur über eine einzelne Messung angedeutet (${tally.teilweise.join(', ') || '–'}) `
    + `und ${tally.nein.length} gar nicht gesehen. Kontroll-Zeiträume: ${ctl.join('; ') || '–'}.`);
  L.push('');
  L.push(...HISTORY_NOTES);
  L.push('');
  return L;
}
