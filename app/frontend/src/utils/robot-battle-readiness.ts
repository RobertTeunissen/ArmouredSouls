import { evaluateLoadoutReadiness } from '../../../shared/utils/loadout-readiness';

export interface BattleReadiness {
  isReady: boolean;
  warnings: string[];
}

/**
 * Loadout fields the readiness rule needs. Optional and typed as `unknown`
 * because `GET /api/robots/:id` strips them for non-owners (`RobotDetail`
 * declares them optional), so the values are checked at runtime.
 */
export interface OwnerReadinessSubject {
  loadoutType?: unknown;
  mainWeaponId?: unknown;
  offhandWeaponId?: unknown;
}

function isWeaponId(value: unknown): value is number | null {
  return typeof value === 'number' || value === null;
}

/**
 * Owner-facing battle readiness for the Robot Detail "Not Battle Ready" badge.
 * Uses the same loadout rule as backend scheduling (HP is not a criterion
 * because automatic repair runs before every battle).
 *
 * Returns `undefined` (unknown → no badge) when the loadout fields are
 * missing, e.g. a sanitized non-owner payload.
 */
export function getOwnerBattleReadiness(robot: OwnerReadinessSubject): BattleReadiness | undefined {
  const { loadoutType, mainWeaponId, offhandWeaponId } = robot;
  if (typeof loadoutType !== 'string' || !isWeaponId(mainWeaponId) || !isWeaponId(offhandWeaponId)) {
    return undefined;
  }

  const { isReady, reasons } = evaluateLoadoutReadiness({ loadoutType, mainWeaponId, offhandWeaponId });
  return { isReady, warnings: reasons };
}
