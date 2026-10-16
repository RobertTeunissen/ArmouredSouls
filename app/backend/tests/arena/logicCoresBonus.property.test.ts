import * as fc from 'fast-check';
import { calculateLogicCoresBonus } from '../../src/services/arena/logicCoresBonus';
import { calculateBaseDamage } from '../../src/services/battle/combat-simulator/combatFormulas';
import { RobotWithWeapons } from '../../src/services/battle/combatSimulator';

/**
 * Property-based tests for the Logic Cores ranged damage bonus (Season 2, #519):
 * the ranged mirror of Hydraulic Systems. Long 1 + 0.015 × LC, mid 1 + 0.01 × LC,
 * short/melee 1.0; linear and uncapped.
 */

const arbLogicCores = (): fc.Arbitrary<number> => fc.integer({ min: 1, max: 50 });

describe('logicCoresBonus property tests', () => {
  it('should order long > mid > short = melee = 1 for any logicCores', () => {
    fc.assert(
      fc.property(arbLogicCores(), (lc) => {
        const long = calculateLogicCoresBonus(lc, 'long');
        const mid = calculateLogicCoresBonus(lc, 'mid');
        expect(long).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(1);
        expect(calculateLogicCoresBonus(lc, 'short')).toBe(1.0);
        expect(calculateLogicCoresBonus(lc, 'melee')).toBe(1.0);
      }),
      { numRuns: 500 },
    );
  });

  it('should be linear: long 1 + 0.015 × LC, mid 1 + 0.01 × LC', () => {
    fc.assert(
      fc.property(arbLogicCores(), (lc) => {
        expect(calculateLogicCoresBonus(lc, 'long')).toBeCloseTo(1 + lc * 0.015, 10);
        expect(calculateLogicCoresBonus(lc, 'mid')).toBeCloseTo(1 + lc * 0.01, 10);
      }),
      { numRuns: 500 },
    );
  });

  it('should return 1.75 at long and 1.5 at mid for 50 logicCores', () => {
    expect(calculateLogicCoresBonus(50, 'long')).toBeCloseTo(1.75, 10);
    expect(calculateLogicCoresBonus(50, 'mid')).toBeCloseTo(1.5, 10);
    expect(calculateLogicCoresBonus(50, 'short')).toBe(1.0);
    expect(calculateLogicCoresBonus(50, 'melee')).toBe(1.0);
  });

  it('should not be capped beyond 50 logicCores', () => {
    fc.assert(
      fc.property(fc.integer({ min: 51, max: 500 }), (lc) => {
        expect(calculateLogicCoresBonus(lc, 'long')).toBeGreaterThan(1.75);
        expect(calculateLogicCoresBonus(lc, 'long')).toBeCloseTo(1 + lc * 0.015, 10);
        expect(calculateLogicCoresBonus(lc, 'mid')).toBeGreaterThan(1.5);
      }),
      { numRuns: 200 },
    );
  });
});

describe('calculateBaseDamage stacks hydraulic and Logic Cores multipliers', () => {
  // Test fixture cast: calculateBaseDamage only reads combatPower, weaponControl, loadoutType and stance.
  const attacker = {
    combatPower: 0, weaponControl: 0, loadoutType: 'single', stance: 'balanced',
  } as unknown as RobotWithWeapons;
  const neutral = {
    rangePenalty: 1, hydraulicBonus: 1, logicCoresBonus: 1,
    backstabBonus: 0, adaptationDamageBonus: 0, pressureDamageMod: 0, syncVolleyBonus: 0,
  };

  it('should multiply both and show both in the breakdown', () => {
    const { damage, breakdown } = calculateBaseDamage(attacker, 100, 'main', {
      ...neutral, hydraulicBonus: 1.2, logicCoresBonus: 1.5,
    });
    expect(damage).toBeCloseTo(100 * 1.2 * 1.5, 10);
    expect(breakdown.calculation).toContain('× 1.20 hydraulic × 1.50 logic');
    expect(breakdown.components.hydraulicBonus).toBe(1.2);
    expect(breakdown.components.logicCoresBonus).toBe(1.5);
  });

  it('should scale damage linearly with the Logic Cores multiplier', () => {
    fc.assert(
      fc.property(arbLogicCores(), (lc) => {
        const mult = calculateLogicCoresBonus(lc, 'long');
        const base = calculateBaseDamage(attacker, 100, 'main', neutral).damage;
        const boosted = calculateBaseDamage(attacker, 100, 'main', { ...neutral, logicCoresBonus: mult }).damage;
        expect(boosted).toBeCloseTo(base * mult, 8);
      }),
      { numRuns: 200 },
    );
  });
});
