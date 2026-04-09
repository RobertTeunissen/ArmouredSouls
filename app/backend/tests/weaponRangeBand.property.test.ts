import * as fc from 'fast-check';
import { WEAPON_DEFINITIONS } from '../prisma/seed';

/**
 * Property P7: Range Band Stored
 * For every weapon, the `rangeBand` field must be one of 'melee', 'short',
 * 'mid', or 'long', and must match the weapon's grid slot assignment.
 *
 * **Validates: Requirements 3.4, 7.6**
 */

const VALID_RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;

/**
 * Expected range band assignments from design document Section 4.
 * Every weapon in the catalog must appear here with its correct range band.
 */
const EXPECTED_RANGE_BANDS: Record<string, string> = {
  // Melee (17 weapons)
  'Practice Sword': 'melee',
  'Combat Knife': 'melee',
  'Energy Blade': 'melee',
  'Plasma Blade': 'melee',
  'Power Sword': 'melee',
  'Vibro Mace': 'melee',
  'War Club': 'melee',
  'Shock Maul': 'melee',
  'Thermal Lance': 'melee',
  'Battle Axe': 'melee',
  'Heavy Hammer': 'melee',
  'Light Shield': 'melee',
  'Combat Shield': 'melee',
  'Reactive Shield': 'melee',
  'Barrier Shield': 'melee',
  'Fortress Shield': 'melee',
  'Aegis Bulwark': 'melee',

  // Short (12 weapons)
  'Practice Blaster': 'short',
  'Laser Pistol': 'short',
  'Machine Pistol': 'short',
  'Machine Gun': 'short',
  'Burst Rifle': 'short',
  'Assault Rifle': 'short',
  'Plasma Rifle': 'short',
  'Volt Sabre': 'short',
  'Scatter Cannon': 'short',
  'Laser Rifle': 'short',
  'Pulse Accelerator': 'short',
  'Arc Projector': 'short',

  // Mid (9 weapons)
  'Training Rifle': 'mid',
  'Shotgun': 'mid',
  'Grenade Launcher': 'mid',
  'Plasma Cannon': 'mid',
  'Mortar System': 'mid',
  'Bolt Carbine': 'mid',
  'Flux Repeater': 'mid',
  'Disruptor Cannon': 'mid',
  'Nova Caster': 'mid',

  // Long (9 weapons)
  'Training Beam': 'long',
  'Sniper Rifle': 'long',
  'Railgun': 'long',
  'Ion Beam': 'long',
  'Siege Cannon': 'long',
  'Beam Pistol': 'long',
  'Photon Marksman': 'long',
  'Gauss Pistol': 'long',
  'Particle Lance': 'long',
};

const weaponArb = fc.constantFrom(...WEAPON_DEFINITIONS);

describe('Weapon Properties — P7: Range Band Stored', () => {
  describe('P7a: rangeBand is a valid value', () => {
    /**
     * **Validates: Requirements 3.4, 7.6**
     * For every weapon, rangeBand must be one of the 4 valid values.
     */
    test('should have a valid rangeBand for every weapon', () => {
      fc.assert(
        fc.property(weaponArb, (weapon) => {
          expect(VALID_RANGE_BANDS).toContain(weapon.rangeBand);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P7b: rangeBand matches design document grid slot assignment', () => {
    /**
     * **Validates: Requirements 3.4, 7.6**
     * For every weapon, the stored rangeBand must match the expected
     * assignment from the design document's range assignment table (Section 4).
     */
    test('should match the expected range band per the design document', () => {
      fc.assert(
        fc.property(weaponArb, (weapon) => {
          const expected = EXPECTED_RANGE_BANDS[weapon.name];
          expect(expected).toBeDefined();
          expect(weapon.rangeBand).toBe(expected);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('P7c: range band counts match design totals', () => {
    /**
     * **Validates: Requirements 3.4, 7.6**
     * The total count per range band must match the design document:
     * melee 17, short 12, mid 9, long 9 = 47 total.
     */
    test('should have correct weapon counts per range band', () => {
      const counts: Record<string, number> = { melee: 0, short: 0, mid: 0, long: 0 };
      for (const weapon of WEAPON_DEFINITIONS) {
        counts[weapon.rangeBand]++;
      }

      expect(counts.melee).toBe(17);
      expect(counts.short).toBe(12);
      expect(counts.mid).toBe(9);
      expect(counts.long).toBe(9);
      expect(WEAPON_DEFINITIONS.length).toBe(47);
    });
  });

  describe('P7d: expected range map covers all weapons', () => {
    /**
     * **Validates: Requirements 3.4, 7.6**
     * The expected range band map must have an entry for every weapon
     * in WEAPON_DEFINITIONS, and vice versa — no orphans in either direction.
     */
    test('should have a 1:1 mapping between WEAPON_DEFINITIONS and expected range bands', () => {
      const definitionNames = new Set(WEAPON_DEFINITIONS.map((w) => w.name));
      const expectedNames = new Set(Object.keys(EXPECTED_RANGE_BANDS));

      expect(definitionNames.size).toBe(expectedNames.size);
      for (const name of definitionNames) {
        expect(expectedNames.has(name)).toBe(true);
      }
    });
  });
});
