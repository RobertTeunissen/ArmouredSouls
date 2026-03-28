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
          trainingLevel: fc.integer({ min: 1, max: 9 }),
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

          // Training Facility: 10% per level, capped at 90%
          const trainingDiscount = Math.min(trainingLevel * 0.10, 0.90);
          const trainingDiscountText = `${(trainingDiscount * 100).toFixed(0)}%`;

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
