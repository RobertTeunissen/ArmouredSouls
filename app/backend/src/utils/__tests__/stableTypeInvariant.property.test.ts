/**
 * Spec #55 invariant I1 (R1.3): `isGenerated = true` ⇔ `stableType = generated`.
 *
 * Every non-Activation creation path (registration, `createGeneratedStables`,
 * `prisma/seed.ts` `upsertUser`) derives its Stable_Type through
 * `stableTypeForCreation`, so proving the helper satisfies I1 for every input
 * proves it for every path. The integration suite
 * `tests/integration/automatonStableTypeMigration.test.ts` checks the rows the
 * real paths write.
 */
import * as fc from 'fast-check';
import { stableTypeForCreation } from '../stableType';

describe('Stable_Type invariant I1', () => {
  it('stableTypeForCreation satisfies I1 for every isGenerated value', () => {
    fc.assert(
      fc.property(fc.boolean(), (isGenerated) => {
        const stableType = stableTypeForCreation(isGenerated);
        expect(stableType === 'generated').toBe(isGenerated);
        expect(stableType).not.toBe('automaton');
      }),
    );
  });
});
