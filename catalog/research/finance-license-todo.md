# Lizenz noch klären (Szenario finance)

Automatisch erzeugt von `scripts/consolidate_finance.py`. Kriterien wie in `docs/LICENSE-TODO.md`: Lizenz laut Recherche unklar oder Nutzungsbedingungen schränken automatisierten Abruf ein. Signale, deren Hauptquelle nur per Scrape erreichbar ist und deren Lizenz unklar ist, haben Status `license-unclear`. Yahoo Finance: Nutzungsbedingungen verbieten systematischen Abruf; der Collector yahoo-chart läuft bereits, die Frage gilt für alle Szenarien.

| Quelle | Zugriffsart | Was unklar ist (Stand Recherche) | Link |
|---|---|---|---|
| CBOE Indexdaten | download | unklar | https://www.cboe.com/us/indices/dashboard/skew/ |
| Drewry WCI | scrape (Status license-unclear) | Nutzungsbedingungen prüfen | https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry |
| FHLB Office of Finance | scrape (Status license-unclear) | unklar | https://www.fhlb-of.com/ofweb_userWeb/pageBuilder/financial-reports-5 |
| cryptonequity/crypto-fear-greed-historical-dataset-2018-2026 | download | unklar | https://github.com/cryptonequity/crypto-fear-greed-historical-dataset-2018-2026 |
| Kalshi Trade API (öffentliche Marktdaten) | api | Kalshi ToS | https://docs.kalshi.com/ |
| Polymarket Gamma API | api | ToS Polymarket, lesend frei | https://docs.polymarket.com/ |
| Yahoo Finance Chart-Endpunkt (inoffiziell) | api | unklar, ToS verbieten systematische Nutzung | https://finance.yahoo.com/ |
