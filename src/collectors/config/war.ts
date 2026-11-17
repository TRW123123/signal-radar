// Szenario war (Kriegseskalation): Konfiguration der geteilten Collectors.
// Signal-IDs, Fixture-Namen und Requests sind aus den Collectors hierher verschoben (Stand 17.11.2026).

import type { IodaCountryGroup, ScenarioCollectorConfig, YahooSpec } from './_types.ts';

const GDELT_BANAL = ['Sport- und Kulturberichte mit Ländernamen', 'Wahlen und Jahrestage', 'Wochentagsrhythmus', 'Änderungen der GDELT-Abdeckung'];
const IODA_BANAL = ['Stromausfälle', 'Staatlich angeordnete Abschaltungen und Prüfungsabschaltungen', 'Messausfall einzelner BGP-Quellen bei IODA', 'Seekabelbruch'];
const iodaCommon = {
  domain: 'connectivity', direction: 'down' as const, kind: 'gauge' as const, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12,
  baseline: { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 }, banalCauses: IODA_BANAL,
};
const iodaCountry = (cc: string, name: string, weight: number): IodaCountryGroup => ({
  signal: {
    ...iodaCommon, id: `war.connectivity.ioda_${cc.toLowerCase()}`, name: `IODA: ${name} im Routing`, weight,
    plain: `Wie viele Netzblöcke (/24) aus ${name} weltweit im Routing sichtbar sind; ein Einbruch heißt, dass Netze verschwinden (Stromnetz, Angriff oder Abschaltung).`,
  },
  countries: [cc],
});

/** Kurs-Stand je Symbol (metric close), Baseline 28 Tage. */
const yahooClose = (id: string, sym: string, name: string, plain: string, weight: number, unit: string, manipulability: 'low' | 'medium' | 'high', banalCauses: string[]): YahooSpec => ({
  signal: { id, name, plain, weight, unit, manipulability, banalCauses, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 } },
  symbols: [sym], metric: 'close',
});

const ooniCountries: [string, string][] = [['IR', 'Iran'], ['IL', 'Israel'], ['UA', 'Ukraine'], ['RU', 'Russland'], ['TW', 'Taiwan']];

export default {
  scenario: 'war',

  wikipedia: [
    {
      signal: {
        id: 'war.attention.wikipedia_de',
        name: 'Wikipedia-Aufrufe zu Kriegsthemen (deutsch)',
        plain: 'Wie oft deutschsprachige Wikipedia-Artikel zu Dritter Weltkrieg, Atomkrieg, Mobilmachung, Wehrpflicht oder Kriegsrecht aufgerufen werden.',
        banalCauses: ['Wehrdienst-Debatten', 'Warntag und Katastrophenschutz-Berichte', 'Dokumentationen und Filme', 'Schulstoff'],
      },
      project: 'de.wikipedia',
      articles: ['Dritter_Weltkrieg', 'Wehrpflicht', 'Atomkrieg', 'Mobilmachung', 'Kriegsrecht', 'Straße_von_Hormus'],
    },
    {
      signal: {
        id: 'war.attention.wikipedia_en',
        name: 'Wikipedia-Aufrufe zu Kriegsthemen (englisch)',
        plain: 'Wie oft englische Wikipedia-Artikel zu World War III, Atomkrieg, Wehrpflicht, Kriegsrecht, Taiwan oder der Straße von Hormus aufgerufen werden.',
        banalCauses: ['Wehrdienst-Debatten', 'Warntag und Katastrophenschutz-Berichte', 'Dokumentationen und Filme', 'Schulstoff'],
      },
      project: 'en.wikipedia',
      articles: ['World_War_III', 'Nuclear_warfare', 'Conscription', 'Martial_law', 'Strait_of_Hormuz', 'Taiwan_Strait'],
    },
  ],

  hackerNews: [
    {
      signal: {
        id: 'war.attention.hackernews_mentions',
        name: 'Hacker-News-Stories zu Krieg und Eskalation',
        plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie World War, nuclear war oder Hormuz im Titel haben.',
        weight: 0.35,
        banalCauses: ['Meinungsbeiträge', 'Dokumentationen und Jahrestage', 'Nachrichten-Spitzen'],
      },
      terms: ['"world war"', '"nuclear war"', 'Hormuz', '"Taiwan Strait"', 'conscription', '"missile strike"'],
      fixturePrefix: 'war-',
    },
  ],

  gdelt: [
    {
      signal: {
        id: 'war.attention.gdelt_hotspot_iran_hormuz', name: 'Medienvolumen Iran und Hormus (GDELT, englisch)',
        plain: 'Welcher Anteil der weltweiten englischsprachigen Nachrichtenartikel von Iran oder der Straße von Hormus handelt.',
        weight: 0.4, manipulability: 'high', banalCauses: GDELT_BANAL,
      },
      query: '(Iran OR Hormuz) sourcelang:english', fixture: 'gdelt/war-iran-hormuz-en-timelinevol-1m.json',
    },
    {
      signal: {
        id: 'war.attention.gdelt_hotspot_ukraine_nato', name: 'Medienvolumen Ukraine und NATO-Ostflanke (GDELT, englisch)',
        plain: 'Welcher Anteil der weltweiten englischsprachigen Nachrichtenartikel von der Ukraine oder der NATO handelt.',
        weight: 0.4, manipulability: 'high', banalCauses: GDELT_BANAL,
      },
      query: '(Ukraine OR NATO) sourcelang:english', fixture: 'gdelt/war-ukraine-nato-en-timelinevol-1m.json',
    },
    {
      signal: {
        id: 'war.attention.gdelt_hotspot_taiwan', name: 'Medienvolumen Taiwan (GDELT, englisch)',
        plain: 'Welcher Anteil der weltweiten englischsprachigen Nachrichtenartikel von Taiwan handelt.',
        weight: 0.4, manipulability: 'high', banalCauses: GDELT_BANAL,
      },
      query: 'Taiwan sourcelang:english', fixture: 'gdelt/war-taiwan-en-timelinevol-1m.json',
    },
    {
      signal: {
        id: 'war.attention.gdelt_coverage_share', name: 'GDELT: Anteil der Weltkriegs-Berichte am Nachrichtenvolumen',
        plain: 'Welcher Anteil der englischsprachigen Nachrichtenartikel von einem Weltkrieg oder Atomkrieg handelt.',
        weight: 0.45, manipulability: 'medium', banalCauses: ['Kriegsmüdigkeit', 'Filme, Serien und Spiele', ...GDELT_BANAL],
      },
      query: '("World War III" OR "nuclear war") sourcelang:english', fixture: 'gdelt/war-ww3-en-timelinevol-1m.json',
    },
  ],

  polymarket: [
    {
      terms: ['world war 3', 'nuclear weapon', 'iran strike', 'strait of hormuz', 'taiwan invasion', 'russia nato'],
      // Eskalationsbegriffe, oder Konfliktland zusammen mit einem Gewaltbegriff (filtert Sportmärkte).
      match: /world war|\bww3\b|nuclear (weapon|war|strike|test|attack)|hormuz|invade|invasion|blockade|\b(iran|israel|taiwan|china|russia|nato|ukraine|north korea)\b.*\b(strike|attack|war|conflict|invade|invasion|military|nuclear|blockade|troops)\b|\b(strike|attack|war|conflict|military|troops)\b.*\b(iran|israel|taiwan|china|russia|nato|ukraine|north korea)\b/i,
      yesSignal: {
        id: 'war.attention.prediction_markets_war', domain: 'attention',
        name: 'Prognosemärkte zu Krieg: höchste Ja-Wahrscheinlichkeit',
        plain: 'Die höchste Wahrscheinlichkeit, die Wettende auf Polymarket einem Weltkrieg, Atomwaffeneinsatz, Angriff oder einer Blockade geben (nur wenn ein passender Markt existiert).',
        evidenceClass: 'D', direction: 'both', weight: 0.5, unit: '%',
        banalCauses: ['Geringe Liquidität', 'Einzelne Großhändler', 'Wechsel der gefundenen Märkte', 'Ablauf eines Marktes'],
      },
      volumeSignal: {
        id: 'war.attention.prediction_volume_spike', domain: 'attention',
        name: 'Handelsvolumen in Kriegs-Prognosemärkten (24 Stunden)',
        plain: 'Wie viel in den letzten 24 Stunden auf Krieg, Atomwaffen, Angriffe und Blockaden gewettet wurde; plötzliche Sprünge fallen auf.',
        evidenceClass: 'D', direction: 'up', weight: 0.35, unit: 'USD/24h',
        banalCauses: ['Medienereignisse', 'Neuer Markt in der Trefferliste'],
      },
    },
  ],

  // Brent/WTI heißen brent_futures/wti_futures, weil github-oil-prices die Katalog-IDs brent_price/wti_price belegt.
  // Gold und VIX werden auch für cyber abgerufen: kein zusätzlicher Request.
  yahoo: [
    yahooClose('war.markets.brent_futures', 'BZ=F', 'Brent-Future (Börsenkurs)', 'Der Preis für Nordsee-Rohöl (Brent); Kriegsangst in Förderregionen treibt ihn nach oben.', 0.5, 'USD je Barrel', 'medium', ['OPEC+-Entscheidungen', 'Konjunkturdaten', 'Dollar-Schwankung', 'Kontraktwechsel']),
    yahooClose('war.markets.wti_futures', 'CL=F', 'WTI-Future (Börsenkurs)', 'Der Preis für US-Rohöl (WTI); folgt dem Brent-Preis und reagiert auf Risiken im Golf.', 0.4, 'USD je Barrel', 'medium', ['US-Lagerdaten', 'Pipeline-Engpässe', 'Kontraktwechsel']),
    yahooClose('war.markets.gold_price', 'GC=F', 'Goldpreis', 'Der Goldpreis; Anleger flüchten bei Angst in Gold.', 0.3, 'USD je Unze', 'medium', ['Realzinsen', 'Zentralbankkäufe', 'Dollar']),
    yahooClose('war.markets.oil_volatility_ovx', '^OVX', 'Öl-Volatilität (OVX)', 'Wie stark Anleger große Schwankungen des Ölpreises erwarten; steigt bei Sorge um Lieferausfälle.', 0.3, 'Punkte', 'medium', ['OPEC+-Sitzungen', 'Verfallstermine']),
    yahooClose('war.markets.defense_etf_us', 'ITA', 'US-Rüstungs-ETF (ITA)', 'Der Kurs eines Fonds aus US-Rüstungs- und Luftfahrtfirmen; steigt, wenn höhere Militärausgaben erwartet werden.', 0.4, 'USD', 'low', ['Haushaltsdebatten', 'Quartalszahlen', 'Sektorrotation']),
    yahooClose('war.markets.defense_stocks_eu', 'RHM.DE', 'Rheinmetall-Aktie', 'Der Kurs von Rheinmetall, dem größten deutschen Rüstungskonzern; spiegelt Erwartungen an Aufträge und Eskalation.', 0.35, 'EUR', 'medium', ['Firmenwarnungen', 'Auftragsmeldungen', 'Quartalszahlen', 'Zinsen']),
    yahooClose('war.markets.wheat_prices', 'ZW=F', 'Weizenpreis', 'Der Weltmarktpreis für Weizen; Ukraine und Russland sind große Exporteure, Kriege treiben den Preis.', 0.3, 'US-Cent je Scheffel', 'medium', ['Ernte', 'Wetter', 'Kontraktwechsel']),
    yahooClose('war.markets.vix', '^VIX', 'VIX (Angstindex der US-Börse), Kriegssicht', 'Wie nervös die US-Börse insgesamt ist; steigt bei jeder Art von Krise, auch bei Kriegsangst.', 0.2, 'Punkte', 'medium', ['Notenbank-Termine', 'Tech-Korrektur', 'Verfallstermine']),
  ],

  iodaCountries: [
    iodaCountry('IR', 'Iran', 0.85),
    iodaCountry('IL', 'Israel', 0.8),
    iodaCountry('UA', 'Ukraine', 0.8),
    iodaCountry('RU', 'Russland', 0.75),
    iodaCountry('TW', 'Taiwan', 0.85),
    {
      signal: {
        ...iodaCommon, id: 'war.connectivity.gulf_states_internet', name: 'IODA: Golfstaaten im Routing (Summe)',
        plain: 'Summe der im Routing sichtbaren Netzblöcke von Saudi-Arabien, den Emiraten und Katar; ein Einbruch deutet auf einen großflächigen Ausfall am Golf.',
        weight: 0.75,
      },
      countries: ['SA', 'AE', 'QA'],
    },
  ],
  iodaEvents: [],

  // Golfstaaten bewusst nicht: zu wenige Messungen je Tag; für den Golf trägt IODA.
  ooni: ooniCountries.map(([cc, name]) => ({
    signal: {
      id: `war.connectivity.ooni_anomaly_share_${cc.toLowerCase()}`, domain: 'connectivity',
      name: `Anteil anomaler Web-Messungen (${name})`,
      plain: `Welcher Anteil der OONI-Messungen zur Erreichbarkeit von Webseiten in ${name} auffällig ausfällt oder blockiert wird.`,
    },
    cc,
  })),

  statuspage: [],

  adsb: [
    {
      signal: {
        id: 'war.military.mil_aircraft_visible_global', domain: 'military',
        name: 'Sichtbare Militärflugzeuge weltweit (Kriegssicht)',
        plain: 'Wie viele Militärflugzeuge gerade auf öffentlichen Flugradaren zu sehen sind; ein deutlicher Anstieg kann auf Verlegungen und erhöhte Einsatzbereitschaft hinweisen.',
        direction: 'up', weight: 0.4,
        banalCauses: ['Übungen', 'Änderungen der Feeder-Abdeckung', 'Tageszeit und Wochentag'],
      },
    },
  ],
} satisfies ScenarioCollectorConfig;
