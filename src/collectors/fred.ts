// FRED API (Federal Reserve Bank of St. Louis): Finanz- und Konjunkturreihen, eine Serie je Request (Klasse laut Katalog, A/B).
// Quelle: https://api.stlouisfed.org/fred/series/observations?series_id=<ID>&api_key=<KEY>&file_type=json&observation_start=YYYY-MM-DD
// Doku: https://fred.stlouisfed.org/docs/api/fred/series_observations.html (gelesen 20.11.2026). Antwort laut Doku:
//   { realtime_start, ..., count, observations: [ { realtime_start, realtime_end, date: "YYYY-MM-DD", value: "1.23" } ] }; "." = fehlender Wert.
//   Fehler ohne/mit falschem Key: { "error_code": 400, "error_message": "Bad Request.  Variable api_key is not set. ..." } (HTTP 400, echt geprüft).
// Key: SR_FRED_KEY als Query-Parameter api_key (FRED kennt keinen Header). Der HTTP-Client schwärzt "api_key" in Fehlermeldungen nicht,
//   deshalb ersetzt dieser Collector den Key in jeder weitergereichten Fehlermeldung selbst durch REDACTED.
// Lizenz/Bedingungen: FRED API Terms of Use (https://fred.stlouisfed.org/docs/api/terms_of_use.html, gelesen 20.11.2026): Pflichthinweis
//   "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis." (steht in src/core/attribution.ts),
//   keine FRED-Logos, keine Billigung andeuten. Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers: ICE BofA (BAML*), Cboe (VIXCLS,
//   VXVCLS, OVXCLS, GVZCLS), IMF (PURANUSDM, PNGAS*) sind Drittanbieter-Reihen -> offener Lizenzpunkt (Übergabe). Fed/BLS/DOL/Treasury-Reihen gemeinfrei.
// Rate-Limit: 120 Requests/Minute je Key. Hier 31 Requests je Lauf (eine Serie je Request, die API hat keinen Mehrserien-Abruf),
//   Abstand je Host 1 s durch den HTTP-Client, Lauf alle 6 h (intervalMinutes 360) -> rund 124 Requests/Tag, weit unter dem Limit.
//   Fenster je Frequenz: täglich 60 Tage, wöchentlich 400 Tage, monatlich 3 Jahre, quartalsweise 6 Jahre (alle Antworten < 6 000 Zeichen).
// Gemessen: siehe SPECS unten (Serie -> Signal). Abgeleitete Werte: VIX/VIX3M-Verhältnis, 1/DEXSZUS (USD je CHF), 100/DEXJPUS (USD je 100 JPY),
//   TTF-minus-Henry-Hub (IMF-Monatspreise), 1M-T-Bill minus IORB in Basispunkten, HY-OAS in Basispunkten für war.markets.hy_credit_spread.
//   Abgeleitete Werte nur an Tagen, an denen alle beteiligten Serien einen Wert haben.
// Signale, deren Katalog-Collector ein anderer ist (cboe, ecb-data, fed-ddp, eu-oil-bulletin, wb-pink, yahoo-chart, fred-csv) und die noch
//   von keinem Collector gespeist werden, liefert dieser Collector über die entsprechende FRED-Reihe (gleiche id, Quelle FRED).
// Harmlose Ursachen für Ausschläge: Zinsentscheide, Makrodaten (CPI, Arbeitsmarkt), Feiertage (Lücken), Quartalsenden, Revisionen der Fed-Daten,
//   Saisonmuster bei Banknoten und Erstanträgen, verspätete Veröffentlichung (H.8, H.10, IMF-Monatsreihen, Quartalsreihen).
// Not built:
//   finance.credit.eur_ig_financial_oas: BAMLEC0A0RMEY existiert auf FRED nicht (mehr) (fredgraph.csv liefert HTML-Fehlerseite, 20.11.2026);
//     eine Euro-IG-Finanz-OAS gibt es auf FRED nicht frei.
//   war.markets.brent_price, war.markets.wti_price (github-oil-prices), war.markets.gold_price, war.markets.wheat_prices, war.markets.vix
//     (yahoo-chart, config/war.ts): bereits von anderen Collectors gespeist; eine zweite Quelle in derselben Reihe würde sie vermischen.
//   bio.markets.poultry_stocks (Eierpreis APU0000708111): eigener Collector fred-eggs (Katalog-collector-id).
// VERIFIED: nein (ungeprüft bis Key). Antwortformat aus der offiziellen Doku (Beispielantwort GNPCA) und Fehlerformat echt (ohne Key, 20.11.2026).
//   Alle 31 Serien-IDs am 20.11.2026 gegen https://fred.stlouisfed.org/graph/fredgraph.csv?id=<ID> (ohne Key) geprüft: existieren und liefern
//   aktuelle Werte (z. B. DGS10 2026-11-18 = 5.07, VIXCLS 24.56, ICSA 2026-11-14 = 203000); Titel/Einheiten über die Serienseiten geprüft.

import type { Collector, CollectContext, Observation, SignalDef } from '../core/types.ts';
import { daysAgo, expect, isoDay, num, obs } from './_helpers.ts';

const BASE = 'https://api.stlouisfed.org/fred/series/observations';
const KEY_ENV = 'SR_FRED_KEY';
const DAY = 1440;
const WEEK = 10080;
const MONTH = 43200;
const QUARTER = 129600;

type Freq = 'd' | 'w' | 'm' | 'q';
const WINDOW_DAYS: Record<Freq, number> = { d: 60, w: 400, m: 3 * 366, q: 6 * 366 };

/** Katalogdefinitionen (catalog/signals/*.json, Stand 20.11.2026), unverändert übernommen; Abweichungen stehen in SPECS[].override. */
const CATALOG: Record<string, Partial<SignalDef> & { id: string }> = Object.fromEntries(([
  {id: "cyber.markets.vix_spike",scenarios: ["cyber"],domain: "markets",name: "VIX Volatilität",plain: "Marktangst.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.25,manipulability: "medium",independenceGroup: "cboe",unit: "Indexpunkte",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "Cboe ToS",banalCauses: ["Makro-Ereignisse","Zinsentscheide","Geopolitik","Optionsverfall"],sourceName: "Cboe VIX History CSV",sourceUrl: "https://www.cboe.com/tradable_products/vix/vix_historical_data/"},
  {id: "cyber.markets.vix_term_structure",scenarios: ["cyber"],domain: "markets",name: "VIX-Terminstruktur (VIX9D/VIX/VIX3M)",plain: "Vergleich kurzfristiger mit längerfristiger Angstkennzahl.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.25,manipulability: "medium",independenceGroup: "cboe",unit: "Indexpunkte",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "Cboe Nutzungsbedingungen",banalCauses: ["Ereignisrisiko (Wahlen, Fed)"],sourceName: "Cboe VIX9D/VIX3M CSV",sourceUrl: "https://www.cboe.com/tradable_products/vix/vix_historical_data/"},
  {id: "war.markets.ovx",scenarios: ["war"],domain: "markets",name: "OVX Öl-Volatilität",plain: "Misst, wie stark Anleger Schwankungen beim Ölpreis erwarten.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.5,manipulability: "medium",independenceGroup: "fred",unit: "Indexpunkte",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Öl-Verfall","OPEC-Termine"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "war.markets.breakeven_inflation",scenarios: ["war"],domain: "markets",name: "Inflationserwartung (Breakeven)",plain: "Misst, welche Inflation die Anleihemärkte erwarten; ein Ölschock treibt sie.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.3,manipulability: "low",independenceGroup: "fred",unit: "%",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Rohstoffzyklus"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "war.markets.hy_credit_spread",scenarios: ["war"],domain: "markets",name: "Kreditspreads Unternehmensanleihen",plain: "Misst den Zinsaufschlag riskanter Unternehmen; er steigt bei allgemeiner Angst.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.2,manipulability: "low",independenceGroup: "fred",unit: "Basispunkte",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Konjunktur"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.credit.hy_oas",scenarios: ["finance"],domain: "credit",name: "Hochzins-Anleihen: Risikoaufschlag",plain: "Aufpreis, den riskante US-Firmen für Kredit zahlen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "fred-csv",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers; ICE-Reihen auf 3 Jahre gekürzt",banalCauses: ["Ölpreisschock","Branchenkrise (Energie)"],sourceName: "FRED Graph CSV (ohne Key)",sourceUrl: "https://fred.stlouisfed.org/"},
  {id: "war.markets.us_10y_yield",scenarios: ["war"],domain: "markets",name: "US-Rendite 10 Jahre",plain: "Misst den Zins zehnjähriger US-Staatsanleihen; Flucht in Sicherheit senkt ihn, Inflationsangst hebt ihn.",evidenceClass: "A",direction: "both",kind: "gauge",weight: 0.2,manipulability: "low",independenceGroup: "fred",unit: "%",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Fed-Erwartungen"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.markets.us_10y_yield",scenarios: ["finance"],domain: "markets",name: "US-10-Jahres-Rendite",plain: "Rendite langer US-Anleihen.",evidenceClass: "A",direction: "both",kind: "gauge",weight: 0.3,manipulability: "low",independenceGroup: "fred-csv",unit: "%",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers; ICE-Reihen auf 3 Jahre gekürzt",banalCauses: ["Inflationsdaten"],sourceName: "FRED Graph CSV (ohne Key)",sourceUrl: "https://fred.stlouisfed.org/"},
  {id: "finance.credit.eur_hy_oas",scenarios: ["finance"],domain: "credit",name: "Euro-Hochzins-Aufschlag",plain: "Wie viel riskante Euro-Firmen für Kredit zahlen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "fred",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Energiepreise","EZB-Zinsen"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.credit.ig_oas",scenarios: ["finance"],domain: "credit",name: "Investment-Grade-Aufschlag",plain: "Aufpreis für gute US-Unternehmensanleihen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "fred",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Emissionswelle"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.credit.ccc_oas",scenarios: ["finance"],domain: "credit",name: "CCC-Aufschlag (schwächste Schuldner)",plain: "Aufschlag für Anleihen schwächster Firmen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.55,manipulability: "low",independenceGroup: "fred",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Einzelne Pleiten"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "cyber.markets.safe_haven_fx",scenarios: ["cyber"],domain: "markets",name: "Schweizer Franken und Yen als Fluchtwährung",plain: "Kurs von CHF und JPY gegenüber dem Euro/Dollar.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.2,manipulability: "medium",independenceGroup: "ecb-data",unit: "Kurs",baseline: {method: "day-of-week",windowDays: 56,minPoints: 21},intervalMinutes: 1440,license: "ECB Reuse Policy (Quellenangabe)",banalCauses: ["SNB/BoJ-Entscheide"],sourceName: "ECB Data Portal API",sourceUrl: "https://data.ecb.europa.eu/help/api/overview"},
  {id: "war.markets.safe_haven_jpy",scenarios: ["war"],domain: "markets",name: "Japanischer Yen",plain: "Misst den Kurs des japanischen Yen; bei Angst wird er teurer.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.25,manipulability: "medium",independenceGroup: "ecb-data",unit: "Kurs",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "EZB, Namensnennung",banalCauses: ["BoJ-Politik","Zinsdifferenz"],sourceName: "EZB Data Portal API",sourceUrl: "https://data.ecb.europa.eu/help/api/data"},
  {id: "war.markets.fuel_bunker_prices",scenarios: ["war"],domain: "markets",name: "Bunker- und Jet-Fuel-Preise",plain: "Misst die Preise für Schiffs- und Flugtreibstoff.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.35,manipulability: "low",independenceGroup: "eu-oil-bulletin",unit: "Kurs",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "EU-Wiederverwendung CC BY 4.0",banalCauses: ["Rohöl"],sourceName: "EU Weekly Oil Bulletin",sourceUrl: "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en"},
  {id: "war.markets.gvz_and_move",scenarios: ["war"],domain: "markets",name: "Gold- und Anleihen-Volatilität (GVZ, MOVE)",plain: "Misst, wie stark Anleger Schwankungen bei Gold und Staatsanleihen erwarten.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.3,manipulability: "medium",independenceGroup: "yahoo-chart",unit: "Indexpunkte",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "inoffiziell, ToS verbieten teils Weiterverwendung; fuer Produktion Alternative waehlen",banalCauses: ["Zinsentscheide"],sourceName: "Yahoo Finance Chart (inoffiziell)",sourceUrl: "https://finance.yahoo.com/"},
  {id: "finance.money_market.us_tbill_stress",scenarios: ["finance"],domain: "money_market",name: "T-Bill-Renditen: Abweichung von Leitzins",plain: "Wenn Kurzläufer-Staatsanleihen stark vom Leitzins abweichen, flüchtet Geld in Sicherheit.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.6,manipulability: "low",independenceGroup: "fred-csv",unit: "Basispunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers; ICE-Reihen auf 3 Jahre gekürzt",banalCauses: ["Schuldenobergrenze","Emissionsvolumen"],sourceName: "FRED Graph CSV (ohne Key)",sourceUrl: "https://fred.stlouisfed.org/"},
  {id: "finance.credit.us_curve_10y2y",scenarios: ["finance"],domain: "credit",name: "US-Zinskurve 10J minus 2J",plain: "Abstand langer und kurzer US-Zinsen.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.35,manipulability: "low",independenceGroup: "fred-csv",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers; ICE-Reihen auf 3 Jahre gekürzt",banalCauses: ["Fed-Erwartungen"],sourceName: "FRED Graph CSV (ohne Key)",sourceUrl: "https://fred.stlouisfed.org/"},
  {id: "finance.credit.us_curve_10y3m",scenarios: ["finance"],domain: "credit",name: "US-Zinskurve 10J minus 3M",plain: "Von der Fed genutztes Rezessionsmaß.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.4,manipulability: "low",independenceGroup: "fred-csv",unit: "Prozentpunkte",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers; ICE-Reihen auf 3 Jahre gekürzt",banalCauses: ["Leitzinsänderungen"],sourceName: "FRED Graph CSV (ohne Key)",sourceUrl: "https://fred.stlouisfed.org/"},
  {id: "cyber.markets.financial_stress_index",scenarios: ["cyber"],domain: "markets",name: "St. Louis Financial Stress Index",plain: "Ein Index aus 18 Marktkennzahlen für Stress im Finanzsystem.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.25,manipulability: "low",independenceGroup: "fred",unit: "Indexpunkte",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Bankenkrisen","Zinsschocks"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/"},
  {id: "finance.money_market.fed_btfp_other_credit",scenarios: ["finance"],domain: "money_market",name: "Fed: sonstige Kredite an Institute",plain: "Zeigt Sondernotfall-Programme und Rettungskredite der Fed.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.85,manipulability: "low",independenceGroup: "fred",unit: "Mio. USD",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Altprogramme laufen aus"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.money_market.fed_discount_window",scenarios: ["finance"],domain: "money_market",name: "Fed Discount Window: Kredite",plain: "Wie viel Banken sich in der Not direkt bei der Fed leihen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.9,manipulability: "low",independenceGroup: "fed-ddp",unit: "Mio. USD",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "gemeinfrei (US Government)",banalCauses: ["Testläufe der Banken","Quartalsende"],sourceName: "Fed Data Download Program (H.4.1)",sourceUrl: "https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H41"},
  {id: "finance.banks.h8_borrowings",scenarios: ["finance"],domain: "banks",name: "Fed H.8: Kredite der Banken (Borrowings)",plain: "Wie viel Banken sich selbst leihen müssen.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.7,manipulability: "low",independenceGroup: "fred",unit: "Mrd. USD",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Wertpapiergeschäfte"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.banks.h8_deposits",scenarios: ["finance"],domain: "banks",name: "Fed H.8: Einlagen aller US-Banken",plain: "Wöchentliche Summe der Kundeneinlagen bei US-Banken.",evidenceClass: "A",direction: "down",kind: "gauge",weight: 0.85,manipulability: "low",independenceGroup: "fed-ddp",unit: "Mrd. USD",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "gemeinfrei (US Government)",banalCauses: ["Steuertermine","Geldmarktfonds-Umschichtung"],sourceName: "Fed Data Download Program (H.8)",sourceUrl: "https://www.federalreserve.gov/datadownload/Choose.aspx?rel=H8"},
  {id: "finance.real_economy.jobless_claims",scenarios: ["finance"],domain: "real_economy",name: "US-Erstanträge auf Arbeitslosenhilfe (wöchentlich)",plain: "Wöchentlich neue Arbeitslosmeldungen.",evidenceClass: "B",direction: "up",kind: "gauge",weight: 0.4,manipulability: "low",independenceGroup: "fred",unit: "Anträge",baseline: {method: "rolling",windowDays: 90,minPoints: 30},intervalMinutes: 1440,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Feiertage","Saisonbereinigung"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "cyber.finance.banknotes_in_circulation",scenarios: ["cyber"],domain: "finance",name: "Banknoten im Umlauf (Euro, USD)",plain: "Bargeldnachfrage: Hamsterkäufe bei Störungen.",evidenceClass: "A",direction: "up",kind: "count",weight: 0.3,manipulability: "low",independenceGroup: "ecb-data",unit: "Anzahl",baseline: {method: "rolling",windowDays: 365,minPoints: 26},intervalMinutes: 10080,license: "ECB Reuse Policy",banalCauses: ["Saisonalität (Weihnachten)","Saisonale Effekte (Weihnachten, Urlaub)","Zinsniveau"],sourceName: "ECB Data Portal: Banknoten im Umlauf (Eurosystem-Wochenausweis)",sourceUrl: "https://data.ecb.europa.eu/help/api/data"},
  {id: "nuclear.markets.fred_uranium_price",scenarios: ["nuclear"],domain: "markets",name: "IMF-Uranpreis (monatlich, FRED)",plain: "Globaler Uranpreis als offizielle Monatsreihe.",evidenceClass: "A",direction: "both",kind: "gauge",weight: 0.2,manipulability: "low",independenceGroup: "fred",unit: "USD",baseline: {method: "rolling",windowDays: 1095,minPoints: 24},intervalMinutes: 43200,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Marktzyklus"],sourceName: "FRED series PURANUSDM",sourceUrl: "https://fred.stlouisfed.org/series/PURANUSDM"},
  {id: "war.markets.fertilizer_prices",scenarios: ["war"],domain: "markets",name: "Dünger-Preise (Harnstoff, DAP)",plain: "Misst die Preise für Dünger wie Harnstoff.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.3,manipulability: "low",independenceGroup: "wb-pink",unit: "Kurs",baseline: {method: "rolling",windowDays: 1095,minPoints: 24},intervalMinutes: 43200,license: "CC BY 4.0",banalCauses: ["Saison"],sourceName: "World Bank Commodity Price Data (Pink Sheet)",sourceUrl: "https://www.worldbank.org/en/research/commodity-markets"},
  {id: "war.markets.gas_henry_vs_ttf",scenarios: ["war"],domain: "markets",name: "Gas-Spread TTF gegen Henry Hub",plain: "Preisabstand Europa/USA zeigt, wie stark Europa um LNG konkurrieren muss.",evidenceClass: "A",direction: "up",kind: "gauge",weight: 0.4,manipulability: "medium",independenceGroup: "yahoo-chart",unit: "Kurs",baseline: {method: "rolling",windowDays: 28,minPoints: 14},intervalMinutes: 1440,license: "inoffiziell, ToS verbieten teils Weiterverwendung; fuer Produktion Alternative waehlen",banalCauses: ["Winterwetter"],sourceName: "Yahoo Finance Chart (inoffiziell)",sourceUrl: "https://finance.yahoo.com/"},
  {id: "finance.real_economy.cre_delinq",scenarios: ["finance"],domain: "real_economy",name: "Gewerbeimmobilien-Kredite: Ausfallrate",plain: "Ausfälle bei Büro- und Handelsimmobilien.",evidenceClass: "B",direction: "up",kind: "gauge",weight: 0.5,manipulability: "low",independenceGroup: "fred",unit: "%",baseline: {method: "rolling",windowDays: 1825,minPoints: 12},intervalMinutes: 129600,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Quartalsrhythmus"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.real_economy.consumer_credit_delinq",scenarios: ["finance"],domain: "real_economy",name: "Kreditausfälle bei Konsumenten",plain: "Anteil überfälliger Kredite bei Kreditkarten und Autos.",evidenceClass: "B",direction: "up",kind: "gauge",weight: 0.4,manipulability: "low",independenceGroup: "fred",unit: "%",baseline: {method: "rolling",windowDays: 1825,minPoints: 12},intervalMinutes: 129600,license: "FRED API Terms of Use: Pflichthinweis \"not endorsed\" im Dashboard, keine FRED-Logos; Drittanbieter-Serien nur mit Erlaubnis des Rechteinhabers",banalCauses: ["Saison"],sourceName: "FRED API (St. Louis Fed)",sourceUrl: "https://fred.stlouisfed.org/docs/api/fred/series_observations.html"},
  {id: "finance.credit.sloos_tightening",scenarios: ["finance"],domain: "credit",name: "Kreditvergabe-Umfrage: Anteil Banken mit strengeren Standards",plain: "Ob Banken ihre Kreditbedingungen verschärfen.",evidenceClass: "B",direction: "up",kind: "gauge",weight: 0.4,manipulability: "medium",independenceGroup: "ecb-data",unit: "% der Banken",baseline: {method: "rolling",windowDays: 1825,minPoints: 12},intervalMinutes: 129600,license: "EZB-Datenpolitik",banalCauses: ["Zinswende"],sourceName: "EZB Bank Lending Survey",sourceUrl: "https://data.ecb.europa.eu/"},
] as (Partial<SignalDef> & { id: string })[]).map((s) => [s.id, s]));

export interface Spec {
  id: string;
  /** FRED-Serien; bei mehreren wird combine auf die Werte desselben Datums angewandt */
  series: string[];
  freq: Freq;
  combine?: (v: number[]) => number | null;
  override?: Partial<SignalDef>;
}

const FRED_SOURCE = { sourceName: 'FRED, Federal Reserve Bank of St. Louis', license: 'FRED API Terms of Use; Pflichthinweis "not endorsed"' };
const THIRD = (owner: string) => ({ license: `FRED API Terms of Use; Reihe von ${owner} (Drittanbieter, Nutzung außerhalb privat nur mit Erlaubnis des Rechteinhabers)` });
const weekly = { intervalMinutes: WEEK, baseline: { method: 'rolling' as const, windowDays: 365, minPoints: 26 }, maxAgeHours: 24 * 21 };
const monthly = { intervalMinutes: MONTH, maxAgeHours: 24 * 100 };
const quarterly = { intervalMinutes: QUARTER, maxAgeHours: 24 * 300 };
// Tageswerte erscheinen mit 1 bis 2 Tagen Verzug, an Wochenenden/Feiertagen gar nicht.
const daily = { maxAgeHours: 120 };

export const SPECS: Spec[] = [
  // täglich
  { id: 'cyber.markets.vix_spike', series: ['VIXCLS'], freq: 'd', override: { ...daily, ...THIRD('Cboe') } },
  { id: 'cyber.markets.vix_term_structure', series: ['VIXCLS', 'VXVCLS'], freq: 'd', combine: ([a, b]) => (b ? a / b : null),
    override: { ...daily, ...THIRD('Cboe'), name: 'VIX-Terminstruktur (VIX/VIX3M)', unit: 'Verhältnis VIX/VIX3M',
      plain: 'Verhältnis der kurzfristigen zur dreimonatigen Angstkennzahl; über 1 heißt: akute Angst ist größer als die längerfristige.' } },
  { id: 'war.markets.ovx', series: ['OVXCLS'], freq: 'd', override: { ...daily, ...THIRD('Cboe') } },
  { id: 'war.markets.gvz_and_move', series: ['GVZCLS'], freq: 'd',
    override: { ...daily, ...THIRD('Cboe'), name: 'Gold-Volatilität (GVZ)', plain: 'Misst, wie stark Anleger Schwankungen beim Goldpreis erwarten (MOVE ist auf FRED nicht verfügbar).' } },
  { id: 'war.markets.breakeven_inflation', series: ['T5YIE'], freq: 'd', override: daily },
  { id: 'war.markets.hy_credit_spread', series: ['BAMLH0A0HYM2'], freq: 'd', combine: ([v]) => Math.round(v * 10000) / 100,
    override: { ...daily, ...THIRD('ICE Data Indices') } },
  { id: 'finance.credit.hy_oas', series: ['BAMLH0A0HYM2'], freq: 'd', override: { ...daily, ...THIRD('ICE Data Indices') } },
  { id: 'war.markets.us_10y_yield', series: ['DGS10'], freq: 'd', override: daily },
  { id: 'finance.markets.us_10y_yield', series: ['DGS10'], freq: 'd', override: daily },
  { id: 'finance.credit.eur_hy_oas', series: ['BAMLHE00EHYIOAS'], freq: 'd', override: { ...daily, ...THIRD('ICE Data Indices') } },
  { id: 'finance.credit.ig_oas', series: ['BAMLC0A0CM'], freq: 'd', override: { ...daily, ...THIRD('ICE Data Indices') } },
  { id: 'finance.credit.ccc_oas', series: ['BAMLH0A3HYC'], freq: 'd', override: { ...daily, ...THIRD('ICE Data Indices') } },
  { id: 'cyber.markets.safe_haven_fx', series: ['DEXSZUS'], freq: 'd', combine: ([v]) => (v ? 1 / v : null),
    override: { maxAgeHours: 24 * 10, name: 'Schweizer Franken als Fluchtwährung (USD je CHF)', unit: 'USD je CHF',
      plain: 'Wie viele US-Dollar ein Franken kostet; steigt, wenn Anleger in den Franken flüchten.' } },
  { id: 'war.markets.safe_haven_jpy', series: ['DEXJPUS'], freq: 'd', combine: ([v]) => (v ? 100 / v : null),
    override: { maxAgeHours: 24 * 10, name: 'Japanischer Yen (USD je 100 JPY)', unit: 'USD je 100 JPY',
      plain: 'Wie viele US-Dollar 100 Yen kosten; steigt, wenn Anleger in den Yen flüchten.' } },
  { id: 'war.markets.fuel_bunker_prices', series: ['DJFUELUSGULF'], freq: 'd',
    override: { maxAgeHours: 24 * 7, intervalMinutes: DAY, baseline: { method: 'rolling', windowDays: 90, minPoints: 30 },
      name: 'Kerosin-Preis US-Golfküste', unit: 'USD je Gallone', plain: 'Großhandelspreis für Flugzeugtreibstoff an der US-Golfküste (Bunkerpreise sind auf FRED nicht verfügbar).' } },
  { id: 'finance.money_market.us_tbill_stress', series: ['DGS1MO', 'IORB'], freq: 'd', combine: ([t, r]) => Math.round((t - r) * 10000) / 100,
    override: { ...daily, plain: 'Abstand der 1-Monats-T-Bill-Rendite zum Zins auf Zentralbankguthaben (IORB); stark negativ heißt Flucht in Sicherheit.' } },
  { id: 'finance.credit.us_curve_10y2y', series: ['T10Y2Y'], freq: 'd', override: daily },
  { id: 'finance.credit.us_curve_10y3m', series: ['T10Y3M'], freq: 'd', override: daily },
  // wöchentlich
  { id: 'cyber.markets.financial_stress_index', series: ['STLFSI4'], freq: 'w', override: { maxAgeHours: 24 * 21 } },
  { id: 'finance.money_market.fed_btfp_other_credit', series: ['WLCFLL'], freq: 'w', override: weekly },
  { id: 'finance.money_market.fed_discount_window', series: ['WLCFLPCL'], freq: 'w', override: { maxAgeHours: 24 * 21 } },
  { id: 'finance.banks.h8_borrowings', series: ['H8B3094NCBA'], freq: 'w', combine: ([v]) => Math.round(v) / 1000, override: weekly },
  { id: 'finance.banks.h8_deposits', series: ['DPSACBW027SBOG'], freq: 'w', override: { maxAgeHours: 24 * 21 } },
  { id: 'finance.real_economy.jobless_claims', series: ['ICSA'], freq: 'w', override: weekly },
  { id: 'cyber.finance.banknotes_in_circulation', series: ['WCURCIR'], freq: 'w',
    override: { maxAgeHours: 24 * 21, name: 'Bargeldumlauf USD (Wochendurchschnitt)', unit: 'Mio. USD', plain: 'Wie viel US-Bargeld im Umlauf ist; steigt, wenn Menschen Bargeld horten.' } },
  // monatlich
  { id: 'nuclear.markets.fred_uranium_price', series: ['PURANUSDM'], freq: 'm', override: { ...monthly, ...THIRD('IMF') } },
  { id: 'war.markets.fertilizer_prices', series: ['PCU325311325311'], freq: 'm',
    override: { ...monthly, name: 'Erzeugerpreise Stickstoffdünger (USA)', unit: 'Index', plain: 'Erzeugerpreisindex für Stickstoffdünger in den USA; steigt bei knappem Gas oder Lieferstörungen.' } },
  { id: 'war.markets.gas_henry_vs_ttf', series: ['PNGASEUUSDM', 'PNGASUSUSDM'], freq: 'm', combine: ([eu, us]) => Math.round((eu - us) * 1000) / 1000,
    override: { ...monthly, ...THIRD('IMF'), unit: 'USD je MMBtu', baseline: { method: 'rolling', windowDays: 1095, minPoints: 24 },
      plain: 'Monatlicher Abstand des europäischen Gaspreises zum US-Gaspreis (IMF-Reihen); wächst bei Versorgungsangst in Europa.' } },
  // quartalsweise
  { id: 'finance.real_economy.cre_delinq', series: ['DRCRELEXFACBS'], freq: 'q', override: quarterly },
  { id: 'finance.real_economy.consumer_credit_delinq', series: ['DRCCLACBS'], freq: 'q', override: quarterly },
  { id: 'finance.credit.sloos_tightening', series: ['DRTSCILM'], freq: 'q',
    override: { ...quarterly, name: 'US-Kreditumfrage (SLOOS): Anteil Banken mit strengeren Standards', plain: 'Netto-Anteil der US-Banken, die Firmenkredite strenger vergeben (Fed-Umfrage, vierteljährlich).' } },
];

export function seriesUrl(series: string, key: string, start: string): string {
  return `${BASE}?series_id=${encodeURIComponent(series)}&api_key=${encodeURIComponent(key)}&file_type=json&observation_start=${start}&sort_order=asc`;
}

/** date -> Wert; "." und unlesbare Werte entfallen. Wirft bei FRED-Fehlerobjekt oder fehlendem observations-Feld. */
export function parseObservations(body: unknown): Map<string, number> {
  const b = expect(body as Record<string, unknown> | null, 'JSON-Körper');
  if (typeof b.error_message === 'string') throw new Error(`FRED-Fehler ${String(b.error_code ?? '')}: ${b.error_message}`);
  const list = expect(Array.isArray(b.observations) ? (b.observations as unknown[]) : null, 'observations');
  const out = new Map<string, number>();
  for (const o of list) {
    const r = o as Record<string, unknown>;
    if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const v = r.value === '.' ? null : num(r.value);
    if (v !== null) out.set(r.date, v);
  }
  return out;
}

/** Beobachtungen eines Signals aus den Reihen seiner Serien (nur Daten, an denen alle Serien Werte haben). */
export function toObservations(spec: Spec, data: Map<string, number>[]): Observation[] {
  if (!data.length) return [];
  const out: Observation[] = [];
  for (const [date, first] of [...data[0].entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const vals = [first, ...data.slice(1).map((m) => m.get(date))];
    if (vals.some((v) => v === undefined)) continue;
    const v = spec.combine ? spec.combine(vals as number[]) : (vals[0] as number);
    if (v === null || !Number.isFinite(v)) continue;
    out.push(obs(spec.id, `${date}T00:00:00Z`, v));
  }
  return out;
}

function redact(e: unknown, key: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  return new Error(key ? msg.split(key).join('REDACTED').split(encodeURIComponent(key)).join('REDACTED') : msg);
}

const collector: Collector = {
  id: 'fred',
  title: 'FRED API (St. Louis Fed)',
  sourceUrl: 'https://fred.stlouisfed.org/',
  needsKey: KEY_ENV,
  intervalMinutes: 360,
  signals: SPECS.map((s) => ({
    ...CATALOG[s.id],
    ...FRED_SOURCE,
    sourceUrl: `https://fred.stlouisfed.org/series/${s.series[0]}`,
    ...(s.override ?? {}),
    id: s.id,
    collector: 'fred',
  })),
  async collect(ctx: CollectContext) {
    const key = expect(ctx.key(KEY_ENV), KEY_ENV);
    const freqOf = new Map<string, Freq>();
    const rank: Freq[] = ['d', 'w', 'm', 'q'];
    for (const s of SPECS) for (const id of s.series) {
      const f = freqOf.get(id);
      if (!f || rank.indexOf(s.freq) > rank.indexOf(f)) freqOf.set(id, s.freq);
    }
    const data = new Map<string, Map<string, number>>();
    const errors: string[] = [];
    for (const [series, freq] of freqOf) {
      const start = isoDay(daysAgo(ctx.now, WINDOW_DAYS[freq]));
      try {
        const body = await ctx.http.json(seriesUrl(series, key, start), { fixture: `fred/${series}.json` });
        data.set(series, parseObservations(body));
      } catch (e) {
        const err = redact(e, key);
        errors.push(`${series}: ${err.message}`);
        ctx.log(`fred: ${series} fehlgeschlagen: ${err.message}`);
      }
    }
    if (!data.size) throw new Error(`FRED: alle Serien fehlgeschlagen (${errors[0] ?? 'unbekannt'})`);
    const observations: Observation[] = [];
    for (const s of SPECS) {
      const maps = s.series.map((id) => data.get(id));
      if (maps.some((m) => !m)) continue;
      observations.push(...toObservations(s, maps as Map<string, number>[]));
    }
    return { observations };
  },
};

export default collector;
