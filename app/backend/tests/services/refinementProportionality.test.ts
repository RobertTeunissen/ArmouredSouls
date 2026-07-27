/**
 * Proportional Sharpen and Forge — Spec #46 Requirement 3
 *
 * Sharpen subtracted a flat 0.25s from base cooldown and Forge added a flat 1.0
 * to base damage, so both delivered a proportional benefit inversely related to
 * the weapon's catalog stat. Two Sharpens gave a 2.0s one-handed weapon a +33.3%
 * attack rate against +9.1% for a 6.0s two-handed weapon — a 3.7x spread for the
 * same ₡1.2M. Forge carried the same 4.1x bias, and in the catalog the fast
 * weapons are also the low-damage one-handed ones, so both flat bonuses
 * compounded into a single one-handed subsidy.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9, 3.10, 3.13, 3.14, 3.15, 3.16**
 */

import * as fc from 'fast-check';
import {
  applyRefinementsToWeapon,
  SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE,
  FORGE_DAMAGE_INCREASE_PER_INSTANCE,
  type RefinementRow,
} from '../../src/shared/utils/weaponRefinement';
// Same module reached by the shared path — app/backend/src/shared/utils is a
// committed symlink to app/shared/utils (git mode 120000)
import * as sharedModule from '../../../shared/utils/weaponRefinement';

/** Every non-shield cooldown in the seed catalog. */
const CATALOG_COOLDOWNS = [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3.5, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6];
/** Every non-shield base damage in the seed catalog. */
const CATALOG_DAMAGE = [4.5, 4.5, 4.5, 6, 6, 6, 7, 7.5, 8, 8.5, 9, 10, 10.5, 11, 12.5, 13, 14, 16, 17, 18.5];

function weapon(baseDamage: number, cooldown: number) {
  return { baseDamage, cooldown } as Parameters<typeof applyRefinementsToWeapon>[0];
}

function sharpens(n: number): RefinementRow[] {
  return Array.from({ length: n }, () => ({ tier: 'sharpen', magnitude: 1, targetAttribute: null } as RefinementRow));
}

function forges(n: number): RefinementRow[] {
  return Array.from({ length: n }, () => ({ tier: 'forge', magnitude: 1, targetAttribute: null } as RefinementRow));
}

describe('Property 3: Refinement gain is invariant across weapon stats', () => {
  /**
   * **Validates: Requirements 3.7, 3.14**
   */
  it('cooldown ratio is constant across every catalog cooldown for a fixed Sharpen count', () => {
    for (const count of [0, 1, 2]) {
      const expected = 1 - SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE * count;
      for (const cd of CATALOG_COOLDOWNS) {
        const { effectiveCooldown } = applyRefinementsToWeapon(weapon(10, cd), sharpens(count));
        // Rounding to 2dp introduces at most 0.005 of absolute error
        expect(effectiveCooldown / cd).toBeCloseTo(expected, 2);
      }
    }
  });

  /**
   * **Validates: Requirements 3.8, 3.14**
   */
  it('damage ratio is constant across every catalog damage for a fixed Forge count', () => {
    for (const count of [0, 1, 2]) {
      const expected = 1 + FORGE_DAMAGE_INCREASE_PER_INSTANCE * count;
      for (const dmg of CATALOG_DAMAGE) {
        const { effectiveBaseDamage } = applyRefinementsToWeapon(weapon(dmg, 3), forges(count));
        expect(effectiveBaseDamage / dmg).toBeCloseTo(expected, 2);
      }
    }
  });

  it('holds for arbitrary positive cooldowns and damages, not just the catalog', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: 0.5, max: 60, noNaN: true }),
        fc.integer({ min: 0, max: 2 }),
        (cooldown, damage, count) => {
          const result = applyRefinementsToWeapon(weapon(damage, cooldown), [
            ...sharpens(count),
            ...forges(count),
          ]);
          expect(result.effectiveCooldown / cooldown)
            .toBeCloseTo(1 - SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE * count, 1);
          expect(result.effectiveBaseDamage / damage)
            .toBeCloseTo(1 + FORGE_DAMAGE_INCREASE_PER_INSTANCE * count, 1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('eliminates the spread the flat bonuses produced', () => {
    // Under the old flat -0.25s, a 2.0s weapon gained 33.3% attack rate at the
    // cap against 9.1% for a 6.0s weapon. Now both gain 25%.
    const fast = applyRefinementsToWeapon(weapon(4.5, 2.0), sharpens(2));
    const slow = applyRefinementsToWeapon(weapon(18.5, 6.0), sharpens(2));

    const fastRateGain = 2.0 / fast.effectiveCooldown - 1;
    const slowRateGain = 6.0 / slow.effectiveCooldown - 1;

    expect(fastRateGain).toBeCloseTo(0.25, 3);
    expect(slowRateGain).toBeCloseTo(0.25, 3);
    expect(Math.abs(fastRateGain - slowRateGain)).toBeLessThan(0.001);
  });

  it('eliminates the Forge spread too', () => {
    // Old flat +1.0 gave +44.4% on a 4.5-damage weapon and +10.8% on an 18.5.
    const low = applyRefinementsToWeapon(weapon(4.5, 3), forges(2));
    const high = applyRefinementsToWeapon(weapon(18.5, 3), forges(2));

    expect(low.effectiveBaseDamage / 4.5 - 1).toBeCloseTo(0.16, 2);
    expect(high.effectiveBaseDamage / 18.5 - 1).toBeCloseTo(0.16, 2);
  });
});

describe('Additive stacking against the catalog value (Spec #46 R3.3)', () => {
  it('two Sharpens land on exactly x0.80, not the x0.81 compounding would give', () => {
    const { effectiveCooldown } = applyRefinementsToWeapon(weapon(10, 5), sharpens(2));
    expect(effectiveCooldown).toBe(4); // 5 × 0.80 exactly
    expect(effectiveCooldown).not.toBe(4.05); // 5 × 0.9²
  });

  it('two Forges land on exactly x1.16, not the x1.1664 compounding would give', () => {
    const { effectiveBaseDamage } = applyRefinementsToWeapon(weapon(100, 3), forges(2));
    expect(effectiveBaseDamage).toBe(116); // 100 × 1.16 exactly
    expect(effectiveBaseDamage).not.toBe(116.64); // 100 × 1.08²
  });

  it('is order-independent', () => {
    const mixed: RefinementRow[] = [
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
      { tier: 'sharpen', magnitude: 1, targetAttribute: null },
      { tier: 'forge', magnitude: 1, targetAttribute: null },
    ];
    const reversed = [...mixed].reverse();

    expect(applyRefinementsToWeapon(weapon(10, 4), mixed))
      .toEqual(applyRefinementsToWeapon(weapon(10, 4), reversed));
  });
});

describe('Cap regressions (Spec #46 R3.15)', () => {
  it('a 2.0s weapon at the Sharpen cap yields 1.6s', () => {
    expect(applyRefinementsToWeapon(weapon(10, 2.0), sharpens(2)).effectiveCooldown).toBe(1.6);
  });

  it('a 6.0s weapon at the Sharpen cap yields 4.8s', () => {
    expect(applyRefinementsToWeapon(weapon(10, 6.0), sharpens(2)).effectiveCooldown).toBe(4.8);
  });
});

describe('Rounding precision (Spec #46 R3.4, R3.16)', () => {
  it('a 3.5s weapon with one Sharpen yields 3.15s, not a one-decimal rounding', () => {
    // The only catalog weapon producing two decimals at one instance.
    const { effectiveCooldown } = applyRefinementsToWeapon(weapon(14, 3.5), sharpens(1));
    expect(effectiveCooldown).toBe(3.15);
    expect(effectiveCooldown).not.toBe(3.2);
    expect(effectiveCooldown).not.toBe(3.1);
  });

  it('rounds both outputs to at most 2 decimals', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: 0.5, max: 60, noNaN: true }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        (cooldown, damage, s, f) => {
          const r = applyRefinementsToWeapon(weapon(damage, cooldown), [...sharpens(s), ...forges(f)]);
          expect(r.effectiveCooldown).toBe(Math.round(r.effectiveCooldown * 100) / 100);
          expect(r.effectiveBaseDamage).toBe(Math.round(r.effectiveBaseDamage * 100) / 100);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Effective cooldown stays strictly positive (Spec #46 R3.10)', () => {
  it('cannot reach zero at the maximum reduction, retiring the unfloored-subtraction hazard', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 20, noNaN: true }), (cooldown) => {
        // 2 is the per-tier cap; test beyond it for defence in depth
        for (const count of [2, 3, 5]) {
          expect(applyRefinementsToWeapon(weapon(10, cooldown), sharpens(count)).effectiveCooldown)
            .toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('would have gone non-positive under the old flat subtraction', () => {
    // A 0.5s cooldown minus 2 × 0.25s reached exactly zero.
    expect(0.5 - 2 * 0.25).toBe(0);
    expect(applyRefinementsToWeapon(weapon(10, 0.5), sharpens(2)).effectiveCooldown).toBe(0.4);
  });
});

describe('Symlink integrity (Spec #46 R3.13)', () => {
  it('the backend and shared import paths resolve to the same module', () => {
    // app/backend/src/shared/utils is a committed symlink to app/shared/utils.
    // If that is ever replaced by a real directory the formula would silently
    // fork between the frontend preview and the combat engine.
    expect(sharedModule.applyRefinementsToWeapon).toBe(applyRefinementsToWeapon);
    expect(sharedModule.SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE).toBe(SHARPEN_COOLDOWN_REDUCTION_PER_INSTANCE);
    expect(sharedModule.FORGE_DAMAGE_INCREASE_PER_INSTANCE).toBe(FORGE_DAMAGE_INCREASE_PER_INSTANCE);
  });

  it('produces identical outputs through either path', () => {
    const rows = [...sharpens(2), ...forges(1)];
    for (const cd of CATALOG_COOLDOWNS) {
      expect(sharedModule.applyRefinementsToWeapon(weapon(10, cd), rows))
        .toEqual(applyRefinementsToWeapon(weapon(10, cd), rows));
    }
  });
});

describe('Unchanged contracts (Spec #46 R3.5)', () => {
  it('leaves Hone and Augment handling untouched', () => {
    const result = applyRefinementsToWeapon(weapon(10, 3), [
      { tier: 'hone', magnitude: 3, targetAttribute: 'combatPower' },
      { tier: 'augment', magnitude: 5, targetAttribute: 'attackSpeed' },
    ]);
    expect(result.effectiveAttributeBonuses.combatPowerBonus).toBe(3);
    expect(result.effectiveAttributeBonuses.attackSpeedBonus).toBe(5);
    // Neither tier touches the DPS stats
    expect(result.effectiveCooldown).toBe(3);
    expect(result.effectiveBaseDamage).toBe(10);
  });

  it('returns catalog stats unchanged with no refinements', () => {
    const result = applyRefinementsToWeapon(weapon(12.5, 4), []);
    expect(result.effectiveBaseDamage).toBe(12.5);
    expect(result.effectiveCooldown).toBe(4);
  });
});
