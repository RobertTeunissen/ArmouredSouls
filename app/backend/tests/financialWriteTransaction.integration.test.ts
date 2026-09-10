import { Prisma } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import {
  abortSerializedCycleCutover,
  beginSerializedCycleCutover,
  completeSerializedCycleCutover,
} from '../src/services/cycle/canonicalCycleIdentity';
import { runFinancialWriteTransaction } from '../src/services/cycle/financialWriteTransaction';
import { applyCreditMutationInTransaction } from '../src/services/financial/creditMutationService';
import type { BattleIncomeBreakdown } from '../src/types';

interface CycleMetadataSnapshot {
  totalCycles: number;
  lastCycleAt: Date | null;
  featureFlags: Prisma.JsonValue;
}

function battleBreakdown(eventId: string, amount: number): BattleIncomeBreakdown {
  return {
    schemaVersion: 1,
    formula: 'battle.reward',
    formulaVersion: '1',
    inputs: [{ name: 'participationFloor', value: amount, unit: 'credits', source: 'battle' }],
    modifiers: [],
    rounding: {
      precision: 0,
      mode: 'round',
      operationOrder: ['participationFloor'],
      scope: 'aggregate',
    },
    finalAmount: amount,
    sourceEventId: eventId,
    transactionType: 'battle_income',
    mode: 'league_1v1',
    tier: 1,
    outcome: 'win',
    placement: null,
    participationFloor: amount,
    winComponent: 0,
    teamSize: 1,
    stableAggregation: 'stable',
    isBye: false,
  };
}

function asFlags(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

describe('financial write transaction cutover integration', () => {
  let userId: number;
  let metadataSnapshot: CycleMetadataSnapshot;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        username: `financial_cutover_${Date.now()}_${Math.floor(Math.random() * 10_000)}`,
        passwordHash: 'integration-test-hash',
        currency: 1_000,
      },
      select: { id: true },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    const metadata = await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      create: { id: 1, totalCycles: 0 },
      update: {},
      select: { totalCycles: true, lastCycleAt: true, featureFlags: true },
    });
    metadataSnapshot = metadata;
    await prisma.user.update({ where: { id: userId }, data: { currency: 1_000 } });
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.financialLedger.deleteMany({ where: { userId } });
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: {
        totalCycles: metadataSnapshot.totalCycles,
        lastCycleAt: metadataSnapshot.lastCycleAt,
        featureFlags: metadataSnapshot.featureFlags as Prisma.InputJsonValue,
      },
    });
  });

  afterAll(async () => {
    if (userId !== undefined) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.financialLedger.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it.each([
    { transition: 'complete' as const, expectedCycleOffset: 1 },
    { transition: 'abort' as const, expectedCycleOffset: 0 },
  ])('should resume exactly once under the correct cycle after cutover $transition', async ({
    transition,
    expectedCycleOffset,
  }) => {
    const closingCycle = await beginSerializedCycleCutover();
    const expectedCycle = closingCycle + expectedCycleOffset;
    const financialEventId = `financial-cutover:${transition}:${userId}:${closingCycle}`;
    const amount = transition === 'complete' ? 101 : 102;
    let operationCalls = 0;
    let delayCalls = 0;

    const result = await runFinancialWriteTransaction(
      async (tx, financialCycleNumber) => {
        operationCalls += 1;
        expect(financialCycleNumber).toBe(expectedCycle);
        return applyCreditMutationInTransaction(tx, {
          cycleNumber: financialCycleNumber,
          userId,
          amount,
          description: `Cutover ${transition} integration reward`,
          financialEventId,
          transactionType: 'battle_income',
          breakdown: battleBreakdown(financialEventId, amount),
        });
      },
      { timeout: 30_000 },
      {
        maxAttempts: 2,
        delayMs: 0,
        delay: async () => {
          delayCalls += 1;
          expect(operationCalls).toBe(0);
          if (transition === 'complete') {
            await completeSerializedCycleCutover(closingCycle);
          } else {
            await abortSerializedCycleCutover(closingCycle);
          }
        },
      },
    );

    const [user, ledgerRows, auditRows, metadata] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
      prisma.financialLedger.findMany({ where: { financialEventId } }),
      prisma.auditLog.findMany({
        where: { eventType: 'financial_transaction', financialEventId },
      }),
      prisma.cycleMetadata.findUniqueOrThrow({
        where: { id: 1 },
        select: { totalCycles: true, featureFlags: true },
      }),
    ]);

    expect(delayCalls).toBe(1);
    expect(operationCalls).toBe(1);
    expect(result).toMatchObject({
      created: true,
      cycleNumber: expectedCycle,
      balanceBefore: 1_000,
      balanceAfter: 1_000 + amount,
    });
    expect(user?.currency).toBe(1_000 + amount);
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]).toMatchObject({
      cycleNumber: expectedCycle,
      userId,
      amount,
      balanceAfter: 1_000 + amount,
      financialEventId,
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      cycleNumber: expectedCycle,
      userId,
      financialEventId,
    });
    expect(auditRows[0].payload).toMatchObject({
      financialEventId,
      amount,
      balanceAfter: 1_000 + amount,
    });
    expect(metadata.totalCycles).toBe(
      transition === 'complete' ? closingCycle : metadataSnapshot.totalCycles,
    );
    expect(asFlags(metadata.featureFlags)).not.toHaveProperty('finance_cycle_closing');
    expect(asFlags(metadata.featureFlags)).not.toHaveProperty('finance_cycle_closing_number');
  });
});
