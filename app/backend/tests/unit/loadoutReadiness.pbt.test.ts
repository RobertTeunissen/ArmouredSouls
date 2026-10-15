/**
 * Tests for the shared loadout readiness rule (app/shared/utils/loadout-readiness.ts).
 *
 * The rule backs backend scheduling readiness (`checkSchedulingReadiness`),
 * the battle-time check (`evaluateCombatEntry`) and the owner's
 * "Not Battle Ready" badge on the Robot Detail page.
 */

import * as fc from 'fast-check';
import {
  evaluateLoadoutReadiness,
  LOADOUT_READINESS_REASONS,
} from '../../src/shared/utils/loadout-readiness';

const RUNS = { numRuns: 200 };

const VALID_LOADOUTS = ['single', 'dual_wield', 'weapon_shield', 'two_handed'] as const;
const OFFHAND_LOADOUTS = new Set<string>(['dual_wield', 'weapon_shield']);

const weaponId = fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null });
const anyLoadout = fc.oneof(fc.constantFrom(...VALID_LOADOUTS), fc.string());

describe('evaluateLoadoutReadiness', () => {
  describe('examples', () => {
    it('single loadout is ready with a main weapon', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'single', mainWeaponId: 1, offhandWeaponId: null }))
        .toEqual({ isReady: true, reasons: [] });
    });

    it('single loadout without a main weapon is not ready', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'single', mainWeaponId: null, offhandWeaponId: 2 }))
        .toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON] });
    });

    it('two_handed loadout without a main weapon reports the two-handed reason', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'two_handed', mainWeaponId: null, offhandWeaponId: null }))
        .toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.NO_TWO_HANDED_WEAPON] });
    });

    it('two_handed loadout is ready with a main weapon', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'two_handed', mainWeaponId: 5, offhandWeaponId: null }))
        .toEqual({ isReady: true, reasons: [] });
    });

    it('dual_wield needs main and offhand, reporting both reasons in order', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'dual_wield', mainWeaponId: null, offhandWeaponId: null }))
        .toEqual({
          isReady: false,
          reasons: [LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON, LOADOUT_READINESS_REASONS.NO_OFFHAND_WEAPON],
        });
      expect(evaluateLoadoutReadiness({ loadoutType: 'dual_wield', mainWeaponId: 1, offhandWeaponId: null }))
        .toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.NO_OFFHAND_WEAPON] });
      expect(evaluateLoadoutReadiness({ loadoutType: 'dual_wield', mainWeaponId: 1, offhandWeaponId: 2 }))
        .toEqual({ isReady: true, reasons: [] });
    });

    it('weapon_shield without an offhand reports the shield reason', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'weapon_shield', mainWeaponId: 1, offhandWeaponId: null }))
        .toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.NO_SHIELD] });
      expect(evaluateLoadoutReadiness({ loadoutType: 'weapon_shield', mainWeaponId: null, offhandWeaponId: null }))
        .toEqual({
          isReady: false,
          reasons: [LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON, LOADOUT_READINESS_REASONS.NO_SHIELD],
        });
    });

    it('unknown loadout is never ready, even when fully armed', () => {
      expect(evaluateLoadoutReadiness({ loadoutType: 'balanced', mainWeaponId: 1, offhandWeaponId: 2 }))
        .toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.INVALID_LOADOUT] });
    });
  });

  describe('properties', () => {
    it('isReady is true exactly when there are no reasons', () => {
      fc.assert(
        fc.property(anyLoadout, weaponId, weaponId, (loadoutType, mainWeaponId, offhandWeaponId) => {
          const result = evaluateLoadoutReadiness({ loadoutType, mainWeaponId, offhandWeaponId });
          expect(result.isReady).toBe(result.reasons.length === 0);
        }),
        RUNS,
      );
    });

    it('valid loadouts are ready iff the required weapons are equipped', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_LOADOUTS),
          weaponId,
          weaponId,
          (loadoutType, mainWeaponId, offhandWeaponId) => {
            const needsOffhand = OFFHAND_LOADOUTS.has(loadoutType);
            const expected = mainWeaponId !== null && (!needsOffhand || offhandWeaponId !== null);
            const result = evaluateLoadoutReadiness({ loadoutType, mainWeaponId, offhandWeaponId });
            expect(result.isReady).toBe(expected);
          },
        ),
        RUNS,
      );
    });

    it('any loadout outside the four valid values is never ready', () => {
      fc.assert(
        fc.property(
          fc.string().filter(value => !(VALID_LOADOUTS as readonly string[]).includes(value)),
          weaponId,
          weaponId,
          (loadoutType, mainWeaponId, offhandWeaponId) => {
            const result = evaluateLoadoutReadiness({ loadoutType, mainWeaponId, offhandWeaponId });
            expect(result).toEqual({ isReady: false, reasons: [LOADOUT_READINESS_REASONS.INVALID_LOADOUT] });
          },
        ),
        RUNS,
      );
    });
  });
});
