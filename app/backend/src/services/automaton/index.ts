/**
 * Automaton Stables public API (Spec #55).
 *
 * Settlement, rollover and admin bulk cycles call `runTurnStepNonFatal`;
 * the admin control (task group 9) uses the Program_Switch and the alert
 * helpers. Everything else in `services/automaton/` is internal.
 */
export {
  runTurnStep,
  runTurnStepNonFatal,
  runAutomatonTurn,
  claimTurnRecord,
  getStrategyRegistry,
  TURN_ACTION_LIMIT,
  TURN_TIME_BUDGET_MS,
  TURN_STEP_MIN_BUDGET_MS,
  TURN_BUDGET_EXHAUSTED,
  STEP_BUDGET_EXHAUSTED,
  CUTOVER_IN_PROGRESS,
  PROGRAM_OFF,
  INVALID_PARAMETERS,
  type TurnStepInput,
  type TurnStepOutcome,
  type TurnStepSource,
  type TurnStepSummary,
} from './automatonTurnService';
export { withTurnStepLease, assertNoCutoverInProgress } from './turnStepLease';
export {
  getProgramSwitch,
  isProgramEnabled,
  setProgramSwitch,
  type ProgramSwitchResult,
  type ProgramSwitchState,
} from './programSwitch';
export { getLastCatalogueSyncSummary, syncCatalogue, type CatalogueSyncResult } from './catalogueSync';
export { exportCatalogue } from './catalogueExport';
export {
  blueprintFieldsSchema,
  blueprintRuleIssues,
  buildableBlueprintCount,
  eventOrderIssues,
  requiredTeamNameCountsFor,
  robotsTargetIssues,
  teamNamesIssues,
  type CatalogueExportDocument,
  type CatalogueIssue,
} from './automatonCatalogueService';
export {
  alertUpgradeRejected,
  alertCatalogueSyncConflicts,
  raiseAutomatonAlert,
  type RejectedUpgrade,
} from './automatonObservability';
