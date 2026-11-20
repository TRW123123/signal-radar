// Shadowserver Dashboard: Zeitreihen der täglichen Internet-Scans (Klasse A: unabhängige Messung von Shadowserver).
// Quelle: https://dashboard.shadowserver.org/statistics/combined/time-series/?...&embed=true
//   Die Dashboard-Seite lädt ihre Ergebnisse selbst über dieselbe URL mit embed=true nach: JSON
//   { content: "<html>" }, darin <div class="chart" data-bb="{...billboard.js-Konfiguration...}"> mit
//   data.columns = [["x", "YYYY-MM-DD", ...], ["<Serie>", n, ...], ...]. Kein Key nötig (geprüft 20.11.2026).
// Doku: https://dashboard.shadowserver.org/help/ (Bedienhilfe; keine formale API-Doku für diesen Weg. Die Konto-API
//   https://github.com/The-Shadowserver-Foundation/api_utils/wiki braucht Key+HMAC-Secret per POST und wird hier nicht genutzt.)
// Lizenz/Bedingungen (https://www.shadowserver.org/privacy-and-terms/, gelesen 20.11.2026): KEINE CC-BY-Lizenz. Die Bedingungen
//   zählen "graphs; charts; and other aggregated data points" zu den Reports (Restricted Content) mit persönlicher,
//   widerruflicher Lizenz für "Non-Profit Research" und "Organizational Defense and Research". Für veröffentlichte
//   Verbreitung darüber hinaus verlangen sie Attribution: (1) Shadowserver-Copyright-Hinweis, (2) Link auf die
//   Shadowserver-Website, (3) das Shadowserver-Logo. Ob die öffentliche Dashboard-Statistik darunter fällt, sagt die Seite
//   nicht ausdrücklich: Lizenz offen, vor Veröffentlichung klären (ggf. Shadowserver fragen). Moderates Polling: 3 Anfragen/Tag.
// Gemessen (Datensatz unique_ips = eindeutige IPs je Tag, Tageswerte, ca. 2 Tage Verzug):
//   - cyber.vuln.exposed_ot_protocols: source=ics, weltweit (Summe aller Regionen-Serien)
//   - cyber.threat.shadowserver_reflectors: source=scan, Tags der UDP-Verstärker (dns, ntp, snmp, ssdp, netbios, portmapper,
//     ldap-udp, mdns, ws-discovery, coap, chargen, qotd, memcached), weltweit, Summe über Tags (eine IP mit zwei offenen
//     Diensten zählt doppelt). Fehlt ein Tag oder ein Tageswert, entfällt der Tag (keine unvollständigen Summen).
//   - cyber.vuln.shadowserver_exposed: Deutschland, Quellen http_vulnerable + smtp_vulnerable + isakmp_vulnerable + exchange
//     (das Dashboard summiert mehrere Quellen; am 20.11.2026 gegen Einzelabfragen geprüft)
//   - cyber.vuln.vulnerable_host_decay: aus derselben Reihe: Abbau über 7 Tage = Wert(t−7) − Wert(t) (positiv = Abbau)
// Harmlose Ursachen: Änderungen an Scan-Methodik oder Tagging, Ausfall einzelner Scanner (Tageseinbruch), Kampagnen-Scans
//   nach neuen CVEs (neue Tags), Geo-IP-Umzuordnung, Wochenend-Dellen (DHCP/Endgeräte).
// VERIFIED: ja (20.11.2026, echte Antworten in fixtures/shadowserver/*.json, ungekürzt).

import type { Collector, Observation } from '../core/types.ts';
import { expect, num, obs } from './_helpers.ts';

const BASE = 'https://dashboard.shadowserver.org/statistics/combined/time-series/?date_range=30&dataset=unique_ips&stacking=stacked&embed=true';
export const REFLECTOR_TAGS = ['dns', 'ntp', 'snmp', 'ssdp', 'netbios', 'portmapper', 'ldap-udp', 'mdns', 'ws-discovery', 'coap', 'chargen', 'qotd', 'memcached'];
export const VULN_SOURCES = ['http_vulnerable', 'smtp_vulnerable', 'isakmp_vulnerable', 'exchange'];

export const URLS = {
  ics: `${BASE}&source=ics&limit=20`,
  reflectors: `${BASE}&source=scan&group_by=tag&limit=20&${REFLECTOR_TAGS.map((t) => `tag=${t}`).join('&')}`,
  vulnerable: `${BASE}&${VULN_SOURCES.map((s) => `source=${s}`).join('&')}&geo=DE`,
};

const S_OT = 'cyber.vuln.exposed_ot_protocols';
const S_REFL = 'cyber.threat.shadowserver_reflectors';
const S_VULN = 'cyber.vuln.shadowserver_exposed';
const S_DECAY = 'cyber.vuln.vulnerable_host_decay';

export interface Chart { days: string[]; series: Map<string, (number | null)[]> }

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Liest die Zeitreihe aus der embed-Antwort des Dashboards. */
export function parseChart(body: unknown): Chart {
  const b = expect(body as { content?: unknown; errors?: unknown } | null, 'JSON-Körper');
  if (b.errors) throw new Error(`Shadowserver meldet Formularfehler: ${JSON.stringify(b.errors).slice(0, 200)}`);
  const content = expect(typeof b.content === 'string' ? b.content : null, 'content');
  const m = expect(/data-bb="([^"]*)"/.exec(content), 'Diagramm (data-bb)');
  let cfg: { data?: { columns?: unknown } };
  try {
    cfg = JSON.parse(decodeEntities(m[1]));
  } catch {
    throw new Error('unerwartete Antwort: data-bb ist kein JSON');
  }
  const cols = expect(Array.isArray(cfg.data?.columns) ? (cfg.data!.columns as unknown[][]) : null, 'data.columns');
  const x = expect(cols.find((c) => Array.isArray(c) && c[0] === 'x'), 'x-Spalte');
  const days = x.slice(1).map(String);
  const series = new Map<string, (number | null)[]>();
  for (const c of cols) {
    if (!Array.isArray(c) || c[0] === 'x') continue;
    series.set(String(c[0]), days.map((_, i) => num(c[i + 1])));
  }
  return { days: days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), series };
}

/** Summe über Serien je Tag; Tage mit fehlendem Summanden (oder fehlender Pflicht-Serie) entfallen. */
export function sumSeries(signalId: string, chart: Chart, required: string[] = []): Observation[] {
  const missing = required.filter((r) => !chart.series.has(r));
  if (missing.length) throw new Error(`unerwartete Antwort: Serie(n) ${missing.join(', ')} fehlen`);
  if (chart.series.size === 0) return [];
  const out: Observation[] = [];
  chart.days.forEach((day, i) => {
    let sum = 0;
    for (const vals of chart.series.values()) {
      const v = vals[i];
      if (v === null || v === undefined) return;
      sum += v;
    }
    out.push(obs(signalId, `${day}T00:00:00Z`, sum));
  });
  return out;
}

/** Abbau über `lag` Tage: Wert(t−lag) − Wert(t); nur wo beide Tage vorliegen. */
export function decay(signalId: string, series: Observation[], lag = 7): Observation[] {
  const byDay = new Map(series.map((o) => [o.ts, o.value]));
  const out: Observation[] = [];
  for (const o of series) {
    const prev = byDay.get(new Date(Date.parse(o.ts) - lag * 86400_000).toISOString());
    if (prev !== undefined) out.push(obs(signalId, o.ts, prev - o.value));
  }
  return out;
}

const common = {
  scenarios: ['cyber'], evidenceClass: 'A' as const, kind: 'count' as const, manipulability: 'low' as const,
  independenceGroup: 'shadowserver', intervalMinutes: 1440, maxAgeHours: 120,
  baseline: { method: 'day-of-week' as const, windowDays: 56, minPoints: 21 },
  sourceName: 'Shadowserver Dashboard', sourceUrl: 'https://dashboard.shadowserver.org/',
  license: 'Shadowserver Terms (Reports/Charts = Restricted Content; Veröffentlichung nur mit © The Shadowserver Foundation, Link und Logo; Freigabe für öffentliches Dashboard ungeklärt)',
};

const collector: Collector = {
  id: 'shadowserver',
  title: 'Shadowserver Dashboard (Scan-Statistik)',
  sourceUrl: 'https://dashboard.shadowserver.org/',
  intervalMinutes: 1440,
  signals: [
    { ...common, id: S_OT, domain: 'vuln', name: 'Exponierte OT-Protokolle',
      plain: 'Wie viele Industriesteuerungen (Modbus, S7 und Ähnliche) weltweit offen im Internet erreichbar sind.',
      direction: 'up', weight: 0.45, unit: 'IPs' },
    { ...common, id: S_REFL, domain: 'threat', name: 'Offene DDoS-Reflektoren',
      plain: 'Wie viele offene Dienste (DNS, NTP, Memcached und Ähnliche) weltweit für DDoS-Verstärkung nutzbar sind.',
      direction: 'up', weight: 0.45, unit: 'IPs' },
    { ...common, id: S_VULN, domain: 'vuln', name: 'Shadowserver exponierte verwundbare Hosts (DE)',
      plain: 'Wie viele Server in Deutschland mit bekannter Sicherheitslücke offen im Internet stehen.',
      direction: 'up', weight: 0.55, unit: 'IPs' },
    { ...common, id: S_DECAY, domain: 'vuln', name: 'Abbau verwundbarer Hosts (DE, 7 Tage)',
      plain: 'Um wie viele verwundbare Server in Deutschland die Zahl binnen einer Woche gesunken ist.',
      direction: 'down', kind: 'gauge', weight: 0.4, unit: 'IPs/7 Tage' },
  ],
  async collect(ctx) {
    const observations: Observation[] = [];
    const get = (url: string, fixture: string) => ctx.http.json<unknown>(url, { fixture, timeoutMs: 40_000 });
    const tasks: [string, () => Promise<Observation[]>][] = [
      [S_OT, async () => sumSeries(S_OT, parseChart(await get(URLS.ics, 'shadowserver/ics-world.json')))],
      [S_REFL, async () => sumSeries(S_REFL, parseChart(await get(URLS.reflectors, 'shadowserver/reflectors-world.json')), REFLECTOR_TAGS)],
      [S_VULN, async () => {
        const vuln = sumSeries(S_VULN, parseChart(await get(URLS.vulnerable, 'shadowserver/vulnerable-de.json')), ['Germany']);
        return [...vuln, ...decay(S_DECAY, vuln)];
      }],
    ];
    let failed = 0;
    for (const [id, run] of tasks) {
      try {
        observations.push(...(await run()));
      } catch (e) {
        failed++;
        ctx.log(`${id}: ${(e as Error).message}`);
      }
    }
    if (failed === tasks.length) throw new Error('Shadowserver: alle Abfragen fehlgeschlagen');
    return { observations };
  },
};

export default collector;
