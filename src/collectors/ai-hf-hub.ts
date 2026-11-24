// KI-Plattformen: Rate neu angelegter Modelle auf dem Hugging Face Hub (Ausschlag = Upload-Flut, etwa Massen-Uploads von Schadmodellen oder Spam).
// Quelle: Hugging Face Hub API, https://huggingface.co/docs/hub/api (GET /api/models, ohne Key lesbar). Nutzungsbedingungen: https://huggingface.co/terms-of-service,
// nur Leseabfrage mit kleinem Limit, ein Aufruf je Lauf; Metadaten der Modelle sind öffentlich, wir lesen nur die Zeitstempel (keine Namen, keine Personen).
// Anfrage: sort=createdAt&direction=-1&limit=40 mit expand[]=createdAt (nur dieses Feld, ca. 4 500 Zeichen). Antwort laut Doku: Array von { _id, id, createdAt }.
// Gemessen: neue Modelle pro Stunde = (n - 1) geteilt durch die Zeitspanne zwischen neuestem und ältestem der n zuletzt angelegten Modelle.
// Ein Wert je Lauf (volle Stunde), Baseline baut sich über die Läufe auf (Wochentag und Tageszeit).
// Harmlose Ursachen für Ausschläge: Modellreleases großer Labs mit vielen Varianten, Quantisierungs-Bots, Wettbewerbe und Kurse, Tageszeit und Wochentag.
// VERIFIED: nein (Test nach Doku nachgebaut; wird beim nächsten Actions-Lauf live geprüft)

import type { Collector } from '../core/types.ts';
import { expect, floorHour, obs } from './_helpers.ts';

export const SIG_RATE = 'ai.platforms.hf_new_models_rate';
export const URL_MODELS = 'https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=40&expand%5B%5D=createdAt';

/** Neue Modelle pro Stunde aus den Zeitstempeln der zuletzt angelegten Modelle (mindestens 10 Einträge, Spanne mindestens 1 Sekunde). */
export function parseNewModelsRate(body: unknown): number {
  const rows = expect(Array.isArray(body) ? body : null, 'Modellliste');
  const ts = rows
    .map((r) => (r && typeof r === 'object' ? Date.parse(String((r as { createdAt?: unknown }).createdAt ?? '')) : NaN))
    .filter((t) => Number.isFinite(t));
  if (ts.length < 10) throw new Error(`unerwartete Antwort: nur ${ts.length} Modelle mit createdAt`);
  const span = Math.max(...ts) - Math.min(...ts);
  if (!(span >= 1000)) throw new Error('unerwartete Antwort: Zeitspanne der Modelle ist 0');
  return ((ts.length - 1) / span) * 3600_000;
}

const collector: Collector = {
  id: 'ai-hf-hub',
  title: 'Hugging Face Hub: neue Modelle pro Stunde',
  sourceUrl: 'https://huggingface.co/docs/hub/api',
  intervalMinutes: 60,
  signals: [
    {
      id: SIG_RATE, scenarios: ['ai'], domain: 'platforms', name: 'Neue Modelle auf Hugging Face pro Stunde',
      plain: 'Wie viele neue KI-Modelle pro Stunde auf Hugging Face hochgeladen werden; eine Upload-Flut kann Massen-Missbrauch der Plattform anzeigen.',
      evidenceClass: 'A', direction: 'up', kind: 'gauge', weight: 0.6, manipulability: 'medium', independenceGroup: 'huggingface',
      unit: 'Modelle/Stunde', intervalMinutes: 60, holdHours: 12, baseline: { method: 'hour-of-week', windowDays: 28, minPoints: 48 },
      thresholds: { relFloor: 0.15 }, license: 'öffentliche Metadaten, Hugging Face Nutzungsbedingungen beachten',
      sourceName: 'Hugging Face Hub API', sourceUrl: 'https://huggingface.co/docs/hub/api',
      banalCauses: ['Release-Wellen großer Labs mit vielen Varianten', 'Quantisierungs-Bots', 'Kurse und Wettbewerbe', 'Tageszeit und Wochentag'],
    },
  ],
  async collect(ctx) {
    const body = await ctx.http.json<unknown>(URL_MODELS, { fixture: 'huggingface/models-newest-40.json' });
    return { observations: [obs(SIG_RATE, floorHour(ctx.now), Math.round(parseNewModelsRate(body) * 10) / 10)] };
  },
};

export default collector;
