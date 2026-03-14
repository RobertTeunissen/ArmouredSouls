import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import BattleConfigTab from '../BattleConfigTab';
import {
  createRobot, mockOnRobotUpdate, mockOnEquipWeapon, mockOnUnequipWeapon,
  GREEN, AMBER, RED, isColor,
} from './barColors.test-helpers';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Property 18 (Consistency): HP and Shield bars use the same color coding.
 * Validates: Requirements 6.6
 */
describe('Property 18: HP & Shield Bar Color Consistency (Property-Based Test)', () => {
  it('should apply consistent color coding to both HP and shield bars', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        fc.integer({ min: 100, max: 10000 }),
        (percent, maxHP, maxShield) => {
          const currentHP = Math.max(1, Math.floor((percent / 100) * maxHP));
          const currentShield = Math.max(1, Math.floor((percent / 100) * maxShield));

          const robot = createRobot(currentHP, maxHP, currentShield, maxShield);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const shieldSection = screen.getAllByText('Energy Shield')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          const shieldBar = shieldSection!.querySelector('.h-full') as HTMLElement;

          expect(hpBar).toBeTruthy();
          expect(shieldBar).toBeTruthy();

          const hpColor = hpBar.style.backgroundColor;
          const shieldColor = shieldBar.style.backgroundColor;
          expect(hpColor).toBe(shieldColor);

          if (percent >= 70) {
            expect(isColor(hpColor, GREEN)).toBe(true);
          } else if (percent >= 30) {
            expect(isColor(hpColor, AMBER)).toBe(true);
          } else {
            expect(isColor(hpColor, RED)).toBe(true);
          }

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
