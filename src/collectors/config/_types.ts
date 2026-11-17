// Typen der Szenario-Konfiguration für die geteilten Collectors.
// Jede Szenario-Datei (src/collectors/config/<szenario>.ts) exportiert genau ein ScenarioCollectorConfig.
// Die Collectors setzen ihre Signale und Requests aus allen Szenario-Dateien zusammen (siehe config/index.ts).
// Signal-Deklarationen (`signal`) sind Teil-SignalDefs: Felder, die der Collector für alle Szenarien gleich setzt
// (Quelle, independenceGroup, Lizenz, Intervall ...), dürfen fehlen; `scenarios` ist standardmäßig [scenario].
// Anleitung: docs/SCENARIO-CONFIG-GUIDE.md

import type { SignalDef } from '../../core/types.ts';

/** Teil-Deklaration eines Signals; was fehlt, ergänzt der Collector (siehe Defaults im jeweiligen Collector). */
export type SignalDecl = Partial<SignalDef> & { id: string };

/** wikimedia-pageviews: Summe der täglichen Aufrufe über höchstens 6 Artikel eines Wikipedia-Projekts. */
export interface WikipediaGroup {
  signal: SignalDecl;
  /** z. B. 'de.wikipedia', 'en.wikipedia' */
  project: string;
  /** Artikeltitel mit Unterstrichen statt Leerzeichen, höchstens 6 (die mit den vermutlich meisten Aufrufen) */
  articles: string[];
}

/** hn-algolia: Summe der Hacker-News-Stories der letzten 24 Stunden (voller UTC-Vortag), deren Titel einen Begriff enthält. */
export interface HnTermGroup {
  signal: SignalDecl;
  /** Begriffe für die Titelsuche; Anführungszeichen = Phrase */
  terms: string[];
  /** Präfix der Fixture-Namen (z. B. 'war-'), damit sich Begriffe verschiedener Szenarien nicht überschneiden */
  fixturePrefix: string;
}

/** gdelt-doc: ein Strom (eine Anfrage) mode=timelinevol, timespan=1m. */
export interface GdeltStream {
  signal: SignalDecl;
  /** GDELT-Suchausdruck inkl. sourcelang:... */
  query: string;
  /** stabiler Fixture-Name, z. B. 'gdelt/<szenario>-<thema>-timelinevol-1m.json' */
  fixture: string;
}

/** polymarket-gamma: Textsuche, Filter auf den Fragetext, zwei Signale (höchste Ja-Wahrscheinlichkeit, 24-h-Volumen). */
export interface PolymarketSearch {
  terms: string[];
  /** Fragetext eines Marktes muss passen */
  match: RegExp;
  yesSignal: SignalDecl;
  volumeSignal: SignalDecl;
}

export type YahooMetric = 'rel-volume-sum' | 'close' | 'abs-return-mean';

/** yahoo-chart: ein abgeleitetes Signal aus einem oder mehreren Symbolen (jedes Symbol wird je Lauf nur einmal geholt). */
export interface YahooSpec {
  signal: SignalDecl;
  symbols: string[];
  /** close: Schlusskurs (nur erstes Symbol); abs-return-mean: Mittel der Beträge der Tagesrenditen in %;
   *  rel-volume-sum: Volumensumme geteilt durch den Median der Handelstage davor */
  metric: YahooMetric;
}

/** ioda: ein Land oder eine Ländergruppe (Summe je Stunde, nur wenn alle Länder Werte haben). */
export interface IodaCountryGroup {
  signal: SignalDecl;
  /** ISO-3166-Codes; ein Eintrag = Einzelland */
  countries: string[];
  /** Standard 'bgp' */
  datasource?: 'bgp' | 'ping-slash24';
}

/** ooni: Anteil anomaler web_connectivity-Messungen je Land und Tag. */
export interface OoniCountry {
  signal: SignalDecl;
  cc: string;
  /** Tage Historie je Anfrage, Standard 30 (ca. 145 Zeichen je Tag) */
  windowDays?: number;
}

/** statuspage: Signal aus den Status-Abfragen der Hosts in catalog/statuspage-hosts.json. */
export interface StatuspageSignal {
  signal: SignalDecl;
  /**
   * major-share / disrupted-share: Prozent der antwortenden Hosts mit schwerer bzw. irgendeiner Störung
   *   (mit `category` nur Hosts dieser Kategorie, mindestens 3 antwortende Hosts);
   * incident-starts / incident-major-starts: neue Störungen pro Tag über die Leitanbieter (incidents.json).
   */
  measure: 'major-share' | 'disrupted-share' | 'incident-starts' | 'incident-major-starts';
  /** Feld `category` in catalog/statuspage-hosts.json (cloud, payment, dev, saas, telecom, crypto, ai) */
  category?: string;
}

/** adsb-lol: derselbe Zählwert (sichtbare Militärflugzeuge weltweit) unter einer weiteren Signal-ID. */
export interface AdsbSignal {
  signal: SignalDecl;
}

export interface ScenarioCollectorConfig {
  /** Szenario-ID wie in catalog/scenarios.json */
  scenario: string;
  wikipedia: WikipediaGroup[];
  hackerNews: HnTermGroup[];
  gdelt: GdeltStream[];
  polymarket: PolymarketSearch[];
  yahoo: YahooSpec[];
  iodaCountries: IodaCountryGroup[];
  /** Signale mit der Zahl der von IODA erkannten Länder-Ausfallereignisse pro Tag (eine gemeinsame Anfrage) */
  iodaEvents: SignalDecl[];
  ooni: OoniCountry[];
  statuspage: StatuspageSignal[];
  adsb: AdsbSignal[];
}
