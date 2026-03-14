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
 * Property 18 (Shield): Shield Bar Color Coding
 * Validates: Requirements 6.6
 */
describe('Property 18: Shield Bar Color Coding (Property-Based Test)', () => {
  it('should display green shield bar (#3fb950) when shield is 70-100%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(70.01), max: 100, noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (shieldPercent, maxShield) => {
          const currentShield = Math.round((shieldPercent / 100) * maxShield);
          const actualPercent = (currentShield / maxShield) * 100;
          fc.pre(actualPercent >= 70);

          const robot = createRobot(1000, 1000, currentShield, maxShield);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const shieldSection = screen.getAllByText('Energy Shield')[0].parentElement;
          const shieldBar = shieldSection!.querySelector('.h-full') as HTMLElement;
          expect(shieldBar).toBeTruthy();
          expect(isColor(shieldBar.style.backgroundColor, GREEN)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display amber shield bar (#d29922) when shield is 30-69%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(30.01), max: Math.fround(69.98), noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (shieldPercent, maxShield) => {
          const currentShield = Math.round((shieldPercent / 100) * maxShield);
          const actualPercent = (currentShield / maxShield) * 100;
          fc.pre(actualPercent >= 30 && actualPercent < 70);

          const robot = createRobot(1000, 1000, currentShield, maxShield);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const shieldSection = screen.getAllByText('Energy Shield')[0].parentElement;
          const shieldBar = shieldSection!.querySelector('.h-full') as HTMLElement;
          expect(shieldBar).toBeTruthy();
          expect(isColor(shieldBar.style.backgroundColor, AMBER)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display red shield bar (#f85149) when shield is 1-29%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: Math.fround(29.98), noNaN: true }),
        fc.integer({ min: 100, max: 10000 }),
        (shieldPercent, maxShield) => {
          const currentShield = Math.max(1, Math.round((shieldPercent / 100) * maxShield));
          const actualPercent = (currentShield / maxShield) * 100;
          fc.pre(actualPercent > 0 && actualPercent < 30);

          const robot = createRobot(1000, 1000, currentShield, maxShield);
          render(
            <BattleConfigTab robot={robot} onRobotUpdate={mockOnRobotUpdate}
              weapons={[]} onEquipWeapon={mockOnEquipWeapon} onUnequipWeapon={mockOnUnequipWeapon} />
          );

          const shieldSection = screen.getAllByText('Energy Shield')[0].parentElement;
          const shieldBar = shieldSection!.querySelector('.h-full') as HTMLElement;
          expect(shieldBar).toBeTruthy();
          expect(isColor(shieldBar.style.backgroundColor, RED)).toBe(true);
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
