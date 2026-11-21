/**
 * Automaton Stables public API (Spec #55).
 *
 * Settlement, rollover and admin bulk cycles call `runTurnStepNonFatal`;
 * the admin control (task group 9) uses the Program_Switch and the alert
 * helpers. Everything else in `services/automaton/` is internal.
 */
export {
  runTurnStepNonFatal,
  type TurnStepInput,
  type TurnStepOutcome,
  type TurnStepSummary,
} from './automatonTurnService';
export {
  type CatalogueExportDocument,
  type CatalogueIssue,
} from './automatonCatalogueService';
