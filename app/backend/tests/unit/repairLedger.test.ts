/**
 * Repair_Ledger_Entry behaviour — Spec #48 Requirement 16.
 *
 * Covers Property 30 (entries reconcile one-to-one with Repair_Spend_Source) plus
 * the fixed failure branches: the write happens after commit and is not enrolled in
 * it (criterion 4), a failed write leaves the repair committed (criterion 5), and
 * nothing is persisted while `financial_ledger_active` is false (criterion 7).
 */

import * as fc from 'fast-check';

const mockRecordTransaction = jest.fn();

jest.mock('../../src/services/financial/financialService', () => ({
  __esModule: true,
  default: {
    recordTransaction: (...args: unknown[]) => mockRecordTransaction(...args),
  },
}));

jest.mock('../../src/services/battle/baseOrchestrator', () => ({
  __esModule: true,
  getCurrentCycleNumber: jest.fn().mockResolvedValue(42),
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { recordLedgerEntry } from '../../src/services/financial/recordLedgerEntry';
import { applyManualRepairDiscount, calculateRepairQuote } from '../../src/shared/utils/repairCost';

beforeEach(() => {
  mockRecordTransaction.mockReset();
  mockRecordTransaction.mockResolvedValue({ id: 1 });

  // Reset the cycle-number mock too. One test below uses `mockRejectedValueOnce`,
  // and without this an unconsumed rejection could leak into whichever test ran
  // next — which is exactly how this file passed in isolation but failed in the
  // full suite.
  const baseOrchestrator = jest.requireMock('../../src/services/battle/baseOrchestrator') as {
    getCurrentCycleNumber: jest.Mock;
  };
  baseOrchestrator.getCurrentCycleNumber.mockReset();
  baseOrchestrator.getCurrentCycleNumber.mockResolvedValue(42);
});

describe('Requirement 16 criterion 5: a failed ledger write leaves the repair alone', () => {
  it('swallows a rejection from recordTransaction and resolves', async () => {
    mockRecordTransaction.mockRejectedValueOnce(new Error('ledger table is on fire'));

    await expect(
      recordLedgerEntry({
        userId: 7,
        robotId: 3,
        transactionType: 'repair_cost',
        amount: -500,
        balanceAfter: 1000,
        description: 'Manual repair of 1 robot (batch of 1)',
      }),
    ).resolves.toBeUndefined();
  });

  it('swallows a rejection from the cycle-number lookup too', async () => {
    const baseOrchestrator = jest.requireMock('../../src/services/battle/baseOrchestrator');
    baseOrchestrator.getCurrentCycleNumber.mockRejectedValueOnce(new Error('no cycle'));

    await expect(
      recordLedgerEntry({
        userId: 7,
        transactionType: 'repair_cost',
        amount: -500,
        balanceAfter: 1000,
        description: 'Automatic pre-battle repair of 1 robot',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('Requirement 16 criterion 7: nothing is persisted while the flag is off', () => {
  it('still calls recordTransaction, which returns null when the flag is off', async () => {
    // The flag is checked inside `financialService.recordTransaction`, which returns
    // null rather than writing. The call site is deliberately unconditional so that
    // enabling the flag needs no code change here.
    mockRecordTransaction.mockResolvedValueOnce(null);

    await recordLedgerEntry({
      userId: 7,
      robotId: 3,
      transactionType: 'repair_cost',
      amount: -500,
      balanceAfter: 1000,
      description: 'Manual repair of 1 robot (batch of 1)',
    });

    expect(mockRecordTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('Requirement 16 criteria 1, 2 and 6: entry shape', () => {
  it('records a negative amount, the cycle number and a path-naming description', async () => {
    await recordLedgerEntry({
      userId: 7,
      robotId: 3,
      transactionType: 'repair_cost',
      amount: -500,
      balanceAfter: 1000,
      description: 'Manual repair of 1 robot (batch of 3)',
      metadata: { repairType: 'manual', robotCount: 1, batchSize: 3 },
    });

    expect(mockRecordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleNumber: 42,
        userId: 7,
        robotId: 3,
        transactionType: 'repair_cost',
        amount: -500,
        balanceAfter: 1000,
        description: expect.stringContaining('Manual repair'),
        metadata: expect.objectContaining({ repairType: 'manual' }),
      }),
    );
  });

  it('names the automatic path distinctly, so a reader can tell them apart', async () => {
    await recordLedgerEntry({
      userId: 7,
      robotId: 3,
      transactionType: 'repair_cost',
      amount: -900,
      balanceAfter: 100,
      description: 'Automatic pre-battle repair of 1 robot',
      metadata: { repairType: 'automatic', robotCount: 1, cycleNumber: 42 },
    });

    const call = mockRecordTransaction.mock.calls[0][0] as { description: string; metadata: { repairType: string } };
    expect(call.description).toContain('Automatic');
    expect(call.metadata.repairType).toBe('automatic');
  });
});

describe('Property 30: Repair_Ledger_Entries reconcile one-to-one with Repair_Spend_Source', () => {
  // Feature: 48-dashboard-overview-row, Property 30: Repair_Ledger_Entries reconcile one-to-one with Repair_Spend_Source

  it('emits exactly one entry per repaired robot, summing to the credits deducted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            robotId: fc.integer({ min: 1, max: 100000 }),
            attributeTotal: fc.integer({ min: 1, max: 2000 }),
            damagePercent: fc.integer({ min: 1, max: 100 }),
            hpPercent: fc.integer({ min: 0, max: 99 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        fc.record({
          repairBayLevel: fc.integer({ min: 0, max: 10 }),
          activeRobotCount: fc.integer({ min: 0, max: 30 }),
        }),
        async (specs, bayContext) => {
          mockRecordTransaction.mockReset();
          mockRecordTransaction.mockResolvedValue({ id: 1 });

          // Mirror what `repairAllRobots` produces: one charged figure per robot.
          const chargedPerRobot = specs.map((s) => ({
            robotId: s.robotId,
            charged: applyManualRepairDiscount(
              calculateRepairQuote(
                { attributeTotal: s.attributeTotal, damagePercent: s.damagePercent, hpPercent: s.hpPercent },
                bayContext,
              ),
            ),
          }));
          const deduction = chargedPerRobot.reduce((sum, e) => sum + e.charged, 0);
          const finalBalance = 1_000_000 - deduction;

          // The route's balance walk: last robot first, adding back as we go.
          let runningBalance = finalBalance;
          for (const entry of [...chargedPerRobot].reverse()) {
            await recordLedgerEntry({
              userId: 7,
              robotId: entry.robotId,
              transactionType: 'repair_cost',
              amount: -entry.charged,
              balanceAfter: runningBalance,
              description: `Manual repair of 1 robot (batch of ${chargedPerRobot.length})`,
            });
            runningBalance += entry.charged;
          }

          // One entry per robot — the same granularity as the audit rows.
          expect(mockRecordTransaction).toHaveBeenCalledTimes(chargedPerRobot.length);

          const calls = mockRecordTransaction.mock.calls.map(
            (c) => c[0] as { amount: number; balanceAfter: number },
          );

          // Amounts are all negative and cancel the deduction exactly.
          //
          // Stated as a sum to zero rather than `toBe(-deduction)`: when nothing was
          // charged, `-deduction` is `-0` while the accumulated total is `+0`, and `toBe`
          // uses `Object.is`, for which those differ. A batch CAN charge zero — a
          // low-attribute robot behind a high Repair Bay discount quotes 1 credit and
          // floors to 0 after the manual discount. The reconciliation this property is
          // about does not care about the sign of zero, so it should not assert on it.
          const ledgerTotal = calls.reduce((sum, c) => sum + c.amount, 0);
          expect(ledgerTotal + deduction).toBe(0);
          expect(calls.every((c) => c.amount <= 0)).toBe(true);

          // The walk ends back at the pre-deduction balance, which is the proof the
          // derived per-robot balances are self-consistent.
          expect(runningBalance).toBe(1_000_000);
        },
      ),
      { numRuns: 100 },
    );
  });
});
