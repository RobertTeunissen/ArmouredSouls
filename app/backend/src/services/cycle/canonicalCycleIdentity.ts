import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';

const FINANCE_CYCLE_LOCK_NAMESPACE = 4;
const FINANCE_CYCLE_LOCK_KEY = 1;
const CLOSING_FLAG = 'finance_cycle_closing';
const CLOSING_CYCLE_FLAG = 'finance_cycle_closing_number';
const CLOSING_USER_WATERMARK_FLAG = 'finance_cycle_closing_user_watermark';

interface CycleClient {
  cycleMetadata: Prisma.TransactionClient['cycleMetadata'];
  season: Prisma.TransactionClient['season'];
}

interface FeatureFlagRecord {
  [key: string]: unknown;
}

export interface CanonicalCycleIdentity {
  completedCycles: number;
  activeCycle: number;
  seasonNumber: number;
  phase: 'preparation' | 'competitive';
  competitiveCyclesCompleted: number;
  preparationCyclesCompleted: number;
  seasonStartedAt: Date;
  isClosing: boolean;
  closingCycle: number | null;
}

export class FinancialCycleCutoverInProgressError extends Error {
  constructor(public readonly closingCycle: number) {
    super(`Financial cycle ${closingCycle} is closing; retry against the next active cycle`);
    this.name = 'FinancialCycleCutoverInProgressError';
  }
}

function asFlags(value: unknown): FeatureFlagRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as FeatureFlagRecord
    : {};
}

async function ensureMetadata(client: CycleClient): Promise<{
  totalCycles: number;
  featureFlags: unknown;
}> {
  const existing = await client.cycleMetadata.findUnique({
    where: { id: 1 },
    select: { totalCycles: true, featureFlags: true },
  });
  if (existing) return existing;
  return client.cycleMetadata.create({
    data: { id: 1, totalCycles: 0 },
    select: { totalCycles: true, featureFlags: true },
  });
}

/** Resolve the one active-season financial identity. */
export async function resolveCanonicalCycleIdentity(
  client: CycleClient = prisma,
): Promise<CanonicalCycleIdentity> {
  const [metadata, season] = await Promise.all([
    ensureMetadata(client),
    client.season.findFirst({
      where: { phase: { not: 'completed' } },
      orderBy: { seasonNumber: 'desc' },
      select: {
        seasonNumber: true,
        phase: true,
        competitiveCyclesCompleted: true,
        preparationCyclesCompleted: true,
        startedAt: true,
      },
    }),
  ]);
  const flags = asFlags(metadata.featureFlags);
  const closingCycleValue = flags[CLOSING_CYCLE_FLAG];
  const closingCycle = Number.isInteger(closingCycleValue) ? Number(closingCycleValue) : null;
  const phase = season?.phase === 'preparation' ? 'preparation' : 'competitive';
  return {
    completedCycles: metadata.totalCycles,
    activeCycle: metadata.totalCycles + 1,
    seasonNumber: season?.seasonNumber ?? 0,
    phase,
    competitiveCyclesCompleted: season?.competitiveCyclesCompleted ?? metadata.totalCycles,
    preparationCyclesCompleted: season?.preparationCyclesCompleted ?? 0,
    seasonStartedAt: season?.startedAt ?? new Date(0),
    isClosing: flags[CLOSING_FLAG] === true,
    closingCycle,
  };
}

export async function getActiveFinancialCycleNumber(): Promise<number> {
  return (await resolveCanonicalCycleIdentity()).activeCycle;
}

/**
 * Join the writer side of Serialized_Cycle_Cutover and resolve the cycle inside
 * the same transaction that writes money. Settlement may explicitly target the
 * already-claimed closing cycle; every other writer fails closed while closing.
 */
export async function resolveFinancialWriteCycle(
  tx: Prisma.TransactionClient,
  options: { allowClosingCycle?: boolean } = {},
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${FINANCE_CYCLE_LOCK_NAMESPACE}, ${FINANCE_CYCLE_LOCK_KEY})`;
  const identity = await resolveCanonicalCycleIdentity(tx);
  if (identity.isClosing) {
    if (options.allowClosingCycle && identity.closingCycle !== null) return identity.closingCycle;
    throw new FinancialCycleCutoverInProgressError(identity.closingCycle ?? identity.activeCycle);
  }
  return identity.activeCycle;
}

/** Claim the active cycle after all in-flight financial writers have committed. */
export async function beginSerializedCycleCutover(
  options: { resumeExisting?: boolean } = {},
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FINANCE_CYCLE_LOCK_NAMESPACE}, ${FINANCE_CYCLE_LOCK_KEY})`;
    const metadata = await ensureMetadata(tx);
    const flags = asFlags(metadata.featureFlags);
    if (flags[CLOSING_FLAG] === true) {
      const existing = flags[CLOSING_CYCLE_FLAG];
      if (!Number.isInteger(existing)) {
        throw new Error('Financial cycle cutover marker is malformed');
      }
      if (options.resumeExisting !== true) {
        throw new FinancialCycleCutoverInProgressError(Number(existing));
      }

      // Upgrade a pre-watermark marker once, under the same exclusive lock.
      // New registrations after this point remain outside the closing cohort.
      if (!Number.isInteger(flags[CLOSING_USER_WATERMARK_FLAG])) {
        const lastUser = await tx.user.findFirst({
          select: { id: true },
          orderBy: { id: 'desc' },
        });
        await tx.cycleMetadata.update({
          where: { id: 1 },
          data: {
            featureFlags: {
              ...flags,
              [CLOSING_USER_WATERMARK_FLAG]: lastUser?.id ?? 0,
            } as Prisma.InputJsonValue,
          },
        });
      }
      return Number(existing);
    }

    const closingCycle = metadata.totalCycles + 1;
    const lastUser = await tx.user.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' },
    });
    await tx.cycleMetadata.update({
      where: { id: 1 },
      data: {
        featureFlags: {
          ...flags,
          [CLOSING_FLAG]: true,
          [CLOSING_CYCLE_FLAG]: closingCycle,
          [CLOSING_USER_WATERMARK_FLAG]: lastUser?.id ?? 0,
        } as Prisma.InputJsonValue,
      },
    });
    return closingCycle;
  });
}

/** Read the immutable stable cohort captured with the durable close marker. */
export async function getSerializedCycleCutoverUserIdWatermark(
  closingCycle: number,
): Promise<number | null> {
  const metadata = await ensureMetadata(prisma);
  const flags = asFlags(metadata.featureFlags);
  if (flags[CLOSING_FLAG] !== true || flags[CLOSING_CYCLE_FLAG] !== closingCycle) {
    throw new Error(`Financial cycle ${closingCycle} is not the claimed closing cycle`);
  }
  const storedWatermark = flags[CLOSING_USER_WATERMARK_FLAG];
  if (!Number.isInteger(storedWatermark) || Number(storedWatermark) < 0) {
    throw new Error(`Financial cycle ${closingCycle} has a malformed user watermark`);
  }
  const watermark = Number(storedWatermark);
  return watermark === 0 ? null : watermark;
}

/** Advance completed count last and reopen the writer side for the next cycle. */
export async function completeSerializedCycleCutover(
  closingCycle: number,
  completedAt = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FINANCE_CYCLE_LOCK_NAMESPACE}, ${FINANCE_CYCLE_LOCK_KEY})`;
    const metadata = await ensureMetadata(tx);
    const flags = asFlags(metadata.featureFlags);
    if (flags[CLOSING_FLAG] !== true || flags[CLOSING_CYCLE_FLAG] !== closingCycle) {
      throw new Error(`Financial cycle ${closingCycle} is not the claimed closing cycle`);
    }
    const {
      [CLOSING_FLAG]: _closing,
      [CLOSING_CYCLE_FLAG]: _cycle,
      [CLOSING_USER_WATERMARK_FLAG]: _watermark,
      ...remainingFlags
    } = flags;
    await tx.cycleMetadata.update({
      where: { id: 1 },
      data: {
        totalCycles: closingCycle,
        lastCycleAt: completedAt,
        featureFlags: remainingFlags as Prisma.InputJsonValue,
      },
    });
  });
}

export async function abortSerializedCycleCutover(closingCycle: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FINANCE_CYCLE_LOCK_NAMESPACE}, ${FINANCE_CYCLE_LOCK_KEY})`;
    const metadata = await ensureMetadata(tx);
    const flags = asFlags(metadata.featureFlags);
    if (flags[CLOSING_FLAG] !== true || flags[CLOSING_CYCLE_FLAG] !== closingCycle) return;
    const {
      [CLOSING_FLAG]: _closing,
      [CLOSING_CYCLE_FLAG]: _cycle,
      [CLOSING_USER_WATERMARK_FLAG]: _watermark,
      ...remainingFlags
    } = flags;
    await tx.cycleMetadata.update({
      where: { id: 1 },
      data: { featureFlags: remainingFlags as Prisma.InputJsonValue },
    });
  });
}
