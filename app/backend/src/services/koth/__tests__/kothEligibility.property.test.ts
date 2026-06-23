/**
 * Property test: Eligibility Filtering Completeness
 *
 * Feature: unified-match-scheduling
 * Property 10: Eligibility Filtering Completeness
 *
 * Tests that checkSchedulingReadiness correctly filters robots based on
 * their loadout type and weapon configuration.
 *
 * Validates: Requirements 2.1, 2.2
 */

import * as fc from 'fast-check';
import { checkSchedulingReadiness } from '../../analytics/matchmakingService';

describe('KotH Eligibility — Property 10: Filtering Completeness', () => {
  it('dual_wield robots missing offhandWeaponId are excluded', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // has mainWeapon
        (hasMain) => {
          const robot = {
            loadoutType: 'dual_wield',
            mainWeaponId: hasMain ? 1 : null,
            offhandWeaponId: null, // always missing offhand
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('weapon_shield robots missing offhandWeaponId are excluded', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // has mainWeapon
        (hasMain) => {
          const robot = {
            loadoutType: 'weapon_shield',
            mainWeaponId: hasMain ? 1 : null,
            offhandWeaponId: null, // always missing shield
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('single loadout robots with mainWeaponId are included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // weaponId
        (weaponId) => {
          const robot = {
            loadoutType: 'single',
            mainWeaponId: weaponId,
            offhandWeaponId: null,
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('two_handed robots with mainWeaponId are included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (weaponId) => {
          const robot = {
            loadoutType: 'two_handed',
            mainWeaponId: weaponId,
            offhandWeaponId: null,
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('dual_wield robots with BOTH weapons are included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (mainId, offhandId) => {
          const robot = {
            loadoutType: 'dual_wield',
            mainWeaponId: mainId,
            offhandWeaponId: offhandId,
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('single/two_handed robots without mainWeaponId are excluded', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('single', 'two_handed'),
        (loadoutType) => {
          const robot = {
            loadoutType,
            mainWeaponId: null,
            offhandWeaponId: null,
          } as any;

          const result = checkSchedulingReadiness(robot);
          expect(result.isReady).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});
