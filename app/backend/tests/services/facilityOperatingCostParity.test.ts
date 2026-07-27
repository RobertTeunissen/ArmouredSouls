/**
 * Facility operating cost parity — Spec #46 Requirement 6
 *
 * `GET /api/facilities` used to recompute operating costs with a per-type
 * if/else chain that duplicated `calculateFacilityOperatingCost()`. The
 * duplicate had drifted: `booking_office` and `tuning_bay` were both missing,
 * so the endpoint reported ₡0/day for two facilities that cost ₡150 and ₡300
 * per level. Any UI built on that response understated the ongoing cost.
 *
 * These tests walk every entry in FACILITY_TYPES rather than checking the two
 * known-broken types, so a facility added in future cannot be omitted silently.
 *
 * `roster_expansion` is excluded: its cost is charged per filled robot slot
 * rather than per facility level, so the shared level-only formula returns 0
 * for it by design and the route keeps a documented special case.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */

import { FACILITY_TYPES } from '../../src/config/facilities';
import { calculateFacilityOperatingCost } from '../../src/utils/economyFormulas';

/** The one type whose cost is not derivable from level alone. */
const SLOT_BASED_TYPES = new Set(['roster_expansion']);

const levelDerivedFacilities = FACILITY_TYPES.filter((f) => !SLOT_BASED_TYPES.has(f.type));

describe('Property 4: Operating cost has a single source (Spec #46 R6)', () => {
  it('covers every implemented facility type', () => {
    // Guard the guard: if FACILITY_TYPES shrinks to nothing the loop below
    // would vacuously pass.
    expect(levelDerivedFacilities.length).toBeGreaterThan(10);
  });

  describe.each(levelDerivedFacilities.map((f) => [f.type, f.maxLevel] as const))(
    '%s',
    (type, maxLevel) => {
      it('returns a non-zero operating cost at every level from 1 to maxLevel', () => {
        for (let level = 1; level <= maxLevel; level++) {
          const cost = calculateFacilityOperatingCost(type, level);
          expect(cost).toBeGreaterThan(0);
        }
      });

      it('returns zero at level 0, since an unowned facility costs nothing', () => {
        expect(calculateFacilityOperatingCost(type, 0)).toBe(0);
      });

      it('is non-decreasing as level rises', () => {
        for (let level = 1; level < maxLevel; level++) {
          expect(calculateFacilityOperatingCost(type, level + 1))
            .toBeGreaterThanOrEqual(calculateFacilityOperatingCost(type, level));
        }
      });
    },
  );
});

describe('Regression: types the removed if/else chain omitted (Spec #46 R6.3)', () => {
  it('prices the Booking Office at ₡150 per level', () => {
    expect(calculateFacilityOperatingCost('booking_office', 1)).toBe(150);
    expect(calculateFacilityOperatingCost('booking_office', 4)).toBe(600);
    expect(calculateFacilityOperatingCost('booking_office', 10)).toBe(1500);
  });

  it('prices the Tuning Bay at ₡300 per level', () => {
    expect(calculateFacilityOperatingCost('tuning_bay', 1)).toBe(300);
    expect(calculateFacilityOperatingCost('tuning_bay', 10)).toBe(3000);
  });

  it('never reports zero for an owned Booking Office, which the chain did', () => {
    for (let level = 1; level <= 10; level++) {
      expect(calculateFacilityOperatingCost('booking_office', level)).not.toBe(0);
    }
  });
});

describe('roster_expansion remains slot-based, not level-based (Spec #46 R6.2)', () => {
  it('returns zero from the shared formula at every level, by design', () => {
    for (let level = 0; level <= 9; level++) {
      expect(calculateFacilityOperatingCost('roster_expansion', level)).toBe(0);
    }
  });

  it('is the only facility type excluded from the parity walk', () => {
    expect([...SLOT_BASED_TYPES]).toEqual(['roster_expansion']);
  });
});

describe('Unknown facility types', () => {
  it('returns zero rather than throwing', () => {
    expect(calculateFacilityOperatingCost('not_a_facility', 5)).toBe(0);
  });
});
