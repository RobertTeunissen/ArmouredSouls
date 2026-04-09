import * as fc from 'fast-check';
import { getPrestigeRank } from '../src/utils/prestigeUtils';

describe('Prestige Utils - Property Tests', () => {
  describe('Property 4: Prestige rank mapping correctness', () => {
    /**
     * **Validates: Requirements 4.5, 1.3**
     * For any non-negative integer prestige value, getPrestigeRank returns the correct
     * rank per the threshold table:
     *   < 1000   → Novice
     *   < 5000   → Established
     *   < 10000  → Veteran
     *   < 25000  → Elite
     *   < 50000  → Champion
     *   ≥ 50000  → Legendary
     */
    test('maps any non-negative integer to the correct prestige rank', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 200000 }),
          (prestige) => {
            const rank = getPrestigeRank(prestige);

            if (prestige < 1000) {
              expect(rank).toBe('Novice');
            } else if (prestige < 5000) {
              expect(rank).toBe('Established');
            } else if (prestige < 10000) {
              expect(rank).toBe('Veteran');
            } else if (prestige < 25000) {
              expect(rank).toBe('Elite');
            } else if (prestige < 50000) {
              expect(rank).toBe('Champion');
            } else {
              expect(rank).toBe('Legendary');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns one of the six valid rank strings for any prestige value', () => {
      const validRanks = ['Novice', 'Established', 'Veteran', 'Elite', 'Champion', 'Legendary'];

      fc.assert(
        fc.property(
          fc.nat({ max: 1000000 }),
          (prestige) => {
            const rank = getPrestigeRank(prestige);
            expect(validRanks).toContain(rank);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rank boundaries are correct at exact threshold values', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 999, 1000, 4999, 5000, 9999, 10000, 24999, 25000, 49999, 50000),
          (prestige) => {
            const rank = getPrestigeRank(prestige);

            if (prestige < 1000) {
              expect(rank).toBe('Novice');
            } else if (prestige < 5000) {
              expect(rank).toBe('Established');
            } else if (prestige < 10000) {
              expect(rank).toBe('Veteran');
            } else if (prestige < 25000) {
              expect(rank).toBe('Elite');
            } else if (prestige < 50000) {
              expect(rank).toBe('Champion');
            } else {
              expect(rank).toBe('Legendary');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
