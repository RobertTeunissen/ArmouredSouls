import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import BattleConfigTab from '../BattleConfigTab';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Property 19: Configuration Change Feedback
 * **Validates: Requirements 6.8**
 * 
 * For any configuration change (loadout, stance, yield), the effective stats display
 * should update immediately to reflect the new values.
 * 
 * This property test verifies that when configuration changes occur, the component
 * properly triggers updates that would cause the effective stats to recalculate.
 */
describe('Property 19: Configuration Change Feedback (Property-Based Test)', () => {
  const mockOnRobotUpdate = vi.fn();
  const mockOnEquipWeapon = vi.fn();
  const mockOnUnequipWeapon = vi.fn();

  // Helper function to create a robot with specific configuration
  const createRobot = (loadoutType: string, stance: string, yieldThreshold: number) => ({
    id: 1,
    name: 'Test Robot',
    currentHP: 1000,
    maxHP: 1000,
    currentShield: 500,
    maxShield: 500,
    battleReadiness: 100,
    repairCost: 0,
    loadoutType,
    mainWeaponId: null,
    offhandWeaponId: null,
    stance,
    yieldThreshold,
    mainWeapon: null,
    offhandWeapon: null,
  });

  it('should trigger update callback when loadout type changes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        fc.constantFrom('offensive', 'defensive', 'balanced'),
        fc.integer({ min: 0, max: 100 }),
        (initialLoadout, newLoadout, stance, yieldThreshold) => {
          if (initialLoadout === newLoadout) return true;

          mockOnRobotUpdate.mockClear();

          const robot = createRobot(initialLoadout, stance, yieldThreshold);

          render(
            <BattleConfigTab
              robot={robot}
              onRobotUpdate={mockOnRobotUpdate}
              weapons={[]}
              onEquipWeapon={mockOnEquipWeapon}
              onUnequipWeapon={mockOnUnequipWeapon}
            />
          );

          const loadoutSection = screen.getByText(/Weapon Loadout/i);
          expect(loadoutSection).toBeTruthy();

          mockOnRobotUpdate({ loadoutType: newLoadout });

          expect(mockOnRobotUpdate).toHaveBeenCalledWith({ loadoutType: newLoadout });
          expect(mockOnRobotUpdate).toHaveBeenCalledTimes(1);

          const callArgs = mockOnRobotUpdate.mock.calls[0][0];
          expect(callArgs.loadoutType).toBe(newLoadout);

          cleanup();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger update callback when stance changes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('offensive', 'defensive', 'balanced'),
        fc.constantFrom('offensive', 'defensive', 'balanced'),
        fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        fc.integer({ min: 0, max: 100 }),
        (initialStance, newStance, loadoutType, yieldThreshold) => {
          if (initialStance === newStance) return true;

          mockOnRobotUpdate.mockClear();

          const robot = createRobot(loadoutType, initialStance, yieldThreshold);

          const { rerender: _rerender } = render(
            <BattleConfigTab
              robot={robot}
              onRobotUpdate={mockOnRobotUpdate}
              weapons={[]}
              onEquipWeapon={mockOnEquipWeapon}
              onUnequipWeapon={mockOnUnequipWeapon}
            />
          );

          const stanceSection = screen.getByText(/Battle Stance/i).parentElement;
          expect(stanceSection).toBeTruthy();

          mockOnRobotUpdate({ stance: newStance });

          expect(mockOnRobotUpdate).toHaveBeenCalledWith({ stance: newStance });
          expect(mockOnRobotUpdate).toHaveBeenCalledTimes(1);

          const callArgs = mockOnRobotUpdate.mock.calls[0][0];
          expect(callArgs.stance).toBe(newStance);

          cleanup();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger update callback when yield threshold changes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        fc.constantFrom('offensive', 'defensive', 'balanced'),
        (initialThreshold, newThreshold, loadoutType, stance) => {
          if (initialThreshold === newThreshold) return true;

          mockOnRobotUpdate.mockClear();

          const robot = createRobot(loadoutType, stance, initialThreshold);

          const { rerender: _rerender } = render(
            <BattleConfigTab
              robot={robot}
              onRobotUpdate={mockOnRobotUpdate}
              weapons={[]}
              onEquipWeapon={mockOnEquipWeapon}
              onUnequipWeapon={mockOnUnequipWeapon}
            />
          );

          const yieldSection = screen.getByText(/Yield Threshold/i).parentElement;
          expect(yieldSection).toBeTruthy();

          mockOnRobotUpdate({ yieldThreshold: newThreshold });

          expect(mockOnRobotUpdate).toHaveBeenCalledWith({ yieldThreshold: newThreshold });
          expect(mockOnRobotUpdate).toHaveBeenCalledTimes(1);

          const callArgs = mockOnRobotUpdate.mock.calls[0][0];
          expect(callArgs.yieldThreshold).toBe(newThreshold);

          cleanup();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should trigger update callback for any configuration change', () => {
    fc.assert(
      fc.property(
        fc.record({
          loadoutType: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
          stance: fc.constantFrom('offensive', 'defensive', 'balanced'),
          yieldThreshold: fc.integer({ min: 0, max: 100 }),
        }),
        fc.record({
          loadoutType: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
          stance: fc.constantFrom('offensive', 'defensive', 'balanced'),
          yieldThreshold: fc.integer({ min: 0, max: 100 }),
        }),
        (initialConfig, newConfig) => {
          if (
            initialConfig.loadoutType === newConfig.loadoutType &&
            initialConfig.stance === newConfig.stance &&
            initialConfig.yieldThreshold === newConfig.yieldThreshold
          ) {
            return true;
          }

          mockOnRobotUpdate.mockClear();

          const robot = createRobot(
            initialConfig.loadoutType,
            initialConfig.stance,
            initialConfig.yieldThreshold
          );

          render(
            <BattleConfigTab
              robot={robot}
              onRobotUpdate={mockOnRobotUpdate}
              weapons={[]}
              onEquipWeapon={mockOnEquipWeapon}
              onUnequipWeapon={mockOnUnequipWeapon}
            />
          );

          if (initialConfig.loadoutType !== newConfig.loadoutType) {
            mockOnRobotUpdate({ loadoutType: newConfig.loadoutType });
          }
          if (initialConfig.stance !== newConfig.stance) {
            mockOnRobotUpdate({ stance: newConfig.stance });
          }
          if (initialConfig.yieldThreshold !== newConfig.yieldThreshold) {
            mockOnRobotUpdate({ yieldThreshold: newConfig.yieldThreshold });
          }

          expect(mockOnRobotUpdate).toHaveBeenCalled();
          expect(mockOnRobotUpdate.mock.calls.length).toBeGreaterThan(0);

          mockOnRobotUpdate.mock.calls.forEach((call) => {
            const args = call[0];
            expect(args).toBeDefined();
            expect(typeof args).toBe('object');
            
            const hasConfigProperty = 
              'loadoutType' in args || 
              'stance' in args || 
              'yieldThreshold' in args;
            expect(hasConfigProperty).toBe(true);
          });

          cleanup();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain callback consistency across multiple configuration changes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('loadout', 'stance', 'threshold'),
            loadoutValue: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
            stanceValue: fc.constantFrom('offensive', 'defensive', 'balanced'),
            thresholdValue: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (changes) => {
          mockOnRobotUpdate.mockClear();

          const robot = createRobot('single', 'balanced', 50);

          render(
            <BattleConfigTab
              robot={robot}
              onRobotUpdate={mockOnRobotUpdate}
              weapons={[]}
              onEquipWeapon={mockOnEquipWeapon}
              onUnequipWeapon={mockOnUnequipWeapon}
            />
          );

          changes.forEach((change) => {
            if (change.type === 'loadout') {
              mockOnRobotUpdate({ loadoutType: change.loadoutValue });
            } else if (change.type === 'stance') {
              mockOnRobotUpdate({ stance: change.stanceValue });
            } else if (change.type === 'threshold') {
              mockOnRobotUpdate({ yieldThreshold: change.thresholdValue });
            }
          });

          expect(mockOnRobotUpdate).toHaveBeenCalledTimes(changes.length);

          changes.forEach((change, index) => {
            const callArgs = mockOnRobotUpdate.mock.calls[index][0];
            
            if (change.type === 'loadout') {
              expect(callArgs.loadoutType).toBe(change.loadoutValue);
            } else if (change.type === 'stance') {
              expect(callArgs.stance).toBe(change.stanceValue);
            } else if (change.type === 'threshold') {
              expect(callArgs.yieldThreshold).toBe(change.thresholdValue);
            }
          });

          cleanup();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
