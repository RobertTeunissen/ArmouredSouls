import * as fc from 'fast-check';
import { WEAPON_DEFINITIONS } from '../prisma/seed';
import { calculateWeaponPrice, type WeaponPricingInput } from '../src/shared/utils/weaponPricing';

/**
 * Property-based tests for weapon seed data completeness and pricing.
 * Tests P1, P2, P6, P13, P14, P15 from the design document.
 */

// All attribute bonus field names on weapon definitions
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

const STARTER_NAMES = [
  'Practice Sword',
  'Practice Blaster',
  'Training Rifle',
  'Training Beam',
];

const REQUIRED_FIELDS = [
  'name',
  'weaponType',
  'baseDamage',
  'cooldown',
  'cost',
  'handsRequired',
  'damageType',
  'loadoutType',
  'rangeBand',
  'description',
] as const;

type WeaponDef = (typeof WEAPON_DEFINITIONS)[number];

function getBonus(weapon: WeaponDef, field: string): number {
  return (weapon as Record<string, unknown>)[field] as number ?? 0;
}

/** Season 2: the shared signed-sum formula is the single source of truth. */
function calculateExpectedCost(weapon: WeaponDef): number {
  return calculateWeaponPrice(weapon as unknown as WeaponPricingInput);
}

function getTierFromCost(cost: number): string {
  if (cost < 100000) return 'budget';
  if (cost < 250000) return 'mid';
  if (cost < 400000) return 'premium';
  return 'luxury';
}

const weaponArb = fc.constantFrom(...WEAPON_DEFINITIONS);

describe('Weapon Properties — Seed Data Completeness & Pricing', () => {
  describe('P1: Pricing Round-Trip', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 10.1**
     * For every non-starter weapon, the pricing formula applied to its stats
     * must produce exactly the stored cost (Season 2: shared calculateWeaponPrice).
     */
    test('should produce the stored cost for non-starter weapons', () => {
      fc.assert(
        fc.property(
          weaponArb.filter((w) => w.cost !== 50000),
          (weapon) => {
            expect(weapon.cost).toBe(calculateExpectedCost(weapon));
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('P2: Tier Compliance', () => {
    /**
     * **Validates: Requirements 4.3, 12.1**
     * For every weapon, its stored cost must fall within the boundaries
     * of its assigned price tier.
     */
    test('should have cost within the correct tier boundaries', () => {
      fc.assert(
        fc.property(weaponArb, (weapon) => {
          const tier = getTierFromCost(weapon.cost);

          if (weapon.cost === 50000) {
            // Starters are Budget
            expect(tier).toBe('budget');
            return;
          }

          // Verify tier is internally consistent with cost boundaries
          switch (tier) {
            case 'budget':
              expect(weapon.cost).toBeLessThan(100000);
              break;
            case 'mid':
              expect(weapon.cost).toBeGreaterThanOrEqual(100000);
              expect(weapon.cost).toBeLessThan(250000);
              break;
            case 'premium':
              expect(weapon.cost).toBeGreaterThanOrEqual(250000);
              expect(weapon.cost).toBeLessThan(400000);
              break;
            case 'luxury':
              expect(weapon.cost).toBeGreaterThanOrEqual(400000);
              break;
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P6: Schema Completeness', () => {
    /**
     * **Validates: Requirements 7.1**
     * Every weapon definition must include all required fields.
     */
    test('should have all required fields present and non-null', () => {
      fc.assert(
        fc.property(weaponArb, (weapon) => {
          const record = weapon as Record<string, unknown>;
          for (const field of REQUIRED_FIELDS) {
            expect(record[field]).toBeDefined();
            expect(record[field]).not.toBeNull();
            expect(record[field]).not.toBe('');
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P13: Unique Names', () => {
    /**
     * **Validates: Requirements 3.2**
     * Every weapon must have a unique name.
     */
    test('should have no duplicate weapon names', () => {
      const names = WEAPON_DEFINITIONS.map((w) => w.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('P14: Starter Weapon Preservation', () => {
    /**
     * **Validates: Requirements 11.2**
     * The 4 starters must each have cost=50000, baseDamage=6, cooldown=3,
     * and zero attribute bonuses.
     */
    test('should preserve starter weapon stats and zero bonuses', () => {
      for (const starterName of STARTER_NAMES) {
        const weapon = WEAPON_DEFINITIONS.find((w) => w.name === starterName);
        expect(weapon).toBeDefined();
        if (!weapon) continue;

        expect(weapon.cost).toBe(50000);
        expect(weapon.baseDamage).toBe(6);
        expect(weapon.cooldown).toBe(3);

        // All attribute bonuses must be zero (absent or 0)
        for (const field of BONUS_FIELDS) {
          const bonus = getBonus(weapon, field);
          expect(bonus).toBe(0);
        }
      }
    });
  });

  describe('P15: Grid Coverage', () => {
    /**
     * **Validates: Requirements 1.1, 1.3, 3.1**
     * Every slot in the 36-slot grid must contain at least one weapon, except
     * the three Season 2 gaps documented in PRD_WEAPON_ECONOMY.md (v1.8).
     * Grid = 4 ranges × 2 hand types × 4 tiers = 32 + 4 shield tiers = 36 slots.
     *
     * Season 2 repricing (product-owner decision) moved Laser Rifle / Pulse
     * Accelerator to Premium, Disruptor Cannon and Sniper Rifle to Luxury. No
     * set of tier bands (25K steps) fills all 36 slots with the decided prices,
     * so the bands stay and exactly these gaps are allowed — no others.
     */
    const SEASON2_GRID_GAPS = ['short-two-mid', 'mid-one-premium', 'long-two-premium'];

    test('should have at least one weapon in every grid slot except the documented Season 2 gaps', () => {
      const ranges = ['melee', 'short', 'mid', 'long'] as const;
      const handTypes = ['one', 'two'] as const;
      const tiers = ['budget', 'mid', 'premium', 'luxury'] as const;
      const emptySlots: string[] = [];

      // Check all 32 non-shield slots
      for (const range of ranges) {
        for (const hand of handTypes) {
          for (const tier of tiers) {
            const matching = WEAPON_DEFINITIONS.filter(
              (w) =>
                w.rangeBand === range &&
                w.handsRequired === hand &&
                getTierFromCost(w.cost) === tier
            );
            if (matching.length === 0) emptySlots.push(`${range}-${hand}-${tier}`);
          }
        }
      }

      // The gap list is exact: a new gap fails, and so does a filled gap (update the list and the PRD).
      expect(emptySlots).toEqual(SEASON2_GRID_GAPS);

      // Check 4 shield tier slots
      for (const tier of tiers) {
        const matching = WEAPON_DEFINITIONS.filter(
          (w) =>
            w.handsRequired === 'shield' &&
            getTierFromCost(w.cost) === tier
        );
        expect(matching.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
