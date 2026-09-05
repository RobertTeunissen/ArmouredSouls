import type { Prisma } from '../generated/prisma';
import prisma from '../src/lib/prisma';

interface FinancialRolloutFixture {
  restore(): Promise<void>;
}

const POST_CUTOVER_ROLLOUT = {
  environment: 'ACC',
  phase: 'acc_cutover',
  schemaClientGenerated: true,
  writerManifestComplete: true,
  blockingTestsPassed: true,
  requiredCaptureActive: true,
  accCutoverRecorded: true,
  reconciliationPassed: false,
  documentationComplete: false,
  cutoverCycle: 0,
  cutoverRecordedAt: '2026-09-04T00:00:00.000Z',
  reconciledAt: null,
  documentedAt: null,
} as const;

/**
 * Temporarily installs a fully gated post-cutover state for HTTP integration
 * suites that exercise current-economy mutations. The production default stays
 * pre-cutover and fail-closed; every suite restores the exact prior flags.
 */
export async function installPostCutoverFinancialRollout(): Promise<FinancialRolloutFixture> {
  const metadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
    select: { featureFlags: true },
  });
  const originalFeatureFlags = (metadata?.featureFlags ?? {}) as Prisma.InputJsonValue;
  const featureFlags = originalFeatureFlags as unknown as Record<string, unknown>;
  const updatedFeatureFlags = {
    ...featureFlags,
    financial_rollout: POST_CUTOVER_ROLLOUT,
  } as Prisma.InputJsonValue;

  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: { featureFlags: updatedFeatureFlags },
    create: { id: 1, featureFlags: updatedFeatureFlags },
  });

  return {
    async restore(): Promise<void> {
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: { featureFlags: originalFeatureFlags },
        create: { id: 1, featureFlags: originalFeatureFlags },
      });
    },
  };
}
/** Register a scoped post-cutover fixture for a route integration test file. */
export function usePostCutoverFinancialRollout(): void {
  let fixture: FinancialRolloutFixture | undefined;

  beforeAll(async () => {
    fixture = await installPostCutoverFinancialRollout();
  });

  afterAll(async () => {
    await fixture?.restore();
  });
}
