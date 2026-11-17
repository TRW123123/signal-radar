# Benötigte Keys, Konten und Bezahlzugänge (Szenario ai)

Automatisch erzeugt von `scripts/consolidate_ai.py`. Gleiche Spalten wie `docs/KEYS-NEEDED.md`; Dienste, die dort schon stehen (z. B. Cloudflare Radar, abuse.ch, GitHub), nutzen dieselbe Umgebungsvariable. Collectors ohne Key werden übersprungen, nicht als Fehler gewertet.

| Dienst | Wofür | Kosten | Link | Umgebungsvariable | Betroffene Signale |
|---|---|---|---|---|---|
| Cloudflare Radar API (AI Insights) | Anteil KI-Crawler am Web-Verkehr; Crawl-zu-Verweis-Verhältnis; Layer-7-Angriffe als Begleiter; Gesamt-Bot-Anteil am Web-Verkehr … | free (kostenloser Key/Konto) | https://developers.cloudflare.com/radar/ | `SR_CLOUDFLARE_KEY` | 5 |
| EIA Open Data (Strom stündlich) | Stromlast Virginia/PJM | free (kostenloser Key/Konto) | https://www.eia.gov/opendata/ | `SR_EIA_KEY` | 1 |
| GitHub Advisory Database REST | nur Alternativquelle für: osv_malware_ai | free (kostenloser Key/Konto) | https://docs.github.com/en/rest/security-advisories/global-advisories | `SR_GHSA_KEY` | 0 (+1 als Alternative) |
| GitHub Search API (Repositories) | Neue Repositories zu MCP-Servern; Pull-Requests durch Coding-Agenten pro Tag; Commits mit KI-Co-Autor-Zeile | free (kostenloser Key/Konto) | https://docs.github.com/en/rest/search/search | `SR_GITHUB_REST_KEY` | 3 |
| GreyNoise Tags API | GreyNoise-Tags zu KI-Diensten | free (Community, begrenzt) (kostenloser Key/Konto) | https://docs.greynoise.io/ | `SR_GREYNOISE_KEY` | 1 |
| Metaculus API | nur Alternativquelle für: prediction_ai_incident | free (kostenloser Key/Konto) | https://www.metaculus.com/api/ | `SR_METACULUS_KEY` | 0 (+1 als Alternative) |
| NVD CVE API 2.0 | nur Alternativquelle für: cve_ai_keywords | free (kostenloser Key/Konto) | https://nvd.nist.gov/developers/vulnerabilities | `SR_NVD_CVE_API_KEY` | 0 (+1 als Alternative) |
| Reddit r/LocalLLaMA und r/ChatGPT (JSON) | Aktivität der Community um lokale Modelle | free (kostenloser Key/Konto) | https://www.reddit.com/dev/api/ | `SR_REDDIT_JSON_KEY` | 1 |
| Shodan Count API | Offen erreichbare LLM-Server im Internet | Konto (Mitgliedschaft ca. 49 USD einmalig, Stand Kenntnis) (bezahlt) | https://developer.shodan.io/api | `SR_SHODAN_KEY` | 1 |
| URLhaus Host-Abfrage | Schadsoftware-URLs auf huggingface.co | free (kostenloser Key/Konto) | https://urlhaus-api.abuse.ch/ | `SR_ABUSECH_KEY` | 1 |
| Vast.ai Marktplatz | GPU-Mietpreise (H100); Verfügbare GPUs am Marktplatz | free (kostenloser Key/Konto) | https://docs.vast.ai/ | `SR_VAST_AI_KEY` | 2 |
