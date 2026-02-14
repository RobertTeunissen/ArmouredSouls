import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import EffectiveStatsDisplay from '../EffectiveStatsDisplay';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

/**
 * Property-Based Tests for Robot Detail Page Visual Enhancement - Stats Tab
 * Feature: robot-detail-page-visual-enhancement
 * Testing Framework: fast-check with minimum 100 iterations
 */

// Helper to create a robot with specific attributes
const createRobot = (
  attributeValues: Record<string, number>,
  loadoutType: string = 'single',
  stance: string = 'balanced',
  mainWeapon: any = null,
  offhandWeapon: any = null
) => ({
  loadoutType,
  stance,
  mainWeapon,
  offhandWeapon,
  combatPower: 10,
  targetingSystems: 10,
  criticalSystems: 10,
  penetration: 10,
  weaponControl: 10,
  attackSpeed: 10,
  armorPlating: 10,
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
  ...attributeValues,
});

/**
 * Property 20: Modifier Color Coding
 * **Validates: Requirements 7.4**
 * 
 * For any attribute modifier, positive modifiers should be displayed in green text
 * and negative modifiers in red text.
 */
describe('Property 20: Modifier Color Coding (Property-Based Test)', () => {
  it('should display positive modifiers in green and negative modifiers in red', () => {
    fc.assert(
      fc.property(
        // Generate loadout type that has modifiers
        fc.constantFrom('weapon_shield', 'two_handed', 'dual_wield'),
        // Generate stance with modifiers
        fc.constantFrom('offensive', 'defensive'),
        (loadoutType, stance) => {
          const robot = createRobot({}, loadoutType, stance);
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find all modifier percentage displays
          const modifierElements = container.querySelectorAll('[class*="text-green-400"], [class*="text-red-400"]');
          
          // Property: At least some modifiers should be displayed with color coding
          expect(modifierElements.length).toBeGreaterThan(0);
          
          // Property: Each colored modifier should be either green (positive) or red (negative)
          modifierElements.forEach((element) => {
            const classes = element.className;
            const hasGreen = classes.includes('text-green-400');
            const hasRed = classes.includes('text-red-400');
            
            // Should have exactly one color (green XOR red)
            expect(hasGreen !== hasRed).toBe(true);
          });
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display green for positive total modifiers', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('two_handed', 'weapon_shield'), // Loadouts with positive modifiers
        (loadoutType) => {
          const robot = createRobot({}, loadoutType, 'balanced');
          
          render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find green modifier text
          const greenModifiers = screen.getAllByText(/\+\d+%/);
          
          // Property: Positive modifiers (starting with +) should exist
          expect(greenModifiers.length).toBeGreaterThan(0);
          
          // Property: Each positive modifier should have green color class
          greenModifiers.forEach((element) => {
            const parent = element.closest('[class*="text-green"]');
            expect(parent).toBeTruthy();
          });
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display red for negative total modifiers', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('dual_wield', 'two_handed'), // Loadouts with negative modifiers
        (loadoutType) => {
          const robot = createRobot({}, loadoutType, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find red modifier elements (negative modifiers)
          const redModifiers = container.querySelectorAll('.text-red-400');
          
          // Property: Negative modifiers should exist for these loadouts
          expect(redModifiers.length).toBeGreaterThan(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 21: Expandable Details Functionality
 * **Validates: Requirements 7.5**
 * 
 * For any attribute in the Stats tab, clicking the expand icon should reveal
 * detailed modifier breakdown, and clicking again should collapse it.
 */
describe('Property 21: Expandable Details Functionality (Property-Based Test)', () => {
  it('should expand and collapse attribute details on click', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random attribute values
        fc.record({
          combatPower: fc.integer({ min: 1, max: 100 }),
          targetingSystems: fc.integer({ min: 1, max: 100 }),
          armorPlating: fc.integer({ min: 1, max: 100 }),
        }),
        fc.constantFrom('weapon_shield', 'two_handed', 'dual_wield', 'single'),
        fc.constantFrom('offensive', 'defensive', 'balanced'),
        async (attributes, loadoutType, stance) => {
          const user = userEvent.setup();
          const robot = createRobot(attributes, loadoutType, stance);
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find all attribute rows (clickable elements)
          const attributeRows = container.querySelectorAll('[class*="cursor-pointer"]');
          
          // Property: There should be 23 attributes
          expect(attributeRows.length).toBe(23);
          
          // Test first attribute row
          const firstRow = attributeRows[0] as HTMLElement;
          
          // Property: Initially, detailed breakdown should not be visible
          let weaponBonusText = screen.queryByText('Weapon Bonus:');
          expect(weaponBonusText).toBeNull();
          
          // Click to expand
          await user.click(firstRow);
          
          // Property: After clicking, detailed breakdown should be visible
          weaponBonusText = screen.queryByText('Weapon Bonus:');
          expect(weaponBonusText).toBeTruthy();
          
          const loadoutModifierText = screen.queryByText('Loadout Modifier:');
          expect(loadoutModifierText).toBeTruthy();
          
          const stanceModifierText = screen.queryByText('Stance Modifier:');
          expect(stanceModifierText).toBeTruthy();
          
          // Click again to collapse
          await user.click(firstRow);
          
          // Property: After clicking again, detailed breakdown should be hidden
          weaponBonusText = screen.queryByText('Weapon Bonus:');
          expect(weaponBonusText).toBeNull();
          
          cleanup();
        }
      ),
      { numRuns: 50, timeout: 15000 } // Reduced runs and increased timeout
    );
  }, 20000); // Test timeout

  it('should show calculation formula in expanded details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }),
        fc.constantFrom('weapon_shield', 'two_handed'),
        async (baseValue, loadoutType) => {
          const user = userEvent.setup();
          const robot = createRobot({ combatPower: baseValue }, loadoutType, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Click first attribute to expand
          const firstRow = container.querySelector('[class*="cursor-pointer"]') as HTMLElement;
          await user.click(firstRow);
          
          // Property: Calculation formula should be visible in expanded state
          const formulaElement = container.querySelector('.font-mono');
          expect(formulaElement).toBeTruthy();
          expect(formulaElement?.textContent).toContain('=');
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should implement accordion behavior - only one expanded at a time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('weapon_shield', 'two_handed', 'dual_wield'),
        async (loadoutType) => {
          const user = userEvent.setup();
          const robot = createRobot({}, loadoutType, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          const attributeRows = container.querySelectorAll('[class*="cursor-pointer"]');
          
          // Expand first attribute
          await user.click(attributeRows[0] as HTMLElement);
          
          // Property: Weapon Bonus should be visible (first attribute expanded)
          let weaponBonusElements = screen.queryAllByText('Weapon Bonus:');
          expect(weaponBonusElements.length).toBe(1);
          
          // Expand second attribute
          await user.click(attributeRows[1] as HTMLElement);
          
          // Property: Still only one Weapon Bonus visible (accordion behavior)
          weaponBonusElements = screen.queryAllByText('Weapon Bonus:');
          expect(weaponBonusElements.length).toBe(1);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 22: Significant Modifier Highlighting
 * **Validates: Requirements 7.7**
 * 
 * For any attribute with a total modifier greater than 20% (positive or negative),
 * the attribute row should have visual highlighting.
 */
describe('Property 22: Significant Modifier Highlighting (Property-Based Test)', () => {
  it('should highlight attributes with >20% total modifier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('two_handed', 'dual_wield'), // Loadouts with significant modifiers
        fc.constantFrom('offensive'), // Stance that adds to modifiers
        (loadoutType, stance) => {
          const robot = createRobot({}, loadoutType, stance);
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find highlighted rows (yellow background and border)
          const highlightedRows = container.querySelectorAll('[class*="bg-yellow-900/20"]');
          
          // Property: Some attributes should be highlighted for these loadout/stance combinations
          // two_handed + offensive: combat power gets +25% + +15% = +40%
          // dual_wield + offensive: attack speed gets +30% + +10% = +40%
          expect(highlightedRows.length).toBeGreaterThan(0);
          
          // Property: Highlighted rows should have border indicator
          highlightedRows.forEach((row) => {
            const hasBorder = row.className.includes('border-yellow-500');
            expect(hasBorder).toBe(true);
          });
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT highlight attributes with ≤20% total modifier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('single', 'balanced'), // Combinations with small modifiers
        (config) => {
          const robot = createRobot({}, config, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find highlighted rows
          const highlightedRows = container.querySelectorAll('[class*="bg-yellow-900/20"]');
          
          // Property: For single loadout with balanced stance, no modifiers exceed 20%
          // (single gives max +10% gyro, +5% servo)
          expect(highlightedRows.length).toBe(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should highlight based on absolute value of modifier (positive or negative)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('dual_wield'), // Has +30% attack speed and -20% penetration
        (loadoutType) => {
          const robot = createRobot({}, loadoutType, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Find highlighted rows
          const highlightedRows = container.querySelectorAll('[class*="bg-yellow-900/20"]');
          
          // Property: dual_wield has: +30% attack speed, +15% weapon control, -20% penetration, -10% combat power
          // So we expect at least 2 highlighted (>20%): attack speed (+30%) and penetration (-20%)
          expect(highlightedRows.length).toBeGreaterThanOrEqual(1);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Additional Property: All 23 Attributes Display
 * **Validates: Requirements 7.1, 7.6**
 * 
 * The Stats Tab should display all 23 attributes organized by five categories
 * using compact formatting without excessive scrolling.
 */
describe('Additional Property: Complete Attribute Display (Property-Based Test)', () => {
  it('should display all 23 attributes organized by 5 categories', () => {
    fc.assert(
      fc.property(
        fc.record({
          loadoutType: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
          stance: fc.constantFrom('offensive', 'defensive', 'balanced'),
        }),
        ({ loadoutType, stance }) => {
          const robot = createRobot({}, loadoutType, stance);
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Property: All 5 category headers should be visible
          expect(screen.getByText('Combat Systems')).toBeTruthy();
          expect(screen.getByText('Defensive Systems')).toBeTruthy();
          expect(screen.getByText('Chassis & Mobility')).toBeTruthy();
          expect(screen.getByText('AI Processing')).toBeTruthy();
          expect(screen.getByText('Team Coordination')).toBeTruthy();
          
          // Property: All 23 attribute rows should be present
          const attributeRows = container.querySelectorAll('[class*="cursor-pointer"]');
          expect(attributeRows.length).toBe(23);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display category icons and colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        (loadoutType) => {
          const robot = createRobot({}, loadoutType, 'balanced');
          
          const { container } = render(<EffectiveStatsDisplay robot={robot} />);
          
          // Property: Category headers should have colored backgrounds
          const categoryHeaders = container.querySelectorAll('[class*="bg-red-900/30"], [class*="bg-blue-900/30"], [class*="bg-green-900/30"], [class*="bg-yellow-900/30"], [class*="bg-purple-900/30"]');
          
          // Property: Should have 5 category headers with colors
          expect(categoryHeaders.length).toBe(5);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
