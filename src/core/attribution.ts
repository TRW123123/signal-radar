// Required source credits and notices (terms of use read on 17.11.2026, details in docs/DATA-TERMS.md).
// Single source of truth for the dashboard: buildSnapshot attaches the matching entries, the footer renders them.
// Wording marked "verbatim" is prescribed by the source and must not be translated or reworded.

import type { SourceAttribution } from './types.ts';

export type { AttributionStatus, SourceAttribution } from './types.ts';

export const FRED_NOTICE = 'This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.';
export const FRED_TERMS_URL = 'https://fred.stlouisfed.org/docs/api/terms_of_use.html';
export const NVD_NOTICE = 'This product uses the NVD API but is not endorsed or certified by the NVD.';
export const GIE_CREDIT = 'GIE AGSI / ALSI platform';
export const EIA_CREDIT = 'U.S. Energy Information Administration (EIA)';

const GIE_NOTICE = `Gasspeicher- und LNG-Daten: ${GIE_CREDIT} (Gas Infrastructure Europe).`;

export const SOURCE_ATTRIBUTIONS: SourceAttribution[] = [
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
    status: 'planned-needs-key',
  },
  {
    id: 'agsi', name: 'GIE AGSI+', collectors: ['agsi', 'github-gas-storage'], sourceNameHints: ['AGSI'],
    attribution: GIE_CREDIT, attributionUrl: 'https://agsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe Pflicht',
    footerNotices: [GIE_NOTICE],
    restrictions: ['ohne Quellenangabe kann GIE den Key deaktivieren'],
    status: 'mirror-only',
  },
  {
    id: 'alsi', name: 'GIE ALSI+', collectors: ['alsi'], sourceNameHints: ['ALSI'],
    attribution: GIE_CREDIT, attributionUrl: 'https://alsi.gie.eu/', license: 'GIE-Bedingungen, Quellenangabe Pflicht',
    footerNotices: [GIE_NOTICE],
    restrictions: ['ohne Quellenangabe kann GIE den Key deaktivieren'],
    status: 'planned-needs-key',
  },
  {
    id: 'eia', name: 'U.S. Energy Information Administration',
    collectors: ['eia', 'github-oil-prices', 'github-oil-prices-finance', 'github-gas-henry-hub', 'blackout-energy-prices-github'],
    sourceNameHints: ['EIA'],
    attribution: EIA_CREDIT, attributionUrl: 'https://www.eia.gov/', license: 'US-Regierungsdaten, Quellenangabe EIA',
    footerNotices: [`Energiepreise: ${EIA_CREDIT}. Von Signal Radar aufbereitet; keine offizielle EIA-Darstellung, keine Billigung durch die EIA.`],
    restrictions: ['veränderte Daten nicht als EIA ausgeben', 'keine Endorsement-Andeutung, kein EIA-Logo', 'Rate-Limits nicht umgehen'],
    status: 'mirror-only',
  },
  {
    id: 'nvd-cve-api', name: 'NVD (NIST)', collectors: ['nvd-cve-api'], sourceNameHints: ['NVD'],
    attribution: 'National Vulnerability Database (NVD)', attributionUrl: 'https://nvd.nist.gov/', license: 'NVD-Nutzungsbedingungen',
    footerNotices: [NVD_NOTICE],
    restrictions: ['Key nicht weitergeben', 'veränderte Inhalte nicht als "NVD" ausgeben', 'Rate-Limits einhalten'],
    status: 'planned-needs-key',
  },
  {
    id: 'nasa-firms', name: 'NASA FIRMS', collectors: ['nasa-firms'], sourceNameHints: ['FIRMS'],
    attribution: 'NASA FIRMS', attributionUrl: 'https://firms.modaps.eosdis.nasa.gov/', license: 'NASA offene Daten, Quellenangabe',
    footerNotices: ['Feuerdaten: NASA FIRMS (Fire Information for Resource Management System).'],
    restrictions: ['MAP_KEY: max. 5000 Transaktionen je 10 Minuten', 'kein Suomi NPP / VIIRS_SNPP (endet 02.11.2026), NOAA-20/NOAA-21 nutzen'],
    status: 'planned-needs-key',
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
