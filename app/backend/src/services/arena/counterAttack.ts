/**
 * Counter-Attack Range Checking
 *
 * Resolves whether a counter-attack can occur based on the defender's
 * weapon range and the current distance to the attacker. Melee counters
 * require melee range; ranged counters work within the weapon's optimal
 * range band. Mixed dual-wield can fall back to offhand weapon.
 *
 * All functions are pure with no module-level mutable state.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
 */

import { RobotCombatState, RangeBand } from './types';
import {
  getWeaponOptimalRange,
  classifyRangeBand,
  getRangePenalty,
  canAttack,
  WeaponLike,
} from './rangeBands';
import { calculateHydraulicBonus } from './hydraulicBonus';

/** Result of counter-attack resolution */
export interface CounterResult {
  /** Whether the counter-attack can proceed */
  canCounter: boolean;
  /** The weapon used for the counter (null if blocked) */
  weapon: WeaponLike | null;
  /** Hand used: 'main' or 'offhand' */
  hand: 'main' | 'offhand';
  /** Damage multiplier from range penalty */
  rangePenaltyMultiplier: number;
  /** Damage multiplier from hydraulic bonus (melee counters) */
  hydraulicMultiplier: number;
  /** Reason for blocking, if applicable */
  reason?: 'counter_out_of_range';
}

/**
 * Check if a weapon can reach at a given range band.
 * Non-melee weapons can always reach; melee requires melee band.
 */
function canReachAtRange(weaponRange: RangeBand, distance: number): boolean {
  if (weaponRange === 'melee') return distance <= 2;
  return true;
}

/**
 * Resolve whether a counter-attack can occur and with what weapon.
 *
 * Logic:
 * 1. Try main weapon first
 * 2. If main weapon is melee and out of range, try offhand fallback
 *    (only for dual-wield mixed loadouts)
 * 3. Apply range penalty and hydraulic bonus as appropriate
 *
 * Req 19.1–19.6
 */
export function resolveCounter(
  defender: RobotCombatState,
  attacker: RobotCombatState,
  distance: number,
): CounterResult {
  const mainWeapon = defender.robot.mainWeapon?.weapon as WeaponLike | undefined;
  const offhandWeapon = defender.robot.offhandWeapon?.weapon as WeaponLike | undefined;
  const hydraulicSystems = Number(defender.robot.hydraulicSystems ?? 0);

  if (!mainWeapon) {
    return {
      canCounter: false,
      weapon: null,
      hand: 'main',
      rangePenaltyMultiplier: 1,
      hydraulicMultiplier: 1,
      reason: 'counter_out_of_range',
    };
  }

  const mainRange = getWeaponOptimalRange(mainWeapon);
  const currentBand = classifyRangeBand(distance);

  // Check if main weapon can reach
  if (!canAttack(mainWeapon, distance)) {
    // Main weapon (melee) out of range — try offhand fallback (Req 19.3)
    if (
      offhandWeapon &&
      defender.robot.loadoutType === 'dual_wield'
    ) {
      const offhandRange = getWeaponOptimalRange(offhandWeapon);
      if (canReachAtRange(offhandRange, distance)) {
        const penalty = getRangePenalty(offhandRange, currentBand);
        const hydroBonus = currentBand === 'melee'
          ? calculateHydraulicBonus(hydraulicSystems, currentBand)
          : 1;
        return {
          canCounter: true,
          weapon: offhandWeapon,
          hand: 'offhand',
          rangePenaltyMultiplier: penalty,
          hydraulicMultiplier: hydroBonus,
        };
      }
    }

    // No fallback available
    return {
      canCounter: false,
      weapon: mainWeapon,
      hand: 'main',
      rangePenaltyMultiplier: 1,
      hydraulicMultiplier: 1,
      reason: 'counter_out_of_range',
    };
  }

  // Main weapon can reach
  const penalty = getRangePenalty(mainRange, currentBand);

  // Hydraulic bonus on melee counters (Req 19.4)
  const hydroBonus = currentBand === 'melee'
    ? calculateHydraulicBonus(hydraulicSystems, currentBand)
    : 1;

  return {
    canCounter: true,
    weapon: mainWeapon,
    hand: 'main',
    rangePenaltyMultiplier: penalty,
    hydraulicMultiplier: hydroBonus,
  };
}
