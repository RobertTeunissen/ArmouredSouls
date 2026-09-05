import prisma from '../src/lib/prisma';
import { withAuditSequence } from '../src/services/common/auditSequence';
import { applyCreditMutation } from '../src/services/financial/creditMutationService';
import { applyPrestigeAward } from '../src/services/financial/prestigeService';
import { settleCycle } from '../src/services/financial/settlementService';
import type { BattleIncomeBreakdown, PrestigeAwardBreakdown } from '../src/types';

function battleBreakdown(eventId: string, amount: number): BattleIncomeBreakdown {
  return {
    schemaVersion: 1,
    formula: 'battle.reward',
    formulaVersion: '1',
    inputs: [{ name: 'participationFloor', value: amount, unit: 'credits', source: 'battle' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'round', operationOrder: ['participationFloor'], scope: 'aggregate' },
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

function prestigeBreakdown(eventId: string, amount: number): PrestigeAwardBreakdown {
  return {
    schemaVersion: 1,
    formula: 'battle.prestige',
    formulaVersion: '1',
    inputs: [{ name: 'awardAmount', value: amount, unit: 'prestige', source: 'battle' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'none', operationOrder: ['awardAmount'], scope: 'aggregate' },
    sourceEventId: eventId,
    source: 'battle',
    awardAmount: amount,
    mode: 'league_1v1',
    battleId: 9001,
    achievementId: null,
  };
}

describe('Spec 53 financial pairing and identity integration', () => {
  let userId: number;
  let cycleNumber: number;
  let originalFeatureFlags: unknown;

  beforeAll(async () => {
    const metadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
      select: { featureFlags: true },
    });
    originalFeatureFlags = metadata?.featureFlags;
    cycleNumber = Math.floor(Date.now() / 1000);
    const featureFlags = (metadata?.featureFlags ?? {}) as Record<string, unknown>;
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      update: {
        featureFlags: {
          ...featureFlags,
          financial_rollout: {
            environment: 'ACC',
            phase: 'acc_cutover',
            schemaClientGenerated: true,
            writerManifestComplete: true,
            blockingTestsPassed: true,
            requiredCaptureActive: true,
            accCutoverRecorded: true,
            reconciliationPassed: false,
            documentationComplete: false,
            cutoverCycle: cycleNumber,
            cutoverRecordedAt: new Date().toISOString(),
            reconciledAt: null,
            documentedAt: null,
          },
        },
      },
      create: { id: 1, featureFlags: { financial_rollout: { environment: 'ACC', phase: 'acc_cutover', schemaClientGenerated: true, writerManifestComplete: true, blockingTestsPassed: true, requiredCaptureActive: true, accCutoverRecorded: true, reconciliationPassed: false, documentationComplete: false, cutoverCycle: cycleNumber, cutoverRecordedAt: new Date().toISOString(), reconciledAt: null, documentedAt: null } } },
    });
    const user = await prisma.user.create({
      data: {
        username: `spec53_${Date.now()}_${Math.floor(Math.random() * 10_000)}`,
        passwordHash: 'integration-test-hash',
        currency: 1_000,
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { cycleNumber } });
    await prisma.financialLedger.deleteMany({ where: { cycleNumber } });
    if (userId !== undefined) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { featureFlags: (originalFeatureFlags ?? {}) as never },
    });
  });

  it('should commit one balance delta, one ledger row, and one paired financial audit row', async () => {
    const financialEventId = `spec53:pair:${userId}:${cycleNumber}`;
    const input = {
      cycleNumber,
      userId,
      amount: 100,
      description: 'Spec 53 integration battle reward',
      financialEventId,
      transactionType: 'battle_income' as const,
      breakdown: battleBreakdown(financialEventId, 100),
    };

    const result = await applyCreditMutation(input);
    const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
    const audits = await prisma.auditLog.findMany({
      where: { eventType: 'financial_transaction', financialEventId },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });

    expect(result).toMatchObject({ created: true, balanceBefore: 1_000, balanceAfter: 1_100 });
    expect(ledger).toMatchObject({
      userId,
      amount: 100,
      balanceAfter: 1_100,
      financialEventId,
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].payload).toMatchObject({ financialEventId, amount: 100, balanceAfter: 1_100 });
    expect(audits[0].financialEventId).toBe(financialEventId);
    expect(user?.currency).toBe(1_100);
  });

  it('should suppress identical retries and reject conflicting identity reuse', async () => {
    const financialEventId = `spec53:retry:${userId}:${cycleNumber}`;
    const input = {
      cycleNumber,
      userId,
      amount: 25,
      description: 'Spec 53 integration retry reward',
      financialEventId,
      transactionType: 'battle_income' as const,
      breakdown: battleBreakdown(financialEventId, 25),
    };

    const first = await applyCreditMutation(input);
    const retry = await applyCreditMutation(input);
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);

    const conflictingAmount = 50;
    await expect(applyCreditMutation({
      ...input,
      amount: conflictingAmount,
      breakdown: battleBreakdown(financialEventId, conflictingAmount),
    })).rejects.toMatchObject({ code: 'FINANCIAL_EVENT_CONFLICT' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
    const ledgerRows = await prisma.financialLedger.count({ where: { financialEventId } });
    expect(user?.currency).toBe(1_125);
    expect(ledgerRows).toBe(1);
  });

  it('should roll back the balance and ledger when the paired audit insert conflicts', async () => {
    const financialEventId = `spec53:rollback:${userId}:${cycleNumber}`;
    await withAuditSequence(cycleNumber, 1, async (sequence, tx) => {
      await tx.auditLog.create({
        data: {
          cycleNumber,
          eventType: 'financial_transaction',
          eventTimestamp: new Date(),
          sequenceNumber: sequence,
          userId,
          payload: { financialEventId, preexisting: true },
          financialEventId,
        },
      });
    });

    await expect(applyCreditMutation({
      cycleNumber,
      userId,
      amount: 75,
      description: 'Should roll back',
      financialEventId,
      transactionType: 'battle_income',
      breakdown: battleBreakdown(financialEventId, 75),
    })).rejects.toBeDefined();

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
    const ledger = await prisma.financialLedger.findUnique({ where: { financialEventId } });
    expect(user?.currency).toBe(1_125);
    expect(ledger).toBeNull();
  });

  it('should record prestige separately with source identity and no financial ledger row', async () => {
    const sourceEventId = `spec53:prestige:${userId}:${cycleNumber}`;
    const result = await applyPrestigeAward({
      cycleNumber,
      userId,
      amount: 15,
      source: 'battle',
      sourceEventId,
      mode: 'league_1v1',
      battleId: 9001,
      breakdown: prestigeBreakdown(sourceEventId, 15),
    });

    const audit = await prisma.auditLog.findFirst({ where: { eventType: 'prestige_change', sourceEventId } });
    const ledger = await prisma.financialLedger.findFirst({ where: { userId, cycleNumber, transactionType: 'prestige_award' } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { prestige: true } });

    expect(result).toMatchObject({ created: true, prestigeBefore: 0, prestigeAfter: 15 });
    expect(audit?.payload).toMatchObject({ sourceEventId, amount: 15, resultingPrestige: 15 });
    expect(user?.prestige).toBe(15);
    expect(ledger).toBeNull();
  });

  it('should persist zero-valued settlement component pairs without changing balance', async () => {
    const result = await settleCycle({ cycleNumber, userIds: [userId] });
    const events = await prisma.financialLedger.findMany({
      where: {
        userId,
        cycleNumber,
        transactionType: { in: ['passive_income', 'operating_costs'] },
      },
      orderBy: { transactionType: 'asc' },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });

    expect(result.components[0].passiveIncome.amount).toBe(0);
    expect(result.components[0].operatingCosts.amount).toBe(0);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.amount === 0 && event.balanceAfter === 1_125)).toBe(true);
    expect(user?.currency).toBe(1_125);
  });
});
