// Alle Szenario-Konfigurationen der geteilten Collectors (statisch importiert, damit es auch in Serverless-Funktionen läuft).
// Reihenfolge = Reihenfolge der Signale und Requests in den Collectors. Neues Szenario: Datei anlegen und hier eintragen.

import type { ScenarioCollectorConfig } from './_types.ts';
import cyber from './cyber.ts';
import war from './war.ts';
import blackout from './blackout.ts';
import ai from './ai.ts';
import finance from './finance.ts';
import nuclear from './nuclear.ts';
import bio from './bio.ts';

export const SCENARIO_CONFIGS: ScenarioCollectorConfig[] = [cyber, war, blackout, ai, finance, nuclear, bio];

export default SCENARIO_CONFIGS;
