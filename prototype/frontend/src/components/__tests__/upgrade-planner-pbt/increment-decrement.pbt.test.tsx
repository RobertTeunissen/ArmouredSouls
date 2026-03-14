import { describe, test, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  renderUpgradePlanner,
  ACADEMY_CAP_MAP,
  getTotalCost,
  getPlusButtons,
  getMinusButtons,
} from './helpers';

/**
 * Property-Based Tests for Upgrade Planner Increment/Decrement
 * Feature: robot-detail-page-visual-enhancement
 */

describe('UpgradePlanner - Increment/Decrement Properties', () => {
  /**
   * Property 23: Upgrade Plan Increment
   * **Validates: Requirements 8.3**
   *
   * For any attribute below its academy cap, clicking the + button should increment
   * the planned level by 1 and update the total cost preview.
   */
  test('Property 23: upgrade plan increment', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 35 }),
          academyLevel: fc.integer({ min: 5, max: 10 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 9 }),
        }),
        ({ attributeLevel, academyLevel, currentCredits, trainingLevel }) => {
          const cap = ACADEMY_CAP_MAP[academyLevel] || 10;
          if (attributeLevel >= cap) return true;

          const { container } = renderUpgradePlanner({
            robot: { combatPower: attributeLevel },
            currentCredits,
            trainingLevel,
            academyLevels: { combat_training_academy: academyLevel },
          });

          const incrementButtons = container.querySelectorAll('button[aria-label*="Increment"]');
          const combatPowerButton = Array.from(incrementButtons).find(btn =>
            btn.getAttribute('aria-label')?.includes('Combat Power')
          );

          if (!combatPowerButton) {
            const plusButtons = getPlusButtons(container);
            if (plusButtons.length > 0) {
              const initialCost = getTotalCost(container);
              fireEvent.click(plusButtons[0]);
              expect(getTotalCost(container)).toBeGreaterThan(initialCost);
            }
          } else {
            const initialCost = getTotalCost(container);
            fireEvent.click(combatPowerButton);
            expect(getTotalCost(container)).toBeGreaterThan(initialCost);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24: Upgrade Plan Decrement
   * **Validates: Requirements 8.4**
   *
   * For any attribute with a planned level greater than its current level,
   * clicking the - button should decrement the planned level by 1 and update the total cost preview.
   */
  test('Property 24: upgrade plan decrement', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 30 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 9 }),
        }),
        ({ attributeLevel, currentCredits, trainingLevel }) => {
          const { container } = renderUpgradePlanner({
            robot: { combatPower: attributeLevel },
            currentCredits,
            trainingLevel,
          });

          const plusButtons = getPlusButtons(container);
          if (plusButtons.length > 0) {
            fireEvent.click(plusButtons[0]);
            fireEvent.click(plusButtons[0]);

            const costAfterIncrement = getTotalCost(container);

            const minusButtons = getMinusButtons(container);
            if (minusButtons.length > 0) {
              fireEvent.click(minusButtons[0]);
              expect(getTotalCost(container)).toBeLessThan(costAfterIncrement);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
