import * as fc from 'fast-check';
import {
  classifyRangeBand,
  getRangePenalty,
  getWeaponOptimalRange,
  WeaponLike,
} from '../../src/services/arena/rangeBands';
import { RangeBand } from '../../src/services/arena/types';

/**
 * Property-based tests for rangeBands module.
 * Uses fast-check to verify universal properties across random inputs.
 */

/** Numeric index for range band ordering: melee=0, short=1, mid=2, long=3 */
const BAND_INDEX: Record<RangeBand, number> = {
  melee: 0,
  short: 1,
  mid: 2,
  long: 3,
};

/** Arbitrary for non-negative distances */
const arbDistance = (): fc.Arbitrary<number> =>
  fc.double({ min: 0, max: 1e4, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for a melee weapon */
const arbMeleeWeapon = (): fc.Arbitrary<WeaponLike> =>
  fc.record({
    weaponType: fc.constant('melee'),
    handsRequired: fc.oneof(fc.constant('one'), fc.constant('two')),
    name: fc.string({ minLength: 1, maxLength: 30 }),
  });

/** Arbitrary for a shield weapon */
const arbShieldWeapon = (): fc.Arbitrary<WeaponLike> =>
  fc.record({
    weaponType: fc.constant('shield'),
    handsRequired: fc.constant('shield'),
    name: fc.oneof(
      fc.constant('Light Shield'),
      fc.constant('Combat Shield'),
      fc.constant('Reactive Shield'),
      fc.string({ minLength: 1, maxLength: 30 })
    ),
  });

describe('rangeBands property tests', () => {
  /**
   * Property 7: classifyRangeBand is monotonic — increasing distance never produces a "closer" range band
   * **Validates: Requirement 3.1**
   */
  describe('Property 7: classifyRangeBand monotonicity', () => {
    it('should never produce a closer range band when distance increases (d1 < d2 implies band order non-decreasing)', () => {
      fc.assert(
        fc.property(arbDistance(), arbDistance(), (a, b) => {
          const d1 = Math.min(a, b);
          const d2 = Math.max(a, b);
          const band1 = classifyRangeBand(d1);
          const band2 = classifyRangeBand(d2);
          expect(BAND_INDEX[band2]).toBeGreaterThanOrEqual(BAND_INDEX[band1]);
        }),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 8: getRangePenalty returns exactly 1.1 when weaponRange equals currentRange for all range bands
   * **Validates: Requirement 3.6**
   */
  describe('Property 8: getRangePenalty optimal at same band', () => {
    it('should return exactly 1.1 when weaponRange equals currentRange for all range bands', () => {
      const allBands: RangeBand[] = ['melee', 'short', 'mid', 'long'];
      fc.assert(
        fc.property(fc.constantFrom(...allBands), (band: RangeBand) => {
          expect(getRangePenalty(band, band)).toBe(1.1);
        }),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 9: All melee weapons return 'melee' optimal range, all shield weapons return 'melee' optimal range
   * **Validates: Requirement 3.2**
   */
  describe('Property 9: melee and shield weapons always map to melee optimal range', () => {
    it('should return melee optimal range for any melee weapon regardless of name or hands', () => {
      fc.assert(
        fc.property(arbMeleeWeapon(), (weapon: WeaponLike) => {
          expect(getWeaponOptimalRange(weapon)).toBe('melee');
        }),
        { numRuns: 500 }
      );
    });

    it('should return melee optimal range for any shield weapon regardless of name', () => {
      fc.assert(
        fc.property(arbShieldWeapon(), (weapon: WeaponLike) => {
          expect(getWeaponOptimalRange(weapon)).toBe('melee');
        }),
        { numRuns: 500 }
      );
    });
  });
});
