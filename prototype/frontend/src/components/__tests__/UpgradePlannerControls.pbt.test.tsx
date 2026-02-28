import { describe, test, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import UpgradePlanner from '../UpgradePlanner';

/**
 * Property-Based Tests for Upgrade Planner Controls
 * Feature: robot-detail-page-visual-enhancement
 * Properties 28-30: Reset, Academy Cap, and Insufficient Credits
 */

describe('UpgradePlanner - Control Properties', () => {
  /**
   * Property 28: Reset Plan Functionality
   * **Validates: Requirements 8.9**
   * 
   * For any upgrade plan with planned changes, clicking the "Reset Plan" button
   * should clear all planned upgrades and reset the total cost to zero.
   */
  test('Property 28: reset plan functionality', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 30 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 10 }),
        }),
        ({ attributeLevel, currentCredits, trainingLevel }) => {
          const robot = {
            id: 1,
            combatPower: attributeLevel,
            targetingSystems: attributeLevel,
            armorPlating: 10,
            criticalSystems: 10,
            penetration: 10,
            weaponControl: 10,
            attackSpeed: 10,
            shieldCapacity: 10,
            evasionThrusters: 10,
            damageDampeners: 10,
            counterProtocols: 10,
            hullIntegrity: 10,
            servoMotors: 10,
            gyroStabilizers: 10,
            hydraulicSystems: 10,
            powerCore: 10,
            combatAlgorithms: 10,
            threatAnalysis: 10,
            adaptiveAI: 10,
            logicCores: 10,
            syncProtocols: 10,
            supportSystems: 10,
            formationTactics: 10,
          };

          const academyLevels = {
            combat_training_academy: 8,
            defense_training_academy: 8,
            mobility_training_academy: 5,
            ai_training_academy: 5,
          };

          const { container } = render(
            <UpgradePlanner
              robot={robot}
              currentCredits={currentCredits}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              workshopLevel={0}
              onCommit={async () => {}}
              onNavigateToFacilities={() => {}}
            />
          );

          // Click + buttons to plan some upgrades
          const allButtons = container.querySelectorAll('button');
          const plusButtons = Array.from(allButtons).filter(btn => btn.textContent?.includes('+'));
          
          if (plusButtons.length >= 2) {
            // Plan multiple upgrades
            fireEvent.click(plusButtons[0]);
            fireEvent.click(plusButtons[1]);
            
            // Verify cost is greater than 0
            let totalCostText = container.querySelector('[class*="text-yellow-400"][class*="text-2xl"]')?.textContent || '0';
            let totalCost = parseInt(totalCostText.replace(/[^0-9]/g, '')) || 0;
            expect(totalCost).toBeGreaterThan(0);
            
            // Find and click Reset Plan button
            const resetButton = Array.from(allButtons).find(btn => 
              btn.textContent?.includes('Reset Plan')
            );
            
            if (resetButton) {
              fireEvent.click(resetButton);
              
              // Verify cost is back to 0
              totalCostText = container.querySelector('[class*="text-yellow-400"][class*="text-2xl"]')?.textContent || '0';
              totalCost = parseInt(totalCostText.replace(/[^0-9]/g, '')) || 0;
              expect(totalCost).toBe(0);
              
              // Verify remaining credits equals current credits
              const remainingCreditsElements = Array.from(container.querySelectorAll('*')).filter(
                el => el.textContent?.includes('Remaining Credits:')
              );
              const remainingText = remainingCreditsElements[0]?.textContent || '';
              // Extract only the number after "Remaining Credits:"
              const remainingMatch = remainingText.match(/Remaining Credits:\s*([-]?\d[\d,]*)/);
              const remaining = remainingMatch ? parseInt(remainingMatch[1].replace(/,/g, '')) : 0;
              expect(Math.abs(remaining - currentCredits)).toBeLessThan(10);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 29: Academy Cap Button Disabling
   * **Validates: Requirements 8.10**
   * 
   * For any attribute at its academy cap, the + button should be disabled
   * and not respond to clicks.
   */
  test('Property 29: academy cap button disabling', () => {
    fc.assert(
      fc.property(
        fc.record({
          academyLevel: fc.integer({ min: 0, max: 10 }),
          currentCredits: fc.integer({ min: 100000, max: 1000000 }),
          trainingLevel: fc.integer({ min: 0, max: 10 }),
        }),
        ({ academyLevel, currentCredits, trainingLevel }) => {
          // Calculate cap for this academy level
          const capMap: { [key: number]: number } = {
            0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
            5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
          };
          const cap = capMap[academyLevel] || 10;
          
          // Set attribute at cap
          const robot = {
            id: 1,
            combatPower: cap, // At cap
            targetingSystems: 10,
            armorPlating: 10,
            criticalSystems: 10,
            penetration: 10,
            weaponControl: 10,
            attackSpeed: 10,
            shieldCapacity: 10,
            evasionThrusters: 10,
            damageDampeners: 10,
            counterProtocols: 10,
            hullIntegrity: 10,
            servoMotors: 10,
            gyroStabilizers: 10,
            hydraulicSystems: 10,
            powerCore: 10,
            combatAlgorithms: 10,
            threatAnalysis: 10,
            adaptiveAI: 10,
            logicCores: 10,
            syncProtocols: 10,
            supportSystems: 10,
            formationTactics: 10,
          };

          const academyLevels = {
            combat_training_academy: academyLevel,
            defense_training_academy: 5,
            mobility_training_academy: 5,
            ai_training_academy: 5,
          };

          const { container } = render(
            <UpgradePlanner
              robot={robot}
              currentCredits={currentCredits}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              workshopLevel={0}
              onCommit={async () => {}}
              onNavigateToFacilities={() => {}}
            />
          );

          // Find the first + button (for combatPower which is at cap)
          const allButtons = container.querySelectorAll('button');
          const plusButtons = Array.from(allButtons).filter(btn => btn.textContent?.includes('+'));
          
          if (plusButtons.length > 0) {
            const firstPlusButton = plusButtons[0] as HTMLButtonElement;
            
            // Button should be disabled
            expect(firstPlusButton.disabled).toBe(true);
            
            // Verify cost remains 0 even if we try to click
            const initialCostText = container.querySelector('[class*="text-yellow-400"][class*="text-2xl"]')?.textContent || '0';
            const initialCost = parseInt(initialCostText.replace(/[^0-9]/g, '')) || 0;
            
            fireEvent.click(firstPlusButton);
            
            const afterClickCostText = container.querySelector('[class*="text-yellow-400"][class*="text-2xl"]')?.textContent || '0';
            const afterClickCost = parseInt(afterClickCostText.replace(/[^0-9]/g, '')) || 0;
            
            // Cost should not have changed
            expect(afterClickCost).toBe(initialCost);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30: Insufficient Credits Button Disabling
   * **Validates: Requirements 8.11**
   * 
   * For any upgrade plan where total cost exceeds current credits,
   * the "Commit Upgrades" button should be disabled.
   */
  test('Property 30: insufficient credits button disabling', () => {
    fc.assert(
      fc.property(
        fc.record({
          attributeLevel: fc.integer({ min: 1, max: 20 }),
          // Use low credits to ensure we can exceed them
          currentCredits: fc.integer({ min: 1000, max: 10000 }),
          trainingLevel: fc.integer({ min: 0, max: 2 }), // Low training to keep costs high
        }),
        ({ attributeLevel, currentCredits, trainingLevel }) => {
          const robot = {
            id: 1,
            combatPower: attributeLevel,
            targetingSystems: attributeLevel,
            armorPlating: attributeLevel,
            criticalSystems: attributeLevel,
            penetration: attributeLevel,
            weaponControl: attributeLevel,
            attackSpeed: attributeLevel,
            shieldCapacity: 10,
            evasionThrusters: 10,
            damageDampeners: 10,
            counterProtocols: 10,
            hullIntegrity: 10,
            servoMotors: 10,
            gyroStabilizers: 10,
            hydraulicSystems: 10,
            powerCore: 10,
            combatAlgorithms: 10,
            threatAnalysis: 10,
            adaptiveAI: 10,
            logicCores: 10,
            syncProtocols: 10,
            supportSystems: 10,
            formationTactics: 10,
          };

          const academyLevels = {
            combat_training_academy: 8,
            defense_training_academy: 8,
            mobility_training_academy: 5,
            ai_training_academy: 5,
          };

          const { container } = render(
            <UpgradePlanner
              robot={robot}
              currentCredits={currentCredits}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              workshopLevel={0}
              onCommit={async () => {}}
              onNavigateToFacilities={() => {}}
            />
          );

          // Click multiple + buttons to exceed credits
          const allButtons = container.querySelectorAll('button');
          const plusButtons = Array.from(allButtons).filter(btn => btn.textContent?.includes('+'));
          
          // Click many + buttons to try to exceed credits
          for (let i = 0; i < Math.min(10, plusButtons.length); i++) {
            fireEvent.click(plusButtons[i]);
          }
          
          // Get total cost
          const totalCostText = container.querySelector('[class*="text-yellow-400"][class*="text-2xl"]')?.textContent || '0';
          const totalCost = parseInt(totalCostText.replace(/[^0-9]/g, '')) || 0;
          
          // Find Commit Upgrades button
          const commitButton = Array.from(allButtons).find(btn => 
            btn.textContent?.includes('Commit Upgrades')
          ) as HTMLButtonElement | undefined;
          
          if (commitButton && totalCost > 0) {
            // If total cost exceeds credits, button should be disabled
            if (totalCost > currentCredits) {
              expect(commitButton.disabled).toBe(true);
              
              // Verify insufficient credits warning is displayed
              const warningElements = Array.from(container.querySelectorAll('*')).filter(
                el => el.textContent?.includes('Insufficient credits')
              );
              expect(warningElements.length).toBeGreaterThan(0);
            } else {
              // If we can afford it, button should be enabled
              expect(commitButton.disabled).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
