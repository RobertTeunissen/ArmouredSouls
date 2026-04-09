/// <reference types="jest" />
import fc from 'fast-check';
import {
  selectWeapon,
  selectShield,
  WeaponRecord,
  WeaponSelectionParams,
} from '../../src/utils/weaponSelection';
import { TIER_CONFIGS } from '../../src/utils/tierConfig';

/**
 * Test weapons representing the full catalog structure.
 * Includes weapons across all price tiers, loadout types, and range bands.
 */
const TEST_WEAPONS: WeaponRecord[] = [
  // Budget tier (< ₡100K) - one-handed weapons
  { id: 1, name: 'Practice Sword', cost: 50000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
  { id: 2, name: 'Practice Blaster', cost: 50000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 3, name: 'Machine Pistol', cost: 94000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 4, name: 'Laser Pistol', cost: 57000, handsRequired: 'one', weaponType: 'energy', rangeBand: 'short' },
  { id: 5, name: 'Combat Knife', cost: 93000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
  { id: 6, name: 'Beam Pistol', cost: 62000, handsRequired: 'one', weaponType: 'energy', rangeBand: 'short' },
  { id: 7, name: 'Machine Gun', cost: 107000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' }, // Actually mid-tier
  // Budget tier - two-handed weapons
  { id: 8, name: 'Training Rifle', cost: 50000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'mid' },
  { id: 9, name: 'Training Beam', cost: 50000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
  { id: 10, name: 'War Club', cost: 85000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
  { id: 11, name: 'Scatter Cannon', cost: 89000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 12, name: 'Bolt Carbine', cost: 76000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'mid' },
  // Budget tier - shields
  { id: 13, name: 'Light Shield', cost: 51000, handsRequired: 'shield', weaponType: 'shield', rangeBand: 'melee' },
  { id: 14, name: 'Combat Shield', cost: 78000, handsRequired: 'shield', weaponType: 'shield', rangeBand: 'melee' },
  { id: 15, name: 'Reactive Shield', cost: 92000, handsRequired: 'shield', weaponType: 'shield', rangeBand: 'melee' },

  // Mid tier (₡100K–₡250K) - one-handed weapons
  { id: 16, name: 'Burst Rifle', cost: 117000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 17, name: 'Energy Blade', cost: 125000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
  { id: 18, name: 'Plasma Blade', cost: 145000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
  { id: 19, name: 'Flux Repeater', cost: 168000, handsRequired: 'one', weaponType: 'energy', rangeBand: 'mid' },
  // Mid tier - two-handed weapons
  { id: 20, name: 'Shock Maul', cost: 155000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
  { id: 21, name: 'Laser Rifle', cost: 185000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'mid' },
  { id: 22, name: 'Mortar System', cost: 210000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'long' },
  { id: 23, name: 'Siege Cannon', cost: 235000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'long' },
  { id: 24, name: 'Photon Marksman', cost: 195000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
  // Mid tier - shields
  { id: 25, name: 'Barrier Shield', cost: 175000, handsRequired: 'shield', weaponType: 'shield', rangeBand: 'melee' },

  // Premium tier (₡250K–₡400K) - one-handed weapons
  { id: 26, name: 'Assault Rifle', cost: 293000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 27, name: 'Gauss Pistol', cost: 285000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'mid' },
  { id: 28, name: 'Power Sword', cost: 310000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
  // Premium tier - two-handed weapons
  { id: 29, name: 'Plasma Rifle', cost: 325000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'mid' },
  { id: 30, name: 'Shotgun', cost: 275000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'short' },
  { id: 31, name: 'Grenade Launcher', cost: 295000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'mid' },
  { id: 32, name: 'Sniper Rifle', cost: 350000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'long' },
  { id: 33, name: 'Thermal Lance', cost: 365000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'melee' },
  { id: 34, name: 'Disruptor Cannon', cost: 380000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
  // Premium tier - shields
  { id: 35, name: 'Fortress Shield', cost: 320000, handsRequired: 'shield', weaponType: 'shield', rangeBand: 'melee' },
];

// Loadout types and range bands for property testing
const LOADOUT_TYPES = ['single', 'weapon_shield', 'dual_wield', 'two_handed'] as const;
const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;

// Price tier definitions matching TIER_CONFIGS
const PRICE_TIERS = {
  budget: { min: 0, max: 99999 },
  mid: { min: 100000, max: 250000 },
  premium: { min: 250000, max: 400000 },
};

describe('weaponSelection', () => {
  describe('Unit Tests', () => {
    describe('selectWeapon', () => {
      it('should select exact match when loadout + range + tier all match', () => {
        const params: WeaponSelectionParams = {
          loadoutType: 'single',
          rangeBand: 'melee',
          priceTier: PRICE_TIERS.budget,
        };

        const weapon = selectWeapon(TEST_WEAPONS, params);

        // Should be a one-handed melee weapon in budget tier
        expect(weapon.handsRequired).toBe('one');
        expect(weapon.rangeBand).toBe('melee');
        expect(weapon.cost).toBeLessThan(100000);
        expect(weapon.weaponType).not.toBe('shield');
      });

      it('should fall back to loadout + tier when no exact range match exists', () => {
        // Create a weapon list with no one-handed long-range budget weapons
        const limitedWeapons = TEST_WEAPONS.filter(
          (w) => !(w.handsRequired === 'one' && w.rangeBand === 'long' && w.cost < 100000)
        );

        const params: WeaponSelectionParams = {
          loadoutType: 'single',
          rangeBand: 'long', // No one-handed long-range budget weapons
          priceTier: PRICE_TIERS.budget,
        };

        const weapon = selectWeapon(limitedWeapons, params);

        // Should fall back to any one-handed budget weapon
        expect(weapon.handsRequired).toBe('one');
        expect(weapon.cost).toBeLessThan(100000);
        expect(weapon.weaponType).not.toBe('shield');
      });

      it('should fall back to any weapon in tier when no loadout match exists', () => {
        // Create a weapon list with only two-handed weapons in budget tier
        const twoHandedOnly = TEST_WEAPONS.filter(
          (w) => w.cost < 100000 && (w.handsRequired === 'two' || w.handsRequired === 'shield')
        );

        const params: WeaponSelectionParams = {
          loadoutType: 'single', // Needs one-handed, but none exist
          rangeBand: 'melee',
          priceTier: PRICE_TIERS.budget,
        };

        const weapon = selectWeapon(twoHandedOnly, params);

        // Should fall back to any non-shield weapon in budget tier
        expect(weapon.cost).toBeLessThan(100000);
        expect(weapon.weaponType).not.toBe('shield');
      });

      it('should throw when no weapon exists in the price tier', () => {
        const emptyTierWeapons = TEST_WEAPONS.filter((w) => w.cost >= 500000);

        const params: WeaponSelectionParams = {
          loadoutType: 'single',
          rangeBand: 'melee',
          priceTier: PRICE_TIERS.budget,
        };

        expect(() => selectWeapon(emptyTierWeapons, params)).toThrow(
          /No weapon found in price tier/
        );
      });

      it('should select two-handed weapon for two_handed loadout', () => {
        const params: WeaponSelectionParams = {
          loadoutType: 'two_handed',
          rangeBand: 'mid',
          priceTier: PRICE_TIERS.budget,
        };

        const weapon = selectWeapon(TEST_WEAPONS, params);

        expect(weapon.handsRequired).toBe('two');
        expect(weapon.cost).toBeLessThan(100000);
        expect(weapon.weaponType).not.toBe('shield');
      });

      it('should select one-handed weapon for dual_wield loadout', () => {
        const params: WeaponSelectionParams = {
          loadoutType: 'dual_wield',
          rangeBand: 'short',
          priceTier: PRICE_TIERS.mid,
        };

        const weapon = selectWeapon(TEST_WEAPONS, params);

        expect(weapon.handsRequired).toBe('one');
        expect(weapon.cost).toBeGreaterThanOrEqual(100000);
        expect(weapon.cost).toBeLessThanOrEqual(250000);
        expect(weapon.weaponType).not.toBe('shield');
      });

      it('should select one-handed weapon for weapon_shield loadout', () => {
        const params: WeaponSelectionParams = {
          loadoutType: 'weapon_shield',
          rangeBand: 'melee',
          priceTier: PRICE_TIERS.premium,
        };

        const weapon = selectWeapon(TEST_WEAPONS, params);

        expect(weapon.handsRequired).toBe('one');
        expect(weapon.cost).toBeGreaterThanOrEqual(250000);
        expect(weapon.cost).toBeLessThanOrEqual(400000);
        expect(weapon.weaponType).not.toBe('shield');
      });
    });

    describe('selectShield', () => {
      it('should select a shield from the budget tier', () => {
        const shield = selectShield(TEST_WEAPONS, PRICE_TIERS.budget);

        expect(shield.handsRequired).toBe('shield');
        expect(shield.cost).toBeLessThan(100000);
      });

      it('should select a shield from the mid tier', () => {
        const shield = selectShield(TEST_WEAPONS, PRICE_TIERS.mid);

        expect(shield.handsRequired).toBe('shield');
        expect(shield.cost).toBeGreaterThanOrEqual(100000);
        expect(shield.cost).toBeLessThanOrEqual(250000);
      });

      it('should select a shield from the premium tier', () => {
        const shield = selectShield(TEST_WEAPONS, PRICE_TIERS.premium);

        expect(shield.handsRequired).toBe('shield');
        expect(shield.cost).toBeGreaterThanOrEqual(250000);
        expect(shield.cost).toBeLessThanOrEqual(400000);
      });

      it('should throw when no shield exists in the price tier', () => {
        const noShieldWeapons = TEST_WEAPONS.filter((w) => w.handsRequired !== 'shield');

        expect(() => selectShield(noShieldWeapons, PRICE_TIERS.budget)).toThrow(
          /No shield found in price tier/
        );
      });
    });
  });


  /**
   * Property 3: Weapon selection respects loadout and price tier constraints
   * **Validates: Requirements 9.4, 9.5, 9.6, 10.4, 10.5, 10.6, 11.4, 11.5, 11.6**
   *
   * For any generated robot, the equipped main weapon must satisfy:
   * (a) its cost falls within the robot's tier price range
   * (b) its handsRequired is compatible with the robot's loadoutType
   * (c) if loadoutType is weapon_shield, the offhand weapon must be a shield within the same price tier;
   *     if dual_wield, the offhand must be a second copy of the same weapon;
   *     if single or two_handed, offhand must be null
   */
  describe('Property-Based Tests', () => {
    // Arbitraries for property testing
    const loadoutTypeArb = fc.constantFrom(...LOADOUT_TYPES);
    const rangeBandArb = fc.constantFrom(...RANGE_BANDS);
    const priceTierArb = fc.constantFrom(
      PRICE_TIERS.budget,
      PRICE_TIERS.mid,
      PRICE_TIERS.premium
    );

    describe('Property 3: Weapon selection respects loadout and price tier constraints', () => {
      it('selected weapon cost is always within the specified price tier', () => {
        fc.assert(
          fc.property(loadoutTypeArb, rangeBandArb, priceTierArb, (loadoutType, rangeBand, priceTier) => {
            const params: WeaponSelectionParams = { loadoutType, rangeBand, priceTier };

            try {
              const weapon = selectWeapon(TEST_WEAPONS, params);

              // (a) Cost must be within price tier
              expect(weapon.cost).toBeGreaterThanOrEqual(priceTier.min);
              expect(weapon.cost).toBeLessThanOrEqual(priceTier.max);
            } catch (error) {
              // If no weapon found, that's acceptable for this property
              // (Property 4 tests fallback behavior)
              expect((error as Error).message).toMatch(/No weapon found/);
            }
          }),
          { numRuns: 100 }
        );
      });

      it('selected weapon handsRequired is compatible with loadoutType', () => {
        fc.assert(
          fc.property(loadoutTypeArb, rangeBandArb, priceTierArb, (loadoutType, rangeBand, priceTier) => {
            const params: WeaponSelectionParams = { loadoutType, rangeBand, priceTier };

            try {
              const weapon = selectWeapon(TEST_WEAPONS, params);

              // (b) handsRequired must be compatible with loadoutType
              if (loadoutType === 'two_handed') {
                expect(weapon.handsRequired).toBe('two');
              } else {
                // single, weapon_shield, dual_wield all require one-handed weapons
                expect(weapon.handsRequired).toBe('one');
              }

              // Weapon must never be a shield
              expect(weapon.weaponType).not.toBe('shield');
            } catch (error) {
              expect((error as Error).message).toMatch(/No weapon found/);
            }
          }),
          { numRuns: 100 }
        );
      });

      it('weapon_shield loadout can pair main weapon with shield from same tier', () => {
        fc.assert(
          fc.property(rangeBandArb, priceTierArb, (rangeBand, priceTier) => {
            const params: WeaponSelectionParams = {
              loadoutType: 'weapon_shield',
              rangeBand,
              priceTier,
            };

            try {
              const mainWeapon = selectWeapon(TEST_WEAPONS, params);
              const shield = selectShield(TEST_WEAPONS, priceTier);

              // Main weapon must be one-handed and non-shield
              expect(mainWeapon.handsRequired).toBe('one');
              expect(mainWeapon.weaponType).not.toBe('shield');
              expect(mainWeapon.cost).toBeGreaterThanOrEqual(priceTier.min);
              expect(mainWeapon.cost).toBeLessThanOrEqual(priceTier.max);

              // Shield must be a shield in the same tier
              expect(shield.handsRequired).toBe('shield');
              expect(shield.cost).toBeGreaterThanOrEqual(priceTier.min);
              expect(shield.cost).toBeLessThanOrEqual(priceTier.max);
            } catch (error) {
              expect((error as Error).message).toMatch(/No (weapon|shield) found/);
            }
          }),
          { numRuns: 100 }
        );
      });

      it('dual_wield loadout selects one-handed weapon that can be duplicated', () => {
        fc.assert(
          fc.property(rangeBandArb, priceTierArb, (rangeBand, priceTier) => {
            const params: WeaponSelectionParams = {
              loadoutType: 'dual_wield',
              rangeBand,
              priceTier,
            };

            try {
              const weapon = selectWeapon(TEST_WEAPONS, params);

              // Dual wield requires one-handed non-shield weapon
              expect(weapon.handsRequired).toBe('one');
              expect(weapon.weaponType).not.toBe('shield');

              // The same weapon can be equipped twice (offhand is copy of main)
              // This is a design constraint, not a function constraint
              expect(weapon.cost).toBeGreaterThanOrEqual(priceTier.min);
              expect(weapon.cost).toBeLessThanOrEqual(priceTier.max);
            } catch (error) {
              expect((error as Error).message).toMatch(/No weapon found/);
            }
          }),
          { numRuns: 100 }
        );
      });

      it('single and two_handed loadouts select appropriate weapons without offhand', () => {
        fc.assert(
          fc.property(
            fc.constantFrom('single', 'two_handed') as fc.Arbitrary<'single' | 'two_handed'>,
            rangeBandArb,
            priceTierArb,
            (loadoutType, rangeBand, priceTier) => {
              const params: WeaponSelectionParams = { loadoutType, rangeBand, priceTier };

              try {
                const weapon = selectWeapon(TEST_WEAPONS, params);

                // Verify correct handsRequired
                if (loadoutType === 'single') {
                  expect(weapon.handsRequired).toBe('one');
                } else {
                  expect(weapon.handsRequired).toBe('two');
                }

                // Never a shield
                expect(weapon.weaponType).not.toBe('shield');

                // Within price tier
                expect(weapon.cost).toBeGreaterThanOrEqual(priceTier.min);
                expect(weapon.cost).toBeLessThanOrEqual(priceTier.max);
              } catch (error) {
                expect((error as Error).message).toMatch(/No weapon found/);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    /**
     * Property 4: Weapon selection fallback always produces a valid weapon
     * **Validates: Requirements 14.1, 14.2**
     *
     * For any combination of loadout type, range band, and price tier — including
     * combinations where no exact match exists in the weapon catalog — selectWeapon
     * should return a weapon from the correct price tier. If no weapon matches the
     * exact loadout + range + tier, it should fall back to loadout + tier, then to
     * any weapon in the tier.
     */
    describe('Property 4: Weapon selection fallback always produces a valid weapon', () => {
      it('fallback chain always returns a weapon when tier has weapons', () => {
        fc.assert(
          fc.property(loadoutTypeArb, rangeBandArb, priceTierArb, (loadoutType, rangeBand, priceTier) => {
            const params: WeaponSelectionParams = { loadoutType, rangeBand, priceTier };

            // TEST_WEAPONS has weapons in all three tiers, so should always succeed
            const weapon = selectWeapon(TEST_WEAPONS, params);

            // Must return a valid weapon
            expect(weapon).toBeDefined();
            expect(weapon.id).toBeGreaterThan(0);
            expect(weapon.name).toBeTruthy();

            // Must be within price tier
            expect(weapon.cost).toBeGreaterThanOrEqual(priceTier.min);
            expect(weapon.cost).toBeLessThanOrEqual(priceTier.max);

            // Must not be a shield
            expect(weapon.weaponType).not.toBe('shield');
          }),
          { numRuns: 100 }
        );
      });

      it('fallback to loadout+tier when exact range match unavailable', () => {
        // Create a catalog with gaps in range coverage
        const sparseWeapons: WeaponRecord[] = [
          // Budget: only melee one-handed, only mid two-handed
          { id: 1, name: 'Melee One', cost: 50000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
          { id: 2, name: 'Mid Two', cost: 60000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'mid' },
          // Mid tier: only short one-handed, only long two-handed
          { id: 3, name: 'Short One', cost: 150000, handsRequired: 'one', weaponType: 'ballistic', rangeBand: 'short' },
          { id: 4, name: 'Long Two', cost: 200000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
        ];

        fc.assert(
          fc.property(loadoutTypeArb, rangeBandArb, (loadoutType, rangeBand) => {
            const params: WeaponSelectionParams = {
              loadoutType,
              rangeBand,
              priceTier: PRICE_TIERS.budget,
            };

            const weapon = selectWeapon(sparseWeapons, params);

            // Should always return a budget weapon
            expect(weapon.cost).toBeLessThan(100000);
            expect(weapon.weaponType).not.toBe('shield');
          }),
          { numRuns: 100 }
        );
      });

      it('fallback to any weapon in tier when no loadout match available', () => {
        // Create a catalog with only two-handed weapons in budget tier
        const twoHandedOnlyBudget: WeaponRecord[] = [
          { id: 1, name: 'Two Hand A', cost: 50000, handsRequired: 'two', weaponType: 'melee', rangeBand: 'melee' },
          { id: 2, name: 'Two Hand B', cost: 60000, handsRequired: 'two', weaponType: 'ballistic', rangeBand: 'mid' },
          { id: 3, name: 'Two Hand C', cost: 70000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
        ];

        fc.assert(
          fc.property(
            fc.constantFrom('single', 'weapon_shield', 'dual_wield') as fc.Arbitrary<'single' | 'weapon_shield' | 'dual_wield'>,
            rangeBandArb,
            (loadoutType, rangeBand) => {
              const params: WeaponSelectionParams = {
                loadoutType,
                rangeBand,
                priceTier: PRICE_TIERS.budget,
              };

              // These loadouts need one-handed, but only two-handed exist
              // Should fall back to any weapon in tier
              const weapon = selectWeapon(twoHandedOnlyBudget, params);

              expect(weapon.cost).toBeLessThan(100000);
              expect(weapon.handsRequired).toBe('two'); // Only option available
            }
          ),
          { numRuns: 100 }
        );
      });

      it('throws error only when tier is completely empty', () => {
        const emptyBudgetTier: WeaponRecord[] = [
          // Only mid and premium weapons, no budget
          { id: 1, name: 'Mid Weapon', cost: 150000, handsRequired: 'one', weaponType: 'melee', rangeBand: 'melee' },
          { id: 2, name: 'Premium Weapon', cost: 300000, handsRequired: 'two', weaponType: 'energy', rangeBand: 'long' },
        ];

        fc.assert(
          fc.property(loadoutTypeArb, rangeBandArb, (loadoutType, rangeBand) => {
            const params: WeaponSelectionParams = {
              loadoutType,
              rangeBand,
              priceTier: PRICE_TIERS.budget,
            };

            // Should throw because no budget weapons exist
            expect(() => selectWeapon(emptyBudgetTier, params)).toThrow(/No weapon found in price tier/);
          }),
          { numRuns: 50 }
        );
      });

      it('selectShield fallback returns shield when available in tier', () => {
        fc.assert(
          fc.property(priceTierArb, (priceTier) => {
            try {
              const shield = selectShield(TEST_WEAPONS, priceTier);

              expect(shield.handsRequired).toBe('shield');
              expect(shield.cost).toBeGreaterThanOrEqual(priceTier.min);
              expect(shield.cost).toBeLessThanOrEqual(priceTier.max);
            } catch (error) {
              // Only acceptable if no shield in tier
              expect((error as Error).message).toMatch(/No shield found/);
            }
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Integration with TIER_CONFIGS', () => {
      it('all tier configs have valid price ranges that can select weapons', () => {
        for (const tierConfig of TIER_CONFIGS) {
          // Each tier should be able to select at least one weapon
          const params: WeaponSelectionParams = {
            loadoutType: 'single',
            rangeBand: 'melee',
            priceTier: tierConfig.priceTier,
          };

          const weapon = selectWeapon(TEST_WEAPONS, params);
          expect(weapon).toBeDefined();
          expect(weapon.cost).toBeGreaterThanOrEqual(tierConfig.priceTier.min);
          expect(weapon.cost).toBeLessThanOrEqual(tierConfig.priceTier.max);
        }
      });

      it('weapon_shield loadout can find shields for all tier configs', () => {
        for (const tierConfig of TIER_CONFIGS) {
          const shield = selectShield(TEST_WEAPONS, tierConfig.priceTier);
          expect(shield.handsRequired).toBe('shield');
          expect(shield.cost).toBeGreaterThanOrEqual(tierConfig.priceTier.min);
          expect(shield.cost).toBeLessThanOrEqual(tierConfig.priceTier.max);
        }
      });
    });
  });
});
