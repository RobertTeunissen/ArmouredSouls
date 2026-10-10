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
  withTurnStepLease,
  assertNoCutoverInProgress,
  claimTurnRecord,
  getStrategyRegistry,
  TURN_ACTION_LIMIT,
  TURN_TIME_BUDGET_MS,
  TURN_STEP_BUDGET_MS,
  TURN_BUDGET_EXHAUSTED,
  STEP_BUDGET_EXHAUSTED,
  PROGRAM_OFF,
  INVALID_PARAMETERS,
  type TurnStepInput,
  type TurnStepOutcome,
  type TurnStepSource,
  type TurnStepSummary,
} from './automatonTurnService';
export {
  getProgramSwitch,
  isProgramEnabled,
  setProgramSwitch,
  type ProgramSwitchChange,
  type ProgramSwitchState,
} from './programSwitch';
export {
  alertUpgradeRejected,
  alertCatalogueSyncConflicts,
  raiseAutomatonAlert,
  type RejectedUpgrade,
} from './automatonObservability';
