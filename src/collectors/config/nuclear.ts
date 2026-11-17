// Szenario nuclear (Nuklearer Zwischenfall): Konfiguration der geteilten Collectors. Anleitung: docs/SCENARIO-CONFIG-GUIDE.md
// Nur passive öffentliche Aufmerksamkeits-, Markt- und Zählwerte; keine technischen Details zu Waffen.
// Artikel-, Begriffs- und Symbolwahl nach Kenntnis und Katalog (catalog/nuclear-build-order.json), noch nicht an echten Antworten
// geprüft (Stand 17.11.2026): fehlende Wikipedia-Artikel (404) fallen aus der Summe, siehe Kopfkommentar von wikimedia-pageviews.
// Nicht belegt, weil der Collector nicht konfigurationsgesteuert ist: adsb_command_relay_aircraft und adsb_tanker_bomber_count
// (brauchen Typ-Abfrage bzw. Typfeld t), nuclear.attention.mastodon_nuclear_tags (mastodon-trends hat keine Konfiguration).

import type { ScenarioCollectorConfig, YahooSpec } from './_types.ts';

const GDELT_BANAL = ['Jahrestage (Hiroshima, Tschernobyl, Fukushima)', 'Filme und Serien über Atomthemen', 'Energiepolitik-Debatten', 'Wochentagsrhythmus', 'Änderungen der GDELT-Abdeckung'];
const WIKI_BANAL = ['Jahrestage von Hiroshima, Tschernobyl und Fukushima', 'Filme, Serien und Spiele (z. B. Fallout)', 'Schulstoff', 'Energiepolitik-Debatten'];

/** Kurs-Stand je Symbol (metric close), Baseline 28 Tage. */
const yahooClose = (id: string, sym: string, name: string, plain: string, weight: number, unit: string, banalCauses: string[]): YahooSpec => ({
  signal: { id, name, plain, weight, unit, manipulability: 'low', banalCauses, baseline: { method: 'rolling', windowDays: 28, minPoints: 14 } },
  symbols: [sym], metric: 'close',
});

export default {
  scenario: 'nuclear',

  wikipedia: [
    {
      signal: {
        id: 'nuclear.attention.wiki_nuclear_de', name: 'Wikipedia-Aufrufe zu Atomkrieg und Strahlenschutz (deutsch)',
        plain: 'Wie oft deutschsprachige Wikipedia-Artikel zu Kaliumiodid, Atomkrieg, radioaktivem Niederschlag, Strahlenkrankheit, Kernwaffen und Kernwaffentests aufgerufen werden.',
        weight: 0.5, banalCauses: WIKI_BANAL,
      },
      project: 'de.wikipedia',
      articles: ['Kaliumiodid', 'Atomkrieg', 'Radioaktiver_Niederschlag', 'Strahlenkrankheit', 'Kernwaffe', 'Kernwaffentest'],
    },
    {
      signal: {
        id: 'nuclear.attention.wiki_nuclear_en', name: 'Wikipedia-Aufrufe zu nuclear war und fallout (englisch)',
        plain: 'Wie oft englische Wikipedia-Artikel zu Potassium iodide, Nuclear warfare, Nuclear fallout, Acute radiation syndrome, Nuclear weapon und Nuclear weapons testing aufgerufen werden.',
        weight: 0.5, banalCauses: WIKI_BANAL,
      },
      project: 'en.wikipedia',
      articles: ['Potassium_iodide', 'Nuclear_warfare', 'Nuclear_fallout', 'Acute_radiation_syndrome', 'Nuclear_weapon', 'Nuclear_weapons_testing'],
    },
    {
      signal: {
        id: 'nuclear.attention.wiki_plants_sites', name: 'Wikipedia-Aufrufe zu Kernkraftwerken und Reaktorunfällen (englisch)',
        plain: 'Wie oft englische Wikipedia-Artikel zum Kraftwerk Saporischschja, zu Tschernobyl, Fukushima, Three Mile Island und Kernschmelzen aufgerufen werden.',
        weight: 0.55,
        banalCauses: ['Jahrestage von Tschernobyl und Fukushima', 'Dokumentationen und Serien', 'Berichte der IAEA über Saporischschja', 'Schulstoff'],
      },
      project: 'en.wikipedia',
      articles: ['Zaporizhzhia_Nuclear_Power_Plant', 'Chernobyl_disaster', 'Fukushima_nuclear_accident', 'Three_Mile_Island_accident', 'Nuclear_meltdown', 'Nuclear_power_plant'],
    },
  ],

  hackerNews: [],

  gdelt: [
    {
      signal: {
        id: 'nuclear.attention.gdelt_nuclear_volume', name: 'Medienvolumen Atom, Strahlung und Reaktor (GDELT, englisch)',
        plain: 'Welcher Anteil der weltweiten englischsprachigen Nachrichtenartikel von nuclear, radiation oder reactor handelt.',
        weight: 0.5, manipulability: 'medium', banalCauses: GDELT_BANAL,
      },
      query: '(nuclear OR radiation OR reactor) sourcelang:english', fixture: 'gdelt/nuclear-en-timelinevol-1m.json',
    },
  ],

  polymarket: [
    {
      terms: ['nuclear weapon', 'nuclear strike', 'nuclear test'],
      // Nur Atomwaffen-Fragen: Einsatz, Test, Detonation (filtert Energie- und Aktienmärkte mit dem Wort nuclear).
      match: /nuclear (weapon|war|strike|test|attack|detonation|bomb|explosion)|detonat|atomic bomb/i,
      yesSignal: {
        id: 'nuclear.markets.polymarket_nuclear', domain: 'markets',
        name: 'Prognosemärkte zu Atomwaffen: höchste Ja-Wahrscheinlichkeit',
        plain: 'Die höchste Wahrscheinlichkeit, die Wettende auf Polymarket einem Atomwaffeneinsatz, Atomtest oder einer Detonation geben (nur wenn ein passender Markt existiert).',
        evidenceClass: 'D', direction: 'both', weight: 0.5, unit: '%',
        banalCauses: ['Geringe Liquidität', 'Einzelne Großhändler', 'Wechsel der gefundenen Märkte', 'Ablauf eines Marktes'],
      },
      volumeSignal: {
        id: 'nuclear.markets.polymarket_nuclear_volume', domain: 'markets',
        name: 'Handelsvolumen in Atomwaffen-Prognosemärkten (24 Stunden)',
        plain: 'Wie viel in den letzten 24 Stunden auf Atomwaffeneinsatz oder Atomtests gewettet wurde; plötzliche Sprünge fallen auf.',
        evidenceClass: 'D', direction: 'up', weight: 0.3, unit: 'USD/24h',
        banalCauses: ['Medienereignisse', 'Neuer Markt in der Trefferliste'],
      },
    },
  ],

  // Gold und VIX werden auch für war abgerufen: kein zusätzlicher Request für ^VIX und GC=F.
  yahoo: [
    yahooClose('nuclear.markets.uranium_etf_urnm', 'URNM', 'Uran-Bergbau-ETF (URNM)', 'Der Kurs eines Fonds aus Uranförderern; steigt bei Erwartung höherer Nachfrage nach Kernenergie, kann aber auch Krisenangst anzeigen.', 0.4, 'USD', ['Energiepolitik und Reaktor-Neubauten', 'Quartalszahlen der Förderer', 'Spekulation auf KI-Strombedarf', 'Sektorrotation']),
    yahooClose('nuclear.markets.cameco_ccj', 'CCJ', 'Cameco-Aktie (Uran)', 'Der Kurs von Cameco, einem der größten Uranförderer der Welt.', 0.35, 'USD', ['Quartalszahlen', 'Liefervertrags-Meldungen', 'Energiepolitik']),
    yahooClose('nuclear.markets.uranium_trust_sprott', 'U-UN.TO', 'Sprott Physical Uranium Trust', 'Der Kurs eines Fonds, der physisches Uran hält; folgt dem Uranpreis.', 0.35, 'CAD', ['Uran-Nachfrage der Versorger', 'Kapitalerhöhungen des Fonds', 'Wechselkurs']),
    {
      signal: {
        id: 'nuclear.markets.defense_stocks', name: 'Tagesschwankung großer Rüstungswerte (LMT, NOC, Rheinmetall)',
        plain: 'Wie stark die Aktien von Lockheed Martin, Northrop Grumman und Rheinmetall im Mittel an einem Tag steigen oder fallen.',
        weight: 0.3, unit: '% (Betrag)', manipulability: 'low', baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
        banalCauses: ['Quartalszahlen', 'Haushaltsdebatten', 'Auftragsmeldungen', 'Verfallstermine'],
      },
      symbols: ['LMT', 'NOC', 'RHM.DE'], metric: 'abs-return-mean',
    },
    {
      signal: {
        id: 'nuclear.markets.vix_gold', name: 'Tagesschwankung von Angstindex (VIX) und Gold',
        plain: 'Wie stark der Angstindex der US-Börse und der Goldpreis im Mittel an einem Tag steigen oder fallen; beide reagieren auf Krisenangst.',
        weight: 0.25, unit: '% (Betrag)', manipulability: 'medium', baseline: { method: 'rolling', windowDays: 28, minPoints: 14 },
        banalCauses: ['Notenbank-Termine', 'Verfallstermine', 'Dollar- und Zinsbewegungen'],
      },
      symbols: ['^VIX', 'GC=F'], metric: 'abs-return-mean',
    },
  ],

  iodaCountries: [],
  iodaEvents: [],
  ooni: [],
  statuspage: [],

  adsb: [
    {
      signal: {
        id: 'nuclear.military.adsb_mil_total', domain: 'military',
        name: 'Sichtbare Militärflugzeuge weltweit (Atomsicht)',
        plain: 'Wie viele Militärflugzeuge gerade auf öffentlichen Flugradaren zu sehen sind; ein deutlicher Anstieg kann auf Verlegungen und erhöhte Einsatzbereitschaft hinweisen.',
        direction: 'up', weight: 0.35,
        banalCauses: ['Übungen', 'Änderungen der Feeder-Abdeckung', 'Tageszeit und Wochentag'],
      },
    },
  ],
} satisfies ScenarioCollectorConfig;
