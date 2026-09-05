import * as fc from 'fast-check';
import {
  LEGACY_TRANSACTION_TYPES,
  TRANSACTION_TYPES,
  isTransactionType,
} from '../../../types';
import { canonicalizeFinancialFacts } from '../creditMutationService';

describe('Financial contract property tests', () => {
  it('should accept exactly the current writer taxonomy and reject legacy-only labels', () => {
    for (const transactionType of TRANSACTION_TYPES) {
      expect(isTransactionType(transactionType)).toBe(true);
    }
    for (const legacyType of LEGACY_TRANSACTION_TYPES) {
      expect(isTransactionType(legacyType)).toBe(false);
    }
  });

  it('should preserve the running balance invariant for arbitrary signed mutations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.array(fc.integer({ min: -50_000, max: 50_000 }), { minLength: 1, maxLength: 20 }),
        (initialBalance, amounts) => {
          let balance = initialBalance;
          const balances = amounts.map((amount) => {
            balance += amount;
            return balance;
          });

          expect(balances[0]).toBe(initialBalance + amounts[0]);
          for (let index = 1; index < balances.length; index += 1) {
            expect(balances[index]).toBe(balances[index - 1] + amounts[index]);
          }
          expect(balances[balances.length - 1]).toBe(
            initialBalance + amounts.reduce((total, amount) => total + amount, 0),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should canonicalize identical financial facts regardless of object key order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (amount, eventId) => {
          const first = canonicalizeFinancialFacts({ amount, eventId, breakdown: { finalAmount: amount } });
          const second = canonicalizeFinancialFacts({ breakdown: { finalAmount: amount }, eventId, amount });
          expect(first).toBe(second);
        },
      ),
      { numRuns: 100 },
    );
  });
});
