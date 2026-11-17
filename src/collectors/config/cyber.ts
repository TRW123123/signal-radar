// Szenario cyber (großer Cyberangriff): Konfiguration der geteilten Collectors.
// Signal-IDs, Fixture-Namen und Requests sind aus den Collectors hierher verschoben (Stand 17.11.2026).

import type { ScenarioCollectorConfig } from './_types.ts';

const ooniCountries: [string, string][] = [['DE', 'Deutschland'], ['US', 'USA'], ['GB', 'Großbritannien'], ['FR', 'Frankreich'], ['NL', 'Niederlande']];
const IODA_BIG_COUNTRIES = ['DE', 'US', 'GB', 'FR', 'NL', 'JP', 'IN', 'BR'];
const iodaHourly = { method: 'hour-of-week' as const, windowDays: 28, minPoints: 48 };
const yahooBaseline = { method: 'rolling' as const, windowDays: 56, minPoints: 21 };

export default {
  scenario: 'cyber',

  wikipedia: [
    {
      signal: {
        id: 'cyber.attention.wikipedia_de',
        name: 'Wikipedia-Aufrufe zu Cyber-Themen (deutsch)',
        plain: 'Wie oft deutschsprachige Wikipedia-Artikel zu Hackern, Ransomware, Phishing und Stromausfall aufgerufen werden.',
      },
      project: 'de.wikipedia',
      articles: ['Hacker', 'Phishing', 'Computervirus', 'Ransomware', 'Stromausfall', 'Denial_of_Service'],
    },
    {
      signal: {
        id: 'cyber.attention.wikipedia_en',
        name: 'Wikipedia-Aufrufe zu Cyber-Themen (englisch)',
        plain: 'Wie oft englische Wikipedia-Artikel zu Cyberangriffen, Ransomware, Phishing und Datenlecks aufgerufen werden.',
      },
      project: 'en.wikipedia',
      articles: ['Computer_security', 'Phishing', 'Ransomware', 'Data_breach', 'Denial-of-service_attack', 'Cyberattack'],
    },
  ],

  hackerNews: [
    {
      signal: {
        id: 'cyber.attention.hackernews_volume',
        name: 'Hacker-News-Stories zu Ausfall und Cyberangriff',
        plain: 'Wie viele neue Hacker-News-Beiträge pro Tag Begriffe wie outage, ransomware oder breach im Titel haben.',
        weight: 0.4,
        banalCauses: ['Einzelner viraler Beitrag', 'Großausfall eines bekannten Dienstes', 'Konferenzwochen'],
      },
      terms: ['outage', 'cyberattack', 'ransomware', 'breach', '"is down"'],
      fixturePrefix: '',
    },
  ],

  gdelt: [
    {
      signal: {
        id: 'cyber.attention.gdelt_cyber_volume',
        name: 'Medienvolumen zu Cyberangriffen (GDELT, englisch)',
        plain: 'Welcher Anteil der weltweiten englischsprachigen Nachrichtenartikel von Cyberangriffen, Ransomware oder Datenlecks handelt.',
        weight: 0.4, manipulability: 'medium',
        banalCauses: ['Berichterstattung über Einzelfälle', 'Jahresberichte von Sicherheitsfirmen', 'Wochentagsrhythmus'],
      },
      query: '(cyberattack OR ransomware) sourcelang:english',
      fixture: 'gdelt/cyber-en-timelinevol-1m.json',
    },
    {
      signal: {
        id: 'cyber.attention.gdelt_cyber_volume_de',
        name: 'Medienvolumen zu Cyberangriffen (GDELT, deutsch)',
        plain: 'Welcher Anteil der deutschsprachigen Nachrichtenartikel von Cyberangriffen, Hackerangriffen oder Ransomware handelt.',
        weight: 0.4, manipulability: 'medium',
        banalCauses: ['Berichterstattung über Einzelfälle', 'Jahresberichte von Sicherheitsfirmen', 'Wochentagsrhythmus'],
      },
      query: '(Cyberangriff OR Ransomware) sourcelang:german',
      fixture: 'gdelt/cyber-de-timelinevol-1m.json',
    },
  ],

  polymarket: [
    {
      terms: ['cyberattack', 'cyber attack', 'ransomware', 'hack', 'internet outage'],
      match: /cyber|ransomware|hack|outage|blackout|power grid|data breach/i,
      yesSignal: {
        id: 'cyber.markets.polymarket_cyber', domain: 'markets',
        name: 'Prognosemarkt: höchste Ja-Wahrscheinlichkeit zu Cyberereignissen',
        plain: 'Die höchste Wahrscheinlichkeit, die Wettende auf Polymarket einem Cyberangriff oder Großausfall geben (nur wenn ein passender Markt existiert).',
        evidenceClass: 'A', direction: 'up', weight: 0.35, unit: '%',
        banalCauses: ['Geringe Liquidität', 'Einzelne Großhändler', 'Wechsel der gefundenen Märkte'],
      },
      volumeSignal: {
        id: 'cyber.markets.market_volume_cyber', domain: 'markets',
        name: 'Handelsvolumen in Cyber-Prognosemärkten (24 Stunden)',
        plain: 'Wie viel in den letzten 24 Stunden auf Cyberangriffe und Großausfälle gewettet wurde.',
        evidenceClass: 'A', direction: 'up', weight: 0.2, unit: 'USD/24h',
        banalCauses: ['Virale Nachricht', 'Neuer Markt in der Trefferliste'],
      },
    },
  ],

  yahoo: [
    {
      signal: {
        id: 'cyber.markets.cyber_etf_volume',
        name: 'Relatives Handelsvolumen der Cyber-ETFs (CIBR, HACK, BUG)',
        plain: 'Wie stark Cyber-Sicherheits-ETFs gerade gehandelt werden, verglichen mit den 10 Handelstagen davor.',
        weight: 0.3, unit: 'x Median 10 Tage', baseline: yahooBaseline,
        banalCauses: ['Index-Rebalancing', 'Quartalsende', 'Verfallstermine', 'Nachrichten über einzelne Hacks'],
      },
      symbols: ['CIBR', 'HACK', 'BUG'], metric: 'rel-volume-sum',
    },
    {
      signal: {
        id: 'cyber.markets.cyber_etf_abs_return',
        name: 'Tagesschwankung der Cyber-ETFs',
        plain: 'Wie stark die Cyber-Sicherheits-ETFs an einem Tag steigen oder fallen (Betrag der Tagesrendite).',
        weight: 0.2, unit: '% (Betrag)', baseline: yahooBaseline,
        banalCauses: ['Marktweite Kursbewegung', 'Quartalszahlen großer Mitglieder', 'Zinsentscheide'],
      },
      symbols: ['CIBR', 'HACK', 'BUG'], metric: 'abs-return-mean',
    },
    {
      signal: {
        id: 'cyber.markets.vix',
        name: 'VIX (Angstindex der US-Börse)',
        plain: 'Wie nervös die US-Börse insgesamt ist; steigt bei jeder Art von Krise.',
        weight: 0.3, unit: 'Punkte', baseline: yahooBaseline,
        banalCauses: ['Zinsentscheide', 'Wahlen', 'Quartalszahlen', 'Verfallstermine'],
      },
      symbols: ['^VIX'], metric: 'close',
    },
    {
      signal: {
        id: 'cyber.markets.gold_abs_return',
        name: 'Tagesschwankung des Goldpreises',
        plain: 'Wie stark der Goldpreis an einem Tag springt, klassisches Zeichen für Fluchtbewegungen.',
        weight: 0.2, unit: '% (Betrag)', baseline: yahooBaseline,
        banalCauses: ['Zinserwartungen', 'Dollar', 'Geopolitik'],
      },
      symbols: ['GC=F'], metric: 'abs-return-mean',
    },
    {
      signal: {
        id: 'cyber.markets.btc_abs_return',
        name: 'Tagesschwankung von Bitcoin',
        plain: 'Wie stark Bitcoin an einem Tag springt; Bitcoin hängt am Netz und reagiert auf Ausfälle und Risikoscheu.',
        weight: 0.2, unit: '% (Betrag)', baseline: yahooBaseline,
        banalCauses: ['Krypto-Eigenereignisse', 'Börsenpleiten', 'ETF-Nachrichten'],
      },
      symbols: ['BTC-USD'], metric: 'abs-return-mean',
    },
  ],

  iodaCountries: [
    {
      signal: {
        id: 'cyber.outages.ioda_country_signals_de', domain: 'outages', name: 'IODA: Deutsche Netze im Routing',
        plain: 'Wie viele deutsche Netzblöcke (/24) weltweit im Routing sichtbar sind; ein Einbruch heißt, dass Netze verschwinden.',
        direction: 'down', kind: 'gauge', weight: 0.8, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: iodaHourly,
        banalCauses: ['Messausfall einzelner BGP-Quellen bei IODA'],
      },
      countries: ['DE'],
    },
    {
      signal: {
        id: 'cyber.outages.ioda_ping_de', domain: 'outages', name: 'IODA: Erreichbare deutsche Netze (Ping)',
        plain: 'Wie viele deutsche Netzblöcke (/24) auf aktive Anfragen antworten; unabhängig vom Routing gemessen.',
        direction: 'down', kind: 'gauge', weight: 0.7, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: iodaHourly,
        banalCauses: ['Ausfall einzelner Messpunkte', 'Wartung großer Provider'],
      },
      countries: ['DE'], datasource: 'ping-slash24',
    },
    {
      signal: {
        id: 'cyber.outages.ioda_bgp_big_countries', domain: 'outages', name: 'IODA: Routing-Sichtbarkeit großer Länder (Summe)',
        plain: 'Summe der im Routing sichtbaren Netzblöcke von acht großen Ländern; ein Einbruch deutet auf einen großflächigen Ausfall.',
        direction: 'down', kind: 'gauge', weight: 0.6, unit: '/24-Netze', intervalMinutes: 60, holdHours: 12, baseline: iodaHourly,
        banalCauses: ['Messausfall bei IODA', 'Umnummerierung großer Provider'],
      },
      countries: IODA_BIG_COUNTRIES,
    },
  ],
  iodaEvents: [
    {
      id: 'cyber.outages.ioda_outage_events_global', domain: 'outages', name: 'IODA Ausfallereignisse weltweit',
      plain: 'Wie viele Internet-Ausfälle auf Länderebene IODA pro Tag automatisch erkennt.',
      direction: 'up', kind: 'count', weight: 0.85, unit: 'Ereignisse/Tag', intervalMinutes: 1440, holdHours: 48,
      baseline: { method: 'rolling', windowDays: 56, minPoints: 21 },
      banalCauses: ['Prüfungsabschaltungen und Zensur', 'Stromausfälle', 'Seekabelbruch'],
    },
  ],

  ooni: ooniCountries.map(([cc, name]) => ({
    signal: {
      id: `cyber.outages.ooni_anomaly_share_${cc.toLowerCase()}`, domain: 'outages',
      name: `Anteil anomaler Web-Messungen (${name})`,
      plain: `Welcher Anteil der OONI-Messungen zur Erreichbarkeit von Webseiten in ${name} auffällig ausfällt oder blockiert wird.`,
    },
    cc,
  })),

  statuspage: [
    {
      signal: {
        id: 'cyber.services.statuspage_incident_rate', domain: 'services', weight: 0.7,
        name: 'Anteil der Anbieter mit schwerer Störung',
        plain: 'Wie viel Prozent von rund 44 Cloud-, SaaS-, Zahlungs- und Krypto-Anbietern gerade eine schwere (major/critical) Störung melden.',
      },
      measure: 'major-share',
    },
    {
      signal: {
        id: 'cyber.services.statuspage_disruption_share', domain: 'services', weight: 0.5,
        name: 'Anteil der Anbieter mit irgendeiner Störung',
        plain: 'Wie viel Prozent der beobachteten Anbieter gerade irgendeine Störung melden, auch eine leichte.',
      },
      measure: 'disrupted-share',
    },
    {
      signal: {
        id: 'cyber.finance.statuspage_payment_disruption', domain: 'finance', weight: 0.6,
        name: 'Zahlungsdienste mit Störung',
        plain: 'Wie viel Prozent der beobachteten Zahlungsdienste (Braintree, Mollie, Square u. a.) gerade eine Störung melden.',
      },
      measure: 'disrupted-share', category: 'payment',
    },
    {
      signal: {
        id: 'cyber.services.statuspage_cloud_disruption', domain: 'services', weight: 0.7,
        name: 'Cloud- und CDN-Anbieter mit Störung',
        plain: 'Wie viel Prozent der beobachteten Cloud- und CDN-Anbieter (Cloudflare, Fastly, DigitalOcean u. a.) gerade eine Störung melden.',
      },
      measure: 'disrupted-share', category: 'cloud',
    },
    {
      signal: {
        id: 'cyber.services.statuspage_incident_starts_day', domain: 'services', weight: 0.4,
        kind: 'count', unit: 'Störungen pro Tag', intervalMinutes: 1440, holdHours: 36,
        baseline: { method: 'rolling', windowDays: 60, minPoints: 14 }, thresholds: { absFloor: 2 },
        name: 'Neue Störungen pro Tag (8 Leitanbieter)',
        plain: 'Wie viele neue Störungen (leicht bis kritisch) die acht großen Cloud-, Zahlungs- und Entwickler-Dienste gestern gemeldet haben.',
      },
      measure: 'incident-starts',
    },
    {
      signal: {
        id: 'cyber.services.statuspage_major_starts_day', domain: 'services', weight: 0.5,
        kind: 'count', unit: 'schwere Störungen pro Tag', intervalMinutes: 1440, holdHours: 36,
        baseline: { method: 'rolling', windowDays: 60, minPoints: 14 }, thresholds: { absFloor: 1 },
        name: 'Neue schwere Störungen pro Tag (8 Leitanbieter)',
        plain: 'Wie viele neue schwere (major/critical) Störungen die acht großen Cloud-, Zahlungs- und Entwickler-Dienste gestern gemeldet haben.',
      },
      measure: 'incident-major-starts',
    },
  ],

  adsb: [
    {
      signal: {
        id: 'cyber.physical.military_aircraft_visible', domain: 'physical',
        name: 'Sichtbare Militärflugzeuge weltweit',
        plain: 'Wie viele Militärflugzeuge gerade auf öffentlichen Flugradaren zu sehen sind; ungewöhnlich viele oder plötzlich sehr wenige fallen auf.',
        direction: 'both', weight: 0.2,
      },
    },
  ],
} satisfies ScenarioCollectorConfig;
