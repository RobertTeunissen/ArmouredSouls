import { describe, expect, it } from 'vitest';
import { getOwnerBattleReadiness } from '../robot-battle-readiness';

describe('getOwnerBattleReadiness', () => {
  it('returns undefined for a sanitized payload without loadout fields', () => {
    expect(getOwnerBattleReadiness({})).toBeUndefined();
  });

  it('returns undefined when mainWeaponId is missing even with a string loadout', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'single', mainWeaponId: undefined, offhandWeaponId: null }))
      .toBeUndefined();
  });

  it('returns undefined when offhandWeaponId is missing', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'single', mainWeaponId: 1 })).toBeUndefined();
  });

  it('is ready for a single loadout with a main weapon', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'single', mainWeaponId: 1, offhandWeaponId: null }))
      .toEqual({ isReady: true, warnings: [] });
  });

  it('is not ready for a single loadout without a main weapon', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'single', mainWeaponId: null, offhandWeaponId: null }))
      .toEqual({ isReady: false, warnings: ['No main weapon equipped'] });
  });

  it('is not ready for dual_wield missing an offhand', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'dual_wield', mainWeaponId: 1, offhandWeaponId: null }))
      .toEqual({ isReady: false, warnings: ['No offhand weapon equipped'] });
  });

  it('is not ready for weapon_shield missing a shield', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'weapon_shield', mainWeaponId: 1, offhandWeaponId: null }))
      .toEqual({ isReady: false, warnings: ['No shield equipped'] });
  });

  it('is not ready for two_handed missing a main weapon', () => {
    expect(getOwnerBattleReadiness({ loadoutType: 'two_handed', mainWeaponId: null, offhandWeaponId: null }))
      .toEqual({ isReady: false, warnings: ['No two-handed weapon equipped'] });
  });

  it('ignores HP: a heavily damaged but armed robot is ready', () => {
    const robot = { loadoutType: 'single', mainWeaponId: 1, offhandWeaponId: null, currentHP: 1, maxHP: 100 };
    expect(getOwnerBattleReadiness(robot)).toEqual({ isReady: true, warnings: [] });
  });
});
