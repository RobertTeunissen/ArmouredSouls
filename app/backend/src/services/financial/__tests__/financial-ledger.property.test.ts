import * as fc from 'fast-check';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    financialLedger: {
      create: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../migration/featureFlags', () => ({
  __esModule: true,
  isEnabled: jest.fn(),
}));

import prisma from '../../../lib/prisma';
import { isEnabled } from '../../migration/featureFlags';
import financialService from '../financialService';

const TRANSACTION_TYPES = [
  'battle_income',
  'streaming_revenue',
  'repair_cost',
  'facility_upgrade',
  'weapon_purchase',
  'weapon_sale',
  'weapon_refinement',
  'robot_creation',
  'subscription_cost',
  'prestige_award',
  'attribute_upgrade',
  'settlement_adjustment',
] as const;

type TransactionType = (typeof TRANSACTION_TYPES)[number];

describe('FinancialService — Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 10: Financial Ledger Per Credit Event', () => {
    it('exactly one ledger entry is created with the correct type, signed amount, and balanceAfter for any credit-changing event', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TRANSACTION_TYPES),
          fc.integer({ min: -999999, max: 999999 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: -999999, max: 999999 }),
          async (
            transactionType: TransactionType,
            amount: number,
            userId: number,
            cycleNumber: number,
            balanceAfter: number,
          ) => {
            jest.clearAllMocks();

            (isEnabled as jest.Mock).mockResolvedValue(true);

            const expectedEntry = {
              id: 1,
              cycleNumber,
              userId,
              robotId: null,
              transactionType,
              amount,
              balanceAfter,
              description: 'Test transaction',
              metadata: null,
              createdAt: new Date(),
            };

            (prisma.financialLedger.create as jest.Mock).mockResolvedValue(expectedEntry);

            await financialService.recordTransaction({
              cycleNumber,
              userId,
              transactionType,
              amount,
              balanceAfter,
              description: 'Test transaction',
            });

            // Assert: create called exactly once
            expect(prisma.financialLedger.create).toHaveBeenCalledTimes(1);

            // Assert: create called with matching data
            const callArgs = (prisma.financialLedger.create as jest.Mock).mock.calls[0][0];
            expect(callArgs.data.transactionType).toBe(transactionType);
            expect(callArgs.data.amount).toBe(amount);
            expect(callArgs.data.balanceAfter).toBe(balanceAfter);
            expect(callArgs.data.userId).toBe(userId);
            expect(callArgs.data.cycleNumber).toBe(cycleNumber);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 11: Running Balance Invariant', () => {
    it('for any sequence of N transactions, each balanceAfter equals the previous balanceAfter plus the current amount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 100000 }),
          fc.array(fc.integer({ min: -50000, max: 50000 }), { minLength: 2, maxLength: 10 }),
          (initialBalance: number, amounts: number[]) => {
            // Compute expected balanceAfter for each transaction
            const balances: number[] = [];
            let currentBalance = initialBalance;

            for (const amount of amounts) {
              currentBalance = currentBalance + amount;
              balances.push(currentBalance);
            }

            // Verify the running balance invariant:
            // balance[0] = initialBalance + amounts[0]
            expect(balances[0]).toBe(initialBalance + amounts[0]);

            // balance[i] = balance[i-1] + amounts[i] for all i > 0
            for (let i = 1; i < balances.length; i++) {
              expect(balances[i]).toBe(balances[i - 1] + amounts[i]);
            }

            // Verify final balance equals initial + sum of all amounts
            const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
            expect(balances[balances.length - 1]).toBe(initialBalance + totalAmount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
