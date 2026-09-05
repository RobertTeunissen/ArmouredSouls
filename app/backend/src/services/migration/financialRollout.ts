import prisma from '../../lib/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import { checkDirectWriterCoverage } from './directWriterCoverage';

/** The only deployment environment covered by the forward-only rollout. */
export const ACC_ENVIRONMENT = 'ACC' as const;

export const ROLLOUT_PHASES = [
  'schema_client_generation',
  'writer_manifest_completion',
  'blocking_tests',
  'required_capture_activation',
  'acc_cutover',
  'reconciliation',
  'documentation',
] as const;

export type RolloutPhase = (typeof ROLLOUT_PHASES)[number];
export type CutoverClassification = 'pre_cutover' | 'post_cutover';

export interface FinancialRolloutState {
  environment: typeof ACC_ENVIRONMENT;
  phase: RolloutPhase;
  schemaClientGenerated: boolean;
  writerManifestComplete: boolean;
  blockingTestsPassed: boolean;
  requiredCaptureActive: boolean;
  accCutoverRecorded: boolean;
  reconciliationPassed: boolean;
  documentationComplete: boolean;
  cutoverCycle: number | null;
  cutoverRecordedAt: string | null;
  reconciledAt: string | null;
  documentedAt: string | null;
}

const FINANCIAL_ROLLOUT_KEY = 'financial_rollout';

const DEFAULT_ROLLOUT_STATE: FinancialRolloutState = {
  environment: ACC_ENVIRONMENT,
  phase: 'schema_client_generation',
  schemaClientGenerated: false,
  writerManifestComplete: false,
  blockingTestsPassed: false,
  requiredCaptureActive: false,
  accCutoverRecorded: false,
  reconciliationPassed: false,
  documentationComplete: false,
  cutoverCycle: null,
  cutoverRecordedAt: null,
  reconciledAt: null,
  documentedAt: null,
};

type RolloutGate =
  | 'schemaClientGenerated'
  | 'writerManifestComplete'
  | 'blockingTestsPassed'
  | 'requiredCaptureActive'
  | 'accCutoverRecorded'
  | 'reconciliationPassed'
  | 'documentationComplete';

const PHASE_GATE: Record<RolloutPhase, RolloutGate | null> = {
  schema_client_generation: 'schemaClientGenerated',
  writer_manifest_completion: 'writerManifestComplete',
  blocking_tests: 'blockingTestsPassed',
  required_capture_activation: 'requiredCaptureActive',
  acc_cutover: 'accCutoverRecorded',
  reconciliation: 'reconciliationPassed',
  documentation: 'documentationComplete',
};

const PHASE_PREREQUISITES: Record<RolloutPhase, readonly RolloutGate[]> = {
  schema_client_generation: [],
  writer_manifest_completion: ['schemaClientGenerated'],
  blocking_tests: ['schemaClientGenerated', 'writerManifestComplete'],
  required_capture_activation: [
    'schemaClientGenerated',
    'writerManifestComplete',
    'blockingTestsPassed',
  ],
  acc_cutover: [
    'schemaClientGenerated',
    'writerManifestComplete',
    'blockingTestsPassed',
    'requiredCaptureActive',
  ],
  reconciliation: ['accCutoverRecorded'],
  documentation: ['accCutoverRecorded', 'reconciliationPassed'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseRolloutState(value: unknown): FinancialRolloutState {
  if (value === undefined) return { ...DEFAULT_ROLLOUT_STATE };
  if (!isRecord(value)) {
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'The persisted financial rollout state is malformed',
      503,
    );
  }

  const phase = value.phase;
  const state: FinancialRolloutState = {
    environment: value.environment === ACC_ENVIRONMENT ? ACC_ENVIRONMENT : (value.environment as never),
    phase: phase as RolloutPhase,
    schemaClientGenerated: value.schemaClientGenerated as boolean,
    writerManifestComplete: value.writerManifestComplete as boolean,
    blockingTestsPassed: value.blockingTestsPassed as boolean,
    requiredCaptureActive: value.requiredCaptureActive as boolean,
    accCutoverRecorded: value.accCutoverRecorded as boolean,
    reconciliationPassed: value.reconciliationPassed as boolean,
    documentationComplete: value.documentationComplete as boolean,
    cutoverCycle: value.cutoverCycle as number | null,
    cutoverRecordedAt: value.cutoverRecordedAt as string | null,
    reconciledAt: value.reconciledAt as string | null,
    documentedAt: value.documentedAt as string | null,
  };

  const validPhase = (ROLLOUT_PHASES as readonly string[]).includes(state.phase);
  const validBooleans = [
    state.schemaClientGenerated,
    state.writerManifestComplete,
    state.blockingTestsPassed,
    state.requiredCaptureActive,
    state.accCutoverRecorded,
    state.reconciliationPassed,
    state.documentationComplete,
  ].every(isBoolean);
  const validCutover = state.cutoverCycle === null
    || (Number.isInteger(state.cutoverCycle) && state.cutoverCycle >= 0);
  const validDates = [state.cutoverRecordedAt, state.reconciledAt, state.documentedAt].every(isNullableString);

  if (
    state.environment !== ACC_ENVIRONMENT
    || !validPhase
    || !validBooleans
    || !validCutover
    || !validDates
    || (state.accCutoverRecorded !== (state.cutoverCycle !== null))
  ) {
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'The persisted financial rollout state is invalid',
      503,
    );
  }

  return state;
}

function readFeatureFlags(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'The persisted migration configuration is malformed',
      503,
    );
  }
  return value;
}

async function readPersistedState(): Promise<{
  featureFlags: Record<string, unknown>;
  rollout: FinancialRolloutState;
}> {
  const row = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
    select: { featureFlags: true },
  });
  const featureFlags = readFeatureFlags(row?.featureFlags);
  return {
    featureFlags,
    rollout: parseRolloutState(featureFlags[FINANCIAL_ROLLOUT_KEY]),
  };
}

async function persistRolloutState(
  featureFlags: Record<string, unknown>,
  rollout: FinancialRolloutState,
): Promise<FinancialRolloutState> {
  const nextFlags = {
    ...featureFlags,
    [FINANCIAL_ROLLOUT_KEY]: rollout,
  };
  const json = nextFlags as unknown as Parameters<typeof prisma.cycleMetadata.update>[0]['data']['featureFlags'];
  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: { featureFlags: json },
    create: { id: 1, featureFlags: json },
  });
  return rollout;
}

function phaseIndex(phase: RolloutPhase): number {
  return ROLLOUT_PHASES.indexOf(phase);
}

function assertPhasePrerequisites(
  state: FinancialRolloutState,
  phase: RolloutPhase,
): void {
  const missing = PHASE_PREREQUISITES[phase].filter((gate) => !state[gate]);
  if (missing.length > 0) {
    throw new FinancialError(
      FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
      `Cannot enter ${phase}; rollout gates are incomplete: ${missing.join(', ')}`,
      409,
      { phase, missingGates: missing },
    );
  }
}

function assertCycle(cycleNumber: number): void {
  if (!Number.isInteger(cycleNumber) || cycleNumber < 0) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_EVENT_IDENTITY,
      'Cutover cycle must be a non-negative integer',
    );
  }
}

/** Read the durable ACC rollout state without applying a fail-open default. */
export async function getFinancialRolloutState(): Promise<FinancialRolloutState> {
  try {
    return (await readPersistedState()).rollout;
  } catch (error) {
    if (error instanceof FinancialError) throw error;
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'Financial rollout state is unavailable',
      503,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

/** Return whether a cycle belongs to the authoritative post-cutover period. */
export function classifyCycle(
  cycleNumber: number,
  rollout: FinancialRolloutState,
): CutoverClassification {
  assertCycle(cycleNumber);
  return rollout.cutoverCycle !== null && cycleNumber >= rollout.cutoverCycle
    ? 'post_cutover'
    : 'pre_cutover';
}

/** Ensure required capture is active whenever a mutation is post-cutover. */
export async function assertRequiredCaptureForCycle(
  cycleNumber: number,
): Promise<FinancialRolloutState> {
  const rollout = await getFinancialRolloutState();
  if (classifyCycle(cycleNumber, rollout) === 'post_cutover' && !rollout.requiredCaptureActive) {
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      `Required financial capture is inactive for post-cutover cycle ${cycleNumber}`,
      503,
      { cycleNumber, cutoverCycle: rollout.cutoverCycle },
    );
  }
  return rollout;
}

/**
 * Require the forward-only paired-capture boundary for new financial evidence.
 *
 * Legacy financialService calls intentionally use assertRequiredCaptureForCycle
 * instead, so their pre-cutover compatibility path remains available.
 */
export async function assertPairedCaptureForCycle(
  cycleNumber: number,
): Promise<FinancialRolloutState> {
  const rollout = await assertRequiredCaptureForCycle(cycleNumber);
  if (classifyCycle(cycleNumber, rollout) !== 'post_cutover') {
    throw new FinancialError(
      FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
      'Paired financial capture is unavailable before the ACC Cutover_Cycle',
      503,
      { cycleNumber, cutoverCycle: rollout.cutoverCycle },
    );
  }
  return rollout;
}

/** Mark a non-cutover rollout gate complete, enforcing its prerequisite gates. */
export async function markRolloutPhaseComplete(
  phase: Exclude<RolloutPhase, 'acc_cutover' | 'reconciliation' | 'documentation'>,
): Promise<FinancialRolloutState> {
  const persisted = await readPersistedState();
  const current = persisted.rollout;
  const gate = PHASE_GATE[phase];
  if (!gate) {
    throw new FinancialError(FinancialErrorCode.ROLLOUT_PHASE_BLOCKED, `Phase ${phase} is not directly markable`, 409);
  }
  if (current[gate]) return current;
  if (phaseIndex(phase) < phaseIndex(current.phase)) {
    throw new FinancialError(
      FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
      `Rollout phase ${phase} is behind the current phase ${current.phase}`,
      409,
    );
  }
  assertPhasePrerequisites(current, phase);

  const next: FinancialRolloutState = {
    ...current,
    [gate]: true,
    phase,
  };
  return persistRolloutState(persisted.featureFlags, next);
}

export function markSchemaClientGenerationComplete(): Promise<FinancialRolloutState> {
  return markRolloutPhaseComplete('schema_client_generation');
}

export function markWriterManifestComplete(): Promise<FinancialRolloutState> {
  const coverage = checkDirectWriterCoverage();
  if (coverage.uncovered.length > 0) {
    throw new FinancialError(
      FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
      `Writer_Manifest is incomplete: ${coverage.uncovered.length} direct User.currency writer(s) remain outside the shared path`,
      409,
      { uncoveredWriters: coverage.uncovered },
    );
  }
  return markRolloutPhaseComplete('writer_manifest_completion');
}

export function markBlockingTestsPassed(): Promise<FinancialRolloutState> {
  return markRolloutPhaseComplete('blocking_tests');
}

/** Activate required capture only after schema, writers, and blocking tests pass. */
export function activateRequiredCapture(): Promise<FinancialRolloutState> {
  return markRolloutPhaseComplete('required_capture_activation');
}

/** Record the first authoritative cycle; this is the only cutover writer. */
export async function recordAccCutover(cycleNumber: number): Promise<FinancialRolloutState> {
  assertCycle(cycleNumber);
  const persisted = await readPersistedState();
  const current = persisted.rollout;

  if (current.cutoverCycle !== null) {
    if (current.cutoverCycle !== cycleNumber) {
      throw new FinancialError(
        FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
        `Cutover_Cycle is immutable and already recorded as ${current.cutoverCycle}`,
        409,
        { cutoverCycle: current.cutoverCycle },
      );
    }
    return current;
  }

  assertPhasePrerequisites(current, 'acc_cutover');
  const next: FinancialRolloutState = {
    ...current,
    phase: 'acc_cutover',
    accCutoverRecorded: true,
    cutoverCycle: cycleNumber,
    cutoverRecordedAt: new Date().toISOString(),
  };
  return persistRolloutState(persisted.featureFlags, next);
}

/** Record successful post-cutover reconciliation without mutating evidence. */
export async function markReconciliationComplete(): Promise<FinancialRolloutState> {
  const persisted = await readPersistedState();
  const current = persisted.rollout;
  if (current.reconciliationPassed) return current;
  assertPhasePrerequisites(current, 'reconciliation');
  const next: FinancialRolloutState = {
    ...current,
    phase: 'reconciliation',
    reconciliationPassed: true,
    reconciledAt: new Date().toISOString(),
  };
  return persistRolloutState(persisted.featureFlags, next);
}

/** Record that the named rollout and diagnostic documentation is complete. */
export async function markDocumentationComplete(): Promise<FinancialRolloutState> {
  const persisted = await readPersistedState();
  const current = persisted.rollout;
  if (current.documentationComplete) return current;
  assertPhasePrerequisites(current, 'documentation');
  const next: FinancialRolloutState = {
    ...current,
    phase: 'documentation',
    documentationComplete: true,
    documentedAt: new Date().toISOString(),
  };
  return persistRolloutState(persisted.featureFlags, next);
}

const ALL_ROLLOUT_GATES: readonly RolloutGate[] = [
  'schemaClientGenerated',
  'writerManifestComplete',
  'blockingTestsPassed',
  'requiredCaptureActive',
  'accCutoverRecorded',
  'reconciliationPassed',
  'documentationComplete',
];

export function getMissingRolloutGates(state: FinancialRolloutState): readonly RolloutGate[] {
  return ALL_ROLLOUT_GATES.filter((gate) => !state[gate]);
}

export { FINANCIAL_ROLLOUT_KEY, DEFAULT_ROLLOUT_STATE };
