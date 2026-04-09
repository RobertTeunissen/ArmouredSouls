import * as fc from 'fast-check';
import { WEAPON_DEFINITIONS } from '../prisma/seed';

/**
 * Property-based tests for weapon stat validation.
 * Tests P3, P4, P5, P8, P9, P10, P11, P12, P16 from the design document.
 */

type WeaponDef = (typeof WEAPON_DEFINITIONS)[number];

const BONUS_FIELDS = [
  'combatPowerBonus',
  'targetingSystemsBonus',
  'criticalSystemsBonus',
  'penetrationBonus',
  'weaponControlBonus',
  'attackSpeedBonus',
  'armorPlatingBonus',
  'shieldCapacityBonus',
  'evasionThrustersBonus',
  'damageDampenersBonus',
  'counterProtocolsBonus',
  'hullIntegrityBonus',
  'servoMotorsBonus',
  'gyroStabilizersBonus',
  'hydraulicSystemsBonus',
  'powerCoreBonus',
  'combatAlgorithmsBonus',
  'threatAnalysisBonus',
  'adaptiveAIBonus',
  'logicCoresBonus',
  'syncProtocolsBonus',
  'supportSystemsBonus',
  'formationTacticsBonus',
] as const;

function getBonus(weapon: WeaponDef, field: string): number {
  return ((weapon as Record<string, unknown>)[field] as number) ?? 0;
}

function getDPS(weapon: WeaponDef): number {
  return weapon.baseDamage / weapon.cooldown;
}

function getTierFromCost(cost: number): string {
  if (cost < 100000) return 'budget';
  if (cost < 250000) return 'mid';
  if (cost < 400000) return 'premium';
  return 'luxury';
}

const TIER_ORDER = ['budget', 'mid', 'premium', 'luxury'] as const;

const weaponArb = fc.constantFrom(...WEAPON_DEFINITIONS);

const nonShieldArb = weaponArb.filter((w) => w.handsRequired !== 'shield');
const nonShieldNonStarterArb = nonShieldArb.filter((w) => w.cost !== 50000);
const shieldArb = weaponArb.filter((w) => w.handsRequired === 'shield');

describe('Weapon Properties — Stat Validation', () => {
  describe('P3: DPS Range', () => {
    /**
     * **Validates: Requirements 10.4**
     * For every non-shield weapon, DPS (baseDamage/cooldown) must be
     * between 1.5 and 6.0 inclusive. Starters (50K cost) are exempt.
     */
    test('should have DPS between 1.5 and 6.0 for non-shield, non-starter weapons', () => {
      fc.assert(
        fc.property(nonShieldNonStarterArb, (weapon) => {
          const dps = getDPS(weapon);
          expect(dps).toBeGreaterThanOrEqual(1.5);
          expect(dps).toBeLessThanOrEqual(6.0);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P4: Cooldown Range', () => {
    /**
     * **Validates: Requirements 10.3**
     * For every non-shield weapon, cooldown must be between 2 and 7 seconds inclusive.
     */
    test('should have cooldown between 2 and 7 for non-shield weapons', () => {
      fc.assert(
        fc.property(nonShieldArb, (weapon) => {
          expect(weapon.cooldown).toBeGreaterThanOrEqual(2);
          expect(weapon.cooldown).toBeLessThanOrEqual(7);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P5: Attribute Bonus Range', () => {
    /**
     * **Validates: Requirements 10.5**
     * For every weapon, each attribute bonus must be between -5 and +15 inclusive.
     */
    test('should have all attribute bonuses between -5 and +15', () => {
      fc.assert(
        fc.property(weaponArb, (weapon) => {
          for (const field of BONUS_FIELDS) {
            const bonus = getBonus(weapon, field);
            expect(bonus).toBeGreaterThanOrEqual(-5);
            expect(bonus).toBeLessThanOrEqual(15);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P8: Hand Multiplier Consistency', () => {
    /**
     * **Validates: Requirements 4.1**
     * For every weapon: one→1.0, two→1.6, shield→0.9.
     */
    test('should use the correct hand multiplier for each handsRequired value', () => {
      const EXPECTED_MULTIPLIERS: Record<string, number> = {
        one: 1.0,
        two: 1.6,
        shield: 0.9,
      };

      // Exclude starters — their cost is a flat 50K, not formula-derived
      const nonStarterArb = weaponArb.filter((w) => w.cost !== 50000);

      fc.assert(
        fc.property(nonStarterArb, (weapon) => {
          const expectedMultiplier = EXPECTED_MULTIPLIERS[weapon.handsRequired];
          expect(expectedMultiplier).toBeDefined();

          // Verify the multiplier is correct by checking that the weapon's cost
          // is consistent with the expected multiplier applied to the pricing formula
          const baseCost = 50000;
          let attributeCost = 0;
          for (const field of BONUS_FIELDS) {
            const bonus = getBonus(weapon, field);
            attributeCost += 500 * bonus * bonus;
          }
          let dpsCost = 0;
          if (weapon.baseDamage > 0 && weapon.cooldown > 0) {
            const dpsRatio = (weapon.baseDamage / weapon.cooldown) / 2.0;
            dpsCost = 50000 * (dpsRatio - 1.0) * 3.0;
          }

          const costWithExpected = Math.round(
            ((baseCost + attributeCost + dpsCost) * expectedMultiplier) / 1000
          ) * 1000;

          // Cost should match within tolerance (5K) when using the correct multiplier
          const diff = Math.abs(weapon.cost - costWithExpected);
          expect(diff).toBeLessThanOrEqual(5000);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P9: Monotonic DPS Within Columns', () => {
    /**
     * **Validates: Requirements 5.1, 5.3**
     * Within each Range × Hand Type column, the highest-DPS weapon in tier N
     * must have DPS ≤ the lowest-DPS weapon in tier N+1.
     */
    test('should have monotonically increasing DPS from Budget to Luxury within each column', () => {
      const ranges = ['melee', 'short', 'mid', 'long'] as const;
      const handTypes = ['one', 'two'] as const;

      for (const range of ranges) {
        for (const hand of handTypes) {
          // Group weapons in this column by tier
          const columnWeapons = WEAPON_DEFINITIONS.filter(
            (w) => w.rangeBand === range && w.handsRequired === hand
          );

          const tierGroups: Record<string, WeaponDef[]> = {};
          for (const tier of TIER_ORDER) {
            tierGroups[tier] = columnWeapons.filter(
              (w) => getTierFromCost(w.cost) === tier
            );
          }

          // For each adjacent tier pair, max DPS in lower tier ≤ min DPS in upper tier
          for (let i = 0; i < TIER_ORDER.length - 1; i++) {
            const lowerTier = TIER_ORDER[i];
            const upperTier = TIER_ORDER[i + 1];
            const lowerWeapons = tierGroups[lowerTier];
            const upperWeapons = tierGroups[upperTier];

            if (lowerWeapons.length === 0 || upperWeapons.length === 0) continue;

            const maxLowerDPS = Math.max(...lowerWeapons.map(getDPS));
            const minUpperDPS = Math.min(...upperWeapons.map(getDPS));

            expect(maxLowerDPS).toBeLessThanOrEqual(minUpperDPS);
          }
        }
      }
    });
  });

  describe('P10: Shield Invariants', () => {
    /**
     * **Validates: Requirements 6.3**
     * For every shield: baseDamage=0, cooldown=0, damageType='none',
     * handsRequired='shield', loadoutType='weapon_shield'.
     */
    test('should enforce shield invariants', () => {
      fc.assert(
        fc.property(shieldArb, (weapon) => {
          expect(weapon.baseDamage).toBe(0);
          expect(weapon.cooldown).toBe(0);
          expect(weapon.damageType).toBe('none');
          expect(weapon.handsRequired).toBe('shield');
          expect(weapon.loadoutType).toBe('weapon_shield');
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P11: Damage Type Consistency', () => {
    /**
     * **Validates: Requirements 7.5**
     * For every non-shield weapon: damageType must match weaponType.
     */
    test('should have damageType matching weaponType for non-shield weapons', () => {
      fc.assert(
        fc.property(nonShieldArb, (weapon) => {
          expect(weapon.damageType).toBe(weapon.weaponType);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P12: Loadout Type Consistency', () => {
    /**
     * **Validates: Requirements 7.4**
     * one→'single', two→'two_handed', shield→'weapon_shield'.
     */
    test('should have correct loadoutType for each handsRequired value', () => {
      const EXPECTED_LOADOUT: Record<string, string> = {
        one: 'single',
        two: 'two_handed',
        shield: 'weapon_shield',
      };

      fc.assert(
        fc.property(weaponArb, (weapon) => {
          const expected = EXPECTED_LOADOUT[weapon.handsRequired];
          expect(expected).toBeDefined();
          expect(weapon.loadoutType).toBe(expected);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P16: Type Diversity', () => {
    /**
     * **Validates: Requirements 6.1**
     * For every column with 5+ weapons, no single weaponType may exceed 60%.
     */
    test('should not have any weaponType exceeding 60% in columns with 5+ weapons', () => {
      const ranges = ['melee', 'short', 'mid', 'long'] as const;
      const handTypes = ['one', 'two'] as const;

      // Columns exempt from the 60% rule per design doc Section 10:
      // - 1H Melee: melee weapons are melee-typed by definition (100%)
      // - 1H Short: ballistic-heavy at 63%, noted as "marginal; acceptable"
      // - 2H Mid: ballistic-heavy at 80%, noted as "thematically appropriate for heavy ordnance"
      const exemptColumns = new Set(['melee-one', 'short-one', 'mid-two']);

      for (const range of ranges) {
        for (const hand of handTypes) {
          const columnWeapons = WEAPON_DEFINITIONS.filter(
            (w) => w.rangeBand === range && w.handsRequired === hand
          );

          if (columnWeapons.length < 5) continue;
          if (exemptColumns.has(`${range}-${hand}`)) continue;

          // Count weapon types in this column
          const typeCounts: Record<string, number> = {};
          for (const w of columnWeapons) {
            typeCounts[w.weaponType] = (typeCounts[w.weaponType] || 0) + 1;
          }

          for (const [type, count] of Object.entries(typeCounts)) {
            const percentage = count / columnWeapons.length;
            expect(percentage).toBeLessThanOrEqual(0.6);
          }
        }
      }
    });
  });
});
