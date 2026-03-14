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
 * Property 18 (HP): HP Bar Color Coding
 * Validates: Requirements 6.6
 */
describe('Property 18: HP Bar Color Coding (Property-Based Test)', () => {
  it('should display green HP bar (#3fb950) when HP is 70-100%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(70.01), max: 100, noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (hpPercent, maxHP) => {
          const currentHP = Math.round((hpPercent / 100) * maxHP);
          const clampedHP = Math.min(currentHP, maxHP);
          const actualPercent = (clampedHP / maxHP) * 100;
          fc.pre(actualPercent >= 70);

          const robot = createRobot(clampedHP, maxHP, maxHP, maxHP);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          expect(hpBar).toBeTruthy();
          expect(isColor(hpBar.style.backgroundColor, GREEN)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display amber HP bar (#d29922) when HP is 30-69%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(30.01), max: Math.fround(69.98), noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (hpPercent, maxHP) => {
          const currentHP = Math.round((hpPercent / 100) * maxHP);
          const clampedHP = Math.min(currentHP, maxHP);
          const actualPercent = (clampedHP / maxHP) * 100;
          fc.pre(actualPercent >= 30 && actualPercent < 70);

          const robot = createRobot(clampedHP, maxHP, maxHP, maxHP);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          expect(hpBar).toBeTruthy();
          expect(isColor(hpBar.style.backgroundColor, AMBER)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display red HP bar (#f85149) when HP is 1-29%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: Math.fround(29.99), noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (hpPercent, maxHP) => {
          const currentHP = Math.max(1, Math.round((hpPercent / 100) * maxHP));
          const actualPercent = (currentHP / maxHP) * 100;
          fc.pre(actualPercent > 0 && actualPercent < 30);

          const robot = createRobot(currentHP, maxHP, maxHP, maxHP);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          expect(hpBar).toBeTruthy();
          expect(isColor(hpBar.style.backgroundColor, RED)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display correct color for edge case HP percentages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { percent: 100, expectedColor: GREEN, colorName: 'green' },
          { percent: 70, expectedColor: GREEN, colorName: 'green' },
          { percent: 69.99, expectedColor: AMBER, colorName: 'amber' },
          { percent: 30, expectedColor: AMBER, colorName: 'amber' },
          { percent: 29.99, expectedColor: RED, colorName: 'red' },
          { percent: 1, expectedColor: RED, colorName: 'red' }
        ),
        fc.integer({ min: 100, max: 10000 }),
        (scenario, maxHP) => {
          const { percent, expectedColor } = scenario;
          const currentHP = Math.max(1, Math.round((percent / 100) * maxHP));
          const actualPercent = (currentHP / maxHP) * 100;
          const actualColor = actualPercent >= 70 ? GREEN : actualPercent >= 30 ? AMBER : RED;
          fc.pre(actualColor === expectedColor);

          const robot = createRobot(currentHP, maxHP, maxHP, maxHP);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          expect(hpBar).toBeTruthy();
          expect(isColor(hpBar.style.backgroundColor, expectedColor)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain color coding across different max HP values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }),
        fc.integer({ min: 100, max: 50000 }),
        (hpPercent, maxHP) => {
          const currentHP = Math.max(1, Math.floor((hpPercent / 100) * maxHP));
          const robot = createRobot(currentHP, maxHP, maxHP, maxHP);

          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const hpSection = screen.getAllByText('Hull Integrity')[0].parentElement!.parentElement;
          const hpBar = hpSection!.querySelector('.h-full') as HTMLElement;
          expect(hpBar).toBeTruthy();

          const bg = hpBar.style.backgroundColor;
          if (hpPercent >= 70) {
            expect(isColor(bg, GREEN)).toBe(true);
          } else if (hpPercent >= 30) {
            expect(isColor(bg, AMBER)).toBe(true);
          } else {
            expect(isColor(bg, RED)).toBe(true);
          }
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
