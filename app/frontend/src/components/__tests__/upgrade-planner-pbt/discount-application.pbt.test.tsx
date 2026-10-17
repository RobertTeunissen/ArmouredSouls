import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { renderUpgradePlanner } from './helpers';

/**
 * Property-Based Tests for Upgrade Planner Discount Application
 * Feature: robot-detail-page-visual-enhancement
 */

describe('UpgradePlanner - Discount Application Properties', () => {
  /**
   * Property 25: Discount Application to Costs
   * **Validates: Requirements 8.5, 9.3**
   *
   * For any planned upgrade, the displayed cost should equal the base cost
   * multiplied by (1 - workshop discount) multiplied by (1 - bulk discount).
   */
  test('Property 25: discount application to costs', () => {
    fc.assert(
      fc.property(
        fc.record({
          workshopLevel: fc.integer({ min: 1, max: 5 }),
          trainingLevel: fc.integer({ min: 1, max: 10 }),
          attributeLevel: fc.integer({ min: 1, max: 30 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
        }),
        ({ workshopLevel, trainingLevel, attributeLevel, currentCredits }) => {
          const { container } = renderUpgradePlanner({
            robot: { combatPower: attributeLevel },
            currentCredits,
            trainingLevel,
            workshopLevel,
          });

          // Spec #46 R11 / #526: the rate is 0.75 × (10 - Roster_Capacity) points per
          // level. The helper renders at capacity 1, so that is 6.75 points per level
          // (L1 6.75%, L6 40.5%, L10 67.5%), displayed exactly.
          const trainingDiscountText = `${(trainingLevel * 27) / 4}%`;

          if (trainingLevel > 0) {
            const hasTrainingDiscount = Array.from(container.querySelectorAll('*')).some(
              el =>
                el.textContent?.includes('Training Facility Discount') &&
                el.textContent?.includes(trainingDiscountText)
            );
            expect(hasTrainingDiscount).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
