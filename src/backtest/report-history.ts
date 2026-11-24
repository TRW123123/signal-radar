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

export function historySection(results: { file: string; result: BacktestResult }[], events: BacktestEvent[]): string[] {
  const L: string[] = [];
  const hist = results.filter((r) => r.result.source.startsWith('history:'));
  if (!hist.length) return L;
  L.push('## Was das Radar je Ereignis gezeigt hätte (Historien-Läufe)');
  L.push('');
  L.push(`Grundlage: echte historische Antworten der Quellen unter \`fixtures/backtest/<ereignis>/\`, je Ereignis zum Zeitpunkt „Ende + 4 Tage“ eingelesen; `
    + `zu jedem Zeitschritt nur Daten bis zu diesem Zeitpunkt, Tageswerte erst ab Tagesende sichtbar, Engine unverändert. `
    + `Verfügbar waren nur: ${HISTORY_SOURCES}. `
    + '**Nicht** abgerufen und damit in keinem Historien-Lauf enthalten: Wikipedia-Seitenaufrufe und alle anderen Aufmerksamkeits-Quellen (Klasse D), '
    + 'IODA, EPSS, Cloudflare Radar, Statusseiten, Blocklisten, CT-Logs, FAA. Der Aufmerksamkeits-Wert ist deshalb in allen Historien-Läufen 0, '
    + 'ein „Gerede ohne Daten“ konnte gar nicht entstehen.');
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
      notableTxt = all.notable.map((n) => `\`${n.id.replace(/^cyber\./, '')}\` ${hrs(n.firstHours)}, z ${n.z === null ? '–' : num(n.z)}${ev.kind === 'event' && !ev.expectedDomains.includes(n.domain) ? ' (nicht erwarteter Bereich)' : ''}`).join('; ') || 'keine';
    }
    if (ev.kind === 'event' && tally[saw]) tally[saw].push(id);
    if (ev.kind === 'control') ctl.push(`${id}: höchste Stufe ${maxLevel}${saw === 'teilweise' ? ', eine einzelne Messung auffällig' : ''}`);
    L.push(`| ${ev.title} (\`${id}\`) | ${ev.kind === 'event' ? 'Ereignis' : 'Kontrolle'} | ${sigs.length} | ${dataDomains.join(', ') || '–'} | ${missing.join(', ') || (ev.kind === 'event' ? 'keine' : '–')} | ${maxLevel} ${LABEL[maxLevel]} (${num(maxScore, 3)}) | ${notableTxt} | **${saw}** |`);
    details.push(`- \`${id}\`: ${sigs.map((s) => `\`${s.id.replace(/^cyber\./, '')}\` (${s.evidenceClass})`).join(', ') || 'keine'}`);
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
  L.push('Einordnung: Die verfügbaren Reihen messen fast alle etwas Allgemeines (Routing Deutschlands, Web-Messungen in den USA, '
    + 'US-Börse, US-Geldmarkt), nicht die betroffenen Systeme (Windows-Clients, Facebook-DNS, Rogers in Kanada, Dyn). Kein Bereich erreichte in '
    + 'irgendeinem Zeitschritt die Schwelle „weicht ab“, deshalb blieb die Stufe überall bei 0. Dass die Kontroll-Zeiträume ruhig blieben, ist unter '
    + 'diesen Umständen kein Qualitätsbeleg: Das Radar blieb bei den echten Ereignissen genauso ruhig. Die einzelnen Ausschläge (VIX, Cyber-ETFs, '
    + 'OONI Deutschland) liegen entweder vor dem Ereignis oder in Bereichen, die das Ereignis nicht direkt messen, und kommen in den Kontroll-Zeiträumen '
    + 'ebenso vor (VIX August 2019). Mit diesen Daten ist weder Erkennung noch Vorlauf belegt.');
  L.push('');
  L.push('Fehlende Abrufe: `moveit-2023-05/yahoo/VIX-6mo-1d.json` schlug beim Nachladen mit HTTP 500 fehl (`fixtures/backtest/FETCH-LOG.json`); '
    + 'für MOVEit fehlt deshalb der Bereich Märkte. Für 2016 und 2017 gibt es keine SOFR-Reihe (erst ab April 2018), KEV erst ab November 2021, '
    + 'SEC Item 1.05 erst ab Dezember 2023.');
  L.push('');
  return L;
}
