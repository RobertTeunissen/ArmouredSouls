import type { FinancialIntegrityIssue } from '../common/financialIntegrityDiagnostics';
import type { FinancialRolloutState } from './financialRollout';

export interface FinancialRolloutCliConfig {
  nodeEnv: string;
  financialRolloutTarget: string | undefined;
}

export interface FinancialRolloutCliDependencies {
  config: FinancialRolloutCliConfig;
  getRolloutState: () => Promise<FinancialRolloutState>;
  getMissingRolloutGates: (state: FinancialRolloutState) => readonly string[];
  markSchemaClientGenerationComplete: () => Promise<FinancialRolloutState>;
  markWriterManifestComplete: () => Promise<FinancialRolloutState>;
  markBlockingTestsPassed: () => Promise<FinancialRolloutState>;
  activateRequiredCapture: () => Promise<FinancialRolloutState>;
  recordAccCutover: (cycleNumber: number) => Promise<FinancialRolloutState>;
  markReconciliationComplete: () => Promise<FinancialRolloutState>;
  markDocumentationComplete: () => Promise<FinancialRolloutState>;
  getCurrentCycle: () => Promise<number | null>;
  collectFinancialIntegrityIssues: (
    cycleNumber: number,
    state: FinancialRolloutState,
  ) => Promise<readonly FinancialIntegrityIssue[]>;
  disconnect: () => Promise<void>;
  writeStdout: (message: string) => void;
  writeStderr: (message: string) => void;
}

type ConfirmedCommand =
  | 'mark-schema-client-generation'
  | 'mark-writer-manifest'
  | 'mark-blocking-tests'
  | 'activate-required-capture'
  | 'mark-documentation';

const CONFIRMATION_FLAGS: Record<ConfirmedCommand, string> = {
  'mark-schema-client-generation': '--confirm-schema-client-generation',
  'mark-writer-manifest': '--confirm-writer-manifest',
  'mark-blocking-tests': '--confirm-blocking-tests',
  'activate-required-capture': '--confirm-required-capture',
  'mark-documentation': '--confirm-documentation',
};

function assertAccTarget(config: FinancialRolloutCliConfig): void {
  if (config.nodeEnv !== 'acceptance' || config.financialRolloutTarget !== 'ACC') {
    throw new Error('Financial rollout commands require NODE_ENV=acceptance and FINANCIAL_ROLLOUT_TARGET=ACC');
  }
}

function parseCycle(value: string | undefined): number {
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Cycle must be a non-negative integer written without signs, decimals, or exponent notation');
  }

  const cycleNumber = Number(value);
  if (!Number.isSafeInteger(cycleNumber)) {
    throw new Error('Cycle must be a safe integer');
  }
  return cycleNumber;
}

function parseConfirmedCommand(args: readonly string[]): ConfirmedCommand {
  const command = args[0] as ConfirmedCommand | undefined;
  if (command === undefined || !(command in CONFIRMATION_FLAGS)) {
    throw new Error('Unknown financial rollout command');
  }
  if (args.length !== 2 || args[1] !== CONFIRMATION_FLAGS[command]) {
    throw new Error(`${command} requires ${CONFIRMATION_FLAGS[command]} as its only argument`);
  }
  return command;
}

function assertCurrentCycle(cycleNumber: number | null): number {
  if (cycleNumber === null || !Number.isSafeInteger(cycleNumber) || cycleNumber < 0) {
    throw new Error('Current cycle is unavailable or invalid; refusing rollout transition');
  }
  return cycleNumber;
}

function writeResult(
  dependencies: FinancialRolloutCliDependencies,
  command: string,
  state: FinancialRolloutState,
  options: { currentCycle?: number; reconciledCycle?: number; issues?: readonly FinancialIntegrityIssue[] } = {},
): void {
  dependencies.writeStdout(JSON.stringify({
    command,
    rollout: state,
    missingGates: dependencies.getMissingRolloutGates(state),
    ...options,
  }, null, 2));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected financial rollout command failure';
}

async function runConfirmedCommand(
  command: ConfirmedCommand,
  dependencies: FinancialRolloutCliDependencies,
): Promise<FinancialRolloutState> {
  switch (command) {
    case 'mark-schema-client-generation':
      return dependencies.markSchemaClientGenerationComplete();
    case 'mark-writer-manifest':
      return dependencies.markWriterManifestComplete();
    case 'mark-blocking-tests':
      return dependencies.markBlockingTestsPassed();
    case 'activate-required-capture':
      return dependencies.activateRequiredCapture();
    case 'mark-documentation':
      return dependencies.markDocumentationComplete();
  }
}

function parseCutoverCommandArgs(args: readonly string[]): number {
  if (args.length !== 4 || args[1] !== '--cycle' || args[3] !== '--confirm-acc-cutover') {
    throw new Error('record-acc-cutover requires --cycle <current-cycle> --confirm-acc-cutover');
  }

  return parseCycle(args[2]);
}

interface ReconciliationCommandArgs {
  cycleNumber: number;
  isMarkingComplete: boolean;
}

function parseReconciliationCommandArgs(args: readonly string[]): ReconciliationCommandArgs {
  const isMarkingComplete = args[0] === 'mark-reconciliation';
  const expectedConfirmation = isMarkingComplete ? '--confirm-reconciliation' : undefined;
  const expectedLength = isMarkingComplete ? 4 : 3;

  if (
    args.length !== expectedLength
    || args[1] !== '--cycle'
    || (expectedConfirmation !== undefined && args[3] !== expectedConfirmation)
  ) {
    throw new Error(
      isMarkingComplete
        ? 'mark-reconciliation requires --cycle <completed-cycle> --confirm-reconciliation'
        : 'reconcile requires --cycle <completed-cycle>',
    );
  }

  return { cycleNumber: parseCycle(args[2]), isMarkingComplete };
}

async function runCutoverCommand(
  requestedCycle: number,
  dependencies: FinancialRolloutCliDependencies,
): Promise<void> {
  const currentCycle = assertCurrentCycle(await dependencies.getCurrentCycle());
  if (requestedCycle !== currentCycle) {
    throw new Error(`Cutover cycle ${requestedCycle} does not match the stored current cycle ${currentCycle}`);
  }

  const state = await dependencies.recordAccCutover(requestedCycle);
  writeResult(dependencies, 'record-acc-cutover', state, { currentCycle });
}

async function runReconciliationCommand(
  command: 'reconcile' | 'mark-reconciliation',
  { cycleNumber, isMarkingComplete }: ReconciliationCommandArgs,
  dependencies: FinancialRolloutCliDependencies,
): Promise<void> {
  const state = await dependencies.getRolloutState();
  const currentCycle = assertCurrentCycle(await dependencies.getCurrentCycle());
  if (state.cutoverCycle === null || cycleNumber < state.cutoverCycle || cycleNumber >= currentCycle) {
    throw new Error('Reconciliation requires a completed post-cutover cycle before the current cycle');
  }

  const issues = await dependencies.collectFinancialIntegrityIssues(cycleNumber, state);
  if (isMarkingComplete && issues.length > 0) {
    throw new Error(`Reconciliation found ${issues.length} financial integrity issue(s); completion was not recorded`);
  }

  const result = isMarkingComplete
    ? await dependencies.markReconciliationComplete()
    : state;
  writeResult(dependencies, command, result, { reconciledCycle: cycleNumber, issues });
}

/**
 * Run one guarded ACC financial-rollout operation.
 *
 * This command deliberately has no generic flag mutation, force, rollback, or
 * multi-step activation option. Every state transition delegates to the rollout
 * service, which owns durable validation and prerequisite enforcement.
 */
export async function runFinancialRolloutCli(
  args: readonly string[],
  dependencies: FinancialRolloutCliDependencies,
): Promise<number> {
  let databaseTouched = false;
  let exitCode = 0;

  try {
    assertAccTarget(dependencies.config);
    const command = args[0];

    if (command === 'status') {
      if (args.length !== 1) throw new Error('status does not accept arguments');
      databaseTouched = true;
      const [state, currentCycle] = await Promise.all([
        dependencies.getRolloutState(),
        dependencies.getCurrentCycle(),
      ]);
      writeResult(dependencies, command, state, { currentCycle: assertCurrentCycle(currentCycle) });
    } else if (command === 'record-acc-cutover') {
      const requestedCycle = parseCutoverCommandArgs(args);
      databaseTouched = true;
      await runCutoverCommand(requestedCycle, dependencies);
    } else if (command === 'reconcile' || command === 'mark-reconciliation') {
      const reconciliationArgs = parseReconciliationCommandArgs(args);
      databaseTouched = true;
      await runReconciliationCommand(command, reconciliationArgs, dependencies);
    } else {
      const confirmedCommand = parseConfirmedCommand(args);
      databaseTouched = true;
      const state = await runConfirmedCommand(confirmedCommand, dependencies);
      writeResult(dependencies, confirmedCommand, state);
    }
  } catch (error) {
    exitCode = 1;
    dependencies.writeStderr(`Financial rollout command failed: ${errorMessage(error)}`);
  }

  if (databaseTouched) {
    try {
      await dependencies.disconnect();
    } catch (error) {
      dependencies.writeStderr(`Financial rollout command failed to disconnect cleanly: ${errorMessage(error)}`);
      exitCode = 1;
    }
  }

  return exitCode;
}
