import type { FinancialIntegrityIssue } from '../../common/financialIntegrityDiagnostics';
import { DEFAULT_ROLLOUT_STATE, type FinancialRolloutState } from '../financialRollout';
import {
  runFinancialRolloutCli,
  type FinancialRolloutCliDependencies,
} from '../financialRolloutCli';

interface CliTestHarness {
  dependencies: FinancialRolloutCliDependencies;
  calls: Record<string, jest.Mock>;
  stdout: string[];
  stderr: string[];
}

function createHarness(overrides: Partial<FinancialRolloutCliDependencies> = {}): CliTestHarness {
  const state: FinancialRolloutState = { ...DEFAULT_ROLLOUT_STATE };
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    getRolloutState: jest.fn().mockResolvedValue(state),
    markSchemaClientGenerationComplete: jest.fn().mockResolvedValue(state),
    markWriterManifestComplete: jest.fn().mockResolvedValue(state),
    markBlockingTestsPassed: jest.fn().mockResolvedValue(state),
    activateRequiredCapture: jest.fn().mockResolvedValue(state),
    recordAccCutover: jest.fn().mockResolvedValue(state),
    markReconciliationComplete: jest.fn().mockResolvedValue(state),
    markDocumentationComplete: jest.fn().mockResolvedValue(state),
    getCurrentCycle: jest.fn().mockResolvedValue(42),
    collectFinancialIntegrityIssues: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };

  const dependencies: FinancialRolloutCliDependencies = {
    config: { nodeEnv: 'acceptance', financialRolloutTarget: 'ACC' },
    getRolloutState: calls.getRolloutState,
    getMissingRolloutGates: () => [],
    markSchemaClientGenerationComplete: calls.markSchemaClientGenerationComplete,
    markWriterManifestComplete: calls.markWriterManifestComplete,
    markBlockingTestsPassed: calls.markBlockingTestsPassed,
    activateRequiredCapture: calls.activateRequiredCapture,
    recordAccCutover: calls.recordAccCutover,
    markReconciliationComplete: calls.markReconciliationComplete,
    markDocumentationComplete: calls.markDocumentationComplete,
    getCurrentCycle: calls.getCurrentCycle,
    collectFinancialIntegrityIssues: calls.collectFinancialIntegrityIssues,
    disconnect: calls.disconnect,
    writeStdout: (message: string): void => { stdout.push(message); },
    writeStderr: (message: string): void => { stderr.push(message); },
    ...overrides,
  };

  return { dependencies, calls, stdout, stderr };
}

describe('financial rollout CLI', () => {
  it('refuses non-ACC environments before it reads rollout state', async () => {
    const harness = createHarness({
      config: { nodeEnv: 'development', financialRolloutTarget: 'ACC' },
    });

    await expect(runFinancialRolloutCli(['status'], harness.dependencies)).resolves.toBe(1);

    expect(harness.calls.getRolloutState).not.toHaveBeenCalled();
    expect(harness.calls.getCurrentCycle).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).not.toHaveBeenCalled();
    expect(harness.stderr[0]).toContain('NODE_ENV=acceptance');
  });

  it('reports rollout status and current cycle without mutating state', async () => {
    const harness = createHarness();

    await expect(runFinancialRolloutCli(['status'], harness.dependencies)).resolves.toBe(0);

    expect(harness.calls.getRolloutState).toHaveBeenCalledTimes(1);
    expect(harness.calls.getCurrentCycle).toHaveBeenCalledTimes(1);
    expect(harness.calls.recordAccCutover).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).toHaveBeenCalledTimes(1);
    expect(JSON.parse(harness.stdout[0])).toMatchObject({ command: 'status', currentCycle: 42 });
  });

  it('requires the command-specific confirmation before activating capture', async () => {
    const harness = createHarness();

    await expect(runFinancialRolloutCli(['activate-required-capture'], harness.dependencies)).resolves.toBe(1);

    expect(harness.calls.activateRequiredCapture).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).not.toHaveBeenCalled();
  });

  it('rejects malformed cutover input before touching database dependencies', async () => {
    const harness = createHarness();

    await expect(
      runFinancialRolloutCli(['record-acc-cutover', '--cycle', '42'], harness.dependencies),
    ).resolves.toBe(1);

    expect(harness.calls.getCurrentCycle).not.toHaveBeenCalled();
    expect(harness.calls.recordAccCutover).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).not.toHaveBeenCalled();
  });

  it('dispatches only the confirmed activation transition', async () => {
    const harness = createHarness();

    await expect(
      runFinancialRolloutCli(
        ['activate-required-capture', '--confirm-required-capture'],
        harness.dependencies,
      ),
    ).resolves.toBe(0);

    expect(harness.calls.activateRequiredCapture).toHaveBeenCalledTimes(1);
    expect(harness.calls.recordAccCutover).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).toHaveBeenCalledTimes(1);
  });

  it('rejects a cutover cycle that is not the stored current cycle', async () => {
    const harness = createHarness();

    await expect(
      runFinancialRolloutCli(
        ['record-acc-cutover', '--cycle', '41', '--confirm-acc-cutover'],
        harness.dependencies,
      ),
    ).resolves.toBe(1);

    expect(harness.calls.recordAccCutover).not.toHaveBeenCalled();
    expect(harness.calls.disconnect).toHaveBeenCalledTimes(1);
  });

  it('records only a confirmed cutover matching the stored current cycle', async () => {
    const harness = createHarness();

    await expect(
      runFinancialRolloutCli(
        ['record-acc-cutover', '--cycle', '42', '--confirm-acc-cutover'],
        harness.dependencies,
      ),
    ).resolves.toBe(0);

    expect(harness.calls.recordAccCutover).toHaveBeenCalledWith(42);
  });

  it('does not mark reconciliation complete when diagnostics report issues', async () => {
    const postCutoverState: FinancialRolloutState = {
      ...DEFAULT_ROLLOUT_STATE,
      phase: 'acc_cutover',
      requiredCaptureActive: true,
      accCutoverRecorded: true,
      cutoverCycle: 41,
    };
    const issues = [{ issueType: 'unpaired_financial_ledger' }] as unknown as readonly FinancialIntegrityIssue[];
    const harness = createHarness({
      getRolloutState: jest.fn().mockResolvedValue(postCutoverState),
      collectFinancialIntegrityIssues: jest.fn().mockResolvedValue(issues),
    });

    await expect(
      runFinancialRolloutCli(
        ['mark-reconciliation', '--cycle', '41', '--confirm-reconciliation'],
        harness.dependencies,
      ),
    ).resolves.toBe(1);

    expect(harness.calls.markReconciliationComplete).not.toHaveBeenCalled();
  });

  it('marks reconciliation only after a completed post-cutover cycle has no issues', async () => {
    const postCutoverState: FinancialRolloutState = {
      ...DEFAULT_ROLLOUT_STATE,
      phase: 'acc_cutover',
      requiredCaptureActive: true,
      accCutoverRecorded: true,
      cutoverCycle: 41,
    };
    const completedState: FinancialRolloutState = {
      ...postCutoverState,
      phase: 'reconciliation',
      reconciliationPassed: true,
    };
    const markReconciliationComplete = jest.fn().mockResolvedValue(completedState);
    const harness = createHarness({
      getRolloutState: jest.fn().mockResolvedValue(postCutoverState),
      markReconciliationComplete,
    });

    await expect(
      runFinancialRolloutCli(
        ['mark-reconciliation', '--cycle', '41', '--confirm-reconciliation'],
        harness.dependencies,
      ),
    ).resolves.toBe(0);

    expect(markReconciliationComplete).toHaveBeenCalledTimes(1);
  });
});
