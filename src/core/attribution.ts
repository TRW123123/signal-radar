// Required source credits and notices (terms of use read on 17.11.2026, sources of wave 1 added 20.11.2026; details in docs/DATA-TERMS.md).
// Single source of truth for the dashboard: buildSnapshot attaches the matching entries, the footer renders them.
// Wording marked "verbatim" is prescribed by the source and must not be translated or reworded.

import type { SourceAttribution } from './types.ts';

export type { AttributionStatus, SourceAttribution } from './types.ts';

export const FRED_NOTICE = 'This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.';
export const FRED_TERMS_URL = 'https://fred.stlouisfed.org/docs/api/terms_of_use.html';
export const NVD_NOTICE = 'This product uses the NVD API but is not endorsed or certified by the NVD.';
export const GIE_CREDIT = 'GIE AGSI / ALSI platform';
export const EIA_CREDIT = 'U.S. Energy Information Administration (EIA)';
/** verbatim, GFW Terms 3.A.1, with link to https://globalfishingwatch.org */
export const GFW_NOTICE = 'Powered by Global Fishing Watch.';
/** verbatim, CoinGecko Attribution Guide, with link to https://www.coingecko.com */
export const COINGECKO_NOTICE = 'Data provided by CoinGecko';
export const FINGRID_NOTICE = 'Source: Fingrid, data.fingrid.fi';
export const SHADOWSERVER_CREDIT = '© The Shadowserver Foundation';

const GIE_NOTICE = `Gasspeicher- und LNG-Daten: ${GIE_CREDIT} (Gas Infrastructure Europe).`;

export const SOURCE_ATTRIBUTIONS: SourceAttribution[] = [
  {
    id: 'rki', name: 'Robert Koch-Institut', collectors: ['rki-amelag-github', 'rki-are-github', 'rki-sari-github', 'rki-grippeweb-github', 'rki-intensivregister-github'],
    sourceNameHints: ['Robert Koch-Institut', 'RKI'],
    attribution: 'Robert Koch-Institut (RKI)', attributionUrl: 'https://github.com/robert-koch-institut', license: 'CC BY 4.0',
    footerNotices: ['Surveillance-Daten zu Atemwegserkrankungen und Abwasser: Robert Koch-Institut (RKI), lizenziert unter CC BY 4.0.'],
    restrictions: ['Namensnennung'],
    status: 'active-collector',
  },
  {
    id: 'cf-radar', name: 'Cloudflare Radar', collectors: ['cloudflare-radar', 'cf-radar'], sourceNameHints: ['Cloudflare Radar'],
    attribution: 'Cloudflare Radar', attributionUrl: 'https://radar.cloudflare.com/', license: 'CC BY-NC 4.0',
    footerNotices: ['Internetdaten: Cloudflare Radar, lizenziert unter CC BY-NC 4.0 (nicht-kommerzielle Nutzung).'],
    restrictions: ['nur nicht-kommerziell', 'Namensnennung "Cloudflare Radar"'],
    status: 'active-collector',
  },
  {
    id: 'abuse-ch', name: 'abuse.ch (ThreatFox, URLhaus, MalwareBazaar)', collectors: ['threatfox', 'urlhaus', 'malwarebazaar', 'feodo'],
    sourceNameHints: ['abuse.ch', 'ThreatFox', 'URLhaus', 'MalwareBazaar', 'Feodo'],
    attribution: 'abuse.ch', attributionUrl: 'https://abuse.ch/', license: 'abuse.ch-Nutzungsbedingungen, nicht-gewinnorientiert',
    footerNotices: ['Bedrohungsdaten: abuse.ch (ThreatFox, URLhaus, MalwareBazaar), Nutzung nicht-gewinnorientiert.'],
    restrictions: ['kostenlos nur für nicht-gewinnorientierte Zwecke', 'moderates Polling, kein Massen-Harvesting', 'KI-Training nur mit Zustimmung'],
    status: 'active-collector',
  },
  {
    id: 'fred', name: 'FRED (Federal Reserve Bank of St. Louis)', collectors: ['fred', 'fred-csv', 'fred-eggs'], sourceNameHints: ['FRED'],
    attribution: 'FRED, Federal Reserve Bank of St. Louis', attributionUrl: 'https://fred.stlouisfed.org/', license: 'FRED API Terms of Use',
    // first line verbatim; second line: link to the terms because third parties use the dashboard
    footerNotices: [FRED_NOTICE, `Nutzungsbedingungen der FRED-API: ${FRED_TERMS_URL}`],
    restrictions: ['keine FRED-Logos', '"FRED" nicht im Hostnamen', 'Serien mit Drittanbieter-Copyright nur mit Erlaubnis des Rechteinhabers'],
    status: 'active-collector',
  },
  {
    id: 'agsi', name: 'GIE AGSI+', collectors: ['agsi', 'github-gas-storage'], sourceNameHints: ['AGSI'],
    attribution: GIE_CREDIT, attributionUrl: 'https://agsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe Pflicht',
    footerNotices: [GIE_NOTICE],
    restrictions: ['ohne Quellenangabe kann GIE den Key deaktivieren'],
    status: 'active-collector',
  },
  {
    id: 'alsi', name: 'GIE ALSI+', collectors: ['alsi'], sourceNameHints: ['ALSI'],
    attribution: GIE_CREDIT, attributionUrl: 'https://alsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe Pflicht',
    footerNotices: [GIE_NOTICE],
    restrictions: ['ohne Quellenangabe kann GIE den Key deaktivieren'],
    status: 'active-collector',
  },
  {
    id: 'eia', name: 'U.S. Energy Information Administration',
    collectors: ['eia', 'github-oil-prices', 'github-oil-prices-finance', 'github-gas-henry-hub', 'blackout-energy-prices-github'],
    sourceNameHints: ['EIA'],
    attribution: EIA_CREDIT, attributionUrl: 'https://www.eia.gov/', license: 'US-Regierungsdaten, Quellenangabe EIA',
    footerNotices: [`Energiepreise: ${EIA_CREDIT}. Von Signal Radar aufbereitet; keine offizielle EIA-Darstellung, keine Billigung durch die EIA.`],
    restrictions: ['veränderte Daten nicht als EIA ausgeben', 'keine Endorsement-Andeutung, kein EIA-Logo', 'Rate-Limits nicht umgehen'],
    status: 'active-collector',
  },
  {
    id: 'nvd-cve-api', name: 'NVD (NIST)', collectors: ['nvd-cve-api'], sourceNameHints: ['NVD'],
    attribution: 'National Vulnerability Database (NVD)', attributionUrl: 'https://nvd.nist.gov/', license: 'NVD-Nutzungsbedingungen',
    footerNotices: [NVD_NOTICE],
    restrictions: ['Key nicht weitergeben', 'veränderte Inhalte nicht als "NVD" ausgeben', 'Rate-Limits einhalten'],
    status: 'active-collector',
  },
  {
    id: 'nasa-firms', name: 'NASA FIRMS', collectors: ['nasa-firms'], sourceNameHints: ['FIRMS'],
    attribution: 'NASA FIRMS', attributionUrl: 'https://firms.modaps.eosdis.nasa.gov/', license: 'NASA offene Daten, Quellenangabe',
    footerNotices: ['Feuerdaten: NASA FIRMS (Fire Information for Resource Management System).'],
    restrictions: ['MAP_KEY: max. 5000 Transaktionen je 10 Minuten', 'kein Suomi NPP / VIIRS_SNPP (endet 02.11.2026), NOAA-20/NOAA-21 nutzen'],
    status: 'active-collector',
  },
  {
    id: 'sec-edgar', name: 'SEC EDGAR', collectors: ['sec-edgar'], sourceNameHints: ['SEC EDGAR', 'EDGAR'],
    attribution: 'U.S. Securities and Exchange Commission (SEC EDGAR)', attributionUrl: 'https://www.sec.gov/edgar/search/',
    license: 'US-Regierungsdaten, gemeinfrei; Fair Access',
    footerNotices: [],
    restrictions: ['User-Agent mit Kontaktangabe', 'max. 10 Anfragen/s'],
    status: 'active-collector',
  },
  {
    id: 'acled', name: 'ACLED', collectors: ['acled'], sourceNameHints: ['ACLED'],
    attribution: 'ACLED (Armed Conflict Location & Event Data)', attributionUrl: 'https://acleddata.com',
    license: 'ACLED Terms of Use, nur nicht-kommerziell',
    footerNotices: ['Konfliktdaten: ACLED (Armed Conflict Location & Event Data), https://acleddata.com. Dargestellt sind nur von Signal Radar abgeleitete Wochensummen, keine Einzelereignisse.'],
    restrictions: [
      'nur transformative, nicht rückrechenbare Aggregate öffentlich zeigen, nie Rohereignisse',
      'jede Grafik nennt ACLED prominent mit Link',
      'geteilte Dateien: Quellenspalte mit vollem Namen, Link und Hinweis auf Änderungen',
      'kein Scraping, Logins nicht teilen, kein KI-Training, das ACLED ersetzt',
    ],
    status: 'planned-needs-key',
  },
  {
    id: 'opensky', name: 'The OpenSky Network', collectors: ['opensky'], sourceNameHints: ['OpenSky'],
    attribution: 'The OpenSky Network', attributionUrl: 'https://opensky-network.org/', license: 'nur gemeinnützige Forschung/Lehre; Vereinbarung ausstehend',
    footerNotices: ['Flugdaten: The OpenSky Network, https://opensky-network.org.'],
    restrictions: ['automatische Nutzung in diesem Dienst erst nach schriftlicher Vereinbarung', 'keine Weitergabe der Daten', 'Flugzeugkennungen und Sensorstandorte anonymisieren'],
    status: 'blocked-pending-license',
  },
  {
    id: 'entsoe', name: 'ENTSO-E Transparency Platform', collectors: ['entsoe'], sourceNameHints: ['ENTSO-E'],
    attribution: 'ENTSO-E Transparency Platform', attributionUrl: 'https://transparency.entsoe.eu/',
    license: 'laut Katalog CC BY 4.0; Bedingungen noch nicht gelesen',
    footerNotices: ['Stromnetzdaten: ENTSO-E Transparency Platform.'],
    status: 'pending-terms',
  },
  {
    id: 'gfw', name: 'Global Fishing Watch', collectors: ['gfw'], sourceNameHints: ['Global Fishing Watch'],
    attribution: 'Global Fishing Watch', attributionUrl: 'https://globalfishingwatch.org', license: 'CC BY-NC 4.0 (GFW API Terms)',
    // verbatim (Terms 3.A.1), link to https://globalfishingwatch.org
    footerNotices: [`${GFW_NOTICE} https://globalfishingwatch.org`],
    restrictions: ['nur nicht-kommerziell', 'höchstens 50 000 Requests/Tag'],
    status: 'active-collector',
  },
  {
    id: 'fingrid', name: 'Fingrid Open Data', collectors: ['fingrid'], sourceNameHints: ['Fingrid'],
    attribution: 'Fingrid', attributionUrl: 'https://data.fingrid.fi/', license: 'CC BY 4.0',
    footerNotices: [FINGRID_NOTICE],
    restrictions: ['höchstens 1 Request je 2 Sekunden'],
    status: 'active-collector',
  },
  {
    id: 'ghsa', name: 'GitHub Advisory Database', collectors: ['ghsa'], sourceNameHints: ['GitHub Advisory'],
    attribution: 'GitHub Advisory Database', attributionUrl: 'https://github.com/advisories', license: 'CC BY 4.0',
    footerNotices: ['Sicherheitsmeldungen: GitHub Advisory Database (https://github.com/advisories), CC BY 4.0.'],
    status: 'active-collector',
  },
  {
    id: 'github', name: 'GitHub (REST- und Such-API)', collectors: ['github-rest'], sourceNameHints: ['GitHub Search API', 'GitHub REST API'],
    attribution: 'GitHub', attributionUrl: 'https://github.com/', license: 'GitHub-Nutzungsbedingungen, nur Aggregatzahlen',
    footerNotices: ['Entwicklungsaktivität: GitHub (nur Zählwerte).'],
    restrictions: ['nur Aggregatzahlen, keine Inhalte oder Personendaten'],
    status: 'active-collector',
  },
  {
    id: 'coingecko', name: 'CoinGecko', collectors: ['coingecko'], sourceNameHints: ['CoinGecko'],
    attribution: 'CoinGecko', attributionUrl: 'https://www.coingecko.com', license: 'CoinGecko API Terms',
    // verbatim (CoinGecko Attribution Guide), with link
    footerNotices: [`${COINGECKO_NOTICE} https://www.coingecko.com`],
    restrictions: ['Demo-Kontingent 10 000 Requests/Monat'],
    status: 'active-collector',
  },
  {
    id: 'metaculus', name: 'Metaculus', collectors: ['metaculus'], sourceNameHints: ['Metaculus'],
    attribution: 'Metaculus', attributionUrl: 'https://www.metaculus.com/', license: 'Metaculus Terms of Use',
    footerNotices: ['Prognosefragen: Metaculus (https://www.metaculus.com).'],
    restrictions: ['kein KI-Training', 'kommerzielle Nutzung nur mit Vertrag', 'Erlaubnis für nicht-kommerzielle Nutzung offen (Data-Needs-Formular)'],
    status: 'pending-terms',
  },
  {
    id: 'reddit', name: 'Reddit Data API', collectors: ['reddit-json'], sourceNameHints: ['Reddit'],
    attribution: 'Reddit', attributionUrl: 'https://www.reddit.com/', license: 'Reddit Data API Terms, nur nicht-kommerziell',
    footerNotices: ['Community-Aktivität: Reddit (Data API, nur Zählwerte).'],
    restrictions: ['nur nicht-kommerziell', 'keine gelöschten Inhalte speichern (hier nur Zählwerte)', 'User-Agent im Reddit-Format'],
    status: 'active-collector',
  },
  {
    id: 'shadowserver', name: 'The Shadowserver Foundation', collectors: ['shadowserver'], sourceNameHints: ['Shadowserver'],
    attribution: SHADOWSERVER_CREDIT, attributionUrl: 'https://www.shadowserver.org/', license: 'Shadowserver Terms (aggregierte Daten = Restricted Content)',
    // terms require (1) copyright notice, (2) link, (3) logo for further published distribution; logo not yet shown
    footerNotices: [`Internet-Exposition: ${SHADOWSERVER_CREDIT}, https://www.shadowserver.org/`],
    restrictions: ['Veröffentlichung nur mit Copyright-Hinweis, Link und Shadowserver-Logo', 'Freigabe für das öffentliche Dashboard ungeklärt (Shadowserver fragen)'],
    status: 'pending-terms',
  },
  {
    id: 'otx', name: 'AlienVault OTX', collectors: ['otx'], sourceNameHints: ['AlienVault OTX', 'OTX'],
    attribution: 'AlienVault OTX', attributionUrl: 'https://otx.alienvault.com/', license: 'OTX-Nutzungsbedingungen (nicht lesbar, ungeprüft)',
    footerNotices: ['Bedrohungsmeldungen: AlienVault OTX (Pulse-Zählungen).'],
    status: 'active-collector',
  },
  {
    id: 'aisstream', name: 'aisstream.io', collectors: ['aisstream'], sourceNameHints: ['aisstream'],
    attribution: 'aisstream.io', attributionUrl: 'https://aisstream.io/', license: 'keine Terms-Seite gefunden',
    footerNotices: ['Schiffsdaten: aisstream.io.'],
    status: 'active-collector',
  },
  {
    id: 'faa', name: 'Federal Aviation Administration (FAA)', collectors: ['faa-notam', 'faa-nas'], sourceNameHints: ['FAA'],
    attribution: 'FAA', attributionUrl: 'https://www.faa.gov/', license: 'US-Regierungsdaten, gemeinfrei',
    footerNotices: ['Luftraumdaten: Quelle FAA.'],
    status: 'active-collector',
  },
  {
    id: 'space-track', name: 'Space-Track.org', collectors: ['space-track'], sourceNameHints: ['Space-Track'],
    attribution: 'Space-Track.org', attributionUrl: 'https://www.space-track.org/', license: 'Space-Track User Agreement',
    footerNotices: ['Wiedereintritte: Quelle Space-Track.org (nur Tageszahlen).'],
    restrictions: ['keine Weitergabe der Rohdaten an Dritte', 'Decay-Abfrage höchstens 1×/Tag', '< 30 Requests/min, < 300/h'],
    status: 'active-collector',
  },
  {
    id: 'alerts-in-ua', name: 'alerts.in.ua', collectors: ['alerts-in-ua'], sourceNameHints: ['alerts.in.ua'],
    attribution: 'alerts.in.ua', attributionUrl: 'https://alerts.in.ua/', license: 'keine ausdrückliche Lizenz; Regeln der API-Doku',
    footerNotices: ['Luftalarme Ukraine: alerts.in.ua.'],
    restrictions: ['Token geheim halten, Abruf nur über das Backend', '8–12 Requests/min'],
    status: 'active-collector',
  },
];

/** Registry entries for the given signals, in registry order. Collector id wins; sourceName hints are the fallback. */
export function attributionsForSignals(signals: { collector?: string; sourceName?: string }[]): SourceAttribution[] {
  const hit = new Set<SourceAttribution>();
  for (const s of signals) {
    const byCollector = s.collector ? SOURCE_ATTRIBUTIONS.filter((a) => a.collectors.includes(s.collector!)) : [];
    const matches = byCollector.length
      ? byCollector
      : SOURCE_ATTRIBUTIONS.filter((a) => s.sourceName && a.sourceNameHints?.some((h) => s.sourceName!.includes(h)));
    for (const a of matches) hit.add(a);
  }
  return SOURCE_ATTRIBUTIONS.filter((a) => hit.has(a));
}

/** All required footer lines of the given entries, without duplicates, in first-seen order. */
export function footerNoticesFor(attributions: SourceAttribution[]): string[] {
  return [...new Set(attributions.flatMap((a) => a.footerNotices))];
}
