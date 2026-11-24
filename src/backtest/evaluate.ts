#!/usr/bin/env node
// Backtest evaluation: judges one or more result files (run.ts) against backtest/events.json.
//
//   node src/backtest/evaluate.ts [result.json ...] [--events backtest/events.json] [--pre-hours 72] [--post-hours 24]
//                                 [--out backtest/results/<name>.eval.json] [--report backtest/REPORT.md]
//
// Default result file: backtest/results/replay-30d.json. Writes the evaluation as JSON and a German Markdown report.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { historySection } from './report-history.ts';
import { type BacktestEvent, type BacktestResult, DEFAULT_EVAL, type EventEval, type Evaluation, evaluateResults, MIN_DOMAINS } from './lib.ts';

const LABEL = ['Ruhig', 'Einzelne Auffälligkeit', 'Mehrere Auffälligkeiten', 'Deutliche Häufung', 'Starke Häufung'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const valueFlags = new Set(['events', 'pre-hours', 'post-hours', 'out', 'report']);
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { if (valueFlags.has(args[i].slice(2))) i++; continue; }
  files.push(args[i]);
}
if (files.length === 0) files.push(join(root, 'backtest', 'results', 'replay-30d.json'));

const results = files.map((f) => {
  const p = resolve(f);
  if (!existsSync(p)) throw new Error(`Ergebnis-Datei fehlt: ${f} (zuerst node src/backtest/run.ts ausführen)`);
  const result = JSON.parse(readFileSync(p, 'utf8')) as BacktestResult;
  if ((result.schema as string) === 'backtest-eval/1') return null; // tolerate globs like backtest/results/*.json
  if (result.schema !== 'backtest-result/1') throw new Error(`${f}: unbekanntes Schema ${String(result.schema)}`);
  return { file: relative(root, p), result };
}).filter((r): r is { file: string; result: BacktestResult } => r !== null);
if (results.length === 0) throw new Error('keine Ergebnis-Datei (Schema backtest-result/1) angegeben');
const events = JSON.parse(readFileSync(resolve(opt('events') ?? join(root, 'backtest', 'events.json')), 'utf8')) as BacktestEvent[];
const ev = evaluateResults(results, events, {
  preHours: Number(opt('pre-hours') ?? DEFAULT_EVAL.preHours),
  postHours: Number(opt('post-hours') ?? DEFAULT_EVAL.postHours),
});

const outJson = resolve(opt('out') ?? join(root, 'backtest', 'results', `${basename(results[0].file, '.json')}.eval.json`));
mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(ev, null, 1));
const reportPath = resolve(opt('report') ?? join(root, 'backtest', 'REPORT.md'));
writeFileSync(reportPath, report(ev, results.map((r) => r.result), events));
console.log(`Auswertung: ${relative(root, outJson)}\nBericht: ${relative(root, reportPath)}`);

// ------------------------------------------------------------------ report

function pct(x: number | null | undefined): string {
  return x === null || x === undefined ? 'n. v.' : `${(x * 100).toFixed(1).replace('.', ',')} %`;
}
function num(x: number | null | undefined, digits = 1): string {
  return x === null || x === undefined ? 'n. v.' : x.toFixed(digits).replace('.', ',');
}
function hours(x: number | null): string {
  if (x === null) return 'nie';
  const s = x > 0 ? '+' : '';
  return `${s}${num(x, 0)} h`;
}
function day(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}
function report(e: Evaluation, rs: BacktestResult[], evs: BacktestEvent[]): string {
  const L: string[] = [];
  const evById = new Map(evs.map((x) => [x.id, x]));
  const c = e.coverage;
  L.push('# Backtest-Bericht Cyber');
  L.push('');
  L.push(`Erzeugt ${day(e.generatedAt)} UTC mit \`src/backtest/evaluate.ts\`. Diese Datei wird bei jedem Lauf überschrieben.`);
  L.push('');
  L.push('Ergebnis-Dateien:');
  L.push('');
  for (const r of e.results) L.push(`- \`${r.file}\`: ${r.source}, ${day(r.from)} bis ${day(r.to)} UTC, alle ${r.stepHours} h, ${r.steps} Zeitschritte, Zeitstempel: ${r.availability === 'end-of-day' ? 'Tageswerte erst ab Tagesende sichtbar' : 'wie gespeichert'}`);
  L.push('');
  L.push(`Regeln: Zu jedem Zeitschritt wird der Wert so berechnet, wie ihn das System damals gezeigt hätte (nur Daten bis zu diesem Zeitpunkt, `
    + `Engine unverändert). Ein Ereignis zählt im Fenster von ${e.options.preHours} h vor Beginn bis ${e.options.postHours} h nach Ende. `
    + `Ein Fenster ist nur prüfbar, wenn im Median mindestens ${e.options.minDomains} Bereiche frische Daten mit Baseline hatten; sonst „nicht prüfbar“ (kein Fehlschlag). `
    + 'Vorlaufzeit: erster Zeitschritt ab Stufe 1 bzw. 2 relativ zum Ereignisbeginn, negative Werte = vorher. Die Auflösung ist die Schrittweite.');
  L.push('');

  // --- coverage
  L.push('## Datengrundlage');
  L.push('');
  L.push(`**${c.signalsWithDataEver} von ${c.signalsInScenario} Signalen** des Szenarios (davon ${c.signalsActive} mit Collector, Rest nur katalogisiert) hatten im Zeitraum mindestens einmal frische Daten. `
    + `**${c.domainsWithDataEver} von ${c.domainsInScenario} Bereichen** hatten mindestens einmal frische Daten mit Baseline (nur Klassen A und B zählen). `
    + `${c.stepsWithMinDomains} von ${c.stepsTotal} Zeitschritten hatten mindestens ${MIN_DOMAINS} Bereiche mit Daten.`);
  L.push('');
  L.push('| Bereich | Signale im Katalog | davon mit Daten | davon Klasse D (nicht gewertet) | Zeitschritte mit Daten + Baseline |');
  L.push('|---|---:|---:|---:|---:|');
  const sigs = rs[0]?.signals ?? [];
  const withData = new Set(rs.flatMap((r) => r.signals.filter((s) => s.stepsFresh > 0).map((s) => s.id)));
  const domainIds = [...new Set([...c.perDomain.map((d) => d.id), ...sigs.map((s) => s.domain)])];
  for (const id of domainIds) {
    const d = c.perDomain.find((x) => x.id === id);
    const inDom = sigs.filter((s) => s.domain === id);
    const wd = inDom.filter((s) => withData.has(s.id));
    L.push(`| ${d ? `${d.title} (\`${id}\`)` : `\`${id}\` (kein Szenario-Bereich: Aufmerksamkeit oder Kontext, nie gewertet)`} | ${inDom.length} | ${wd.length} | ${wd.filter((s) => s.evidenceClass === 'D').length} | ${d ? `${d.stepsWithData} (${pct(d.share)})` : '–'} |`);
  }
  L.push('');
  L.push('<details><summary>Signale mit Daten im Zeitraum</summary>');
  L.push('');
  L.push('| Signal | Bereich | Klasse | Werte im Zeitraum | Zeitschritte frisch |');
  L.push('|---|---|---|---:|---:|');
  const steps = rs.reduce((a, r) => a + r.steps.length, 0);
  for (const s of sigs.filter((x) => withData.has(x.id)).sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id))) {
    const fresh = rs.reduce((a, r) => a + (r.signals.find((x) => x.id === s.id)?.stepsFresh ?? 0), 0);
    const nIn = rs.reduce((a, r) => a + (r.signals.find((x) => x.id === s.id)?.nInRange ?? 0), 0);
    L.push(`| \`${s.id}\` | ${s.domain} | ${s.evidenceClass} | ${nIn} | ${fresh} von ${steps} |`);
  }
  L.push('');
  L.push('</details>');
  L.push('');

  // --- levels
  L.push('## Stufen-Verteilung');
  L.push('');
  L.push('| Stufe | Zeitschritte | Anteil | zum Vergleich: wenn Schritte ohne abweichenden Bereich als Ruhig gälten |');
  L.push('|---|---:|---:|---:|');
  for (const l of e.levelDistribution) {
    const alt = e.diagnostics.levelDistributionIfNoDomainIsCalm[l.level];
    L.push(`| ${l.level} ${LABEL[l.level]} | ${l.steps} | ${pct(l.share)} | ${alt.steps} (${pct(alt.share)}) |`);
  }
  L.push('');
  if (e.diagnostics.stepsL1WithoutActiveDomain > 0) {
    L.push(`**Engine-Befund:** ${e.diagnostics.stepsL1WithoutActiveDomain} Zeitschritte ab Stufe 1 (davon ${e.diagnostics.stepsL2WithoutActiveDomain} ab Stufe 2) hatten `
      + '**keinen einzigen** Bereich über der Schwelle „weicht ab“ (0,25). Ursache: `CONVERGENCE_GATE[0]` in `src/engine/score.ts` ist 1, die Konvergenz-Schranke '
      + 'greift also nur, wenn mindestens ein Bereich abweicht. Mehrere knapp unterschwellige Bereiche addieren sich per Noisy-OR ungedeckelt. '
      + 'Das widerspricht `docs/SCORING.md` („Ein einzelner Bereich kann nie mehr als Einzelne Auffälligkeit auslösen“, erst recht nicht null Bereiche). '
      + 'Vorschlag für die Engine (hier nicht geändert): Schranke für 0 Bereiche auf 0 oder höchstens 0,29 setzen.');
    L.push('');
  }

  // --- events
  const evRow = (x: EventEval) => {
    const src = evById.get(x.id);
    const flag = src && src.verified === false ? ' ¹' : '';
    return `| ${x.title}${flag} | ${day(x.start)} | ${x.covered ? 'ja' : 'nein'} | ${x.steps} | ${num(x.domainsWithDataMedian, 1)} / ${x.domainsWithDataMax} | `
      + `${x.maxLevel === null ? '–' : `${x.maxLevel} (${num(x.maxScore, 2)})`} | ${x.steps ? hours(x.leadL1Hours) : '–'} | ${x.steps ? hours(x.leadL2Hours) : '–'} | `
      + `${x.firedDomains.join(', ') || '–'} | ${x.expectedWithData.join(', ') || 'keiner'} | ${x.expectedHit.length}/${x.expectedDomains.length} | **${x.outcome}** |`;
  };
  L.push('## Ereignisse');
  L.push('');
  L.push('| Ereignis | Beginn (UTC) | prüfbar | Schritte im Fenster | Bereiche mit Daten (Median / Max) | höchste Stufe (Wert) | Vorlauf Stufe 1 | Vorlauf Stufe 2 | abweichende Bereiche | erwartete Bereiche mit Daten | erwartete Bereiche getroffen | Ergebnis |');
  L.push('|---|---|---|---:|---:|---|---:|---:|---|---|---:|---|');
  for (const x of e.events) L.push(evRow(x));
  L.push('');
  L.push('¹ laut Sekundärquelle, nicht selbst verifiziert (siehe `backtest/events.json`).');
  L.push('');
  const evWithTop = e.events.filter((x) => x.covered && x.topSignals.length);
  if (evWithTop.length) {
    L.push('Stärkste Signale je prüfbarem Ereignis (höchster Beitrag im Fenster):');
    L.push('');
    for (const x of evWithTop) L.push(`- ${x.title}: ${x.topSignals.map((t) => `\`${t.id}\` ${num(t.maxC, 2)}`).join(', ')}`);
    L.push('');
  }

  // --- controls
  L.push('## Kontroll-Zeiträume');
  L.push('');
  L.push('| Zeitraum | von | bis | prüfbar | Schritte | Bereiche mit Daten (Median / Max) | Anteil ab Stufe 1 | Anteil ab Stufe 2 | höchste Stufe | Ergebnis |');
  L.push('|---|---|---|---|---:|---:|---:|---:|---|---|');
  for (const x of e.controls) {
    L.push(`| ${x.title} | ${day(x.start)} | ${day(x.end)} | ${x.covered ? 'ja' : 'nein'} | ${x.steps} | ${num(x.domainsWithDataMedian, 1)} / ${x.domainsWithDataMax} | ${pct(x.shareL1)} | ${pct(x.shareL2)} | ${x.maxLevel ?? '–'} | **${x.outcome}** |`);
  }
  L.push('');

  // --- outside
  const o = e.outside;
  L.push('## Außerhalb von Ereignisfenstern');
  L.push('');
  L.push('Alle Zeitschritte, die in keinem (erweiterten) Ereignisfenster liegen. Jeder Schritt ab Stufe 1 ist hier ein Fehlalarm, '
    + 'sofern es nicht ein Ereignis gab, das in der Liste fehlt.');
  L.push('');
  L.push('| Menge | Zeitschritte | Anteil ab Stufe 1 | Anteil ab Stufe 2 |');
  L.push('|---|---:|---:|---:|');
  L.push(`| alle | ${o.steps} | ${pct(o.shareL1)} | ${pct(o.shareL2)} |`);
  L.push(`| nur Schritte mit mindestens ${MIN_DOMAINS} Bereichen mit Daten | ${o.coveredSteps} | ${pct(o.shareL1Covered)} | ${pct(o.shareL2Covered)} |`);
  L.push('');
  L.push(`Zusammenhängende Phasen ab Stufe 1 außerhalb von Ereignissen: ${o.episodesL1}.`);
  L.push('');

  // --- noise
  L.push('## Laute Signale');
  L.push('');
  L.push('Einzel-Ausschläge je Signal außerhalb von Ereignisfenstern: Zahl der Phasen, in denen das Signal einen Beitrag > 0 lieferte, '
    + 'hochgerechnet auf 30 Tage mit Daten. Signale mit weniger als 3 Tagen Daten erhalten keine Rate.');
  L.push('');
  L.push('| Signal | Bereich | Klasse | Tage mit Daten | Ausschläge | je 30 Tage | Zeitschritte mit Beitrag |');
  L.push('|---|---|---|---:|---:|---:|---:|');
  const loud = e.noise.filter((n) => n.excursions > 0);
  for (const n of loud.slice(0, 20)) {
    L.push(`| \`${n.id}\` | ${n.domain} | ${n.evidenceClass} | ${num(n.daysWithData)} | ${n.excursions} | ${num(n.per30d)} | ${n.hotSteps} |`);
  }
  if (!loud.length) L.push('| (kein Signal schlug aus) | | | | | | |');
  L.push('');
  L.push(`${e.noise.length - loud.length} Signale mit Daten schlugen außerhalb von Ereignissen nie aus.`);
  L.push('');

  // --- history runs: per event detail
  L.push(...historySection(rs.map((r, i) => ({ file: e.results[i]?.file ?? '', result: r })), evs));

  // --- conclusion
  L.push('## Fazit');
  L.push('');
  for (const p of conclusion(e)) L.push(`- ${p}`);
  L.push('');
  const qf = join(root, 'backtest', 'history-queue.json');
  if (existsSync(qf)) {
    const q = JSON.parse(readFileSync(qf, 'utf8')) as { event: string; signal: string; fixture: string }[];
    L.push('## Historische Abrufe (offen)');
    L.push('');
    L.push(`\`backtest/history-queue.json\` listet ${q.length} Abrufe, die die alten Zeiträume prüfbar machen sollen. `
      + 'Bereits vorhanden sind nur die Einträge, deren Datei unter `fixtures/` liegt. CISA KEV (ab 11/2021) und CISA ICS (ab 2017) brauchen keine Abrufe, '
      + 'ihre aktuelle Datei enthält die datierte Historie.');
    L.push('');
    L.push('| Zeitraum | Abrufe | vorhanden | Bereiche, die damit Daten bekämen |');
    L.push('|---|---:|---:|---|');
    const sigDomain = new Map((rs[0]?.signals ?? []).map((s) => [s.id, s.domain]));
    for (const id of [...new Set(q.map((x) => x.event))]) {
      const mine = q.filter((x) => x.event === id);
      const have = mine.filter((x) => existsSync(join(root, 'fixtures', x.fixture))).length;
      const doms = [...new Set(mine.map((x) => sigDomain.get(x.signal) ?? '?'))];
      if (new Date(evById.get(id)?.start ?? 0) >= new Date('2021-11-03')) doms.push('vuln (KEV)');
      else if (new Date(evById.get(id)?.start ?? 0) >= new Date('2017-03-01')) doms.push('vuln (ICS)');
      L.push(`| ${id} | ${mine.length} | ${have} | ${doms.join(', ')} |`);
    }
    L.push('');
  }
  L.push('## Grenzen dieser Auswertung');
  L.push('');
  L.push('- Die Ereignisliste ist klein und handverlesen. Die Fehlalarm-Rate außerhalb von Ereignissen ist eine Obergrenze: '
    + 'nicht gelistete echte Vorfälle zählen dort als Fehlalarm.');
  L.push('- Vorlaufzeiten sind auf die Schrittweite gerundet. Tägliche Quellen (die meisten mit Historie) stempeln ihren Tageswert auf 00:00 UTC. '
    + 'Standardmäßig wird ein solcher Wert erst am Tagesende sichtbar gemacht (sonst sähe das System um 03:00 schon den ganzen Tag). '
    + 'Echte Veröffentlichungsverzüge (SOFR am Folgetag, Tor Metrics mehrere Tage) sind nicht nachgebildet; Vorlaufzeiten täglicher Quellen sind deshalb eher zu früh.');
  L.push('- Signale, die nur einen aktuellen Zustand liefern (Statusseiten, Blocklisten, FAA, RIPE Atlas, Mempool), haben im Replay genau einen Wert '
    + 'und damit nie eine Baseline. Sie sind im Zeitraum faktisch blind.');
  L.push('- Die historischen Ereignisse (2016 bis 2024) brauchen eigene Abrufe (`backtest/history-queue.json`), danach '
    + '`node src/backtest/run.ts --history <id>` je Ereignis und `node src/backtest/evaluate.ts backtest/results/*.json`.');
  L.push('- CISA KEV begann am 03.11.2021 mit mehreren hundert Einträgen in den ersten Tagen. Für Ereignisse kurz danach (Log4Shell) ist die KEV-Baseline deshalb verzerrt.');
  L.push('- Die Historien-Läufe nutzen nur Quellen mit abrufbarer Vergangenheit. Statusseiten, Blocklisten, CT-Logs, FAA, RIPE Atlas und IODA (Antworten zu groß) fehlen dort ganz; '
    + 'ein „verpasst“ in einem Historien-Lauf sagt nur etwas über diese Teilmenge.');
  L.push('- Klasse D (Aufmerksamkeit) fließt nicht in die Stufe, ihre Ausschläge sind in der Tabelle „Laute Signale“ trotzdem gezählt.');
  L.push('');
  return L.join('\n');
}

function conclusion(e: Evaluation): string[] {
  const out: string[] = [];
  const c = e.coverage;
  const testable = e.events.filter((x) => x.covered);
  const untestable = e.events.filter((x) => !x.covered);
  const detected = testable.filter((x) => x.outcome === 'erkannt');
  const weak = testable.filter((x) => x.outcome === 'schwach');
  const missed = testable.filter((x) => x.outcome === 'verpasst');
  out.push(`Datenlage: ${c.signalsWithDataEver} von ${c.signalsInScenario} katalogisierten Signalen (${c.signalsActive} mit Collector) und ${c.domainsWithDataEver} von ${c.domainsInScenario} Bereichen hatten im Zeitraum überhaupt Daten. `
    + `Zeitschritte mit mindestens ${MIN_DOMAINS} Bereichen: ${c.stepsWithMinDomains} von ${c.stepsTotal}.`);
  out.push(`Ereignisse: ${e.events.length} gelistet, ${testable.length} prüfbar, ${untestable.length} nicht prüfbar `
    + `(${untestable.map((x) => x.id).join(', ') || '–'}). Von den prüfbaren: ${detected.length} erkannt (ab Stufe 2), ${weak.length} nur Stufe 1, ${missed.length} verpasst.`);
  if (weak.length && (e.outside.shareL1 ?? 0) > 0.2) {
    out.push(`Stufe 1 in einem Ereignisfenster ist bei dieser Grundrate nicht von Normalbetrieb zu unterscheiden; „schwach“ heißt hier praktisch „nicht erkannt“.`);
  }
  for (const x of testable) {
    const hit = x.expectedHit.length ? `erwartete Bereiche mit Ausschlag: ${x.expectedHit.join(', ')}` : 'keiner der erwarteten Bereiche schlug aus';
    const blind = x.expectedDomains.filter((d) => !x.expectedWithData.includes(d));
    const blindTxt = blind.length ? ` Ohne verwertbare Daten (frisch und mit Baseline) waren die erwarteten Bereiche ${blind.join(', ')}; dort konnte das System nichts sehen.` : '';
    const seen = Object.entries(x.expectedSignals).map(([d, ids]) => `${d}: ${ids.map((i) => `\`${i}\``).join(', ')}`).join('; ');
    const seenTxt = seen ? ` Frische Signale in den erwarteten Bereichen: ${seen}.` : '';
    out.push(`${x.title}: höchste Stufe ${x.maxLevel}, ${hit}; abweichende Bereiche im Fenster: ${x.firedDomains.join(', ') || 'keine'}.${seenTxt}${blindTxt}`);
  }
  const o = e.outside;
  if (o.steps > 0) {
    out.push(`Außerhalb von Ereignissen stand das System in ${pct(o.shareL1)} der Zeitschritte auf Stufe 1 oder höher und in ${pct(o.shareL2)} auf Stufe 2 oder höher. `
      + (o.shareL1 !== null && o.shareL1 > 0.2
        ? 'Das ist weit entfernt vom Anspruch „Der Normalfall ist Ruhig“; mit dieser Grundrate ist ein Ausschlag während eines Ereignisses kein Beleg für Erkennung.'
        : 'Die Grundrate ist niedrig genug, um Ausschläge während Ereignissen als Abweichung vom Normalzustand lesen zu können.'));
  }
  if (e.diagnostics.stepsL1WithoutActiveDomain > 0) {
    const alt = e.diagnostics.levelDistributionIfNoDomainIsCalm;
    const altL1 = alt.slice(1).reduce((a, b) => a + b.steps, 0);
    out.push(`${e.diagnostics.stepsL1WithoutActiveDomain} der Schritte ab Stufe 1 entstehen ohne einen einzigen abweichenden Bereich (Schranken-Lücke, siehe Engine-Befund). `
      + `Ohne diese Lücke blieben ${altL1} Schritte ab Stufe 1.`);
  }
  const loud = e.noise.filter((n) => (n.per30d ?? 0) > 0).slice(0, 3);
  if (loud.length) out.push(`Lauteste Signale: ${loud.map((n) => `\`${n.id}\` (${num(n.per30d)} Ausschläge je 30 Tage)`).join(', ')}. Diese zuerst prüfen (Baseline, Schwellen, Saisonalität, Einheit).`);
  if (detected.length === 0) {
    out.push('**Eine Vorhersage- oder auch nur Erkennungskraft ist mit den heutigen Daten nicht belegt.** '
      + (testable.length === 0
        ? 'Kein gelistetes Ereignis war überhaupt prüfbar.'
        : 'Kein prüfbares Ereignis erreichte Stufe 2.'));
  } else {
    out.push(`${detected.length} Ereignis(se) erreichten Stufe 2. Bei ${testable.length} prüfbaren Ereignissen und der genannten Grundrate ist das statistisch kein Beleg; dafür braucht es die historischen Abrufe.`);
  }
  return out;
}
