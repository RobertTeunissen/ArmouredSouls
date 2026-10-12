/**
 * Loadout-based battle readiness rule.
 *
 * Single source of truth for:
 * - backend scheduling/battle readiness (`checkBattleReadiness` in
 *   `services/analytics/matchmakingService.ts`), and
 * - the owner's "Not Battle Ready" badge on the Robot Detail page.
 *
 * HP is intentionally excluded: automatic repair runs before every battle,
 * so a damaged robot is still ready to be scheduled and to fight.
 */

export type ReadinessLoadoutType = 'single' | 'dual_wield' | 'weapon_shield' | 'two_handed';

export interface LoadoutReadinessInput {
  /** Robot loadout type. Values outside {@link ReadinessLoadoutType} are never ready. */
  loadoutType: string;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
}

export interface LoadoutReadinessResult {
  isReady: boolean;
  reasons: string[];
}

export const LOADOUT_READINESS_REASONS = {
  NO_MAIN_WEAPON: 'No main weapon equipped',
  NO_OFFHAND_WEAPON: 'No offhand weapon equipped',
  NO_SHIELD: 'No shield equipped',
  NO_TWO_HANDED_WEAPON: 'No two-handed weapon equipped',
  INVALID_LOADOUT: 'Invalid loadout type',
} as const;

/**
 * Evaluate whether a robot's equipped weapons satisfy its loadout type.
 * - single / two_handed: main weapon required.
 * - dual_wield / weapon_shield: main and offhand required.
 * - any other loadout: not ready.
 */
export function evaluateLoadoutReadiness(input: LoadoutReadinessInput): LoadoutReadinessResult {
  const reasons: string[] = [];
  let isReady: boolean;

  switch (input.loadoutType) {
    case 'single':
      isReady = input.mainWeaponId !== null;
      if (!isReady) reasons.push(LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON);
      break;

    case 'dual_wield':
      isReady = input.mainWeaponId !== null && input.offhandWeaponId !== null;
      if (input.mainWeaponId === null) reasons.push(LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON);
      if (input.offhandWeaponId === null) reasons.push(LOADOUT_READINESS_REASONS.NO_OFFHAND_WEAPON);
      break;

    case 'weapon_shield':
      isReady = input.mainWeaponId !== null && input.offhandWeaponId !== null;
      if (input.mainWeaponId === null) reasons.push(LOADOUT_READINESS_REASONS.NO_MAIN_WEAPON);
      if (input.offhandWeaponId === null) reasons.push(LOADOUT_READINESS_REASONS.NO_SHIELD);
      break;

    case 'two_handed':
      isReady = input.mainWeaponId !== null;
      if (!isReady) reasons.push(LOADOUT_READINESS_REASONS.NO_TWO_HANDED_WEAPON);
      break;

    default:
      isReady = false;
      reasons.push(LOADOUT_READINESS_REASONS.INVALID_LOADOUT);
  }

  return { isReady, reasons };
}
