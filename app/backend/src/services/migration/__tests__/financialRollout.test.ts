const mockPrisma = {
  cycleMetadata: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../directWriterCoverage', () => ({
  checkDirectWriterCoverage: jest.fn(() => ({ discovered: [], uncovered: [] })),
}));

import {
  DEFAULT_ROLLOUT_STATE,
  activateRequiredCapture,
  assertPairedCaptureForCycle,
  classifyCycle,
  getFinancialRolloutState,
  getMissingRolloutGates,
  markBlockingTestsPassed,
  markDocumentationComplete,
  markReconciliationComplete,
  markSchemaClientGenerationComplete,
  markWriterManifestComplete,
  recordAccCutover,
} from '../financialRollout';
import { FinancialErrorCode } from '../../../errors';

let featureFlags: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  featureFlags = {};
  mockPrisma.cycleMetadata.findUnique.mockImplementation(async () => ({ featureFlags }));
  mockPrisma.cycleMetadata.upsert.mockImplementation(async (args: {
    create?: { featureFlags?: Record<string, unknown> };
    update?: { featureFlags?: Record<string, unknown> };
  }) => {
    featureFlags = (args.update?.featureFlags ?? args.create?.featureFlags ?? {}) as Record<string, unknown>;
    return { featureFlags };
  });
});

describe('Financial ACC rollout authority', () => {
  it('uses an explicit pre-cutover state and excludes it from completeness claims', async () => {
    const state = await getFinancialRolloutState();

    expect(state).toEqual(DEFAULT_ROLLOUT_STATE);
    expect(classifyCycle(10, state)).toBe('pre_cutover');
    expect(getMissingRolloutGates(state)).toEqual([
      'schemaClientGenerated',
      'writerManifestComplete',
      'blockingTestsPassed',
      'requiredCaptureActive',
      'accCutoverRecorded',
      'reconciliationPassed',
      'documentationComplete',
    ]);
  });

  it('blocks cutover until schema, manifest, blocking-test, and activation gates pass', async () => {
    await expect(recordAccCutover(12)).rejects.toMatchObject({
      code: FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
    });

    await markSchemaClientGenerationComplete();
    await markWriterManifestComplete();
    await markBlockingTestsPassed();
    await activateRequiredCapture();
    const cutover = await recordAccCutover(12);

    expect(cutover.phase).toBe('acc_cutover');
    expect(cutover.cutoverCycle).toBe(12);
    expect(cutover.accCutoverRecorded).toBe(true);
    expect(classifyCycle(11, cutover)).toBe('pre_cutover');
    expect(classifyCycle(12, cutover)).toBe('post_cutover');
  });

  it('rejects paired capture until cutover and permits it from the selected cycle onward', async () => {
    await expect(assertPairedCaptureForCycle(11)).rejects.toMatchObject({
      code: FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
    });

    await markSchemaClientGenerationComplete();
    await markWriterManifestComplete();
    await markBlockingTestsPassed();
    await activateRequiredCapture();
    await recordAccCutover(12);

    await expect(assertPairedCaptureForCycle(11)).rejects.toMatchObject({
      code: FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
    });
    await expect(assertPairedCaptureForCycle(12)).resolves.toMatchObject({
      cutoverCycle: 12,
      requiredCaptureActive: true,
    });
  });

  it('keeps the selected Cutover_Cycle immutable and requires reconciliation before documentation', async () => {
    await markSchemaClientGenerationComplete();
    await markWriterManifestComplete();
    await markBlockingTestsPassed();
    await activateRequiredCapture();
    await recordAccCutover(12);

    await expect(recordAccCutover(13)).rejects.toMatchObject({
      code: FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
    });
    await expect(markDocumentationComplete()).rejects.toMatchObject({
      code: FinancialErrorCode.ROLLOUT_PHASE_BLOCKED,
    });

    await markReconciliationComplete();
    const documented = await markDocumentationComplete();
    expect(documented.phase).toBe('documentation');
    expect(documented.documentationComplete).toBe(true);
  });

  it('rejects malformed persisted rollout state instead of falling back to legacy capture', async () => {
    featureFlags = { financial_rollout: { phase: 'acc_cutover' } };

    await expect(getFinancialRolloutState()).rejects.toMatchObject({
      code: FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
    });
  });
});
