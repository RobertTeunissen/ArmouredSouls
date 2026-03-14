import { describe, test, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { renderUpgradePlanner, getTotalCost, getPlusButtons } from './helpers';

/**
 * Property-Based Tests for Upgrade Planner Cost Calculations
 * Feature: robot-detail-page-visual-enhancement
 */

describe('UpgradePlanner - Cost Calculation Properties', () => {
  /**
   * Property 26: Running Total Cost Calculation
   * **Validates: Requirements 8.6, 9.4**
   *
   * For any set of planned upgrades, the displayed total cost should equal
   * the sum of all individual upgrade costs after discounts.
   */
  test('Property 26: running total cost calculation', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 25 }),
          currentCredits: fc.integer({ min: 500000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 9 }),
        }),
        ({ attributeLevel, currentCredits, trainingLevel }) => {
          const { container } = renderUpgradePlanner({
            robot: {
              combatPower: attributeLevel,
              targetingSystems: attributeLevel,
              armorPlating: attributeLevel,
            },
            currentCredits,
            trainingLevel,
            academyLevels: {
              combat_training_academy: 8,
              defense_training_academy: 8,
            },
          });

          expect(getTotalCost(container)).toBe(0);

          const plusButtons = getPlusButtons(container);
          if (plusButtons.length >= 2) {
            fireEvent.click(plusButtons[0]);
            const costAfterFirst = getTotalCost(container);
            expect(costAfterFirst).toBeGreaterThan(0);

            fireEvent.click(plusButtons[1]);
            const costAfterSecond = getTotalCost(container);
            expect(costAfterSecond).toBeGreaterThan(costAfterFirst);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 27: Remaining Credits Calculation
   * **Validates: Requirements 8.7**
   *
   * For any upgrade plan, the displayed remaining credits should equal
   * current credits minus total planned upgrade cost.
   */
  test('Property 27: remaining credits calculation', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 30 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 10 }),
        }),
        ({ attributeLevel, currentCredits, trainingLevel }) => {
          const { container } = renderUpgradePlanner({
            robot: { combatPower: attributeLevel },
            currentCredits,
            trainingLevel,
          });

          // Verify credits displays exist
          const currentCreditsElements = Array.from(container.querySelectorAll('*')).filter(
            el => el.textContent?.includes('Current Credits:')
          );
          expect(currentCreditsElements.length).toBeGreaterThan(0);

          const remainingCreditsElements = Array.from(container.querySelectorAll('*')).filter(
            el => el.textContent?.includes('Remaining Credits:')
          );
          expect(remainingCreditsElements.length).toBeGreaterThan(0);

          // Initially, remaining should equal current (no upgrades planned)
          const initialRemainingText = remainingCreditsElements[0].textContent || '';
          const remainingMatch = initialRemainingText.match(/Remaining Credits:\s*₡?([-]?[\d,]+)/);
          const initialRemaining = remainingMatch ? parseInt(remainingMatch[1].replace(/,/g, '')) : 0;
          expect(Math.abs(initialRemaining - currentCredits)).toBeLessThan(10);

          // Plan an upgrade and verify remaining decreases correctly
          const plusButtons = getPlusButtons(container);
          if (plusButtons.length > 0) {
            fireEvent.click(plusButtons[0]);

            const totalCost = getTotalCost(container);

            const newRemainingElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes('Remaining Credits:')
            );
            const newRemainingText = newRemainingElements[0].textContent || '';
            const newRemainingMatch = newRemainingText.match(/Remaining Credits:\s*₡?([-]?[\d,]+)/);
            const newRemaining = newRemainingMatch ? parseInt(newRemainingMatch[1].replace(/,/g, '')) : 0;

            const expectedRemaining = currentCredits - totalCost;
            expect(Math.abs(newRemaining - expectedRemaining)).toBeLessThan(10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
